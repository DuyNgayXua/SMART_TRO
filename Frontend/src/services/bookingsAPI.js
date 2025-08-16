import api from './api';

// API service cho quản lý đặt phòng
export const bookingsAPI = {
  // Lấy danh sách tất cả đặt phòng
  getAllBookings: async (params = {}) => {
    try {
      const response = await api.get('/bookings', { params });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy danh sách đặt phòng:', error);
      throw error;
    }
  },

  // Lấy thông tin chi tiết một đặt phòng
  getBookingById: async (id) => {
    try {
      const response = await api.get(`/bookings/${id}`);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy thông tin đặt phòng:', error);
      throw error;
    }
  },

  // Tạo đặt phòng mới
  createBooking: async (bookingData) => {
    try {
      const response = await api.post('/bookings', bookingData);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi tạo đặt phòng mới:', error);
      throw error;
    }
  },

  // Cập nhật thông tin đặt phòng
  updateBooking: async (id, bookingData) => {
    try {
      const response = await api.put(`/bookings/${id}`, bookingData);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi cập nhật đặt phòng:', error);
      throw error;
    }
  },

  // Hủy đặt phòng
  cancelBooking: async (id, reason = '') => {
    try {
      const response = await api.patch(`/bookings/${id}/cancel`, { reason });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi hủy đặt phòng:', error);
      throw error;
    }
  },

  // Xác nhận đặt phòng
  confirmBooking: async (id) => {
    try {
      const response = await api.patch(`/bookings/${id}/confirm`);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi xác nhận đặt phòng:', error);
      throw error;
    }
  },

  // Hoàn thành đặt phòng (check-in)
  completeBooking: async (id, checkInData) => {
    try {
      const response = await api.patch(`/bookings/${id}/complete`, checkInData);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi hoàn thành đặt phòng:', error);
      throw error;
    }
  },

  // Lấy đặt phòng theo trạng thái
  getBookingsByStatus: async (status, params = {}) => {
    try {
      const response = await api.get(`/bookings/status/${status}`, { params });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy đặt phòng theo trạng thái:', error);
      throw error;
    }
  },

  // Lấy đặt phòng theo người dùng
  getBookingsByUser: async (userId, params = {}) => {
    try {
      const response = await api.get(`/bookings/user/${userId}`, { params });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy đặt phòng theo người dùng:', error);
      throw error;
    }
  },

  // Lấy đặt phòng theo phòng
  getBookingsByRoom: async (roomId, params = {}) => {
    try {
      const response = await api.get(`/bookings/room/${roomId}`, { params });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy đặt phòng theo phòng:', error);
      throw error;
    }
  },

  // Tìm kiếm đặt phòng
  searchBookings: async (searchParams) => {
    try {
      const response = await api.get('/bookings/search', { params: searchParams });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi tìm kiếm đặt phòng:', error);
      throw error;
    }
  },

  // Kiểm tra phòng có sẵn
  checkRoomAvailability: async (roomId, startDate, endDate) => {
    try {
      const response = await api.get(`/bookings/availability/${roomId}`, {
        params: { startDate, endDate }
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi kiểm tra phòng có sẵn:', error);
      throw error;
    }
  },

  // Lấy thống kê đặt phòng
  getBookingStatistics: async (period = 'month') => {
    try {
      const response = await api.get('/bookings/statistics', { params: { period } });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy thống kê đặt phòng:', error);
      throw error;
    }
  },

  // Gửi email xác nhận đặt phòng
  sendBookingConfirmationEmail: async (bookingId) => {
    try {
      const response = await api.post(`/bookings/${bookingId}/send-confirmation`);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi gửi email xác nhận:', error);
      throw error;
    }
  },

  // Gửi email nhắc nhở thanh toán
  sendPaymentReminderEmail: async (bookingId) => {
    try {
      const response = await api.post(`/bookings/${bookingId}/payment-reminder`);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi gửi email nhắc nhở:', error);
      throw error;
    }
  },

  // Tạo hóa đơn từ đặt phòng
  generateInvoiceFromBooking: async (bookingId, invoiceData) => {
    try {
      const response = await api.post(`/bookings/${bookingId}/generate-invoice`, invoiceData);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi tạo hóa đơn:', error);
      throw error;
    }
  },

  // Xuất danh sách đặt phòng ra Excel
  exportBookingsToExcel: async (params = {}) => {
    try {
      const response = await api.get('/bookings/export/excel', {
        params,
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bookings_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('Lỗi khi xuất Excel:', error);
      throw error;
    }
  }
};

export default bookingsAPI;
