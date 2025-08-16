# 🏠 Rental Management System Backend

Hệ thống quản lý phòng trọ và tìm kiếm trọ với AI Chatbot được xây dựng bằng Node.js, Express, và MongoDB.

## 🚀 Tính năng chính

### 1. **User Service** - Quản lý người dùng
- ✅ Đăng ký / Đăng nhập / Quên mật khẩu
- ✅ Xác thực Email / SMS OTP  
- ✅ Phân quyền (Admin, Chủ trọ, Người thuê)
- ✅ Hồ sơ người dùng (Avatar, CCCD, địa chỉ...)

### 2. **Auth Service** - Xác thực & Phân quyền
- ✅ JWT Authentication với Refresh Token
- ✅ Session Management  
- ✅ Rate Limiting & Security
- ✅ OTP Verification System

### 3. **Property Service** - Quản lý bài đăng
- ✅ CRUD bài đăng phòng trọ
- ✅ Upload và quản lý ảnh
- ✅ Quản lý tiện ích phòng
- ✅ Hệ thống đánh giá và review
- ✅ Báo cáo vi phạm

### 4. **Search Service** - Tìm kiếm thông minh
- ✅ Tìm kiếm theo địa lý, giá, diện tích
- ✅ Lọc theo khoảng cách GPS
- ✅ Lưu tìm kiếm và phòng yêu thích
- ✅ Lịch sử tìm kiếm

### 5. **Payment Service** - Thanh toán & Hợp đồng
- ✅ Hệ thống hóa đơn tự động
- ✅ Quản lý chỉ số điện nước
- ✅ Tích hợp payment gateway
- ✅ Lịch sử giao dịch

### 6. **Room Service** - Quản lý phòng
- ✅ Quản lý trạng thái phòng
- ✅ Hợp đồng điện tử
- ✅ Template hợp đồng

### 7. **Admin Service** - Quản trị hệ thống
- ✅ Dashboard thống kê
- ✅ Kiểm duyệt bài đăng
- ✅ Xử lý báo cáo vi phạm
- ✅ Quản lý người dùng

### 8. **AI Chatbot Service** - Hỗ trợ tìm kiếm
- ✅ Chatbot AI thông minh
- ✅ Phân tích ý định người dùng
- ✅ Gợi ý phòng phù hợp
- ✅ Training data management

### 9. **System Service** - Hệ thống
- ✅ Notification đa kênh (Email, SMS, Push)
- ✅ System logging
- ✅ API monitoring
- ✅ User preferences

## 📊 Database Schema

Hệ thống sử dụng **MongoDB** với **29 collections** được thiết kế tối ưu:

### 👥 User Management
- `users` - Thông tin người dùng
- `authsessions` - Phiên đăng nhập
- `otps` - Mã xác thực OTP

### 🏠 Property Management  
- `provinces`, `districts`, `wards` - Địa điểm
- `properties` - Bài đăng phòng trọ
- `propertyimages` - Ảnh phòng
- `amenities` - Tiện ích
- `rooms` - Phòng cụ thể

### 💰 Payment & Contract
- `contracts` - Hợp đồng thuê
- `contracttemplates` - Mẫu hợp đồng
- `payments` - Thanh toán
- `invoices` - Hóa đơn
- `utilityreadings` - Chỉ số điện nước
- `transactions` - Giao dịch

### 🔍 Search & Review
- `reviews` - Đánh giá phòng
- `reports` - Báo cáo vi phạm  
- `searchhistories` - Lịch sử tìm kiếm
- `savedsearches` - Tìm kiếm đã lưu
- `favoriteproperties` - Phòng yêu thích

### 🤖 AI Chatbot
- `chatsessions` - Phiên chat
- `chatmessages` - Tin nhắn
- `userintents` - Ý định người dùng
- `trainingdata` - Dữ liệu huấn luyện
- `chatbotanalytics` - Phân tích chatbot
- `quickreplytemplates` - Template trả lời

