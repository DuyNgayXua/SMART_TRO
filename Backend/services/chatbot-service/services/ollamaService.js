import axios from 'axios';
import vectorService from './vectorService.js';

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
      
      console.log(`Loaded ${provinces.length} provinces from API`);

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
      
      console.log(`Loaded ${districts.length} districts for province ${provinceId} from API`);

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
      console.log('Amenities API response:', response.data);
      
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
      
      console.log(`Loaded ${amenities.length} amenities from API`);

      // Fallback: Tạo danh sách amenities cơ bản nếu API không có data
      if (amenities.length === 0) {
        console.log('Using fallback amenities list');
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
      console.log('Using fallback amenities list due to error');
      
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
      console.log('Ollama server not available:', error.message);
      return { available: false, reason: error.message };
    }
  }

  /**
   * Xử lý tin nhắn bằng Ollama model với Vector Database caching
   */
  async processMessage(userMessage, vectorCache = null) {
    try {
      console.log('Processing message via Ollama model with vector caching...');
      const startTime = Date.now();

      // Bước 1: Sử dụng cache info từ middleware nếu có
      let cachedResponse = null;
      if (vectorCache && vectorCache.found) {
        cachedResponse = vectorCache.result;
        console.log(`Using cache from middleware (similarity: ${vectorCache.similarity})`);
      }

      if (cachedResponse) {
        const similarity = cachedResponse.confidence || cachedResponse.score || 0;
        console.log(`Found cached response with similarity: ${similarity.toFixed(4)}`);
        
        // Kiểm tra similarity threshold nghiêm ngặt hơn
        if (similarity < 0.93) {
          console.log(`Similarity ${similarity.toFixed(4)} too low, processing as new query`);
          // Continue với fresh processing
        } else {
          console.log('High similarity match, using cached response...');
          
          // Parse cached response data
          let cachedData;
          try {
            cachedData = typeof cachedResponse.response === 'string' 
              ? JSON.parse(cachedResponse.response) 
              : cachedResponse.response;
          } catch (e) {
            cachedData = cachedResponse.response;
          }

          // Kiểm tra cache data structure
          if (cachedData && cachedData.searchParams) {
          console.log('Found cache with searchParams, searching for fresh properties...');
          console.log('Cached searchParams:', cachedData.searchParams);
          
          // Luôn gọi property search API với params từ cache để có kết quả mới nhất
          const propertyResults = await this.searchPropertiesWithParams(cachedData.searchParams);
          console.log(`propertyResults:`, propertyResults);

          return {
            success: true,
            data: {
              isRoomSearchQuery: true,
              searchParams: cachedData.searchParams,
              properties: propertyResults,
              totalFound: propertyResults.length,
              processingTime: `${Date.now() - startTime}ms (cached params + fresh search)`,
              source: 'vector-cache-enhanced',
              similarity: cachedResponse.confidence || cachedResponse.score,
              cacheMetadata: {
                originalQuestion: cachedResponse.question,
                usageCount: cachedResponse.usageCount || 1,
                cacheSource: cachedResponse.source
              }
            }
          };
        } else if (cachedData && cachedData.isRoomSearchQuery === false) {
          // Cache cho non-room queries - trả về luôn
          console.log('Found cached non-room query response');
          return {
            success: true,
            data: {
              ...cachedData,
              processingTime: `${Date.now() - startTime}ms (cached)`,
              source: 'vector-cache',
              similarity: cachedResponse.confidence || cachedResponse.score
            }
          };
        } else {
          // Cache data không có searchParams - có thể là format cũ
          console.log('Cache found but no searchParams, falling back to fresh processing');
          // Continue để xử lý như câu hỏi mới
        }
        }
      }

      // Bước 2: Kiểm tra nhanh trước khi gọi Ollama để tránh xử lý các câu hỏi vô nghĩa
      const quickCheck = this.quickRoomSearchCheck(userMessage);
      if (!quickCheck) {
        console.log('Quick check: Non-room search query detected');
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

      // Bước 4: Phân tích tin nhắn bằng Ollama
      const extractedData = await this.analyzeWithOllama(userMessage);
      console.log('Extracted data from Ollama:', extractedData);

      const processingTime = Date.now() - startTime;
      console.log(`Ollama processing completed in ${processingTime}ms`);

      // Bước 5: Xử lý kết quả và lưu vào cache
      let finalResponse;
      
      // Kiểm tra xem có phải câu hỏi về tìm phòng trọ không
      if (!extractedData.isRoomSearchQuery) {
        console.log('Non-room search query detected, returning polite response');
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
        // Enhance data với real IDs cho room search queries
        const searchParams = await this.enhanceWithRealIds(extractedData, provinces, amenities);
        console.log('Final search params:', searchParams);

        // Tìm kiếm properties với search params mới
        console.log('Searching properties for new query...');
        const propertyResults = await this.searchPropertiesWithParams(searchParams);
        
        finalResponse = {
          success: true,
          data: {
            isRoomSearchQuery: true,
            searchParams: searchParams,
            properties: propertyResults,
            processingTime: `${processingTime}ms`,
            source: 'ollama-fresh',
            extractedData: extractedData // Include để debug
          }
        };
        
        // Lưu vào cache với metadata chi tiết (bao gồm cả property results)
        await vectorService.saveQnA(
          userMessage, 
          JSON.stringify(finalResponse.data),
          { 
            type: 'room-search-query',
            extractedData: extractedData,
            searchParams: searchParams,
            propertyCount: propertyResults.length,
            processingTimeMs: processingTime
          }
        );
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

      console.log('Calling Ollama API...');

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
        console.log('Parsed criteria:', parsedCriteria);
      } catch (parseError) {
        console.error('JSON parse error:', parseError.message);
        console.log('Trying to extract and fix JSON from response...');
        
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
              console.log('Fixed incomplete JSON:', jsonStr);
              jsonMatch = [jsonStr];
            }
          }
        }
        
        if (jsonMatch) {
          try {
            parsedCriteria = JSON.parse(jsonMatch[0]);
            console.log('Extracted and parsed criteria:', parsedCriteria);
          } catch (secondParseError) {
            console.error('Second JSON parse failed:', secondParseError.message);
            console.log('Falling back to basic extraction...');
            parsedCriteria = this.basicKeywordExtraction(userMessage);
          }
        } else {
          console.log('No JSON structure found, using basic extraction...');
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
      console.log('Falling back to basic keyword extraction...');
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
      limit: '8' // Request 8 properties từ API
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
        console.log(`Found districtId: ${searchParams.districtId} for district: ${extractedData.districtName}`);
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
    console.log(`Quick room search check for: "${message}"`);
    
    if (!message) {
      console.log('Empty message - returning false');
      return false;
    }

    const lowerMessage = message.toLowerCase().trim();
    console.log(`Normalized message: "${lowerMessage}"`);
    
    // Nếu tin nhắn quá ngắn
    if (lowerMessage.length < 2) {
      console.log('Message too short - returning false');
      return false;
    }

    // Kiểm tra ký tự lặp lại quá nhiều (như "aaaaaaa", "hhhhhh")
    const repeatedChars = lowerMessage.match(/(.)\1{4,}/g);
    if (repeatedChars) {
      console.log('Repeated characters detected:', repeatedChars, '- returning false');
      return false;
    }

    // Kiểm tra tin nhắn chỉ chứa ký tự đặc biệt hoặc số
    if (/^[^a-zA-ZÀ-ỹ]*$/.test(lowerMessage)) {
      console.log('Only special characters/numbers - returning false');
      return false;
    }

    // Kiểm tra ký tự vô nghĩa (chuỗi dài không có nghĩa)
    const meaninglessPattern = /^[a-z]{8,}$|^\d{5,}$|^[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{5,}$/;
    if (meaninglessPattern.test(lowerMessage)) {
      console.log('Meaningless pattern detected - returning false');
      return false;
    }

    // Từ khóa KHÔNG liên quan - kiểm tra trước
    const nonRoomKeywords = [
      'model', 'train', 'ai', 'artificial intelligence', 'machine learning', 
      'thời tiết', 'weather', 'tin tức', 'news', 'học tập', 'study', 'công nghệ', 'technology', 
      'lập trình', 'programming', 'code', 'coding',
      'github', 'api', 'database', 'server', 'frontend', 'backend',
      'react', 'nodejs', 'python', 'javascript', 'html', 'css',
      'bạn là ai', 'bạn tên gì', 'who are you', 'what is your name',
      'xin chào', 'hello', 'hi', 'chào bạn', 'greetings'
    ];

    const hasNonRoomKeywords = nonRoomKeywords.some(keyword => lowerMessage.includes(keyword));
    if (hasNonRoomKeywords) {
      console.log('Non-room keywords found - returning false');
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

    const hasRoomKeywords = roomKeywords.some(keyword => lowerMessage.includes(keyword));
    
    console.log(`Has room keywords: ${hasRoomKeywords}`);
    console.log(`Has non-room keywords: ${hasNonRoomKeywords}`);
    
    const result = hasRoomKeywords;
    console.log(`Quick check result: ${result}`);
    
    return result;
  }

  /**
   * Tìm kiếm properties với search params từ cache
   */
  async searchPropertiesWithParams(searchParams) {
    try {
      console.log('Searching properties with params:', searchParams);
      
      // Construct query string từ search params
      const queryParams = new URLSearchParams();
      
      Object.keys(searchParams).forEach(key => {
        if (searchParams[key] !== null && searchParams[key] !== undefined && searchParams[key] !== '') {
          queryParams.append(key, searchParams[key]);
        }
      });
      
      const queryString = queryParams.toString();
      
      const searchUrl = `http://localhost:5000/api/search-properties/properties/?${queryString}`;
      
      console.log('🔍 Property search URL:', searchUrl);
      
      const response = await axios.get(searchUrl, { 
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📊 Full API Response:', JSON.stringify(response.data, null, 2));
      
      console.log('📊 API Response analysis:', {
        success: response.data?.success,
        message: response.data?.message,
        dataExists: !!response.data?.data,
        propertiesExists: !!response.data?.data?.properties,
        propertiesType: typeof response.data?.data?.properties,
        isPropertiesArray: Array.isArray(response.data?.data?.properties),
        propertiesLength: response.data?.data?.properties?.length || 0,
        totalFound: response.data?.data?.pagination?.total,
        searchCriteria: response.data?.data?.searchCriteria
      });
      
      if (response.data && response.data.success) {
        // API response structure: data.properties should be array
        let properties = response.data.data?.properties;
        
        // Debug raw properties
        console.log('🔍 Raw properties:', {
          type: typeof properties,
          isArray: Array.isArray(properties),
          length: properties?.length,
          keys: properties ? Object.keys(properties).slice(0, 5) : 'none'
        });
        
        // Convert object to array nếu cần
        if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
          // Nếu properties là object, convert sang array
          properties = Object.values(properties);
          console.log('🔄 Converted object to array:', properties.length);
        }
        
        // Fallback nếu vẫn không có properties
        if (!Array.isArray(properties) || properties.length === 0) {
          console.log('⚠️ Properties not found in expected location, checking alternatives...');
          
          // Thử các locations khác có thể
          const alternatives = [
            response.data.data,
            response.data.properties,
            response.data
          ];
          
          for (const alt of alternatives) {
            if (Array.isArray(alt) && alt.length > 0) {
              properties = alt;
              console.log('✅ Found properties in alternative location:', properties.length);
              break;
            }
          }
        }
        
        // Final validation
        if (!Array.isArray(properties)) {
          console.error('❌ Could not extract properties array from response');
          return [];
        }
        
        // Kiểm tra mismatch giữa totalFound và properties.length
        const totalFound = response.data?.data?.pagination?.total || 0;
        if (totalFound > 0 && properties.length === 0) {
          console.warn(`⚠️ Data mismatch: API says ${totalFound} results found but properties array is empty!`);
          console.warn('This could be a pagination issue or search criteria filtering problem');
        }
        
        console.log(`✅ Successfully extracted ${properties.length} properties (expected: ${totalFound})`);
        return properties.slice(0, 8);
      } else {
        console.log('❌ API call unsuccessful:', response.data?.message || 'Unknown error');
        return [];
      }
      
    } catch (error) {
      console.error('Error searching properties:', error.message);
      
      // Log more details for debugging
      if (error.response) {
        console.error('Property API error response:', error.response.status, error.response.data);
      }
      
      return [];
    }
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
