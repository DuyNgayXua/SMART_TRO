/**
 * Main Router - Tích hợp tất cả service routes
 */
import express from 'express';
import userRoutes from './user-service/routes/userRoutes.js';
import propertyRoutes from './property-service/routes/propertyRoutes.js';
import roomRoutes from './room-service/routes/roomRoutes.js';
import tenantRoutes from './tenant-service/routes/tenantRoutes.js';
// import paymentRoutes from './payment-service/routes/paymentRoutes.js';
import contractRoutes from './contract-service/routes/contractRoutes.js';
import authRoutes from './auth-service/routes/authRoutes.js';
import amenityRoutes from './amenity-service/routes/amenityRoutes.js';
import locationRoutes from './location-service/routes/locationRoutes.js';
import myPropertiesRoutes from './property-service/routes/myPropertiesRoutes.js';
import searchRoutes from './property-service/routes/searchPropertiesRoutes.js';
import depositContractRoutes from '../routes/depositContractRoutes.js';
import reportRoutes from './report-service/routes/reportRoutes.js';
import commentRoutes from './comment-service/routes/commentRoutes.js';
import chatbotRoutes from './chatbot-service/routes/chatbotRoutes.js';
import adminPropertyRoutes from './property-service/routes/adminPropertyRoutes.js';
import moderationRoutes from './shared/routes/moderationRoutes.js';
import invoiceRoutes from './invoice-service/routes/invoiceRoutes.js';

const router = express.Router();

// Service routes
router.use('/api/users', userRoutes);
router.use('/api/properties', propertyRoutes);
router.use('/api/rooms', roomRoutes);
router.use('/api/tenants', tenantRoutes);
// router.use('/api/payments', paymentRoutes);
router.use('/api/contracts', contractRoutes);
router.use('/api/auth', authRoutes);
router.use('/api/amenities', amenityRoutes);
router.use('/api/locations', locationRoutes);
router.use('/api/my-properties', myPropertiesRoutes);
router.use('/api/search-properties', searchRoutes);
router.use('/api/deposit-contracts', depositContractRoutes);
router.use('/api/reports', reportRoutes);
router.use('/api/comments', commentRoutes);
router.use('/api/chatbot', chatbotRoutes);
router.use('/api/admin', adminPropertyRoutes);
router.use('/api/moderation', moderationRoutes);
router.use('/api/invoices', invoiceRoutes);


// API documentation route
router.get('/api', (req, res) => {
    res.json({
        message: 'Rental Management API',
        version: '1.0.0',
        services: {
            users: '/api/users',
            properties: '/api/properties',
            rooms: '/api/rooms',
            tenants: '/api/tenants',
            payments: '/api/payments',
            contracts: '/api/contracts',
            locations: '/api/locations',
            amenities: '/api/amenities',
            auth: '/api/auth',
            myProperties: '/api/my-properties',
            reports: '/api/reports',
            comments: '/api/comments',
            upload: '/api/upload',
            moderation: '/api/moderation'
        },
        documentation: {
            users: {
                'POST /api/users/register': 'Đăng ký user mới',
                'POST /api/users/login': 'Đăng nhập',
                'GET /api/users/profile': 'Lấy thông tin profile (require auth)',
                'PUT /api/users/profile': 'Cập nhật profile (require auth)',
                'GET /api/users': 'Lấy danh sách users (admin only)',
                'GET /api/users/:id': 'Lấy user theo ID (admin only)'
            },
            authRoutes: {
                'POST /api/auth/send-otp': 'Gửi mã OTP qua email',
                'POST /api/auth/verify-otp': 'Xác minh mã OTP',
                'POST /api/auth/reset-password': 'Đặt lại mật khẩu với OTP'
            },
            properties: {
                'GET /api/properties/search': 'Tìm kiếm properties',
                'GET /api/properties/:id': 'Lấy property theo ID',
                'POST /api/properties': 'Tạo property mới (landlord only)',
                'GET /api/properties/my/properties': 'Lấy properties của tôi (landlord only)',
                'PUT /api/properties/:id': 'Cập nhật property (owner only)',
                'DELETE /api/properties/:id': 'Xóa property (owner only)',
                'POST /api/properties/:id/rate': 'Đánh giá property (require auth)'
            }
            ,tenants: {
                'GET /api/tenants': 'Danh sách tenants (landlord)',
                'POST /api/tenants': 'Tạo tenant (gắn phòng + user)',
                'GET /api/tenants/:id': 'Chi tiết tenant',
                'PUT /api/tenants/:id': 'Cập nhật tenant',
                'POST /api/tenants/:id/payments': 'Thêm thanh toán',
                'POST /api/tenants/:id/end': 'Kết thúc hợp đồng',
                'DELETE /api/tenants/:id': 'Archive tenant'
            }
            ,contracts: {
                'GET /api/contracts': 'Danh sách hợp đồng',
                'POST /api/contracts': 'Tạo hợp đồng',
                'GET /api/contracts/:id': 'Chi tiết hợp đồng',
                'PUT /api/contracts/:id': 'Cập nhật hợp đồng',
                'POST /api/contracts/:id/terminate': 'Chấm dứt hợp đồng'
            },
            myProperties: {
                'GET /api/my-properties': 'Lấy danh sách bài đăng của tôi',
                'GET /api/my-properties/stats': 'Lấy thống kê bài đăng của tôi',
                'GET /api/my-properties/:propertyId/edit': 'Lấy thông tin bài đăng để chỉnh sửa',
                'PUT /api/my-properties/:propertyId': 'Cập nhật thông tin bài đăng',
                'DELETE /api/my-properties/:propertyId': 'Xóa bài đăng',
                'PATCH /api/my-properties/:propertyId/toggle-status': 'Chuyển trạng thái bài đăng (available/draft/inactive)'
            },
            upload: {
                'POST /api/upload/single': 'Upload 1 ảnh với AI moderation (require auth)',
                'POST /api/upload/multiple': 'Upload nhiều ảnh (max 10) với AI moderation (require auth)',
                'POST /api/upload/analyze-url': 'Phân tích ảnh từ URL (require auth)',
                'POST /api/upload/batch-analyze': 'Phân tích batch nhiều URLs (require auth)',
                'GET /api/upload/my-uploads': 'Lấy danh sách uploads của user (require auth)',
                'DELETE /api/upload/:uploadId': 'Xóa ảnh đã upload (require auth)',
                'GET /api/upload/stats': 'Thống kê moderation (admin only)',
                'PUT /api/upload/threshold': 'Cập nhật threshold AI moderation (admin only)',
                'POST /api/upload/test-webhook': 'Test webhook configuration (admin only)',
                'GET /api/upload/health': 'Health check upload service',
                'GET /api/upload/config': 'Lấy cấu hình upload',
                'POST /api/upload/webhook/moderation': 'Webhook nhận kết quả AI moderation từ Cloudinary',
                'GET /api/upload/webhook/health': 'Health check webhook service'
            },
            moderation: {
                'POST /api/moderation/analyze': 'Phân tích 1 ảnh từ URL với AI',
                'POST /api/moderation/batch-analyze': 'Phân tích nhiều ảnh cùng lúc (max 20)',
                'POST /api/moderation/check-url': 'Kiểm tra ảnh và block nếu vi phạm',
                'GET /api/moderation/stats': 'Thống kê kiểm duyệt (admin only)',
                'PUT /api/moderation/thresholds': 'Cập nhật ngưỡng phát hiện (admin only)',
                'GET /api/moderation/test': 'Test hệ thống moderation',
                'GET /api/moderation/health': 'Health check moderation service'
            }
        }
    });
});

export default router;