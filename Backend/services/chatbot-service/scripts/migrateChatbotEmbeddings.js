import mongoose from 'mongoose';
import axios from 'axios';
import ChatbotEmbedding from './../../../schemas/ChatbotEmbedding.js';

/**
 * Migration script để chuyển đổi tất cả embeddings
 * nomic-embed-text:latest (768 dims)
 */
class EmbeddingMigration {
  constructor() {
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.newModel = 'nomic-embed-text:latest';
    this.newDimension = 768;
    this.batchSize = 5; // Process 5 entries at a time để tránh overload
  }

  /**
   * Tạo embedding với model mới (nomic-embed-text)
   */
  async createNewEmbedding(text) {
    try {
      const response = await axios.post(`${this.ollamaUrl}/api/embeddings`, {
        model: this.newModel,
        prompt: text
      }, {
        timeout: 15000 // 15s timeout
      });

      if (response.data && response.data.embedding) {
        const embedding = response.data.embedding;
        
        if (embedding.length !== this.newDimension) {
          throw new Error(`Expected ${this.newDimension} dimensions, got ${embedding.length}`);
        }
        
        return embedding;
      } else {
        throw new Error('Invalid response from Ollama');
      }
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Embedding creation timeout - check if Ollama is running');
      }
      throw error;
    }
  }

  /**
   * Migrate một batch entries
   */
  async migrateBatch(entries) {
    const results = { success: 0, failed: 0, errors: [] };
    
    for (const entry of entries) {
      try {
        // Tạo embedding mới cho question
        const newEmbedding = await this.createNewEmbedding(entry.question);
        
        // Update entry với embedding mới và metadata
        await ChatbotEmbedding.findByIdAndUpdate(entry._id, {
          embedding: newEmbedding,
          'metadata.embeddingModel': this.newModel,
          'metadata.embeddingDimension': this.newDimension,
          'metadata.migratedAt': new Date(),
          'metadata.originalDimension': entry.embedding?.length || 'unknown'
        });
        
        results.success++;

        // Delay giữa các requests để tránh overload
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        results.failed++;
        results.errors.push({
          entryId: entry._id,
          question: entry.question.substring(0, 50),
          error: error.message
        });
        console.error(`Failed to migrate entry ${entry._id}:`, error.message);
      }
    }
    
    return results;
  }

  /**
   * Chạy migration cho tất cả entries
   */
  async runMigration() {
    try {
      // Connect to MongoDB
      if (!mongoose.connection.readyState) {
        await mongoose.connect(process.env.MONGODB_ATLAS_URI || 
          'mongodb+srv://truongcongduy1052003:uzPzTeC0EZK3QjQs@cluster0.010v8.mongodb.net/SMARTTRO?retryWrites=true&w=majority&appName=Cluster0'
        );
      }

      // Test Ollama connection
      try {
        await axios.get(`${this.ollamaUrl}/api/version`, { timeout: 5000 });
        console.log('Ollama connection successful');
      } catch (error) {
        throw new Error('Cannot connect to Ollama. Please ensure Ollama is running.');
      }

      // Lấy tất cả entries cần migrate
      const totalEntries = await ChatbotEmbedding.countDocuments({ isDeleted: false });

      if (totalEntries === 0) {
        console.log('ℹNo entries to migrate');
        return;
      }

      // Lấy entries theo batch
      let processed = 0;
      let totalResults = { success: 0, failed: 0, errors: [] };

      const totalBatches = Math.ceil(totalEntries / this.batchSize);


      if (totalResults.errors.length > 0) {
        console.log('\nFailed entries:');
        totalResults.errors.forEach(error => {
          console.log(`  - ${error.entryId}: ${error.question}... (${error.error})`);
        });
      }

      // Update collection metadata về dimension mới
      await mongoose.connection.db.collection('chatbot_embeddings').updateMany(
        { isDeleted: false },
        {
          $set: {
            'metadata.currentEmbeddingModel': this.newModel,
            'metadata.currentDimension': this.newDimension
          }
        }
      );

      return totalResults;

    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Rollback migration (khôi phục embeddings cũ nếu có backup)
   */
  async rollbackMigration() {
    // Implementation for rollback if needed
    // Có thể backup embeddings cũ trước khi migrate
  }

  /**
   * Verify migration results
   */
  async verifyMigration() {
    try {
      const entries = await ChatbotEmbedding.find({ isDeleted: false }).limit(5);
      
      for (const entry of entries) {
        if (entry.embedding) {
          console.log(`Entry ${entry._id}: ${entry.embedding.length} dimensions (expected: ${this.newDimension})`);
        }
      }
      
      const stats = await ChatbotEmbedding.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: null,
            avgDimension: { $avg: { $size: '$embedding' } },
            minDimension: { $min: { $size: '$embedding' } },
            maxDimension: { $max: { $size: '$embedding' } },
            totalEntries: { $sum: 1 }
          }
        }
      ]);
      
      if (stats.length > 0) {
        const stat = stats[0];
        console.log(`Migration stats:`);
        console.log(`   Total entries: ${stat.totalEntries}`);
        console.log(`   Avg dimension: ${stat.avgDimension}`);
        console.log(`   Min dimension: ${stat.minDimension}`);
        console.log(`   Max dimension: ${stat.maxDimension}`);
        
        if (stat.minDimension === this.newDimension && stat.maxDimension === this.newDimension) {
          console.log('All embeddings have correct dimensions!');
        } else {
          console.log('Some embeddings may have incorrect dimensions');
        }
      }
      
    } catch (error) {
      console.error('Error verifying migration:', error);
    }
  }
}

// Export for use in other scripts
export default EmbeddingMigration;

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const migration = new EmbeddingMigration();
  
  migration.runMigration()
    .then(async (results) => {
      await migration.verifyMigration();
      console.log('\nMigration process completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
