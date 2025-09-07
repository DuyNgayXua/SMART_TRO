/**
 * Property Routes - Định nghĩa API endpoints
 */
import express from 'express';
import multer from 'multer';
import propertyController from '../controllers/propertyController.js';
import authMiddleware from '../../shared/middleware/authMiddleware.js';
import landlordMiddleware from '../../shared/middleware/landlordMiddleware.js';
import validationMiddleware from '../../shared/middleware/validationMiddleware.js';

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


// Landlord only routes
router.post('/', 
    authMiddleware,
    landlordMiddleware,
    upload.fields([
        { name: 'images', maxCount: 5 },
        { name: 'video', maxCount: 1 }
    ]),
    propertyController.createProperty
);



export default router;
