import express from 'express';
import multer from 'multer';
import tenantController from '../controllers/tenantController.js';
import authMiddleware from '../../shared/middleware/authMiddleware.js';
import landlordMiddleware from '../../shared/middleware/landlordMiddleware.js';

const router = express.Router();

// Configure multer for image upload
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { files: 5, fileSize: 10 * 1024 * 1024 } // 5 files, 10MB each
});

// CRUD operations
router.post('/', authMiddleware, landlordMiddleware, (req, res) => tenantController.create(req, res));
router.get('/', authMiddleware, landlordMiddleware, (req, res) => tenantController.list(req, res));
router.get('/:id', authMiddleware, landlordMiddleware, (req, res) => tenantController.get(req, res));
router.put('/:id', authMiddleware, landlordMiddleware, (req, res) => tenantController.update(req, res));
router.delete('/:id', authMiddleware, landlordMiddleware, (req, res) => tenantController.archive(req, res));
router.delete('/:id/force', authMiddleware, landlordMiddleware, (req, res) => tenantController.forceDelete(req, res));

// Image upload for tenant
router.post('/:id/images', authMiddleware, landlordMiddleware, upload.array('images', 5), (req, res) => tenantController.uploadImages(req, res));

// Payment operations
router.post('/:id/payments', authMiddleware, landlordMiddleware, (req, res) => tenantController.addPayment(req, res));

// Lease operations
router.post('/:id/end', authMiddleware, landlordMiddleware, (req, res) => tenantController.endLease(req, res));

// Query by relationships
router.get('/landlord/:landlordId', authMiddleware, (req, res) => tenantController.getByLandlord(req, res));
router.get('/room/:roomId', authMiddleware, (req, res) => tenantController.getByRoom(req, res));
router.get('/room/:roomId/current', authMiddleware, (req, res) => tenantController.getCurrentByRoom(req, res));

// Statistics
router.get('/stats/landlord/:landlordId', authMiddleware, (req, res) => tenantController.getStatsByLandlord(req, res));

export default router;
