import api from '../utils/api';

const notificationAPI = {
  // Get all notifications for the current user
  getNotifications: async (params = {}) => {
    try {
      const queryParams = {
        page: params.page || 1,
        limit: params.limit || 20,
      };

      // Add type filter if specified
      if (params.type) {
        queryParams.type = params.type;
      }

      // Add isRead filter if specified
      if (params.isRead !== undefined) {
        queryParams.isRead = params.isRead;
      }

      // Add all parameter to get all notifications
      if (params.all === true) {
        queryParams.all = 'true';
      }

      // Alternative: set limit to -1 to get all
      if (params.limit === -1 || params.limit === 0) {
        queryParams.limit = -1;
      }

      const response = await api.get('/notifications', {
        params: queryParams
      });
      return response.data;
    } catch (error) {
      console.error('Error getting notifications:', error);
      throw error;
    }
  },

  // Get all notifications (convenience method)
  getAllNotifications: async (params = {}) => {
    try {
      return await notificationAPI.getNotifications({
        ...params,
        all: true
      });
    } catch (error) {
      console.error('Error getting all notifications:', error);
      throw error;
    }
  },

  // Get unread notifications count
  getUnreadCount: async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      return response.data;
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  },

  // Mark specific notification as read
  markAsRead: async (notificationId) => {
    try {
      const response = await api.patch(`/notifications/${notificationId}/read`);
      return response.data;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  },

  // Mark all notifications as read
  markAllAsRead: async () => {
    try {
      const response = await api.patch('/notifications/mark-all-read');
      return response.data;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  },

  // Delete a notification
  deleteNotification: async (notificationId) => {
    try {
      const response = await api.delete(`/notifications/${notificationId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  },

  // Get notification by ID
  getNotificationById: async (notificationId) => {
    try {
      const response = await api.get(`/notifications/${notificationId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting notification by ID:', error);
      throw error;
    }
  },

  // Create a notification (typically used by admin)
  createNotification: async (notificationData) => {
    try {
      const response = await api.post('/notifications', notificationData);
      return response.data;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }
};

export default notificationAPI;
