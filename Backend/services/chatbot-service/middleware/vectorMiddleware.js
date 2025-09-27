import vectorService from '../services/vectorService.js';

/**
 * Middleware để log và track vector database operations
 */

/**
 * Middleware log vector operations
 */
export const vectorLogger = (operation) => {
  return (req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;
    
    res.send = function(data) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Log operation details
      console.log(`Vector ${operation}:`, {
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        userAgent: req.get('User-Agent')?.substring(0, 50),
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      
      // Call original send
      originalSend.call(this, data);
    };
    
    next();
  };
};

/**
 * Middleware để tự động lưu successful chatbot interactions
 */
export const autoSaveVector = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Chỉ auto-save nếu là successful chatbot response
    if (req.path === '/message' && req.method === 'POST') {
      try {
        const responseData = typeof data === 'string' ? JSON.parse(data) : data;
        
        if (responseData.success && req.body.message) {
          // Async save - không block response
          setImmediate(async () => {
            try {
              const metadata = {
                type: responseData.data?.isRoomSearchQuery ? 'room-search-query' : 'non-room-query',
                source: responseData.data?.source || 'chatbot-auto',
                priority: 'normal',
                tags: ['auto-saved', 'chatbot-interaction'],
                processingTimeMs: responseData.data?.processingTime ? 
                  parseInt(responseData.data.processingTime.replace(/[^\d]/g, '')) : null,
                extractedData: responseData.data?.extractedData,
                searchParams: responseData.data?.searchParams,
                userAgent: req.get('User-Agent'),
                ip: req.ip
              };

              await vectorService.saveQnA(
                req.body.message,
                JSON.stringify(responseData.data),
                metadata
              );
              
              console.log(`Auto-saved interaction: "${req.body.message.substring(0, 50)}..."`);
            } catch (error) {
              console.error('Auto-save error:', error.message);
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
 * Middleware để attach cache info vào request (không block processing)
 */
export const checkVectorCache = async (req, res, next) => {
  // Chỉ check cache cho chatbot messages
  if (req.path === '/message' && req.method === 'POST' && req.body.message) {
    try {
      const startTime = Date.now();
      const cachedResult = await vectorService.findSimilarQuestion(
        req.body.message.trim(), 
        0.95 // Tăng threshold cao để chỉ match câu hỏi rất giống nhau
      );
      
      if (cachedResult) {
        const cacheTime = Date.now() - startTime;
        console.log(`Cache found in ${cacheTime}ms (similarity: ${cachedResult.score || cachedResult.confidence})`);
        
        // Attach cache info vào request để ollamaService sử dụng
        req.vectorCache = {
          found: true,
          result: cachedResult,
          similarity: cachedResult.score || cachedResult.confidence,
          searchTime: cacheTime
        };
      } else {
        console.log('No suitable cache found, proceeding with fresh processing');
        req.vectorCache = { found: false };
      }
    } catch (error) {
      console.error('Cache check error:', error.message);
      req.vectorCache = { found: false, error: error.message };
    }
  }
  
  // Luôn continue to controller để ollamaService xử lý
  next();
};

export default {
  vectorLogger,
  autoSaveVector,
  checkVectorCache
};
