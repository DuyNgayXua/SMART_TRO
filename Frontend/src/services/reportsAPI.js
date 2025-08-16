import api from './api';

// API service cho quản lý báo cáo và thống kê
export const reportsAPI = {
  // Lấy tổng quan dashboard
  getDashboardOverview: async (period = 'month') => {
    try {
      const response = await api.get('/reports/dashboard', { params: { period } });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy tổng quan dashboard:', error);
      throw error;
    }
  },

  // Báo cáo doanh thu
  getRevenueReport: async (startDate, endDate, groupBy = 'day') => {
    try {
      const response = await api.get('/reports/revenue', {
        params: { startDate, endDate, groupBy }
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy báo cáo doanh thu:', error);
      throw error;
    }
  },

  // Báo cáo sử dụng phòng
  getRoomUsageReport: async (startDate, endDate) => {
    try {
      const response = await api.get('/reports/room-usage', {
        params: { startDate, endDate }
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy báo cáo sử dụng phòng:', error);
      throw error;
    }
  },

  // Báo cáo khách hàng
  getCustomerReport: async (startDate, endDate) => {
    try {
      const response = await api.get('/reports/customers', {
        params: { startDate, endDate }
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy báo cáo khách hàng:', error);
      throw error;
    }
  },

  // Báo cáo tài chính
  getFinancialReport: async (startDate, endDate) => {
    try {
      const response = await api.get('/reports/financial', {
        params: { startDate, endDate }
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy báo cáo tài chính:', error);
      throw error;
    }
  },

  // Báo cáo hiệu suất kinh doanh
  getBusinessPerformanceReport: async (period = 'month') => {
    try {
      const response = await api.get('/reports/business-performance', {
        params: { period }
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy báo cáo hiệu suất:', error);
      throw error;
    }
  },

  // Thống kê theo tháng
  getMonthlyStatistics: async (year, month) => {
    try {
      const response = await api.get('/reports/monthly-stats', {
        params: { year, month }
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy thống kê tháng:', error);
      throw error;
    }
  },

  // Thống kê theo năm
  getYearlyStatistics: async (year) => {
    try {
      const response = await api.get('/reports/yearly-stats', {
        params: { year }
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy thống kê năm:', error);
      throw error;
    }
  },

  // Báo cáo tỷ lệ lấp đầy
  getOccupancyReport: async (startDate, endDate) => {
    try {
      const response = await api.get('/reports/occupancy', {
        params: { startDate, endDate }
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy báo cáo tỷ lệ lấp đầy:', error);
      throw error;
    }
  },

  // Báo cáo phòng trống
  getVacantRoomsReport: async () => {
    try {
      const response = await api.get('/reports/vacant-rooms');
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy báo cáo phòng trống:', error);
      throw error;
    }
  },

  // Báo cáo phòng sắp hết hạn
  getExpiringRoomsReport: async (days = 30) => {
    try {
      const response = await api.get('/reports/expiring-rooms', {
        params: { days }
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy báo cáo phòng sắp hết hạn:', error);
      throw error;
    }
  },

  // Báo cáo nợ xấu
  getBadDebtReport: async (startDate, endDate) => {
    try {
      const response = await api.get('/reports/bad-debt', {
        params: { startDate, endDate }
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy báo cáo nợ xấu:', error);
      throw error;
    }
  },

  // Báo cáo thanh toán chậm
  getLatePaymentReport: async () => {
    try {
      const response = await api.get('/reports/late-payments');
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy báo cáo thanh toán chậm:', error);
      throw error;
    }
  },

  // Báo cáo top khách hàng
  getTopCustomersReport: async (period = 'month', limit = 10) => {
    try {
      const response = await api.get('/reports/top-customers', {
        params: { period, limit }
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy báo cáo top khách hàng:', error);
      throw error;
    }
  },

  // Báo cáo phòng được ưa chuộng nhất
  getPopularRoomsReport: async (period = 'month') => {
    try {
      const response = await api.get('/reports/popular-rooms', {
        params: { period }
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy báo cáo phòng phổ biến:', error);
      throw error;
    }
  },

  // Báo cáo xu hướng giá
  getPriceTrendReport: async (startDate, endDate) => {
    try {
      const response = await api.get('/reports/price-trend', {
        params: { startDate, endDate }
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy báo cáo xu hướng giá:', error);
      throw error;
    }
  },

  // Xuất báo cáo tổng hợp ra PDF
  exportComprehensiveReportToPDF: async (startDate, endDate) => {
    try {
      const response = await api.get('/reports/export/comprehensive', {
        params: { startDate, endDate },
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `comprehensive_report_${startDate}_${endDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('Lỗi khi xuất báo cáo PDF:', error);
      throw error;
    }
  },

  // Xuất dữ liệu báo cáo ra Excel
  exportReportToExcel: async (reportType, params = {}) => {
    try {
      const response = await api.get(`/reports/export/${reportType}`, {
        params,
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('Lỗi khi xuất Excel:', error);
      throw error;
    }
  },

  // Lên lịch gửi báo cáo tự động
  scheduleReport: async (scheduleData) => {
    try {
      const response = await api.post('/reports/schedule', scheduleData);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lên lịch báo cáo:', error);
      throw error;
    }
  },

  // Hủy lịch báo cáo tự động
  cancelScheduledReport: async (scheduleId) => {
    try {
      const response = await api.delete(`/reports/schedule/${scheduleId}`);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi hủy lịch báo cáo:', error);
      throw error;
    }
  }
};

export default reportsAPI;
