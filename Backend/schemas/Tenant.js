/**
 * Tenant Schema - Quản lý thông tin khách thuê
 * Tối ưu hóa để lưu trữ theo chủ trọ, phòng và hợp đồng
 */
import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema({
  // Thông tin cá nhân cơ bản
  fullName: { type: String, required: true, trim: true, index: true },
  email: { type: String, trim: true, lowercase: true, index: true },
  phone: { type: String, required: true, trim: true, index: true },
  address: { type: String, default: '' },
  identificationNumber: { type: String, trim: true, index: true }, // CMND/CCCD
  dateOfBirth: { type: Date },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },

  // Liên kết chính - Chủ trọ, Phòng, Hợp đồng
  landlord: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  contract: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract', index: true },

  // Thông tin thuê
  leaseStart: { type: Date, required: true, index: true },
  leaseEnd: { type: Date, index: true },
  rentPrice: { type: Number, required: true },
  deposit: { type: Number, default: 0 },
  
  // Trạng thái và quản lý
  status: { 
    type: String, 
    enum: ['active', 'ended', 'pending', 'cancelled', 'suspended'], 
    default: 'pending', 
    index: true 
  },
  
  // Thông tin bổ sung
  notes: { type: String, default: '' },
  moveInDate: { type: Date },
  moveOutDate: { type: Date },
  
  // Lịch sử thanh toán
  payments: [{
    amount: { type: Number, required: true },
    paidAt: { type: Date, default: Date.now },
    method: { type: String, enum: ['cash', 'bank', 'transfer', 'other'], default: 'cash' },
    type: { type: String, enum: ['rent', 'deposit', 'utilities', 'other'], default: 'rent' },
    note: String,
    receiptNumber: String
  }],

  // Hình ảnh và tài liệu
  images: [{ type: String }], // URLs của hình ảnh
  
  // Phương tiện
  vehicles: [{
    licensePlate: { type: String, trim: true },
    vehicleType: { type: String, trim: true },
    notes: { type: String, default: '' }
  }],

  // Quản lý kho lưu trữ
  isActive: { type: Boolean, default: true, index: true },
  isArchived: { type: Boolean, default: false, index: true }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual fields
tenantSchema.virtual('totalPaid').get(function() {
  return this.payments && Array.isArray(this.payments) 
    ? this.payments.reduce((total, payment) => total + payment.amount, 0)
    : 0;
});

tenantSchema.virtual('isCurrentlyActive').get(function() {
  const now = new Date();
  return this.status === 'active' && 
         this.leaseStart <= now && 
         (!this.leaseEnd || this.leaseEnd >= now);
});

// Indexes tối ưu cho truy vấn theo chủ trọ, phòng và hợp đồng
tenantSchema.index({ landlord: 1, status: 1, isArchived: 1 }); // Truy vấn theo chủ trọ
tenantSchema.index({ room: 1, status: 1 }); // Truy vấn theo phòng
tenantSchema.index({ contract: 1 }); // Truy vấn theo hợp đồng
tenantSchema.index({ fullName: 1, phone: 1 }); // Tìm kiếm tenant
tenantSchema.index({ identificationNumber: 1 }, { sparse: true }); // CMND/CCCD unique
tenantSchema.index({ createdAt: -1 }); // Sắp xếp theo thời gian tạo
// Note: Removed restrictive composite index to allow multiple tenants in same room

// Middleware
tenantSchema.pre('save', function(next) {
  if (this.isNew && !this.moveInDate && this.status === 'active') {
    this.moveInDate = this.leaseStart;
  }
  next();
});

// Methods
tenantSchema.methods.addPayment = function(paymentData) {
  this.payments.push(paymentData);
  return this.save();
};

tenantSchema.methods.endLease = function(endDate = new Date()) {
  this.status = 'ended';
  this.leaseEnd = endDate;
  this.moveOutDate = endDate;
  return this.save();
};

tenantSchema.statics.findByLandlord = function(landlordId, filters = {}) {
  return this.find({ 
    landlord: landlordId, 
    isArchived: false,
    ...filters 
  }).populate('room contract');
};

tenantSchema.statics.findByRoom = function(roomId, filters = {}) {
  return this.find({ 
    room: roomId, 
    isArchived: false,
    ...filters 
  }).populate('landlord contract');
};

export default mongoose.model('Tenant', tenantSchema);
