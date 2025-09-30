import mongoose from 'mongoose';
import axios from 'axios';
import ChatbotEmbedding from '../../../schemas/ChatbotEmbedding.js';

/**
 * Vector Database Service cho MongoDB Atlas
 * Lưu trữ và tìm kiếm semantic embeddings cho chatbot responses
 * Sử dụng Mongoose Schema để quản lý dữ liệu
 */
class VectorService {
  constructor() {
    // MongoDB Atlas connection
    this.mongoUri = process.env.MONGODB_ATLAS_URI || 'mongodb+srv://truongcongduy1052003:uzPzTeC0EZK3QjQs@cluster0.010v8.mongodb.net/SMARTTRO?retryWrites=true&w=majority&appName=Cluster0';
    this.dbName = process.env.VECTOR_DB_NAME || 'SMARTTRO';

    // Ollama embedding settings
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.embeddingModel = process.env.EMBEDDING_MODEL || 'nomic-embed-text:latest'; // Tạm dùng lại để match existing data
    this.embeddingDimension = 768; // nomic-embed-text:latest có 768 dimensions - match với data hiện tại
    this.embeddingTimeout = 15000; // Reduced timeout to 15s for faster response

    // Cache settings - sử dụng cosine similarity trong Node.js
    this.similarityThreshold = 0.95; // Ngưỡng cao để đảm bảo chỉ match khi rất tương đồng
    this.maxCacheSize = 10000; // Giới hạn số lượng entries trong cache
    this.maxSearchDocs = 200; // Giới hạn số docs để tìm kiếm (tối ưu performance)

    this.isConnected = false;
  }

