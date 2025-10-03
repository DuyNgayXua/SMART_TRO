import express from 'express';
import { body } from 'express-validator';
import adminReportPropertyController from '../controllers/adminReportPropertyController.js';
import authMiddleware from '../../shared/middleware/authMiddleware.js';
import { adminMiddleware } from '../../shared/middleware/adminMiddleware.js';

const router = express.Router();

// Validation middleware
const validateWarning = [
  body('reason')
    .notEmpty()
    .withMessage('Lý do cảnh báo không được để trống')
    .isLength({ min: 10, max: 500 })
    .withMessage('Lý do cảnh báo phải có từ 10-500 ký tự')
    .trim()
    .escape()
];

const validateHide = [
  body('reason')
    .notEmpty()
    .withMessage('Lý do ẩn bài đăng không được để trống')
    .isLength({ min: 3, max: 500 })
    .withMessage('Lý do ẩn bài đăng phải có từ 3-500 ký tự')
    .trim()
    .escape()
];

// Middleware: Chỉ admin mới có quyền truy cập các route này
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * @route   GET /api/admin/reports
 * @desc    Lấy danh sách báo cáo với pagination và filter
 * @access  Admin only
 * @query   page, limit, status, sortBy, sortOrder, search
 */
router.get('/', adminReportPropertyController.getReportsForAdmin);

/**
 * @route   GET /api/admin/reports/stats
 * @desc    Lấy thống kê báo cáo
 * @access  Admin only
 */
router.get('/stats', adminReportPropertyController.getReportStats);

/**
 * @route   GET /api/admin/reports/:id
 * @desc    Lấy chi tiết báo cáo theo ID
 * @access  Admin only
 */
router.get('/:id', adminReportPropertyController.getReportDetails);

/**
 * @route   PUT /api/admin/reports/:id/dismiss
 * @desc    Bỏ qua báo cáo (không làm gì, chỉ ghi log)
 * @access  Admin only
 */
router.put('/:id/dismiss', adminReportPropertyController.dismissReport);

/**
 * @route   PUT /api/admin/reports/:id/warning
 * @desc    Gửi email cảnh báo tới chủ bài đăng
 * @access  Admin only
 * @body    { reason: string }
 */
router.put('/:id/warning', validateWarning, adminReportPropertyController.sendWarning);

/**
 * @route   PUT /api/admin/reports/:id/hide
 * @desc    Ẩn bài đăng (soft delete) vì vi phạm nghiêm trọng
 * @access  Admin only
 * @body    { reason: string }
 */
router.put('/:id/hide', validateHide, adminReportPropertyController.hideProperty);

export default router;