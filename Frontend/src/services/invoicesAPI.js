import api from './api';

const invoicesAPI = {
  // Lấy danh sách hóa đơn
  async getInvoices(params = {}) {
    try {
      const response = await api.get('/invoices', { params });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy danh sách hóa đơn:', error);
      throw error;
    }
  },

  // Lấy thông tin chi tiết hóa đơn
  async getInvoiceById(id) {
    try {
      const response = await api.get(`/invoices/${id}`);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy thông tin hóa đơn:', error);
      throw error;
    }
  },

  // Tạo hóa đơn mới
  async createInvoice(invoiceData) {
    try {
      const response = await api.post('/invoices', invoiceData);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi tạo hóa đơn:', error);
      throw error;
    }
  },

  // Cập nhật hóa đơn
  async updateInvoice(id, invoiceData) {
    try {
      const response = await api.put(`/invoices/${id}`, invoiceData);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi cập nhật hóa đơn:', error);
      throw error;
    }
  },

  // Xóa hóa đơn
  async deleteInvoice(id) {
    try {
      const response = await api.delete(`/invoices/${id}`);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi xóa hóa đơn:', error);
      throw error;
    }
  },

  // Đánh dấu đã thanh toán
  async markAsPaid(id, paymentData) {
    try {
      const response = await api.post(`/invoices/${id}/pay`, paymentData);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi đánh dấu thanh toán:', error);
      throw error;
    }
  },

  // Lấy thống kê hóa đơn
  async getInvoiceStats(params = {}) {
    try {
      const response = await api.get('/invoices/stats', { params });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy thống kê hóa đơn:', error);
      throw error;
    }
  },

  // Lấy thông tin để tạo hóa đơn mới
  async getNewInvoiceInfo(contractId) {
    try {
      const response = await api.get(`/invoices/new/${contractId}`);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy thông tin hóa đơn mới:', error);
      throw error;
    }
  },

  // Lấy hóa đơn theo hợp đồng
  async getInvoicesByContract(contractId, params = {}) {
    try {
      const response = await api.get('/invoices', { 
        params: { ...params, contract: contractId }
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy hóa đơn theo hợp đồng:', error);
      throw error;
    }
  },

  // Lấy hóa đơn theo phòng
  async getInvoicesByRoom(roomId, params = {}) {
    try {
      const response = await api.get('/invoices', { 
        params: { ...params, room: roomId }
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy hóa đơn theo phòng:', error);
      throw error;
    }
  },

  // Lấy hóa đơn theo tenant
  async getInvoicesByTenant(tenantId, params = {}) {
    try {
      const response = await api.get('/invoices', { 
        params: { ...params, tenant: tenantId }
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy hóa đơn theo tenant:', error);
      throw error;
    }
  }
};

export default invoicesAPI;