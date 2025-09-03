import express from 'express';
import contractController from '../controllers/contractController.js';
import authMiddleware from '../../shared/middleware/authMiddleware.js';
import landlordMiddleware from '../../shared/middleware/landlordMiddleware.js';

const router = express.Router();

router.get('/', authMiddleware, landlordMiddleware, (req,res)=>contractController.list(req,res));
router.get('/:id', authMiddleware, landlordMiddleware, (req,res)=>contractController.get(req,res));
router.post('/', authMiddleware, landlordMiddleware, (req,res)=>contractController.create(req,res));
router.put('/:id', authMiddleware, landlordMiddleware, (req,res)=>contractController.update(req,res));
router.delete('/:id', authMiddleware, landlordMiddleware, (req,res)=>contractController.delete(req,res));
router.post('/:id/terminate', authMiddleware, landlordMiddleware, (req,res)=>contractController.terminate(req,res));

export default router;
