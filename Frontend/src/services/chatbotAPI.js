import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Create axios instance for chatbot API
const chatbotAPI = axios.create({
  baseURL: `${API_BASE_URL}/api/chatbot`,
  timeout: 60000, // 60 seconds timeout for AI responses
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
chatbotAPI.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
chatbotAPI.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('Chatbot API Error:', error);
    return Promise.reject(error);
  }
);

const chatbotService = {
  /**
   * Send guided conversation message to chatbot
   * @param {string} message - User message
   * @param {string} sessionId - Optional session ID for conversation context
   * @param {Object} conversationState - Optional conversation state
   * @returns {Promise<Object>} API response with guided conversation data
   */
  sendGuidedMessage: async (message, sessionId = null, conversationState = null) => {
    try {
      const response = await chatbotAPI.post('/chat', {
        message: message.trim(),
        sessionId: sessionId,
        conversationState: conversationState
      });

      if (response.data.success) {
        console.log('Guided Chatbot Response:', response.data);
        return {
          success: true,
          data: {
            message: response.data.message,
            step: response.data.step,
            options: response.data.options,
            properties: response.data.properties || [],
            totalFound: response.data.totalFound || 0,
            conversationState: response.data.conversationState || {},
            showGrid: response.data.showGrid || false,
            placeholder: response.data.placeholder,
            searchCriteria: response.data.searchCriteria
          }
        };
      } else {
        throw new Error(response.data.message || 'Failed to get guided chatbot response');
      }
    } catch (error) {
      console.error('Error sending guided message to chatbot:', error);
      
      // Handle different error types
      if (error.response) {
        // Server responded with error status
        const statusCode = error.response.status;
        const errorMessage = error.response.data?.message || 'Server error';
        
        if (statusCode === 429) {
          return {
            success: false,
            message: 'Bạn đang gửi tin nhắn quá nhanh. Vui lòng chờ một chút.',
            code: 'RATE_LIMIT'
          };
        } else if (statusCode === 503) {
          return {
            success: false,
            message: 'Dịch vụ AI tạm thời không khả dụng. Vui lòng thử lại sau.',
            code: 'SERVICE_UNAVAILABLE'
          };
        } else {
          return {
            success: false,
            message: errorMessage,
            code: 'SERVER_ERROR'
          };
        }
      } else if (error.code === 'ECONNABORTED') {
        // Timeout error
        return {
          success: false,
          message: 'Yêu cầu quá lâu. Vui lòng thử lại.',
          code: 'TIMEOUT'
        };
      } else {
        // Network or other errors
        return {
          success: false,
          message: 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.',
          code: 'NETWORK_ERROR'
        };
      }
    }
  },

  /**
   * Send message to chatbot and get AI response
   * @param {string} message - User message
   * @param {string} sessionId - Optional session ID for conversation context
   * @returns {Promise<Object>} API response with bot message and properties
   */
  sendMessage: async (message, sessionId = null) => {
    try {
      const response = await chatbotAPI.post('/message', {
        message: message.trim(),
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      });

      if (response.data.success) {
        console.log('Chatbot Response Data:', response.data);
        return {
          success: true,
          data: {
            message: response.data.data.message,
            properties: response.data.data.properties || [],
            sessionId: response.data.data.sessionId,
            searchCriteria: response.data.data.searchCriteria || null,
            searchParams: response.data.data.searchParams || null,
            totalFound: response.data.data.totalFound || 0,
            suggestions: response.data.data.suggestions || [],
            processingTime: response.data.data.processingTime,
            source: response.data.data.source
          }
        };
      } else {
        throw new Error(response.data.message || 'Failed to get chatbot response');
      }
    } catch (error) {
      console.error('Error sending message to chatbot:', error);
      
      // Handle different error types
      if (error.response) {
        // Server responded with error status
        const statusCode = error.response.status;
        const errorMessage = error.response.data?.message || 'Server error';
        
        if (statusCode === 429) {
          return {
            success: false,
            message: 'Bạn đang gửi tin nhắn quá nhanh. Vui lòng chờ một chút.',
            code: 'RATE_LIMIT'
          };
        } else if (statusCode === 503) {
          return {
            success: false,
            message: 'Dịch vụ AI tạm thời không khả dụng. Vui lòng thử lại sau.',
            code: 'SERVICE_UNAVAILABLE'
          };
        } else {
          return {
            success: false,
            message: errorMessage,
            code: 'SERVER_ERROR'
          };
        }
      } else if (error.code === 'ECONNABORTED') {
        // Timeout error
        return {
          success: false,
          message: 'Yêu cầu quá lâu. Vui lòng thử lại.',
          code: 'TIMEOUT'
        };
      } else {
        // Network or other errors
        return {
          success: false,
          message: 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.',
          code: 'NETWORK_ERROR'
        };
      }
    }
  },


  /**
   * Get chatbot statistics (admin only)
   * @returns {Promise<Object>} Chatbot usage statistics
   */
  getStatistics: async () => {
    try {
      const response = await chatbotAPI.get('/statistics');
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data
        };
      } else {
        throw new Error(response.data.message || 'Failed to get statistics');
      }
    } catch (error) {
      console.error('Error getting chatbot statistics:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Không thể tải thống kê',
        code: error.response?.status || 'UNKNOWN_ERROR'
      };
    }
  },

  /**
   * Clear chat session
   * @param {string} sessionId - Session ID to clear
   * @returns {Promise<Object>} Clear result
   */
  clearSession: async (sessionId) => {
    try {
      const response = await chatbotAPI.post(`/clear-session/${sessionId}`);
      
      if (response.data.success) {
        return {
          success: true,
          message: 'Đã xóa lịch sử chat thành công'
        };
      } else {
        throw new Error(response.data.message || 'Failed to clear session');
      }
    } catch (error) {
      console.error('Error clearing session:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Không thể xóa lịch sử chat',
        code: error.response?.status || 'UNKNOWN_ERROR'
      };
    }
  }
};

export default chatbotService;
