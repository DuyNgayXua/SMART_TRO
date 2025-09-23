import React, { useState } from 'react';
import { FaUser } from 'react-icons/fa';

const Avatar = ({ 
  src, 
  alt, 
  size = 40, 
  className = '', 
  fallbackIcon = <FaUser />,
  onClick = null 
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Xử lý URL từ Google
  const processGoogleAvatarUrl = (url) => {
    if (!url) return null;
    
    if (url.includes('googleusercontent.com')) {
      // Đảm bảo có tham số size phù hợp
      return url.replace(/=s\d+-c$/, `=s${size * 2}-c`);
    }
    
    return url;
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const avatarStyle = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    overflow: 'hidden',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    border: '2px solid #ffffff',
    position: 'relative',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all 0.2s ease'
  };

  const imageStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '50%',
    transition: 'opacity 0.2s ease',
    opacity: imageLoaded ? 1 : 0
  };

  const iconStyle = {
    color: '#ffffff',
    fontSize: `${size * 0.45}px`,
    opacity: 0.9
  };

  return (
    <div 
      className={`user-avatar ${className}`} 
      style={avatarStyle}
      onClick={onClick}
      title={alt}
    >
      {src && !imageError ? (
        <>
          <img
            src={processGoogleAvatarUrl(src)}
            alt={alt}
            style={imageStyle}
            onError={handleImageError}
            onLoad={handleImageLoad}
            referrerPolicy="no-referrer"
            loading="lazy"
          />
          {!imageLoaded && (
            <div style={iconStyle}>
              {fallbackIcon}
            </div>
          )}
        </>
      ) : (
        <div style={iconStyle}>
          {fallbackIcon}
        </div>
      )}
    </div>
  );
};

export default Avatar;
