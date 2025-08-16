/**
 * User Routes - Định nghĩa API endpoints
 */
import express from 'express';
import userController from '../controllers/userController.js';
import authMiddleware from '../../shared/middleware/authMiddleware.js';
import adminMiddleware from '../../shared/middleware/adminMiddleware.js';
import validationMiddleware from '../../shared/middleware/validationMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', 
    validationMiddleware.validateRegister,
    userController.register
);

router.post('/login', 
    validationMiddleware.validateLogin,
    userController.login
);

// Protected routes (require authentication)
router.get('/profile', 
    authMiddleware,
    userController.getProfile
);

router.put('/profile', 
    authMiddleware,
    validationMiddleware.validateUpdateProfile,
    userController.updateProfile
);

// Admin only routes
router.get('/', 
    authMiddleware,
    adminMiddleware,
    userController.getUsers
);

router.get('/:id', 
    authMiddleware,
    adminMiddleware,
    userController.getUserById
);

export default router;
