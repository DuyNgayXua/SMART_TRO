import { useCallback } from 'react';

export const useToast = () => {
  const showToast = useCallback((type, message) => {
    // Tạo toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">
          ${type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warning' ? '⚠' : 'ℹ'}
        </span>
        <span class="toast-message">${message}</span>
      </div>
    `;

    // Thêm styles nếu chưa có
    if (!document.getElementById('toast-styles')) {
      const styles = document.createElement('style');
      styles.id = 'toast-styles';
      styles.textContent = `
        .toast {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 12px 20px;
          border-radius: 8px;
          color: white;
          font-weight: 500;
          z-index: 10000;
          min-width: 300px;
          animation: slideIn 0.3s ease-out;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .toast-success { background-color: #10b981; }
        .toast-error { background-color: #ef4444; }
        .toast-warning { background-color: #f59e0b; }
        .toast-info { background-color: #3b82f6; }
        
        .toast-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .toast-icon {
          font-size: 16px;
          font-weight: bold;
        }
        
        .toast-message {
          flex: 1;
        }
        
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(styles);
    }

    // Thêm vào DOM
    document.body.appendChild(toast);

    // Tự động xóa sau 4 giây
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 4000);

    // Cho phép click để đóng
    toast.addEventListener('click', () => {
      toast.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    });
  }, []);

  return { showToast };
};