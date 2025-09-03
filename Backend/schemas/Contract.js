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
    tenants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    }],
    // Giữ lại tenant để backward compatibility
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant'
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
    
    // Thông tin xe
    vehicles: [{
        licensePlate: {
            type: String,
            trim: true,
            uppercase: true
        },
        vehicleType: {
            type: String,
            trim: true
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tenant'
        }
    }],
    
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
