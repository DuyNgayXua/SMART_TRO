import api from './api';

// Location API - Cập nhật cho cấu trúc mới (Province → Ward, loại bỏ District)
// Phù hợp với Property schema: province (String), provinceId (String), ward (String)
export const locationAPI = {
  // Lấy danh sách tỉnh/thành phố
  getProvinces: async () => {
    try {
      const response = await api.get('/locations/provinces');
      // console.log('Provinces response data:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching provinces:', error);
      throw error;
    }
  },

  // Lấy danh sách phường/xã theo tỉnh (cập nhật cho cấu trúc mới)
  getWards: async (provinceName) => {
    try {
      const response = await api.get(`/locations/provinces/${encodeURIComponent(provinceName)}/wards`);
      return response.data;
    } catch (error) {
      console.error('Error fetching wards:', error);
      throw error;
    }
  },

  // Lấy thông tin chi tiết địa chỉ (cập nhật cho cấu trúc mới)
  getAddressDetail: async (provinceId, wardName) => {
    try {
      const response = await api.get(`/locations/address-detail/${provinceId}/${encodeURIComponent(wardName)}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching address detail:', error);
      throw error;
    }
  },

  // Geocoding với address object (cập nhật cho cấu trúc mới)
  geocodeAddress: async (addressObject) => {
    try {
      const response = await api.post('/locations/geocode', { address: addressObject });
      console.log('Geocode locationAPI:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error geocoding address:', error);
      if (error.response?.status === 429) {
        throw new Error('Quá nhiều yêu cầu, vui lòng thử lại sau');
      }
      throw error;
    }
  },

  // Validate và chuẩn hóa dữ liệu location (mới)
  validateLocationData: async (provinceId, provinceName, wardName) => {
    try {
      const response = await api.post('/locations/validate', {
        provinceId,
        provinceName, 
        wardName
      });
      return response.data;
    } catch (error) {
      console.error('Error validating location data:', error);
      throw error;
    }
  }

};


