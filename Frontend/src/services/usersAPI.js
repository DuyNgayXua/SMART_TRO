import api from './api';

// API service cho quản lý người dùng
export const usersAPI = {
  // Lấy danh sách tất cả người dùng
  getAllUsers: async (params = {}) => {
    try {
      const response = await api.get('/users', { params });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy danh sách người dùng:', error);
      throw error;
    }
  },

  // Lấy thông tin chi tiết một người dùng
  getUserById: async (id) => {
    try {
      const response = await api.get(`/users/${id}`);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy thông tin người dùng:', error);
      throw error;
    }
  },

  // Tạo người dùng mới
  createUser: async (userData) => {
    try {
      const response = await api.post('/users', userData);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi tạo người dùng mới:', error);
      throw error;
    }
  },

  // Cập nhật thông tin người dùng
  updateUser: async (id, userData) => {
    try {
      const response = await api.put(`/users/${id}`, userData);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi cập nhật người dùng:', error);
      throw error;
    }
  },

  // Xóa người dùng
  deleteUser: async (id) => {
    try {
      const response = await api.delete(`/users/${id}`);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi xóa người dùng:', error);
      throw error;
    }
  },

  // Tìm kiếm người dùng
  searchUsers: async (searchParams) => {
    try {
      const response = await api.get('/users/search', { params: searchParams });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi tìm kiếm người dùng:', error);
      throw error;
    }
  },

  // Lấy người dùng theo vai trò
  getUsersByRole: async (role, params = {}) => {
    try {
      const response = await api.get(`/users/role/${role}`, { params });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy người dùng theo vai trò:', error);
      throw error;
    }
  },

  // Cập nhật vai trò người dùng
  updateUserRole: async (id, role) => {
    try {
      const response = await api.patch(`/users/${id}/role`, { role });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi cập nhật vai trò:', error);
      throw error;
    }
  },

  // Cập nhật trạng thái người dùng (active/inactive)
  updateUserStatus: async (id, status) => {
    try {
      const response = await api.patch(`/users/${id}/status`, { status });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi cập nhật trạng thái người dùng:', error);
      throw error;
    }
  },

  // Upload avatar người dùng
  uploadUserAvatar: async (userId, avatar, onUploadProgress = null) => {
    try {
      const formData = new FormData();
      formData.append('avatar', avatar);
      
      const response = await api.post(`/users/${userId}/avatar`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress,
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi upload avatar:', error);
      throw error;
    }
  },

  // Xóa avatar người dùng
  deleteUserAvatar: async (userId) => {
    try {
      const response = await api.delete(`/users/${userId}/avatar`);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi xóa avatar:', error);
      throw error;
    }
  },

  // Lấy lịch sử hoạt động của người dùng
  getUserActivityHistory: async (userId, params = {}) => {
    try {
      const response = await api.get(`/users/${userId}/activity`, { params });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy lịch sử hoạt động:', error);
      throw error;
    }
  },

  // Đặt lại mật khẩu cho người dùng (admin)
  resetUserPassword: async (userId, newPassword) => {
    try {
      const response = await api.post(`/users/${userId}/reset-password`, { newPassword });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi đặt lại mật khẩu:', error);
      throw error;
    }
  },

  // Khóa/mở khóa tài khoản người dùng
  toggleUserLock: async (userId, lockStatus) => {
    try {
      const response = await api.patch(`/users/${userId}/lock`, { lockStatus });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi khóa/mở khóa tài khoản:', error);
      throw error;
    }
  },

  // Lấy thống kê người dùng
  getUserStatistics: async (period = 'month') => {
    try {
      const response = await api.get('/users/statistics', { params: { period } });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy thống kê người dùng:', error);
      throw error;
    }
  },

  // Gửi thông báo đến người dùng
  sendNotificationToUser: async (userId, notification) => {
    try {
      const response = await api.post(`/users/${userId}/notifications`, notification);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi gửi thông báo:', error);
      throw error;
    }
  },

  // Lấy danh sách thông báo của người dùng
  getUserNotifications: async (userId, params = {}) => {
    try {
      const response = await api.get(`/users/${userId}/notifications`, { params });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy thông báo:', error);
      throw error;
    }
  },

  // Đánh dấu thông báo đã đọc
  markNotificationAsRead: async (userId, notificationId) => {
    try {
      const response = await api.patch(`/users/${userId}/notifications/${notificationId}/read`);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi đánh dấu thông báo đã đọc:', error);
      throw error;
    }
  },

  // Lấy danh sách khách thuê
  getTenants: async (params = {}) => {
    try {
      const response = await api.get('/users/tenants', { params });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy danh sách khách thuê:', error);
      throw error;
    }
  },

  // Lấy thông tin thuê phòng của người dùng
  getUserRentals: async (userId, params = {}) => {
    try {
      const response = await api.get(`/users/${userId}/rentals`, { params });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy thông tin thuê phòng:', error);
      throw error;
    }
  },

  // Xuất danh sách người dùng ra Excel
  exportUsersToExcel: async (params = {}) => {
    try {
      const response = await api.get('/users/export/excel', {
        params,
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('Lỗi khi xuất Excel:', error);
      throw error;
    }
  }
};

export default usersAPI;
