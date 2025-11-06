import React, { memo } from 'react';
import { FaRobot } from 'react-icons/fa';
import ChatMessage from './ChatMessage';

const ChatMessages = memo(({ messages, guidedMode, onOptionClick, isLoading, navigate, formatPrice }) => {
  return (
    <div className="chatbot-messages">
      {messages.length === 0 && !guidedMode && (
        <div className="welcome-message">
          <FaRobot className="bot-avatar" />
          <div className="message-content">
            <p>Xin chào! Tôi là AI trợ lý tìm phòng trọ. Hãy mô tả yêu cầu của bạn, ví dụ:</p>
            <ul>
              <li>"Tìm phòng trọ ở thành phố hồ chí minh, phường gò vấp, giá 4 triệu, view chill chill có tiện ích máy lạnh, diện tích 25m2"</li>
              <li>"Tìm phòng trọ ở thành phố hồ chí minh, phường an nhơn, view chill chill"</li>
            </ul>
          </div>
        </div>
      )}
      
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          onOptionClick={onOptionClick}
          isLoading={isLoading}
          navigate={navigate}
          formatPrice={formatPrice}
        />
      ))}
      
      {isLoading && (
        <div className="message bot">
          <FaRobot className="bot-avatar" />
          <div className="message-content">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ChatMessages.displayName = 'ChatMessages';

export default ChatMessages;
