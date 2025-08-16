/**
 * Property Routes - Định nghĩa API endpoints
 */
import express from 'express';
import propertyController from '../controllers/propertyController.js';
import authMiddleware from '../../shared/middleware/authMiddleware.js';
import landlordMiddleware from '../../shared/middleware/landlordMiddleware.js';
import validationMiddleware from '../../shared/middleware/validationMiddleware.js';

const router = express.Router();

// Public routes
router.get('/search', propertyController.searchProperties);
router.get('/:id', propertyController.getProperty);

// Protected routes (require authentication)
router.post('/:id/rate', 
    authMiddleware,
    validationMiddleware.validateRating,
    propertyController.rateProperty
);

// Landlord only routes
router.post('/', 
    authMiddleware,
    landlordMiddleware,
    validationMiddleware.validateProperty,
    propertyController.createProperty
);

router.get('/my/properties', 
    authMiddleware,
    landlordMiddleware,
    propertyController.getMyProperties
);

router.put('/:id', 
    authMiddleware,
    landlordMiddleware,
    validationMiddleware.validatePropertyUpdate,
    propertyController.updateProperty
);

router.delete('/:id', 
    authMiddleware,
    landlordMiddleware,
    propertyController.deleteProperty
);

export default router;
