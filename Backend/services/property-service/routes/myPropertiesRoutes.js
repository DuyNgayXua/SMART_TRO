import express from 'express';
import authMiddleware from '../../shared/middleware/authMiddleware.js';
import myPropertiesController from '../controllers/myPropertiesController.js';
import moderationMiddleware from '../../shared/middleware/moderationMiddleware.js';
import uploadMixedWithModerationOptional from '../../shared/middleware/moderationMiddleware.js';
const router = express.Router();


// Routes
router.get('/', authMiddleware, myPropertiesController.getMyProperties);
router.get('/approved', myPropertiesController.getMyApprovedProperties);
router.get('/approved-location', myPropertiesController.getMyApprovedPropertiesByLocation);
router.get('/stats', authMiddleware, myPropertiesController.getMyPropertiesStats);
router.get('/:propertyId/edit', authMiddleware, myPropertiesController.getPropertyForEdit);

// PUT update property với upload và AI moderation.
router.put(
  '/:propertyId',
  authMiddleware,
  moderationMiddleware.uploadMixedWithModerationOptional(),
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