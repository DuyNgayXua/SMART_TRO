/**
 * File utilities for compression and validation
 */

// File size limits (same as backend)
export const FILE_SIZE_LIMITS = {
  IMAGE: 5 * 1024 * 1024, // 5MB
  VIDEO: 50 * 1024 * 1024, // 50MB
};

/**
 * Compress image file using canvas
 * @param {File} file - Original image file
 * @param {number} maxWidth - Maximum width (default: 1920)
 * @param {number} maxHeight - Maximum height (default: 1080) 
 * @param {number} quality - JPEG quality 0-1 (default: 0.8)
 * @returns {Promise<File>} Compressed file
 */
export const compressImage = (file, maxWidth = 1920, maxHeight = 1080, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      resolve(file); // Return original if not image
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Không thể nén ảnh'));
          return;
        }

        // Create new file
        const compressedFile = new File([blob], file.name, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });

        resolve(compressedFile);
      }, 'image/jpeg', quality);
    };

    img.onerror = () => reject(new Error('Không thể tải ảnh'));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Validate file size and type
 * @param {File} file - File to validate
 * @returns {object} Validation result
 */
export const validateFile = (file) => {
  const result = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Check file type
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    result.isValid = false;
    result.errors.push('Chỉ chấp nhận file hình ảnh và video');
    return result;
  }

  // Check file size
  if (file.type.startsWith('image/')) {
    if (file.size > FILE_SIZE_LIMITS.IMAGE) {
      result.isValid = false;
      result.errors.push(`Kích thước ảnh không được vượt quá ${formatFileSize(FILE_SIZE_LIMITS.IMAGE)}`);
    } else if (file.size > FILE_SIZE_LIMITS.IMAGE * 0.8) {
      result.warnings.push(`Ảnh có kích thước lớn (${formatFileSize(file.size)}), sẽ được tự động nén`);
    }
  }

  if (file.type.startsWith('video/')) {
    if (file.size > FILE_SIZE_LIMITS.VIDEO) {
      result.isValid = false;
      result.errors.push(`Kích thước video không được vượt quá ${formatFileSize(FILE_SIZE_LIMITS.VIDEO)}`);
    }
  }

  return result;
};

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * Group validation messages by error/warning type
 * @param {Array} validationResults - Array of validation results
 * @returns {Object} Grouped messages
 */
export const groupValidationMessages = (validationResults) => {
  const errorGroups = {};
  const warningGroups = {};

  validationResults.forEach(result => {
    // Group errors
    result.errors.forEach(error => {
      if (!errorGroups[error]) {
        errorGroups[error] = [];
      }
      errorGroups[error].push(result.file);
    });

    // Group warnings  
    result.warnings.forEach(warning => {
      if (!warningGroups[warning]) {
        warningGroups[warning] = [];
      }
      warningGroups[warning].push(result.file);
    });
  });

  // Format grouped messages
  const groupedErrors = Object.keys(errorGroups).map(errorType => {
    const files = errorGroups[errorType];
    return `${files.join(', ')}: ${errorType}`;
  });

  const groupedWarnings = Object.keys(warningGroups).map(warningType => {
    const files = warningGroups[warningType];
    return `${files.join(', ')}: ${warningType}`;
  });

  return {
    errors: groupedErrors,
    warnings: groupedWarnings
  };
};

/**
 * Process files before upload (compress images, validate all)
 * @param {FileList|File[]} files - Files to process
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<object>} Processed files and validation results
 */
export const processFilesForUpload = async (files, onProgress = () => {}) => {
  const filesArray = Array.from(files);
  const processedFiles = [];
  const validationResults = [];
  let hasErrors = false;

  for (let i = 0; i < filesArray.length; i++) {
    const file = filesArray[i];
    onProgress({ current: i + 1, total: filesArray.length, fileName: file.name });

    // Validate file
    const validation = validateFile(file);
    validationResults.push({ file: file.name, ...validation });

    if (!validation.isValid) {
      hasErrors = true;
      processedFiles.push(file); // Keep original for error display
      continue;
    }

    // Compress image if needed
    try {
      if (file.type.startsWith('image/') && file.size > FILE_SIZE_LIMITS.IMAGE * 0.5) {
        const compressed = await compressImage(file);
        processedFiles.push(compressed);
      } else {
        processedFiles.push(file);
      }
    } catch (error) {
      validation.errors.push('Lỗi nén ảnh: ' + error.message);
      hasErrors = true;
      processedFiles.push(file);
    }
  }

  // Group validation messages
  const groupedMessages = groupValidationMessages(validationResults);

  return {
    files: processedFiles,
    validationResults,
    hasErrors,
    totalSize: processedFiles.reduce((sum, file) => sum + file.size, 0),
    groupedErrors: groupedMessages.errors,
    groupedWarnings: groupedMessages.warnings
  };
};

/**
 * Create file preview with validation status
 * @param {File} file - File to preview
 * @param {object} validation - Validation result
 * @returns {object} Preview data
 */
export const createFilePreview = (file, validation) => {
  const preview = {
    name: file.name,
    size: file.size,
    type: file.type,
    formattedSize: formatFileSize(file.size),
    isImage: file.type.startsWith('image/'),
    isVideo: file.type.startsWith('video/'),
    url: null,
    validation
  };

  // Create preview URL for images
  if (preview.isImage) {
    preview.url = URL.createObjectURL(file);
  }

  return preview;
};
