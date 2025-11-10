import express from 'express';
import * as adminUserController from '../controllers/adminUserController.js';
import { authenticateToken, isAdmin } from '../shared/middleware/auth.js';

const router = express.Router();

// Middleware: Chỉ admin mới truy cập được
router.use(authenticateToken, isAdmin);

// Get all users with filters
router.get('/', adminUserController.getUsers);

// Get user details
router.get('/:userId', adminUserController.getUserDetails);

// Get user packages
router.get('/:userId/packages', adminUserController.getUserPackages);

// Toggle block/unblock user
router.put('/:userId/toggle-block', adminUserController.toggleBlockUser);

// Update user role
router.put('/:userId/role', adminUserController.updateUserRole);

export default router;
