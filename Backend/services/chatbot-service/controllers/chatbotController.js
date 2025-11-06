import Property from '../../../schemas/Property.js';
import ollamaService from '../services/ollamaService.js';
import vectorService from '../services/vectorService.js';
import axios from 'axios';

/**
 * Controller xử lý chatbot AI
 */
const chatbotController = {
  /**
   * Xử lý tin nhắn từ người dùng - Stateless version (không dùng session)
   */
  processMessage: async (req, res) => {
    try {
      const { message } = req.body;

      // Validation
      if (!message?.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Tin nhắn không được để trống'
        });
      }

      // Xử lý tin nhắn bằng Ollama service với cache info và metadata từ middleware
      const ollamaResult = await ollamaService.processMessage(message.trim(), req.vectorCache, req.userMetadata);
      console.log('Full Ollama Result:', JSON.stringify(ollamaResult, null, 2));
      
      if (!ollamaResult.success) {
        throw new Error('Không thể phân tích tin nhắn từ AI');
      }


      // Tìm kiếm properties nếu có search params
      const searchParams = ollamaResult.data?.searchParams;
      const searchResults = searchParams ? await chatbotController.handlePropertySearch(searchParams) : [];
      console.log(`Search Results: ${searchResults.length} properties found`);
      
      // Tạo AI response
      const aiResponse = chatbotController.buildAIResponse(
        ollamaResult.data,
        searchResults,
        searchParams
      );
      // console.log('Final AI Response:', aiResponse);

      // Trả về response
      const finalResponse = {
        success: true,
        data: aiResponse
      };
      
      console.log('Properties count in final response:', finalResponse.data?.properties?.length || 0);
      
      return res.json(finalResponse);

    } catch (error) {
      console.error('Chatbot error:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi xử lý tin nhắn. Vui lòng thử lại.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  /**
   * Xử lý tìm kiếm properties
   * Returns properties với direct fields: province, ward, detailAddress (đồng nhất với API search)
   */
  handlePropertySearch: async (searchParams) => {
    if (!searchParams || !Object.keys(searchParams).length) {
      return [];
    }

    try {
      // Convert search params sang format MongoDB query
      const query = chatbotController.buildMongoQuery(searchParams);
      console.log('MongoDB Query:', JSON.stringify(query, null, 2));

      // Thực hiện tìm kiếm - trả về properties với direct fields
      const properties = await Property.find(query)
        .sort({ promotedAt: -1, createdAt: -1 })
        .limit(50)
        .populate('owner', 'fullName email phone avatar')
        .populate('amenities', 'name icon')
        .lean();

      // Debug: Thử query đơn giản hơn
      if (properties.length === 0) {
       
        // Chỉ filter theo province  
        if (searchParams.province) {
          const provinceOnly = await Property.countDocuments({
            approvalStatus: 'approved',
            status: 'available',
            isDeleted: { $ne: true },
            province: searchParams.province
          });
          console.log(`Properties with province ${searchParams.province}: ${provinceOnly}`);
        }
        
        // Chỉ filter theo ward
        if (searchParams.ward) {
          const wardOnly = await Property.countDocuments({
            approvalStatus: 'approved',
            status: 'available',
            isDeleted: { $ne: true },
            ward: searchParams.ward
          });
          console.log(`Properties with ward ${searchParams.ward}: ${wardOnly}`);
        }
        
        // Chỉ filter theo category
        if (searchParams.category) {
          const categoryOnly = await Property.countDocuments({
            approvalStatus: 'approved',
            status: 'available',
            isDeleted: { $ne: true },
            category: searchParams.category
          });
          console.log(`Properties with category ${searchParams.category}: ${categoryOnly}`);
        }
      }

      // Properties đã có sẵn các trường province, ward, detailAddress
      // Không cần tạo nested location object nữa - đồng nhất với API search property
      
      return properties;

    } catch (error) {
      console.error('Property search error:', error);
      return [];
    }
  },

  /**
   * Build MongoDB query từ search parameters
   */
  buildMongoQuery: (searchParams) => {
    const query = {
      approvalStatus: 'approved',
      status: 'available',
      isDeleted: { $ne: true }
    };

    // Chỉ hiển thị tin đăng có gói còn hiệu lực hoặc không có gói (tin miễn phí)
    const now = new Date();
    query.$and = [
      {
        $or: [
          { 'packageInfo.expiryDate': { $gt: now } }, // Gói còn hiệu lực theo thời gian
          { 'packageInfo.expiryDate': { $exists: false } }, // Không có thông tin gói
          { 'packageInfo.expiryDate': null } // Gói không có ngày hết hạn
        ]
      },
      {
        $or: [
          { 'packageInfo.isActive': true }, // Gói đang active
          { 'packageInfo.isActive': { $exists: false } }, // Không có thông tin isActive (tin miễn phí)
          { 'packageInfo.isActive': null } // isActive null (tin miễn phí)
        ]
      }
    ];

    // Location filters - direct field matching (province, ward are strings)
    if (searchParams.province) query.province = searchParams.province;
    if (searchParams.ward) query.ward = searchParams.ward;

    // Category filter
    if (searchParams.category) query.category = searchParams.category;

    // Price range
    if (searchParams.minPrice || searchParams.maxPrice) {
      query.rentPrice = {};
      if (searchParams.minPrice) query.rentPrice.$gte = parseInt(searchParams.minPrice);
      if (searchParams.maxPrice) query.rentPrice.$lte = parseInt(searchParams.maxPrice);
    }

    // Area range
    if (searchParams.minArea || searchParams.maxArea) {
      query.area = {};
      if (searchParams.minArea) query.area.$gte = parseInt(searchParams.minArea);
      if (searchParams.maxArea) query.area.$lte = parseInt(searchParams.maxArea);
    }

    // Amenities
    if (searchParams.amenities) {
      const amenityIds = searchParams.amenities.split(',').map(id => id.trim());
      query.amenities = { $in: amenityIds };
    }

    return query;
  },

  /**
   * Tạo AI response object
   */
  buildAIResponse: (ollamaData, searchResults, searchParams) => {
    // Kiểm tra nếu đây không phải câu hỏi về phòng trọ
    if (!ollamaData.isRoomSearchQuery) {
      return {
        message: ollamaData.message || "Em xin lỗi, nhưng em chỉ có thể hỗ trợ các câu hỏi liên quan đến tìm kiếm phòng trọ, căn hộ và các dịch vụ bất động sản. Nếu Anh/Chị có nhu cầu tìm phòng trọ hoặc căn hộ, em rất sẵn lòng hỗ trợ!",
        properties: [],
        totalFound: 0,
        suggestions: [
          'Tìm phòng trọ phù hợp',
          'Tìm căn hộ chung cư',
          'Tìm nhà nguyên căn',
          'Xem tin đăng mới nhất'
        ],
        searchParams: null,
        processingTime: ollamaData.processingTime,
        source: ollamaData.source
      };
    }

    // Đây là câu hỏi về phòng trọ hợp lệ
    return {
      message: `Tôi đã tìm thấy ${searchResults.length} kết quả phù hợp với yêu cầu của bạn.`,
      properties: searchResults,
      totalFound: searchResults.length,
      suggestions: searchResults.length > 0 ? 
        chatbotController.getSearchSuggestions(searchParams) : 
        chatbotController.getGeneralSuggestions(),
      searchParams: searchParams,
      processingTime: ollamaData.processingTime,
      source: ollamaData.source
    };
  },


  /**
   * Gợi ý dựa trên search parameters
   */
  getSearchSuggestions: (searchParams) => {
    const suggestions = [];
    
    if (searchParams?.category) suggestions.push('Xem thêm cùng loại hình');
    if (searchParams?.maxPrice) suggestions.push('Tìm với mức giá khác');
    if (searchParams?.province) suggestions.push('Tìm khu vực lân cận');
    if (searchParams?.ward) suggestions.push('Tìm phường/xã khác');
    suggestions.push('Lọc theo tiện ích');
    
    return suggestions.length > 0 ? suggestions : chatbotController.getGeneralSuggestions();
  },


  /**
   * Gợi ý chung .
   */
  getGeneralSuggestions: () => {
    return [
      'Hãy cho tôi biết bạn đang tìm loại phòng gì?',
      'Bạn có ngân sách dự kiến không?',
      'Khu vực nào bạn muốn tìm kiếm?',
      'Xem các tin đăng mới nhất'
    ];
  },


};

export default chatbotController;
