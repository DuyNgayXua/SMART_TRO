const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class PropertyPackageAPI {
  // Get authorization headers
  getHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  // Lấy tất cả gói tin đăng
  async getAllPackages() {
    try {
      const timestamp = new Date().getTime(); // Cache busting
      const response = await fetch(`${API_BASE_URL}/properties-packages?t=${timestamp}`, {
        method: 'GET',
        headers: {
          ...this.getHeaders(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching packages:', error);
      throw error;
    }
  }

  // Lấy gói tin đăng theo ID
  async getPackageById(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/properties-packages/${id}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching package:', error);
      throw error;
    }
  }

  // Tính giá gói tin đăng
  async calculatePrice(packageIdOrName, duration, durationType, addFastRent = false) {
    try {
      // Xác định xem tham số đầu vào là ID hay name
      const isObjectId = typeof packageIdOrName === 'string' && packageIdOrName.length === 24 && /^[0-9a-fA-F]{24}$/.test(packageIdOrName);
      
      const requestBody = {
        duration,
        durationType,
        addFastRent
      };
      
      // Thêm packageId hoặc packageName tùy theo loại
      if (isObjectId) {
        requestBody.packageId = packageIdOrName;
      } else {
        requestBody.packageName = packageIdOrName;
      }
      
      const response = await fetch(`${API_BASE_URL}/properties-packages/calculate-price`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error calculating price:', error);
      throw error;
    }
  }

  // Tạo gói tin đăng mới (Admin only)
  async createPackage(packageData) {
    try {
      const response = await fetch(`${API_BASE_URL}/properties-packages`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(packageData)
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Create package error:', result);
        return {
          success: false,
          message: result.message || `HTTP error! status: ${response.status}`,
          errors: result.errors || []
        };
      }

      return result;
    } catch (error) {
      console.error('Error creating package:', error);
      return {
        success: false,
        message: 'Lỗi kết nối server',
        error: error.message
      };
    }
  }

  // Cập nhật gói tin đăng (Admin only)
  async updatePackage(id, packageData) {
    try {
      const response = await fetch(`${API_BASE_URL}/properties-packages/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(packageData)
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Update package error:', result);
        return {
          success: false,
          message: result.message || `HTTP error! status: ${response.status}`,
          errors: result.errors || []
        };
      }

      return result;
    } catch (error) {
      console.error('Error updating package:', error);
      return {
        success: false,
        message: 'Lỗi kết nối server',
        error: error.message
      };
    }
  }

  // Xóa gói tin đăng (Admin only)
  async deletePackage(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/properties-packages/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting package:', error);
      throw error;
    }
  }

  // Khởi tạo dữ liệu mẫu (Admin only)
  async initializePackages() {
    try {
      const response = await fetch(`${API_BASE_URL}/properties-packages/initialize`, {
        method: 'POST',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error initializing packages:', error);
      throw error;
    }
  }



  // Helper method để format giá tiền
  formatPrice(price) {
    if (!price && price !== 0) return '0';
    return new Intl.NumberFormat('vi-VN').format(price);
  }

  // Helper method để format ngày tháng
  formatDate(date) {
    return new Date(date).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  // Lấy danh sách properties của user để migration
  async getUserPropertiesForMigration() {
    try {
      const response = await fetch(`${API_BASE_URL}/my-properties/migration-properties`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching user properties for migration:', error);
      throw error;
    }
  }

  // Helper method để format thời gian
  formatDateTime(date) {
    return new Date(date).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

export default new PropertyPackageAPI();