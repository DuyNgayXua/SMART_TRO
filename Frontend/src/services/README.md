# API Services Documentation

Thư mục này chứa tất cả các service API để giao tiếp với backend của hệ thống quản lý phòng trọ.

## 📁 Cấu trúc thư mục

```
src/services/
├── api.js              # Core API configuration với Axios
├── roomsAPI.js         # API cho quản lý phòng trọ
├── usersAPI.js         # API cho quản lý người dùng
├── bookingsAPI.js      # API cho quản lý đặt phòng
├── paymentsAPI.js      # API cho quản lý thanh toán
├── reportsAPI.js       # API cho báo cáo và thống kê
├── index.js           # Export tất cả services
└── README.md          # Tài liệu hướng dẫn
```

## 🔧 Cấu hình

### Environment Variables
Tạo file `.env` trong root project:
```
REACT_APP_API_BASE_URL=http://localhost:3001/api
```

### Base Configuration
File `api.js` chứa:
- Cấu hình Axios instance
- Request/Response interceptors
- Authentication handling
- Error handling

## 📖 Cách sử dụng

### Import riêng lẻ
```javascript
import { roomsAPI, usersAPI } from '../../../services';
// hoặc
import roomsAPI from '../../../services/roomsAPI';
```

### Import tất cả
```javascript
import apiServices from '../../../services';

// Sử dụng
const rooms = await apiServices.rooms.getAllRooms();
const users = await apiServices.users.getAllUsers();
```

### Sử dụng trong component
```javascript
import React, { useState, useEffect } from 'react';
import { roomsAPI } from '../../../services';

const RoomsList = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRooms = async () => {
      setLoading(true);
      try {
        const data = await roomsAPI.getAllRooms();
        setRooms(data.rooms);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, []);

  return (
    // JSX content
  );
};
```

## 🔑 Authentication

### Đăng nhập
```javascript
import { authAPI, apiUtils } from '../../../services';

const login = async (email, password) => {
  try {
    const response = await authAPI.login({ email, password });
    const { token, user } = response.data;
    
    // Lưu thông tin auth
    apiUtils.setAuthData(token, user.id, user.role);
    
    return user;
  } catch (error) {
    throw error;
  }
};
```

### Kiểm tra đăng nhập
```javascript
import { apiUtils } from '../../../services';

// Kiểm tra đã đăng nhập
const isLoggedIn = apiUtils.isAuthenticated();

// Lấy thông tin user
const userId = apiUtils.getUserId();
const userRole = apiUtils.getUserRole();
```

### Đăng xuất
```javascript
import { authAPI, apiUtils } from '../../../services';

const logout = async () => {
  try {
    await authAPI.logout();
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    apiUtils.clearAuthData();
    window.location.href = '/login';
  }
};
```

## 🏠 Rooms API

### Lấy danh sách phòng
```javascript
import { roomsAPI } from '../../../services';

// Lấy tất cả
const rooms = await roomsAPI.getAllRooms();

// Lấy với filter
const rooms = await roomsAPI.getAllRooms({
  page: 1,
  limit: 10,
  status: 'available'
});

// Tìm kiếm
const rooms = await roomsAPI.searchRooms({
  search: 'phòng vip',
  priceMin: 3000000,
  priceMax: 5000000
});
```

### CRUD operations
```javascript
// Tạo phòng mới
const newRoom = await roomsAPI.createRoom({
  name: 'Phòng P101',
  price: 3500000,
  area: 25,
  status: 'available'
});

// Cập nhật phòng
const updatedRoom = await roomsAPI.updateRoom(roomId, {
  price: 3600000
});

// Xóa phòng
await roomsAPI.deleteRoom(roomId);
```

### Upload hình ảnh
```javascript
const uploadImages = async (roomId, files) => {
  try {
    const result = await roomsAPI.uploadRoomImages(
      roomId, 
      files,
      (progressEvent) => {
        const progress = (progressEvent.loaded / progressEvent.total) * 100;
        console.log(`Upload progress: ${progress}%`);
      }
    );
    return result;
  } catch (error) {
    console.error('Upload failed:', error);
  }
};
```

## 👥 Users API

