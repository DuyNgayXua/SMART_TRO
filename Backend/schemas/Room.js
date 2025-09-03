/**
 * Room Schema - Quản lý phòng trọ
 */
import mongoose from 'mongoose';


const roomSchema = new mongoose.Schema({
    property: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property',
        required: false // property trở thành tùy chọn
    },
    // Chủ sở hữu phòng (landlord). Nếu property không bắt buộc thì cần trường này để phân quyền.
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    roomNumber: {
        type: String,
        required: true,
        trim: true
    },
    description: { type: String, default: '' },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    deposit: {
        type: Number,
        required: true,
        min: 0
    },
    // Các khoản phí
    electricityPrice: {
        type: Number,
        default: 3500, // VND/kWh
        min: 0
    },
    waterPrice: {
        type: Number,
        default: 25000, // VND/m³
        min: 0
    },
    servicePrice: {
        type: Number,
        default: 150000, // VND/tháng (phí dịch vụ: internet, vệ sinh, bảo trì...)
        min: 0
    },
    area: { type: Number, min: 0 }, // m²
    // Sức chứa (số người)
    capacity: { type: Number, min: 1, default: 1 },
    // Số lượng xe có thể để
    vehicleCount: { type: Number, min: 0, default: 0 },
    amenities: [{ 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Amenity'
    }], // Reference to Amenity documents
    images: { type: [String], default: [] }, // URLs của hình ảnh phòng
    status: {
        type: String,
        enum: ['available', 'rented', 'occupied', 'maintenance', 'reserved'],
        default: 'available'
    },
    tenant: { // liên kết record Tenant đang thuê (nếu còn active)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant'
    },
    // Lịch sử thay đổi trạng thái
    statusHistory: {
        type: [
            {
                status: String,
                changedAt: { type: Date, default: Date.now },
                note: String,
                changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
            }
        ],
        default: []
    },
    // Đặt phòng (booking) cơ bản
    bookings: {
        type: [
            {
                user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                startDate: Date,
                endDate: Date,
                status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' },
                createdAt: { type: Date, default: Date.now }
            }
        ],
        default: []
    },
    // Doanh thu phát sinh (đơn giản hóa): mỗi mục là một kỳ thanh toán
    revenueRecords: {
        type: [
            {
                amount: Number,
                date: { type: Date, default: Date.now },
                note: String
            }
        ],
        default: []
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Unique roomNumber trong phạm vi property khi property tồn tại
roomSchema.index(
    { property: 1, roomNumber: 1 },
    { unique: true, partialFilterExpression: { property: { $exists: true, $ne: null } } }
);

// Index owner để tìm kiếm nhanh theo chủ trọ
roomSchema.index({ owner: 1 });

// Loại bỏ tiện ích trùng trước khi lưu
roomSchema.pre('save', function(next) {
    if (Array.isArray(this.amenities)) {
        this.amenities = [...new Set(this.amenities)];
    }
    // Nếu chưa có capacity hoặc capacity < 1 thì set lại theo roomType
    if (!this.capacity || this.capacity < 1) {
        const map = { single: 1, double: 2, suite: 3, dorm: 4 };
        this.capacity = map[this.roomType] || 1;
    }
    next();
});

export default mongoose.model('Room', roomSchema);
