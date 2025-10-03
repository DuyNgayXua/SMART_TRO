import reportRepository from '../repositories/reportRepository.js';

// Báo cáo tin đăng
const reportProperty = async (req, res) => {
  console.log('Report Property Request Body:', req.body);
  console.log('Report Property Request Params:', req.params);
  console.log('Report Property Request User:', req.user);
  try {
    const { propertyId } = req.params;
    const { reason, description, contactEmail, reportedBy, propertyOwner, propertyTitle } = req.body;
    

    // Kiểm tra property có tồn tại không
    const property = await reportRepository.checkPropertyExists(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tin đăng.'
      });
    }

    // Kiểm tra user đã báo cáo property này chưa
    if (reportedBy) {
      const existingReport = await reportRepository.findExistingReport(propertyId, reportedBy);
      if (existingReport) {
        return res.status(400).json({
          success: false,
          message: 'Bạn đã báo cáo tin đăng này rồi. Vui lòng chờ xử lý.'
        });
      }
    }

    // Tạo báo cáo mới
    const reportData = {
      property: propertyId, // Đảm bảo propertyId được gán đúng
      propertyTitle: propertyTitle || property.title,
      reason,
      description,
      contactEmail,
      reporter: reportedBy || null,
      propertyOwner: propertyOwner || property.owner,
      status: 'pending'
    };

    console.log('Report Data before creating :', reportData);

    const newReport = await reportRepository.createReport(reportData);

    res.status(201).json({
      success: true,
      message: 'Báo cáo đã được gửi thành công',
      data: {
        reportId: newReport._id,
        status: newReport.status
      }
    });

  } catch (error) {
    console.error('Error creating property report:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo báo cáo',
      error: error.message
    });
  }
};

// Lấy danh sách báo cáo (dành cho admin)
const getPropertyReports = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      reason,
      startDate,
      endDate,
      propertyId
    } = req.query;

    const filters = {
      status,
      reason,
      startDate,
      endDate,
      propertyId
    };

    const options = {
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const result = await reportRepository.getReports(filters, options);

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error getting property reports:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách báo cáo',
      error: error.message
    });
  }
};

// Xử lý báo cáo (dành cho admin)
const handlePropertyReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { action, note } = req.body;
    const adminId = req.user?.id; // Từ middleware auth

    if (!['resolve', 'dismiss'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action không hợp lệ. Chỉ chấp nhận "resolve" hoặc "dismiss"'
      });
    }

    const report = await reportRepository.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy báo cáo'
      });
    }

    // Cập nhật trạng thái báo cáo
    const updateData = {
      status: action === 'resolve' ? 'resolved' : 'dismissed',
      processedBy: adminId,
      processedAt: new Date(),
      actionTaken: note
    };

    const updatedReport = await reportRepository.updateReport(reportId, updateData);

    // Nếu resolve, có thể ẩn property hoặc thực hiện action khác
    if (action === 'resolve') {
      await reportRepository.handleApprovedReport(report.property);
    }

    res.status(200).json({
      success: true,
      message: `Báo cáo đã được ${action === 'resolve' ? 'xử lý' : 'bỏ qua'}`,
      data: {
        reportId: updatedReport._id,
        status: updatedReport.status,
        processedAt: updatedReport.processedAt
      }
    });

  } catch (error) {
    console.error('Error handling property report:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xử lý báo cáo',
      error: error.message
    });
  }
};

// Lấy báo cáo chi tiết
const getReportDetail = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await reportRepository.getReportDetail(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy báo cáo'
      });
    }

    res.status(200).json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Error getting report detail:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy chi tiết báo cáo',
      error: error.message
    });
  }
};

// Thống kê báo cáo
const getReportStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const stats = await reportRepository.getReportStats(startDate, endDate);

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error getting report stats:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thống kê báo cáo',
      error: error.message
    });
  }
};

export {
  reportProperty,
  getPropertyReports,
  handlePropertyReport,
  getReportDetail,
  getReportStats
};
