# Backend Dockerfile cho Cloud Run
FROM node:18-alpine AS base

# Thư mục làm việc trong container
WORKDIR /app

# Copy file package trước để cache layer cài dependency
COPY package*.json ./

# Cài dependency production
RUN npm install --only=production --legacy-peer-deps

# Copy toàn bộ source backend vào container
# (NHỚ không copy .env bằng .dockerignore, ở dưới mình sẽ nhắc)
COPY . .

# Tạo user không phải root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

# Cloud Run sẽ inject PORT, mặc định 8080
ENV NODE_ENV=production
ENV PORT=8080

# Không bắt buộc nhưng để EXPOSE cho rõ
EXPOSE 8080


# Start app
CMD ["npm", "start"]
