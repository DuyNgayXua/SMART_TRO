import mongoose from 'mongoose';

const amenitySchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true // Bắt buộc có owner (chủ trọ)
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  icon: {
    type: String,
    default: 'fas fa-check'
  },
  category: {
    type: String,
    enum: ['furniture', 'appliance', 'utility', 'service', 'other'],
    default: 'other'
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for better performance
amenitySchema.index({ owner: 1, category: 1, displayOrder: 1 });
amenitySchema.index({ owner: 1, isActive: 1 });

export default mongoose.model('Amenity', amenitySchema);
