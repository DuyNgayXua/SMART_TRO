import express from 'express';
import adminPropertyController from '../controllers/adminPropertyController.js';
import authMiddleware from '../../shared/middleware/authMiddleware.js';

const router = express.Router();


// Routes cho admin quản lý properties
// GET /api/admin/properties - Lấy danh sách properties
router.get('/properties', authMiddleware, adminPropertyController.getPropertiesForAdmin);

// GET /api/admin/properties/stats - Lấy thống kê
router.get('/properties/stats', authMiddleware, adminPropertyController.getPropertyStats);

// GET /api/admin/properties/:propertyId - Lấy chi tiết property
router.get('/properties/:propertyId', authMiddleware, adminPropertyController.getPropertyDetail);

// POST /api/admin/properties/:propertyId/approve - Duyệt property
router.post('/properties/:propertyId/approve', authMiddleware, adminPropertyController.approveProperty);

// POST /api/admin/properties/:propertyId/reject - Từ chối property
router.post('/properties/:propertyId/reject', authMiddleware, adminPropertyController.rejectProperty);

export default router;
