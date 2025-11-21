/**
 * ImageEmbedding Schema - Lưu trữ vector embedding của hình ảnh
 */
import mongoose from 'mongoose';

const imageEmbeddingSchema = new mongoose.Schema({
    propertyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property',
        required: true,
        index: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    embedding: {
        type: [Number],
        required: true,
        validate: {
            validator: function(v) {
                return v && v.length > 0;
            },
            message: 'Embedding vector không được trống'
        }
    },
    description: {
        type: String, // Mô tả từ LLaVA model
        default: ''
    },
    metadata: {
        extractedAt: {
            type: Date,
            default: Date.now
        },
        modelVersion: {
            type: String,
            default: 'ResNet50'
        },
        vectorDimension: {
            type: Number,
            default: 2048
        }
    }
}, {
    timestamps: true
});

// Index cho tìm kiếm vector
imageEmbeddingSchema.index({ 
    propertyId: 1, 
    'metadata.extractedAt': -1 
});

// Index cho tối ưu tìm kiếm
imageEmbeddingSchema.index({ 
    embedding: "2dsphere" 
});

export default mongoose.model('ImageEmbedding', imageEmbeddingSchema);
