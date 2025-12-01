# Python Image Service Dockerfile
FROM python:3.9-slim

# Không buffer log
ENV PYTHONUNBUFFERED=1

# Cloud Run sẽ truyền PORT vào env, mặc định 8080
ENV PORT=8080

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ source code trong thư mục python-image-service
COPY . .

# ------------------------------------------------------

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser
RUN chown -R appuser:appuser /app
USER appuser

# Expose port cho Cloud Run (chỉ mô tả)
EXPOSE 8080

# Health check (dùng PORT env)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD sh -c 'wget --no-verbose --tries=1 --spider "http://127.0.0.1:${PORT:-8080}/health" || exit 1'

# Start the application
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
