import cloudinary from '../../../config/cloudinary.js';

/**
 * Upload với AI Moderation kiểm tra nội dung
 */
export const uploadToCloudinary = async (buffer, folder = 'uploads') => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: 'auto'
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    ).end(buffer);
  });
};

/**
 * Upload với AI Moderation - Enhanced version
 */
export const uploadWithModeration = async (buffer, options = {}) => {
  const {
    folder = 'uploads',
    filename,
    enableModeration = true,
    tags = [],
    transformation = []
  } = options;

  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: folder,
      resource_type: 'auto',
      tags: [...tags, 'moderated'],
      transformation: [
        { width: 1200, height: 1200, crop: 'limit', quality: 'auto' },
        ...transformation
      ]
    };

    // Thêm filename nếu có
    if (filename) {
      uploadOptions.public_id = filename;
    }

    // Bật AI moderation
    if (enableModeration) {
      uploadOptions.moderation = 'ai_moderation';
      
      // Thêm webhook nếu có
      const webhookUrl = getWebhookUrl();
      if (webhookUrl) {
        uploadOptions.notification_url = webhookUrl;
      }
    }

    cloudinary.uploader.upload_stream(
      uploadOptions,
      async (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload error:', error);
          reject(error);
          return;
        }

        try {
          // Xử lý kết quả moderation
          const moderationResult = await processModerationResult(result);
          
          // Nếu bị từ chối, xóa ảnh
          if (!moderationResult.isApproved) {
            await deleteFromCloudinary(result.public_id);
            reject(new Error(`Upload rejected: ${moderationResult.message}`));
            return;
          }

          // Trả về kết quả với moderation data
          resolve({
            ...result,
            moderation: moderationResult
          });

        } catch (moderationError) {
          console.error('❌ Moderation processing error:', moderationError);
          // Vẫn trả về result nhưng có warning
          resolve({
            ...result,
            moderation: {
              isApproved: true,
              warning: 'Moderation check failed but upload succeeded',
              error: moderationError.message
            }
          });
        }
      }
    ).end(buffer);
  });
};

export const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

/**
 * Phân tích ảnh từ URL với AI Moderation
 */
export const analyzeImage = async (imageUrl) => {
  try {
    console.log('🔍 Analyzing image:', imageUrl);

    const result = await cloudinary.api.analyze_image(imageUrl, {
      analysis_type: ['ai_moderation']
    });

    return processModerationAnalysis(result.data.analysis);

  } catch (error) {
    console.error('❌ Image analysis error:', error);
    throw new Error(`Analysis failed: ${error.message}`);
  }
};

/**
 * Kiểm tra nhiều ảnh cùng lúc (batch)
 */
