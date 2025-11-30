const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const userPackageAPI = {
  // Lấy thông tin gói hiện tại của user
  getCurrentPackage: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/my-properties/current-package`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting current package:', error);
      throw error;
    }
  },

  // Lấy danh sách các loại tin có thể đăng từ gói hiện tại
  getAvailablePostTypes: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/my-properties/available-post-types`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting available post types:', error);
      throw error;
    }
  },

  // Kiểm tra có thể đăng loại tin cụ thể không
  canPostType: async (postTypeId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/my-properties/can-post-type/${postTypeId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error checking post type availability:', error);
      throw error;
    }
  },

  // Lấy danh sách gói khuyến nghị để nâng cấp
  getRecommendedPackages: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/my-properties/recommended-packages`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting recommended packages:', error);
      throw error;
    }
  }
};

export default userPackageAPI;
