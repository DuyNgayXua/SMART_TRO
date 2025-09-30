import vectorService from '../services/vectorService.js';
import ollamaService from '../services/ollamaService.js';
/**
 * Middleware để tự động lưu successful chatbot interactions
 */
export const autoSaveVector = async (req, res, next) => {
  const originalSend = res.send;

  res.send = function (data) {
    // Chỉ auto-save nếu là successful chatbot response
    if (req.path === '/message' && req.method === 'POST') {
      try {
        const responseData = typeof data === 'string' ? JSON.parse(data) : data;

        if (responseData.success && req.body.message) {
          console.log('responseData:', responseData);
          // Async save - không block response
          setImmediate(async () => {
            try {
              // Validate source value
              const validSources = ['ollama', 'quick-check', 'manual', 'seed', 'vector-cache'];
              const originalSource = responseData.data?.source;
              const validatedSource = validSources.includes(originalSource) ? originalSource : 'ollama';
              // Kiểm tra xem có nên lưu cache không
              const shouldSaveCache = shouldSaveToCache(responseData.data);

              if (shouldSaveCache.save) {
                const metadata = {
                  source: validatedSource,
                  priority: 'normal',
                  tags: ['auto-saved', 'chatbot-interaction', ...shouldSaveCache.tags],
                  processingTimeMs: responseData.data?.processingTime ?
                    parseInt(responseData.data.processingTime.replace(/[^\d]/g, '')) : null,
                  extractedData: responseData.data?.extractedData,
                  searchParams: responseData.data?.searchParams,
                  userAgent: req.get('User-Agent'),
                  ip: req.ip,
                  saveReason: shouldSaveCache.reason
                };

                await vectorService.saveQnA(
                  req.body.message,
                  JSON.stringify(responseData.data),
                  metadata
                );

                console.log(`Auto-saved: "${req.body.message.substring(0, 50)}..." (${shouldSaveCache.reason})`);
              } else {
                console.log(`Skip save: "${req.body.message.substring(0, 50)}..." (${shouldSaveCache.reason})`);
              }

            } catch (error) {
              console.error('Auto-save error:', error.message);
              console.error('Full error:', error);
            }
          });
        }
      } catch (error) {
        console.error('Auto-save parsing error:', error.message);
      }
    }

    // Call original send
    originalSend.call(this, data);
  };

  next();
};

/**
 * Middleware để check cache trước khi process message
 */
export const checkVectorCache = async (req, res, next) => {
  // Chỉ check cache cho chatbot messages
  if (req.path === '/message' && req.method === 'POST' && req.body.message) {
    try {
      console.log('Middleware checking cache for:', req.body.message.substring(0, 50));
      const startTime = Date.now();

      // SINGLE OLLAMA CALL - Extract metadata một lần duy nhất
      const userMetadata = await extractUserMetadata(req.body.message);
      console.log('Extracted user metadata:', userMetadata);

      // LÀM VÀO REQ để reuse trong toàn bộ flow
      req.userMetadata = userMetadata;

      const cachedResult = await vectorService.findSimilarQuestion(
        req.body.message.trim(),
        0.95, // Threshold cao - chỉ serve cache khi match rất tốt
        userMetadata // Truyền metadata để filtering cache
      );
      if (cachedResult) {
        const cacheTime = Date.now() - startTime;
        console.log(`Found cached response in ${cacheTime}ms (similarity: ${cachedResult.score})`);

        // Set cache result cho controller xử lý tiếp
        req.vectorCache = cachedResult;
        req.cacheTime = cacheTime;
      } else {
        console.log('No cached response found, will process normally');
        // Set cache info cho controller sử dụng
        req.vectorCache = null;
      }
    } catch (error) {
      console.error('Cache check error:', error.message);
      // Continue to normal processing nếu cache check fail
      req.vectorCache = null;
    }
  }

  next();
};

/**
 * Xác định xem có nên lưu response vào cache không
 */

