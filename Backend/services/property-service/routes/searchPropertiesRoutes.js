import express from 'express';
import searchController from '../controllers/searchPropertiesController.js';

const router = express.Router();

// Search properties with filters
router.get('/properties', searchController.searchProperties);

// Get search suggestions
router.get('/suggestions', searchController.getSearchSuggestions);

export default router;
