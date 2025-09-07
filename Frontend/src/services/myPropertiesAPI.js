import api from './api';

export const myPropertiesAPI = {
  // Lấy danh sách tin đăng của user
  getMyProperties: async (params = {}) => {
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

  // Cập nhật tin đăng
  updateProperty: async (propertyId, formData) => {
    try {
      // Kiểm tra xem formData có phải là FormData không
      const isFormData = formData instanceof FormData;
      
      const response = await api.put(`/my-properties/${propertyId}`, formData, {
        headers: {
          'Content-Type': isFormData ? 'multipart/form-data' : 'application/json',
        },
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
  }
};