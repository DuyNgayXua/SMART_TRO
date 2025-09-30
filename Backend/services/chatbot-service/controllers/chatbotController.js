import Property from '../../../schemas/Property.js';
import ollamaService from '../services/ollamaService.js';
import vectorService from '../services/vectorService.js';
import axios from 'axios';

// Helper functions for location API
const fetchDistricts = async (provinceCode) => {
  try {
    const response = await axios.get(`https://provinces.open-api.vn/api/p/${provinceCode}?depth=2`, { timeout: 5000 });
    return response.data.districts || [];
  } catch (error) {
    console.error('Error fetching districts:', error.message);
    return [];
  }
};

const fetchWards = async (districtCode) => {
  try {
    const response = await axios.get(`https://provinces.open-api.vn/api/d/${districtCode}?depth=2`, { timeout: 5000 });
    return response.data.wards || [];
  } catch (error) {
    console.error('Error fetching wards:', error.message);  
    return [];
  }
};

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
      console.log('🔍 Full Ollama Result:', JSON.stringify(ollamaResult, null, 2));
      
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
      
      console.log('🔍 Properties count in final response:', finalResponse.data?.properties?.length || 0);
      
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
   */
  handlePropertySearch: async (searchParams) => {
    if (!searchParams || !Object.keys(searchParams).length) {
      return [];
    }

    try {
      // Convert search params sang format MongoDB query
      const query = chatbotController.buildMongoQuery(searchParams);
      console.log('MongoDB Query:', JSON.stringify(query, null, 2));

      // Thực hiện tìm kiếm
      const properties = await Property.find(query)
        .sort({ promotedAt: -1, createdAt: -1 })
        .limit(50)
        .populate('owner', 'fullName email phone avatar')
        .populate('amenities', 'name icon')
        .lean();

      // Debug: Thử query đơn giản hơn
      if (properties.length === 0) {
       
        // Chỉ filter theo province  
        if (searchParams.provinceId) {
          const provinceOnly = await Property.countDocuments({
            approvalStatus: 'approved',
            status: 'available',
            isDeleted: { $ne: true },
            province: searchParams.provinceId
          });
          console.log(`Properties with provinceId ${searchParams.provinceId}: ${provinceOnly}`);
        }
        
        // Chỉ filter theo category
        if (searchParams.category) {
          const categoryOnly = await Property.countDocuments({
            approvalStatus: 'approved',
            status: 'available',
            isDeleted: { $ne: true },
            category: searchParams.category
          });
         
        }
      }

      // Nếu có properties, thêm location mapping
      if (properties.length > 0) {
        // Lấy provinces từ ollamaService cache hoặc API
        const provinces = await ollamaService.getProvinces();
        const provinceMap = new Map(provinces.map(p => [String(p.code), p.name]));

        // Lấy districts & wards theo properties tìm được  
        const districtMap = new Map();
        const wardMap = new Map();

        for (const property of properties) {
          if (property.province && !districtMap.has(property.district)) {
            try {
              const districts = await fetchDistricts(property.province);
              districts.forEach(d => districtMap.set(String(d.code), d.name));
            } catch (error) {
              console.error('Error fetching districts for province:', property.province, error);
            }
          }
          if (property.district && !wardMap.has(property.ward)) {
            try {
              const wards = await fetchWards(property.district);
              wards.forEach(w => wardMap.set(String(w.code), w.name));
            } catch (error) {
              console.error('Error fetching wards for district:', property.district, error);
            }
          }
        }

        // Map location codes to names - đưa vào cấu trúc nested location
        properties.forEach(property => {
          property.location = {
            provinceName: provinceMap.get(String(property.province)) || property.province,
            districtName: districtMap.get(String(property.district)) || property.district,
            wardName: wardMap.get(String(property.ward)) || property.ward,
            provinceCode: property.province,
            districtCode: property.district,
            wardCode: property.ward,
            detailAddress: property.detailAddress || ''
          };
        });
      }
      
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

    // Location filters - based on Property schema structure
    if (searchParams.provinceId) query.province = searchParams.provinceId;
    if (searchParams.districtId) query.district = searchParams.districtId;
    if (searchParams.wardId) query.ward = searchParams.wardId;

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
    if (searchParams?.provinceId) suggestions.push('Tìm khu vực lân cận');
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
