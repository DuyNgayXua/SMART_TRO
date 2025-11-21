/**
 * Image Search API - Xử lý tìm kiếm trọ bằng hình ảnh
 */
import api from './api.js';

class ImageSearchAPI {
    /**
     * Tìm kiếm properties bằng hình ảnh
     * @param {File} imageFile - File hình ảnh để tìm kiếm
     * @returns {Promise<Object>} Kết quả tìm kiếm
     */
    async searchByImage(imageFile) {
        try {
            if (!imageFile) {
                throw new Error('Vui lòng chọn hình ảnh để tìm kiếm');
            }

            // Validate file type
            if (!imageFile.type.startsWith('image/')) {
                throw new Error('File được chọn phải là hình ảnh');
            }

            // Validate file size (5MB)
            if (imageFile.size > 5 * 1024 * 1024) {
                throw new Error('Kích thước hình ảnh không được vượt quá 5MB');
            }

            // Create FormData
            const formData = new FormData();
            formData.append('image', imageFile);

            // Call API
            const response = await api.post('/image-search/search', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            console.log('Image search response:', response);

            return response.data;

        } catch (error) {
            console.error('Error searching by image:', error);
            throw error;
        }
    }

    /**
     * Xử lý embeddings cho property cụ thể
     * @param {string} propertyId - ID của property
     * @returns {Promise<Object>} Kết quả xử lý
     */
    async processPropertyImages(propertyId) {
        try {
            const response = await api.post(`/image-search/process/${propertyId}`);
            return response.data;

        } catch (error) {
            console.error('Error processing property images:', error);
            throw error;
        }
    }

    /**
     * Batch processing tất cả properties (Admin only)
     * @returns {Promise<Object>} Kết quả batch processing
     */
    async batchProcessAllProperties() {
        try {
            const response = await api.post('/image-search/batch-process');
            return response.data;

        } catch (error) {
            console.error('Error starting batch processing:', error);
            throw error;
        }
    }

    /**
     * Lấy thống kê về embeddings
     * @returns {Promise<Object>} Thống kê embeddings
     */
    async getEmbeddingStats() {
        try {
            const response = await api.get('/image-search/stats');
            return response.data;

        } catch (error) {
            console.error('Error getting embedding stats:', error);
            throw error;
        }
    }

    /**
     * Test CLIP model connection
     * @returns {Promise<Object>} Trạng thái CLIP model
     */
    async testCLIPConnection() {
        try {
            const response = await api.get('/image-search/test-clip');
            return response.data;

        } catch (error) {
            console.error('Error testing CLIP connection:', error);
            throw error;
        }
    }

    /**
     * Validate image file trước khi upload
     * @param {File} file - File cần validate
     * @returns {Object} Kết quả validation
     */
    validateImageFile(file) {
        const errors = [];
        const maxSize = 5 * 1024 * 1024; // 5MB
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

        if (!file) {
            errors.push('Vui lòng chọn file hình ảnh');
            return { isValid: false, errors };
        }

        if (!allowedTypes.includes(file.type)) {
            errors.push('Chỉ chấp nhận file hình ảnh định dạng JPG, PNG, WEBP');
        }

        if (file.size > maxSize) {
            errors.push('Kích thước file không được vượt quá 5MB');
        }

        return {
            isValid: errors.length === 0,
            errors,
            fileInfo: {
                name: file.name,
                size: file.size,
                type: file.type,
                sizeFormatted: this.formatFileSize(file.size)
            }
        };
    }

    /**
     * Format file size để hiển thị
     * @param {number} bytes - Kích thước file tính bằng bytes
     * @returns {string} Kích thước file đã format
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Tạo preview URL cho hình ảnh
     * @param {File} file - File hình ảnh
     * @returns {string} URL preview
     */
    createImagePreview(file) {
        if (!file || !file.type.startsWith('image/')) {
            return null;
        }
        return URL.createObjectURL(file);
    }

    /**
     * Cleanup preview URL
     * @param {string} url - URL preview cần cleanup
     */
    cleanupImagePreview(url) {
        if (url && url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
        }
    }
}

export default new ImageSearchAPI();