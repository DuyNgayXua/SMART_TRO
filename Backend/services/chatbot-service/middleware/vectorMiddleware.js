import vectorService from '../services/vectorService.js';
import ollamaService from '../services/ollamaService.js';
import amenityRepository from '../../amenity-service/repositories/amenityRepository.js';

// Cache cho provinces, wards và amenities từ APIs
let provincesCache = null;
let wardsCache = new Map(); // Map: provinceName -> wards[]
let amenitiesCache = null;

/**
 * Fetch provinces từ vietnamlabs.com API
 */
async function fetchProvinces() {
  if (provincesCache) {
    return Array.isArray(provincesCache) ? provincesCache : [];
  }
  
  try {
    console.log('Fetching provinces from API...');
    const response = await fetch('https://vietnamlabs.com/api/vietnamprovince');
    if (response.ok) {
      const provinces = await response.json();
      console.log('Provinces response:', {
        type: typeof provinces,
        isArray: Array.isArray(provinces),
        keys: typeof provinces === 'object' ? Object.keys(provinces) : null,
        length: provinces?.length,
        sample: Array.isArray(provinces) ? provinces.slice(0, 2) : provinces
      });
      
      // Handle API response structure: { success: true, data: [...] }
      let provinceArray = [];
      if (provinces && provinces.success && provinces.data && Array.isArray(provinces.data)) {
        // Convert to simple array with name field for fuzzy matching
        provinceArray = provinces.data.map(item => ({
          name: item.province,
          id: item.id,
          original: item
        }));
      } else if (Array.isArray(provinces)) {
        // Direct array (fallback)
        provinceArray = provinces;
      }
      
      if (provinceArray.length > 0) {
        provincesCache = provinceArray;
        console.log(`Cached ${provinceArray.length} provinces`);
        return provinceArray;
      } else {
        console.warn('No valid province array found in response:', provinces);
      }
    } else {
      console.error('Province API response not OK:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Province API error response:', errorText);
    }
  } catch (error) {
    console.error('Error fetching provinces:', error);
  }
  return [];
}

/**
 * Fetch wards for a specific province từ vietnamlabs.com API with pagination
 */
async function fetchWardsForProvince(provinceName) {
  if (wardsCache.has(provinceName)) {
    const cachedWards = wardsCache.get(provinceName);
    return Array.isArray(cachedWards) ? cachedWards : [];
  }
  
  try {
    console.log(`Fetching wards for province: ${provinceName}`);
    const encodedProvince = encodeURIComponent(provinceName);
    
    let allWards = [];
    let offset = 0;
    const limit = 50; // Use reasonable limit
    let hasMore = true;
    
    // Fetch all pages until no more data
    while (hasMore) {
      console.log(`Fetching wards page: offset=${offset}, limit=${limit}`);
      
      const response = await fetch(`https://vietnamlabs.com/api/vietnamprovince?province=${encodedProvince}&limit=${limit}&offset=${offset}`);
      
      if (!response.ok) {
        console.error(`Ward API response not OK for ${provinceName}:`, response.status, response.statusText);
        const errorText = await response.text();
        console.error(`Ward API error response for ${provinceName}:`, errorText);
        break;
      }
      
      const wards = await response.json();
      console.log(`Wards response for ${provinceName} (offset=${offset}):`, {
        success: wards.success,
        hasData: !!(wards.data),
        hasWards: !!(wards.data?.wards),
        wardCount: wards.data?.wards?.length || 0,
        pagination: wards.data?.pagination
      });
      
      // Handle API response structure: { success: true, data: { province: "...", wards: [...], pagination: {...} } }
      if (wards && wards.success && wards.data && wards.data.wards && Array.isArray(wards.data.wards)) {
        // Extract wards from this page
        const pageWards = wards.data.wards.map(ward => ({
          name: ward.name,
          original: ward
        }));
        
        allWards = allWards.concat(pageWards);
        console.log(`Added ${pageWards.length} wards from page, total: ${allWards.length}`);
        
        // Check pagination info
        const pagination = wards.data.pagination;
        if (pagination && typeof pagination.hasMore === 'boolean') {
          hasMore = pagination.hasMore;
        } else {
          // Fallback: if no more wards returned, assume we're done
          hasMore = pageWards.length === limit;
        }
        
        offset += limit;
        
        // Safety check to prevent infinite loop
        if (offset > 10000) {
          console.warn(`Reached maximum offset (${offset}), stopping pagination for ${provinceName}`);
          break;
        }
      } else {
        console.warn(`Invalid ward response structure for ${provinceName}:`, wards);
        break;
      }
    }
    
    if (allWards.length > 0) {
      wardsCache.set(provinceName, allWards);
      console.log(`Cached ${allWards.length} wards for ${provinceName} (fetched ${Math.ceil(offset / limit)} pages)`);
      return allWards;
    } else {
      console.warn(`No wards found for ${provinceName}`);
    }
  } catch (error) {
    console.error(`Error fetching wards for ${provinceName}:`, error);
  }
  return [];
}

