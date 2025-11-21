/**
 * Image Search Controller - Xử lý API tìm kiếm hình ảnh bằng CLIP ONNX (không dùng Ollama)
 */
import imageSearchService from '../service/imageSearchService.js';
import multer from 'multer';

// Configure multer for image upload
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Chỉ chấp nhận file hình ảnh'), false);
    }
});

class ImageSearchController {
    /**
     * Tìm kiếm properties bằng hình ảnh (CLIP)
     */
    async searchByImage(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng upload hình ảnh'
                });
            }

            console.log('Nhận file tìm kiếm:', {
                filename: req.file.originalname,
                size: req.file.size,
                type: req.file.mimetype
            });

            // Get topK from query params or default to 5
            const topK = parseInt(req.query.limit) || 5;
            
            const searchResults = await imageSearchService.processImageSearch(
                req.file.buffer,
                topK
            );
            console.log ("result nhận được:", searchResults);

            // Map results để phù hợp với frontend
            const properties = searchResults.map(result => ({
                ...result.property,
                matchedImage: result.imageUrl,
                embeddingId: result.embeddingId,
                extractedAt: result.metadata?.extractedAt
            }));

            res.json({
                success: true,
                message: `Tìm thấy ${properties.length} kết quả tương tự`,
                data: {
                    uploadedImage: req.file.originalname,
                    properties: properties,
                    pagination: {
                        total: properties.length,
                        page: 1,
                        limit: properties.length,
                        totalPages: 1
                    }
                }
            });

        } catch (error) {
            console.error('Error in searchByImage:', error);

            res.status(500).json({
                success: false,
                message: 'Lỗi khi tìm kiếm hình ảnh',
                error: error.message
            });
        }
    }



}

// Export controller instance + multer
export default new ImageSearchController();
export { upload };
