import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class RentalAnalyticsAPI {
  // Get price trends by location and category
  static async getPriceTrends(locationParam = null) {
    try {
      const params = {};
      
      // Add location parameters if provided - backend expects province, ward, category, areaRange, amenities
      if (locationParam?.province) {
        params.province = locationParam.province;
      }
      if (locationParam?.ward) {
        params.ward = locationParam.ward;
      }
      if (locationParam?.category) {
        params.category = locationParam.category;
      }
      if (locationParam?.areaRange) {
        params.areaRange = locationParam.areaRange;
      }
      if (locationParam?.amenities && Array.isArray(locationParam.amenities) && locationParam.amenities.length > 0) {
        // Convert array to comma-separated string for URL query params
        params.amenities = locationParam.amenities.join(',');
        console.log('RentalAnalyticsAPI: Amenities being sent to backend:', params.amenities);
      }
      if (locationParam?.months) {
        params.months = locationParam.months;
      }
      
      console.log('RentalAnalyticsAPI: Final params object:', params);
      
      const response = await axios.get(`${API_BASE_URL}/analytics/price-trends`, {
        params
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching price trends:', error);
      throw error;
    }
  }

  // Get price ranges distribution
  static async getPriceRanges(locationParam = null) {
    try {
      const params = {};
      
      // Add location parameters if provided - backend expects province, ward, category, areaRange, amenities
      if (locationParam?.province) {
        params.province = locationParam.province;
      }
      if (locationParam?.ward) {
        params.ward = locationParam.ward;
      }
      if (locationParam?.category) {
        params.category = locationParam.category;
      }
      if (locationParam?.areaRange) {
        params.areaRange = locationParam.areaRange;
      }
      if (locationParam?.amenities && Array.isArray(locationParam.amenities) && locationParam.amenities.length > 0) {
        // Convert array to comma-separated string for URL query params
        params.amenities = locationParam.amenities.join(',');
      }
      
      const response = await axios.get(`${API_BASE_URL}/analytics/price-ranges`, {
        params
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching price ranges:', error);
      throw error;
    }
  }


  // Get news sentiment analysis (placeholder for Serp API integration)
  static async getNewsSentiment(keywords) {
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics/news-sentiment`, {
        params: { keywords }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching news sentiment:', error);
      throw error;
    }
  }

  // Get price summary for metric cards
  static async getPriceSummary(locationParam = null) {
    try {
      const params = {};
      
      // Add location parameters if provided - updated schema: province, ward, category, areaRange, amenities
      if (locationParam?.province) {
        params.province = locationParam.province;
      }
      if (locationParam?.ward) {
        params.ward = locationParam.ward;
      }
      if (locationParam?.category) {
        params.category = locationParam.category;
      }
      if (locationParam?.areaRange) {
        params.areaRange = locationParam.areaRange;
      }
      if (locationParam?.amenities && Array.isArray(locationParam.amenities) && locationParam.amenities.length > 0) {
        // Convert array to comma-separated string for URL query params
        params.amenities = locationParam.amenities.join(',');
      }
      
      const response = await axios.get(`${API_BASE_URL}/analytics/price-summary`, {
        params
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching price summary:', error);
      throw error;
    }
  }
}

export default RentalAnalyticsAPI;