const shouldSaveToCache = (responseData) => {
  console.log('shouldSaveToCache check:', {
    isRoomSearchQuery: responseData.isRoomSearchQuery,
    hasSearchParams: !!responseData.searchParams,
    hasProperties: responseData.hasOwnProperty('properties'),
    propertiesLength: responseData.properties?.length,
    source: responseData.source,
    stack: new Error().stack.split('\n')[2] // Show caller
  });

  // Rule 1: Non-room queries - Always save
  if (responseData.isRoomSearchQuery === false) {
    console.log('Save: Non-room query');
    return {
      save: true,
      reason: 'non-room-query',
      tags: ['non-room']
    };
  }

  // Rule 2: Already cached responses - Don't save again
  if (responseData.source === 'vector-cache') {
    console.log('Skip: Already cached');
    return {
      save: false,
      reason: 'already-cached',
      tags: ['duplicate']
    };
  }

  // Rule 3: Room queries - Only save if has properties with results
  if (responseData.isRoomSearchQuery === true) {
    // Must have properties field and properties.length > 0
    if (responseData.hasOwnProperty('properties') &&
      Array.isArray(responseData.properties) &&
      responseData.properties.length > 0) {
      console.log('Save: Room query with properties');
      return {
        save: true,
        reason: `has-properties-${responseData.properties.length}`,
        tags: ['has-results']
      };
    } else {
      console.log('Skip: Room query without valid properties');
      return {
        save: false,
        reason: 'room-query-no-properties',
        tags: ['no-results']
      };
    }
  }

  // Rule 4: Has searchParams but no valid properties - Don't save (any case)
  if (responseData.searchParams) {
    const hasValidProperties = responseData.hasOwnProperty('properties') &&
      Array.isArray(responseData.properties) &&
      responseData.properties.length > 0;

    if (!hasValidProperties) {
      console.log('Skip: Has searchParams but no valid properties');
      return {
        save: false,
        reason: 'searchparams-no-valid-properties',
        tags: ['no-results']
      };
    }
  }

  // Rule 5: Default - Save with low priority
  console.log('Save: Default case');
  return {
    save: true,
    reason: 'default-save',
    tags: ['fallback']
  };
};

/**
 * Extract user metadata từ message với hybrid approach (rule-based + Ollama)
 */
async function extractUserMetadata(userMessage) {
  try {
    // Bước 1: Rule-based extraction (nhanh, không cần Ollama)
    const quickMetadata = await extractQuickMetadata(userMessage);
    console.log('Quick extracted:', quickMetadata);

    // Bước 2: Kiểm tra xem quick extraction có đủ thông tin không
    const needsOllama = shouldUseOllamaForComplexAnalysis(quickMetadata, userMessage);

    if (needsOllama) {
      const extractedData = await ollamaService.analyzeWithOllama(userMessage);
      return { ...extractedData, extractionMethod: 'ollama' };
    } else {
      console.log('Using quick rule-based extraction');
      return { ...quickMetadata, extractionMethod: 'rule-based' };
    }
  } catch (error) {
    console.log('Error extracting user metadata:', error.message);
    return null;
  }
}

/**
 * Rule-based metadata extraction cho các pattern phổ biến
 */
