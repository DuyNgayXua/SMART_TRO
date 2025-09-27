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
    this.embeddingDimension = 768; // llama3.2 có 768 dimensions - match với data hiện tại
    this.embeddingTimeout = 15000; // Reduced timeout to 15s for faster response
    
    // Cache settings - sử dụng cosine similarity trong Node.js
    this.similarityThreshold = 0.3; // Ngưỡng cosine similarity để match câu hỏi
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

      console.log('Connecting to MongoDB Atlas Vector DB via Mongoose...');
      
      await mongoose.connect(this.mongoUri, {
        dbName: this.dbName,
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      
      this.isConnected = true;
      
      // Tạo text search index cho M0 tier
      await this.ensureTextIndex();
      
      console.log('Connected to MongoDB Atlas Vector DB successfully');
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
        console.log('Creating text search index...');
        
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
          
          console.log('Text search index created successfully');
        } catch (indexError) {
          console.log('Text search index creation failed:', indexError.message);
        }
      }
      
    } catch (error) {
      console.error('Error ensuring text index:', error);
    }
  }

  /**
   * Tính cosine similarity giữa hai vectors
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
      
      // Kiểm tra xem câu hỏi đã tồn tại chưa (similarity > 0.3)
      const existing = await this.findSimilarQuestion(question, 0.3);
      
      if (existing) {
        // Update existing entry using Mongoose
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
   * Tương thích với MongoDB M0 tier
   */
  async findSimilarQuestion(question, threshold = null) {
    try {
      await this.connect();
      
      const useThreshold = threshold || this.similarityThreshold;
      console.log(`Searching for similar question with threshold: ${useThreshold}`);
      
      // Kiểm tra collection có data không
      const totalCount = await ChatbotEmbedding.countDocuments({ isDeleted: false });
      console.log(`Collection has ${totalCount} active documents`);
      
      if (totalCount === 0) {
        console.log('No active data in collection');
        return null;
      }
      
      // Tạo embedding cho câu hỏi người dùng
      const startTime = Date.now();
      const questionEmbedding = await this.createEmbedding(question);
      const embeddingTime = Date.now() - startTime;
      console.log(`Created embedding with ${questionEmbedding.length} dimensions in ${embeddingTime}ms`);
      
      // Lấy các documents từ MongoDB (giới hạn để tối ưu performance)
      const searchLimit = Math.min(this.maxSearchDocs, totalCount);
      const documents = await ChatbotEmbedding.find(
        { isDeleted: false },
        { _id: 1, question: 1, response: 1, embedding: 1, metadata: 1 }
      )
      .sort({ 'metadata.usageCount': -1, createdAt: -1 }) // Ưu tiên docs được dùng nhiều
      .limit(searchLimit)
      .lean();
      
      console.log(`Loaded ${documents.length} documents for similarity search`);
      
      // Tính cosine similarity cho từng document
      const similarities = [];
      let validEmbeddings = 0;
      
      for (const doc of documents) {
        if (!doc.embedding || !Array.isArray(doc.embedding)) {
          console.log(`Skipping doc ${doc._id}: no embedding`);
          continue;
        }
        
        // Debug dimension mismatch
        if (doc.embedding.length !== questionEmbedding.length) {
          console.log(`Dimension mismatch: question=${questionEmbedding.length}, doc=${doc.embedding.length} - skipping doc ${doc._id}`);
          continue;
        }
        
        validEmbeddings++;
        const similarity = this.calculateCosineSimilarity(questionEmbedding, doc.embedding);
        
        // Sử dụng threshold thấp hơn để test
        if (similarity >= 0.1) {
          similarities.push({
            ...doc,
            similarity: similarity,
            score: similarity // Để tương thích với existing code
          });
        }
      }
      
      console.log(`Processed ${validEmbeddings} valid embeddings, found ${similarities.length} matches above threshold`);
      
      // Sắp xếp theo similarity descending
      similarities.sort((a, b) => b.similarity - a.similarity);
      
      if (similarities.length > 0) {
        const bestMatch = similarities[0];
        
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
        console.log(`No matches found above threshold ${useThreshold}, trying text search fallback`);
        return await this.fallbackTextSearch(question);
      }
      
    } catch (error) {
      console.error('Error in cosine similarity search:', error);
      
      // Final fallback: text search
      console.log('Falling back to text search due to error');
      return await this.fallbackTextSearch(question);
    }
  }

  /**
   * Fallback text search khi cosine similarity search thất bại
   */
  async fallbackTextSearch(question) {
    try {
      console.log('Attempting text search fallback for:', question.substring(0, 50) + '...');
      
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
          
          console.log(`Found cached response via text search with score: ${match.score.toFixed(2)}`);
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

  /**
   * Thêm methods helper để quản lý embeddings
   */

  // Tìm entries theo type
  async findByType(type) {
    await this.connect();
    return ChatbotEmbedding.findByType(type);
  }

  // Tìm entries thường được sử dụng
  async getFrequentlyUsed(limit = 10) {
    await this.connect();
    return ChatbotEmbedding.findFrequentlyUsed(limit);
  }

  // Tìm entries gần đây
  async getRecentEntries(days = 7, limit = 50) {
    await this.connect();
    return ChatbotEmbedding.findRecentEntries(days, limit);
  }

  // Verify một entry (admin function)
  async verifyEntry(entryId, adminNotes = '') {
    await this.connect();
    const entry = await ChatbotEmbedding.findById(entryId);
    if (entry) {
      return entry.verify(adminNotes);
    }
    return null;
  }

  // Soft delete một entry
  async deleteEntry(entryId) {
    await this.connect();
    const entry = await ChatbotEmbedding.findById(entryId);
    if (entry) {
      return entry.softDelete();
    }
    return null;
  }

  // Tìm kiếm entries với filters
  async searchEntries(filters = {}, limit = 20) {
    await this.connect();
    const query = { isDeleted: false };
    
    if (filters.type) query['metadata.type'] = filters.type;
    if (filters.source) query['metadata.source'] = filters.source;
    if (filters.verified !== undefined) query['metadata.verified'] = filters.verified;
    if (filters.question) query.question = new RegExp(filters.question, 'i');
    
    return ChatbotEmbedding.find(query)
      .sort({ 'metadata.usageCount': -1, createdAt: -1 })
      .limit(limit);
  }
}

export default new VectorService();