### 🛠️ Admin & System
- `adminactions` - Hành động admin
- `userviolations` - Vi phạm người dùng
- `moderationqueues` - Hàng đợi kiểm duyệt
- `systemconfigs` - Cấu hình hệ thống
- `dashboardstats` - Thống kê dashboard
- `notifications` - Thông báo
- `notificationtemplates` - Template thông báo
- `notificationpreferences` - Tùy chọn thông báo
- `systemlogs` - Log hệ thống
- `apiusages` - Thống kê API

## 🛠️ Cài đặt và Chạy

### 1. Clone repository
```bash
git clone <repository-url>
cd DO_AN_BACKEND
```

### 2. Cài đặt dependencies
```bash
npm install
```

### 3. Cấu hình môi trường
Tạo/cập nhật file `.env`:
```env
# MongoDB Atlas Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/rental_management?retryWrites=true&w=majority

# JWT Secrets
JWT_SECRET=your_super_secret_jwt_key_here
JWT_REFRESH_SECRET=your_super_secret_refresh_key_here

# Server Configuration
NODE_ENV=development
PORT=3000

# API Keys (existing)
GOOGLE_API_KEY=your_google_api_key
LOCATIONIQ_API_KEY=your_locationiq_api_key
RAPIDAPI_KEY=your_rapidapi_key
```

### 4. Tạo database và collections
```bash
npm run seed
```

### 5. Chạy ứng dụng
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

## 📡 API Endpoints

### Health Check & Status
```
GET /health                    - Health check
GET /api/status               - API và database status
GET /api/database/info        - Database information
```

### Test Endpoints
```
POST /api/test/create-user    - Tạo user test
```

## 🔧 MongoDB Atlas Setup

### 1. Tạo MongoDB Atlas Account
1. Truy cập [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Đăng ký tài khoản miễn phí
3. Tạo cluster mới

### 2. Cấu hình Database
1. Tạo database user với quyền read/write
2. Whitelist IP address (0.0.0.0/0 cho development)
3. Lấy connection string

### 3. Connection String Format
```
mongodb+srv://<username>:<password>@<cluster-url>/<database-name>?retryWrites=true&w=majority
```

## 📈 Monitoring & Logging

### Database Status
- Real-time connection monitoring
- Collection statistics
- Document counts
- Index information

### API Monitoring  
- Request/response logging
- Performance metrics
- Error tracking
- Rate limiting stats

### System Logs
- Structured logging với levels
- Auto cleanup (90 days retention)
- Request ID tracking
- Error stack traces

## 🔐 Security Features

### Authentication & Authorization
- JWT với Refresh Token
- Role-based permissions
- Session management
- OTP verification

### Data Protection
- Password hashing (bcrypt)
- Input validation & sanitization
- Rate limiting
- IP tracking

### MongoDB Security
- Connection encryption
- Indexed queries
- Data validation
- TTL for sensitive data

## 🚀 Deployment

### Environment Variables
```env
NODE_ENV=production
MONGODB_URI=<production-mongodb-url>
JWT_SECRET=<strong-production-secret>
PORT=3000
```

### PM2 Process Manager
```bash
npm install -g pm2
pm2 start app.js --name "rental-backend"
pm2 startup
pm2 save
```

## 📝 Development Notes

### Code Structure
```
├── config/          # Database configuration
├── schemas/         # Mongoose schemas
├── models/          # Business logic models  
├── controllers/     # Route controllers
├── routes/          # API routes
├── scripts/         # Utility scripts
├── app.js          # Main application
└── package.json    # Dependencies
```

### Available Scripts
```bash
npm start           # Start production server
npm run dev         # Start development server
npm run seed        # Seed database
npm test            # Run tests
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

---

## 🎯 Next Steps

1. **Cập nhật MONGODB_URI** trong file `.env`
2. **Chạy seeder**: `npm run seed`
3. **Start server**: `npm run dev`
4. **Test API**: Sử dụng Postman hoặc curl
5. **Xây dựng controllers và routes**

🎉 **Happy Coding!**
