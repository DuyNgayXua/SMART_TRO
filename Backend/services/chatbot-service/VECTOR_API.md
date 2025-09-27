# Vector Routes API Documentation

## 📋 Tổng quan

Vector Routes API cung cấp các endpoints để quản lý và tương tác với Vector Database cache của Smart Tro Chatbot. Hệ thống tự động lưu trữ các câu hỏi/trả lời và sử dụng semantic search để tăng tốc phản hồi.

## 🔗 Base URL
```
http://localhost:5000/api/chatbot
```

## 🎯 Flow hoạt động

### 1. **Normal Chatbot Flow (Với Vector Caching)**
```
User Question → Check Vector Cache → [Cache Hit] Return Cached Response
                                  → [Cache Miss] Process with Ollama → Save to Cache → Return Response
```

### 2. **Manual Management Flow**
```
Admin → Save Manual Q&A → Search/Filter Entries → Export/Import → Verify/Delete
```

---

## 🚀 API Endpoints

### 1. Chatbot Message (với Vector Caching)

**POST** `/message`

Gửi tin nhắn tới chatbot với tự động caching và tìm kiếm vector.

#### Request:
```json
{
  "message": "Tìm phòng trọ gần đại học công nghiệp"
}
```

#### Response (Cache Hit):
```json
{
  "success": true,
  "data": {
    "isRoomSearchQuery": true,
    "searchParams": { "category": "phong_tro" },
    "processingTime": "45ms (cached)",
    "source": "vector-cache",
    "similarity": 0.92,
    "originalQuestion": "Tìm phòng trọ gần ĐH Công nghiệp"
  }
}
```

#### Response (Cache Miss):
```json
{
  "success": true,
  "data": {
    "isRoomSearchQuery": true,
    "searchParams": { "category": "phong_tro" },
    "processingTime": "2340ms",
    "source": "ollama"
  }
}
```

---

### 2. Vector Search (Tìm kiếm trực tiếp)

**POST** `/vector-search`

Tìm kiếm câu hỏi tương tự trong vector database.

#### Request:
```json
{
  "question": "Phòng trọ sinh viên",
  "threshold": 0.85
}
```

#### Response (Found):
```json
{
  "success": true,
  "data": {
    "found": true,
    "question": "Tìm phòng trọ cho sinh viên",
    "response": { "searchParams": {...} },
    "similarity": 0.89,
    "searchTime": "120ms",
    "source": "vector-cache"
  }
}
```

#### Response (Not Found):
```json
{
  "success": true,
  "data": {
    "found": false,
    "message": "Không tìm thấy câu hỏi tương tự",
    "searchTime": "95ms",
    "suggestion": "Hãy sử dụng /api/chatbot/message để xử lý câu hỏi mới"
  }
}
```

---

### 3. Manual Save (Lưu thủ công) 🔒 **Admin Only**

**POST** `/vector-save`

Lưu thủ công câu hỏi/trả lời vào vector database.

#### Headers:
```
Authorization: Bearer {admin-jwt-token}
```

#### Request:
```json
{
  "question": "Câu hỏi mẫu",
  "response": {
    "isRoomSearchQuery": true,
    "message": "Câu trả lời",
    "searchParams": { "category": "phong_tro" }
  },
  "metadata": {
    "type": "manual",
    "priority": "high",
    "tags": ["important", "verified"],
    "adminNotes": "Câu hỏi thường gặp"
  },
  "overwrite": false
}
```

#### Response (Success):
```json
{
  "success": true,
  "message": "Đã lưu câu hỏi/trả lời vào vector database",
  "data": {
    "question": "Câu hỏi mẫu",
    "saved": true,
    "saveTime": "234ms"
  }
}
```

#### Response (Conflict):
```json
{
  "success": false,
  "message": "Đã có câu hỏi tương tự trong database",
  "data": {
    "existingQuestion": "Câu hỏi tương tự",
    "similarity": 0.96,
    "suggestion": "Sử dụng overwrite=true để ghi đè"
  }
}
```

---

## 🔧 Vector Management Endpoints 🔒 **Admin Only**

### 4. Statistics (Thống kê)

**GET** `/vector/stats`

