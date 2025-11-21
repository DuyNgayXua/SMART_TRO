/**
 * Image Embedding Middleware
 * Tự động tạo vector embeddings cho property images sử dụng ResNet50
 * Chạy background để không block response
 */

import imageSearchService from '../../image-search-service/service/imageSearchService.js';
import Property from '../../../schemas/Property.js';

/**
 * Middleware để tạo embeddings cho property images sau khi tạo/cập nhật property
 * Chạy trong background để không ảnh hưởng đến response time
 */
const processImageEmbeddings = async (req, res, next) => {
    console.log('processImageEmbeddings middleware triggered');
    const originalSend = res.send;
    
    // Override send để intercept response
    res.send = function (data) {
        if (res.statusCode === 200 || res.statusCode === 201) {
            try {
                let responseData = data;

                // Nếu là string (do res.json stringify), parse lại
                if (typeof data === 'string') {
                    try {
                        responseData = JSON.parse(data);
                    } catch (parseErr) {
                        console.error('JSON parse error in image embedding middleware:', parseErr.message);
                        // vẫn gửi response bình thường
                    }
                }

                // Chỉ xử lý CASE C: createProperty trả về { success, data: { id } }
                if (responseData && responseData.success && responseData.data?.id) {
                    const propertyId = responseData.data.id;

                    console.log(
                        `Scheduling embedding generation for created property ${propertyId}`
                    );

                    // Chạy background
                    setImmediate(async () => {
                        try {
                            // Lấy lại property để có danh sách images
                            const property = await Property.findById(propertyId)
                                .select('images')
                                .lean();

                            if (!property) {
                                console.log(
                                    `Property ${propertyId} not found in DB, skip embedding generation`
                                );
                                return;
                            }

                            const imageUrls = Array.isArray(property.images)
                                ? property.images
                                : [];

                            if (imageUrls.length === 0) {
                                console.log(
                                    `Property ${propertyId} has no images, skip embedding generation`
                                );
                                return;
                            }

                            console.log(
                                `Starting background embedding generation for property ${propertyId} with ${imageUrls.length} images`
                            );

                            const results =
                                await imageSearchService.processExistingPropertyImages(
                                    propertyId,
                                    imageUrls
                                );

                            console.log(
                                `Generated embeddings for ${results.length}/${imageUrls.length} images of property ${propertyId}`
                            );
                        } catch (error) {
                            console.error(
                                `Error generating embeddings for property ${propertyId}:`,
                                error.message
                            );
                            // không throw để không ảnh hưởng response chính
                        }
                    });
                } else {
                    // Không phải response createProperty có data.id, bỏ qua
                    console.log('Response has no data.id, skip processImageEmbeddings');
                }
            } catch (error) {
                console.error('Error in image embedding middleware:', error.message);
                // không throw để không ảnh hưởng response chính
            }
        }

        // Gửi response lại cho client
        return originalSend.call(this, data);
    };

    next();
};



/**
 * Middleware cho update property - xử lý cả images mới và cũ
 */
// shared/middleware/imageEmbeddingMiddleware.js

const processImageEmbeddingsOnUpdate = async (req, res, next) => {
    console.log('processImageEmbeddingsOnUpdate middleware triggered');
    const originalSend = res.send;

    res.send = function (data) {
        if (res.statusCode === 200) {
            try {
                let responseData = data;

                // Nếu là string (res.json đã stringify), parse lại
                if (typeof data === 'string') {
                    try {
                        responseData = JSON.parse(data);
                    } catch (parseErr) {
                        console.error('JSON parse error in image embedding update middleware:', parseErr.message);
                        // vẫn gửi response xuống client, không throw
                    }
                }

                console.log('Response data in update middleware:', responseData);

                if (responseData && responseData.success) {
                    // Hỗ trợ cả 2 kiểu:
                    // { success, property }  hoặc { success, data: { property } }
                    const property =
                        responseData.property ||
                        responseData.data?.property ||
                        null;

                    const propertyId = property?._id;
                    const currentImages = Array.isArray(property?.images)
                        ? property.images
                        : [];

                    if (propertyId && currentImages.length > 0) {
                        console.log(
                            `Scheduling embedding update for property ${propertyId} with ${currentImages.length} images`
                        );

                        setImmediate(async () => {
                            try {
                                console.log(`Updating embeddings for property ${propertyId}`);

                                // Xóa embeddings cũ
                                await imageSearchService.deleteEmbeddingsByProperty(propertyId);

                                // Tạo embeddings mới
                                const results =
                                    await imageSearchService.processExistingPropertyImages(
                                        propertyId,
                                        currentImages
                                    );

                                console.log(
                                    `Updated embeddings for ${results.length}/${currentImages.length} images of property ${propertyId}`
                                );
                            } catch (error) {
                                console.error(
                                    `Error updating embeddings for property ${propertyId}:`,
                                    error
                                );
                            }
                        });
                    } else {
                        console.log(
                            'ℹ No property/images found in response, skip embedding update'
                        );
                    }
                }
            } catch (error) {
                console.error('Error in image embedding update middleware:', error);
            }
        }

        return originalSend.call(this, data);
    };

    next();
};


export {
    processImageEmbeddings,
    processImageEmbeddingsOnUpdate
};
