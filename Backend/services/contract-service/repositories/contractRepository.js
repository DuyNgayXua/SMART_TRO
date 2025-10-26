import Contract from '../../../schemas/Contract.js';
import Room from '../../../schemas/Room.js';
import Tenant from '../../../schemas/Tenant.js';

class ContractRepository {
  async create(data) {
    return Contract.create(data);
  }

  async findById(id) {
    return Contract.findById(id)
      .populate('room', 'roomNumber status size amenities')
      .populate('tenants', 'fullName phone email identificationNumber address')
      .populate('landlord', 'fullName email phone identificationNumber address')
      .populate('vehicles.owner', 'fullName');
  }

  async update(id, data) {
    return Contract.findByIdAndUpdate(id, data, { new: true })
      .populate('room', 'roomNumber status size amenities')
      .populate('tenants', 'fullName phone email identificationNumber address')
      .populate('landlord', 'fullName email phone identificationNumber address')
      .populate('vehicles.owner', 'fullName');
  }

  async delete(id) {
    return Contract.findByIdAndDelete(id);
  }

  async list({ page=1, limit=12, status, search, landlord }) {
    const query = {};
    if (status) query.status = status;
    if (landlord) query.landlord = landlord;
    const skip = (page-1) * limit;
    const [items, total] = await Promise.all([
      Contract.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('room', 'roomNumber status')
        .populate('tenants', 'fullName phone email')
        .populate('landlord', 'fullName'),
      Contract.countDocuments(query)
    ]);
    let filtered = items;
    if (search) {
      const rx = new RegExp(search, 'i');
      filtered = items.filter(c => 
        rx.test(c.notes||'') || 
        rx.test(c.room?.roomNumber||'') || 
        (c.tenants && c.tenants.some(tenant => rx.test(tenant?.fullName||'')))
      );
    }
    return {
      items: filtered,
      pagination: {
        page: Number(page),
        pages: Math.ceil(total/limit) || 1,
        total
      }
    };
  }

  async findByRoom(roomId) {
    return Contract.find({ room: roomId })
      .populate('room')
      .populate('tenants', 'fullName phone email identificationNumber images vehicles') // Only populate tenants array
      .populate('landlord', 'fullName email')
      .sort({ createdAt: -1 });
  }
}

export default new ContractRepository();