async function extractQuickMetadata(userMessage) {
  const lowerMessage = userMessage.toLowerCase().trim();

  // Quick check: có phải room search không
  const isRoomSearchQuery = ollamaService.quickRoomSearchCheck(userMessage);

  if (!isRoomSearchQuery) {
    return {
      isRoomSearchQuery: false,
      extractionMethod: 'rule-based'
    };
  }

  // Tạo base metadata
  const metadata = {
    isRoomSearchQuery: true,
    category: null,
    provinceName: null,
    districtName: null,
    amenityNames: [],
    minPrice: null,
    maxPrice: null,
    minArea: null,
    maxArea: null
  };

  // Extract category
  if (/phòng\s*trọ|nhà\s*trọ/i.test(userMessage)) metadata.category = 'phong_tro';
  else if (/căn\s*hộ/i.test(userMessage)) metadata.category = 'can_ho';
  else if (/nhà\s*nguyên\s*căn/i.test(userMessage)) metadata.category = 'nha_nguyen_can';
  else if (/chung\s*cư\s*mini/i.test(userMessage)) metadata.category = 'chung_cu_mini';
  else if (/homestay/i.test(userMessage)) metadata.category = 'homestay';

  // Extract province
  if (/(?:ở|tại|trong)\s*(?:thành\s*phố\s*)?hồ\s*chí\s*minh|tp\.?hcm|tphcm/i.test(userMessage)) {
    metadata.provinceName = 'Thành phố Hồ Chí Minh';
  } else if (/(?:ở|tại|trong)\s*(?:thành\s*phố\s*)?hà\s*nội/i.test(userMessage)) {
    metadata.provinceName = 'Thành phố Hà Nội';
  } else if (/(?:ở|tại|trong)\s*(?:thành\s*phố\s*)?đà\s*nẵng/i.test(userMessage)) {
    metadata.provinceName = 'Thành phố Đà Nẵng';
  } else if (/(?:ở|tại|trong)\s*(?:thành\s*phố\s*)?hải\s*phòng/i.test(userMessage)) {
    metadata.provinceName = 'Thành phố Hải Phòng';
  } else if (/(?:ở|tại|trong)\s*(?:tỉnh\s*)?quảng\s*ninh/i.test(userMessage)) {
    metadata.provinceName = 'Tỉnh Quảng Ninh';
  } else if (/(?:ở|tại|trong)\s*(?:tỉnh\s*)?thừa\s*thiên\s*huế|huế/i.test(userMessage)) {
    metadata.provinceName = 'Tỉnh Thừa Thiên Huế';
  } else if (/(?:ở|tại|trong)\s*(?:tỉnh\s*)?khánh\s*hòa|nha\s*trang/i.test(userMessage)) {
    metadata.provinceName = 'Tỉnh Khánh Hòa';
  } else if (/(?:ở|tại|trong)\s*(?:tỉnh\s*)?nghệ\s*an|vinh/i.test(userMessage)) {
    metadata.provinceName = 'Tỉnh Nghệ An';
  } else if (/(?:ở|tại|trong)\s*(?:thành\s*phố\s*)?cần\s*thơ/i.test(userMessage)) {
    metadata.provinceName = 'Thành phố Cần Thơ';
  } else if (/(?:ở|tại|trong)\s*(?:tỉnh\s*)?đồng\s*nai|biên\s*hòa/i.test(userMessage)) {
    metadata.provinceName = 'Tỉnh Đồng Nai';
  } else if (/(?:ở|tại|trong)\s*(?:tỉnh\s*)?bình\s*dương/i.test(userMessage)) {
    metadata.provinceName = 'Tỉnh Bình Dương';
  }


  // Extract district (cho HCM)
  if (metadata.provinceName === 'Thành phố Hồ Chí Minh') {
    const districtMatches = [
      // Các quận trung tâm
      { pattern: /quận\s*1\b|q\.?1\b/i, name: 'Quận 1' },
      { pattern: /quận\s*3\b|q\.?3\b/i, name: 'Quận 3' },
      { pattern: /quận\s*4\b|q\.?4\b/i, name: 'Quận 4' },
      { pattern: /quận\s*5\b|q\.?5\b/i, name: 'Quận 5' },
      { pattern: /quận\s*6\b|q\.?6\b/i, name: 'Quận 6' },
      { pattern: /quận\s*7\b|q\.?7\b/i, name: 'Quận 7' },
      { pattern: /quận\s*8\b|q\.?8\b/i, name: 'Quận 8' },
      { pattern: /quận\s*10\b|q\.?10\b/i, name: 'Quận 10' },
      { pattern: /quận\s*11\b|q\.?11\b/i, name: 'Quận 11' },
      { pattern: /quận\s*phú\s*nhuận/i, name: 'Quận Phú Nhuận' },
      { pattern: /quận\s*bình\s*thạnh/i, name: 'Quận Bình Thạnh' },
      { pattern: /quận\s*tân\s*bình/i, name: 'Quận Tân Bình' },
      { pattern: /quận\s*tân\s*phú/i, name: 'Quận Tân Phú' },
      { pattern: /quận\s*gò\s*vấp|công\s*nghiệp/i, name: 'Quận Gò Vấp' },
      { pattern: /quận\s*2\b|q\.?2\b|quận\s*9\b|q\.?9\b|quận\s*thủ\s*đức\b|thủ\s*đức/i, name: 'Thành phố Thủ Đức' },
      // Các huyện ngoại thành
      { pattern: /hóc\s*môn/i, name: 'Huyện Hóc Môn' },
      { pattern: /bình\s*chánh/i, name: 'Huyện Bình Chánh' },
      { pattern: /nhà\s*bè/i, name: 'Huyện Nhà Bè' },
      { pattern: /cần\s*giờ/i, name: 'Huyện Cần Giờ' },
      { pattern: /củ\s*chi/i, name: 'Huyện Củ Chi' },
    ];

    for (const district of districtMatches) {
      if (district.pattern.test(userMessage)) {
        metadata.districtName = district.name;
        break;
      }
    }
  }

  // Extract price
  const pricePatterns = [
    // dưới X triệu
    {
      pattern: /dưới\s*(\d+(?:\.\d+)?)\s*triệu/i,
      handler: (match) => ({ maxPrice: parseFloat(match[1]) * 1000000 })
    },

    // khoảng từ A đến B triệu
    {
      pattern: /(?:từ\s*)?(\d+(?:\.\d+)?)\s*[-đến]*\s*(\d+(?:\.\d+)?)\s*triệu/i,
      handler: (match) => ({
        minPrice: parseFloat(match[1]) * 1000000,
        maxPrice: parseFloat(match[2]) * 1000000
      })
    },

    // giá X triệu (min = X, max = X + 30%)
    {
      pattern: /giá\s*(\d+(?:\.\d+)?)\s*triệu/i,
      handler: (match) => {
        const base = parseFloat(match[1]) * 1000000;
        return {
          minPrice: base,
          maxPrice: base * 1.3
        };
      }
    },


    // số + "triệu 500" (ví dụ: 3 triệu 500 = 3.5 triệu)
    {
      pattern: /(\d+)\s*triệu\s*(\d{3})/i,
      handler: (match) => ({
        minPrice: (parseFloat(match[1]) + parseFloat(match[2]) / 1000) * 1000000,
        maxPrice: (parseFloat(match[1]) + parseFloat(match[2]) / 1000) * 1000000
      })
    },

    // giá trị thuần số (ví dụ: 3000000)
    {
      pattern: /\b(\d{6,9})\b/i,
      handler: (match) => ({
        minPrice: parseFloat(match[1]),
        maxPrice: parseFloat(match[1])
      })
    },
    // từ X triệu trở lên / trên X triệu
    {
      pattern: /(?:từ|trên)\s*(\d+(?:\.\d+)?)\s*triệu\s*(?:trở\s*lên)?/i,
      handler: (match) => ({
        minPrice: parseFloat(match[1]) * 1000000
      })
    }
  ];


  for (const { pattern, handler } of pricePatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      const priceInfo = handler(match);
      Object.assign(metadata, priceInfo);
      break;
    }
  }

  // Extract area
  const areaMatch = userMessage.match(/(?:diện\s*tích\s*)?(\d+)\s*m2|(\d+)\s*mét\s*vuông/i);
  if (areaMatch) {
    const area = parseInt(areaMatch[1] || areaMatch[2]);
    metadata.minArea = area;
    metadata.maxArea = area + 5; // +5m2 tolerance
  }

  // Extract amenities
  const amenityPatterns = [
    { pattern: /wifi/i, name: 'wifi' },
    { pattern: /máy\s*lạnh|điều\s*hòa/i, name: 'máy lạnh' },
    { pattern: /ban\s*công/i, name: 'ban công' },
    { pattern: /tủ\s*lạnh/i, name: 'tủ lạnh' },
    { pattern: /thang\s*máy/i, name: 'thang máy' },
    { pattern: /tivi|tv/i, name: 'tivi' },
    { pattern: /máy\s*giặt/i, name: 'máy giặt' },
    { pattern: /tủ\s*quần\s*áo/i, name: 'tủ quần áo' },
    { pattern: /nhà\s*bếp|bếp/i, name: 'nhà bếp' },
    { pattern: /bãi\s*đ(ỗ|au)\s*xe|gửi\s*xe|đỗ\s*xe|parking/i, name: 'bãi đỗ xe' },
  ];


  for (const { pattern, name } of amenityPatterns) {
    if (pattern.test(userMessage)) {
      metadata.amenityNames.push(name);
    }
  }

  // Enhance với real IDs nếu là room search
  if (metadata.isRoomSearchQuery) {
    const [provinces, amenities] = await Promise.all([
      ollamaService.getProvinces(),
      ollamaService.getAmenities()
    ]);

    const enhancedParams = await ollamaService.enhanceWithRealIds(metadata, provinces, amenities);

    return {
      isRoomSearchQuery: true,
      searchParams: enhancedParams
    };
  }

  return metadata;
}

