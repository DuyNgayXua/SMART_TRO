import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  // Người nhận thông báo
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Loại thông báo
  type: {
    type: String,
    enum: ['property', 'report'],
    required: true,
    index: true
  },

  // Tiêu đề thông báo
  title: {
    type: String,
    required: true,
    maxLength: 200
  },

  // Nội dung thông báo
  content: {
    type: String,
    required: true,
    maxLength: 1000
  },

  // ID liên quan (property ID hoặc report ID)
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },

  // Trạng thái đã đọc
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },

  // Thời gian đọc
  readAt: {
    type: Date,
    default: null
  },

  // Dữ liệu bổ sung (tuỳ chọn)
  metadata: {
    propertyTitle: String,           // Tên tin đăng
    propertyStatus: String,          // approved, rejected
    reportType: String,              // Loại báo cáo
    reportStatus: String,            // resolved, dismissed
    adminNote: String               // Ghi chú từ admin
  }
}, {
  timestamps: true
});

// Indexes for better performance
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // Auto delete after 30 days

// Virtual for formatted creation date
notificationSchema.virtual('createdAtFormatted').get(function() {
  return this.createdAt.toLocaleDateString('vi-VN');
});

// Static method to create property notification
notificationSchema.statics.createPropertyNotification = async function(userId, propertyId, status, propertyTitle, adminNote = '') {
  let title, content;
  
  switch(status) {
    case 'approved':
      title = 'Tin đăng của bạn đã được duyệt';
      content = `Tin đăng "${propertyTitle}" đã được duyệt và hiển thị công khai.`;
      break;
    case 'rejected':
      title = 'Tin đăng của bạn bị từ chối';
      content = `Tin đăng "${propertyTitle}" không được duyệt. Vui lòng kiểm tra và chỉnh sửa lại.`;
      break;
    case 'warning':
      title = 'Tin đăng của bạn nhận được cảnh báo';
      content = `Tin đăng "${propertyTitle}" đã nhận được cảnh báo từ quản trị viên.`;
      break;
    case 'hidden':
      title = 'Tin đăng của bạn đã bị ẩn';
      content = `Tin đăng "${propertyTitle}" đã bị ẩn do vi phạm quy định.`;
      break;
    default:
      title = 'Cập nhật về tin đăng của bạn';
      content = `Có cập nhật mới về tin đăng "${propertyTitle}".`;
  }
  
  // Add admin note to content if provided
  if (adminNote) {
    content += ` ${adminNote}`;
  }

  return this.create({
    userId,
    type: 'property',
    title,
    content,
    relatedId: propertyId,
    metadata: {
      propertyTitle,
      propertyStatus: status,
      adminNote
    }
  });
};

// Static method to create report notification
notificationSchema.statics.createReportNotification = async function(userId, reportId, status, reportType, adminNote = '', propertyId = null) {
  let title, content;
  
  switch(status) {
    case 'dismissed':
      title = 'Báo cáo của bạn đã được xem xét';
      content = `Báo cáo ${reportType} của bạn đã được xem xét và kết luận không vi phạm. ${adminNote}`;
      break;
    case 'warning':
      title = 'Báo cáo của bạn đã được xử lý';
      content = `Báo cáo ${reportType} của bạn đã được xử lý. Chúng tôi đã gửi cảnh báo cho chủ tin đăng. ${adminNote}`;
      break;
    case 'hidden':
      title = 'Báo cáo của bạn đã được xử lý';
      content = `Báo cáo ${reportType} của bạn đã được xử lý thành công. Tin đăng vi phạm đã được gỡ bỏ. ${adminNote}`;
      break;
    case 'resolved':
      title = 'Báo cáo của bạn đã được xử lý';
      content = `Báo cáo ${reportType} của bạn đã được xử lý thành công. ${adminNote}`;
      break;
    default:
      title = 'Báo cáo của bạn đã được xem xét';
      content = `Báo cáo ${reportType} của bạn đã được xem xét. ${adminNote}`;
  }

  return this.create({
    userId,
    type: 'report',
    title,
    content,
    relatedId: propertyId || reportId, // Ưu tiên propertyId để có thể xem tin đăng
    metadata: {
      reportType,
      reportStatus: status,
      adminNote,
      reportId // Lưu reportId trong metadata để tham khảo
    }
  });
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
