import api from './api';

const contractsAPI = {
  async searchContracts(params) {
    const res = await api.get('/contracts', { params });
    return res.data;
  },
  async getContractById(id) {
    const res = await api.get(`/contracts/${id}`);
    return res.data;
  },
  async createContract(payload) {
    const res = await api.post('/contracts', payload);
    return res.data;
  },
  async updateContract(id, payload) {
    const res = await api.put(`/contracts/${id}`, payload);
    return res.data;
  },
  async deleteContract(id) {
    const res = await api.delete(`/contracts/${id}`);
    return res.data;
  },
  async terminateContract(id, payload={ reason:'' }) {
    const res = await api.post(`/contracts/${id}/terminate`, payload);
    return res.data;
  }
};

export default contractsAPI;
