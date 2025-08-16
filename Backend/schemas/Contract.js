/**
 * Contract Schema - Quản lý hợp đồng thuê
 */
import mongoose from 'mongoose';

const contractSchema = new mongoose.Schema({
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
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    monthlyRent: {
        type: Number,
        required: true
    },
    deposit: {
        type: Number,
        required: true
    },
    electricPrice: Number, // Giá điện / kWh
    waterPrice: Number,    // Giá nước / m³
    servicePrice: Number,  // Phí dịch vụ hàng tháng
    rules: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['active', 'expired', 'terminated'],
        default: 'active'
    },
    signedDate: {
        type: Date,
        default: Date.now
    },
    notes: String
}, {
    timestamps: true
});

export default mongoose.model('Contract', contractSchema);
