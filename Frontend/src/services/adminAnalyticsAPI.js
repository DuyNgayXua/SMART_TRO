import { apiUtils } from './api';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const adminAnalyticsAPI = {
  // Lấy thống kê dashboard cho admin
  getDashboardStats: async (month, year) => {
    try {
      const params = new URLSearchParams();
      if (month) params.append('month', month);
      if (year) params.append('year', year);
      
      const response = await fetch(
        `${API_URL}/admin/analytics/dashboard-stats?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiUtils.getToken()}`
          }
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized');
        }
        throw new Error('Failed to fetch dashboard stats');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }
};

export default adminAnalyticsAPI;
