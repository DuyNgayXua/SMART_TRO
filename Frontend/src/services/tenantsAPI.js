import api from './api';

const tenantsAPI = {
  async searchTenants(params) {
    const res = await api.get('/tenants', { params });
    return res.data; // { success, data: { users, pagination } expected }
  },
  async getTenantById(id) {
    const res = await api.get(`/tenants/${id}`);
    return res.data;
  },
  async createTenant(payload) {
    const res = await api.post('/tenants/register', payload);
    return res.data;
  },
  async updateTenant(id, payload) {
    const res = await api.put(`/tenants/${id}`, payload);
    return res.data;
  },
  async toggleActive(id, active) {
    const res = await api.patch(`/tenants/${id}/status`, { isActive: active });
    return res.data;
  }
};

export default tenantsAPI;
