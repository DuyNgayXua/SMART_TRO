import mongoose from 'mongoose';
import Tenant from '../../../schemas/Tenant.js';
import Room from '../../../schemas/Room.js';

class TenantRepository {
  async create(data) { 
    return Tenant.create(data); 
  }

  async findById(id) { 
    return Tenant.findById(id)
      .populate('room', 'name address roomNumber price')
      .populate('landlord', 'name email phone')
      .populate('contract', 'startDate endDate monthlyRent deposit status'); 
  }

  async findOne(query) {
    return Tenant.findOne(query)
      .populate('room', 'name address roomNumber price')
      .populate('landlord', 'name email phone')
      .populate('contract', 'startDate endDate monthlyRent deposit status');
  }

  async update(id, data) { 
    return Tenant.findByIdAndUpdate(id, data, { new: true })
      .populate('room', 'name address roomNumber price')
      .populate('landlord', 'name email phone')
      .populate('contract', 'startDate endDate monthlyRent deposit status'); 
  }

  async softDelete(id) { 
    return Tenant.findByIdAndUpdate(id, { isArchived: true }, { new: true }); 
  }

  async forceDelete(id) { 
    return Tenant.findByIdAndDelete(id); 
  }

  async list({ 
    page = 1, 
    limit = 10, 
    landlord, 
    room, 
    contract,
    status, 
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  }) {
    const query = { isArchived: false };
    
    // Filters
    if (landlord) query.landlord = landlord;
    if (room) query.room = room;
    if (contract) query.contract = contract;
    if (status) query.status = status;
    
    // Search functionality
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      query.$or = [
        { fullName: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
        { identificationNumber: searchRegex },
        { notes: searchRegex }
      ];
    }

    const skip = (page - 1) * limit;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [items, total] = await Promise.all([
      Tenant.find(query)
        .populate('room', 'name address roomNumber price')
        .populate('landlord', 'name email phone')
        .populate('contract', 'startDate endDate monthlyRent deposit status')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit),
      Tenant.countDocuments(query)
    ]);

    return { 
      items, 
      pagination: { 
        page: Number(page), 
        pages: Math.ceil(total / limit) || 1, 
        total,
        limit: Number(limit)
      } 
    };
  }

  async addPayment(id, payment) {
    return Tenant.findByIdAndUpdate(
      id, 
      { $push: { payments: payment } }, 
      { new: true }
    ).populate('room landlord contract');
  }

  async endLease(id, endDate = new Date()) {
    return Tenant.findByIdAndUpdate(
      id, 
      { 
        status: 'ended', 
        leaseEnd: endDate,
        moveOutDate: endDate
      }, 
      { new: true }
    ).populate('room landlord contract');
  }

  async activeCountByLandlord(landlord) {
    return Tenant.countDocuments({ 
      landlord, 
      status: 'active', 
      isArchived: false 
    });
  }

  async ensureRoomOwnership(roomId, landlordId) {
    const room = await Room.findById(roomId);
    return room && room.owner && room.owner.toString() === landlordId.toString();
  }

  // Tìm tenant đang hoạt động theo phòng
  async findActiveByRoom(roomId) {
    return Tenant.findOne({ 
      room: roomId, 
      status: 'active', 
      isArchived: false 
    })
    .populate('landlord', 'name email phone')
    .populate('contract', 'startDate endDate monthlyRent deposit status');
  }

  // Tìm tenant theo chủ trọ
  async findByLandlord(landlordId, filters = {}, sortBy = 'createdAt', sortOrder = 'desc') {
    const query = { 
      landlord: landlordId, 
      isArchived: false,
      ...filters 
    };

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    return Tenant.find(query)
      .populate('room', 'name address roomNumber price')
      .populate('contract', 'startDate endDate monthlyRent deposit status')
      .sort(sortOptions);
  }

  // Tìm tenant theo phòng
  async findByRoom(roomId, filters = {}, sortBy = 'createdAt', sortOrder = 'desc') {
    const query = { 
      room: roomId, 
      isArchived: false,
      ...filters 
    };

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    return Tenant.find(query)
      .populate('landlord', 'name email phone')
      .populate('contract', 'startDate endDate monthlyRent deposit status')
      .sort(sortOptions);
  }

  // Thống kê tenant theo chủ trọ
  async getStatsByLandlord(landlordId) {
    const stats = await Tenant.aggregate([
      {
        $match: {
          landlord: mongoose.Types.ObjectId(landlordId),
          isArchived: false
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRent: { $sum: '$rentPrice' },
          totalDeposit: { $sum: '$deposit' }
        }
      }
    ]);

    // Tính tổng thanh toán
    const totalPayments = await Tenant.aggregate([
      {
        $match: {
          landlord: mongoose.Types.ObjectId(landlordId),
          isArchived: false
        }
      },
      {
        $unwind: '$payments'
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$payments.amount' },
          totalPayments: { $sum: 1 }
        }
      }
    ]);

    return {
      statusStats: stats,
      paymentStats: totalPayments[0] || { totalAmount: 0, totalPayments: 0 }
    };
  }

  // Tìm tenant theo hợp đồng
  async findByContract(contractId) {
    return Tenant.findOne({ 
      contract: contractId, 
      isArchived: false 
    })
    .populate('room', 'name address roomNumber price')
    .populate('landlord', 'name email phone');
  }

  // Lấy lịch sử thanh toán của tenant
  async getPaymentHistory(tenantId) {
    const tenant = await Tenant.findById(tenantId).select('payments');
    return tenant ? tenant.payments.sort((a, b) => b.paidAt - a.paidAt) : [];
  }

  // Kiểm tra tenant có đang hoạt động không
  async isActiveTenant(tenantId) {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return false;
    
    const now = new Date();
    return tenant.status === 'active' && 
           tenant.leaseStart <= now && 
           (!tenant.leaseEnd || tenant.leaseEnd >= now) &&
           tenant.isActive && 
           !tenant.isArchived;
  }

  // Kiểm tra quyền sở hữu phòng
  async ensureRoomOwnership(roomId, landlordId) {
    const room = await Room.findById(roomId);
    return room && room.owner && room.owner.toString() === landlordId.toString();
  }
}

export default new TenantRepository();
