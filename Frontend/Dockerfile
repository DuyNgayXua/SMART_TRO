# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

ENV NODE_ENV=production
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Copy file cấu hình nginx (listen 8080)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build React sang nginx
COPY --from=builder /app/build /usr/share/nginx/html

RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Cloud Run dùng PORT=8080
ENV PORT=8080
EXPOSE 8080


CMD ["nginx", "-g", "daemon off;"]
