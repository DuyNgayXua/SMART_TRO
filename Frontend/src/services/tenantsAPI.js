import api from './api';

const tenantsAPI = {
  async searchTenants(params) {
    const res = await api.get('/tenants', { params });
    return res.data; // { success, data: { items, pagination } expected }
  },
  async getTenantById(id) {
    const res = await api.get(`/tenants/${id}`);
    return res.data;
  },
  async createTenant(payload) {
    const res = await api.post('/tenants', payload);
    return res.data;
  },
  async updateTenant(id, payload) {
    const res = await api.put(`/tenants/${id}`, payload);
    return res.data;
  },
  async addPayment(id, paymentData) {
    const res = await api.post(`/tenants/${id}/payments`, paymentData);
    return res.data;
  },
  async endLease(id, endData) {
    const res = await api.post(`/tenants/${id}/end`, endData);
    return res.data;
  },
  async archiveTenant(id) {
    const res = await api.delete(`/tenants/${id}`);
    return res.data;
  },
  async deleteTenant(id) {
    const res = await api.delete(`/tenants/${id}/force`);
    return res.data;
  },
  async getTenantsByLandlord(landlordId, params) {
    const res = await api.get(`/tenants/landlord/${landlordId}`, { params });
    return res.data;
  },
  async getTenantsByRoom(roomId, params) {
    const res = await api.get(`/tenants/room/${roomId}`, { params });
    return res.data;
  },
  async getCurrentTenantByRoom(roomId) {
    const res = await api.get(`/tenants/room/${roomId}/current`);
    return res.data;
  },
  async getTenantStats(landlordId) {
    const res = await api.get(`/tenants/stats/landlord/${landlordId}`);
    return res.data;
  },

  // Upload tenant images - similar to room images
  async uploadTenantImages(tenantId, images, onUploadProgress = null) {
    const formData = new FormData();
    
    if (Array.isArray(images)) {
      images.forEach((image) => {
        formData.append('images', image);
      });
    } else {
      formData.append('images', images);
    }
    
    const config = {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    };
    
    if (onUploadProgress) {
      config.onUploadProgress = onUploadProgress;
    }
    
    const res = await api.post(`/tenants/${tenantId}/images`, formData, config);
    return res.data;
  }
};

export default tenantsAPI;
