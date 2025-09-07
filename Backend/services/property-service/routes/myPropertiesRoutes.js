import express from 'express';
import authMiddleware from '../../shared/middleware/authMiddleware.js';
import myPropertiesController from '../controllers/myPropertiesController.js';
import upload from '../../shared/utils/upload.js'; // import upload

const router = express.Router();

// Middleware upload cho updateProperty
const uploadFields = upload.fields([
  { name: 'images', maxCount: 5 },
  { name: 'video', maxCount: 1 }
]);

// Routes
router.get('/', authMiddleware, myPropertiesController.getMyProperties);
router.get('/approved', authMiddleware, myPropertiesController.getMyApprovedProperties);
router.get('/stats', authMiddleware, myPropertiesController.getMyPropertiesStats);
router.get('/:propertyId/edit', authMiddleware, myPropertiesController.getPropertyForEdit);

// PUT update property với upload
router.put(
  '/:propertyId',
  authMiddleware,
  uploadFields,
  myPropertiesController.updateProperty
);

router.delete('/:propertyId', authMiddleware, myPropertiesController.deleteProperty);
router.patch('/:propertyId/toggle-status', authMiddleware, myPropertiesController.togglePropertyStatus);

export default router;
