/**
 * User Schema - Quản lý người dùng
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    phone: {
        type: String,
        required: function () {
            // Phone chỉ required nếu không đăng nhập qua Google
            return !this.googleId;
        },
        validate: {
            validator: function (v) {
                // Nếu là tài khoản Google và phone rỗng thì hợp lệ
                if (this.googleId && (!v || v.trim() === '')) {
                    return true;
                }
                // Nếu có phone thì phải đúng format
                if (v && v.trim()) {
                    return /^[0-9]{10}$/.test(v);
                }
                // Nếu không có googleId thì phone bắt buộc
                return !(!this.googleId && (!v || v.trim() === ''));
            },
            message: 'Số điện thoại phải có 10 chữ số'
        },
        unique: true,
        sparse: true // Cho phép multiple null values
    },
    password: {
        type: String,
        required: function () {
            // Password chỉ required nếu không đăng nhập qua Google
            return !this.googleId;
        },
        minlength: 6
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true // Cho phép multiple null values
    },
    role: {
        type: String,
        enum: ['tenant', 'landlord', 'admin'],
        default: 'tenant'
    },
    avatar: String,
    address: {
        street: String,
        ward: String,
        province: String
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Thông tin gói dùng thử miễn phí
    freeTrial: {
        hasRegistered: {
            type: Boolean,
            default: false
        },
        registeredAt: Date,
        expiryDate: Date,
        trialRequestId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TrialRequest'
        }
    },
    // Package plan hiện tại của user
    packageType: {
        type: String,
        enum: ['trial', 'basic', 'vip', 'premium', 'custom', 'expired'],
        default: 'trial'
    },
    currentPackagePlan: {
        packagePlanId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PackagePlan'
        },
        packageInstanceId: {
            type: mongoose.Schema.Types.ObjectId,
            default: () => new mongoose.Types.ObjectId() // Tự động tạo instance ID mới
        },
        packageName: String,
        displayName: String,
        priority: Number,
        color: String,
        stars: Number,
        freePushCount: Number,
        usedPushCount: {
            type: Number,
            default: 0
        },
        purchaseDate: Date,
        expiryDate: Date,
        isActive: {
            type: Boolean,
            default: true
        },
        status: {
            type: String,
            enum: ['active', 'expired', 'upgraded', 'cancelled', 'renewed'],
            default: 'active'
        },
        propertiesLimits: [{
            packageType: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'PropertiesPackage'
            },
            limit: Number,
            used: {
                type: Number,
                default: 0
            },
            backupUsedCount: {
                type: Number,
                default: 0
            }
        }]
    },

    // Lịch sử các gói đã sử dụng
    packageHistory: [{
        packagePlanId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PackagePlan'
        },
        packageInstanceId: {
            type: mongoose.Schema.Types.ObjectId // Instance ID để phân biệt các giai đoạn của cùng gói
        },
        packageName: String,
        displayName: String,
        priority: Number,
        color: String,
        stars: Number,
        freePushCount: Number,
        usedPushCount: {
            type: Number,
            default: 0
        },
        purchaseDate: Date,
        expiryDate: Date,
        status: {
            type: String,
            enum: ['active', 'expired', 'upgraded', 'cancelled', 'renewed'],
            default: 'active'
        },
         isActive: {
            type: Boolean,
            default: true
        },
        propertiesLimits: [{
            packageType: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'PropertiesPackage'
            },
            limit: Number,
            used: {
                type: Number,
                default: 0
            }
        }],
        
        // Thông tin tin đăng đã được chuyển sang gói khác
        transferredProperties: [{
            propertyId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Property'
            },
            propertyTitle: String,
            postType: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'PropertiesPackage'
            },

            transferredFromPackage: {
                packagePlanId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'PackagePlan'
                },
                displayName: String
            },
            transferredToPackage: {
                packagePlanId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'PackagePlan'
                },
                displayName: String
            },
            transferDate: Date
        }],
        upgradedAt: Date, // Ngày được nâng cấp (nếu status = 'upgraded')
        expiredAt: Date   // Ngày hết hạn thực tế (nếu status = 'expired')
    }]
}, {
    timestamps: true
});

// Hash password trước khi lưu
userSchema.pre('save', async function (next) {
    // Chỉ hash password nếu có password và được modified
    if (!this.password || !this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// So sánh password
userSchema.methods.comparePassword = async function (candidatePassword) {
    // Nếu không có password (Google login), return false
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
