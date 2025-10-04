import Report from '../../../schemas/Report.js';
import Property from '../../../schemas/Property.js';

class adminReportPropertyRepository {
  // Lấy danh sách báo cáo với filter và pagination
  async getReportsWithFilter(filter, options) {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = -1 } = options;
    const skip = (page - 1) * limit;

    // Add isDeleted filter để loại trừ báo cáo đã bị xóa
    const finalFilter = { ...filter, isDeleted: { $ne: true } };

    const reports = await Report.find(finalFilter)
      .populate('property', 'title _id owner images')
      .populate('reporter', 'fullName email avatar')
      .populate('property.owner', 'fullName email')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalReports = await Report.countDocuments(finalFilter);
    const totalPages = Math.ceil(totalReports / limit);

    return {
      reports,
      pagination: {
        currentPage: page,
        totalPages,
        totalReports,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  // Lấy báo cáo theo ID .
  async getReportById(reportId) {
    return await Report.findById(reportId)
      .populate('property', 'title _id owner images category')
      .populate('reporter', 'fullName email avatar phone')
      .populate('property.owner', 'fullName email phone')
      .lean();
  }

  // Thống kê báo cáo
  async getReportStats() {
    const stats = await Report.aggregate([
      {
        $match: { isDeleted: { $ne: true } }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Format stats
    const formattedStats = {
      total: 0,
      pending: 0,
      resolved: 0,
      dismissed: 0
    };

    stats.forEach(stat => {
      if (stat._id && formattedStats.hasOwnProperty(stat._id)) {
        formattedStats[stat._id] = stat.count;
        formattedStats.total += stat.count;
      }
    });

    return formattedStats;
  }

  // Bỏ qua báo cáo (dismiss)
  async dismissReport(reportId, adminId) {
    const updatedReport = await Report.findByIdAndUpdate(
      reportId,
      {
        status: 'dismissed',
        actionTaken: 'Báo cáo đã bị quản trị viên bác bỏ - không tìm thấy vi phạm',
        processedAt: new Date(),
        processedBy: adminId,
        updatedAt: new Date()
      },
      { new: true }
    ).populate('property', 'title _id')
     .populate('reporter', 'fullName email');

    return updatedReport;
  }

  // Gửi cảnh báo (warning)
  async sendWarningForReport(reportId, adminId, reason) {
    // Trước tiên lấy report với đầy đủ thông tin owner
    const report = await Report.findById(reportId)
      .populate({
        path: 'property',
        select: 'title _id owner',
        populate: {
          path: 'owner',
          select: 'fullName email _id avatar'
        }
      })
      .populate('reporter', 'fullName email avatar');

    if (!report) {
      throw new Error('Report not found');
    }

    if (!report.property) {
      throw new Error('Property not found for this report');
    }

    if (!report.property.owner || !report.property.owner.email) {
      throw new Error('Property owner email avatar not found');
    }

    // Update report sau khi đã validate
    const updatedReport = await Report.findByIdAndUpdate(
      reportId,
      {
        status: 'resolved',
        actionTaken: `Đã xử lý, xóa bài đăng: ${reason}`,
        processedAt: new Date(),
        processedBy: adminId,
        updatedAt: new Date()
      },
      { new: true }
    ).populate({
        path: 'property',
        select: 'title _id owner',
        populate: {
          path: 'owner',
          select: 'fullName email _id avatar'
        }
      })
      .populate('reporter', 'fullName email avatar');

    return updatedReport;
  }

  // Ẩn bài đăng (hide property)
  async hidePropertyForReport(reportId, adminId, reason) {
    const report = await Report.findById(reportId)
      .populate({
        path: 'property',
        select: 'title _id owner',
        populate: {
          path: 'owner',
          select: 'fullName email _id avatar'
        }
      });
    
    if (!report || !report.property) {
      throw new Error('Report or property not found');
    }

    if (!report.property.owner || !report.property.owner.email) {
      throw new Error('Property owner email not found');
    }

    // Soft delete property
    await Property.findByIdAndUpdate(
      report.property._id,
      {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: adminId,
        deletionReason: `Ẩn do báo cáo: ${reason}`
      }
    );

    // Update report
    const updatedReport = await Report.findByIdAndUpdate(
      reportId,
      {
        status: 'resolved',
        actionTaken: `Bài đăng bị ẩn do vi phạm. Lý do: ${reason}`,
        processedAt: new Date(),
        processedBy: adminId,
        updatedAt: new Date()
      },
      { new: true }
    ).populate({
        path: 'property',
        select: 'title _id owner',
        populate: {
          path: 'owner',
          select: 'fullName email _id avatar'
        }
      })
      .populate('reporter', 'fullName email avatar');

    return updatedReport;
  }

  // Tìm kiếm báo cáo
  async searchReports(searchTerm) {
    const searchRegex = new RegExp(searchTerm, 'i');
    
    return {
      $or: [
        { reason: searchRegex },
        { description: searchRegex },
        { 'property.title': searchRegex }
      ]
    };
  }

  // Lấy báo cáo theo status
  async getReportsByStatus(status) {
    return await Report.find({ 
      status, 
      isDeleted: { $ne: true } 
    })
      .populate('property', 'title _id owner')
      .populate('reporter', 'fullName email avatar')
      .sort({ createdAt: -1 })
      .lean();
  }
}

export default new adminReportPropertyRepository();