/**
 * Fuzzy string matching để tìm tên gần đúng nhất
 */
function fuzzyMatch(keyword, candidates, threshold = 0.5) {
  if (!keyword || !candidates) {
    console.warn('fuzzyMatch: Missing input -', { keyword: !!keyword, candidates: !!candidates });
    return null;
  }
  
  // Handle different candidate structures
  let candidateArray = [];
  if (Array.isArray(candidates)) {
    candidateArray = candidates;
  } else if (candidates && typeof candidates === 'object') {
    // Try to find array in object
    for (const key of Object.keys(candidates)) {
      if (Array.isArray(candidates[key])) {
        candidateArray = candidates[key];
        console.log(`fuzzyMatch: Found array in key "${key}" with ${candidateArray.length} items`);
        break;
      }
    }
  }
  
  if (!Array.isArray(candidateArray) || candidateArray.length === 0) {
    console.warn('fuzzyMatch: No valid candidate array -', { 
      keyword, 
      candidatesType: typeof candidates, 
      isArray: Array.isArray(candidates),
      candidateArrayLength: candidateArray.length,
      candidateKeys: typeof candidates === 'object' ? Object.keys(candidates) : null
    });
    return null;
  }
  
  keyword = keyword.toLowerCase().trim();
  let bestMatch = null;
  let bestScore = 0;
  
  console.log(`fuzzyMatch: Processing ${candidateArray.length} candidates for keyword "${keyword}"`);
  
  // Debug: Show some candidate names for ward matching
  if (candidateArray.length > 0 && keyword.includes('an nhơn')) {
    console.log('Sample ward names:', candidateArray.slice(0, 10).map(c => c.name));
    // Look for similar ward names
    const similarWards = candidateArray.filter(c => 
      c.name.toLowerCase().includes('an') || 
      c.name.toLowerCase().includes('nhơn') ||
      c.name.toLowerCase().includes('nhon')
    );
    console.log('Similar ward names found:', similarWards.map(c => c.name));
  }
  
  for (const candidate of candidateArray) {
    if (!candidate || !candidate.name) {
      console.warn('fuzzyMatch: Invalid candidate -', candidate);
      continue;
    }
    const candidateName = candidate.name.toLowerCase();
    
    // Exact match
    if (keyword === candidateName) {
      console.log(`Exact match found: "${keyword}" = "${candidateName}"`);
      return candidate;
    }
    
    // Enhanced substring match - normalize Vietnamese characters
    const normalizedKeyword = keyword.replace(/nhơn/g, 'nhon').replace(/ơ/g, 'o');
    const normalizedCandidate = candidateName.replace(/nhơn/g, 'nhon').replace(/ơ/g, 'o');
    
    if (normalizedCandidate.includes(normalizedKeyword) || normalizedKeyword.includes(normalizedCandidate)) {
      const score = Math.min(keyword.length, candidateName.length) / Math.max(keyword.length, candidateName.length);
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestMatch = candidate;
        console.log(`Substring match: "${keyword}" ~ "${candidateName}" (score: ${score})`);
      }
    }
    
    // Original substring match
    if (candidateName.includes(keyword) || keyword.includes(candidateName)) {
      const score = Math.min(keyword.length, candidateName.length) / Math.max(keyword.length, candidateName.length);
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestMatch = candidate;
        console.log(`Original substring match: "${keyword}" ~ "${candidateName}" (score: ${score})`);
      }
    }
    
    // Simple character similarity
    const similarity = calculateSimilarity(keyword, candidateName);
    if (similarity > bestScore && similarity >= threshold) {
      bestScore = similarity;
      bestMatch = candidate;
      console.log(`Similarity match: "${keyword}" ~ "${candidateName}" (score: ${similarity})`);
    }
  }
  
  return bestMatch;
}

