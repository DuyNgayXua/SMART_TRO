import express from 'express';
import authMiddleware from '../../shared/middleware/authMiddleware.js';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationById,
  createNotification
} from '../controllers/notificationController.js';

const router = express.Router();

// All notification routes require authentication
router.use(authMiddleware);

// GET /api/notifications - Get all notifications for current user
router.get('/', getNotifications);

// GET /api/notifications/unread-count - Get unread notifications count
router.get('/unread-count', getUnreadCount);

// PATCH /api/notifications/mark-all-read - Mark all notifications as read
router.patch('/mark-all-read', markAllAsRead);

// GET /api/notifications/:notificationId - Get specific notification by ID
router.get('/:notificationId', getNotificationById);

// PATCH /api/notifications/:notificationId/read - Mark specific notification as read
router.patch('/:notificationId/read', markAsRead);

// DELETE /api/notifications/:notificationId - Delete specific notification
router.delete('/:notificationId', deleteNotification);

// POST /api/notifications - Create new notification (admin/system use)
router.post('/', createNotification);

export default router;
