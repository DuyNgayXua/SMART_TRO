/**
 * Property Routes - Định nghĩa API endpoints
 */
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import propertyController from '../controllers/propertyController.js';
import authMiddleware from '../../shared/middleware/authMiddleware.js';
import { uploadMixedWithModeration } from '../../shared/middleware/moderationMiddleware.js';

const router = express.Router();

// File size limits
const IMAGE_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB per image
const VIDEO_SIZE_LIMIT = 50 * 1024 * 1024; // 50MB per video

// Configure multer for file uploads with detailed validation
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: VIDEO_SIZE_LIMIT, // Maximum file size (for videos)
    files: 6 // Max 5 images + 1 video
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
      return cb(new Error('Chỉ chấp nhận file hình ảnh và video'), false);
    }

    // Check individual file size limits
    if (file.mimetype.startsWith('image/') && req.headers['content-length'] > IMAGE_SIZE_LIMIT) {
      return cb(new Error('Kích thước ảnh không được vượt quá 5MB'), false);
    }

    if (file.mimetype.startsWith('video/') && req.headers['content-length'] > VIDEO_SIZE_LIMIT) {
      return cb(new Error('Kích thước video không được vượt quá 50MB'), false);
    }

    cb(null, true);
  }
});

// Middleware để resize ảnh sau khi upload
const resizeImages = async (req, res, next) => {
  if (!req.files) {
    console.log('No files found in request');
    return next();
  }

  try {
    console.log('req.files structure:', typeof req.files, Object.keys(req.files || {}));
    
    let files = [];
    
    // Handle different multer configurations
    if (Array.isArray(req.files)) {
      // If files is an array (multer.array() or similar)
      files = req.files;
      console.log('Files is array, length:', files.length);
    } else if (typeof req.files === 'object') {
      // If files is an object with field names as keys (multer.fields() or similar)
      const allFiles = Object.values(req.files);
      console.log('Files object values:', allFiles);
      files = allFiles.flat();
      console.log('Flattened files:', files.length);
    }

    console.log('Processing files for resize:', files.length);

    // Process images only
    for (const file of files) {
      if (file && file.mimetype && file.mimetype.startsWith('image/')) {
        console.log(`Resizing image: ${file.originalname || 'unknown'}, size: ${file.size}`);
        
        // Resize image if larger than 1920x1080
        const resized = await sharp(file.buffer)
          .resize(1920, 1080, { 
            fit: 'inside',
            withoutEnlargement: true 
          })
          .jpeg({ quality: 85 })
          .toBuffer();
        
        // Update file buffer with resized version
        const originalSize = file.size;
        file.buffer = resized;
        file.size = resized.length;
        
        console.log(`Image resized: ${originalSize} -> ${file.size} bytes`);
      }
    }
    next();
  } catch (error) {
    console.error('Resize error:', error);
    console.error('Error stack:', error.stack);
    next(new Error('Lỗi xử lý ảnh: ' + error.message));
  }
};


// Landlord only routes với AI Moderation cho cả images và video
router.post('/', 
    authMiddleware,
    uploadMixedWithModeration(5, 1), // AI check cho 5 ảnh + 1 video, tự động reject ảnh vi phạm
    resizeImages, // Resize ảnh sau khi upload
    propertyController.createProperty
);


export default router;