  /**
   * Kết nối tới MongoDB Atlas sử dụng Mongoose
   */
  async connect() {
    try {
      if (this.isConnected || mongoose.connection.readyState === 1) {
        return true; // Đã kết nối rồi
      }
      await mongoose.connect(this.mongoUri, {
        dbName: this.dbName,
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      this.isConnected = true;

      // Tạo text search index cho M0 tier
      await this.ensureTextIndex();
      return true;
    } catch (error) {
      console.error('Failed to connect to MongoDB Atlas:', error);
      return false;
    }
  }

  /**
   * Tạo text search index cho MongoDB (dành cho M0 tier)
   */
  async ensureTextIndex() {
    try {
      const collection = mongoose.connection.db.collection('chatbot_embeddings');
      const indexes = await collection.listIndexes().toArray();
      const hasTextIndex = indexes.some(index => index.name === 'text_index');

      if (!hasTextIndex) {
        try {
          // Tạo text index cho MongoDB (tương thích M0)
          await collection.createIndex({
            question: 'text',
            response: 'text'
          }, {
            name: 'text_index',
            weights: {
              question: 10,
              response: 1
            }
          });

        } catch (indexError) {
        }
      }

    } catch (error) {
      console.error('Error ensuring text index:', error);
    }
  }

  /**
   * Tính cosine similarity giữa hai vectors .
   */
  calculateCosineSimilarity(vectorA, vectorB) {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      magnitudeA += vectorA[i] * vectorA[i];
      magnitudeB += vectorB[i] * vectorB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Tạo embedding vector từ text sử dụng Ollama
   */
  async createEmbedding(text) {
    try {
      const response = await axios.post(`${this.ollamaUrl}/api/embeddings`, {
        model: this.embeddingModel,
        prompt: text.toLowerCase().trim()
      }, {
        timeout: this.embeddingTimeout, // Use configurable timeout (15s)
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.data || !response.data.embedding) {
        throw new Error('Invalid embedding response from Ollama');
      }

      return response.data.embedding;
    } catch (error) {
      console.error('Error creating embedding:', error.message);

      // Fallback: tạo simple hash-based vector nếu Ollama không available
      return this.createSimpleEmbedding(text);
    }
  }

  /**
   * Fallback: Tạo simple embedding từ text hash (768 dimensions cho nomic-embed-text)
   */
  createSimpleEmbedding(text) {
    const words = text.toLowerCase().split(/\s+/);
    const vector = new Array(this.embeddingDimension).fill(0);

    words.forEach((word, index) => {
      const hash = this.simpleHash(word);
      const pos = hash % this.embeddingDimension;
      vector[pos] += 1 / (words.length || 1);
    });

    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(val => magnitude > 0 ? val / magnitude : 0);
  }

  /**
   * Simple hash function
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Lưu câu hỏi và câu trả lời vào vector database
   */
  async saveQnA(question, response, metadata = {}) {
    try {
      await this.connect();

      const questionEmbedding = await this.createEmbedding(question);

      // Kiểm tra xem câu hỏi đã tồn tại chưa với threshold cao hơn (0.95 để tránh duplicate không cần thiết)
      const existing = await this.findSimilarQuestion(question, 0.95);

      if (existing) {
        // Update existing entry using Mongoose chỉ khi thực sự giống nhau
        const existingEntry = await ChatbotEmbedding.findById(existing._id);
        if (existingEntry) {
          existingEntry.response = response;
          existingEntry.metadata = {
            ...existingEntry.metadata,
            ...metadata,
            lastUsed: new Date()
          };
          await existingEntry.incrementUsage();
          console.log('Updated existing Q&A entry:', question.substring(0, 50));
        }
      } else {
        // Insert new entry using Mongoose schema
        const newEmbedding = new ChatbotEmbedding({
          question: question.trim(),
          response: response,
          embedding: questionEmbedding,
          metadata: {
            type: metadata.type || 'room-search-query',
            source: metadata.source || 'ollama',
            usageCount: 1,
            lastUsed: new Date(),
            priority: metadata.priority || 'normal',
            extractedData: metadata.extractedData,
            searchParams: metadata.searchParams,
            processingTimeMs: metadata.processingTimeMs,
            tags: metadata.tags || [],
            createdBy: metadata.createdBy,
            verified: metadata.verified || false,
            adminNotes: metadata.adminNotes || ''
          }
        });

        await newEmbedding.save();
        console.log('Saved new Q&A entry:', question.substring(0, 50));
      }

      // Cleanup old entries nếu vượt quá limit
      await this.cleanupOldEntries();

      return true;
    } catch (error) {
      console.error('Error saving Q&A:', error);
      return false;
    }
  }

  /**
   * Tìm kiếm câu trả lời tương tự sử dụng cosine similarity trong Node.js
   * Tương thích với MongoDB M0 tier (chỉ vector similarity, không metadata filtering)
   * @param {string} question - Câu hỏi cần tìm
   * @param {number} threshold - Ngưỡng similarity (mặc định 0.9)
   */
  async findSimilarQuestion(question, threshold = null, userMetadata = null) {
    try {
      await this.connect();
      const useThreshold = threshold || this.similarityThreshold;
      // Kiểm tra collection có data không
      const totalCount = await ChatbotEmbedding.countDocuments({ isDeleted: false });
      if (totalCount === 0) {
        return null;
      }

      // Tạo embedding cho câu hỏi người dùng.
      const startTime = Date.now();
      const questionEmbedding = await this.createEmbedding(question);
      const embeddingTime = Date.now() - startTime;

      // Lấy các documents từ MongoDB (giới hạn để tối ưu performance)
      const searchLimit = Math.min(this.maxSearchDocs, totalCount);
      const documents = await ChatbotEmbedding.find(
        { isDeleted: false },
        { _id: 1, question: 1, response: 1, embedding: 1, metadata: 1 }
      )
        .sort({ 'metadata.usageCount': -1, createdAt: -1 }) // Ưu tiên docs được dùng nhiều
        .limit(searchLimit)
        .lean();

      // Tính cosine similarity cho từng document
      const similarities = [];
      let validEmbeddings = 0;

      for (const doc of documents) {
        if (!doc.embedding || !Array.isArray(doc.embedding)) {
          continue;
        }

        // Debug dimension mismatch
        if (doc.embedding.length !== questionEmbedding.length) {
          continue;
        }

        validEmbeddings++;
        const similarity = this.calculateCosineSimilarity(questionEmbedding, doc.embedding);

        // Chỉ lưu similarities >= threshold để enforce nghiêm ngặt
        if (similarity >= useThreshold) {
          similarities.push({
            ...doc,
            similarity: similarity,
            score: similarity // Để tương thích với existing code
          });
        }
      }

      // Sắp xếp theo similarity descending
      similarities.sort((a, b) => b.similarity - a.similarity);

      if (similarities.length > 0) {
        const bestMatch = similarities[0];
        // SMART METADATA COMPATIBILITY CHECK
        if (userMetadata && userMetadata.isRoomSearchQuery) {
          const compatibilityResult = this.isMetadataCompatible(userMetadata, bestMatch);
          if (!compatibilityResult.compatible) {

            // SMART PARAMETER MERGING - Thay vì force fresh search
            if (compatibilityResult.mergedParams) {
              console.log(`Using merged parameters for direct property search`);
              console.log(`Merged params:`, compatibilityResult.mergedParams);

              // Trả về special result với merged params để controller xử lý
              return {
                ...bestMatch,
                confidence: bestMatch.similarity,
                source: 'merged_params',
                mergedSearchParams: compatibilityResult.mergedParams,
                originalCachedParams: compatibilityResult.cachedParams,
                userParams: compatibilityResult.userParams,
                needsPropertySearch: true
              };
            } else {

              return null; // Force fresh search
            }
          } else {

          }
        }


        // Double-check threshold để đảm bảo
        if (bestMatch.similarity < useThreshold) {
          console.log(`Best match similarity ${bestMatch.similarity.toFixed(4)} still below threshold ${useThreshold}`);
          return await this.fallbackTextSearch(question);
        }

        // Update usage statistics
        try {
          const entry = await ChatbotEmbedding.findById(bestMatch._id);
          if (entry) {
            await entry.incrementUsage();
            // Clamp similarity score để tránh floating point precision errors
            const clampedSimilarity = Math.min(1.0, Math.max(0.0, bestMatch.similarity));
            await entry.updateSimilarityScore(clampedSimilarity);
          }
        } catch (updateError) {
          console.log('Error updating entry stats:', updateError.message);
        }

        console.log(`Found cached response with cosine similarity: ${bestMatch.similarity.toFixed(4)} for question: "${bestMatch.question.substring(0, 50)}..."`);

        return {
          ...bestMatch,
          confidence: bestMatch.similarity,
          source: 'cosine_similarity'
        };
      } else {
        console.log(`No matches found above threshold ${useThreshold}`);
       
        return null; // Để OllamaService xử lý và tự động lưu kết quả
      }

    } catch (error) {
      console.error('Error in cosine similarity search:', error);

      // Return null để OllamaService xử lý thay vì fallback text search
      console.log('Vector search error - returning null for fresh OllamaService processing');
      return null;
    }
  }

  /**
   * Kiểm tra xem metadata có compatible với cached result không
   */
  isMetadataCompatible(userMetadata, cachedResult) {
    try {
      // Extract cached search params
      let cachedSearchParams = null;

      // Thử lấy từ metadata trước
      if (cachedResult.metadata?.searchParams) {
        cachedSearchParams = cachedResult.metadata.searchParams;
      } else {
        // Fallback: parse từ response
        try {
          const parsedResponse = JSON.parse(cachedResult.response);
          cachedSearchParams = parsedResponse.searchParams;
        } catch (e) {
          console.log('Cannot parse cached response for searchParams');
          return { compatible: false, reason: 'no_cached_params' };
        }
      }

      if (!cachedSearchParams) {
        return { compatible: false, reason: 'no_cached_search_params' };
      }

      const userParams = userMetadata.searchParams;
      if (!userParams) {
        return { compatible: false, reason: 'no_user_params' };
      }

      // So sánh các tham số chính
      const comparisons = {
        provinceId: this.compareParam(userParams.provinceId, cachedSearchParams.provinceId),
        category: this.compareParam(userParams.category, cachedSearchParams.category),
        priceRange: this.comparePriceRange(userParams, cachedSearchParams),
        areaRange: this.compareAreaRange(userParams, cachedSearchParams),
        amenities: this.compareAmenities(userParams.amenities, cachedSearchParams.amenities)
      };

      console.log('Parameter comparisons:', comparisons);

      // Tính compatibility score
      const totalParams = Object.keys(comparisons).length;
      const compatibleParams = Object.values(comparisons).filter(Boolean).length;
      const compatibilityScore = compatibleParams / totalParams;

      console.log(`Compatibility score: ${compatibleParams}/${totalParams} = ${compatibilityScore.toFixed(2)}`);

      // Threshold: 95% compatibility
      const isCompatible = compatibilityScore >= 0.95;

      if (isCompatible) {
        return {
          compatible: true,
          reason: `${(compatibilityScore * 100).toFixed(0)}% compatible`,
          score: compatibilityScore,
          cachedParams: cachedSearchParams,
          userParams: userParams
        };
      } else {
        const incompatibleParams = Object.entries(comparisons)
          .filter(([key, compatible]) => !compatible)
          .map(([key]) => key);

        // CREATE MERGED PARAMETERS - Merge compatible fields từ cache, update incompatible fields từ user
        const mergedParams = this.createMergedParams(userParams, cachedSearchParams, comparisons);

        return {
          compatible: false,
          reason: `incompatible_params: ${incompatibleParams.join(', ')}`,
          score: compatibilityScore,
          cachedParams: cachedSearchParams,
          userParams: userParams,
          mergedParams: mergedParams
        };
      }

    } catch (error) {
      console.log('Error in metadata compatibility check:', error.message);
      return { compatible: false, reason: 'comparison_error' };
    }
  }

  /**
   * Tạo merged parameters từ user input và cached data
   */
  createMergedParams(userParams, cachedParams, comparisons) {
    const merged = { ...cachedParams }; // Start với cached params

    // Update các fields không compatible với user values
    Object.entries(comparisons).forEach(([field, compatible]) => {
      if (!compatible) {
        switch (field) {
          case 'provinceId':
            if (userParams.provinceId) merged.provinceId = userParams.provinceId;
            break;

          case 'category':
            if (userParams.category) merged.category = userParams.category;
            break;

          case 'priceRange':
            if (userParams.minPrice) merged.minPrice = userParams.minPrice;
            if (userParams.maxPrice) merged.maxPrice = userParams.maxPrice;
            break;

          case 'areaRange':
            if (userParams.minArea) merged.minArea = userParams.minArea;
            if (userParams.maxArea) merged.maxArea = userParams.maxArea;
            break;

          case 'amenities':
            if (userParams.amenities) merged.amenities = userParams.amenities;
            break;
        }
      }
    });

    // Ensure other standard fields are present
    merged.sortBy = userParams.sortBy || cachedParams.sortBy || 'createdAt';
    merged.sortOrder = userParams.sortOrder || cachedParams.sortOrder || 'desc';
    merged.page = userParams.page || '1';
    merged.limit = userParams.limit || '8';
    return merged;
  }

  /**
   * So sánh tham số đơn giản (string/number)
   */
  compareParam(userValue, cachedValue) {
    // Nếu user không có value, compatible với bất cứ gì
    if (!userValue) return true;

    // Nếu cached không có value nhưng user có, không compatible
    if (!cachedValue) return false;

    // So sánh trực tiếp
    return userValue === cachedValue;
  }

  /**
   * So sánh price range với tolerance
   */
  comparePriceRange(userParams, cachedParams) {
    const userMin = userParams.minPrice ? parseFloat(userParams.minPrice) : null;
    const userMax = userParams.maxPrice ? parseFloat(userParams.maxPrice) : null;
    const cachedMin = cachedParams.minPrice ? parseFloat(cachedParams.minPrice) : null;
    const cachedMax = cachedParams.maxPrice ? parseFloat(cachedParams.maxPrice) : null;

    // Nếu user không có price constraints, compatible
    if (!userMin && !userMax) return true;

    // Tolerance 10% (stricter than before)
    const tolerance = 0.1;

    let compatible = true;
    let debugInfo = {
      userMin, userMax, cachedMin, cachedMax,
      minDiff: null, maxDiff: null,
      minCompatible: true, maxCompatible: true
    };

    if (userMin && cachedMin) {
      const diff = Math.abs(userMin - cachedMin) / Math.max(userMin, cachedMin);
      debugInfo.minDiff = diff;
      debugInfo.minCompatible = diff <= tolerance;
      if (diff > tolerance) compatible = false;
    }

    if (userMax && cachedMax) {
      const diff = Math.abs(userMax - cachedMax) / Math.max(userMax, cachedMax);
      debugInfo.maxDiff = diff;
      debugInfo.maxCompatible = diff <= tolerance;
      if (diff > tolerance) compatible = false;
    }
    return compatible;
  }

  /**
   * So sánh area range với tolerance
   */
  compareAreaRange(userParams, cachedParams) {
    const userMin = userParams.minArea ? parseFloat(userParams.minArea) : null;
    const userMax = userParams.maxArea ? parseFloat(userParams.maxArea) : null;
    const cachedMin = cachedParams.minArea ? parseFloat(cachedParams.minArea) : null;
    const cachedMax = cachedParams.maxArea ? parseFloat(cachedParams.maxArea) : null;

    // Nếu user không có area constraints, compatible
    if (!userMin && !userMax) return true;

    // Tolerance ±3m2
    const tolerance = 3;

    let compatible = true;

    if (userMin && cachedMin) {
      if (Math.abs(userMin - cachedMin) > tolerance) compatible = false;
    }

    if (userMax && cachedMax) {
      if (Math.abs(userMax - cachedMax) > tolerance) compatible = false;
    }

    return compatible;
  }

  /**
   * So sánh amenities list
   */
  compareAmenities(userAmenities, cachedAmenities) {
    // Nếu user không có amenity requirements, compatible
    if (!userAmenities) return true;

    // Nếu cached không có amenities nhưng user có, không compatible
    if (!cachedAmenities) return false;

    // Convert to arrays nếu cần
    const userIds = typeof userAmenities === 'string' ? userAmenities.split(',') : [];
    const cachedIds = typeof cachedAmenities === 'string' ? cachedAmenities.split(',') : [];

    // Kiểm tra xem user amenities có subset của cached không
    const intersection = userIds.filter(id => cachedIds.includes(id));
    const coverageRatio = intersection.length / userIds.length;

    // Yêu cầu ít nhất 70% amenities match
    return coverageRatio >= 0.7;
  }

  /**
   * Fallback text search khi cosine similarity search thất bại
   */
  async fallbackTextSearch(question) {
    try {
      // Sử dụng Mongoose text search với threshold thấp hơn
      const results = await ChatbotEmbedding.find({
        $text: { $search: question },
        isDeleted: false
      }, {
        score: { $meta: 'textScore' }
      }).sort({ score: { $meta: 'textScore' } }).limit(3).lean();

      console.log(`Text search returned ${results.length} results`);

      if (results.length > 0) {
        // Log scores để debug
        results.forEach((result, index) => {
          console.log(`  Result ${index + 1}: score=${result.score.toFixed(2)}, question="${result.question.substring(0, 40)}..."`);
        });

        const match = results[0];

        // Text search có threshold thấp hơn (MongoDB text scores khác cosine similarity)
        if (match.score >= 0.6) {
          // Update usage statistics
          try {
            const entry = await ChatbotEmbedding.findById(match._id);
            if (entry) {
              await entry.incrementUsage();
            }
          } catch (updateError) {
            console.log('Error updating text search entry stats:', updateError.message);
          }
          return {
            ...match,
            confidence: Math.min(1.0, match.score / 5.0), // Normalize text score về 0-1 range
            source: 'text_search'
          };
        } else {
          console.log(`Text search score ${match.score.toFixed(2)} below threshold 0.6`);
        }
      } else {
        console.log('No text search results found');
      }

      return null;
    } catch (error) {
      console.error('Error in fallback text search:', error.message);
      return null;
    }
  }

  /**
   * Dọn dẹp các entries cũ để giữ cache size
   */
  async cleanupOldEntries() {
    try {
      const result = await ChatbotEmbedding.cleanupOldEntries(this.maxCacheSize);

      if (result.modifiedCount > 0) {
        console.log(`Cleaned up ${result.modifiedCount} old cache entries (soft deleted)`);
      }
    } catch (error) {
      console.error('Error cleaning up old entries:', error);
    }
  }

  /**
   * Lấy thống kê cache sử dụng Mongoose static methods
   */
  async getCacheStats() {
    try {
      await this.connect();

      const totalEntries = await ChatbotEmbedding.countDocuments();
      const recentEntries = await ChatbotEmbedding.findRecentEntries(7).countDocuments();
      const topQuestions = await ChatbotEmbedding.findFrequentlyUsed(5);

      // Lấy thống kê chi tiết
      const statistics = await ChatbotEmbedding.getStatistics();
      const stats = statistics[0] || {};

      return {
        totalEntries,
        recentEntries: recentEntries || 0,
        topQuestions: topQuestions.map(q => ({
          question: q.question.substring(0, 100),
          usageCount: q.metadata.usageCount,
          type: q.metadata.type,
          source: q.metadata.source,
          lastUsed: q.metadata.lastUsed
        })),
        avgUsageCount: stats.avgUsageCount || 0,
        totalUsage: stats.totalUsage || 0,
        avgProcessingTime: stats.avgProcessingTime || 0,
        typeBreakdown: stats.typeBreakdown || [],
        sourceBreakdown: stats.sourceBreakdown || []
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return null;
    }
  }

  /**
   * Đóng kết nối Mongoose
   */
  async close() {
    if (this.isConnected) {
      await mongoose.connection.close();
      this.isConnected = false;
    }
  }

}

export default new VectorService();

