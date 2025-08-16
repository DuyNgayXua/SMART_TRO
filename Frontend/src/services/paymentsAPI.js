import api from './api';

// API service cho quản lý thanh toán
export const paymentsAPI = {
  // Lấy danh sách tất cả thanh toán
  getAllPayments: async (params = {}) => {
    try {
      const response = await api.get('/payments', { params });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy danh sách thanh toán:', error);
      throw error;
    }
  },

  // Lấy thông tin chi tiết một thanh toán
  getPaymentById: async (id) => {
    try {
      const response = await api.get(`/payments/${id}`);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy thông tin thanh toán:', error);
      throw error;
    }
  },

  // Tạo thanh toán mới
  createPayment: async (paymentData) => {
    try {
      const response = await api.post('/payments', paymentData);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi tạo thanh toán mới:', error);
      throw error;
    }
  },

  // Cập nhật thông tin thanh toán
  updatePayment: async (id, paymentData) => {
    try {
      const response = await api.put(`/payments/${id}`, paymentData);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi cập nhật thanh toán:', error);
      throw error;
    }
  },

  // Xóa thanh toán
  deletePayment: async (id) => {
    try {
      const response = await api.delete(`/payments/${id}`);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi xóa thanh toán:', error);
      throw error;
    }
  },

  // Xác nhận thanh toán
  confirmPayment: async (id, confirmationData) => {
    try {
      const response = await api.patch(`/payments/${id}/confirm`, confirmationData);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi xác nhận thanh toán:', error);
      throw error;
    }
  },

  // Hủy thanh toán
  cancelPayment: async (id, reason = '') => {
    try {
      const response = await api.patch(`/payments/${id}/cancel`, { reason });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi hủy thanh toán:', error);
      throw error;
    }
  },

  // Hoàn tiền
  refundPayment: async (id, refundData) => {
    try {
      const response = await api.post(`/payments/${id}/refund`, refundData);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi hoàn tiền:', error);
      throw error;
    }
  },

  // Lấy thanh toán theo trạng thái
  getPaymentsByStatus: async (status, params = {}) => {
    try {
      const response = await api.get(`/payments/status/${status}`, { params });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy thanh toán theo trạng thái:', error);
      throw error;
    }
  },

  // Lấy thanh toán theo người dùng
  getPaymentsByUser: async (userId, params = {}) => {
    try {
      const response = await api.get(`/payments/user/${userId}`, { params });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy thanh toán theo người dùng:', error);
      throw error;
    }
  },

  // Lấy thanh toán theo booking
  getPaymentsByBooking: async (bookingId, params = {}) => {
    try {
      const response = await api.get(`/payments/booking/${bookingId}`, { params });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy thanh toán theo booking:', error);
      throw error;
    }
  },

  // Tìm kiếm thanh toán
  searchPayments: async (searchParams) => {
    try {
      const response = await api.get('/payments/search', { params: searchParams });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi tìm kiếm thanh toán:', error);
      throw error;
    }
  },

  // Lấy thống kê thanh toán
  getPaymentStatistics: async (period = 'month') => {
    try {
      const response = await api.get('/payments/statistics', { params: { period } });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy thống kê thanh toán:', error);
      throw error;
    }
  },

  // Lấy báo cáo doanh thu
  getRevenueReport: async (startDate, endDate, groupBy = 'day') => {
    try {
      const response = await api.get('/payments/reports/revenue', {
        params: { startDate, endDate, groupBy }
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy báo cáo doanh thu:', error);
      throw error;
    }
  },

  // Lấy phương thức thanh toán
  getPaymentMethods: async () => {
    try {
      const response = await api.get('/payments/methods');
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy phương thức thanh toán:', error);
      throw error;
    }
  },

  // Tạo link thanh toán online
  createPaymentLink: async (paymentData) => {
    try {
      const response = await api.post('/payments/create-link', paymentData);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi tạo link thanh toán:', error);
      throw error;
    }
  },

  // Xử lý callback từ cổng thanh toán
  handlePaymentCallback: async (callbackData) => {
    try {
      const response = await api.post('/payments/callback', callbackData);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi xử lý callback thanh toán:', error);
      throw error;
    }
  },

  // Upload biên lai thanh toán
  uploadPaymentReceipt: async (paymentId, receipt, onUploadProgress = null) => {
    try {
      const formData = new FormData();
      formData.append('receipt', receipt);
      
      const response = await api.post(`/payments/${paymentId}/receipt`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress,
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi upload biên lai:', error);
      throw error;
    }
  },

  // Gửi hóa đơn qua email
  sendInvoiceByEmail: async (paymentId, email) => {
    try {
      const response = await api.post(`/payments/${paymentId}/send-invoice`, { email });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi gửi hóa đơn:', error);
      throw error;
    }
  },

  // Xuất báo cáo thanh toán ra Excel
  exportPaymentsToExcel: async (params = {}) => {
    try {
      const response = await api.get('/payments/export/excel', {
        params,
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payments_${new Date().toISOString().split('T')[0]}.xlsx`;
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

export default paymentsAPI;
