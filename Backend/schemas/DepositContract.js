/**
 * Deposit Contract Schema - Quản lý hợp đồng đặt cọc
 */
import mongoose from 'mongoose';

const depositContractSchema = new mongoose.Schema({
    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true
    },
    tenantName: {
        type: String,
        required: true
    },
    tenantPhone: {
        type: String,
        required: true
    },
    depositDate: {
        type: Date,
        required: true
    },
    expectedMoveInDate: {
        type: Date,
        required: true
    },
    depositAmount: {
        type: Number,
        required: true
    },
    roomPrice: {
        type: Number,
        required: true
    },
    notes: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['active', 'fulfilled', 'cancelled', 'expired'],
        default: 'active'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

export default mongoose.model('DepositContract', depositContractSchema);
