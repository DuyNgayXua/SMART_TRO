const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

class AdminReportsAPI {
  // Get authorization headers
  getHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  // Get reports for admin with pagination and filtering
  async getReportsForAdmin(page = 1, status = 'all', limit = 10, search = '') {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(status !== 'all' && { status }),
        ...(search && { search })
      });

      const response = await fetch(`${API_BASE_URL}/admin/report-properties?${params}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching reports:', error);
      throw error;
    }
  }

  // Get report statistics
  async getReportStats() {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/report-properties/stats`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching report stats:', error);
      throw error;
    }
  }

  // Dismiss a report (mark as dismissed)
  async dismissReport(reportId) {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/report-properties/${reportId}/dismiss`, {
        method: 'PUT',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error dismissing report:', error);
      throw error;
    }
  }

  // Send warning email to property owner
  async sendWarning(reportId, reason) {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/report-properties/${reportId}/warning`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ reason })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending warning:', error);
      throw error;
    }
  }

  // Hide/soft delete the reported property
  async hideProperty(reportId, reason) {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/report-properties/${reportId}/hide`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ reason })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error hiding property:', error);
      throw error;
    }
  }

  // Get report details by ID
  async getReportDetails(reportId) {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/report-properties/${reportId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching report details:', error);
      throw error;
    }
  }
}

export default new AdminReportsAPI();