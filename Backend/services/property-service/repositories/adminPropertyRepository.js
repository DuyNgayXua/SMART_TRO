import Property from '../../../schemas/Property.js';

class AdminPropertyRepository {
  // Lấy danh sách properties với filter và pagination
  async getPropertiesWithFilter(filter, options) {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = -1 } = options;
    const skip = (page - 1) * limit;

    const properties = await Property.find(filter)
      .populate('owner', 'fullName email avatar phone')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit);

    const totalProperties = await Property.countDocuments(filter);
    const totalPages = Math.ceil(totalProperties / limit);

    return {
      properties,
      pagination: {
        currentPage: page,
        totalPages,
        totalProperties,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  // Lấy property theo ID
  async getPropertyById(propertyId) {
    return await Property.findById(propertyId)
      .populate('owner', 'fullName email avatar phone');
  }

  // Duyệt property
  async approveProperty(propertyId, adminId) {
    const updatedProperty = await Property.findByIdAndUpdate(
      propertyId,
      {
        approvalStatus: 'approved',
        approvedAt: new Date(),
        approvedBy: adminId,
        createdAt: new Date(), // Reset createdAt như yêu cầu
        rejectionReason: undefined // Xóa lý do từ chối cũ nếu có
      },
      { new: true }
    ).populate('owner', 'name email avatar');

    return updatedProperty;
  }

  // Từ chối property
  async rejectProperty(propertyId, adminId, reason) {
    const updatedProperty = await Property.findByIdAndUpdate(
      propertyId,
      {
        approvalStatus: 'rejected',
        rejectionReason: reason,
        rejectedAt: new Date(),
        rejectedBy: adminId
      },
      { new: true }
    ).populate('owner', 'fullName email avatar phone');

    return updatedProperty;
  }

  // Thống kê properties
  async getPropertyStats() {
    const stats = await Property.aggregate([
      {
        $group: {
          _id: '$approvalStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    // Format stats
    const formattedStats = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0
    };

    stats.forEach(stat => {
      if (stat._id && formattedStats.hasOwnProperty(stat._id)) {
        formattedStats[stat._id] = stat.count;
        formattedStats.total += stat.count;
      }
    });

    return formattedStats;
  }

  // Lấy properties theo status
  async getPropertiesByStatus(status) {
    return await Property.find({ approvalStatus: status })
      .populate('owner', 'fullName email avatar phone')
      .sort({ createdAt: -1 });
  }
}

export default new AdminPropertyRepository();