/**
 * Fetch amenities từ repository (tránh dependency vào server running)
 */
async function fetchAmenities() {
  if (amenitiesCache) {
    return Array.isArray(amenitiesCache) ? amenitiesCache : [];
  }
  
  try {
    console.log('Fetching amenities from repository...');
    // Sử dụng repository trực tiếp thay vì API call
    const result = await amenityRepository.findAll({}, {
      page: 1,
      limit: 1000, // Lấy hết amenities
      isActive: true, // Chỉ lấy amenities đang hoạt động
      sortBy: 'displayOrder',
      sortOrder: 1
    });
    
    console.log('Amenities result structure:', {
      hasResult: !!result,
      hasAmenities: !!(result && result.amenities),
      amenitiesType: typeof result?.amenities,
      isArray: Array.isArray(result?.amenities),
      resultKeys: result ? Object.keys(result) : null,
      amenitiesLength: result?.amenities?.length,
      sample: result?.amenities ? result.amenities.slice(0, 2) : null
    });
    
    // Extract amenities từ result structure
    let amenities = [];
    if (result && result.amenities && Array.isArray(result.amenities)) {
      amenities = result.amenities;
    } else {
      console.warn('Amenities result structure not as expected:', result);
    }
    
    amenitiesCache = amenities;
    console.log(`Cached ${amenities.length} amenities from repository`);
    return amenities;
  } catch (error) {
    console.error('Error fetching amenities from repository:', error);
    return [];
  }
}

/**
 * Tính độ tương tự giữa 2 chuỗi (đơn giản)
 */
function calculateSimilarity(str1, str2) {
  const chars1 = new Set(str1.toLowerCase());
  const chars2 = new Set(str2.toLowerCase());
  const intersection = new Set([...chars1].filter(x => chars2.has(x)));
  const union = new Set([...chars1, ...chars2]);
  return intersection.size / union.size;
}
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
      console.log('Starting metadata extraction for:', req.body.message.substring(0, 100));
      const userMetadata = await extractUserMetadata(req.body.message);
      console.log('Extracted user metadata:', userMetadata);

      // LÀM VÀO REQ để reuse trong toàn bộ flow
      req.userMetadata = userMetadata;

      const cachedResult = await vectorService.findSimilarQuestion(
        req.body.message.trim(),
        0.97, // Threshold cao - chỉ serve cache khi match rất tốt
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
      try {
        const extractedData = await ollamaService.analyzeWithOllama(userMessage);
        return { ...extractedData, extractionMethod: 'ollama' };
      } catch (ollamaError) {
        console.log('Ollama extraction failed, using quick metadata:', ollamaError.message);
        return { ...quickMetadata, extractionMethod: 'rule-based-fallback' };
      }
    } else {
      console.log('Using quick rule-based extraction');
      return { ...quickMetadata, extractionMethod: 'rule-based' };
    }
  } catch (error) {
    console.error('Error extracting user metadata:', error.message);
    console.error('Full error:', error);
    
    // Fallback: Return basic metadata để không block toàn bộ flow
    return {
      isRoomSearchQuery: true, // Assume room search để không block
      extractionMethod: 'error-fallback',
      error: error.message
    };
  }
}

/**
 * Rule-based metadata extraction cho các pattern phổ biến
 */
