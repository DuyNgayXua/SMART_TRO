import adminReportRepository from '../repositories/adminReportPropertyRepository.js';
import emailService from '../../emailService.js';
import { validationResult } from 'express-validator';

const adminReportController = {
  // GET /api/admin/reports - Lấy danh sách báo cáo
  getReportsForAdmin: async (req, res) => {
    try {
      // Pagination & filter params
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status || 'all';
      const sortBy = req.query.sortBy || 'createdAt';
      const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
      const search = req.query.search || '';

      // Build filter
      let filter = {};

      // Status filter
      if (status !== 'all') {
        filter.status = status;
      }

      // Search filter
      if (search.trim()) {
        const searchFilter = await adminReportRepository.searchReports(search.trim());
        filter = { ...filter, ...searchFilter };
      }

      // Options
      const options = {
        page,
        limit,
        sortBy,
        sortOrder
      };

      const result = await adminReportRepository.getReportsWithFilter(filter, options);

      // Lấy thống kê báo cáo theo chủ sở hữu
      if (result.reports && result.reports.length > 0) {
        const ownerIds = result.reports
          .map(report => report.propertyOwner?._id || report.propertyOwner)
          .filter(Boolean);
        
        if (ownerIds.length > 0) {
          const reportCounts = await adminReportRepository.getReportCountsByOwner(ownerIds);
          
          // Gắn thống kê vào mỗi report
          result.reports = result.reports.map(report => {
            const ownerId = report.propertyOwner?._id?.toString() || report.propertyOwner?.toString();
            if (ownerId && reportCounts[ownerId]) {
              return {
                ...report,
                propertyOwnerStats: reportCounts[ownerId]
              };
            }
            return report;
          });
        }
      }

      res.json({
        success: true,
        message: 'Lấy danh sách báo cáo thành công',
        data: result
      });

    } catch (error) {
      console.error('Error in getReportsForAdmin:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy danh sách báo cáo',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // GET /api/admin/reports/stats - Thống kê báo cáo
  getReportStats: async (req, res) => {
    try {
      const stats = await adminReportRepository.getReportStats();

      res.json({
        success: true,
        message: 'Lấy thống kê báo cáo thành công',
        data: stats
      });

    } catch (error) {
      console.error('Error in getReportStats:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy thống kê báo cáo',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // GET /api/admin/reports/:id - Chi tiết báo cáo
  getReportDetails: async (req, res) => {
    try {
      const { id: reportId } = req.params;

      if (!reportId) {
        return res.status(400).json({
          success: false,
          message: 'ID báo cáo không hợp lệ'
        });
      }

      const report = await adminReportRepository.getReportById(reportId);

      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy báo cáo'
        });
      }

      res.json({
        success: true,
        message: 'Lấy chi tiết báo cáo thành công',
        data: report
      });

    } catch (error) {
      console.error('Error in getReportDetails:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy chi tiết báo cáo',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // PUT /api/admin/reports/:id/dismiss - Bỏ qua báo cáo
  dismissReport: async (req, res) => {
    try {
      const { id: reportId } = req.params;
      const adminId = req.user.userId || req.user.id;

      if (!reportId) {
        return res.status(400).json({
          success: false,
          message: 'ID báo cáo không hợp lệ'
        });
      }

      // Kiểm tra báo cáo tồn tại và chưa được xử lý
      const existingReport = await adminReportRepository.getReportById(reportId);
      
      if (!existingReport) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy báo cáo'
        });
      }

      if (existingReport.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Báo cáo đã được xử lý trước đó'
        });
      }

      // Bỏ qua báo cáo
      const updatedReport = await adminReportRepository.dismissReport(reportId, adminId);

      // Log action (có thể gửi tới logging service)
      console.log(`Admin ${adminId} dismissed report ${reportId} for property ${updatedReport.property?._id}`);

      res.json({
        success: true,
        message: 'Báo cáo đã được bỏ qua thành công',
        data: updatedReport
      });

    } catch (error) {
      console.error('Error in dismissReport:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi bỏ qua báo cáo',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // PUT /api/admin/reports/:id/warning - Gửi email cảnh báo
  sendWarning: async (req, res) => {
    try {
      const { id: reportId } = req.params;
      const { reason } = req.body;
      const adminId = req.user.userId || req.user.id;

      // Validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: errors.array()
        });
      }

      if (!reportId) {
        return res.status(400).json({
          success: false,
          message: 'ID báo cáo không hợp lệ'
        });
      }

      if (!reason || reason.trim().length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Lý do cảnh báo phải có ít nhất 10 ký tự'
        });
      }

      // Kiểm tra báo cáo tồn tại
      const existingReport = await adminReportRepository.getReportById(reportId);
      
      if (!existingReport) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy báo cáo'
        });
      }

      if (existingReport.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Báo cáo đã được xử lý trước đó'
        });
      }

      if (!existingReport.property || !existingReport.property.owner) {
        return res.status(400).json({
          success: false,
          message: 'Không tìm thấy thông tin chủ sở hữu bài đăng'
        });
      }

      // Cập nhật báo cáo
      const updatedReport = await adminReportRepository.sendWarningForReport(reportId, adminId, reason);

      // Gửi email cảnh báo tới chủ sở hữu
      try {
        // Sử dụng updatedReport vì nó đã được populate đầy đủ
        if (!updatedReport.property?.owner?.email) {
          throw new Error('Không tìm thấy email chủ bài đăng');
        }

        await emailService.sendWarningEmail({
          to: updatedReport.property.owner.email,
          ownerName: updatedReport.property.owner.fullName || 'Chủ bài đăng',
          propertyTitle: updatedReport.property.title || 'Bài đăng',
          reason: reason,
          reportReason: existingReport.reason
        });

        console.log(`Warning email sent to ${updatedReport.property.owner.email} for report ${reportId}`);
      } catch (emailError) {
        console.error('Error sending warning email:', emailError);
        // Trả về lỗi nếu không gửi được email
        return res.status(500).json({
          success: false,
          message: 'Đã xử lý báo cáo nhưng không thể gửi email cảnh báo',
          error: emailError.message
        });
      }

      // Log action
      console.log(`Admin ${adminId} sent warning for report ${reportId} - Property: ${updatedReport.property?._id}`);

      res.json({
        success: true,
        message: 'Đã gửi email cảnh báo tới chủ bài đăng thành công',
        data: updatedReport
      });

    } catch (error) {
      console.error('Error in sendWarning:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi gửi cảnh báo',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // PUT /api/admin/reports/:id/hide - Ẩn bài đăng
  hideProperty: async (req, res) => {
    try {
      const { id: reportId } = req.params;
      const { reason } = req.body;
      const adminId = req.user.userId || req.user.id;
      console.log('Admin ID:', adminId);
      console.log('Report ID:', reportId);
      console.log('Reason:', reason);

      // Validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => error.msg).join(', ');
        return res.status(400).json({
          success: false,
          message: `Dữ liệu không hợp lệ: ${errorMessages}`,
          errors: errors.array()
        });
      }

      if (!reportId) {
        return res.status(400).json({
          success: false,
          message: 'ID báo cáo không hợp lệ'
        });
      }

      if (!reason || reason.trim().length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Lý do ẩn bài đăng phải có ít nhất 3 ký tự'
        });
      }

      // Kiểm tra báo cáo tồn tại
      const existingReport = await adminReportRepository.getReportById(reportId);
      
      if (!existingReport) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy báo cáo'
        });
      }

      if (existingReport.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Báo cáo đã được xử lý trước đó'
        });
      }

      if (!existingReport.property) {
        return res.status(400).json({
          success: false,
          message: 'Bài đăng đã bị xóa hoặc không tồn tại'
        });
      }

      // Ẩn bài đăng và cập nhật báo cáo
      const updatedReport = await adminReportRepository.hidePropertyForReport(reportId, adminId, reason);
      console.log('Updated Report after hiding property:', updatedReport);

      // Gửi email thông báo tới chủ sở hữu
      try {
        // Lấy thông tin chủ sở hữu từ propertyOwner (vì property có thể đã bị xóa)
        const User = req.app.locals.schemas.User;
        const propertyOwner = await User.findById(updatedReport.propertyOwner || existingReport.propertyOwner);
        
        if (!propertyOwner?.email) {
          throw new Error('Không tìm thấy email chủ bài đăng');
        }

        await emailService.sendPropertyHiddenEmail({
          to: propertyOwner.email,
          ownerName: propertyOwner.fullName || 'Chủ bài đăng',
          propertyTitle: updatedReport.propertyTitle || existingReport.propertyTitle || 'Bài đăng',
          reason: reason,
          reportReason: existingReport.reason
        });

        console.log(`Property hidden notification sent to ${propertyOwner.email}`);
      } catch (emailError) {
        console.error('Error sending property hidden email:', emailError);
        // Trả về thông báo nhưng vẫn thành công vì bài đăng đã được ẩn
        console.warn('Bài đăng đã được ẩn nhưng không thể gửi email thông báo');
      }

      // Log action
      console.log(`Admin ${adminId} hid property ${existingReport.property._id} for report ${reportId}`);

      res.json({
        success: true,
        message: 'Bài đăng đã được ẩn thành công',
        data: updatedReport
      });

    } catch (error) {
      console.error('Error in hideProperty:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi ẩn bài đăng',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};

export default adminReportController;