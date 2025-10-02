/**
 * Enhanced Upload Middleware với AI Moderation
 * Tích hợp với hệ thống upload hiện tại
 */
import multer from 'multer';
import { uploadImageWithModeration, uploadVideoWithModeration } from '../utils/s3Service.js';
import { analyzeImageContent } from '../utils/awsRekognition.js';

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh!'), false);
    }
  }
});

/**
 * Enhanced middleware hỗ trợ cả images và video với AI moderation
 */
export const uploadMixedWithModeration = (maxImages = 5, maxVideos = 1) => {
  // Multer configuration cho mixed files
  const mixedStorage = multer.memoryStorage();
  const mixedUpload = multer({
    storage: mixedStorage,
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit for videos
      files: maxImages + maxVideos
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
      } else {
        cb(new Error('Chỉ chấp nhận file hình ảnh và video'), false);
      }
    }
  });

  return [
    // Sử dụng fields() để phân biệt images và video
    mixedUpload.fields([
      { name: 'images', maxCount: maxImages },
      { name: 'video', maxCount: maxVideos }
    ]),

    // AI Moderation middleware
    async (req, res, next) => {
      try {
        const imageFiles = req.files?.images || [];
        const videoFiles = req.files?.video || [];
        
        console.log(`Processing ${imageFiles.length} images and ${videoFiles.length} videos with AI moderation...`);

        // Nếu không có files nào, skip AI moderation và chuyển thẳng tới controller
        if (imageFiles.length === 0 && videoFiles.length === 0) {
          console.log('No files to process, skipping AI moderation');
          return next();
        }

        const approvedImages = [];
        const rejectedImages = [];
        const approvedVideos = [];
        const rejectedVideos = [];

        // Xử lý images với AI moderation
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          
          try {
            console.log(`Uploading image ${i + 1}/${imageFiles.length}: ${file.originalname}`);

            const result = await uploadImageWithModeration(file.buffer, file.originalname, {
              folder: 'properties/images',
              contentType: file.mimetype
            });

            approvedImages.push({
              originalname: file.originalname,
              url: result.url,
              publicId: result.key,
              s3Key: result.key,
              moderation: result.moderation,
              type: 'image',
              provider: 'AWS S3'
            });

            console.log(`Image approved: ${file.originalname}`);

          } catch (error) {
            console.log(`Image rejected: ${file.originalname} - ${error.message}`);
            
            rejectedImages.push({
              originalname: file.originalname,
              reason: error.message,
              type: 'image'
            });
          }
        }

        // Xử lý videos với AI moderation cho bạo lực và máu me
        for (let i = 0; i < videoFiles.length; i++) {
          const file = videoFiles[i];
          
          try {
            console.log(`Uploading video ${i + 1}/${videoFiles.length}: ${file.originalname}`);

            // Upload video với AI moderation trực tiếp lên S3
            const result = await uploadVideoWithModeration(file.buffer, file.originalname, {
              folder: 'properties/videos',
              contentType: file.mimetype
            });

            approvedVideos.push({
              originalname: file.originalname,
              url: result.url,
              publicId: result.key,
              s3Key: result.key,
              moderation: result.moderation,
              type: 'video',
              provider: 'AWS S3'
            });

            console.log(`Video approved: ${file.originalname}`);

          } catch (error) {
            console.log(`Video rejected: ${file.originalname} - ${error.message}`);
            
            rejectedVideos.push({
              originalname: file.originalname,
              reason: error.message,
              type: 'video'
            });
          }
        }

        // Gắn kết quả vào request
        req.uploadResults = {
          approved: [...approvedImages, ...approvedVideos],
          rejected: [...rejectedImages, ...rejectedVideos],
          images: {
            approved: approvedImages,
            rejected: rejectedImages
          },
          videos: {
            approved: approvedVideos,
            rejected: rejectedVideos
          },
          summary: {
            totalFiles: imageFiles.length + videoFiles.length,
            totalApproved: approvedImages.length + approvedVideos.length,
            totalRejected: rejectedImages.length + rejectedVideos.length,
            imagesApproved: approvedImages.length,
            imagesRejected: rejectedImages.length,
            videosApproved: approvedVideos.length,
            videosRejected: rejectedVideos.length
          }
        };

        // Thêm thông tin về files bị từ chối vào request để frontend xử lý
        req.rejectedFiles = {
          images: rejectedImages,
          videos: rejectedVideos
        };

        // Luôn pass qua controller, kể cả khi có files bị reject
        console.log(`Moderation completed: ${approvedImages.length} images, ${approvedVideos.length} videos approved`);
        if (rejectedImages.length > 0 || rejectedVideos.length > 0) {
          console.log(`Files rejected: ${rejectedImages.length} images, ${rejectedVideos.length} videos`);
        }
        
        next();

      } catch (error) {
        console.error('Mixed AI Moderation middleware error:', error);
        res.status(500).json({
          success: false,
          message: 'Lỗi khi xử lý kiểm duyệt files',
          error: error.message
        });
      }
    }
  ];
};

