/**
 * ModerationLog Schema  
 * Schema cho log các kết quả kiểm duyệt
 */
import mongoose from 'mongoose';

const moderationLogSchema = new mongoose.Schema({
  uploadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Upload',
    required: true
  },
  publicId: {
    type: String,
    required: true
  },
  moderationType: {
    type: String,
    enum: ['ai_moderation', 'manual_review', 'auto_scan', 'webhook'],
    default: 'ai_moderation'
  },
  results: {
    isApproved: { type: Boolean, required: true },
    status: { 
      type: String, 
      enum: ['approved', 'rejected', 'pending', 'review_needed'],
      required: true 
    },
    confidence: { 
      type: Number, 
      min: 0, 
      max: 1,
      required: true
    },
    categories: {
      violence: { type: Number, default: 0, min: 0, max: 1 },
      weapons: { type: Number, default: 0, min: 0, max: 1 },
      gore: { type: Number, default: 0, min: 0, max: 1 },
      explicit: { type: Number, default: 0, min: 0, max: 1 },
      drugs: { type: Number, default: 0, min: 0, max: 1 }
    },
    rejectedReasons: [{
      category: {
        type: String,
        enum: ['violence', 'weapons', 'gore', 'explicit', 'drugs', 'other']
      },
      score: { type: Number, min: 0, max: 1 },
      threshold: { type: Number, min: 0, max: 1 },
      message: String
    }],
    moderationStatus: String,
    details: String
  },
  status: {
    type: String,
    enum: ['approved', 'rejected', 'pending', 'review_needed'],
    required: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    required: true
  },
  categories: {
    violence: { type: Number, default: 0 },
    weapons: { type: Number, default: 0 },
    gore: { type: Number, default: 0 },
    explicit: { type: Number, default: 0 },
    drugs: { type: Number, default: 0 }
  },
  rejectedReasons: [{
    type: String,
    enum: ['violence', 'weapons', 'gore', 'explicit', 'drugs', 'other']
  }],
  moderatedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  moderatedBy: {
    type: String, // 'system', 'admin', userId
    default: 'system',
    required: true
  },
  processingTime: {
    type: Number, // milliseconds
    default: 0
  },
  apiResponse: {
    cloudinaryData: mongoose.Schema.Types.Mixed,
    rawResponse: mongoose.Schema.Types.Mixed,
    errors: [String]
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    requestId: String,
    modelVersion: String,
    thresholds: {
      violence: Number,
      weapons: Number,
      gore: Number,
      explicit: Number,
      drugs: Number
    }
  },
  reviewStatus: {
    needsReview: { type: Boolean, default: false },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewComments: String,
    reviewDecision: {
      type: String,
      enum: ['approve', 'reject', 'escalate']
    }
  },
  appeals: [{
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submittedAt: { type: Date, default: Date.now },
    reason: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewComments: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
moderationLogSchema.index({ uploadId: 1 });
moderationLogSchema.index({ publicId: 1 });
moderationLogSchema.index({ status: 1 });
moderationLogSchema.index({ moderationType: 1 });
moderationLogSchema.index({ moderatedAt: -1 });
moderationLogSchema.index({ confidence: -1 });
moderationLogSchema.index({ 'results.status': 1 });
moderationLogSchema.index({ moderatedBy: 1 });

// Compound indexes
moderationLogSchema.index({ status: 1, moderatedAt: -1 });
moderationLogSchema.index({ uploadId: 1, moderatedAt: -1 });
moderationLogSchema.index({ moderationType: 1, status: 1 });

// Virtual for upload reference
moderationLogSchema.virtual('upload', {
  ref: 'Upload',
  localField: 'uploadId',
  foreignField: '_id',
  justOne: true
});

// Instance methods
moderationLogSchema.methods.isRejected = function() {
  return this.status === 'rejected';
};

moderationLogSchema.methods.isApproved = function() {
  return this.status === 'approved';
};

moderationLogSchema.methods.needsHumanReview = function() {
  return this.reviewStatus.needsReview || this.status === 'review_needed';
};

moderationLogSchema.methods.addAppeal = function(userId, reason) {
  this.appeals.push({
    submittedBy: userId,
    reason: reason,
    status: 'pending'
  });
  return this.save();
};

moderationLogSchema.methods.processAppeal = function(reviewerId, decision, comments) {
  const latestAppeal = this.appeals[this.appeals.length - 1];
  if (latestAppeal && latestAppeal.status === 'pending') {
    latestAppeal.status = decision;
    latestAppeal.reviewedBy = reviewerId;
    latestAppeal.reviewedAt = new Date();
    latestAppeal.reviewComments = comments;
  }
  return this.save();
};

// Static methods
moderationLogSchema.statics.findByUpload = function(uploadId) {
  return this.find({ uploadId }).sort({ moderatedAt: -1 });
};

moderationLogSchema.statics.findRejected = function(options = {}) {
  const query = this.find({ status: 'rejected' });
  
  if (options.category) {
    query.where({ rejectedReasons: options.category });
  }
  
  if (options.fromDate) {
    query.where({ moderatedAt: { $gte: options.fromDate } });
  }
  
  if (options.toDate) {
    query.where({ moderatedAt: { $lte: options.toDate } });
  }
  
  return query.sort({ moderatedAt: -1 });
};

moderationLogSchema.statics.getStatsByTimeRange = function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        moderatedAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          status: '$status',
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$moderatedAt'
            }
          }
        },
        count: { $sum: 1 },
        avgConfidence: { $avg: '$confidence' }
      }
    },
    {
      $sort: { '_id.date': -1 }
    }
  ]);
};

moderationLogSchema.statics.getCategoryStats = function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        moderatedAt: { $gte: startDate },
        status: 'rejected'
      }
    },
    {
      $unwind: '$rejectedReasons'
    },
    {
      $group: {
        _id: '$rejectedReasons',
        count: { $sum: 1 },
        avgScore: { $avg: '$confidence' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

// Pre middleware
moderationLogSchema.pre('save', function(next) {
  // Auto-set needsReview flag based on confidence
  if (this.confidence < 0.8 && this.status === 'rejected') {
    this.reviewStatus.needsReview = true;
  }
  next();
});

// Post middleware
moderationLogSchema.post('save', async function(doc) {
  // Update parent Upload document if needed
  if (doc.status === 'rejected') {
    await mongoose.model('Upload').findByIdAndUpdate(doc.uploadId, {
      status: 'rejected',
      'moderation.status': 'rejected'
    });
  }
});

const ModerationLog = mongoose.model('ModerationLog', moderationLogSchema);
export default ModerationLog;