### Quản lý người dùng
```javascript
import { usersAPI } from '../../../services';

// Lấy danh sách users
const users = await usersAPI.getAllUsers({
  page: 1,
  limit: 20,
  role: 'tenant'
});

// Tạo user mới
const newUser = await usersAPI.createUser({
  fullName: 'Nguyễn Văn A',
  email: 'user@example.com',
  password: 'password123',
  role: 'tenant'
});

// Cập nhật role
await usersAPI.updateUserRole(userId, 'admin');
```

## 📅 Bookings API

### Quản lý đặt phòng
```javascript
import { bookingsAPI } from '../../../services';

// Tạo booking mới
const booking = await bookingsAPI.createBooking({
  roomId: 1,
  userId: 2,
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  totalAmount: 42000000
});

// Xác nhận booking
await bookingsAPI.confirmBooking(bookingId);

// Kiểm tra phòng có sẵn
const availability = await bookingsAPI.checkRoomAvailability(
  roomId, 
  '2025-01-01', 
  '2025-12-31'
);
```

## 💰 Payments API

### Quản lý thanh toán
```javascript
import { paymentsAPI } from '../../../services';

// Tạo thanh toán
const payment = await paymentsAPI.createPayment({
  bookingId: 1,
  amount: 3500000,
  method: 'bank_transfer',
  description: 'Tiền phòng tháng 1'
});

// Xác nhận thanh toán
await paymentsAPI.confirmPayment(paymentId, {
  transactionId: 'TXN123456',
  paidAt: new Date()
});

// Tạo link thanh toán online
const paymentLink = await paymentsAPI.createPaymentLink({
  amount: 3500000,
  description: 'Thanh toán tiền phòng',
  returnUrl: '/payment/success'
});
```

## 📊 Reports API

### Báo cáo và thống kê
```javascript
import { reportsAPI } from '../../../services';

// Dashboard overview
const overview = await reportsAPI.getDashboardOverview('month');

// Báo cáo doanh thu
const revenue = await reportsAPI.getRevenueReport(
  '2025-01-01',
  '2025-01-31',
  'day'
);

// Xuất báo cáo Excel
await reportsAPI.exportReportToExcel('revenue', {
  startDate: '2025-01-01',
  endDate: '2025-01-31'
});
```

## 🔧 Utilities

### API Connection
```javascript
import { checkAPIConnection, getAPIVersion } from '../../../services';

// Kiểm tra kết nối
const connectionStatus = await checkAPIConnection();
console.log(connectionStatus);

// Lấy API version
const version = await getAPIVersion();
console.log(version);
```

### Error Handling
```javascript
import { apiUtils } from '../../../services';

try {
  const data = await roomsAPI.getAllRooms();
} catch (error) {
  const errorMessage = apiUtils.formatErrorMessage(error);
  alert(errorMessage);
}
```

## 📱 Constants

### API Endpoints
```javascript
import { API_ENDPOINTS } from '../../../services';

console.log(API_ENDPOINTS.ROOMS.BASE); // '/rooms'
console.log(API_ENDPOINTS.AUTH.LOGIN); // '/auth/login'
```

### HTTP Status
```javascript
import { HTTP_STATUS, API_STATUS } from '../../../services';

if (response.status === HTTP_STATUS.OK) {
  setStatus(API_STATUS.SUCCESS);
}
```

## 🚨 Error Handling

API tự động xử lý các lỗi phổ biến:
- **401 Unauthorized**: Tự động đăng xuất và redirect
- **403 Forbidden**: Hiển thị thông báo không có quyền
- **404 Not Found**: Thông báo không tìm thấy tài nguyên
- **422 Validation Error**: Hiển thị lỗi validation
- **500 Server Error**: Thông báo lỗi máy chủ

## 📋 Best Practices

1. **Luôn sử dụng try-catch** khi gọi API
2. **Hiển thị loading state** khi đang gọi API
3. **Validate dữ liệu** trước khi gửi lên server
4. **Cache dữ liệu** khi cần thiết
5. **Sử dụng pagination** cho danh sách lớn
6. **Compress images** trước khi upload

## 🔄 Environment Setup

### Development
```
REACT_APP_API_BASE_URL=http://localhost:3001/api
```

### Production
```
REACT_APP_API_BASE_URL=https://api.hdndstore.com/api
```

## 📞 Support

Nếu gặp vấn đề, vui lòng liên hệ team development hoặc tạo issue trong repository.
