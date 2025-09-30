import axios from 'axios';
import vectorService from './vectorService.js';
import { response } from 'express';

/**
 * Tích hợp với Ollama server để phân tích tin nhắn người dùng
 * Với Vector Database caching cho tốc độ tối ưu
 */
class OllamaService {
  constructor() {
    this.ollamaURL = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'llama3.2:latest'; // Model cho text generation
    this.embeddingModel = process.env.EMBEDDING_MODEL || 'nomic-embed-text:latest'; // Model cho embeddings
    this.enabled = process.env.MCP_ENABLED === 'true' || true;

    // Cache để tối ưu performance
    this.provinceCache = new Map();
    this.districtCache = new Map();
    this.amenityCache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Lấy danh sách provinces từ API với cache
   */
  async getProvinces() {
    const cacheKey = 'provinces';
    const cached = this.provinceCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
      return cached.data;
    }

    try {
      const response = await axios.get('https://provinces.open-api.vn/api/p/', { timeout: 5000 });
      let provinces = response.data;
      
      // Đảm bảo provinces là array
      if (!Array.isArray(provinces)) {
        console.warn('Provinces API returned non-array:', typeof provinces);
        provinces = [];
      }
      
      // console.log(`Loaded ${provinces.length} provinces from API`);

      this.provinceCache.set(cacheKey, {
        data: provinces,
        timestamp: Date.now()
      });

      return provinces;
    } catch (error) {
      console.error('Error fetching provinces:', error.message);
      return [];
    }
  }

  /**
   * Lấy danh sách districts của một province từ API với cache
   */
  async getDistricts(provinceId) {
    if (!provinceId) return [];

    const cacheKey = `districts_${provinceId}`;
    const cached = this.districtCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
      return cached.data;
    }

