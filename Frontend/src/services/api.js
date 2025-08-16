import axios from 'axios';

// Cấu hình base URL cho API
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

// Tạo instance axios với cấu hình mặc định
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 seconds timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor để thêm token vào header
api.interceptors.request.use(
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

// Response interceptor để xử lý lỗi chung
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // Unauthorized - remove token and redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('userId');
          localStorage.removeItem('role');
          window.location.href = '/login';
          break;
          
        case 403:
          // Forbidden
          console.error('Bạn không có quyền truy cập tài nguyên này');
          break;
          
        case 404:
          console.error('Không tìm thấy tài nguyên');
          break;
          
        case 422:
          // Validation errors
          console.error('Dữ liệu không hợp lệ:', data.errors || data.message);
          break;
          
        case 500:
          console.error('Lỗi máy chủ nội bộ');
          break;
          
        default:
          console.error('Có lỗi xảy ra:', data.message || error.message);
      }
    } else if (error.request) {
      // Network error
      console.error('Lỗi kết nối mạng. Vui lòng kiểm tra kết nối internet của bạn.');
    } else {
      // Something else happened
      console.error('Có lỗi xảy ra:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Helper methods cho các HTTP methods thường dùng
export const apiMethods = {
  // GET request
  get: (url, config = {}) => api.get(url, config),
  
  // POST request
  post: (url, data = {}, config = {}) => api.post(url, data, config),
  
  // PUT request
  put: (url, data = {}, config = {}) => api.put(url, data, config),
  
  // PATCH request
  patch: (url, data = {}, config = {}) => api.patch(url, data, config),
  
  // DELETE request
  delete: (url, config = {}) => api.delete(url, config),
  
  // Upload file
  upload: (url, formData, onUploadProgress = null) => {
    return api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });
  },
  
  // Download file
  download: (url, filename = 'download') => {
    return api.get(url, {
      responseType: 'blob',
    }).then(response => {
      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    });
  }
};

// Auth helper methods
export const authAPI = {
  // Login
  login: (credentials) => api.post('/auth/login', credentials),
  
  // Register
  register: (userData) => api.post('/auth/register', userData),
  
  // Logout
  logout: () => api.post('/auth/logout'),
  
  // Get user profile
  getProfile: () => api.get('/auth/profile'),
  
  // Update profile
  updateProfile: (userData) => api.put('/auth/profile', userData),
  
  // Change password
  changePassword: (passwordData) => api.put('/auth/change-password', passwordData),
  
  // Forgot password
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  
  // Reset password
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, newPassword }),
  
  // Refresh token
  refreshToken: () => api.post('/auth/refresh-token'),
  
  // Verify email
  verifyEmail: (token) => api.post('/auth/verify-email', { token }),
};

// Utility functions
export const apiUtils = {
  // Check if user is authenticated
  isAuthenticated: () => {
    const token = localStorage.getItem('token');
    return !!token;
  },
  
  // Get current user role
  getUserRole: () => {
    return localStorage.getItem('role');
  },
  
  // Get current user ID
  getUserId: () => {
    return localStorage.getItem('userId');
  },
  
  // Set auth data
  setAuthData: (token, userId, role) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('role', role);
  },
  
  // Clear auth data
  clearAuthData: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
  },
  
  // Format error message
  formatErrorMessage: (error) => {
    if (error.response && error.response.data) {
      return error.response.data.message || 'Có lỗi xảy ra';
    }
    return error.message || 'Có lỗi xảy ra';
  }
};

export default api;
