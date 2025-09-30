/**
 * AI Moderation Controller
 * Xử lý các request liên quan đến kiểm duyệt ảnh
 */
import { 
  analyzeImage, 
  batchAnalyzeImages, 
  getModerationStats,
  updateModerationThresholds 
} from '../utils/cloudinary.js';

class ModerationController {
  /**
   * Phân tích ảnh từ URL ảnh
   */
  async analyzeImageFromUrl(req, res) {
    try {
      const { imageUrl } = req.body;

      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp URL ảnh'
        });
      }

      console.log(`🔍 Analyzing image: ${imageUrl}`);

      const result = await analyzeImage(imageUrl);

      res.status(200).json({
        success: true,
        message: result.isApproved ? 'Ảnh phù hợp' : 'Ảnh vi phạm nội dung',
        data: {
          imageUrl,
          moderation: result,
          recommendation: result.isApproved ? 'approve' : 'reject'
        }
      });

    } catch (error) {
      console.error('❌ Analyze image error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi phân tích ảnh',
        error: error.message
      });
    }
  }

  /**
   * Phân tích batch nhiều ảnh
   */
  async batchAnalyzeImages(req, res) {
    try {
      const { imageUrls } = req.body;

      if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp mảng URLs ảnh'
        });
      }

      if (imageUrls.length > 20) {
        return res.status(400).json({
          success: false,
          message: 'Tối đa 20 ảnh cho mỗi batch'
        });
      }

      console.log(`🔍 Batch analyzing ${imageUrls.length} images`);

      const results = await batchAnalyzeImages(imageUrls);
      
      const summary = {
        total: imageUrls.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        approved: results.filter(r => r.success && r.moderation?.isApproved).length,
        rejected: results.filter(r => r.success && !r.moderation?.isApproved).length
      };

      res.status(200).json({
        success: true,
        message: `Phân tích batch hoàn tất: ${summary.approved} approved, ${summary.rejected} rejected`,
        data: {
          results,
          summary
        }
      });

    } catch (error) {
      console.error('❌ Batch analyze error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi phân tích batch',
        error: error.message
      });
    }
  }

  /**
   * Lấy thống kê moderation
   */
  async getStats(req, res) {
    try {
      const { timeRange } = req.query;
      
      console.log(`📊 Getting moderation stats for ${timeRange || 30} days`);

      const stats = await getModerationStats(parseInt(timeRange) || 30);

      res.status(200).json({
        success: true,
        message: 'Lấy thống kê thành công',
        data: stats
      });

    } catch (error) {
      console.error('❌ Get stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thống kê',
        error: error.message
      });
    }
  }

  /**
   * Cập nhật threshold
   */
  async updateThresholds(req, res) {
    try {
      const { thresholds } = req.body;

      if (!thresholds || typeof thresholds !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp object thresholds'
        });
      }

      // Validate thresholds
      const validCategories = ['violence', 'weapons', 'gore', 'explicit', 'drugs', 'terrorism'];
      const invalidCategories = Object.keys(thresholds).filter(key => !validCategories.includes(key));
      
      if (invalidCategories.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Categories không hợp lệ: ${invalidCategories.join(', ')}`,
          validCategories
        });
      }

      // Validate values (0-1)
      const invalidValues = Object.entries(thresholds).filter(([key, value]) => 
        typeof value !== 'number' || value < 0 || value > 1
      );

      if (invalidValues.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Threshold values phải là số từ 0 đến 1',
          invalidValues: invalidValues.map(([key, value]) => ({ category: key, value }))
        });
      }

      console.log('📊 Updating thresholds:', thresholds);

      const success = updateModerationThresholds(thresholds);

      if (success) {
        res.status(200).json({
          success: true,
          message: 'Cập nhật thresholds thành công',
          data: {
            updatedThresholds: thresholds,
            updatedAt: new Date().toISOString()
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Lỗi khi cập nhật thresholds'
        });
      }

    } catch (error) {
      console.error('❌ Update thresholds error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật thresholds',
        error: error.message
      });
    }
  }

  /**
   * Test moderation system
   */
  async testSystem(req, res) {
    try {
      const testImages = [
        'https://example.com/safe-image.jpg',
        // Thêm test images khác nếu cần
      ];

      console.log('🧪 Testing moderation system...');

      const results = await batchAnalyzeImages(testImages);
      
      res.status(200).json({
        success: true,
        message: 'Test moderation system thành công',
        data: {
          testImages,
          results,
          systemStatus: 'operational',
          testedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Test system error:', error);
      res.status(500).json({
        success: false,
        message: 'Test system thất bại',
        error: error.message,
        systemStatus: 'error'
      });
    }
  }

  /**
   * Health check
   */
  async healthCheck(req, res) {
    try {
      res.status(200).json({
        success: true,
        message: 'AI Moderation Service is healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        features: {
          imageAnalysis: true,
          batchProcessing: true,
          realTimeModeration: true,
          webhookSupport: true
        },
        supportedCategories: [
          'violence', 'weapons', 'gore', 'explicit', 'drugs', 'terrorism'
        ]
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Health check failed',
        error: error.message
      });
    }
  }
}

export default new ModerationController();
