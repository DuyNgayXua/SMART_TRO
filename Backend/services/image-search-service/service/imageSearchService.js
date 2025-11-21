/**
 * imageSearchService.js
 * 
 * Image Search Service using ResNet50 via Python FastAPI
 * Google Lens-style visual search for property rentals
 */

import axios from 'axios';
import FormData from 'form-data';
import { ImageEmbedding, Property } from '../../../schemas/index.js';

class ImageSearchService {
    constructor() {
        this.pythonServiceUrl = process.env.PYTHON_IMAGE_SERVICE_URL || 'http://localhost:8001';
        this.modelName = 'ResNet50';
        this.featureDimension = 2048; // ResNet50 feature dimension
        this.serviceHealthy = false;
        this.lastHealthCheck = 0;
        this.healthCheckInterval = 30000; // 30 seconds
    }

    // Kiểm tra Python service health với caching
    async checkPythonService() {
        const now = Date.now();

        // Skip health check if recently checked and was healthy
        if (this.serviceHealthy && (now - this.lastHealthCheck) < this.healthCheckInterval) {
            return true;
        }

        try {
            const response = await axios.get(`${this.pythonServiceUrl}/health`, {
                timeout: 5000
            });

            this.serviceHealthy = response.data.status === 'healthy' && response.data.model_loaded;
            this.lastHealthCheck = now;

            if (this.serviceHealthy) {
                console.log('Python ResNet50 service is ready');
                return true;
            } else {
                console.warn('Python service is still loading ResNet50 model...');
                return false;
            }
        } catch (error) {
            this.serviceHealthy = false;
            this.lastHealthCheck = now;
            console.error('Python service not available:', error.message);

            if (error.code === 'ECONNREFUSED') {
                throw new Error(`Python Image Service không khả dụng tại ${this.pythonServiceUrl}. 
Hãy chạy: cd services/python-image-service && start.bat`);
            } else {
                throw new Error('Python service đang khởi động, vui lòng thử lại sau');
            }
        }
    }

    // Lấy embedding từ ảnh sử dụng Python ResNet50 service
    async extractImageFeatures(imageBuffer) {
        try {
            // Kiểm tra Python service có sẵn không
            await this.checkPythonService();

            console.log('Extracting image features with ResNet50 via Python service...');

            // Tạo FormData để gửi ảnh
            const formData = new FormData();
            formData.append('file', imageBuffer, {
                filename: 'image.jpg',
                contentType: 'image/jpeg'
            });

            // Gửi request đến Python service
            const response = await axios.post(
                `${this.pythonServiceUrl}/extract-features`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                    },
                    timeout: 30000, // 30s timeout cho xử lý ảnh
                }
            );

