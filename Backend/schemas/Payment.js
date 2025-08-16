/**
 * Payment Schema - Quản lý thanh toán
 */
import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
    // Liên kết
    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true
    },
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    landlord: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Thông tin thanh toán
    type: {
        type: String,
        enum: ['rent', 'deposit', 'electricity', 'water', 'service', 'penalty'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    description: String,
    
    // Thời gian
    dueDate: {
        type: Date,
        required: true
    },
    paidDate: Date,
    
    // Trạng thái
    status: {
        type: String,
        enum: ['pending', 'paid', 'overdue', 'cancelled'],
        default: 'pending'
    },
    
    // Phương thức thanh toán
    paymentMethod: {
        type: String,
        enum: ['cash', 'bank_transfer', 'momo', 'zalopay', 'vnpay']
    },
    
    // Mã giao dịch
    transactionId: String,
    
    // Ghi chú
    notes: String
}, {
    timestamps: true
});

// Indexes
paymentSchema.index({ room: 1, dueDate: -1 });
paymentSchema.index({ tenant: 1, status: 1 });
paymentSchema.index({ landlord: 1, status: 1 });
paymentSchema.index({ status: 1, dueDate: 1 });
paymentSchema.index({ transactionId: 1 });

export default mongoose.model('Payment', paymentSchema);