/**
 * Lightweight middleware cho update property - không bắt buộc files.
 */
export const uploadMixedWithModerationOptional = (maxImages = 5, maxVideos = 1) => {
  const mixedStorage = multer.memoryStorage();
  const mixedUpload = multer({
    storage: mixedStorage,
    limits: {
      fileSize: 50 * 1024 * 1024,
      files: maxImages + maxVideos
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
      } else {
        cb(new Error('Chỉ chấp nhận file hình ảnh và video'), false);
      }
    }
  });

  return [
    // Multer middleware - optional files
    (req, res, next) => {
      mixedUpload.fields([
        { name: 'images', maxCount: maxImages },
        { name: 'video', maxCount: maxVideos }
      ])(req, res, (err) => {
        if (err) {
          console.error('Multer error:', err);
          return res.status(400).json({
            success: false,
            message: err.message || 'Lỗi upload file'
          });
        }
        next();
      });
    },

    // AI Moderation middleware - optional
    async (req, res, next) => {
      try {
        const imageFiles = req.files?.images || [];
        const videoFiles = req.files?.video || [];
        
        console.log(`[UPDATE] Processing ${imageFiles.length} images and ${videoFiles.length} videos...`);

        // Nếu không có files, bỏ qua AI moderation
        if (imageFiles.length === 0 && videoFiles.length === 0) {
          console.log('[UPDATE] No new files to process, skipping moderation');
          return next();
        }

        // Xử lý AI moderation như bình thường
        const approvedImages = [];
        const rejectedImages = [];
        const approvedVideos = [];
        const rejectedVideos = [];

        // Process images
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          try {
            console.log(`[UPDATE] Processing image ${i + 1}/${imageFiles.length}: ${file.originalname}`);
            const result = await uploadImageWithModeration(file.buffer, file.originalname, {
              folder: 'properties/images',
              contentType: file.mimetype
            });
            approvedImages.push({
              originalname: file.originalname,
              url: result.url,
              publicId: result.key,
              s3Key: result.key,
              moderation: result.moderation,
              type: 'image',
              provider: 'AWS S3'
            });
          } catch (error) {
            console.log(`[UPDATE] Image rejected: ${file.originalname} - ${error.message}`);
            rejectedImages.push({
              originalname: file.originalname,
              reason: error.message,
              type: 'image'
            });
          }
        }

        // Process videos
        for (let i = 0; i < videoFiles.length; i++) {
          const file = videoFiles[i];
          try {
            console.log(`[UPDATE] Processing video ${i + 1}/${videoFiles.length}: ${file.originalname}`);
            const result = await uploadVideoWithModeration(file.buffer, file.originalname, {
              folder: 'properties/videos',
              contentType: file.mimetype
            });
            approvedVideos.push({
              originalname: file.originalname,
              url: result.url,
              publicId: result.key,
              s3Key: result.key,
              moderation: result.moderation,
              type: 'video',
              provider: 'AWS S3'
            });
          } catch (error) {
            console.log(`[UPDATE] Video rejected: ${file.originalname} - ${error.message}`);
            rejectedVideos.push({
              originalname: file.originalname,
              reason: error.message,
              type: 'video'
            });
          }
        }

        // Gán kết quả vào request
        req.uploadResults = {
          approved: [...approvedImages, ...approvedVideos],
          rejected: [...rejectedImages, ...rejectedVideos],
          images: {
            approved: approvedImages,
            rejected: rejectedImages
          },
          videos: {
            approved: approvedVideos,
            rejected: rejectedVideos
          }
        };

        console.log(`[UPDATE] Moderation completed: ${approvedImages.length} images, ${approvedVideos.length} videos approved`);
        next();

      } catch (error) {
        console.error('[UPDATE] AI Moderation error:', error);
        res.status(500).json({
          success: false,
          message: 'Lỗi khi xử lý kiểm duyệt files',
          error: error.message
        });
      }
    }
  ];
};

export default {
  uploadMixedWithModeration,
  uploadMixedWithModerationOptional
};