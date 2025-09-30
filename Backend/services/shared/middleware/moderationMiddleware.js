/**
 * Enhanced Upload Middleware với AI Moderation
 * Tích hợp với hệ thống upload hiện tại
 */
import multer from 'multer';
import { uploadWithModeration, analyzeImage } from '../utils/cloudinary.js';

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
 * Middleware upload với kiểm tra AI moderation .
 */
export const uploadWithAIModeration = (fieldName = 'images', maxCount = 10) => {
  return [
    // Multer middleware
    upload.array(fieldName, maxCount),
    
    // AI Moderation middleware
    async (req, res, next) => {
      try {
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Không có file nào được upload'
          });
        }

        console.log(`🔍 Processing ${req.files.length} files with AI moderation...`);

        const results = [];
        const rejectedFiles = [];

        // Xử lý từng file
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          
          try {
            console.log(`📤 Uploading file ${i + 1}/${req.files.length}: ${file.originalname}`);

            // Upload với moderation
            const result = await uploadWithModeration(file.buffer, {
              folder: req.body.folder || 'property_images',
              filename: `${Date.now()}_${i}_${file.originalname.replace(/\s+/g, '_')}`,
              enableModeration: true,
              tags: ['property', 'moderated']
            });

            results.push({
              originalName: file.originalname,
              url: result.secure_url,
              publicId: result.public_id,
              moderation: result.moderation,
              status: 'approved'
            });

            console.log(`✅ File approved: ${file.originalname}`);

          } catch (error) {
            console.log(`❌ File rejected: ${file.originalname} - ${error.message}`);
            
            rejectedFiles.push({
              originalName: file.originalname,
              reason: error.message,
              status: 'rejected'
            });
          }
        }

        // Gắn kết quả vào request
        req.uploadResults = {
          approved: results,
          rejected: rejectedFiles,
          summary: {
            total: req.files.length,
            approved: results.length,
            rejected: rejectedFiles.length
          }
        };

        // Nếu có ít nhất 1 ảnh được approve thì cho phép tiếp tục
        if (results.length > 0) {
          next();
        } else {
          return res.status(400).json({
            success: false,
            message: 'Tất cả ảnh đều bị từ chối do vi phạm nội dung',
            data: {
              rejected: rejectedFiles,
              summary: req.uploadResults.summary
            }
          });
        }

      } catch (error) {
        console.error('❌ AI Moderation middleware error:', error);
        res.status(500).json({
          success: false,
          message: 'Lỗi khi xử lý kiểm duyệt ảnh',
          error: error.message
        });
      }
    }
  ];
};

/**
 * Middleware kiểm tra ảnh từ URL
 */
export const checkImageFromUrl = async (req, res, next) => {
  try {
    const { imageUrl, imageUrls } = req.body;
    
    if (!imageUrl && !imageUrls) {
      return next(); // Không có URL để check
    }

    const urlsToCheck = imageUrls || [imageUrl];
    const results = [];

    for (const url of urlsToCheck) {
      try {
        const moderation = await analyzeImage(url);
        
        if (!moderation.isApproved) {
          return res.status(400).json({
            success: false,
            message: `Ảnh chứa nội dung không phù hợp: ${moderation.message}`,
            moderation,
            imageUrl: url
          });
        }

        results.push({
          imageUrl: url,
          moderation,
          status: 'approved'
        });

      } catch (error) {
        console.error(`❌ Error checking image ${url}:`, error);
        return res.status(400).json({
          success: false,
          message: `Không thể kiểm tra ảnh: ${error.message}`,
          imageUrl: url
        });
      }
    }

    // Gắn kết quả vào request
    req.moderationResults = results;
    next();

  } catch (error) {
    console.error('❌ Image URL check error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi kiểm tra ảnh từ URL',
      error: error.message
    });
  }
};

/**
 * Single file upload với moderation
 */
export const uploadSingleWithModeration = (fieldName = 'image') => {
  return [
    upload.single(fieldName),
    
    async (req, res, next) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: 'Không có file nào được upload'
          });
        }

        console.log(`📤 Processing single file: ${req.file.originalname}`);

        const result = await uploadWithModeration(req.file.buffer, {
          folder: req.body.folder || 'uploads',
          filename: `${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`,
          enableModeration: true,
          tags: ['single_upload', 'moderated']
        });

        req.uploadResult = {
          originalName: req.file.originalname,
          url: result.secure_url,
          publicId: result.public_id,
          moderation: result.moderation,
          status: 'approved'
        };

        console.log(`✅ Single file approved: ${req.file.originalname}`);
        next();

      } catch (error) {
        console.error(`❌ Single file rejected: ${req.file?.originalname} -`, error);
        res.status(400).json({
          success: false,
          message: `Upload bị từ chối: ${error.message}`,
          file: req.file?.originalname
        });
      }
    }
  ];
};

export default {
  uploadWithAIModeration,
  checkImageFromUrl,
  uploadSingleWithModeration
};
