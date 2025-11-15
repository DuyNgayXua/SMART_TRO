import express from 'express';
import { getDashboardStats } from '../controllers/adminAnalyticsController.js';
import { authenticateToken, isAdmin } from '../shared/middleware/auth.js';

const router = express.Router();

// Chỉ admin mới được truy cập
router.get('/dashboard-stats', 
  authenticateToken, 
  isAdmin, 
  getDashboardStats
);

export default router;
