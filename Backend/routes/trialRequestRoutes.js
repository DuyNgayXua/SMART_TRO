import express from 'express';
import * as trialRequestController from '../controllers/trialRequestController.js';
import { authenticateToken, isAdmin } from '../shared/middleware/auth.js';

const router = express.Router();

// Public route - Tạo yêu cầu dùng thử
router.post('/trial-request', trialRequestController.createTrialRequest);

// Admin routes - Quản lý yêu cầu dùng thử
router.get('/trial-requests', authenticateToken, isAdmin, trialRequestController.getAllTrialRequests);
router.put('/trial-requests/:requestId/approve', authenticateToken, isAdmin, trialRequestController.approveTrialRequest);
router.put('/trial-requests/:requestId/reject', authenticateToken, isAdmin, trialRequestController.rejectTrialRequest);

export default router;
