/**
 * PackagePayment Schema - Quản lý thanh toán mua gói tin đăng
 */
import mongoose from 'mongoose';

const packagePaymentSchema = new mongoose.Schema({
    // Người mua gói
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Gói tin đăng
    packagePlan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PackagePlan',
        required: true
    },
    
    // Thông tin thanh toán
    amount: {
        type: Number,
        required: true
    },
    
    // Phương thức thanh toán
    paymentMethod: {
        type: String,
        enum: ['momo', 'vnpay', 'bank_transfer', 'cash'],
        required: true
    },
    
    // Mã giao dịch
    transactionId: {
        type: String,
        unique: true,
        sparse: true
    },
    
    // Trạng thái
    status: {
        type: String,
        enum: ['pending', 'paid', 'cancelled', 'failed'],
        default: 'pending'
    },
    
    // Thời gian thanh toán
    paidAt: {
        type: Date
    },
    
    // Ghi chú
    note: {
        type: String
    },
    
    // Metadata từ cổng thanh toán
    paymentMetadata: {
        type: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true
});

// Indexes
packagePaymentSchema.index({ user: 1, createdAt: -1 });
packagePaymentSchema.index({ status: 1 });
packagePaymentSchema.index({ transactionId: 1 });

const PackagePayment = mongoose.model('PackagePayment', packagePaymentSchema);

export default PackagePayment;
