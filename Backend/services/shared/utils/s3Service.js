/**
 * AWS S3 Service - Direct Upload & Analysis (No Cloudinary)
 */
import AWS from 'aws-sdk';

// Configure AWS S3.
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'ap-southeast-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const BUCKET_NAME = process.env.BUCKET_NAME || 's3tranquochuy';

/**
 * Upload image buffer to S3.
 */
export const uploadImageToS3 = async (buffer, filename, options = {}) => {
  try {
    const key = `images/${Date.now()}_${filename.replace(/\s+/g, '_')}`;
    
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: options.contentType || getImageContentType(filename),
      Metadata: {
        originalName: filename,
        uploadedAt: new Date().toISOString(),
        folder: options.folder || 'images'
      }
    };

    console.log(`Uploading image to S3: ${key}`);
    
    const result = await s3.upload(params).promise();
    
    console.log(`Image uploaded to S3: ${result.Location}`);
    
    return {
      url: result.Location,
      key: result.Key,
      bucket: result.Bucket,
      etag: result.ETag,
      size: buffer.length,
      contentType: params.ContentType,
      type: 'image'
    };

  } catch (error) {
    console.error('S3 image upload error:', error);
    throw new Error(`S3 image upload failed: ${error.message}`);
  }
};

/**
 * Upload video buffer to S3
 */
export const uploadVideoToS3 = async (buffer, filename, options = {}) => {
  try {
    const key = `videos/${Date.now()}_${filename.replace(/\s+/g, '_')}`;
    
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: options.contentType || getVideoContentType(filename),
      Metadata: {
        originalName: filename,
        uploadedAt: new Date().toISOString(),
        folder: options.folder || 'videos'
      }
    };

    console.log(`Uploading video to S3: ${key}`);
    
    const result = await s3.upload(params).promise();
    
    console.log(`Video uploaded to S3: ${result.Location}`);
    
    return {
      url: result.Location,
      key: result.Key,
      bucket: result.Bucket,
      etag: result.ETag,
      size: buffer.length,
      contentType: params.ContentType,
      type: 'video'
    };

  } catch (error) {
    console.error('S3 video upload error:', error);
    throw new Error(`S3 video upload failed: ${error.message}`);
  }
};

/**
 * Upload image with AI moderation
 */
export const uploadImageWithModeration = async (buffer, filename, options = {}) => {
  let uploadResult = null;
  
  try {
    console.log(`Starting image upload with moderation: ${filename}`);
    
    // 1. Upload to S3 first
    uploadResult = await uploadImageToS3(buffer, filename, options);
    
    // 2. Analyze with AWS Rekognition using buffer
    const { analyzeImageContent } = await import('./awsRekognition.js');
    const moderationResult = await analyzeImageContent(buffer);
    
    // 3. Check if approved
    if (!moderationResult.isApproved) {
      // Delete from S3 if rejected
      await deleteFromS3(uploadResult.key);
      throw new Error(moderationResult.message);
    }
    
    console.log(`Image approved and uploaded: ${filename}`);
    
    // 4. Return S3 URL with moderation results
    return {
      ...uploadResult,
      moderation: moderationResult,
      provider: 'AWS S3',
      secure_url: uploadResult.url, // For compatibility
      public_id: uploadResult.key   // For compatibility
    };

  } catch (error) {
    console.error(`Image upload with moderation failed: ${filename} - ${error.message}`);
    
    // Clean up S3 file if upload succeeded but analysis failed
    if (uploadResult && uploadResult.key) {
      try {
        await deleteFromS3(uploadResult.key);
        console.log(`Cleaned up rejected image: ${uploadResult.key}`);
      } catch (cleanupError) {
        console.warn(`Could not delete rejected file: ${uploadResult.key} - ${cleanupError.message}`);
        // Continue without failing - file will remain on S3
      }
    }
    
    throw error;
  }
};

/**
 * Upload video with AI moderation
 */
export const uploadVideoWithModeration = async (buffer, filename, options = {}) => {
  let uploadResult = null;
  
  try {
    console.log(`Starting video upload with moderation: ${filename}`);
    
    // 1. Upload to S3 first
    uploadResult = await uploadVideoToS3(buffer, filename, options);
    
    // 2. Analyze with AWS Rekognition using S3 key
    const { analyzeVideoContentFromS3 } = await import('./awsRekognition.js');
    const moderationResult = await analyzeVideoContentFromS3(uploadResult.key);
    
    // 3. Check if approved
    if (!moderationResult.isApproved) {
      // Delete from S3 if rejected
      await deleteFromS3(uploadResult.key);
      throw new Error(moderationResult.message);
    }
    
    console.log(`Video approved and uploaded: ${filename}`);
    
    // 4. Return S3 URL with moderation results
    return {
      ...uploadResult,
      moderation: moderationResult,
      provider: 'AWS S3',
      secure_url: uploadResult.url, // For compatibility
      public_id: uploadResult.key   // For compatibility
    };

  } catch (error) {
    console.error(`Video upload with moderation failed: ${filename} - ${error.message}`);
    
    // Clean up S3 file if upload succeeded but analysis failed
    if (uploadResult && uploadResult.key) {
      try {
        await deleteFromS3(uploadResult.key);
        console.log(`Cleaned up rejected video: ${uploadResult.key}`);
      } catch (cleanupError) {
        console.warn(`Could not delete rejected file: ${uploadResult.key} - ${cleanupError.message}`);
        // Continue without failing - file will remain on S3
      }
    }
    
    throw error;
  }
};

/**
 * Delete file from S3 (with permission handling)
 */
export const deleteFromS3 = async (key) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key
    };

    await s3.deleteObject(params).promise();
    console.log(`S3 file deleted: ${key}`);
    
  } catch (error) {
    if (error.code === 'AccessDenied') {
      console.warn(`Cannot delete S3 file due to permissions: ${key}`);
      console.warn(`File will remain on S3. Contact admin to grant s3:DeleteObject permission.`);
      // Don't throw error for access denied - just log warning
      return;
    }
    
    console.error('S3 delete error:', error);
    throw new Error(`S3 delete failed: ${error.message}`);
  }
};

/**
 * Get image content type based on filename
 */
const getImageContentType = (filename) => {
  const extension = filename.toLowerCase().split('.').pop();
  
  const contentTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml'
  };

  return contentTypes[extension] || 'image/jpeg';
};

/**
 * Get video content type based on filename
 */
const getVideoContentType = (filename) => {
  const extension = filename.toLowerCase().split('.').pop();
  
  const contentTypes = {
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'mkv': 'video/x-matroska',
    'webm': 'video/webm',
    'flv': 'video/x-flv',
    '3gp': 'video/3gpp',
    'wmv': 'video/x-ms-wmv'
  };

  return contentTypes[extension] || 'video/mp4';
};

/**
 * Get S3 file info
 */
export const getS3FileInfo = async (key) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key
    };

    const result = await s3.headObject(params).promise();
    
    return {
      size: result.ContentLength,
      contentType: result.ContentType,
      lastModified: result.LastModified,
      etag: result.ETag,
      metadata: result.Metadata
    };

  } catch (error) {
    console.error('S3 file info error:', error);
    throw new Error(`S3 file info failed: ${error.message}`);
  }
};

export default {
  uploadImageToS3,
  uploadVideoToS3,
  uploadImageWithModeration,
  uploadVideoWithModeration,
  deleteFromS3,
  getS3FileInfo
};