/**
 * Quyết định có nên sử dụng Ollama cho analysis phức tạp không
 */
function shouldUseOllamaForComplexAnalysis(quickMetadata, userMessage) {
  console.log('Deciding on Ollama usage with quickMetadata:', quickMetadata);
  // Nếu không phải room search, không cần Ollama
  if (!quickMetadata.isRoomSearchQuery) {
    return false;
  }

  // Tính completeness score của quick extraction.
  // Check cả raw metadata và searchParams (sau khi enhanced)
  let hasCategory, hasLocation, hasPrice, hasArea, hasAmenities;

  if (quickMetadata.searchParams) {
    // Đã được enhanced thành searchParams
    const params = quickMetadata.searchParams;
    hasCategory = !!params.category;
    hasLocation = !!(params.provinceId || params.districtId);
    hasPrice = !!(params.minPrice || params.maxPrice);
    hasArea = !!(params.minArea || params.maxArea);
    hasAmenities = !!params.amenities;
  } else {
    // Raw metadata chưa enhanced
    hasCategory = !!quickMetadata.category;
    hasLocation = !!(quickMetadata.provinceName || quickMetadata.districtName);
    hasPrice = !!(quickMetadata.minPrice || quickMetadata.maxPrice);
    hasArea = !!(quickMetadata.minArea || quickMetadata.maxArea);
    hasAmenities = quickMetadata.amenityNames?.length > 0;
  }

  const completenessScore = [hasCategory, hasLocation, hasPrice, hasArea, hasAmenities]
    .filter(Boolean).length;

  console.log('Quick extraction completeness:', {
    hasCategory, hasLocation, hasPrice, hasArea, hasAmenities,
    score: `${completenessScore}/5`,
    hasSearchParams: !!quickMetadata.searchParams
  });

  // Nếu có ít nhất 2 thông tin chính, sử dụng quick extraction
  if (completenessScore >= 2) {
    console.log('Sufficient data extracted, using rule-based approach');
    return false;
  }

  // Kiểm tra các pattern phức tạp cần Ollama
  const complexPatterns = [
    /(?:gần|cách|khoảng)\s*\d+\s*(?:km|phút)/i, // Distance patterns
    /(?:không|chưa)\s*(?:có|gồm|bao\s*gồm)/i,   // Negative amenities
    /(?:trừ|ngoại\s*trừ)/i,                     // Exclusions
    /(?:tối\s*đa|tối\s*thiểu|ít\s*nhất)/i      // Min/max modifiers
  ];

  const hasComplexPatterns = complexPatterns.some(pattern => pattern.test(userMessage));

  if (hasComplexPatterns) {
    console.log('🔍 Complex patterns detected, using Ollama');
    return true;
  }

  // Message quá dài hoặc có nhiều điều kiện
  if (userMessage.length > 200 || (userMessage.match(/,/g) || []).length > 3) {
    console.log('Long/complex message detected, using Ollama');
    return true;
  }

  return false;
}



export default {
  autoSaveVector,
  checkVectorCache,
  shouldSaveToCache
};
