import express from 'express';
import invoiceController from '../controllers/invoiceController.js';
import authMiddleware from '../../shared/middleware/authMiddleware.js';
import landlordMiddleware from '../../shared/middleware/landlordMiddleware.js';

const router = express.Router();

// CRUD operations
router.post('/', authMiddleware, landlordMiddleware, (req, res) => invoiceController.create(req, res));
router.get('/', authMiddleware, landlordMiddleware, (req, res) => invoiceController.list(req, res));
router.get('/stats', authMiddleware, landlordMiddleware, (req, res) => invoiceController.getStats(req, res));
router.get('/new/:contractId', authMiddleware, landlordMiddleware, (req, res) => invoiceController.getNewInvoiceInfo(req, res));
router.get('/:id', authMiddleware, landlordMiddleware, (req, res) => invoiceController.get(req, res));
router.put('/:id', authMiddleware, landlordMiddleware, (req, res) => invoiceController.update(req, res));
router.delete('/:id', authMiddleware, landlordMiddleware, (req, res) => invoiceController.delete(req, res));

// Payment operations
router.post('/:id/pay', authMiddleware, landlordMiddleware, (req, res) => invoiceController.markAsPaid(req, res));

export default router;