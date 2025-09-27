/**
 * MCP Chatbot API Service - Kết nối với Gradio FastAPI server
 */

const MCP_API_BASE_URL = 'http://localhost:7861/api';

const mcpChatbotAPI = {
  /**
   * Gửi tin nhắn guided conversation
   */
  sendGuidedMessage: async (message, sessionId = null, conversationState = null) => {
    try {
      const response = await fetch(`${MCP_API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sessionId,
          conversationState
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('=== MCP CHATBOT RAW RESPONSE ===');
      console.log('Full response data:', JSON.stringify(data, null, 2));
      console.log('Response keys:', Object.keys(data));
      console.log('Properties data:', data.properties);
      console.log('Properties length:', data.properties?.length || 0);
      
      // Log chi tiết properties nếu có
      if (data.properties && data.properties.length > 0) {
        console.log('=== PROPERTIES DETAILS ===');
        data.properties.forEach((prop, index) => {
          console.log(`Property ${index + 1}:`, {
            id: prop._id,
            title: prop.title,
            location: prop.location,
            hasLocationObject: !!prop.location,
            locationKeys: prop.location ? Object.keys(prop.location) : null
          });
        });
      }
      console.log('=== END MCP RESPONSE ===');
      
      return {
        success: true,
        data: {
          sessionId: data.session_id,
          message: data.message,
          step: data.step,
          options: data.options || [],
          properties: data.properties || [],
          totalFound: data.totalFound || 0,
          conversationState: data.conversationState,
          showGrid: data.showGrid || false,
          placeholder: data.placeholder
        }
      };
    } catch (error) {
      console.error('MCP Chatbot API error:', error);
      return {
        success: false,
        message: 'Lỗi kết nối với chatbot AI. Vui lòng thử lại sau.',
        error: error.message
      };
    }
  },

  /**
   * Kiểm tra trạng thái server
   */
  healthCheck: async () => {
    try {
      const response = await fetch(`${MCP_API_BASE_URL}/health`);
      return response.ok;
    } catch (error) {
      console.error('MCP Health check failed:', error);
      return false;
    }
  },

};

export default mcpChatbotAPI;
