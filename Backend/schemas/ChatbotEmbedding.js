import mongoose from 'mongoose';

/**
 * Schema cho Chatbot Embeddings - Vector Database
 * Lưu trữ câu hỏi, câu trả lời và embeddings vector cho semantic search
 */

const chatbotEmbeddingSchema = new mongoose.Schema({
  // Câu hỏi gốc từ user
  question: {
    type: String,
    required: true,
    trim: true,
    maxLength: 1000,
    index: true
  },

  // Câu trả lời hoặc search params được cache
  response: {
    type: mongoose.Schema.Types.Mixed, // Có thể là string hoặc object
    required: true
  },

  // Vector embedding của câu hỏi (768 dimensions cho nomic-embed-text)
  embedding: {
    type: [Number],
    required: true,
    validate: {
      validator: function(arr) {
        // Support cả 768 (nomic-embed-text) và 3072 (llama3.2) cho migration period
        return arr.length === 768 || arr.length === 3072;
      },
      message: 'Embedding vector phải có đúng 768 (nomic-embed-text) hoặc 3072 (llama3.2) dimensions'
    }
  },

  // Metadata và thông tin bổ sung
  metadata: {
    // Loại câu hỏi
    type: {
      type: String,
      enum: ['room-search-query', 'non-room-query', 'test', 'seed', 'manual'],
      default: 'room-search-query'
    },

    // Nguồn xử lý
    source: {
      type: String,
      enum: ['ollama', 'quick-check', 'manual', 'seed'],
      default: 'ollama'
    },

    // Thống kê sử dụng
    usageCount: {
      type: Number,
      default: 1,
      min: 0
    },

    lastUsed: {
      type: Date,
      default: Date.now
    },

    // Thời gian xử lý (ms)
    processingTimeMs: {
      type: Number,
      min: 0
    },

    // Priority level
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'critical'],
      default: 'normal'
    },

    // Extracted data từ Ollama (nếu có)
    extractedData: {
      type: mongoose.Schema.Types.Mixed
    },

    // Search params được generate (nếu có)
    searchParams: {
      type: mongoose.Schema.Types.Mixed
    },

    // Tags cho phân loại
    tags: [{
      type: String,
      trim: true
    }],

    // Người tạo (nếu manual)
    createdBy: {
      type: String,
      trim: true
    },

    // Similarity score khi được tìm thấy
    lastSimilarityScore: {
      type: Number,
      min: 0,
      max: 1.1 // Cho phép floating point precision errors
    },

    // Có được verified bởi admin không
    verified: {
      type: Boolean,
      default: false
    },

    // Notes từ admin
    adminNotes: {
      type: String,
      maxLength: 500
    }
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },

  // Soft delete flag
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true, // Tự động cập nhật createdAt và updatedAt
  collection: 'chatbot_embeddings'
});

// Indexes cho performance
chatbotEmbeddingSchema.index({ question: 'text', 'response': 'text' }); // Text search
chatbotEmbeddingSchema.index({ 'metadata.type': 1, 'metadata.priority': -1 });
chatbotEmbeddingSchema.index({ 'metadata.usageCount': -1, 'metadata.lastUsed': -1 });
chatbotEmbeddingSchema.index({ 'metadata.source': 1, createdAt: -1 });
chatbotEmbeddingSchema.index({ isDeleted: 1, createdAt: -1 });

// Virtual cho full response text (để search)
chatbotEmbeddingSchema.virtual('responseText').get(function() {
  if (typeof this.response === 'string') {
    return this.response;
  }
  return JSON.stringify(this.response);
});

// Instance methods
chatbotEmbeddingSchema.methods.incrementUsage = function() {
  this.metadata.usageCount += 1;
  this.metadata.lastUsed = new Date();
  this.updatedAt = new Date();
  return this.save();
};

chatbotEmbeddingSchema.methods.updateSimilarityScore = function(score) {
  this.metadata.lastSimilarityScore = score;
  this.updatedAt = new Date();
  return this.save();
};

chatbotEmbeddingSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.updatedAt = new Date();
  return this.save();
};

chatbotEmbeddingSchema.methods.verify = function(adminNotes = '') {
  this.metadata.verified = true;
  this.metadata.adminNotes = adminNotes;
  this.updatedAt = new Date();
  return this.save();
};

// Static methods
chatbotEmbeddingSchema.statics.findActiveEntries = function() {
  return this.find({ isDeleted: false });
};

chatbotEmbeddingSchema.statics.findByType = function(type) {
  return this.find({ 
    'metadata.type': type,
    isDeleted: false 
  });
};

chatbotEmbeddingSchema.statics.findFrequentlyUsed = function(limit = 10) {
  return this.find({ isDeleted: false })
    .sort({ 'metadata.usageCount': -1, 'metadata.lastUsed': -1 })
    .limit(limit);
};

chatbotEmbeddingSchema.statics.findRecentEntries = function(days = 7, limit = 50) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.find({ 
    createdAt: { $gte: since },
    isDeleted: false 
  })
    .sort({ createdAt: -1 })
    .limit(limit);
};

chatbotEmbeddingSchema.statics.getStatistics = function() {
  return this.aggregate([
    { $match: { isDeleted: false } },
    {
      $group: {
        _id: null,
        totalEntries: { $sum: 1 },
        avgUsageCount: { $avg: '$metadata.usageCount' },
        totalUsage: { $sum: '$metadata.usageCount' },
        avgProcessingTime: { $avg: '$metadata.processingTimeMs' }
      }
    },
    {
      $lookup: {
        from: 'chatbot_embeddings',
        pipeline: [
          { $match: { isDeleted: false } },
          { $group: { _id: '$metadata.type', count: { $sum: 1 } } }
        ],
        as: 'typeBreakdown'
      }
    },
    {
      $lookup: {
        from: 'chatbot_embeddings',
        pipeline: [
          { $match: { isDeleted: false } },
          { $group: { _id: '$metadata.source', count: { $sum: 1 } } }
        ],
        as: 'sourceBreakdown'
      }
    }
  ]);
};

// Cleanup old entries static method
chatbotEmbeddingSchema.statics.cleanupOldEntries = function(maxEntries = 10000) {
  return this.aggregate([
    { $match: { isDeleted: false } },
    { $count: 'total' }
  ]).then(async (countResult) => {
    const totalCount = countResult[0]?.total || 0;
    
    if (totalCount > maxEntries) {
      const excessCount = totalCount - maxEntries;
      
      // Tìm entries ít được sử dụng nhất
      const entriesToDelete = await this.find({ isDeleted: false })
        .sort({
          'metadata.usageCount': 1,
          'metadata.lastUsed': 1
        })
        .limit(excessCount)
        .select('_id');
      
      const idsToDelete = entriesToDelete.map(entry => entry._id);
      
      // Soft delete thay vì xóa hoàn toàn
      return this.updateMany(
        { _id: { $in: idsToDelete } },
        { 
          $set: { 
            isDeleted: true,
            updatedAt: new Date()
          }
        }
      );
    }
    
    return { modifiedCount: 0 };
  });
};

// Pre-save middleware
chatbotEmbeddingSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Pre-find middleware để exclude deleted entries by default
chatbotEmbeddingSchema.pre(/^find/, function() {
  if (!this.getQuery().hasOwnProperty('isDeleted')) {
    this.find({ isDeleted: false });
  }
});

const ChatbotEmbedding = mongoose.model('ChatbotEmbedding', chatbotEmbeddingSchema);

export default ChatbotEmbedding;
