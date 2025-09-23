import adminPropertyRepository from '../repositories/adminPropertyRepository.js';

class AdminPropertyController {
  // Lấy danh sách properties cho admin
  async getPropertiesForAdmin(req, res) {
    try {
      const { page = 1, limit = 10, status = 'all', search = '' } = req.query;
      
      // Build filter
      let filter = {};
      if (status !== 'all') {
        filter.approvalStatus = status;
      }

      // Add search filter
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { contactName: { $regex: search, $options: 'i' } },
          { contactPhone: { $regex: search, $options: 'i' } }
        ];
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit)
      };

      const result = await adminPropertyRepository.getPropertiesWithFilter(filter, options);

      res.status(200).json({
        success: true,
        message: 'Lấy danh sách bài đăng thành công',
        data: result
      });
    } catch (error) {
      console.error('Error getting properties for admin:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy danh sách bài đăng',
        error: error.message
      });
    }
  }

  // Duyệt bài đăng
  async approveProperty(req, res) {
    try {
      const { propertyId } = req.params;
      const adminId = req.user.id;

      // Kiểm tra property tồn tại
      const property = await adminPropertyRepository.getPropertyById(propertyId);
      if (!property) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy bài đăng'
        });
      }

      // Kiểm tra trạng thái hiện tại
      if (property.approvalStatus === 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Bài đăng đã được duyệt trước đó'
        });
      }

      // Duyệt property
      const updatedProperty = await adminPropertyRepository.approveProperty(propertyId, adminId);

      // Log hoạt động
      console.log(`Property ${propertyId} approved by admin ${adminId} at ${new Date()}`);

      res.status(200).json({
        success: true,
        message: 'Bài đăng đã được duyệt thành công',
        data: updatedProperty
      });
    } catch (error) {
      console.error('Error approving property:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi duyệt bài đăng',
        error: error.message
      });
    }
  }

  // Từ chối bài đăng
  async rejectProperty(req, res) {
    try {
      const { propertyId } = req.params;
      const { reason } = req.body;
      const adminId = req.user.id;

      // Validate lý do từ chối
      if (!reason || !reason.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập lý do từ chối'
        });
      }

      // Kiểm tra property tồn tại
      const property = await adminPropertyRepository.getPropertyById(propertyId);
      if (!property) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy bài đăng'
        });
      }

      // Kiểm tra trạng thái hiện tại
      if (property.approvalStatus === 'rejected') {
        return res.status(400).json({
          success: false,
          message: 'Bài đăng đã bị từ chối trước đó'
        });
      }

      // Từ chối property
      const updatedProperty = await adminPropertyRepository.rejectProperty(
        propertyId, 
        adminId, 
        reason.trim()
      );

      // Log hoạt động
      console.log(`Property ${propertyId} rejected by admin ${adminId} at ${new Date()}: ${reason}`);

      res.status(200).json({
        success: true,
        message: 'Bài đăng đã bị từ chối',
        data: updatedProperty
      });
    } catch (error) {
      console.error('Error rejecting property:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi từ chối bài đăng',
        error: error.message
      });
    }
  }

  // Lấy thống kê bài đăng
  async getPropertyStats(req, res) {
    try {
      const stats = await adminPropertyRepository.getPropertyStats();

      res.status(200).json({
        success: true,
        message: 'Lấy thống kê thành công',
        data: stats
      });
    } catch (error) {
      console.error('Error getting property stats:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy thống kê',
        error: error.message
      });
    }
  }

  // Lấy chi tiết property
  async getPropertyDetail(req, res) {
    try {
      const { propertyId } = req.params;

      const property = await adminPropertyRepository.getPropertyById(propertyId);
      if (!property) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy bài đăng'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Lấy chi tiết bài đăng thành công',
        data: property
      });
    } catch (error) {
      console.error('Error getting property detail:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy chi tiết bài đăng',
        error: error.message
      });
    }
  }
}

export default new AdminPropertyController();
