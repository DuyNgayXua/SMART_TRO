import api from './api';

const amenitiesAPI = {
  // Get all amenities with filtering and pagination
  getAmenities: async (params = {}) => {
    try {
      const response = await api.get('/amenities', { params });
      return response.data;
    } catch (error) {
      console.error('Get amenities error:', error);
      throw error;
    }
  },

  // Get active amenities for dropdown/selection
  getActiveAmenities: async () => {
    try {
      const response = await api.get('/amenities/active');
      return response.data;
    } catch (error) {
      console.error('Get active amenities error:', error);
      throw error;
    }
  },

  // Get amenity by ID
  getAmenityById: async (id) => {
    try {
      const response = await api.get(`/amenities/${id}`);
      return response.data;
    } catch (error) {
      console.error('Get amenity by ID error:', error);
      throw error;
    }
  },

  // Create new amenity
  createAmenity: async (amenityData) => {
    try {
      const response = await api.post('/amenities', amenityData);
      return response.data;
    } catch (error) {
      console.error('Create amenity error:', error);
      throw error;
    }
  },

  // Update amenity
  updateAmenity: async (id, amenityData) => {
    try {
      const response = await api.put(`/amenities/${id}`, amenityData);
      return response.data;
    } catch (error) {
      console.error('Update amenity error:', error);
      throw error;
    }
  },

  // Delete amenity
  deleteAmenity: async (id) => {
    try {
      const response = await api.delete(`/amenities/${id}`);
      return response.data;
    } catch (error) {
      console.error('Delete amenity error:', error);
      throw error;
    }
  },

  // Get amenity categories
  getCategories: async () => {
    try {
      const response = await api.get('/amenities/categories');
      return response.data;
    } catch (error) {
      console.error('Get categories error:', error);
      throw error;
    }
  },

  // Update display order
  updateDisplayOrder: async (orderUpdates) => {
    try {
      const response = await api.put('/amenities/order/update', { orderUpdates });
      return response.data;
    } catch (error) {
      console.error('Update display order error:', error);
      throw error;
    }
  },

  // Check if key exists
  checkKey: async (key, excludeId = null) => {
    try {
      const params = { key };
      if (excludeId) {
        params.excludeId = excludeId;
      }
      const response = await api.get('/amenities/check-key', { params });
      return response.data;
    } catch (error) {
      console.error('Check key error:', error);
      throw error;
    }
  }
};

export default amenitiesAPI;