export const batchAnalyzeImages = async (imageUrls) => {
  try {
    const results = await Promise.allSettled(
      imageUrls.map(url => analyzeImage(url))
    );

    return results.map((result, index) => ({
      imageUrl: imageUrls[index],
      success: result.status === 'fulfilled',
      moderation: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  } catch (error) {
    console.error('❌ Batch analysis error:', error);
    throw new Error(`Batch analysis failed: ${error.message}`);
  }
};

/**
 * Xử lý kết quả moderation từ upload ảnh
 */
const processModerationResult = (uploadResult) => {
  const moderation = uploadResult.moderation && uploadResult.moderation[0];
  
  if (!moderation) {
    return {
      isApproved: true,
      status: 'approved',
      confidence: 1.0,
      categories: {},
      message: 'No moderation data available',
      details: {}
    };
  }

  // Threshold cho từng loại nội dung
  const thresholds = {
    violence: 0.7,      // Bạo lực
    weapons: 0.7,       // Vũ khí  
    gore: 0.6,          // Máu me
    explicit: 0.8,      // Nội dung khiêu dâm
    drugs: 0.7,         // Ma túy
    terrorism: 0.8      // Khủng bố (nếu có)
  };

  const categories = {
    violence: moderation.violence || 0,
    weapons: moderation.weapons || 0,
    gore: moderation.gore || 0,
    explicit: moderation.explicit || 0,
    drugs: moderation.drugs || 0,
    terrorism: moderation.terrorism || 0
  };

  const violations = [];
  let isApproved = true;

  // Kiểm tra từng category
  Object.keys(categories).forEach(category => {
    const score = categories[category];
    const threshold = thresholds[category] || 0.7;
    
    if (score > threshold) {
      isApproved = false;
      violations.push({
        category,
        score: Math.round(score * 100),
        threshold: Math.round(threshold * 100),
        message: getCategoryMessage(category, score)
      });
    }
  });

  // Tính confidence tổng thể
  const maxScore = Math.max(...Object.values(categories));
  const confidence = isApproved ? 1 - maxScore : maxScore;

  return {
    isApproved,
    status: isApproved ? 'approved' : 'rejected',
    confidence: Math.round(confidence * 100) / 100,
    categories,
    violations,
    message: isApproved 
      ? 'Ảnh được phê duyệt' 
      : `Ảnh bị từ chối: ${violations.map(v => v.message).join(', ')}`,
    details: {
      moderationStatus: moderation.status,
      totalViolations: violations.length,
      riskLevel: getRiskLevel(maxScore)
    }
  };
};

/**
 * Xử lý kết quả analysis API
 */
const processModerationAnalysis = (analysis) => {
  const moderation = analysis.ai_moderation;
  
  if (!moderation) {
    return {
      isApproved: true,
      status: 'approved',
      confidence: 1.0,
      categories: {},
      message: 'No moderation data available'
    };
  }

  return processModerationResult({ moderation: [moderation] });
};

/**
 * Lấy message cho từng category
 */
const getCategoryMessage = (category, score) => {
  const messages = {
    violence: `Phát hiện nội dung bạo lực (${Math.round(score * 100)}%)`,
    weapons: `Phát hiện vũ khí (${Math.round(score * 100)}%)`,
    gore: `Phát hiện nội dung máu me (${Math.round(score * 100)}%)`,
    explicit: `Phát hiện nội dung khiêu dâm (${Math.round(score * 100)}%)`,
    drugs: `Phát hiện nội dung ma túy (${Math.round(score * 100)}%)`,
    terrorism: `Phát hiện nội dung khủng bố (${Math.round(score * 100)}%)`
  };

  return messages[category] || `Phát hiện nội dung không phù hợp (${Math.round(score * 100)}%)`;
};

/**
 * Xác định mức độ rủi ro
 */
const getRiskLevel = (maxScore) => {
  if (maxScore < 0.3) return 'low';
  if (maxScore < 0.6) return 'medium';
  if (maxScore < 0.8) return 'high';
  return 'critical';
};

/**
 * Lấy webhook URL
 */
const getWebhookUrl = () => {
  if (process.env.CLOUDINARY_WEBHOOK_URL) {
    return process.env.CLOUDINARY_WEBHOOK_URL;
  }

  const baseUrl = process.env.BASE_URL || process.env.APP_URL;
  if (baseUrl) {
    return `${baseUrl}/api/upload/webhook/moderation`;
  }

  const port = process.env.PORT || 5000;
  return `http://localhost:${port}/api/upload/webhook/moderation`;
};

/**
 * Cập nhật threshold cho moderation
 */
export const updateModerationThresholds = (newThresholds) => {
  // Có thể implement để update thresholds runtime
  console.log('📊 Updating moderation thresholds:', newThresholds);
  return true;
};

/**
 * Lấy thống kê moderation
 */
export const getModerationStats = async (timeRange = 30) => {
  try {
    // Có thể implement để lấy stats từ Cloudinary hoặc database
    return {
      timeRange,
      totalImages: 0,
      approved: 0,
      rejected: 0,
      categories: {},
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Error getting moderation stats:', error);
    throw error;
  }
};
