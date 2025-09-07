import api from './api.js';

const searchPropertiesAPI = {
  // Tìm kiếm properties với các filter
  searchProperties: async (searchParams) => {
    try {
      console.log('Searching properties with params:', searchParams);

      // Build query string từ searchParams
      const params = new URLSearchParams();
      
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          if (key === 'amenities' && Array.isArray(value)) {
            if (value.length > 0) {
              params.set(key, value.join(','));
            }
          } else {
            params.set(key, value);
          }
        }
      });

      const response = await api.get(`/search-properties/properties?${params.toString()}`);
      console.log('Search response:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('Error searching properties:', error);
      throw error;
    }
  },

  // Lấy search suggestions (auto-complete)
  getSearchSuggestions: async (query) => {
    try {
      if (!query || query.trim().length < 2) {
        return { success: true, data: [] };
      }

      const response = await api.get(`/search-properties/suggestions`, {
        params: { q: query.trim() }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting search suggestions:', error);
      return { success: false, data: [] };
    }
  }
};

export default searchPropertiesAPI;
