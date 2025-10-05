import express from 'express';
import amenityController from '../controllers/amenityController.js';
import authMiddleware from '../../shared/middleware/authMiddleware.js';

const router = express.Router();

// Get all amenities with filtering and pagination (requires auth to see owner's amenities)
router.get('/', authMiddleware, amenityController.getAmenities);

// Get all amenities without owner filtering - for public use
router.get('/all', amenityController.getAllAmenities);

// Get active amenities for dropdown/selection (requires auth)
router.get('/active', authMiddleware, amenityController.getActiveAmenities);

// Get amenity categories
router.get('/categories', amenityController.getCategories);

// Get amenity by ID
router.get('/:id', amenityController.getAmenityById);

// Create new amenity (requires auth)
router.post('/', authMiddleware, amenityController.createAmenity);

// Update amenity (requires auth)
router.put('/:id', authMiddleware, amenityController.updateAmenity);

// Update display order (requires auth)
router.put('/order/update', authMiddleware, amenityController.updateDisplayOrder);

// Delete amenity (requires auth)
router.delete('/:id', authMiddleware, amenityController.deleteAmenity);

export default router;
