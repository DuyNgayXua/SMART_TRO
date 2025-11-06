import React, { useRef, useEffect, useCallback, useMemo, memo, useState } from 'react';
import { FaPaperPlane } from 'react-icons/fa';

const ChatInput = memo(({ 
  onSendMessage, 
  isLoading, 
  guidedMode,
  onModeChange,
  onInitializeConversation,
  guidedMessages,
  hintMessage,
  onHintMessageUsed
}) => {
  const textareaRef = useRef(null);
  const [inputMessage, setInputMessage] = useState('');

  // Function to auto-resize textarea with debouncing
  const autoResizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Lưu current scroll position
    const scrollTop = textarea.scrollTop;
    
    // Reset height để tính toán scrollHeight chính xác
    textarea.style.height = 'auto';
    
    // Tính toán height dựa trên scrollHeight
    const scrollHeight = textarea.scrollHeight;
    const minHeight = window.innerWidth <= 480 ? 36 : 40; // Responsive min height
    const maxHeight = window.innerWidth <= 480 ? 100 : 120; // Responsive max height
    
    // Set height trong khoảng min-max
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;
    
    // Restore scroll position nếu cần
    textarea.scrollTop = scrollTop;
    
    // Quản lý overflow
    if (scrollHeight > maxHeight) {
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.overflowY = 'hidden';
    }
  }, []);

  // Debounced resize function
  const debouncedAutoResize = useMemo(() => {
    let timeoutId;
    return () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(autoResizeTextarea, 10);
    };
  }, [autoResizeTextarea]);

  // Auto-resize textarea when inputMessage changes (debounced)
  useEffect(() => {
    if (textareaRef.current) {
      debouncedAutoResize();
    }
  }, [inputMessage, debouncedAutoResize]);

  // Handle hint message from parent
  useEffect(() => {
    if (hintMessage) {
      setInputMessage(hintMessage);
      onHintMessageUsed();
    }
  }, [hintMessage, onHintMessageUsed]);

  // Handle input change (now local only)
  const handleInputChange = useCallback((e) => {
    setInputMessage(e.target.value);
  }, []);

  // Handle input event for auto-resize
  const handleInput = useCallback(() => {
    debouncedAutoResize();
  }, [debouncedAutoResize]);

  // Handle send button click
  const handleSendClick = useCallback(() => {
    if (inputMessage.trim() && !isLoading) {
      onSendMessage(inputMessage.trim());
      setInputMessage('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [inputMessage, isLoading, onSendMessage]);

  // Handle Enter key press
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  }, [handleSendClick]);

  // Handle mode change
  const handleGuidedModeClick = useCallback(() => {
    if (!guidedMode) {
      onModeChange(true);
      // Nếu chưa có guided messages, khởi tạo conversation
      if (guidedMessages.length === 0) {
        setTimeout(() => {
          onInitializeConversation();
        }, 100);
      }
    }
  }, [guidedMode, onModeChange, guidedMessages.length, onInitializeConversation]);

  const handleFreeModeClick = useCallback(() => {
    if (guidedMode) {
      onModeChange(false);
    }
  }, [guidedMode, onModeChange]);

  return (
    <div className="chatbot-input">
      {/* Mode toggle */}
      <div className="chat-mode-toggle">
        <button
          className={`mode-btn ${guidedMode ? 'active' : ''}`}
          onClick={handleGuidedModeClick}
        >
          Hướng dẫn
        </button>
        <button
          className={`mode-btn ${!guidedMode ? 'active' : ''}`}
          onClick={handleFreeModeClick}
        >
          Tự do
        </button>
      </div>
      
      <div className="input-wrapper">
        <textarea
          ref={textareaRef}
          value={inputMessage}
          onChange={handleInputChange}
          onInput={handleInput}
          onKeyPress={handleKeyPress}
          placeholder={guidedMode ? 
            "Nhập câu trả lời của bạn..." : 
            "Nhập yêu cầu tìm kiếm của bạn..."
          }
          disabled={isLoading}
          rows={1}
        />
        <button 
          className="send-btn" 
          onClick={handleSendClick}
          disabled={!inputMessage.trim() || isLoading}
        >
          <FaPaperPlane />
        </button>
      </div>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;
