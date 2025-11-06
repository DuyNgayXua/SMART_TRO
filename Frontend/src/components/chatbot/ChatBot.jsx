import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import chatbotAPI from '../../services/chatbotAPI';
import mcpChatbotAPI from '../../services/mcpChatbotAPI';
import { useAuth } from '../../contexts/AuthContext';
import PropertySlider from '../properties/PropertySlider';
import ChatInput from './ChatInput';
import ChatMessages from './ChatMessages';
import {
  FaRobot,
  FaTimes,
  FaPaperPlane,
  FaRedo,
  FaVolumeUp,
  FaVolumeMute,
  FaLightbulb
} from 'react-icons/fa';
import './ChatBot.css';

const ChatBot = ({ onPropertySearch, formatPrice }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Chatbot states
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [guidedMessages, setGuidedMessages] = useState([]);
  const [freeMessages, setFreeMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [searching, setSearching] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hasVisited, setHasVisited] = useState(false);
  
  // Guided conversation states
  const [guidedSessionId, setGuidedSessionId] = useState(null);
  const [freeSessionId, setFreeSessionId] = useState(null);
  const [currentStep, setCurrentStep] = useState('greeting');
  const [chatOptions, setChatOptions] = useState([]);
  const [conversationState, setConversationState] = useState(null);
  const [guidedMode, setGuidedMode] = useState(true);

  // Computed messages based on current mode
  const messages = guidedMode ? guidedMessages : freeMessages;
  const setMessages = guidedMode ? setGuidedMessages : setFreeMessages;
  const sessionId = guidedMode ? guidedSessionId : freeSessionId;
  const setSessionId = guidedMode ? setGuidedSessionId : setFreeSessionId;

  // Auto scroll when messages change and chatbot is open
  useEffect(() => {
    if (isChatbotOpen && messages.length > 0) {
      setTimeout(() => {
        scrollToLatestMessage();
      }, 100);
    }
  }, [messages.length, isChatbotOpen]);

  // Load conversation on component mount (works for both logged in and guest users)
  useEffect(() => {
    loadConversationFromStorage();
  }, [user]);

  // Save conversation whenever messages change (works for both logged in and guest users)
  useEffect(() => {
    if (guidedMessages.length > 0 || freeMessages.length > 0) {
      const timeoutId = setTimeout(() => {
        saveConversationToStorage();
      }, 1000); // Debounce save

      return () => clearTimeout(timeoutId);
    }
  }, [guidedMessages, freeMessages, user]);

  // Auto show hint after component mounts (only for first-time visitors)
  useEffect(() => {
    // Kiểm tra xem user đã từng thấy hint chưa
    const hasSeenHint = localStorage.getItem('chatbot_hint_seen');
    
    if (!hasSeenHint) {
      const showHintTimer = setTimeout(() => {
        setShowHint(true);
        setHasVisited(true);
      }, 3000); // Hiển thị hint sau 3 giây

      return () => clearTimeout(showHintTimer);
    } else {
      setHasVisited(true);
    }
  }, []);





  // Sound functions
  const playSuccessSound = () => {
    if (!soundEnabled) return;
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  };

  const playErrorSound = () => {
    if (!soundEnabled) return;
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(300, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  };

  const toggleChatbot = () => {
    setIsChatbotOpen((prev) => {
      const willOpen = !prev;
      if (willOpen) {
        // Chỉ khởi tạo conversation nếu chưa có tin nhắn trong guided mode
        if (guidedMode && guidedMessages.length === 0) {
          setTimeout(() => {
            initializeConversation();
          }, 100);
        }
        // Scroll xuống tin nhắn mới nhất sau khi mở
        setTimeout(() => {
          scrollToLatestMessage();
        }, 200);
      }
      return willOpen;
    });
  };

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled);
  };

  const [hintMessage, setHintMessage] = useState('');

  const handleHintClick = () => {
    setIsChatbotOpen(true);
    setHintMessage('Tìm phòng trọ gần Đại học Công Nghiệp ở Thành phố Hồ Chí Minh, tiện ích: wifi, ban công, diện tích 22m2, giá dưới 3 triệu');
    setShowHint(false);
    setGuidedMode(false); // Chuyển sang chế độ tự do
    // Lưu trạng thái đã xem hint
    localStorage.setItem('chatbot_hint_seen', 'true');
    // Không reset messages, chỉ chuyển mode
  };

  const handleCloseHint = () => {
    setShowHint(false);
    // Lưu trạng thái đã xem hint khi đóng
    localStorage.setItem('chatbot_hint_seen', 'true');
  };

  // Scroll to latest message
  const scrollToLatestMessage = () => {
    const messagesContainer = document.querySelector('.chatbot-messages');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  };

  // Save conversation to localStorage (works for both logged in and guest users)
  const saveConversationToStorage = () => {
    try {
      const conversationData = {
        guidedMessages,
        freeMessages,
        guidedSessionId,
        freeSessionId,
        conversationState,
        currentStep,
        lastUpdated: new Date().toISOString()
      };
      
      // Use user ID if logged in, otherwise use 'guest' key
      const storageKey = user?._id ? `chatbot_conversation_${user._id}` : 'chatbot_conversation_guest';
      localStorage.setItem(storageKey, JSON.stringify(conversationData));
    } catch (error) {
      console.error('Error saving conversation to storage:', error);
      // Clear storage if there's an error
      try {
        const storageKey = user?._id ? `chatbot_conversation_${user._id}` : 'chatbot_conversation_guest';
        localStorage.removeItem(storageKey);
      } catch (clearError) {
        console.error('Error clearing corrupted storage:', clearError);
      }
    }
  };

  // Load conversation from localStorage (works for both logged in and guest users)
  const loadConversationFromStorage = () => {
    // Use user ID if logged in, otherwise use 'guest' key
    const storageKey = user?._id ? `chatbot_conversation_${user._id}` : 'chatbot_conversation_guest';
    const savedData = localStorage.getItem(storageKey);
    
    if (savedData) {
      try {
        const conversationData = JSON.parse(savedData);
        
        // Kiểm tra data không quá cũ (7 ngày)
        const lastUpdated = new Date(conversationData.lastUpdated);
        const daysDiff = (new Date() - lastUpdated) / (1000 * 60 * 60 * 24);
        
        if (daysDiff <= 7) {
          // Convert timestamp strings back to Date objects with error handling
          const guidedMessagesWithDates = (conversationData.guidedMessages || []).map(msg => ({
            ...msg,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
          }));
          
          const freeMessagesWithDates = (conversationData.freeMessages || []).map(msg => ({
            ...msg,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
          }));
          
          setGuidedMessages(guidedMessagesWithDates);
          setFreeMessages(freeMessagesWithDates);
          setGuidedSessionId(conversationData.guidedSessionId || null);
          setFreeSessionId(conversationData.freeSessionId || null);
          setConversationState(conversationData.conversationState || null);
          setCurrentStep(conversationData.currentStep || 'greeting');
          
          return true;
        } else {
          // Xóa data cũ
          localStorage.removeItem(storageKey);
        }
      } catch (error) {
        console.error('Error loading conversation from storage:', error);
        localStorage.removeItem(storageKey);
      }
    }
    return false;
  };

  // Clear conversation storage (works for both logged in and guest users)
  const clearConversationStorage = () => {
    const storageKey = user?._id ? `chatbot_conversation_${user._id}` : 'chatbot_conversation_guest';
    localStorage.removeItem(storageKey);
  };

  // Helper function to create message with proper timestamp
  const createMessage = (messageData) => ({
    id: Date.now(),
    timestamp: new Date(),
    ...messageData
  });

  // Optimized callbacks for ChatInput
  const handleModeChange = useCallback((isGuidedMode) => {
    setGuidedMode(isGuidedMode);
  }, []);

  const handleSendMessage = useCallback(async (messageText) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      text: messageText,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    // Scroll xuống tin nhắn user mới
    setTimeout(() => {
      scrollToLatestMessage();
    }, 50);

    try {
      let response;
      
      if (guidedMode) {
        // Sử dụng MCP guided conversation cho tốc độ tối ưu
        response = await mcpChatbotAPI.sendGuidedMessage(
          messageText, 
          sessionId, 
          conversationState
        );
      } else {
        // Sử dụng free-form conversation (cũ)
        response = await chatbotAPI.sendMessage(messageText, sessionId);
      }
      
      if (response.success) {
        // Cập nhật session ID nếu có
        if (response.data.sessionId && !sessionId) {
          setSessionId(response.data.sessionId);
        }
        
        // Cập nhật conversation state cho guided mode
        if (guidedMode && response.data.conversationState) {
          setConversationState(response.data.conversationState);
          setCurrentStep(response.data.step || 'greeting');
        }
        
        // Cập nhật options
        setChatOptions(response.data.options || []);
        
        const botMessage = {
          id: Date.now() + 1,
          text: response.data.message,
          sender: 'bot',
          timestamp: new Date(),
          properties: response.data.properties || [],
          options: response.data.options || [],
          step: response.data.step,
          showGrid: response.data.showGrid || false,
          placeholder: response.data.placeholder
        };
        
        setMessages(prev => [...prev, botMessage]);
        playSuccessSound();
        
        // Scroll xuống tin nhắn mới
        setTimeout(() => {
          scrollToLatestMessage();
        }, 100);
        
        // Nếu có properties, hiển thị chúng
        if (response.data.showGrid && response.data.properties?.length > 0) {
          // Call callback if provided
          if (onPropertySearch && typeof onPropertySearch === 'function') {
            onPropertySearch(response.data.properties);
          }
        }
      } else {
        throw new Error(response.message || 'Lỗi không xác định');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: Date.now() + 1,
        text: 'Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.',
        sender: 'bot',
        timestamp: new Date(),
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
      playErrorSound();
      
      // Scroll xuống tin nhắn lỗi
      setTimeout(() => {
        scrollToLatestMessage();
      }, 100);
    } finally {
      setIsLoading(false);
    }
  }, [guidedMode, sessionId, conversationState, setSessionId, setMessages, isLoading, onPropertySearch]);

  // Xử lý khi user click vào option
  const handleOptionClick = useCallback((option) => {
    // Xử lý cả trường hợp option là string hoặc object
    const optionText = typeof option === 'string' ? option : option.name || option.text || option._id || 'Tùy chọn';
    handleSendMessage(optionText);
  }, [handleSendMessage]);

  // Khởi tạo conversation khi mở chatbot
  const initializeConversation = async () => {
    if (guidedMessages.length === 0 && guidedMode) {
      try {
        // Gửi tin nhắn khởi tạo để bắt đầu guided conversation
        const response = await mcpChatbotAPI.sendGuidedMessage(
          '', 
          null, 
          null
        );
        if (response.success) {
          // Cập nhật session ID
          if (response.data.sessionId) {
            setGuidedSessionId(response.data.sessionId);
          }
          
          // Cập nhật conversation state
          if (response.data.conversationState) {
            setConversationState(response.data.conversationState);
            setCurrentStep(response.data.step || 'greeting');
          }
          
          const welcomeMessage = {
            id: Date.now(),
            text: response.data.message,
            sender: 'bot',
            timestamp: new Date(),
            step: response.data.step,
            options: response.data.options || [],
            placeholder: response.data.placeholder
          };
          
          setGuidedMessages([welcomeMessage]);
          setChatOptions(response.data.options || []);
          
          // Scroll xuống tin nhắn khởi tạo
          setTimeout(() => {
            scrollToLatestMessage();
          }, 200);
        } else {
          // Fallback message nếu API thất bại
          const welcomeMessage = {
            id: Date.now(),
            text: 'Chào bạn, Bạn muốn tìm kiếm ở khu vực nào?',
            sender: 'bot',
            timestamp: new Date(),
            step: 'greeting'
          };
          setGuidedMessages([welcomeMessage]);
          
          // Scroll xuống tin nhắn fallback
          setTimeout(() => {
            scrollToLatestMessage();
          }, 200);
        }
      } catch (error) {
        console.error('Initialize conversation error:', error);
        // Fallback message
        const welcomeMessage = {
          id: Date.now(),
          text: 'Chào bạn, Bạn muốn tìm kiếm ở khu vực nào?',
          sender: 'bot',
          timestamp: new Date(),
          step: 'greeting'
        };
        setGuidedMessages([welcomeMessage]);
        
        // Scroll xuống tin nhắn lỗi fallback
        setTimeout(() => {
          scrollToLatestMessage();
        }, 200);
      }
    }
  };

  // Refresh conversation function
  const refreshConversation = async () => {
    // Reset states for guided mode only
    setGuidedSessionId(null);
    setConversationState(null);
    setGuidedMessages([]);
    
    // Save updated state to storage immediately
    setTimeout(() => {
      saveConversationToStorage();
    }, 100);
    
    // Force refresh conversation immediately
    try {
      const response = await mcpChatbotAPI.sendGuidedMessage('', null, null);
      
      if (response.success) {
        if (response.data.sessionId) {
          setGuidedSessionId(response.data.sessionId);
        }
        
        if (response.data.conversationState) {
          setConversationState(response.data.conversationState);
          setCurrentStep(response.data.step || 'greeting');
        }
        
        const welcomeMessage = {
          id: Date.now(),
          text: response.data.message,
          sender: 'bot',
          timestamp: new Date(),
          step: response.data.step,
          options: response.data.options || [],
          placeholder: response.data.placeholder
        };
        
        setGuidedMessages([welcomeMessage]);
        setChatOptions(response.data.options || []);
        
        // Scroll xuống tin nhắn refresh
        setTimeout(() => {
          scrollToLatestMessage();
        }, 200);
      } else {
        // Fallback message
        const welcomeMessage = {
          id: Date.now(),
          text: 'Bạn muốn được giúp đỡ tìm kiếm về vấn đề nào?',
          sender: 'bot',
          timestamp: new Date(),
          step: 'greeting'
        };
        setGuidedMessages([welcomeMessage]);
        
        // Scroll xuống tin nhắn fallback
        setTimeout(() => {
          scrollToLatestMessage();
        }, 200);
      }
    } catch (error) {
      console.error('Refresh conversation error:', error);
      // Fallback message
      const welcomeMessage = {
        id: Date.now(),
        text: 'Bạn muốn được giúp đỡ tìm kiếm về vấn đề nào?',
        sender: 'bot',
        timestamp: new Date(),
        step: 'greeting'
      };
      setGuidedMessages([welcomeMessage]);
      
      // Scroll xuống tin nhắn lỗi fallback
      setTimeout(() => {
        scrollToLatestMessage();
      }, 200);
    }
  };

  return (
    <div className={`chatbot-container ${isChatbotOpen ? 'open' : ''}`}>
      {!isChatbotOpen ? (
        <>
          <button className="chatbot-toggle" onClick={toggleChatbot}>
            <FaRobot />
          </button>
          {showHint && (
            <div className="chatbot-ai-hint">
              <div className="hint-content">
                <FaLightbulb className="hint-icon" />
                <span>Tìm phòng trọ gần Đại học Công Nghiệp ở Thành phố Hồ Chí Minh, tiện ích: wifi, ban công, diện tích 22m2, giá dưới 3 triệu</span>
                <button className="chat-hint-close" onClick={handleCloseHint}>
                  <FaTimes />
                </button>
              </div>
              <button className="hint-try-btn" onClick={handleHintClick}>
                Thử ngay!
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <div className="header-info">
              <FaRobot className="chatbot-icon" />
              <span>AI Trợ lý tìm phòng</span>
            </div>
            <div className="chatbot-controls">
              {guidedMode && (
                <button 
                  className="refresh-chat-btn"
                  onClick={refreshConversation}
                  title="Làm mới cuộc trò chuyện"
                >
                  <FaRedo />
                </button>
              )}
              <button 
                className={`sound-toggle ${soundEnabled ? 'enabled' : 'disabled'}`}
                onClick={toggleSound}
                title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
              >
                {soundEnabled ? <FaVolumeUp /> : <FaVolumeMute />}
              </button>
              <button className="close-btn-chat" onClick={toggleChatbot}>
                <FaTimes />
              </button>
            </div>
          </div>
          
          <ChatMessages
            messages={messages}
            guidedMode={guidedMode}
            onOptionClick={handleOptionClick}
            isLoading={isLoading}
            navigate={navigate}
            formatPrice={formatPrice}
          />
          
          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            guidedMode={guidedMode}
            onModeChange={handleModeChange}
            onInitializeConversation={initializeConversation}
            guidedMessages={guidedMessages}
            hintMessage={hintMessage}
            onHintMessageUsed={() => setHintMessage('')}
          />
        </div>
      )}
    </div>
  );
};

export default ChatBot;
