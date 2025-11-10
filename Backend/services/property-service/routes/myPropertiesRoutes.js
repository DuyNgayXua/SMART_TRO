import express from 'express';
import sharp from 'sharp';
import authMiddleware from '../../shared/middleware/authMiddleware.js';
import myPropertiesController from '../controllers/myPropertiesController.js';
import moderationMiddleware from '../../shared/middleware/moderationMiddleware.js';
import uploadMixedWithModerationOptional from '../../shared/middleware/moderationMiddleware.js';

const router = express.Router();

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


// Routes
router.get('/', authMiddleware, myPropertiesController.getMyProperties);
router.get('/approved', myPropertiesController.getMyApprovedProperties);
router.get('/approved-location', myPropertiesController.getMyApprovedPropertiesByLocation);
router.get('/stats', authMiddleware, myPropertiesController.getMyPropertiesStats);
router.get('/current-package', authMiddleware, myPropertiesController.getCurrentUserPackage);
router.get('/available-post-types', authMiddleware, myPropertiesController.getAvailablePostTypes);
router.get('/can-post-type/:postTypeId', authMiddleware, myPropertiesController.canPostType);
router.get('/recommended-packages', authMiddleware, myPropertiesController.getRecommendedPackages);
router.get('/test-package-status', authMiddleware, myPropertiesController.testPackageStatus);
router.get('/migration-properties', authMiddleware, myPropertiesController.getPropertiesForMigration);
router.get('/:propertyId/edit', authMiddleware, myPropertiesController.getPropertyForEdit);
router.get('/notification/:propertyId', authMiddleware, myPropertiesController.getPropertyForNotification);

// PUT update property với upload và AI moderation.
router.put(
  '/:propertyId',
  authMiddleware,
  moderationMiddleware.uploadMixedWithModerationOptional(),
  resizeImages, // Resize ảnh sau khi upload
  myPropertiesController.updateProperty
);

router.delete('/:propertyId', authMiddleware, myPropertiesController.deleteProperty);
router.patch('/:propertyId/toggle-status', authMiddleware, myPropertiesController.togglePropertyStatus);
router.patch('/:propertyId/promote-to-top', authMiddleware, myPropertiesController.promotePropertyToTop);


// Favorites routes
router.get('/favorites', authMiddleware, myPropertiesController.getFavorites);
router.post('/:propertyId/favorite', authMiddleware, myPropertiesController.addToFavorites);
router.delete('/:propertyId/favorite', authMiddleware, myPropertiesController.removeFromFavorites);

// detail, related, featured, record view

// Public routes (no auth required)
router.get('/featured', myPropertiesController.getFeaturedProperties);
router.get('/:id', myPropertiesController.getPropertyDetail);
router.get('/:id/related', myPropertiesController.getRelatedProperties);
router.post('/:id/view', myPropertiesController.recordView);

export default router;