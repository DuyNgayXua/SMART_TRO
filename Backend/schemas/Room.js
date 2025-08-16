/**
 * Room Schema - Quản lý phòng trọ
 */
import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
    property: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property',
        required: true
    },
    roomNumber: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: String,
    price: {
        type: Number,
        required: true
    },
    deposit: {
        type: Number,
        required: true
    },
    area: Number, // m²
    amenities: [String], // bed, desk, wardrobe, etc.
    images: [String], // URLs của hình ảnh phòng
    status: {
        type: String,
        enum: ['available', 'rented', 'maintenance'],
        default: 'available'
    },
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    leaseStart: Date,
    leaseEnd: Date,
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Đảm bảo roomNumber là unique trong cùng 1 property
roomSchema.index({ property: 1, roomNumber: 1 }, { unique: true });

export default mongoose.model('Room', roomSchema);
