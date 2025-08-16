import React from 'react';

const FontTestComponent = () => {
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'Inter, sans-serif',
      border: '1px solid #e2e8f0',
      margin: '10px',
      borderRadius: '8px',
      backgroundColor: '#f8fafc'
    }}>
      <h2 style={{ fontWeight: 600, marginBottom: '16px' }}>Font Test - Inter</h2>
      
      <div style={{ marginBottom: '12px' }}>
        <strong>Tiếng Việt:</strong>
        <p style={{ margin: '4px 0', fontWeight: 400 }}>
          Đây là văn bản tiếng Việt với các dấu thanh: á à ả ã ạ, é è ẻ ẽ ệ, í ì ỉ ĩ ị
        </p>
        <p style={{ margin: '4px 0', fontWeight: 500 }}>
          Font weight 500: Quản lý hệ thống Smart Tro với giao diện hiện đại
        </p>
        <p style={{ margin: '4px 0', fontWeight: 600 }}>
          Font weight 600: Bảng điều khiển quản trị viên
        </p>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <strong>English:</strong>
        <p style={{ margin: '4px 0', fontWeight: 400 }}>
          This is English text: Dashboard, Settings, Room Management
        </p>
        <p style={{ margin: '4px 0', fontWeight: 500 }}>
          Font weight 500: Modern admin interface with clean typography
        </p>
        <p style={{ margin: '4px 0', fontWeight: 600 }}>
          Font weight 600: Administrator Control Panel
        </p>
      </div>

      <div style={{ fontSize: '12px', color: '#666', marginTop: '16px' }}>
        Current font stack: 'Inter', 'Segoe UI', 'Roboto', 'Noto Sans', sans-serif
      </div>
    </div>
  );
};

export default FontTestComponent;
