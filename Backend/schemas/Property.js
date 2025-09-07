/**
 * Property Schema - Quản lý bất động sản
 */
import mongoose from 'mongoose';

const propertySchema = new mongoose.Schema({
    // Thông tin chủ nhà
    title: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['phong_tro', 'can_ho', 'nha_nguyen_can', 'chung_cu_mini', 'homestay'],
        required: true
    },
    contactName: {
        type: String,
        required: true,
        trim: true,
        match: [/^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵýỷỹ\s]+$/, 'Tên liên hệ chỉ được chứa chữ cái và khoảng trắng']
    },
    contactPhone: {
        type: String,
        required: true,
        match: [/^[0-9]{10}$/, 'Số điện thoại không hợp lệ']
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

    // Thông tin cơ bản & giá
    rentPrice: {
        type: Number,
        required: true,
        min: 0
    },
    promotionPrice: {
        type: Number,
        min: 0
    },
    deposit: {
        type: Number,
        min: 0
    },
    area: {
        type: Number,
        required: true,
        min: 1
    },
    electricPrice: {
        type: Number,
        min: 0
    },
    waterPrice: {
        type: Number,
        min: 0
    },
    maxOccupants: {
        type: String,
        enum: ['1', '2', '3', '4', '5+'],
        default: '1'
    },
    availableDate: {
        type: Date
    },

    // Tiện ích (array of ObjectId references to Amenity model)
    amenities: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'Amenity',
        default: []
    },
    fullAmenities: {
        type: Boolean,
        default: false
    },
    timeRules: {
        type: String,
        default: ''
    },


    // Nội quy (array of strings matching NewPost.jsx)
    houseRules: {
        type: [String],
        enum: [
            'no_smoking',
            'no_pets',
            'no_parties',
            'quiet_hours',
            'no_overnight_guests',
            'keep_clean',
            'remove_shoes'
        ],
        default: []
    },

    // Địa chỉ
    province: {
        type: String,
        required: true
    },
    district: {
        type: String,
        required: true
    },
    ward: {
        type: String,
        required: true
    },
    detailAddress: {
        type: String,
        required: true,
        trim: true
    },
    coordinates: {
        lat: {
            type: Number,
            required: false
        },
        lng: {
            type: Number,
            required: false
        }
    },

    // Media
    images: {
        type: [String],
        validate: [arrayLimit, 'Tối đa 5 hình ảnh'],
        required: true
    },
    video: {
        type: String
    },

    // Trạng thái duyệt bài admin
    approvalStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'all', 'hidden'],
        default: 'pending'
    },

    // Admin duyệt bài
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: {
        type: Date
    },
    rejectionReason: {
        type: String,
        trim: true
    },

    // Trạng thái bất động sản (gộp isForRent + isActive + status)
    status: {
        type: String,
        enum: ['available', 'rented', 'maintenance', 'draft', 'inactive'],
        default: 'draft',
        required: true
    },
    views: {
        type: Number,
        default: 0
    },
    featured: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    }, stats: {
        views: {
            type: Number,
            default: 0
        },
        favorites: {
            type: Number,
            default: 0
        },
        contacts: {
            type: Number,
            default: 0
        }
    },

}, {
    timestamps: true
});

// Validation function cho array limit
function arrayLimit(val) {
    return val.length <= 5;
}

// Index for better performance
propertySchema.index({ owner: 1 });
propertySchema.index({ category: 1 });
propertySchema.index({ approvalStatus: 1 });
propertySchema.index({ province: 1, district: 1 });
propertySchema.index({ rentPrice: 1 });
propertySchema.index({ createdAt: -1 });
propertySchema.index({ owner: 1, approvalStatus: 1 });
propertySchema.index({ owner: 1, isDeleted: 1 });
propertySchema.index({ owner: 1, createdAt: -1 });

propertySchema.pre(/^find/, function (next) {
    // Skip this for admin queries or explicit deleted queries
    if (!this.getQuery().includeDeleted && !this.getQuery().isDeleted) {
        this.find({ isDeleted: { $ne: true } });
    }
    next();
});


export default mongoose.model('Property', propertySchema);
