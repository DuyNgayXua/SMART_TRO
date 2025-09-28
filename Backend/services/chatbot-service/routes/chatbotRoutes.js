import express from 'express';
import chatbotController from '../controllers/chatbotController.js';
import { autoSaveVector, checkVectorCache } from '../middleware/vectorMiddleware.js';

const router = express.Router();

// Routes cho chatbot với vector caching và auto-save
router.post('/message', 
  autoSaveVector,    // Auto-save wrapper (phải đứng đầu để wrap response)
  checkVectorCache,  // Check cache trước khi process
  chatbotController.processMessage
);


export default router;
