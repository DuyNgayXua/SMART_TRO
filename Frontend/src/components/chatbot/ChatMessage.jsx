import React, { memo } from 'react';
import { FaRobot } from 'react-icons/fa';
import PropertySlider from '../properties/PropertySlider';

const ChatMessage = memo(({ message, onOptionClick, isLoading, navigate, formatPrice }) => {
  return (
    <div className={`message ${message.sender}`}>
      {message.sender === 'bot' && <FaRobot className="bot-avatar" />}
      <div className="message-content">
        <p>{typeof message.text === 'string' ? message.text : JSON.stringify(message.text)}</p>
        
        {/* Hiển thị options cho guided conversation */}
        {message.sender === 'bot' && message.options && message.options.length > 0 && (
          <div className="chat-options">
            {message.options.map((option, index) => (
              <button
                key={index}
                className="chat-option-btn"
                onClick={() => onOptionClick(typeof option === 'string' ? option : option.name || option.text || option._id)}
                disabled={isLoading}
              >
                {typeof option === 'string' ? option : option.name || option.text || option._id || 'Tùy chọn'}
              </button>
            ))}
          </div>
        )}
        
        {/* Hiển thị properties nếu có */}
        {message.properties && message.properties.length > 0 && (
          <PropertySlider 
            properties={message.properties}
            onViewDetail={(propertyId) => navigate(`/properties/${propertyId}`)}
            formatPrice={formatPrice}
          />
        )}
        
        <span className="timestamp">
          {message.timestamp instanceof Date 
            ? message.timestamp.toLocaleTimeString('vi-VN', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })
            : new Date(message.timestamp).toLocaleTimeString('vi-VN', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })
          }
        </span>
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;
