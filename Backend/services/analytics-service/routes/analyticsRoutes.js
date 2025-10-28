import express from 'express';
import {
  getPriceTrendOverTime,
  getPriceRangeDistribution,
  getNewsSentiment,
  getPriceSummary
} from '../controllers/analyticsController.js';

const router = express.Router();

// Price trends by region and time
router.get('/price-trends', getPriceTrendOverTime);

// Price ranges distribution
router.get('/price-ranges', getPriceRangeDistribution);

// News sentiment analysis
router.get('/news-sentiment', getNewsSentiment);


// Metric Cards - Price Summary
router.get('/price-summary', getPriceSummary);

export default router;
