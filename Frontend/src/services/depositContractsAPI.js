/**
 * Deposit Contracts API Service
 */
import api from './api.js';

const depositContractsAPI = {
  // Tạo hợp đồng đặt cọc
  createDepositContract: async (contractData) => {
    try {
      const response = await api.post('/deposit-contracts', contractData);
      return response.data;
    } catch (error) {
      console.error('Error creating deposit contract:', error);
      throw error;
    }
  },

  // Lấy danh sách hợp đồng đặt cọc
  getDepositContracts: async (params = {}) => {
    try {
      const response = await api.get('/deposit-contracts', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching deposit contracts:', error);
      throw error;
    }
  },

  // Lấy thông tin chi tiết hợp đồng đặt cọc
  getDepositContractById: async (id) => {
    try {
      const response = await api.get(`/deposit-contracts/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching deposit contract:', error);
      throw error;
    }
  },

  // Cập nhật trạng thái hợp đồng đặt cọc
  updateDepositContractStatus: async (id, status) => {
    try {
      const response = await api.put(`/deposit-contracts/${id}/status`, { status });
      return response.data;
    } catch (error) {
      console.error('Error updating deposit contract status:', error);
      throw error;
    }
  },

  // Xóa hợp đồng đặt cọc
  deleteDepositContract: async (id) => {
    try {
      const response = await api.delete(`/deposit-contracts/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting deposit contract:', error);
      throw error;
    }
  }
};

export default depositContractsAPI;