            if (response.data.success) {
                const { embedding, dimension, extraction_time_ms } = response.data;
                console.log("response.data:", response.data);

                console.log(`Extracted ${dimension}-dimensional ResNet50 features in ${extraction_time_ms}ms`);

                return {
                    embedding: embedding,
                    dimension: dimension
                };
            } else {
                throw new Error('Python service returned unsuccessful response');
            }

        } catch (error) {
            console.error('Error extracting image features:', error.message);

            if (error.code === 'ECONNREFUSED') {
                throw new Error(`Không thể kết nối đến Python Image Service. 
Hãy chạy: cd services/python-image-service && start.bat`);
            } else if (error.response?.status === 400) {
                throw new Error('Định dạng ảnh không hợp lệ hoặc ảnh quá lớn (max 10MB)');
            } else if (error.response?.status === 500) {
                throw new Error('Lỗi xử lý ảnh trong Python service');
            } else {
                throw new Error('Lỗi khi phân tích hình ảnh với ResNet50');
            }
        }
    }



    // Lưu embedding vào MongoDB
    async saveImageEmbedding(propertyId, imageBuffer) {
        const { embedding } = await this.extractImageFeatures(imageBuffer);

        const newEmbedding = new ImageEmbedding({
            propertyId,
            embedding: Array.from(embedding), // lưu dưới dạng Array để MongoDB
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await newEmbedding.save();
        return newEmbedding;
    }

    // Lưu embedding với imageUrl vào MongoDB (để tương thích với hệ thống cũ)
    async storeImageEmbedding(propertyId, imageUrl, embedding, description = '') {
        try {
            console.log('Storing embedding to database...');
            console.log('  - PropertyId:', propertyId);
            console.log('  - ImageUrl:', imageUrl);
            console.log('  - Embedding length:', embedding ? embedding.length : 'null');
            console.log('  - Embedding type:', typeof embedding);

            // Validate embedding
            if (!embedding || !Array.isArray(embedding) && typeof embedding !== 'object') {
                throw new Error('Invalid embedding: must be array or array-like object');
            }

            const embeddingArray = Array.from(embedding);
            console.log('  - Converted to array length:', embeddingArray.length);

            const imageEmbeddingData = new ImageEmbedding({
                propertyId,
                imageUrl,
                embedding: embeddingArray,
                description,
                metadata: {
                    extractedAt: new Date(),
                    modelVersion: this.modelName,
                    vectorDimension: embeddingArray.length
                }
            });

          
            const saved = await imageEmbeddingData.save();
            console.log(`Successfully saved embedding with ID: ${saved._id}`);

            // Verify save
            const verification = await ImageEmbedding.findById(saved._id);
            console.log('Verification - embedding exists in DB:', !!verification);
            if (verification) {
                console.log('  - DB embedding length:', verification.embedding.length);
            }

            return saved;
        } catch (error) {
            console.error('Error storing embedding:', error.message);
            console.error('Error stack:', error.stack);
            throw error;
        }
    }

    // Tìm kiếm ảnh gần nhất theo cosine similarity
    async searchByEmbedding(queryEmbedding, topK = 5) {
        console.log('Starting searchByEmbedding...');
        console.log('Query embedding length:', queryEmbedding.length);

        topK = parseInt(topK) || 5;

        const MIN_SCORE = 0.65;

        const embeddings = await ImageEmbedding.find();
        console.log(`Found ${embeddings.length} embeddings in database`);

        if (embeddings.length === 0) {
            console.log('No embeddings found in database!');
            return [];
        }

        // --- TÍNH SIMILARITY CHO TỪNG ẢNH ---
        const similarity = embeddings.map((item) => {
            try {
                if (!item.embedding || !Array.isArray(item.embedding) || item.embedding.length === 0) {
                    return { item, score: 0 };
                }

                if (item.embedding.length !== queryEmbedding.length) {
                    return { item, score: 0 };
                }

                const dot = item.embedding.reduce(
                    (sum, val, i) => sum + val * queryEmbedding[i],
                    0
                );

                const normA = Math.sqrt(item.embedding.reduce((sum, val) => sum + val * val, 0));
                const normB = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0));
                const score = dot / (normA * normB + 1e-10);

                return { item, score: Number(score) };
            } catch (error) {
                console.error('Error calculating similarity:', error);
                return { item, score: 0 };
            }
        });

        const validSimilarity = similarity.filter(
            s => s.item && !isNaN(s.score) && isFinite(s.score)
        );

        if (validSimilarity.length === 0) {
            console.log("No valid similarity scores!");
            return [];
        }

        // Sắp xếp giảm dần
        validSimilarity.sort((a, b) => b.score - a.score);

        console.log('Raw top scores:', validSimilarity.slice(0, 5).map(s => ({
            score: s.score.toFixed(4),
            imageUrl: s.item.imageUrl
        })));

        // Lọc theo threshold
        const strongMatches = validSimilarity.filter(s => s.score >= MIN_SCORE);

        console.log(`Matches >= ${MIN_SCORE}: ${strongMatches.length}`);

        if (strongMatches.length === 0) {
            console.log(`No matches above MIN_SCORE (${MIN_SCORE}).`);
            return [];
        }

        // GỘP THEO propertyId — CHỈ LẤY ẢNH NÀO SCORE CAO NHẤT 

        const grouped = new Map();

        for (const { item, score } of strongMatches) {
            const pid = item.propertyId.toString();

            // Nếu chưa có hoặc score cao hơn → cập nhật
            if (!grouped.has(pid) || score > grouped.get(pid).score) {
                grouped.set(pid, {
                    item,
                    score
                });
            }
        }

        console.log(`Grouped into ${grouped.size} unique properties`);

        // Convert map → array
        const groupedResults = Array.from(grouped.values())
            .sort((a, b) => b.score - a.score)   // sort giảm dần
            .slice(0, topK);                     // lấy topK

        console.log("Final unique-property results:", groupedResults.map(g => ({
            propertyId: g.item.propertyId,
            score: g.score.toFixed(4),
            imageUrl: g.item.imageUrl
        })));

        // Trả về đúng format 
        return groupedResults.map(g => g.item);
    }



    // Xử lý upload ảnh và tìm kiếm
    async processImageSearch(imageBuffer, topK = 5) {
        console.log('processImageSearch called with topK:', topK, 'type:', typeof topK);
        const { embedding } = await this.extractImageFeatures(imageBuffer);
        const similarEmbeddings = await this.searchByEmbedding(embedding, topK);

        // Build query object cho properties hợp lệ
        const now = new Date();
        const propertyQuery = {
            approvalStatus: 'approved',
            status: 'available',
            isDeleted: { $ne: true },
            $and: [
                {
                    $or: [
                        { 'packageInfo.expiryDate': { $gt: now } }, // Gói còn hiệu lực theo thời gian
                        { 'packageInfo.expiryDate': { $exists: false } }, // Không có thông tin gói
                        { 'packageInfo.expiryDate': null } // Gói không có ngày hết hạn
                    ]
                },
                {
                    $or: [
                        { 'packageInfo.isActive': true }, // Gói đang active
                        { 'packageInfo.isActive': { $exists: false } }, // Không có thông tin isActive (tin miễn phí)
                        { 'packageInfo.isActive': null } // isActive null (tin miễn phí)
                    ]
                }
            ]
        };

        // Lấy property IDs từ similar embeddings
        const propertyIds = similarEmbeddings.map(embedding => embedding.propertyId);
        
        if (propertyIds.length === 0) {
            console.log('No similar embeddings found');
            return [];
        }

        // Add property ID filter to query
        propertyQuery._id = { $in: propertyIds };

        console.log(`Searching for ${propertyIds.length} properties with validity conditions`);

        // Lấy properties với populate và điều kiện lọc
        const validProperties = await Property.find(propertyQuery)
            .populate('owner', 'fullName email phone avatar')
            .populate('amenities', 'name icon')
            .populate('packageInfo.plan', 'name displayName type priority color stars textStyle')
            .populate('packageInfo.postType', 'name displayName priority color stars textStyle')
            .lean();

        console.log(`Found ${validProperties.length} valid properties after filtering`);

        // Map back to results with imageUrl and metadata
        const results = validProperties.map(property => {
            // Find the corresponding embedding for this property
            const correspondingEmbedding = similarEmbeddings.find(
                embedding => embedding.propertyId.toString() === property._id.toString()
            );

            return {
                property,
                imageUrl: correspondingEmbedding?.imageUrl || property.images?.[0],
                embeddingId: correspondingEmbedding?._id,
                metadata: correspondingEmbedding?.metadata,
                matchedImage: correspondingEmbedding?.imageUrl // Thêm trường để hiển thị ảnh được match
            };
        });

        // Maintain order based on similarity scores from similarEmbeddings
        const orderedResults = [];
        for (const embedding of similarEmbeddings) {
            const matchingResult = results.find(
                result => result.property._id.toString() === embedding.propertyId.toString()
            );
            if (matchingResult) {
                orderedResults.push(matchingResult);
            }
        }

        console.log(`processImageSearch returning ${orderedResults.length} valid results with full property data`);
        return orderedResults;
    }

    /**
     * Xử lý ảnh từ URL và tạo embedding (dùng cho middleware)
     */
    async processExistingPropertyImages(propertyId, imageUrls) {
        console.log(`Processing ${imageUrls.length} images for property ${propertyId}`);

        const results = [];

        for (const imageUrl of imageUrls) {
            try {
                console.log(`Processing image: ${imageUrl}`);

                // Fetch ảnh từ S3
                const response = await fetch(imageUrl);
                if (!response.ok) {
                    console.log(`Failed to fetch image: ${response.status}`);
                    continue;
                }

                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                console.log(`Downloaded image, size: ${buffer.length} bytes`);

                // Extract embedding
              
                const { embedding } = await this.extractImageFeatures(buffer);
                console.log(`Extracted embedding, dimension: ${embedding.length}`);

                // Lưu vào database
               
                const saved = await this.storeImageEmbedding(propertyId, imageUrl, embedding);
                console.log(`Saved embedding with ID: ${saved._id}`);

                results.push(saved);

                console.log(`Successfully processed: ${imageUrl}`);

            } catch (error) {
                console.error(`Error processing image ${imageUrl}:`, error.message);
                console.error('Error stack:', error.stack);
            }
        }

        console.log(`Completed processing ${results.length}/${imageUrls.length} images for property ${propertyId}`);
        return results;
    }

   
    /**
     * Xóa embeddings của 1 property cụ thể (dùng khi update property)
     */
    async deleteEmbeddingsByProperty(propertyId) {
        try {
            const result = await ImageEmbedding.deleteMany({ propertyId });
            console.log(`Deleted ${result.deletedCount} embeddings for property ${propertyId}`);
            return result;
        } catch (error) {
            console.error('Error deleting embeddings:', error);
            throw error;
        }
    }

    /**
     * Debug: Kiểm tra database connection và embeddings
     */
    async debugDatabaseConnection() {
        try {
            console.log('Debugging database connection...');

            // Check if model is available
            console.log('ImageEmbedding model:', typeof ImageEmbedding);

            // Count total documents
            const total = await ImageEmbedding.countDocuments();
            console.log(`Total embeddings in database: ${total}`);

            // Get sample documents
            const samples = await ImageEmbedding.find().limit(3);
            console.log(`Sample documents (${samples.length}):`);

            samples.forEach((doc, index) => {
                console.log(`  ${index + 1}. ID: ${doc._id}`);
                console.log(`     PropertyId: ${doc.propertyId}`);
                console.log(`     ImageUrl: ${doc.imageUrl}`);
                console.log(`     Embedding length: ${doc.embedding ? doc.embedding.length : 'null'}`);
                console.log(`     Model: ${doc.metadata?.modelVersion}`);
                console.log(`     Created: ${doc.createdAt}`);
            });

            return { total, samples: samples.length };
        } catch (error) {
            console.error('Database debug error:', error.message);
            throw error;
        }
    }

    /**
     * Lấy thống kê embeddings
     */
    async getEmbeddingStats() {
        const total = await ImageEmbedding.countDocuments();
        const propertiesWithEmbeddings = await ImageEmbedding.distinct('propertyId');

        return {
            totalEmbeddings: total,
            propertiesWithEmbeddings: propertiesWithEmbeddings.length,
            averageEmbeddingsPerProperty: propertiesWithEmbeddings.length > 0 ?
                (total / propertiesWithEmbeddings.length).toFixed(2) : 0
        };
    }
}

export default new ImageSearchService();
