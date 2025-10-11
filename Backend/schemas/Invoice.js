/**
 * Invoice Schema - Quản lý hóa đơn thu tiền phòng trọ
 */
import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
    // Thông tin liên kết
    contract: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contract',
        required: true
    },
    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true
    },
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    landlord: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Thông tin hóa đơn
    invoiceNumber: {
        type: String,
        unique: true,
        required: true
    },
    issueDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    dueDate: {
        type: Date,
        required: true
    },

    // Chu kỳ tính tiền
    periodStart: {
        type: Date,
        required: true
    },
    periodEnd: {
        type: Date,
        required: true
    },

    // Thông tin chỉ số điện nước
    electricOldReading: {
        type: Number,
        default: 0
    },
    electricNewReading: {
        type: Number,
        default: 0
    },
    electricRate: {
        type: Number,
        default: 3500
    },
    
    // Thông tin nước
    waterOldReading: {
        type: Number,
        default: 0
    },
    waterNewReading: {
        type: Number,
        default: 0
    },
    waterRate: {
        type: Number,
        default: 20000
    },
    waterBillingType: {
        type: String,
        enum: ['perCubicMeter', 'perPerson'],
        default: 'perCubicMeter'
    },
    waterPricePerPerson: {
        type: Number,
        default: 50000
    },

    // Chi tiết thu tiền
    charges: [{
        type: {
            type: String,
            enum: ['rent', 'electricity', 'water', 'internet', 'parking', 'cleaning', 'maintenance', 'other'],
            required: true
        },
        description: {
            type: String,
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        quantity: {
            type: Number,
            default: 1
        },
        unitPrice: {
            type: Number
        },
        // Đối với điện nước
        previousReading: Number,
        currentReading: Number,
        consumption: Number
    }],

    // Tổng tiền
    subtotal: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    totalAmount: {
        type: Number,
        required: true
    },

    // Trạng thái thanh toán
    status: {
        type: String,
        enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
        default: 'draft'
    },
    
    // Thông tin thanh toán
    paidDate: Date,
    paymentMethod: {
        type: String,
        enum: ['cash', 'bank_transfer', 'momo', 'zalopay', 'vnpay', 'other']
    },
    transactionId: String,
    
    // Thông tin QR thanh toán
    paymentQRCode: {
        type: String
    },
    paymentQRContent: {
        type: String
    },
    
    // Ghi chú
    notes: String,
    
    // Người tạo và cập nhật
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Virtual fields
invoiceSchema.virtual('isPaid').get(function() {
    return this.status === 'paid';
});

invoiceSchema.virtual('isOverdue').get(function() {
    return this.status !== 'paid' && this.dueDate < new Date();
});

invoiceSchema.virtual('daysOverdue').get(function() {
    if (this.status === 'paid') return 0;
    const now = new Date();
    const diffTime = now - this.dueDate;
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
});

// Indexes
invoiceSchema.index({ contract: 1, periodStart: -1 });
invoiceSchema.index({ room: 1, issueDate: -1 });
invoiceSchema.index({ tenant: 1, status: 1 });
invoiceSchema.index({ landlord: 1, status: 1, issueDate: -1 });
invoiceSchema.index({ status: 1, dueDate: 1 });
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ periodStart: 1, periodEnd: 1 });

// Pre-save middleware để tự động tính tổng tiền
invoiceSchema.pre('save', function(next) {
    // Tính subtotal từ charges
    this.subtotal = this.charges.reduce((total, charge) => total + charge.amount, 0);
    
    // Tính total amount
    this.totalAmount = this.subtotal - (this.discount || 0);
    
    // Update status nếu đã quá hạn
    if (this.status !== 'paid' && this.dueDate < new Date()) {
        this.status = 'overdue';
    }
    
    next();
});

// Static method để tạo invoice number
invoiceSchema.statics.generateInvoiceNumber = async function() {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    const prefix = `INV${year}${month}`;
    
    // Tìm invoice number cuối cùng trong tháng
    const lastInvoice = await this.findOne({
        invoiceNumber: { $regex: `^${prefix}` }
    }).sort({ invoiceNumber: -1 });
    
    let sequence = 1;
    if (lastInvoice) {
        const lastSequence = parseInt(lastInvoice.invoiceNumber.replace(prefix, ''));
        sequence = lastSequence + 1;
    }
    
    return `${prefix}${String(sequence).padStart(4, '0')}`;
};

export default mongoose.model('Invoice', invoiceSchema);