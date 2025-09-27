import express from 'express';
import chatbotController from '../controllers/chatbotController.js';
import authMiddleware from '../../shared/middleware/authMiddleware.js';
import optionalAuthMiddleware from '../../shared/middleware/optionalAuthMiddleware.js';
import { vectorLogger, autoSaveVector, checkVectorCache } from '../middleware/vectorMiddleware.js';

const router = express.Router();

// Routes cho chatbot với vector caching và auto-save
router.post('/message', 
  optionalAuthMiddleware,
  vectorLogger('message'),
  checkVectorCache,  // Check cache trước
  chatbotController.processMessage,
  autoSaveVector     // Auto-save sau khi process
);


export default router;