async function extractQuickMetadata(userMessage) {
  try {
    const lowerMessage = userMessage.toLowerCase().trim();

    // Quick check: có phải room search không
    let isRoomSearchQuery = false;
    try {
      isRoomSearchQuery = ollamaService.quickRoomSearchCheck(userMessage);
    } catch (error) {
      console.warn('quickRoomSearchCheck failed:', error.message);
      // Fallback: Check basic room search patterns
      isRoomSearchQuery = /(?:phòng|nhà|căn hộ|chung cư|homestay).*(?:trọ|thuê|cho thuê)/i.test(userMessage);
    }

  if (!isRoomSearchQuery) {
    return {
      isRoomSearchQuery: false,
      extractionMethod: 'rule-based'
    };
  }

  // Tạo base metadata (schema mới: chỉ province và ward)
  const metadata = {
    isRoomSearchQuery: true,
    category: null,
    provinceName: null,
    wardName: null,
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

  // Extract province using regex + API fuzzy matching
  const provincePatterns = [
    // "ở/tại/trong + thành phố + tên"
    { pattern: /(?:ở|tại|trong)\s*(?:thành\s*phố)\s+([a-zA-ZÀ-ỹ\s]+?)(?:\s*(?:,|phường|xã|giá|diện|tiện)|$)/i },
    // "ở/tại/trong + tỉnh + tên"  
    { pattern: /(?:ở|tại|trong)\s*(?:tỉnh)\s+([a-zA-ZÀ-ỹ\s]+?)(?:\s*(?:,|phường|xã|giá|diện|tiện)|$)/i },
    // "thành phố + tên" (không có prefix ở/tại/trong)
    { pattern: /(?:thành\s*phố)\s+([a-zA-ZÀ-ỹ\s]+?)(?:\s*(?:,|phường|xã|giá|diện|tiện)|$)/i },
    // "tỉnh + tên" (không có prefix ở/tại/trong)
    { pattern: /(?:tỉnh)\s+([a-zA-ZÀ-ỹ\s]+?)(?:\s*(?:,|phường|xã|giá|diện|tiện)|$)/i },
  ];

  for (const { pattern } of provincePatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      const extractedProvinceName = match[1].trim();
      console.log(`Extracted province name from regex: "${extractedProvinceName}"`);
      
      // Fuzzy match với API provinces
      try {
        const provinces = await fetchProvinces();
        console.log(`Got ${provinces.length} provinces for fuzzy matching`);
        console.log('Sample provinces:', provinces.slice(0, 3).map(p => p.name));
        console.log(`Looking for province matching: "${extractedProvinceName}"`);
        
        // Check if there's a match for "Hồ Chí Minh"
        const hcmVariants = provinces.filter(p => 
          p.name.toLowerCase().includes('hồ chí minh') || 
          p.name.toLowerCase().includes('ho chi minh') ||
          p.name.toLowerCase().includes('tp hcm') ||
          p.name.toLowerCase().includes('thành phố hồ chí minh')
        );
        console.log('HCM variants found:', hcmVariants.map(p => p.name));
        
        const matchedProvince = fuzzyMatch(extractedProvinceName, provinces);
        
        if (matchedProvince) {
          metadata.provinceName = matchedProvince.name; // Use exact name from API
          console.log(`Fuzzy matched province: "${extractedProvinceName}" -> "${matchedProvince.name}"`);
        } else {
          console.log(`No fuzzy match found for province: "${extractedProvinceName}"`);
          // Try alternative matching - check if it contains key words
          const altMatch = provinces.find(p => {
            const pName = p.name.toLowerCase();
            const keyword = extractedProvinceName.toLowerCase();
            return pName.includes(keyword) || keyword.includes(pName);
          });
          if (altMatch) {
            metadata.provinceName = altMatch.name;
            console.log(`Alternative match found: "${extractedProvinceName}" -> "${altMatch.name}"`);
          } else {
            metadata.provinceName = extractedProvinceName; // Fallback to extracted name
          }
        }
      } catch (provinceError) {
        console.error('Error in province fuzzy matching:', provinceError.message);
        metadata.provinceName = extractedProvinceName; // Fallback to extracted name
      }
      break;
    }
  }


  // Extract ward using regex + API fuzzy matching
  const wardPatterns = [
    // Phường với số
    { pattern: /phường\s*(\d+)\b|p\.?\s*(\d+)\b/i, type: 'phường', isNumber: true },
    // Phường với tên
    { pattern: /phường\s+([a-zA-ZÀ-ỹ][a-zA-ZÀ-ỹ\s]*?)(?:\s*(?:giá|diện\s*tích|tiện\s*ích|,)|$)/i, type: 'phường', isNumber: false },
    // Xã
    { pattern: /xã\s+([a-zA-ZÀ-ỹ][a-zA-ZÀ-ỹ\s]*?)(?:\s*(?:giá|diện\s*tích|tiện\s*ích|,)|$)/i, type: 'xã', isNumber: false },
    // Thị trấn
    { pattern: /thị\s*trấn\s+([a-zA-ZÀ-ỹ][a-zA-ZÀ-ỹ\s]*?)(?:\s*(?:giá|diện\s*tích|tiện\s*ích|,)|$)/i, type: 'thị trấn', isNumber: false },
  ];

  console.log('Testing ward patterns on message:', userMessage);
  for (const { pattern, type, isNumber } of wardPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      const extractedWardName = match[1].trim();
      console.log(`Ward pattern matched: ${type} "${extractedWardName}"`);
      
      if (isNumber) {
        // Nếu là số thì giữ nguyên format
        metadata.wardName = `${type.charAt(0).toUpperCase() + type.slice(1)} ${extractedWardName}`;
      } else {
        // Nếu là tên thì fuzzy match với API
        if (metadata.provinceName) {
          try {
            const wards = await fetchWardsForProvince(metadata.provinceName);
            console.log(`Got ${wards.length} wards for province ${metadata.provinceName}`);
            
            // Debug: Look for "An Nhon" related wards
            if (extractedWardName.toLowerCase().includes('an nhơn')) {
              const relatedWards = wards.filter(w => 
                w.name.toLowerCase().includes('an') && 
                (w.name.toLowerCase().includes('nhơn') || w.name.toLowerCase().includes('nhon'))
              );
              console.log(`Found ${relatedWards.length} "An Nhon" related wards:`, relatedWards.map(w => w.name));
              
              // Also search for similar patterns
              const similarWards = wards.filter(w => 
                w.name.toLowerCase().includes('tân') ||
                w.name.toLowerCase().includes('an ') ||
                w.name.toLowerCase().includes('nhơn') ||
                w.name.toLowerCase().includes('nhon')
              );
              console.log(`Similar pattern wards (${similarWards.length}):`, similarWards.slice(0, 5).map(w => w.name));
            }
            
            const matchedWard = fuzzyMatch(extractedWardName, wards);
            
            if (matchedWard) {
              metadata.wardName = matchedWard.name;
              console.log(`Fuzzy matched ward: "${extractedWardName}" -> "${matchedWard.name}"`);
            } else {
              console.log(`No fuzzy match found for ward: "${extractedWardName}"`);
              metadata.wardName = `${type.charAt(0).toUpperCase() + type.slice(1)} ${extractedWardName}`;
            }
          } catch (wardError) {
            console.error('Error in ward fuzzy matching:', wardError.message);
            metadata.wardName = `${type.charAt(0).toUpperCase() + type.slice(1)} ${extractedWardName}`;
          }
        } else {
          // Không có province thì không thể tìm ward, giữ nguyên format
          metadata.wardName = `${type.charAt(0).toUpperCase() + type.slice(1)} ${extractedWardName}`;
        }
      }
      
      console.log(`Final extracted ward: ${metadata.wardName}`);
      break;
    }
  }

  // Extract price
  const pricePatterns = [
    // từ A triệu đến B triệu (improved pattern)
    {
      pattern: /từ\s*(\d+(?:\.\d+)?)\s*triệu\s*đến\s*(\d+(?:\.\d+)?)\s*triệu/i,
      handler: (match) => ({
        minPrice: parseFloat(match[1]) * 1000000,
        maxPrice: parseFloat(match[2]) * 1000000
      })
    },

    // dưới X triệu
    {
      pattern: /dưới\s*(\d+(?:\.\d+)?)\s*triệu/i,
      handler: (match) => ({ maxPrice: parseFloat(match[1]) * 1000000 })
    },

    // khoảng A - B triệu (fallback pattern)
    {
      pattern: /(?:khoảng\s*)?(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*triệu/i,
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


  console.log('Testing price patterns on message:', userMessage);
  for (const { pattern, handler } of pricePatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      console.log(`Price pattern matched:`, { pattern: pattern.toString(), match: match });
      const priceInfo = handler(match);
      console.log(`Extracted price info:`, priceInfo);
      Object.assign(metadata, priceInfo);
      break;
    }
  }

  // Extract area
// Extract area (diện tích)
const areaPattern = /(?:diện\s*tích\s*)?(?:từ\s*(\d+)\s*(?:đến|-)\s*(\d+)\s*m2|từ\s*(\d+)\s*m2|khoảng\s*(\d+)\s*m2|(\d+)\s*m2|(\d+)\s*mét\s*vuông)/i;
const areaMatch = userMessage.match(areaPattern);

if (areaMatch) {
  let minArea = null;
  let maxArea = null;

  if (areaMatch[1] && areaMatch[2]) {
    // Trường hợp: "từ A đến B m2" hoặc "từ 20 - 40m2"
    minArea = parseInt(areaMatch[1]);
    maxArea = parseInt(areaMatch[2]);
  } else if (areaMatch[3]) {
    // Trường hợp: "từ 25m2"
    minArea = parseInt(areaMatch[3]);
    maxArea = minArea + 10; // cộng thêm biên độ
  } else if (areaMatch[4]) {
    // Trường hợp: "khoảng 25m2"
    minArea = parseInt(areaMatch[4]) - 5;
    maxArea = parseInt(areaMatch[4]) + 5;
  } else if (areaMatch[5] || areaMatch[6]) {
    // Trường hợp: "25m2" hoặc "25 mét vuông"
    const area = parseInt(areaMatch[5] || areaMatch[6]);
    minArea = area;
    maxArea = area + 10;
  }

  if (minArea && maxArea) {
    metadata.minArea = minArea;
    metadata.maxArea = maxArea;
    console.log(` Diện tích: ${minArea} - ${maxArea}m2`);
  }
}

  // Extract amenities using regex + API fuzzy matching
  const amenityPatterns = [
    // Pattern để extract từ "tiện ích + danh sách"
    { pattern: /tiện\s*ích\s*([^,\.]+(?:,\s*[^,\.]+)*)/i, isGeneral: true },
    // Patterns cho từng loại amenity phổ biến
    { pattern: /wifi/i, isGeneral: false },
    { pattern: /máy\s*lạnh|điều\s*hòa/i, isGeneral: false },
    { pattern: /ban\s*công/i, isGeneral: false },
    { pattern: /tủ\s*lạnh/i, isGeneral: false },
    { pattern: /thang\s*máy/i, isGeneral: false },
    { pattern: /tivi|tv/i, isGeneral: false },
    { pattern: /máy\s*giặt/i, isGeneral: false },
    { pattern: /tủ\s*quần\s*áo/i, isGeneral: false },
    { pattern: /nhà\s*bếp|bếp/i, isGeneral: false },
    { pattern: /bãi\s*đ(ỗ|au)\s*xe|gửi\s*xe|đỗ\s*xe|parking/i, isGeneral: false },
    { pattern: /wc\s*riêng|toilet\s*riêng|nhà\s*vệ\s*sinh\s*riêng/i, isGeneral: false },
  ];

  console.log('Testing amenity patterns on message:', userMessage);
  
  let amenities = [];
  try {
    amenities = await fetchAmenities();
    console.log(`Got ${amenities.length} amenities for fuzzy matching`);
  } catch (amenityError) {
    console.error('Error fetching amenities:', amenityError.message);
    amenities = [];
  }
  
  const extractedAmenityKeywords = new Set();

  for (const { pattern, isGeneral } of amenityPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      if (isGeneral) {
        // "tiện ích wifi, tủ lạnh" -> split thành từng keyword
        const amenityList = match[1].split(',').map(item => item.trim());
        for (const keyword of amenityList) {
          if (keyword.length > 0) {
            extractedAmenityKeywords.add(keyword);
          }
        }
      } else {
        // Single amenity keyword
        extractedAmenityKeywords.add(match[0]);
      }
    }
  }

  console.log('Extracted amenity keywords:', Array.from(extractedAmenityKeywords));

  // Fuzzy match với API amenities
  for (const keyword of extractedAmenityKeywords) {
    try {
      const matchedAmenity = fuzzyMatch(keyword, amenities, 0.5); // Lower threshold for amenities
      
      if (matchedAmenity) {
        metadata.amenityNames.push(matchedAmenity.name);
        console.log(`Fuzzy matched amenity: "${keyword}" -> "${matchedAmenity.name}"`);
      } else {
        // Fallback: giữ keyword gốc nếu không match được
        console.log(`No fuzzy match found for amenity: "${keyword}", keeping original`);
        metadata.amenityNames.push(keyword);
      }
    } catch (amenityMatchError) {
      console.error(`Error in amenity fuzzy matching for "${keyword}":`, amenityMatchError.message);
      metadata.amenityNames.push(keyword); // Fallback to original keyword
    }
  }

  console.log('Final extracted amenities:', metadata.amenityNames);

  // Enhance với real data nếu là room search (schema mới: province/ward là strings)
  if (metadata.isRoomSearchQuery) {
    try {
      // Use amenities from repository instead of ollamaService
      let repositoryAmenities = [];
      try {
        repositoryAmenities = await fetchAmenities();
        console.log(`Using ${repositoryAmenities.length} amenities from repository for enhancement`);
      } catch (amenityError) {
        console.warn('Failed to fetch amenities for enhancement:', amenityError.message);
      }
      
      const enhancedParams = await ollamaService.enhanceWithRealIds(metadata, repositoryAmenities);
      console.log('Enhanced params result:', enhancedParams);

      return {
        isRoomSearchQuery: true,
        searchParams: enhancedParams
      };
    } catch (error) {
      console.warn('Enhancement with real IDs failed:', error.message);
      console.warn('Full error:', error);
      
      // Fallback: Create basic searchParams manually
      const fallbackParams = {
        province: metadata.provinceName || null,
        ward: metadata.wardName || null,
        category: metadata.category || null,
        minPrice: metadata.minPrice?.toString() || null,
        maxPrice: metadata.maxPrice?.toString() || null,
        minArea: metadata.minArea?.toString() || null,
        maxArea: metadata.maxArea?.toString() || null,
        amenities: metadata.amenityNames?.length > 0 ? metadata.amenityNames.join(',') : null,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        page: '1',
        limit: '8'
      };
      
      console.log('Using fallback searchParams:', fallbackParams);
      return {
        isRoomSearchQuery: true,
        searchParams: fallbackParams
      };
    }
  }

  return metadata;
  
  } catch (error) {
    console.error('Error in extractQuickMetadata:', error.message);
    console.error('Full error:', error);
    
    // Return basic fallback metadata
    return {
      isRoomSearchQuery: true,
      extractionMethod: 'error-fallback',
      error: error.message
    };
  }
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
    // Đã được enhanced thành searchParams (schema mới)
    const params = quickMetadata.searchParams;
    hasCategory = !!params.category;
    hasLocation = !!(params.province || params.ward);
    hasPrice = !!(params.minPrice || params.maxPrice);
    hasArea = !!(params.minArea || params.maxArea);
    hasAmenities = !!params.amenities;
  } else {
    // Raw metadata chưa enhanced (schema mới)
    hasCategory = !!quickMetadata.category;
    hasLocation = !!(quickMetadata.provinceName || quickMetadata.wardName);
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
    console.log('Complex patterns detected, using Ollama');
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
