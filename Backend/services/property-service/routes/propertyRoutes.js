/**
 * Property Routes - Định nghĩa API endpoints
 */
import express from 'express';
import multer from 'multer';
import propertyController from '../controllers/propertyController.js';
import authMiddleware from '../../shared/middleware/authMiddleware.js';
import { uploadMixedWithModeration } from '../../shared/middleware/moderationMiddleware.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for videos
    files: 6 // Max 5 images + 1 video
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file hình ảnh và video'), false);
    }
  }
});


// Landlord only routes với AI Moderation cho cả images và video
router.post('/', 
    authMiddleware,
    uploadMixedWithModeration(5, 1), // AI check cho 5 ảnh + 1 video, tự động reject ảnh vi phạm
    propertyController.createProperty
);


export default router;
