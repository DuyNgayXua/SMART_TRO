import mongoose from 'mongoose';

const propertiesPackageSchema = new mongoose.Schema({
  // Thông tin gói tin đăng
  name: {
    type: String,
    required: true,
    enum: ['tin_thuong', 'tin_vip_1', 'tin_vip_2', 'tin_vip_3', 'tin_vip_noi_bat', 'tin_vip_dac_biet']
  },

  displayName: {
    type: String,
    required: true
  },

  description: {
    type: String,
    required: true
  },


  // Độ ưu tiên hiển thị (1 = cao nhất)
  priority: {
    type: Number,
    required: true,
    min: 1
  },

  // Styling properties
  color: {
    type: String,
    required: true
  },

  textStyle: {
    type: String,
    enum: ['uppercase', 'normal', 'bold'],
    default: 'normal'
  },

  stars: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },

  // Features
  features: [{
    type: String
  }],

  // Trạng thái active
  isActive: {
    type: Boolean,
    default: true
  },

  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better performance
propertiesPackageSchema.index({ name: 1 });
propertiesPackageSchema.index({ priority: 1 });
propertiesPackageSchema.index({ isActive: 1 });

export default mongoose.model('PropertiesPackage', propertiesPackageSchema);