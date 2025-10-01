import cloudinary from '../../../config/cloudinary.js';
import { analyzeImageContent, analyzeVideoContent } from './awsRekognition.js';

/**
 * Simple upload to Cloudinary without moderation
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
 * Upload image với AWS Rekognition moderation
 */
export const uploadWithModeration = async (buffer, options = {}) => {
  const {
    folder = 'uploads',
    filename,
    enableModeration = true,
    tags = []
  } = options;

  try {
    // 1. Upload to Cloudinary first
    console.log('📤 Uploading to Cloudinary...');
    
    const uploadOptions = {
      folder: folder,
      resource_type: 'image',
      tags: [...tags, 'moderated'],
      transformation: [
        { width: 1200, height: 1200, crop: 'limit', quality: 'auto' }
      ]
    };

    if (filename) {
      uploadOptions.public_id = filename;
    }

    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });

    // 2. Analyze with AWS Rekognition if moderation enabled
    if (enableModeration) {
      console.log('🔍 Analyzing content with AWS Rekognition...');
      
      const moderationResult = await analyzeImageContent(buffer);
      
      // 3. If rejected, delete from Cloudinary
      if (!moderationResult.isApproved) {
        await deleteFromCloudinary(uploadResult.public_id);
        throw new Error(moderationResult.message);
      }

      return {
        ...uploadResult,
        moderation: moderationResult
      };
    }

    // Return without moderation
    return {
      ...uploadResult,
      moderation: {
        isApproved: true,
        status: 'approved',
        message: 'Uploaded without moderation check'
      }
    };

  } catch (error) {
    console.error('❌ Upload with moderation error:', error);
    throw error;
  }
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


export default deleteFromCloudinary;




/**
 * Upload video với AWS Rekognition moderation
 */
export const uploadVideoWithModeration = async (buffer, options = {}) => {
  const {
    folder = 'uploads/videos',
    filename,
    enableModeration = true,
    tags = []
  } = options;

  try {
    // 1. Upload to Cloudinary first
    console.log('📤 Uploading video to Cloudinary...');
    
    const uploadOptions = {
      folder: folder,
      resource_type: 'video',
      tags: [...tags, 'moderated', 'video'],
      transformation: [
        { 
          quality: 'auto',
          format: 'mp4',
          video_codec: 'h264'
        }
      ]
    };

    if (filename) {
      uploadOptions.public_id = filename;
    }

    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });

    // 2. Analyze with AWS Rekognition if moderation enabled
    if (enableModeration) {
      console.log('Analyzing video content with AWS Rekognition...');
      
      try {
        // Pass original filename to help with S3 upload
        const originalFilename = filename || uploadResult.original_filename || 'video.mp4';
        const moderationResult = await analyzeVideoContent(uploadResult.secure_url, originalFilename);
        
        // 3. If rejected, delete from Cloudinary immediately
        if (!moderationResult.isApproved) {
          console.log('Video rejected, deleting from Cloudinary...');
          await deleteFromCloudinary(uploadResult.public_id);
          throw new Error(`Video rejected: ${moderationResult.message}`);
        }

        console.log('Video approved and kept on Cloudinary');
        return {
          ...uploadResult,
          moderation: moderationResult
        };
      } catch (analysisError) {
        console.error(' Video analysis failed:', analysisError.message);
        
        // If analysis fails, delete video to be safe
        console.log(' Analysis failed, deleting video from Cloudinary for safety...');
        await deleteFromCloudinary(uploadResult.public_id);
        
        // Throw error instead of allowing upload
        throw new Error(`Video upload failed: Analysis error - ${analysisError.message}`);
      }
    }

    // Return without moderation
    return {
      ...uploadResult,
      moderation: {
        isApproved: true,
        status: 'approved',
        message: 'Video uploaded without moderation check'
      }
    };

  } catch (error) {
    console.error('❌ Video upload with moderation error:', error);
    throw error;
  }
};


