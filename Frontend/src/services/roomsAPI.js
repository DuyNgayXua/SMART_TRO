import api from './api';

// API service cho quản lý phòng trọ
export const roomsAPI = {
  // Lấy danh sách tất cả phòng
  getAllRooms: async (params = {}) => {
    try {
      const response = await api.get('/rooms/search', { params });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy danh sách phòng:', error);
      throw error;
    }
  },

  // Lấy thông tin chi tiết một phòng
  getRoomById: async (id) => {
    try {
      const response = await api.get(`/rooms/${id}`);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy thông tin phòng:', error);
      throw error;
    }
  },

  // Tạo phòng mới
  createRoom: async (roomData) => {
    try {
      const response = await api.post('/rooms', roomData);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi tạo phòng mới:', error);
      throw error;
    }
  },

  // Cập nhật thông tin phòng
  updateRoom: async (id, roomData) => {
    try {
      const response = await api.put(`/rooms/${id}`, roomData);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi cập nhật phòng:', error);
      throw error;
    }
  },

  // Xóa phòng
  deleteRoom: async (id) => {
    try {
      const response = await api.delete(`/rooms/${id}`);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi xóa phòng:', error);
      throw error;
    }
  },

  // Tìm kiếm phòng theo điều kiện
  searchRooms: async (searchParams) => {
    try {
      const response = await api.get('/rooms/search', { params: searchParams });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi tìm kiếm phòng:', error);
      // Fallback về getAllRooms nếu search API chưa có
      try {
        const fallbackResponse = await api.get('/rooms', { params: searchParams });
        const rooms = fallbackResponse.data.data || fallbackResponse.data;
        return {
          success: true,
          data: {
            rooms: Array.isArray(rooms) ? rooms : [],
            pagination: {
              total: Array.isArray(rooms) ? rooms.length : 0,
              pages: 1,
              page: 1,
              limit: searchParams.limit || 12
            }
          }
        };
      } catch (fallbackError) {
        throw error;
      }
    }
  },

  // Lấy danh sách phòng theo trạng thái
  getRoomsByStatus: async (status, params = {}) => {
    try {
      const response = await api.get(`/rooms/status/${status}`, { params });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy phòng theo trạng thái:', error);
      throw error;
    }
  },

  // Cập nhật trạng thái phòng
  updateRoomStatus: async (id, status) => {
    try {
      const response = await api.patch(`/rooms/${id}/status`, { status });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi cập nhật trạng thái phòng:', error);
      throw error;
    }
  },

  // Upload hình ảnh phòng
  uploadRoomImages: async (roomId, images, onUploadProgress = null) => {
    try {
      const formData = new FormData();
      images.forEach((image) => {
        formData.append('images', image);
      });
      
      const response = await api.post(`/rooms/${roomId}/images`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress,
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi upload hình ảnh:', error);
      throw error;
    }
  },

  // Xóa hình ảnh phòng
  deleteRoomImage: async (roomId, url) => {
    try {
      const response = await api.delete(`/rooms/${roomId}/images`, { data: { url } });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi xóa hình ảnh:', error);
      throw error;
    }
  },

  // Lấy thống kê phòng
  getRoomStatistics: async (period = 'month') => {
    try {
      const response = await api.get('/rooms/statistics', { params: { period } });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy thống kê phòng:', error);
      throw error;
    }
  },

  // Lấy lịch sử phòng
  getRoomHistory: async (roomId, params = {}) => {
    try {
      const response = await api.get(`/rooms/${roomId}/history`, { params });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy lịch sử phòng:', error);
      throw error;
    }
  },

  // Đặt phòng
  bookRoom: async (roomId, bookingData) => {
    try {
      const response = await api.post(`/rooms/${roomId}/book`, bookingData);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi đặt phòng:', error);
      throw error;
    }
  },

  // Hủy đặt phòng
  cancelBooking: async (roomId, bookingId) => {
    try {
      const response = await api.delete(`/rooms/${roomId}/bookings/${bookingId}`);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi hủy đặt phòng:', error);
      throw error;
    }
  },

  // Lấy danh sách tiện ích
  getRoomAmenities: async () => {
    try {
      const response = await api.get('/rooms/amenities');
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy danh sách tiện ích:', error);
      throw error;
    }
  },

  // Cập nhật tiện ích phòng
  updateRoomAmenities: async (roomId, amenities) => {
    try {
      const response = await api.put(`/rooms/${roomId}/amenities`, { amenities });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi cập nhật tiện ích phòng:', error);
      throw error;
    }
  },

  // Lấy báo cáo sử dụng phòng
  getRoomUsageReport: async (startDate, endDate) => {
    try {
      const response = await api.get('/rooms/reports/usage', {
        params: { startDate, endDate }
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy báo cáo sử dụng phòng:', error);
      throw error;
    }
  },

  // Lấy báo cáo doanh thu từ phòng
  getRoomRevenueReport: async (startDate, endDate) => {
    try {
      const response = await api.get('/rooms/reports/revenue', {
        params: { startDate, endDate }
      });
      return response.data;
    } catch (error) {
      console.error('Lỗi khi lấy báo cáo doanh thu:', error);
      throw error;
    }
  },

  // Chuyển phòng - Transfer room
  transferRoom: async (transferData) => {
    try {
      const response = await api.post('/rooms/transfer', transferData);
      return response.data;
    } catch (error) {
      console.error('Lỗi khi chuyển phòng:', error);
      throw error;
    }
  }
};

export default roomsAPI;
