/**
 * Payment Routes - Routes cho thanh toán
 */
import express from 'express';
import paymentController from '../controllers/paymentController.js';
import authMiddleware from '../../shared/middleware/authMiddleware.js';
import sepayAuth from '../middleware/sepayAuth.js';

const router = express.Router();

// Tạo đơn hàng thanh toán với PackagePlan (yêu cầu auth)
router.post('/create-order', authMiddleware, paymentController.createPaymentOrder);

// Tạo đơn hàng thanh toán cho gia hạn gói (yêu cầu auth)
router.post('/create-renewal-order', authMiddleware, paymentController.createRenewalPaymentOrder);

// Kiểm tra trạng thái thanh toán (yêu cầu auth)
router.get('/status/:orderId', authMiddleware, paymentController.checkPaymentStatus);

// Lấy thông tin đơn hàng đã tồn tại (yêu cầu auth)
router.get('/order/:orderId', authMiddleware, paymentController.getOrderInfo);

// Webhook SePay (yêu cầu xác thực API key)
router.post('/sepay/webhook', sepayAuth, paymentController.sepayWebhook);

// =================== VNPay Routes ===================

// Tạo URL thanh toán VNPay cho đơn hàng đã tồn tại (yêu cầu auth)
router.post('/vnpay/create-payment-url', authMiddleware, paymentController.createVnpayPaymentUrl);

// Xử lý return URL từ VNPay và cập nhật trạng thái đơn hàng
router.get('/vnpay/return', paymentController.vnpayReturn);

// Lấy lịch sử gói của user (yêu cầu auth)
router.get('/package-history', authMiddleware, paymentController.getUserPackageHistory);

export default router;
