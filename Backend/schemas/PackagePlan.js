import mongoose from 'mongoose';

const packagePlanSchema = new mongoose.Schema({
  // Tên gói (Basic, VIP, Premium, hoặc tên tùy chỉnh)
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  type: {
    type: String,
    enum: ['trial','basic', 'vip', 'premium', 'custom'], // Xác định loại
    default: 'custom' // Nếu admin tạo thêm thì mặc định là tùy chỉnh
  },

  // Loại gói dành cho ai (chủ trọ hoặc Người lưu trú)
  packageFor: {
    type: String,
    enum: ['landlord', 'tenant', 'both'], // 'both' cho gói có thể dùng cho cả hai
    required: true,
    default: 'both'
  },

  // Phân loại gói (quản lý trọ hoặc đăng tin)
  category: {
    type: String,
    enum: ['management', 'posting', 'mixed'], // management: quản lý trọ, posting: đăng tin, mixed: cả hai
    required: true,
    default: 'posting'
  },

  displayName: {
    type: String,
    required: true
  },

  description: {
    type: String,
    required: true
  },
  // Số lượt đẩy tin miễn phí theo gói
  freePushCount: {
    type: Number,
    required: true,
    min: 0
  },

  // Tính năng quản lý cho chủ trọ (chỉ áp dụng khi category = 'management' hoặc 'mixed')
  managementFeatures: {
    maxProperties: {
      type: Number, // Số phòng trọ tối đa có thể quản lý (-1 = không giới hạn)
      default: -1
    },
    enableAutoBilling: {
      type: Boolean, // Tự động tính tiền điện nước
      default: false
    },
    enableNotifications: {
      type: Boolean, // Thông báo qua email/SMS
      default: false
    },
    enableReports: {
      type: Boolean, // Báo cáo thống kê
      default: false
    },
    enableExport: {
      type: Boolean, // Xuất báo cáo Excel/PDF
      default: false
    },
    supportLevel: {
      type: String, // Mức độ hỗ trợ
      enum: ['basic', 'priority', '24/7'],
      default: 'basic'
    }
  },


  // Giá gói (VNĐ)
  price: {
    type: Number,
    required: true,
    min: 0
  },

  // Thời hạn gói (số)
  duration: {
    type: Number,
    required: true,
    min: 1
  },

  // Đơn vị thời gian
  durationUnit: {
    type: String,
    enum: ['day', 'month', 'year'],
    required: true
  },

  /**
   * propertiesLimits - Tham chiếu đến PropertiesPackage
   * Mỗi mục cho biết loại tin và số lượng cho phép
   */
  propertiesLimits: [
    {
      packageType: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PropertiesPackage',
        required: true
      },
      limit: {
        type: Number,
        required: true,
        min: 0
      }
    }
  ],


  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

export default mongoose.model('PackagePlan', packagePlanSchema);
