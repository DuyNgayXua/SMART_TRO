/**
 * Upload Schema
 * Schema cho thông tin file upload
 */
import mongoose from 'mongoose';

const uploadSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    trim: true
  },
  originalName: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true
  },
  publicId: {
    type: String,
    required: true,
    unique: true
  },
  size: {
    type: Number,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  folder: {
    type: String,
    default: 'smart_tro/uploads'
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['approved', 'rejected', 'pending', 'deleted'],
    default: 'approved'
  },
  moderation: {
    isApproved: { type: Boolean, default: true },
    status: { type: String, default: 'approved' },
    confidence: { type: Number, min: 0, max: 1 },
    categories: {
      violence: { type: Number, default: 0 },
      weapons: { type: Number, default: 0 },
      gore: { type: Number, default: 0 },
      explicit: { type: Number, default: 0 },
      drugs: { type: Number, default: 0 }
    },
    rejectedReasons: [{
      category: String,
      score: Number,
      threshold: Number,
      message: String
    }],
    moderationStatus: String,
    details: String
  },
  metadata: {
    width: Number,
    height: Number,
    format: String,
    bytes: Number,
    colorAnalysis: mongoose.Schema.Types.Mixed,
    faces: [mongoose.Schema.Types.Mixed],
    quality: mongoose.Schema.Types.Mixed
  },
  tags: [String],
  transformation: [mongoose.Schema.Types.Mixed],
  downloads: {
    type: Number,
    default: 0
  },
  lastAccessed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
uploadSchema.index({ uploadedBy: 1, uploadedAt: -1 });
uploadSchema.index({ publicId: 1 }, { unique: true });
uploadSchema.index({ status: 1 });
uploadSchema.index({ 'moderation.status': 1 });
uploadSchema.index({ folder: 1 });
uploadSchema.index({ mimetype: 1 });
uploadSchema.index({ uploadedAt: -1 });

// Virtual for moderation logs
uploadSchema.virtual('moderationLogs', {
  ref: 'ModerationLog',
  localField: '_id',
  foreignField: 'uploadId'
});

// Instance methods
uploadSchema.methods.isOwner = function(userId) {
  return this.uploadedBy.toString() === userId.toString();
};

uploadSchema.methods.incrementDownloads = function() {
  this.downloads += 1;
  this.lastAccessed = new Date();
  return this.save();
};

uploadSchema.methods.updateModeration = function(moderationData) {
  this.moderation = { ...this.moderation, ...moderationData };
  this.updatedAt = new Date();
  return this.save();
};

// Static methods
uploadSchema.statics.findByPublicId = function(publicId) {
  return this.findOne({ publicId });
};

uploadSchema.statics.findByUser = function(userId, options = {}) {
  const query = this.find({ uploadedBy: userId });
  
  if (options.status) {
    query.where({ status: options.status });
  }
  
  if (options.folder) {
    query.where({ folder: options.folder });
  }
  
  return query.sort({ uploadedAt: -1 });
};

uploadSchema.statics.getStatsForUser = function(userId) {
  return this.aggregate([
    { $match: { uploadedBy: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalSize: { $sum: '$size' }
      }
    }
  ]);
};

// Pre middleware
uploadSchema.pre('save', function(next) {
  if (this.isModified()) {
    this.updatedAt = new Date();
  }
  next();
});

// Post middleware
uploadSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    // Xóa moderation logs khi xóa upload
    await mongoose.model('ModerationLog').deleteMany({ uploadId: doc._id });
  }
});

const Upload = mongoose.model('Upload', uploadSchema);
export default Upload;