    try {
      const response = await axios.get(`https://provinces.open-api.vn/api/p/${provinceId}?depth=2`, { timeout: 5000 });
      let districts = response.data.districts || [];
      
      // Đảm bảo districts là array
      if (!Array.isArray(districts)) {
        console.warn('Districts API returned non-array:', typeof districts);
        districts = [];
      }
      
      // console.log(`Loaded ${districts.length} districts for province ${provinceId} from API`);

      this.districtCache.set(cacheKey, {
        data: districts,
        timestamp: Date.now()
      });

      return districts;
    } catch (error) {
      console.error(`Error fetching districts for province ${provinceId}:`, error.message);
      return [];
    }
  }

  /**
   * Lấy danh sách amenities từ API với cache
   */
  async getAmenities() {
    const cacheKey = 'amenities';
    const cached = this.amenityCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
      return cached.data;
    }

    try {
      const response = await axios.get('http://localhost:5000/api/amenities/all', { timeout: 5000 });
      // console.log('Amenities API response:', response.data);
      
      // API trả về response.data.data.amenities
      let amenities = response.data.data?.amenities || response.data.data || response.data;
      
      // Đảm bảo amenities là array
      if (!Array.isArray(amenities)) {
        console.warn('Amenities API returned non-array:', typeof amenities, amenities);
        // Nếu amenities là object có property amenities
        if (amenities && amenities.amenities && Array.isArray(amenities.amenities)) {
          amenities = amenities.amenities;
        } else {
          amenities = [];
        }
      }
      
      // console.log(`Loaded ${amenities.length} amenities from API`);

      // Fallback: Tạo danh sách amenities cơ bản nếu API không có data
      if (amenities.length === 0) {
        // console.log('Using fallback amenities list');
        amenities = [
          { _id: '68c6bab2ab13f9d982ee9995', name: 'WiFi' },
          { _id: '68be84191b3b9b4fa53e7d57', name: 'Điều hòa' },
          { _id: '68b95b0e4bad16608dbefad8', name: 'Ban công' },
          { _id: '68be84191b3b9b4fa53e7d58', name: 'Tủ lạnh' },
          { _id: '68be84191b3b9b4fa53e7d59', name: 'Thang máy' },
          { _id: '68be84191b3b9b4fa53e7d60', name: 'Bảo vệ 24/7' }
        ];
      }

      this.amenityCache.set(cacheKey, {
        data: amenities,
        timestamp: Date.now()
      });

      return amenities;
    } catch (error) {
      console.error('Error fetching amenities:', error.message);
      // console.log('Using fallback amenities list due to error');
      
      // Fallback amenities nếu API lỗi
      const fallbackAmenities = [
        { _id: '68c6bab2ab13f9d982ee9995', name: 'WiFi' },
        { _id: '68be84191b3b9b4fa53e7d57', name: 'Điều hòa' },
        { _id: '68b95b0e4bad16608dbefad8', name: 'Ban công' },
        { _id: '68be84191b3b9b4fa53e7d58', name: 'Tủ lạnh' },
        { _id: '68be84191b3b9b4fa53e7d59', name: 'Thang máy' },
        { _id: '68be84191b3b9b4fa53e7d60', name: 'Bảo vệ 24/7' }
      ];
      
      return fallbackAmenities;
    }
  }

  /**
   * Tìm provinceId từ tên province
   */
  findProvinceId(provinces, provinceName) {
    if (!provinceName) return null;

    const normalizedName = provinceName.toLowerCase();
    const province = provinces.find(p => {
      const pName = p.name.toLowerCase();
      return pName.includes(normalizedName) ||
        normalizedName.includes(pName) ||
        (normalizedName.includes('hồ chí minh') && pName.includes('hồ chí minh')) ||
        (normalizedName.includes('tp.hcm') && pName.includes('hồ chí minh')) ||
        (normalizedName.includes('tphcm') && pName.includes('hồ chí minh'));
    });

    return province ? province.code.toString() : null;
  }

  /**
   * Tìm districtId từ tên district
   */
  findDistrictId(districts, districtName) {
    if (!districtName || !Array.isArray(districts)) return null;

    const normalizedName = districtName.toLowerCase().trim();
    
    const district = districts.find(d => {
      if (!d || !d.name) return false;
      
      const dName = d.name.toLowerCase();
      
      // Exact match hoặc chứa tên
      if (dName === normalizedName || dName.includes(normalizedName) || normalizedName.includes(dName)) {
        return true;
      }
      
      // Special mappings cho các tên district phổ biến
      const specialMappings = {
        'quận 1': ['quận 1', 'q1', 'q.1'],
        'quận 2': ['quận 2', 'q2', 'q.2'],
        'quận 3': ['quận 3', 'q3', 'q.3'],
        'quận 4': ['quận 4', 'q4', 'q.4'],
        'quận 5': ['quận 5', 'q5', 'q.5'],
        'quận 6': ['quận 6', 'q6', 'q.6'],
        'quận 7': ['quận 7', 'q7', 'q.7'],
        'quận 8': ['quận 8', 'q8', 'q.8'],
        'quận 9': ['quận 9', 'q9', 'q.9'],
        'quận 10': ['quận 10', 'q10', 'q.10'],
        'quận 11': ['quận 11', 'q11', 'q.11'],
        'quận 12': ['quận 12', 'q12', 'q.12'],
        'gò vấp': ['gò vấp', 'go vap', 'govap'],
        'tân bình': ['tân bình', 'tan binh', 'tanbinh'],
        'bình thạnh': ['bình thạnh', 'binh thanh', 'binhthanh'],
        'phú nhuận': ['phú nhuận', 'phu nhuan', 'phunhuan'],
        'thủ đức': ['thủ đức', 'thu duc', 'thuduc'],
        'bình tân': ['bình tân', 'binh tan', 'binhtan'],
        'bình chánh': ['bình chánh', 'binh chanh', 'binhchanh'],
        'củ chi': ['củ chi', 'cu chi', 'cuchi'],
        'hóc môn': ['hóc môn', 'hoc mon', 'hocmon'],
        'nhà bè': ['nhà bè', 'nha be', 'nhabe'],
      };
      
      // Kiểm tra special mappings
      for (const [standardName, variations] of Object.entries(specialMappings)) {
        if (dName.includes(standardName)) {
          return variations.some(variation => normalizedName.includes(variation));
        }
      }
      
      return false;
    });

    return district ? district.code.toString() : null;
  }

  /**
   * Tìm amenity IDs từ tên amenities
   */
  findAmenityIds(amenities, amenityNames) {
    if (!amenityNames || amenityNames.length === 0) return null;
    
    // Đảm bảo amenities là array
    if (!Array.isArray(amenities)) {
      console.warn('Amenities is not an array:', typeof amenities, amenities);
      return null;
    }

    const foundIds = [];

    amenityNames.forEach(name => {
      const normalizedName = name.toLowerCase().trim();
      const amenity = amenities.find(a => {
        if (!a || !a.name) return false;
        const aName = a.name.toLowerCase();
        return aName.includes(normalizedName) || normalizedName.includes(aName);
      });

      if (amenity && amenity._id) {
        foundIds.push(amenity._id);
      }
    });

    return foundIds.length > 0 ? foundIds.join(',') : null;
  }

  /**
   * Kiểm tra Ollama server có hoạt động không
   */
  async checkHealth() {
    if (!this.enabled) return { available: false, reason: 'MCP disabled' };

    try {
      const response = await axios.get(`${this.ollamaURL}/api/tags`, { timeout: 5000 });

      // Kiểm tra cả 2 models có available không
      const models = response.data.models || [];
      const chatModelExists = models.some(model => model.name.includes('llama3.2:latest'));
      const embeddingModelExists = models.some(model => model.name.includes('nomic-embed-text:latest'));

      if (!chatModelExists) {
        return { available: false, reason: 'llama3.2:latest model not found for chat' };
      }

      if (!embeddingModelExists) {
        return { available: false, reason: 'nomic-embed-text:latest model not found for embeddings' };
      }

      return { available: true, status: response.status };
    } catch (error) {
      // console.log('Ollama server not available:', error.message);
      return { available: false, reason: error.message };
    }
  }

  /**
   * Xử lý tin nhắn bằng Ollama model với Vector Database caching
   */
  async processMessage(userMessage, vectorCache = null, userMetadata = null) {
    try {
      // console.log('Processing message via Ollama model with vector caching...');
      const startTime = Date.now();

      // Bước 1: Sử dụng cache từ middleware (đã được check trong middleware)
      let cachedResponse = vectorCache;

      // console.log('cachedResponse', cachedResponse);
      
      if (cachedResponse) {
        // HANDLE MERGED PARAMS RESULT
        if (cachedResponse.source === 'merged_params' && cachedResponse.needsPropertySearch) {
          // console.log('Processing merged parameters for direct property search');
          
          return {
            success: true,
            data: {
              isRoomSearchQuery: true,
              searchParams: cachedResponse.mergedSearchParams,
              processingTime: `${Date.now() - startTime}ms (merged-params)`,
              source: 'merged-params',
              similarity: cachedResponse.confidence,
              mergedFrom: {
                cached: cachedResponse.originalCachedParams,
                user: cachedResponse.userParams
              }
            }
          };
        }

        // Parse cached response data
        let responseData;
        try {
          responseData = typeof cachedResponse.response === 'string' 
            ? JSON.parse(cachedResponse.response) 
            : cachedResponse.response;
        } catch (e) {
          responseData = cachedResponse.response;
        }
        
        // Ưu tiên lấy searchParams từ metadata nếu có, nếu không thì từ response
        const searchParams = cachedResponse.metadata?.searchParams || responseData.searchParams;
        // Nếu là room có searchParams, return searchParams để controller xử lý
        if (searchParams) {
          return {
            success: true,
            data: {
              isRoomSearchQuery: true,
              searchParams: searchParams,
              message: responseData.message || 'Đã tìm thấy kết quả phù hợp.',
              processingTime: `${Date.now() - startTime}ms (cached)`,
              source: 'vector-cache',
              similarity: cachedResponse.score
            }
          };
        } else {
          // Non-room queries hoặc không có searchParams, return trực tiếp
          return {
            success: true,
            data: {
              ...responseData,
              processingTime: `${Date.now() - startTime}ms (cached)`,
              source: 'vector-cache',
              similarity: cachedResponse.score
            }
          };
        }
      }

      // Bước 2: Kiểm tra nhanh trước khi gọi Ollama để tránh xử lý các câu hỏi vô nghĩa
      const quickCheck = this.quickRoomSearchCheck(userMessage);
      if (!quickCheck) {
        const nonRoomResponse = {
          success: true,
          data: {
            isRoomSearchQuery: false,
            message: "Em xin lỗi, nhưng em chỉ có thể hỗ trợ các câu hỏi liên quan đến tìm kiếm phòng trọ, căn hộ và các dịch vụ bất động sản. Nếu Anh/Chị có nhu cầu tìm phòng trọ hoặc căn hộ, em rất sẵn lòng hỗ trợ!",
            processingTime: `${Date.now() - startTime}ms`,
            source: 'quick-check'
          }
        };
        
        // Lưu vào cache để tránh xử lý lại
        await vectorService.saveQnA(
          userMessage, 
          JSON.stringify(nonRoomResponse.data),
          { type: 'non-room-query', quickCheck: true }
        );
        
        return nonRoomResponse;
      }

      // Bước 3: Parallel loading provinces và amenities để tối ưu thời gian
      const [provinces, amenities] = await Promise.all([
        this.getProvinces(),
        this.getAmenities()
      ]);

      // Bước 4: Phân tích tin nhắn - sử dụng userMetadata nếu có, nếu không thì gọi Ollama
      let extractedData;
      if (userMetadata) {
        extractedData = userMetadata;
      } else {
        // console.log('Analyzing with Ollama (no userMetadata)...');
        extractedData = await this.analyzeWithOllama(userMessage);
      }
      // console.log('Extracted data:', extractedData);

      const processingTime = Date.now() - startTime;
      // Bước 5: Xử lý kết quả và lưu vào cache
      let finalResponse;
      
      // Kiểm tra xem có phải câu hỏi về tìm phòng trọ không
      if (!extractedData.isRoomSearchQuery) {
        finalResponse = {
          success: true,
          data: {
            isRoomSearchQuery: false,
            message: "Em xin lỗi, nhưng em chỉ có thể hỗ trợ các câu hỏi liên quan đến tìm kiếm phòng trọ, căn hộ và các dịch vụ bất động sản. Nếu Anh/Chị có nhu cầu tìm phòng trọ hoặc căn hộ, em rất sẵn lòng hỗ trợ!",
            processingTime: `${processingTime}ms`,
            source: 'ollama'
          }
        };
        
        // Lưu vào cache
        await vectorService.saveQnA(
          userMessage, 
          JSON.stringify(finalResponse.data),
          { 
            type: 'non-room-query', 
            ollama: true,
            extractedData: extractedData 
          }
        );
      } else {
        // Xử lý room search queries
        let searchParams;
        
        if (extractedData.searchParams) {
          // Đã được enhanced từ middleware (rule-based)
       
          searchParams = extractedData.searchParams;
        } else {
          // Raw data từ Ollama, cần enhance
        
          searchParams = await this.enhanceWithRealIds(extractedData, provinces, amenities);
        }
        
       

        finalResponse = {
          success: true,
          data: {
            isRoomSearchQuery: true,
            searchParams: searchParams,
            processingTime: `${processingTime}ms`,
            source: extractedData.extractionMethod === 'rule-based' ? 'rule-based' : 'ollama',
            extractionMethod: extractedData.extractionMethod
          }
        };
        
      }

      return finalResponse;

    } catch (error) {
      console.error('Ollama processing error:', error);
      throw error;
    }
  }

  /**
   * Phân tích tin nhắn bằng Ollama model
   */
  async analyzeWithOllama(userMessage) {
    try {
      // Check Ollama server health first
      const health = await this.checkHealth();
      if (!health.available) {
        console.warn('Ollama server not available:', health.reason);
        return this.basicKeywordExtraction(userMessage);
      }
      const prompt = `Phân tích tin nhắn và xác định xem có liên quan đến tìm phòng trọ không:
Tin nhắn: "${userMessage}"
JSON format bắt buộc:
{ 
"isRoomSearchQuery": true|false,
"category": "phong_tro|can_ho|nha_nguyen_can|chung_cu_mini|homestay|null", 
 "provinceName": "tên_tỉnh_thành|null",
 "districtName": "tên_quận_huyện|null", 
 "amenityNames": ["tên_tiện_ích1", "tên_tiện_ích2"] hoặc null, 
 "minPrice": "số_tiền_VND|null", 
 "maxPrice": "số_tiền_VND|null", 
 "minArea": "diện_tích_m2|null", 
 "maxArea": "diện_tích_m2|null" 
 }
Quy tắc trích xuất:
IS_ROOM_SEARCH_QUERY:
- Nếu tin nhắn liên quan đến tìm kiếm, thuê phòng trọ, căn hộ, nhà ở thì gán true
- Nếu tin nhắn hỏi về AI model, training data, công nghệ, thời tiết, tin tức, hoặc chủ đề không liên quan đến bất động sản thì gán false
- Ví dụ: "bạn được train từ model nào" → false, "tìm phòng trọ gần ĐH Công Nghiệp" → true

CATEGORY:
- "phòng trọ" gán "phong_tro"
- "căn hộ" gán "can_ho"
- "nhà nguyên căn" gán "nha_nguyen_can"
- "chung cư mini" gán "chung_cu_mini"
- "homestay" gán "homestay"
- Nếu là loại khác gán ghi đúng tên loại đó.
- Nếu không có thông tin gán null.
PROVINCE:
- "Thành phố Hồ Chí Minh", "TP.HCM", "Hồ Chí Minh" gán "Thành phố Hồ Chí Minh"
- "Đà Nẵng" gán "Thành phố Đà Nẵng"
- Nếu là tỉnh/thành khác gán giữ nguyên tên.
- Nếu không có thông tin gán null.
DISTRICT:
- "Quận 1", "Q1", "Q.1" gán "Quận 1"
- "Gò Vấp", "Go Vap" gán "Quận Gò Vấp"
- "Tân Bình" gán "Quận Tân Bình"
- "Bình Thạnh" gán "Quận Bình Thạnh"
- "Thủ Đức" gán "Thành phố Thủ Đức"
- Nếu là quận/huyện khác gán giữ nguyên tên đầy đủ.
- Nếu không có thông tin gán null.
AMENITIES:
- Chỉ ghi nhận nếu nằm trong danh sách ["wifi", "máy lạnh", "ban công", "điều hòa", "tủ lạnh",  "thang máy", "bãi đỗ xe", "nhà bếp", "tủ quần áo", "máy giặt", "tivi"].
- Nếu có tiện ích khác gán ghi "tiện ích khác".
- Nếu không có thông tin gán null.
PRICE:
- "dưới 3 triệu" gán "minPrice": 2000000, "maxPrice": 3000000
- Các khoảng giá khác (vd: "5-7 triệu") gán minPrice = 5000000, maxPrice = 7000000
- Luôn đảm bảo minPrice < maxPrice
- Nếu không có thông tin gán null.
AREA:
- Nếu có diện tích cụ thể (vd: "22m2") gán "minArea": 20, "maxArea": 25 (±2–3m² so với giá trị gốc).
- Luôn đảm bảo minArea luôn < maxArea
- Nếu diện tích khác → tính tương tự.
- Nếu không có thông tin gán null.
Trả về duy nhất JSON hợp lệ, không thêm bất kỳ chữ nào khác, không giải thích.`;
      const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'llama3.2:latest', // Sử dụng llama3.2 cho text generation
        prompt: prompt,
        stream: false,
        format: "json",
        options: {
          temperature: 0.0, // Giảm xuống 0 để có output deterministic
          num_ctx: 2048, // Tăng context để xử lý tốt hơn
          top_p: 0.5,
          num_predict: 400, // Tăng lên để đảm bảo JSON hoàn chỉnh
          // Bỏ stop để không cắt JSON giữa chừng
        }
      }, {
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.data || !response.data.response) {
        throw new Error('Invalid response from Ollama');
      }

      // Parse JSON response từ Ollama
      const ollamaResponse = response.data.response.trim();

      // Parse JSON từ response
      let parsedCriteria;
      try {
        parsedCriteria = JSON.parse(ollamaResponse);
   
      } catch (parseError) {
        console.error('JSON parse error:', parseError.message);
     
        
        // Thử extract JSON nếu có text bao quanh
        let jsonMatch = ollamaResponse.match(/\{[\s\S]*?\}/);
        if (!jsonMatch) {
          // Nếu không tìm thấy JSON hoàn chỉnh, thử tìm JSON bị cắt và sửa
          const incompleteMatch = ollamaResponse.match(/\{[\s\S]*/);
          if (incompleteMatch) {
            let jsonStr = incompleteMatch[0];
            // Thêm closing brackets nếu thiếu
            const openBrackets = (jsonStr.match(/\{/g) || []).length;
            const closeBrackets = (jsonStr.match(/\}/g) || []).length;
            const missingBrackets = openBrackets - closeBrackets;
            
            if (missingBrackets > 0) {
              jsonStr += '}'.repeat(missingBrackets);
              jsonMatch = [jsonStr];
            }
          }
        }
        
        if (jsonMatch) {
          try {
            parsedCriteria = JSON.parse(jsonMatch[0]);
          } catch (secondParseError) {
            console.error('Second JSON parse failed:', secondParseError.message);
            parsedCriteria = this.basicKeywordExtraction(userMessage);
          }
        } else {
          parsedCriteria = this.basicKeywordExtraction(userMessage);
        }
      }

      // Return parsed extracted data
      return parsedCriteria;

    } catch (error) {
      console.error('Ollama analysis error:', error.message);
      console.error('Error stack:', error.stack);

      // Log more details if it's a network error
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      } else if (error.request) {
        console.error('No response received:', error.request);
      }

      // Fallback: basic keyword extraction
      return this.basicKeywordExtraction(userMessage);
    }
  }

  /**
   * Enhance extracted data với real IDs từ API
   */
  async enhanceWithRealIds(extractedData, provinces, amenities) {
    const searchParams = {
      provinceId: null,
      districtId: null,
      category: extractedData.category || null,
      minPrice: extractedData.minPrice ? extractedData.minPrice.toString() : null,
      maxPrice: extractedData.maxPrice ? extractedData.maxPrice.toString() : null,
      minArea: extractedData.minArea ? extractedData.minArea.toString() : null,
      maxArea: extractedData.maxArea ? extractedData.maxArea.toString() : null,
      amenities: null,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      page: '1',
      limit: '8'
    };

    // Map province name to ID
    if (extractedData.provinceName) {
      searchParams.provinceId = this.findProvinceId(provinces, extractedData.provinceName);
    }

    // Map district name to ID (cần provinceId trước)
    if (extractedData.districtName && searchParams.provinceId) {
      try {
        const districts = await this.getDistricts(searchParams.provinceId);
        searchParams.districtId = this.findDistrictId(districts, extractedData.districtName);
      } catch (error) {
        console.error('Error getting districts:', error.message);
      }
    }

    // Map amenity names to IDs
    if (extractedData.amenityNames && Array.isArray(extractedData.amenityNames)) {
      searchParams.amenities = this.findAmenityIds(amenities, extractedData.amenityNames);
    }

    // Auto-add min price if only max price provided
    if (extractedData.maxPrice && !extractedData.minPrice) {
      const maxPrice = parseInt(extractedData.maxPrice);
      searchParams.minPrice = Math.max(500000, maxPrice * 0.6).toString(); // 60% of max price
    }

    // Auto-adjust area range if specific area mentioned
    if (extractedData.minArea && !extractedData.maxArea) {
      const minArea = parseInt(extractedData.minArea);
      searchParams.maxArea = (minArea + 5).toString(); // +5m2
    }

    return searchParams;
  }

  /**
   * Kiểm tra nhanh xem có phải câu hỏi về phòng trọ không
   */
  quickRoomSearchCheck(message) {
    if (!message) {
      return false;
    }

    const lowerMessage = message.toLowerCase().trim();
    // Nếu tin nhắn quá ngắn
    if (lowerMessage.length < 2) {
      return false;
    }

    // Kiểm tra ký tự lặp lại quá nhiều (như "aaaaaaa", "hhhhhh")
    const repeatedChars = lowerMessage.match(/(.)\1{4,}/g);
    if (repeatedChars) {
      return false;
    }

    // Kiểm tra tin nhắn chỉ chứa ký tự đặc biệt hoặc số
    if (/^[^a-zA-ZÀ-ỹ]*$/.test(lowerMessage)) {
      return false;
    }

    // Kiểm tra ký tự vô nghĩa (chuỗi dài không có nghĩa)
    const meaninglessPattern = /^[a-z]{8,}$|^\d{5,}$|^[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{5,}$/;
    if (meaninglessPattern.test(lowerMessage)) {
      return false;
    }

    // Từ khóa KHÔNG liên quan - kiểm tra trước (sử dụng word boundaries để tránh false positive)
    const nonRoomKeywords = [
      'model', 'train', 'ai', 'artificial intelligence', 'machine learning', 
      'thời tiết', 'weather', 'tin tức', 'news', 'study', 'lập trình', 'programming', 'code', 'coding',
      'github', 'api', 'database', 'server', 'frontend', 'backend',
      'react', 'nodejs', 'python', 'javascript', 'html', 'css'
    ];
    
    // Riêng "công nghệ" và "technology" cần kiểm tra chính xác để không nhầm với "công nghiệp"
    const hasSpecificTechKeywords = /\bcông nghệ\b|\btechnology\b/.test(lowerMessage);

    // Kiểm tra từ khóa non-room với word boundaries để tránh false positive
    const hasNonRoomKeywords = nonRoomKeywords.some(keyword => {
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(lowerMessage);
    }) || hasSpecificTechKeywords;
    
    if (hasNonRoomKeywords) {
      return false;
    }

    // Từ khóa liên quan đến phòng trọ/bất động sản
    const roomKeywords = [
      'phòng trọ', 'căn hộ', 'nhà thuê', 'thuê phòng', 'tìm phòng', 'homestay', 
      'chung cư', 'nhà nguyên căn', 'studio', 'mini house', 'thuê nhà',
      'phòng', 'trọ', 'thuê', 'tìm', 'cần', 'giá', 'triệu', 'gần', 'quận', 'huyện',
      'tỉnh', 'thành phố', 'tp', 'đại học', 'university', 'm2', 'mét vuông',
      'wifi', 'điều hòa', 'máy lạnh', 'ban công', 'tủ lạnh', 'thang máy',
      'gửi xe', 'parking', 'bảo vệ', 'security', 'room', 'apartment', 'house'
    ];

    // Ưu tiên các từ khóa mạnh về phòng trọ
    const strongRoomKeywords = ['phòng trọ', 'căn hộ', 'thuê phòng', 'tìm phòng', 'chung cư', 'homestay'];
    const hasStrongRoomKeywords = strongRoomKeywords.some(keyword => lowerMessage.includes(keyword));
    
    // Nếu có từ khóa mạnh thì chắc chắn là room search
    if (hasStrongRoomKeywords) {
      return true;
    }

    const hasRoomKeywords = roomKeywords.some(keyword => lowerMessage.includes(keyword));
    const result = hasRoomKeywords;
    return result;
  }

  /**
   * Fallback basic keyword extraction
   */
  basicKeywordExtraction(message) {
    const lowerMessage = message.toLowerCase();

    const criteria = {
      isRoomSearchQuery: false,
      category: null,
      provinceName: null,
      districtName: null,
      amenityNames: [],
      minPrice: null,
      maxPrice: null,
      minArea: null,
      maxArea: null
    };

    // Sử dụng cùng logic với quickRoomSearchCheck
    criteria.isRoomSearchQuery = this.quickRoomSearchCheck(message);

    // Category detection
    if (lowerMessage.includes('phòng trọ')) {
      criteria.category = 'phong_tro';
      criteria.minArea = 20;
      criteria.maxArea = 30;
    } else if (lowerMessage.includes('căn hộ')) {
      criteria.category = 'can_ho';
    } else if (lowerMessage.includes('nhà nguyên căn')) {
      criteria.category = 'nha_nguyen_can';
    } else if (lowerMessage.includes('chung cư mini')) {
      criteria.category = 'chung_cu_mini';
    } else if (lowerMessage.includes('homestay')) {
      criteria.category = 'homestay';
    }

    // Price extraction
    const priceMatch = lowerMessage.match(/dưới\s*(\d+(?:\.\d+)?)\s*triệu/);
    if (priceMatch) {
      criteria.maxPrice = parseFloat(priceMatch[1]) * 1000000;
    }

    // Location mapping
    if (lowerMessage.includes('đh công nghiệp') || lowerMessage.includes('gò vấp')) {
      criteria.provinceName = 'Thành phố Hồ Chí Minh';
    } else if (lowerMessage.includes('tp.hcm') || lowerMessage.includes('hồ chí minh')) {
      criteria.provinceName = 'Thành phố Hồ Chí Minh';
    } else if (lowerMessage.includes('hà nội')) {
      criteria.provinceName = 'Thành phố Hà Nội';
    } else if (lowerMessage.includes('đà nẵng')) {
      criteria.provinceName = 'Thành phố Đà Nẵng';
    }

    // District mapping for HCM
    if (criteria.provinceName === 'Thành phố Hồ Chí Minh') {
      if (lowerMessage.includes('gò vấp') || lowerMessage.includes('đh công nghiệp')) {
        criteria.districtName = 'Quận Gò Vấp';
      } else if (lowerMessage.includes('quận 1') || lowerMessage.includes('q1') || lowerMessage.includes('q.1')) {
        criteria.districtName = 'Quận 1';
      } else if (lowerMessage.includes('quận 2') || lowerMessage.includes('q2') || lowerMessage.includes('q.2')) {
        criteria.districtName = 'Quận 2';
      } else if (lowerMessage.includes('quận 3') || lowerMessage.includes('q3') || lowerMessage.includes('q.3')) {
        criteria.districtName = 'Quận 3';
      } else if (lowerMessage.includes('quận 4') || lowerMessage.includes('q4') || lowerMessage.includes('q.4')) {
        criteria.districtName = 'Quận 4';
      } else if (lowerMessage.includes('quận 5') || lowerMessage.includes('q5') || lowerMessage.includes('q.5')) {
        criteria.districtName = 'Quận 5';
      } else if (lowerMessage.includes('quận 6') || lowerMessage.includes('q6') || lowerMessage.includes('q.6')) {
        criteria.districtName = 'Quận 6';
      } else if (lowerMessage.includes('quận 7') || lowerMessage.includes('q7') || lowerMessage.includes('q.7')) {
        criteria.districtName = 'Quận 7';
      } else if (lowerMessage.includes('quận 8') || lowerMessage.includes('q8') || lowerMessage.includes('q.8')) {
        criteria.districtName = 'Quận 8';
      } else if (lowerMessage.includes('quận 9') || lowerMessage.includes('q9') || lowerMessage.includes('q.9')) {
        criteria.districtName = 'Quận 9';
      } else if (lowerMessage.includes('quận 10') || lowerMessage.includes('q10') || lowerMessage.includes('q.10')) {
        criteria.districtName = 'Quận 10';
      } else if (lowerMessage.includes('quận 11') || lowerMessage.includes('q11') || lowerMessage.includes('q.11')) {
        criteria.districtName = 'Quận 11';
      } else if (lowerMessage.includes('quận 12') || lowerMessage.includes('q12') || lowerMessage.includes('q.12')) {
        criteria.districtName = 'Quận 12';
      } else if (lowerMessage.includes('tân bình')) {
        criteria.districtName = 'Quận Tân Bình';
      } else if (lowerMessage.includes('bình thạnh')) {
        criteria.districtName = 'Quận Bình Thạnh';
      } else if (lowerMessage.includes('phú nhuận')) {
        criteria.districtName = 'Quận Phú Nhuận';
      } else if (lowerMessage.includes('thủ đức')) {
        criteria.districtName = 'Thành phố Thủ Đức';
      }
    }

    // Amenities mapping
    if (lowerMessage.includes('wifi')) criteria.amenityNames.push('WiFi');
    if (lowerMessage.includes('điều hòa')) criteria.amenityNames.push('Điều hòa');
    if (lowerMessage.includes('ban công')) criteria.amenityNames.push('Ban công');
    if (lowerMessage.includes('tủ lạnh')) criteria.amenityNames.push('Tủ lạnh');
    if (lowerMessage.includes('thang máy')) criteria.amenityNames.push('Thang máy');
    if (lowerMessage.includes('bảo vệ')) criteria.amenityNames.push('Bảo vệ 24/7');

    return criteria;
  }

}

export default new OllamaService();

