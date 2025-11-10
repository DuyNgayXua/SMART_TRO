import { Notification } from '../../schemas/index.js';
import notificationWSServer from './websocket/notificationWebSocket.js';

class NotificationService {
  // Create and send property status notification
  static async notifyPropertyStatus(userId, propertyId, status, propertyTitle, adminNote = '') {
    try {
      console.log(`[${new Date().toISOString()}] NotificationService.notifyPropertyStatus called:`);
      console.log(`userId: ${userId}`);
      console.log(`propertyId: ${propertyId}`);
      console.log(`status: ${status}`);
      console.log(`propertyTitle: ${propertyTitle}`);
      console.log(`adminNote: ${adminNote}`);

      // Create notification in database
      console.log(`Creating notification in database...`);
      const notification = await Notification.createPropertyNotification(
        userId, 
        propertyId, 
        status, 
        propertyTitle
      );
      console.log(`Notification created in DB:`, notification._id);

      if (adminNote) {
        notification.metadata.adminNote = adminNote;
        await notification.save();
        console.log(`Admin note added and saved`);
      }

      // Send real-time notification via WebSocket
      console.log(`Sending real-time notification via WebSocket...`);
      const wsResult = notificationWSServer.sendNotificationToUser(userId, {
        _id: notification._id,
        type: notification.type,
        title: notification.title,
        content: notification.content,
        relatedId: notification.relatedId,
        isRead: false,
        createdAt: notification.createdAt,
        metadata: notification.metadata
      });
      console.log(`WebSocket send result: ${wsResult ? 'SUCCESS' : 'FAILED'}`);

      console.log(`Property notification process completed for user ${userId}: ${status}`);
      return notification;
    } catch (error) {
      console.error('Error sending property notification:', error);
      throw error;
    }
  }

  // Create and send report status notification
  static async notifyReportStatus(userId, reportId, status, reportType, adminNote = '', propertyId = null) {
    try {
      // Validate required parameters
      if (!userId) {
        throw new Error('userId is required for report notification');
      }
      if (!reportId) {
        throw new Error('reportId is required for report notification');
      }
      if (!status) {
        throw new Error('status is required for report notification');
      }

      console.log(`Creating report notification for userId: ${userId}, reportId: ${reportId}, status: ${status}, propertyId: ${propertyId}`);

      // Create notification in database
      const notification = await Notification.createReportNotification(
        userId, 
        reportId, 
        status, 
        reportType, 
        adminNote,
        propertyId
      );

      // Send real-time notification via WebSocket
      notificationWSServer.sendNotificationToUser(userId, {
        _id: notification._id,
        type: notification.type,
        title: notification.title,
        content: notification.content,
        relatedId: notification.relatedId,
        isRead: false,
        createdAt: notification.createdAt,
        metadata: notification.metadata
      });

      console.log(`Report notification sent to user ${userId}: ${status}`);
      return notification;
    } catch (error) {
      console.error('Error sending report notification:', error);
      throw error;
    }
  }

  // Create custom notification
  static async createCustomNotification(userId, type, title, content, relatedId, metadata = {}) {
    try {
      const notification = new Notification({
        userId,
        type,
        title,
        content,
        relatedId,
        metadata
      });

      await notification.save();

      // Send real-time notification via WebSocket
      notificationWSServer.sendNotificationToUser(userId, {
        _id: notification._id,
        type: notification.type,
        title: notification.title,
        content: notification.content,
        relatedId: notification.relatedId,
        isRead: false,
        createdAt: notification.createdAt,
        metadata: notification.metadata
      });

      console.log(`Custom notification sent to user ${userId}: ${title}`);
      return notification;
    } catch (error) {
      console.error('Error creating custom notification:', error);
      throw error;
    }
  }

  // Send broadcast notification to all users
  static async broadcastNotification(title, content, type = 'system') {
    try {
      // This would typically be used for system-wide announcements
      notificationWSServer.broadcast({
        title,
        content,
        type,
        isSystemMessage: true
      });

      console.log(`Broadcast notification sent: ${title}`);
    } catch (error) {
      console.error('Error broadcasting notification:', error);
      throw error;
    }
  }

  // Get WebSocket server statistics
  static getWebSocketStats() {
    return notificationWSServer.getStats();
  }
}

export default NotificationService;