#### Response:
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalEntries": 1250,
      "recentEntries": 45,
      "totalUsage": 8932,
      "avgUsageCount": 7.15,
      "avgProcessingTime": 1234.56
    },
    "topQuestions": [
      {
        "question": "Tìm phòng trọ sinh viên...",
        "usageCount": 156,
        "type": "room-search-query",
        "lastUsed": "2025-09-27T10:30:00Z"
      }
    ],
    "typeBreakdown": [
      { "_id": "room-search-query", "count": 890 },
      { "_id": "non-room-query", "count": 360 }
    ],
    "sourceBreakdown": [
      { "_id": "ollama", "count": 1100 },
      { "_id": "manual", "count": 150 }
    ]
  }
}
```

### 5. Entries List (Danh sách entries)

**GET** `/vector/entries`

#### Query Parameters:
- `type`: Filter theo type (`room-search-query`, `non-room-query`, `manual`, etc.)
- `source`: Filter theo source (`ollama`, `manual`, `quick-check`)  
- `verified`: Filter theo trạng thái verify (`true`, `false`)
- `question`: Tìm kiếm trong nội dung câu hỏi
- `limit`: Giới hạn số kết quả (default: 20)

#### Example:
```
GET /vector/entries?type=room-search-query&verified=true&limit=10
```

#### Response:
```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "id": "64f5a1b2c3d4e5f6a7b8c9d0",
        "question": "Tìm phòng trọ gần đại học...",
        "type": "room-search-query",
        "source": "ollama",
        "usageCount": 25,
        "createdAt": "2025-09-27T09:15:00Z",
        "verified": true,
        "tags": ["student", "university"]
      }
    ],
    "count": 10,
    "filters": {
      "type": "room-search-query",
      "verified": true
    }
  }
}
```

### 6. History (Lịch sử)

**GET** `/vector/history`

#### Query Parameters:
- `days`: Số ngày gần đây (default: 7)
- `limit`: Giới hạn số kết quả (default: 50)
- `type`: Filter theo type
- `source`: Filter theo source

#### Example:
```
GET /vector/history?days=3&limit=20&source=ollama
```

### 7. Verify Entry (Xác thực entry)

**PATCH** `/vector/entries/{id}/verify`

#### Request:
```json
{
  "adminNotes": "Đã kiểm tra và xác nhận chính xác"
}
```

### 8. Delete Entry (Xóa entry)

**DELETE** `/vector/entries/{id}`

Thực hiện soft delete (không xóa vĩnh viễn).

### 9. Export Data (Xuất dữ liệu)

**GET** `/vector/export`

#### Query Parameters:
- `format`: `json` hoặc `csv` (default: json)
- `type`: Filter theo type
- `verified`: Filter theo trạng thái verify

#### Examples:
```
GET /vector/export?format=csv&verified=true
GET /vector/export?format=json&type=room-search-query
```

### 10. Import Data (Nhập dữ liệu bulk)

**POST** `/vector/import`

#### Request:
```json
{
  "entries": [
    {
      "question": "Câu hỏi 1",
      "response": "Trả lời 1",
      "type": "manual",
      "priority": "high",
      "tags": ["import"]
    },
    {
      "question": "Câu hỏi 2", 
      "response": { "data": "object response" },
      "verified": true
    }
  ]
}
```

### 11. Health Check

**GET** `/vector/health`

#### Response:
```json
{
  "success": true,
  "message": "Vector database đang hoạt động",
  "data": {
    "connected": true,
    "overview": {
      "totalEntries": 1250,
      "recentEntries": 45,
      "totalUsage": 8932
    }
  }
}
```

---

## 🔐 Authentication

### Public Endpoints (Không cần token):
- `POST /message`
- `POST /vector-search`

### Admin Endpoints (Cần JWT token):
- `POST /vector-save`
- `GET /vector/*` (tất cả vector management)
- `PATCH /vector/entries/{id}/verify`
- `DELETE /vector/entries/{id}`

#### Header format:
```
Authorization: Bearer {jwt-token}
```

---

## 🧪 Testing

### 1. Chạy test script:
```bash
npm run test-vector
```

### 2. Manual testing với curl:

#### Test message:
```bash
curl -X POST http://localhost:5000/api/chatbot/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Tìm phòng trọ sinh viên"}'
```

#### Test vector search:
```bash
curl -X POST http://localhost:5000/api/chatbot/vector-search \
  -H "Content-Type: application/json" \
  -d '{"question": "phòng trọ", "threshold": 0.8}'
```

#### Test save (cần token):
```bash
curl -X POST http://localhost:5000/api/chatbot/vector-save \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"question": "Test", "response": "Response"}'
```

---

## 📊 Monitoring & Analytics

### Key Metrics được track:
- **Usage Count**: Số lần câu hỏi được match
- **Similarity Scores**: Độ tương đồng khi tìm thấy
- **Processing Time**: Thời gian xử lý (cached vs fresh)
- **Source Tracking**: Nguồn gốc câu hỏi (ollama, manual, etc.)
- **Type Distribution**: Phân bố loại câu hỏi

### Auto-behaviors:
- **Auto-save**: Tự động lưu mọi interaction thành công
- **Cache cleanup**: Tự động dọn dẹp entries cũ ít dùng  
- **Usage increment**: Tự động tăng usage count khi match
- **Similarity update**: Cập nhật similarity score gần nhất

---

## 🎯 Best Practices

### 1. **Threshold Selection:**
- **0.95+**: Exact matches (cho auto-serve)
- **0.85-0.94**: High similarity (recommended default)
- **0.70-0.84**: Medium similarity (cho exploration)
- **< 0.70**: Low similarity (thường bỏ qua)

### 2. **Manual Entry Guidelines:**
- Sử dụng `priority: "high"` cho câu hỏi phổ biến
- Thêm `tags` để dễ phân loại
- `verified: true` cho entries đã kiểm tra
- Sử dụng `adminNotes` để ghi chú context

### 3. **Performance Tips:**
- Cache hit rate thường > 80% cho optimal performance  
- Monitor `avgProcessingTime` - cached queries should be < 200ms
- Regular cleanup entries với `usageCount: 0`
- Use filters khi query lượng lớn data

---

## 🚨 Error Handling

### Common Error Codes:
- **400**: Bad Request (thiếu parameters)
- **401**: Unauthorized (thiếu/sai token)  
- **404**: Not Found (entry không tồn tại)
- **409**: Conflict (duplicate entry khi save)
- **500**: Internal Server Error
- **503**: Service Unavailable (vector DB down)

### Error Response Format:
```json
{
  "success": false,
  "message": "Mô tả lỗi",
  "error": "Chi tiết lỗi kỹ thuật"
}
```
