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
    status: {
        type: String,
        enum: ['available', 'inactive'],
        default: 'available',
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
        favorites: {
            type: Number,
            default: 0
        },
        favoritedBy: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        lastFavoritedAt: {
            type: Date,
            default: null
        },
        contacts: {
            type: Number,
            default: 0
        }
    },

    // Thông tin gói đã mua (sử dụng PackagePlan)
    packageInfo: {
        plan: { type: mongoose.Schema.Types.ObjectId, ref: 'PackagePlan' }, // Gói người dùng đã dùng để đăng tin
        packageInstanceId: { type: mongoose.Schema.Types.ObjectId }, // ID instance của gói để tránh reactivate tin cũ
        postType: { type: mongoose.Schema.Types.ObjectId, ref: 'PropertiesPackage' }, // Loại tin (VIP, Thường, v.v.)
        purchaseDate: { type: Date, default: Date.now },
        expiryDate: { type: Date },
        isActive: { type: Boolean, default: true },
        status: {
            type: String,
            enum: ['active', 'cancelled', 'expired'],
            default: 'active'
        }
    },


    // Thời gian promote tin đăng lên đầu trang
    promotedAt: {
        type: Date,
        default: null
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
propertySchema.index({ promotedAt: -1 }); // Index for promoted properties
propertySchema.index({ owner: 1, approvalStatus: 1 });
propertySchema.index({ owner: 1, isDeleted: 1 });
propertySchema.index({ owner: 1, createdAt: -1 });
propertySchema.index({ owner: 1, 'packageInfo.postType': 1 }); // Index for postType queries
propertySchema.index({ owner: 1, 'packageInfo.status': 1 }); // Index for package status queries
propertySchema.index({ promotedAt: -1, createdAt: -1 }); // Compound index for sorting

propertySchema.pre(/^find/, function (next) {
    // Skip this for admin queries or explicit deleted queries
    if (!this.getQuery().includeDeleted && !this.getQuery().isDeleted) {
        this.find({ isDeleted: { $ne: true } });
    }
    next();
});


export default mongoose.model('Property', propertySchema);