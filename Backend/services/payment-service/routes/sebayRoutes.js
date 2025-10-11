/**
 * Sebay Payment Routes - Routes cho thanh toán QR hóa đơn
 */
import express from 'express';
import { createInvoicePaymentQR, sendInvoiceEmailWithQR } from '../controllers/sebayController.js';
import { handleSepayWebhook, testWebhook } from '../controllers/sepayWebhookController.js';
import { authenticateToken } from '../../../shared/middleware/auth.js';

const router = express.Router();

// Route tạo QR code thanh toán
router.post('/create-qr', authenticateToken, createInvoicePaymentQR);

// Route gửi email hóa đơn kèm QR
router.post('/send-invoice-email', authenticateToken, sendInvoiceEmailWithQR);

// Webhook từ Sepay (không cần auth vì từ bên thứ 3)
router.post('/webhook', handleSepayWebhook);

// Test webhook (dev only, cần auth)
router.post('/test-webhook', authenticateToken, testWebhook);

export default router;
