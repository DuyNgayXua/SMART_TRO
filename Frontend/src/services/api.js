import axios from 'axios';

// Global logout handler
let globalLogoutHandler = null;

// Set global logout handler
export const setGlobalLogoutHandler = (handler) => {
  globalLogoutHandler = handler;
};

// Cấu hình base URL cho API
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

// Tạo instance axios với cấu hình mặc định
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000, // 45 seconds timeout cho upload
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor để thêm token vào header
api.interceptors.request.use(
  (config) => {
    const token = apiUtils.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Không set Content-Type khi gửi FormData (để axios tự động set)
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    // Debug: log minimal info (can comment out later)
    if (process.env.NODE_ENV !== 'production' && config.url?.includes('/rooms')) {
      // eslint-disable-next-line no-console
      console.log('[API][REQUEST]', config.method?.toUpperCase(), config.url, 'Auth:', !!token);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor để xử lý lỗi chung
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const originalRequest = error.config;
    if (error.response) {
      const { status, data } = error.response;
      const tokenPresent = !!apiUtils.getToken();
      switch (status) {
        case 401: {
          // Chỉ redirect nếu không có token hoặc lỗi từ endpoint users (login hết hạn) và không phải đang ở trang login
          const isLoginPage = window.location.pathname === '/login';
          const isVerifyEmailPage = window.location.pathname === '/verify-email';
          const sessionExpiredMessage = data?.message;
          
          // Kiểm tra xem có phải là endpoint cần authentication không
          const requiresAuth = originalRequest?.url && (
            originalRequest.url.includes('/users/') ||
            originalRequest.url.includes('/my-properties') ||
            originalRequest.url.includes('/properties') ||
            originalRequest.url.includes('/profile') ||
            originalRequest.url.includes('/admin') ||
            originalRequest.url.includes('/favorites') ||
            originalRequest.url.includes('/favorite')
          );
          
          console.log('401 Error Debug:', {
            url: originalRequest?.url,
            requiresAuth,
            tokenPresent,
            currentPath: window.location.pathname
            
          });
         
          
          // Kiểm tra xem có phải lỗi do session bị logout từ thiết bị khác
          if (sessionExpiredMessage && sessionExpiredMessage.includes('phiên đăng nhập')) {
            console.warn('Session đã bị đăng xuất từ thiết bị khác');
            if (!isLoginPage && !isVerifyEmailPage && globalLogoutHandler) {
              globalLogoutHandler();
              // Hiển thị thông báo cho user
              if (window.showLogoutNotification) {
                window.showLogoutNotification('Phiên đăng nhập của bạn đã bị đăng xuất từ thiết bị khác');
              }
              window.location.href = '/login?reason=session_logout';
            }
          } else if (!isLoginPage && !isVerifyEmailPage && requiresAuth && !tokenPresent) {
            // Chỉ redirect về login nếu là endpoint cần auth và không có token
            if (globalLogoutHandler) {
              globalLogoutHandler();
            } else {
              apiUtils.clearAuthData();
            }
            window.location.href = '/login';
          } else if (!isLoginPage && !isVerifyEmailPage && requiresAuth && tokenPresent) {
            // Token có nhưng không hợp lệ - redirect về login
            console.error('Phiên đăng nhập không hợp lệ hoặc hết hạn. Vui lòng đăng nhập lại.');
            if (globalLogoutHandler) {
              globalLogoutHandler();
            } else {
              apiUtils.clearAuthData();
            }
            window.location.href = '/login';
          }
          // Nếu không phải endpoint cần auth, chỉ log error mà không redirect
          break;
        }
        case 403:
          console.error('Bạn không có quyền truy cập tài nguyên này');
          break;
        case 404:
          console.error('Không tìm thấy tài nguyên');
          break;
        case 422:
          console.error('Dữ liệu không hợp lệ:', data.errors || data.message);
          break;
        case 500:
          console.error('Lỗi máy chủ nội bộ');
          break;
        default:
          console.error('Có lỗi xảy ra:', data?.message || error.message);
      }
    } else if (error.request) {
      console.error('Lỗi kết nối mạng. Vui lòng kiểm tra kết nối internet của bạn.');
    } else {
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
  login: (credentials) => api.post('/users/login', credentials),
  
  // Google Login
  googleLogin: (googleData) => api.post('/users/google-login', googleData),
  
  // Register
  register: (userData) => api.post('/users/register', userData),
  
  // Logout
  logout: () => api.post('/auth/logout'),
  
  // Get user profile
  getProfile: () => api.get('/users/profile'),
  
  // Update profile
  updateProfile: (userData) => api.put('/auth/profile', userData),
  
  // Change password
  changePassword: (passwordData) => api.put('/auth/change-password', passwordData),
  
  // === FORGOT PASSWORD FLOW (OTP qua email) ===
  // Gửi OTP qua email để quên mật khẩu
  sendOTP: (email) => api.post('/auth/send-otp', { email }),
  
  // Xác minh OTP cho quên mật khẩu
  verifyOTP: (email, otp) => api.post('/auth/verify-otp', { email, otp }),
  
  // Đặt lại mật khẩu với OTP (khi quên mật khẩu)
  resetPasswordWithOTP: (email, otp, newPassword) => api.post('/auth/reset-password', { email, otp, newPassword }),
  
  // === AUTHENTICATED PASSWORD RESET (dành cho user đã login) ===
  // Đổi mật khẩu khi đã đăng nhập (cần old password)
  changePasswordAuthenticated: (oldPassword, newPassword) => api.put('/users/change-password', { oldPassword, newPassword }),
  
  // === EMAIL VERIFICATION ===
  // Xác thực email với token
  verifyEmail: (token) => api.get(`/users/verify-email?token=${token}`),
  
  // Refresh token
  refreshToken: () => api.post('/auth/refresh-token'),
};

// Users API
export const usersAPI = {
  // Get user profile
  getProfile: () => api.get('/users/profile'),
  
  // Update user profile
  updateProfile: (formData) => api.put('/users/profile', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  
  // Change password (authenticated user)
  changePassword: (data) => api.put('/users/change-password', data),
  
  // Session Management
  getActiveSessions: () => api.get('/users/sessions/active'),
  getLoginHistory: (limit = 20) => api.get(`/users/sessions/history?limit=${limit}`),
  logoutSession: (sessionId) => api.delete(`/users/sessions/${sessionId}`),
  logoutAllOtherSessions: () => api.post('/users/sessions/logout-others'),
  
  // Get all users (admin only)
  getAllUsers: (params) => api.get('/users', { params }),
  
  // Get user by ID (admin only)
  getUserById: (id) => api.get(`/users/${id}`),
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
  
  // Set auth data - luôn lưu token vào localStorage
  setAuthData: (token, userId, role, sessionToken = null, user = null) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('role', role);
    if (sessionToken) {
      localStorage.setItem('sessionToken', sessionToken);
    }
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
  },
  
  // Clear auth data
  clearAuthData: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('user');
  },
  
  // Get token from storage
  getToken: () => {
    return localStorage.getItem('token');
  },

  // Remember login functions
  saveRememberedLogin: (email, password) => {
    localStorage.setItem('rememberedEmail', email);
    localStorage.setItem('rememberedPassword', password);
  },

  getRememberedLogin: () => {
    return {
      email: localStorage.getItem('rememberedEmail') || '',
      password: localStorage.getItem('rememberedPassword') || ''
    };
  },

  clearRememberedLogin: () => {
    localStorage.removeItem('rememberedEmail');
    localStorage.removeItem('rememberedPassword');
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
