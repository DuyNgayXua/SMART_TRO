// Import tất cả các API services
import api from './api';
import { authAPI, apiUtils } from './api';
import roomsAPI from './roomsAPI';
import usersAPI from './usersAPI';
import bookingsAPI from './bookingsAPI';
import paymentsAPI from './paymentsAPI';
import reportsAPI from './reportsAPI';
import propertiesAPI from './propertiesAPI';
import amenitiesAPI from './amenitiesAPI';

// Export tất cả services để dễ dàng import
export {
  api,
  authAPI,
  apiUtils,
  roomsAPI,
  usersAPI,
  bookingsAPI,
  paymentsAPI,
  reportsAPI,
  amenitiesAPI,
  propertiesAPI
};

// Export default object chứa tất cả services
const apiServices = {
  api,
  auth: authAPI,
  utils: apiUtils,
  rooms: roomsAPI,
  users: usersAPI,
  bookings: bookingsAPI,
  payments: paymentsAPI,
  reports: reportsAPI,
  properties: propertiesAPI
};

export default apiServices;

// Helper function để kiểm tra kết nối API
export const checkAPIConnection = async () => {
  try {
    const response = await api.get('/health');
    return {
      status: 'connected',
      message: 'API connection successful',
      data: response.data
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'API connection failed',
      error: error.message
    };
  }
};

// Helper function để lấy thông tin API version
export const getAPIVersion = async () => {
  try {
    const response = await api.get('/version');
    return response.data;
  } catch (error) {
    console.error('Lỗi khi lấy version API:', error);
    return { version: 'unknown', error: error.message };
  }
};

// Helper function để lấy cấu hình API
export const getAPIConfig = () => {
  return {
    baseURL: api.defaults.baseURL,
    timeout: api.defaults.timeout,
    headers: api.defaults.headers
  };
};

// Types cho TypeScript (nếu sau này chuyển sang TS)
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
  LOGIN: '/users/login',
  REGISTER: '/users/register',
  LOGOUT: '/users/logout',
  PROFILE: '/users/profile',
  REFRESH_TOKEN: '/users/refresh-token',
  FORGOT_PASSWORD: '/users/forgot-password',
  RESET_PASSWORD: '/users/reset-password',
  VERIFY_EMAIL: '/users/verify-email'
  },
  
  // Rooms endpoints
  ROOMS: {
    BASE: '/rooms',
    SEARCH: '/rooms/search',
    STATISTICS: '/rooms/statistics',
    STATUS: '/rooms/status',
    IMAGES: '/rooms/:id/images',
    AMENITIES: '/rooms/amenities',
    REPORTS: '/rooms/reports'
  },
  
  // Users endpoints
  USERS: {
    BASE: '/users',
    SEARCH: '/users/search',
    ROLE: '/users/role',
    TENANTS: '/users/tenants',
    STATISTICS: '/users/statistics',
    EXPORT: '/users/export'
  },
  
  // Bookings endpoints
  BOOKINGS: {
    BASE: '/bookings',
    SEARCH: '/bookings/search',
    STATUS: '/bookings/status',
    AVAILABILITY: '/bookings/availability',
    STATISTICS: '/bookings/statistics',
    EXPORT: '/bookings/export'
  },
  
  // Payments endpoints
  PAYMENTS: {
    BASE: '/payments',
    SEARCH: '/payments/search',
    STATUS: '/payments/status',
    METHODS: '/payments/methods',
    STATISTICS: '/payments/statistics',
    REPORTS: '/payments/reports',
    EXPORT: '/payments/export'
  },
  
  // Reports endpoints
  REPORTS: {
    DASHBOARD: '/reports/dashboard',
    REVENUE: '/reports/revenue',
    ROOM_USAGE: '/reports/room-usage',
    CUSTOMERS: '/reports/customers',
    FINANCIAL: '/reports/financial',
    EXPORT: '/reports/export'
  }
};

// HTTP Status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500
};

// Common API response status
export const API_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
  LOADING: 'loading',
  IDLE: 'idle'
};
