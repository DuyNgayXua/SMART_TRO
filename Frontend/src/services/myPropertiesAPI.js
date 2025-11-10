import api from './api';

export const myPropertiesAPI = {
  // Lấy danh sách tin đăng của user
  getMyProperties: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams({
        page: params.page || 1,
        limit: params.limit || 10,
        approvalStatus: params.approvalStatus || 'all',
        sortBy: params.sortBy || 'createdAt',
        sortOrder: params.sortOrder || 'desc'
      });

      // Thêm search nếu có
      if (params.search && params.search.trim()) {
        queryParams.append('search', params.search.trim());
      }

      const response = await api.get(`/my-properties?${queryParams}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching my properties:', error);
      throw error;
    }
  },
  getMyApprovedProperties: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams({
        page: params.page || 1,
        limit: params.limit || 10,
         status: params.status || 'all',
        sortBy: params.sortBy || 'createdAt',
        sortOrder: params.sortOrder || 'desc'
      });
        // Thêm search nếu có
      if (params.search && params.search.trim()) {
        queryParams.append('search', params.search.trim());
      }
      const response = await api.get(`/my-properties/approved?${queryParams}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching my approved properties:', error);
      throw error;
    }
  },
   getMyApprovedPropertiesLocation: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams({
        page: params.page || 1,
        limit: params.limit || 10,
         status: params.status || 'all',
        sortBy: params.sortBy || 'createdAt',
        sortOrder: params.sortOrder || 'desc',
        district: params.district || '',
        ward: params.ward || ''
      });
        // Thêm search nếu có
      if (params.search && params.search.trim()) {
        queryParams.append('search', params.search.trim());
      }
      const response = await api.get(`/my-properties/approved-location?${queryParams}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching my approved location properties:', error);
      throw error;
    }
  },

  // Lấy thống kê tin đăng của user
  getMyPropertiesStats: async () => {
    try {
      const response = await api.get('/my-properties/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching my properties stats:', error);
      throw error;
    }
  },

  // Lấy thông tin tin đăng để edit
  getPropertyForEdit: async (propertyId) => {
    try {
      const response = await api.get(`/my-properties/${propertyId}/edit`);
      return response.data;
    } catch (error) {
      console.error('Error fetching property for edit:', error);
      throw error;
    }
  },

  // Lấy thông tin chi tiết một property (cho việc cập nhật real-time)
  getProperty: async (propertyId) => {
    try {
      const response = await api.get(`/my-properties/notification/${propertyId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching property details:', error);
      throw error;
    }
  },

  // Cập nhật tin đăng
  updateProperty: async (propertyId, formData) => {
    try {
      // Kiểm tra xem formData có phải là FormData không
      const isFormData = formData instanceof FormData;
      
      const response = await api.put(`/my-properties/${propertyId}`, formData, {
        headers: {
          'Content-Type': isFormData ? 'multipart/form-data' : 'application/json',
        },
        timeout: 180000, // 3 phút cho AI moderation + upload.
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log(`Upload Progress: ${percentCompleted}%`);
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error updating property:', error);
      throw error;
    }
  },

  // Xóa tin đăng (soft delete)
  deleteProperty: async (propertyId) => {
    try {
      const response = await api.delete(`/my-properties/${propertyId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting property:', error);
      throw error;
    }
  },

  // Thay đổi trạng thái tin đăng (ẩn/hiện)
  togglePropertyStatus: async (propertyId) => {
    try {
      const response = await api.patch(`/my-properties/${propertyId}/toggle-status`);
      return response.data;
    } catch (error) {
      console.error('Error toggling property status:', error);
      throw error;
    }
  },

  // Đưa tin đăng lên đầu trang
  promotePropertyToTop: async (propertyId) => {
    try {
      const response = await api.patch(`/my-properties/${propertyId}/promote-to-top`);
      return response.data;
    } catch (error) {
      console.error('Error promoting property to top:', error);
      throw error;
    }
  },

  // View property (increase view count)
  viewProperty: async (propertyId) => {
    try {
      const response = await api.post(`/my-properties/${propertyId}/view`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      // Silent fail for view tracking
      console.error('Error tracking view:', error);
      return {
        success: false
      };
    }
  },

  // Add to favorites
  addToFavorites: async (propertyId) => {
    try {
      const response = await api.post(`/my-properties/${propertyId}/favorite`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error adding to favorites:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Lỗi khi thêm vào yêu thích'
      };
    }
  },

  // Remove from favorites
  removeFromFavorites: async (propertyId) => {
    try {
      const response = await api.delete(`/my-properties/${propertyId}/favorite`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error removing from favorites:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Lỗi khi xóa khỏi yêu thích'
      };
    }
  },

  // Get favorites list
  getFavorites: async () => {
    try {
      const response = await api.get('/my-properties/favorites');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error getting favorites:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Lỗi khi lấy danh sách yêu thích'
      };
    }
  },

  // Hủy gói tin đăng
  cancelPropertyPackage: async (propertyId) => {
    try {
      const response = await api.patch(`/my-properties/${propertyId}/cancel-package`);
      return response.data;
    } catch (error) {
      console.error('Error canceling property package:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Lỗi khi hủy gói tin'
      };
    }
  },

  // Lấy thông tin gói hiện tại của user
  getCurrentUserPackage: async () => {
    try {
      const response = await api.get('/my-properties/current-package');
      return response.data;
    } catch (error) {
      console.error('Error getting current user package:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Lỗi khi lấy thông tin gói hiện tại'
      };
    }
  },

  // Lấy danh sách gói có sẵn để nâng cấp
  getAvailablePackages: async () => {
    try {
      const response = await api.get('/package-plans');
      return response.data;
    } catch (error) {
      console.error('Error getting available packages:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Lỗi khi lấy danh sách gói tin'
      };
    }
  },
};