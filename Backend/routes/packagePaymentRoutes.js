import express from 'express';
import * as packagePaymentController from '../controllers/packagePaymentController.js';
import { authenticateToken, isAdmin } from '../shared/middleware/auth.js';

const router = express.Router();

// Middleware: Only admin can access
router.use(authenticateToken, isAdmin);

// Get all package payments
router.get('/', packagePaymentController.getPackagePayments);

// Get payment statistics
router.get('/statistics', packagePaymentController.getPaymentStatistics);

// Get payment by ID
router.get('/:paymentId', packagePaymentController.getPackagePaymentById);

// Update payment status
router.put('/:paymentId/status', packagePaymentController.updatePaymentStatus);

export default router;
