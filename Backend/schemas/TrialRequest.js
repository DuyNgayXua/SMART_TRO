/**
 * TrialRequest Schema - Quản lý yêu cầu dùng thử
 */
import mongoose from 'mongoose';

const trialRequestSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true,
        validate: {
            validator: function(v) {
                return /^[0-9]{10}$/.test(v);
            },
            message: 'Số điện thoại phải có 10 chữ số'
        }
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    notes: {
        type: String,
        default: ''
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: Date,
    rejectedReason: String
}, {
    timestamps: true
});

// Index cho tìm kiếm
trialRequestSchema.index({ email: 1 });
trialRequestSchema.index({ phone: 1 });
trialRequestSchema.index({ status: 1 });
trialRequestSchema.index({ createdAt: -1 });

export default mongoose.model('TrialRequest', trialRequestSchema);
