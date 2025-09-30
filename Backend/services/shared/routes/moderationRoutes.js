/**
 * AI Moderation Routes
 * API endpoints cho kiểm duyệt ảnh
 */
import express from 'express';
import moderationController from '../controllers/moderationController.js';
import { checkImageFromUrl } from '../middleware/moderationMiddleware.js';

const router = express.Router();

/**
 * @route POST /api/moderation/analyze
 * @desc Phân tích ảnh từ URL
 * @access Public
 */
router.post('/analyze', moderationController.analyzeImageFromUrl);

/**
 * @route POST /api/moderation/batch-analyze
 * @desc Phân tích batch nhiều ảnh từ URL
 * @access Public
 */
router.post('/batch-analyze', moderationController.batchAnalyzeImages);

/**
 * @route POST /api/moderation/check-url
 * @desc Kiểm tra ảnh từ URL với middleware
 * @access Public
 */
router.post('/check-url', 
  checkImageFromUrl,
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Tất cả ảnh đều phù hợp',
      data: {
        results: req.moderationResults,
        totalChecked: req.moderationResults?.length || 0
      }
    });
  }
);

/**
 * @route GET /api/moderation/stats
 * @desc Lấy thống kê moderation (Admin only)
 * @access Admin
 */
router.get('/stats', 
  // requireAuth, // Thêm auth middleware nếu cần
  moderationController.getStats
);

/**
 * @route PUT /api/moderation/thresholds
 * @desc Cập nhật thresholds (Admin only)
 * @access Admin
 */
router.put('/thresholds',
  // requireAuth, // Thêm auth middleware nếu cần
  moderationController.updateThresholds
);

/**
 * @route GET /api/moderation/test
 * @desc Test moderation system
 * @access Public
 */
router.get('/test', moderationController.testSystem);

/**
 * @route GET /api/moderation/health
 * @desc Health check
 * @access Public
 */
router.get('/health', moderationController.healthCheck);

/**
 * @route GET /api/moderation
 * @desc API info
 * @access Public
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'AI Content Moderation API',
    version: '1.0.0',
    description: 'Kiểm duyệt nội dung ảnh tự động với AI',
    capabilities: [
      'Phát hiện bạo lực (violence)',
      'Phát hiện vũ khí (weapons)', 
      'Phát hiện máu me (gore)',
      'Phát hiện nội dung khiêu dâm (explicit)',
      'Phát hiện ma túy (drugs)',
      'Phát hiện khủng bố (terrorism)'
    ],
    endpoints: {
      analyze: {
        url: '/api/moderation/analyze',
        method: 'POST',
        description: 'Phân tích 1 ảnh từ URL'
      },
      batchAnalyze: {
        url: '/api/moderation/batch-analyze', 
        method: 'POST',
        description: 'Phân tích nhiều ảnh cùng lúc (max 20)'
      },
      checkUrl: {
        url: '/api/moderation/check-url',
        method: 'POST', 
        description: 'Kiểm tra và block nếu vi phạm'
      },
      stats: {
        url: '/api/moderation/stats',
        method: 'GET',
        description: 'Thống kê kiểm duyệt (Admin)'
      },
      updateThresholds: {
        url: '/api/moderation/thresholds',
        method: 'PUT',
        description: 'Cập nhật ngưỡng phát hiện (Admin)'
      }
    },
    examples: {
      analyzeRequest: {
        url: '/api/moderation/analyze',
        body: {
          imageUrl: 'https://example.com/image.jpg'
        }
      },
      batchRequest: {
        url: '/api/moderation/batch-analyze',
        body: {
          imageUrls: [
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg'
          ]
        }
      }
    }
  });
});

export default router;
