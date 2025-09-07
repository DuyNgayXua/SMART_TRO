import api from './api';

// API cho đăng tin mới
export const postAPI = {
  // Tạo tin đăng mới
  createPost: async (postData) => {
    const formData = new FormData();
    
    // Basic information
    formData.append('title', postData.title);
    formData.append('category', postData.category);
    formData.append('contactName', postData.contactName);
    formData.append('contactPhone', postData.contactPhone);
    formData.append('description', postData.description);
    
    // Pricing information
    formData.append('rentPrice', postData.rentPrice);
    if (postData.promotionPrice) formData.append('promotionPrice', postData.promotionPrice);
    if (postData.deposit) formData.append('deposit', postData.deposit);
    formData.append('area', postData.area);
    if (postData.electricPrice) formData.append('electricPrice', postData.electricPrice);
    if (postData.waterPrice) formData.append('waterPrice', postData.waterPrice);
    formData.append('maxOccupants', postData.maxOccupants);
    if (postData.availableDate) formData.append('availableDate', postData.availableDate);
    
    // Address information
    formData.append('province', postData.province);
    formData.append('district', postData.district);
    formData.append('ward', postData.ward);
    formData.append('detailAddress', postData.detailAddress);
    if (postData.coordinates) {
      formData.append('coordinates', JSON.stringify(postData.coordinates));
    }
    
    // Amenities and rules
    formData.append('amenities', JSON.stringify(postData.amenities));
    formData.append('fullAmenities', postData.fullAmenities);
    if (postData.timeRules) formData.append('timeRules', postData.timeRules);
    formData.append('houseRules', JSON.stringify(postData.houseRules));
    
    // Status
    formData.append('isForRent', postData.isForRent);
    
    // Media files
    if (postData.images && postData.images.length > 0) {
      postData.images.forEach((image, index) => {
        if (image && image.file) {
          formData.append('images', image.file);
        }
      });
    }
    
    if (postData.video && postData.video.file) {
      formData.append('video', postData.video.file);
    }
    
    const response = await api.post('/properties', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Lấy danh sách tin đăng của user
  getMyPosts: async (params = {}) => {
    const response = await api.get('/properties/my/properties', { params });
    return response.data;
  },

  // Cập nhật tin đăng
  updatePost: async (id, postData) => {
    const response = await api.put(`/properties/${id}`, postData);
    return response.data;
  },

  // Xóa tin đăng
  deletePost: async (id) => {
    const response = await api.delete(`/properties/${id}`);
    return response.data;
  },

  // Admin APIs - Duyệt bài
  
  // Lấy danh sách tin đăng chờ duyệt (Admin only)
  getPendingPosts: async (params = {}) => {
    const response = await api.get('/properties/admin/pending', { params });
    return response.data;
  },

  // Duyệt tin đăng (Admin only)
  approvePost: async (id, adminNote = '') => {
    const response = await api.put(`/properties/admin/approve/${id}`, {
      adminNote
    });
    return response.data;
  },

  // Từ chối tin đăng (Admin only)
  rejectPost: async (id, rejectionReason) => {
    const response = await api.put(`/properties/admin/reject/${id}`, {
      rejectionReason
    });
    return response.data;
  },

  // Lấy tất cả tin đăng (Admin only)
  getAllPosts: async (params = {}) => {
    const response = await api.get('/properties/admin/all', { params });
    return response.data;
  },

  // Thay đổi trạng thái featured (Admin only)
  toggleFeatured: async (id) => {
    const response = await api.put(`/properties/admin/featured/${id}`);
    return response.data;
  },

  // Upload hình ảnh
  uploadImages: async (images) => {
    const formData = new FormData();
    images.forEach((image, index) => {
      formData.append('images', image.file);
    });
    
    const response = await api.post('/upload/images', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Upload video
  uploadVideo: async (video) => {
    const formData = new FormData();
    formData.append('video', video.file);
    
    const response = await api.post('/upload/video', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }
};

// API cho xem và tìm kiếm properties
export const propertiesViewAPI = {


  // Get property by ID
  getPropertyById: async (id) => {
    try {
      const response = await api.get(`/properties/public/${id}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error getting property:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Lỗi khi tải thông tin tin đăng'
      };
    }
  },

  // Get featured properties
  getFeaturedProperties: async (limit = 8) => {
    try {
      const response = await api.get('/properties/featured', {
        params: { limit }
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error getting featured properties:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Lỗi khi tải tin đăng nổi bật'
      };
    }
  },

  // Get similar properties
  getSimilarProperties: async (propertyId, limit = 6) => {
    try {
      const response = await api.get(`/properties/${propertyId}/similar`, {
        params: { limit }
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error getting similar properties:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Lỗi khi tải tin đăng tương tự'
      };
    }
  },

  // Add to favorites
  addToFavorites: async (propertyId) => {
    try {
      const response = await api.post(`/properties/${propertyId}/favorite`);
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
      const response = await api.delete(`/properties/${propertyId}/favorite`);
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

  // View property (increase view count)
  viewProperty: async (propertyId) => {
    try {
      const response = await api.post(`/properties/${propertyId}/view`);
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
  }
};

export default postAPI;
