// models/Order.js
import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  total: {
    type: mongoose.Decimal128,
    required: true,
    default: 0.00
  },
  payment_status: {
    type: String,
    enum: ['Unpaid', 'Paid', 'Cancelled', 'Refunded'],
    default: 'Unpaid'
  },
  name: {
    type: String,
    trim: true
  },
  // Thông tin liên kết (không bắt buộc vì có thể là upgrade tài khoản)
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: false
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Legacy packageId (giữ để tương thích)
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PropertiesPackage'
  },
  
  // PackagePlan mới
  packagePlanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PackagePlan'
  },
  
  // Loại tin được chọn từ PropertiesPackage (chỉ dùng cho property-specific payment, không dùng cho upgrade).
  propertyType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PropertiesPackage'
  },
  
  // Thông tin gói đã chọn
  packageInfo: {
    name: String,
    duration: Number,
    durationUnit: String, // 'day', 'month', 'year'
    dailyPrice: Number,
    isRenewal: Boolean, // Đánh dấu có phải là order gia hạn không
    expiredPackageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PackagePlan'
    }
  },
  
  // ID transaction khi thanh toán thành công
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  // Thông tin migration cho việc chuyển tin từ gói cũ sang gói mới
  migration: {
    selectedProperties: [{
      propertyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property',
        required: true
      },
      currentPostType: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PropertiesPackage',
        required: true
      },
      newPostType: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PropertiesPackage'
      },
      propertyTitle: String,
      currentPostTypeName: String,
      newPostTypeName: String
    }],
    limitsUsage: mongoose.Schema.Types.Mixed // Object chứa thông tin giới hạn sử dụng
  },
  
  // Thông tin thanh toán
  paymentMethod: {
    type: String,
    enum: ['sepay', 'vnpay', 'manual'],
    default: 'sepay'
  },
  paid_at: {
    type: Date
  },
  expiryTime: {
    type: Date
  },
  
  // VNPay specific fields
  vnpayRequestTime: {
    type: Date
  },
  vnpayTransactionNo: {
    type: String
  },
  vnpayResponseCode: {
    type: String
  },
  vnpayBankCode: {
    type: String
  },
  vnpayPayDate: {
    type: String
  },
  
  // Thông tin hủy đơn hàng
  cancelReason: {
    type: String,
    trim: true
  },
  cancelledAt: {
    type: Date
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// tạo model
const Order = mongoose.model('Order', orderSchema);
export default Order;
