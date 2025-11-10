import express from 'express';
import * as trialRequestController from '../controllers/trialRequestController.js';
import { authenticateToken, isAdmin } from '../shared/middleware/auth.js';

const router = express.Router();

// User route - Đăng ký gói dùng thử (yêu cầu đăng nhập)
router.post('/trial-request', authenticateToken, trialRequestController.createTrialRequest);

// Public route - Đăng ký tài khoản sau khi được approve
router.post('/trial-register', trialRequestController.registerTrialUser);

// Admin routes - Quản lý yêu cầu dùng thử
router.get('/trial-requests', authenticateToken, isAdmin, trialRequestController.getAllTrialRequests);
router.put('/trial-requests/:requestId/approve', authenticateToken, isAdmin, trialRequestController.approveTrialRequest);
router.put('/trial-requests/:requestId/reject', authenticateToken, isAdmin, trialRequestController.rejectTrialRequest);

export default router;
