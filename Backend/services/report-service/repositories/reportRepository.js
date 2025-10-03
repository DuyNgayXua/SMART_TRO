import Report from '../../../schemas/Report.js';
import Property from '../../../schemas/Property.js';

class ReportRepository {
  // Kiểm tra property có tồn tại không
  async checkPropertyExists(propertyId) {
    try {
      return await Property.findById(propertyId);
    } catch (error) {
      throw error;
    }
  }
  // Tạo báo cáo mới
  async createReport(reportData) {
    try {
      console.log('Repository creating report with data:', reportData);
      const report = new Report({
        reporter: reportData.reporter,
        property: reportData.property, // Sửa từ reportData.propertyId thành reportData.property
        reason: reportData.reason,
        description: reportData.description,
        contactEmail: reportData.contactEmail,
        propertyTitle: reportData.propertyTitle,
        propertyOwner: reportData.propertyOwner,
        status: reportData.status || 'pending'
      });

      return await report.save();
    } catch (error) {
      console.error('Repository error creating report:', error);
      throw error;
    }
  }

  // Tìm báo cáo đã tồn tại
  async findExistingReport(propertyId, reportedBy) {
    try {
      return await Report.findOne({
        property: propertyId,
        reporter: reportedBy,
        status: 'pending'
      });
    } catch (error) {
      throw error;
    }
  }

  // Tìm báo cáo theo ID
  async findById(reportId) {
    try {
      return await Report.findById(reportId);
    } catch (error) {
      throw error;
    }
  }

  // Lấy danh sách báo cáo với phân trang và lọc
  async getReports(filters, options) {
    try {
      const { status, reason, startDate, endDate, propertyId } = filters;
      const { page, limit } = options;

      const filter = {};

      // Lọc theo status
      if (status) {
        filter.status = status;
      }

      // Lọc theo lý do
      if (reason) {
        filter.reason = reason;
      }

      // Lọc theo khoảng thời gian
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) {
          filter.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          filter.createdAt.$lte = new Date(endDate);
        }
      }

      // Lọc theo property
      if (propertyId) {
        filter.property = propertyId;
      }

      const skip = (page - 1) * limit;

      const reports = await Report
        .find(filter)
        .populate('property', 'title rentPrice images detailAddress approvalStatus')
        .populate('reporter', 'fullName email')
        .populate('processedBy', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Report.countDocuments(filter);

      return {
        reports,
        pagination: {
          current: page,
          total: Math.ceil(total / limit),
          totalRecords: total,
          limit
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Cập nhật báo cáo
  async updateReport(reportId, updateData) {
    try {
      return await Report.findByIdAndUpdate(
        reportId,
        {
          status: updateData.status,
          processedBy: updateData.processedBy,
          processedAt: updateData.processedAt,
          actionTaken: updateData.actionTaken
        },
        { new: true }
      );
    } catch (error) {
      throw error;
    }
  }

  // Xử lý báo cáo được approve
  async handleApprovedReport(propertyId) {
    try {
      const property = await Property.findById(propertyId);
      if (property && property.approvalStatus !== 'rejected') {
        // Có thể set property thành pending để review lại
        property.approvalStatus = 'pending';
        property.reportCount = (property.reportCount || 0) + 1;
        await property.save();
      }
    } catch (error) {
      throw error;
    }
  }

  // Lấy chi tiết báo cáo
  async getReportDetail(reportId) {
    try {
      return await Report
        .findById(reportId)
        .populate('property', 'title rentPrice images detailAddress approvalStatus owner')
        .populate('reporter', 'fullName email')
        .populate('processedBy', 'fullName email');
    } catch (error) {
      throw error;
    }
  }

  // Thống kê báo cáo
  async getReportStats(startDate, endDate) {
    try {
      const matchFilter = {};
      if (startDate || endDate) {
        matchFilter.createdAt = {};
        if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
        if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
      }

      const stats = await Report.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            reviewed: { $sum: { $cond: [{ $eq: ['$status', 'reviewed'] }, 1, 0] } },
            resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } }
          }
        }
      ]);

      const reasonStats = await Report.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: '$reason',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);

      return {
        overview: stats[0] || {
          total: 0,
          pending: 0,
          reviewed: 0,
          resolved: 0,
          rejected: 0
        },
        reasonBreakdown: reasonStats
      };
    } catch (error) {
      throw error;
    }
  }
}

export default new ReportRepository();
