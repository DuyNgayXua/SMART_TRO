/**
 * Image Search Routes - API endpoints cho tìm kiếm hình ảnh
 */
import express from 'express';
import imageSearchController, { upload } from '../controllers/imageSearchController.js';
import authMiddleware from '../../shared/middleware/authMiddleware.js';

const router = express.Router();

/**
 * POST /api/image-search/search
 * Tìm kiếm properties bằng hình ảnh
 */
router.post(
    '/search',
    upload.single('image'), // Upload ảnh
    imageSearchController.searchByImage
);





export default router;
