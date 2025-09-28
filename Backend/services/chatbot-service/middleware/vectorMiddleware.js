import vectorService from '../services/vectorService.js';
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

                console.log(`✅ Auto-saved: "${req.body.message.substring(0, 50)}..." (${shouldSaveCache.reason})`);
              } else {
                console.log(`❌ Skip save: "${req.body.message.substring(0, 50)}..." (${shouldSaveCache.reason})`);
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
      const cachedResult = await vectorService.findSimilarQuestion(
        req.body.message.trim(),
        0.85 // Threshold cao - chỉ serve cache khi match rất tốt
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
  console.log('🔍 shouldSaveToCache check:', {
    isRoomSearchQuery: responseData.isRoomSearchQuery,
    hasSearchParams: !!responseData.searchParams,
    hasProperties: responseData.hasOwnProperty('properties'),
    propertiesLength: responseData.properties?.length,
    source: responseData.source,
    stack: new Error().stack.split('\n')[2] // Show caller
  });

  // Rule 1: Non-room queries - Always save
  if (responseData.isRoomSearchQuery === false) {
    console.log('✅ Save: Non-room query');
    return {
      save: true,
      reason: 'non-room-query',
      tags: ['non-room']
    };
  }

  // Rule 2: Already cached responses - Don't save again
  if (responseData.source === 'vector-cache') {
    console.log('❌ Skip: Already cached');
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
      console.log('✅ Save: Room query with properties');
      return {
        save: true,
        reason: `has-properties-${responseData.properties.length}`,
        tags: ['has-results']
      };
    } else {
      console.log('❌ Skip: Room query without valid properties');
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
      console.log('❌ Skip: Has searchParams but no valid properties');
      return {
        save: false,
        reason: 'searchparams-no-valid-properties',
        tags: ['no-results']
      };
    }
  }

  // Rule 5: Default - Save with low priority
  console.log('✅ Save: Default case');
  return {
    save: true,
    reason: 'default-save',
    tags: ['fallback']
  };
};



export default {
  autoSaveVector,
  checkVectorCache,
  shouldSaveToCache
};
