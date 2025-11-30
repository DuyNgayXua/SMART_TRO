/**
 * Admin Properties API Service
 * Quản lý các API calls cho admin properties management
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token');
};

// Common headers for authenticated requests
const getAuthHeaders = () => ({
  'Authorization': `Bearer ${getAuthToken()}`,
  'Content-Type': 'application/json',
});

/**
 * Get properties for admin with pagination and filter
 * @param {number} page - Page number (default: 1)
 * @param {string} status - Filter status: pending, approved, rejected, all (default: pending)
 * @param {number} limit - Items per page (default: 10)
 * @param {string} search - Search term for title, contact name, phone (optional)
 */
export const getPropertiesForAdmin = async (page = 1, status = 'pending', limit = 10, search = '') => {
  try {
    let url = `${API_BASE_URL}/admin/properties?page=${page}&status=${status}&limit=${limit}`;
    
    if (search && search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`;
    }
    
    const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Không thể tải danh sách bài đăng');
    }

    return data;
  } catch (error) {
    console.error('Error fetching properties for admin:', error);
    throw error;
  }
};

/**
 * Approve a property
 * @param {string} propertyId - Property ID to approve
 */
export const approveProperty = async (propertyId) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/properties/${propertyId}/approve`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Không thể duyệt bài đăng');
    }

    return data;
  } catch (error) {
    console.error('Error approving property:', error);
    throw error;
  }
};

/**
 * Reject a property with reason
 * @param {string} propertyId - Property ID to reject
 * @param {string} reason - Reason for rejection
 */
export const rejectProperty = async (propertyId, reason) => {
  try {
    if (!reason || !reason.trim()) {
      throw new Error('Vui lòng nhập lý do từ chối');
    }

    const response = await fetch(
      `${API_BASE_URL}/admin/properties/${propertyId}/reject`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          reason: reason.trim()
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Không thể từ chối bài đăng');
    }

    return data;
  } catch (error) {
    console.error('Error rejecting property:', error);
    throw error;
  }
};

/**
 * Get property statistics for admin dashboard
 */
export const getPropertyStats = async () => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/properties/stats`,
      {
        method: 'GET',
        headers: getAuthHeaders(),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Không thể tải thống kê bài đăng');
    }

    return data;
  } catch (error) {
    console.error('Error fetching property stats:', error);
    throw error;
  }
};

/**
 * Get property details by ID for admin
 * @param {string} propertyId - Property ID
 */
export const getPropertyDetails = async (propertyId) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/properties/${propertyId}`,
      {
        method: 'GET',
        headers: getAuthHeaders(),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Không thể tải chi tiết bài đăng');
    }

    return data;
  } catch (error) {
    console.error('Error fetching property details:', error);
    throw error;
  }
};

/**
 * Bulk approve multiple properties
 * @param {string[]} propertyIds - Array of property IDs to approve
 */
export const bulkApproveProperties = async (propertyIds) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/properties/bulk-approve`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          propertyIds
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Không thể duyệt hàng loạt bài đăng');
    }

    return data;
  } catch (error) {
    console.error('Error bulk approving properties:', error);
    throw error;
  }
};

/**
 * Toggle property visibility (hide/show by updating isDeleted field)
 * @param {string} propertyId - Property ID to toggle
 * @param {boolean} isDeleted - Set property as deleted (hidden) or not
 * @param {string} reason - Reason for hiding (optional, only when isDeleted = true)
 */
export const togglePropertyVisibility = async (propertyId, isDeleted, reason = null) => {
  try {
    if (!propertyId) {
      throw new Error('Property ID is required');
    }

    const body = { isDeleted: isDeleted };
    
    // Chỉ thêm reason khi ẩn tin đăng
    if (isDeleted && reason) {
      body.reason = reason;
    }

    const response = await fetch(
      `${API_BASE_URL}/admin/properties/${propertyId}/toggle-visibility`,
      {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Không thể thay đổi trạng thái hiển thị');
    }

    return data;
  } catch (error) {
    console.error('Error toggling property visibility:', error);
    throw error;
  }
};

/**
 * Bulk reject multiple properties
 * @param {string[]} propertyIds - Array of property IDs to reject
 * @param {string} reason - Common reason for rejection
 */
export const bulkRejectProperties = async (propertyIds, reason) => {
  try {
    if (!reason || !reason.trim()) {
      throw new Error('Vui lòng nhập lý do từ chối');
    }

    const response = await fetch(
      `${API_BASE_URL}/admin/properties/bulk-reject`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          propertyIds,
          reason: reason.trim()
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Không thể từ chối hàng loạt bài đăng');
    }

    return data;
  } catch (error) {
    console.error('Error bulk rejecting properties:', error);
    throw error;
  }
};

// Export default object with all functions
const adminPropertiesAPI = {
  getPropertiesForAdmin,
  approveProperty,
  rejectProperty,
  getPropertyStats,
  getPropertyDetails,
  togglePropertyVisibility,
  bulkApproveProperties,
  bulkRejectProperties
};

export default adminPropertiesAPI;