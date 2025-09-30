/**
 * Example: Tích hợp AI Moderation vào Property Service
 * Cách sử dụng moderation middleware trong property upload
 */
import express from 'express';
import { uploadWithAIModeration } from '../../shared/middleware/moderationMiddleware.js';

const router = express.Router();

/**
 * @route POST /api/properties/upload-images
 * @desc Upload ảnh property với AI moderation
 * @access Private
 */
router.post('/upload-images',
  // requireAuth, // Thêm auth middleware
  
  // AI Moderation middleware - tự động check và reject ảnh vi phạm
  uploadWithAIModeration('images', 10), // Max 10 ảnh
  
  async (req, res) => {
    try {
      const { approved, rejected, summary } = req.uploadResults;
      
      console.log(`✅ Property images processed: ${summary.approved} approved, ${summary.rejected} rejected`);

      // Chỉ lưu những ảnh được approve
      const propertyImages = approved.map(img => ({
        url: img.url,
        publicId: img.publicId,
        originalName: img.originalName,
        moderationStatus: img.moderation.status,
        confidence: img.moderation.confidence
      }));

      // Lưu vào property (example)
      // const property = await Property.findByIdAndUpdate(req.params.propertyId, {
      //   $push: { images: { $each: propertyImages } }
      // });

      res.status(200).json({
        success: true,
        message: `Upload hoàn tất: ${summary.approved} ảnh được phê duyệt`,
        data: {
          images: propertyImages,
          rejected: rejected.length > 0 ? rejected : undefined,
          summary,
          warnings: rejected.length > 0 ? `${rejected.length} ảnh bị từ chối do vi phạm nội dung` : undefined
        }
      });

    } catch (error) {
      console.error('❌ Property image upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi upload ảnh property',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/properties/check-image-urls
 * @desc Kiểm tra ảnh từ URLs trước khi lưu property
 * @access Private
 */
router.post('/check-image-urls',
  // requireAuth,
  
  async (req, res) => {
    try {
      const { imageUrls, propertyData } = req.body;

      if (!imageUrls || !Array.isArray(imageUrls)) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp mảng imageUrls'
        });
      }

      console.log(`🔍 Checking ${imageUrls.length} image URLs for property...`);

      // Import analyzeImage function
      const { batchAnalyzeImages } = await import('../../shared/utils/cloudinary.js');
      
      const results = await batchAnalyzeImages(imageUrls);
      
      const approved = results.filter(r => r.success && r.moderation?.isApproved);
      const rejected = results.filter(r => !r.success || !r.moderation?.isApproved);

      if (approved.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Tất cả ảnh đều bị từ chối do vi phạm nội dung',
          data: { rejected }
        });
      }

      // Lưu property với ảnh đã được approve (example)
      const approvedImageUrls = approved.map(r => r.imageUrl);
      
      // const property = await Property.create({
      //   ...propertyData,
      //   images: approvedImageUrls.map(url => ({ url, verified: true })) .
      // });

      res.status(200).json({
        success: true,
        message: `Property validation thành công: ${approved.length} ảnh hợp lệ`,
        data: {
          approvedImages: approvedImageUrls,
          rejectedCount: rejected.length,
          // property: property,
          summary: {
            total: imageUrls.length,
            approved: approved.length,
            rejected: rejected.length
          }
        }
      });

    } catch (error) {
      console.error('❌ Property image validation error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi kiểm tra ảnh property',
        error: error.message
      });
    }
  }
);

export default router;
