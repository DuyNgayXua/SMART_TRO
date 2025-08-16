/**
 * Property Schema - Quản lý bất động sản
 */
import mongoose from 'mongoose';

const propertySchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    address: {
        street: { type: String, required: true },
        ward: { type: String, required: true },
        district: { type: String, required: true },
        province: { type: String, required: true }
    },
    type: {
        type: String,
        enum: ['apartment', 'house', 'room', 'boarding_house'],
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    area: Number, // m²
    bedrooms: Number,
    bathrooms: Number,
    amenities: [String], // wifi, parking, elevator, etc.
    images: [String], // URLs của hình ảnh
    status: {
        type: String,
        enum: ['available', 'rented', 'maintenance'],
        default: 'available'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

export default mongoose.model('Property', propertySchema);
