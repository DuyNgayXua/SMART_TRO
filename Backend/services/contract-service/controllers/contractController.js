import contractRepository from '../repositories/contractRepository.js';
import Room from '../../../schemas/Room.js';

class ContractController {
  async create(req, res) {
    try {
      const { 
        room, tenant, tenants, startDate, endDate, monthlyRent, deposit,
        electricPrice, waterPrice, servicePrice, vehicles, notes
      } = req.body;
      
      const landlord = req.body.landlord || req.user?.userId;
      
      // Handle both single tenant and multiple tenants
      let tenantsList = [];
      if (tenants && Array.isArray(tenants)) {
        tenantsList = tenants;
      } else if (tenant) {
        tenantsList = [tenant];
      }
      
      // Validation
      if (!room || tenantsList.length === 0 || !startDate || !endDate || !monthlyRent || !deposit) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required fields: room, tenants, startDate, endDate, monthlyRent, deposit' 
        });
      }

      // Verify room ownership
      if (landlord) {
        const roomDoc = await Room.findById(room).select('owner');
        if (!roomDoc) {
          return res.status(404).json({ success: false, message: 'Room not found' });
        }
        if (roomDoc.owner && roomDoc.owner.toString() !== landlord.toString() && req.user?.role !== 'admin') {
          return res.status(403).json({ success: false, message: 'Not owner of room' });
        }
      }

      // Prepare contract data
      const contractData = {
        room,
        tenants: tenantsList,
        tenant: tenantsList[0], // Primary tenant for backward compatibility
        landlord,
        startDate,
        endDate,
        monthlyRent,
        deposit,
        electricPrice: electricPrice || 3500,
        waterPrice: waterPrice || 25000,
        servicePrice: servicePrice || 150000,
        notes: notes || '',
        status: 'active'
      };

      // Add vehicles if provided
      if (vehicles && Array.isArray(vehicles) && vehicles.length > 0) {
        contractData.vehicles = vehicles.filter(v => v.licensePlate && v.licensePlate.trim());
      }

      const created = await contractRepository.create(contractData);
      return res.status(201).json({ success: true, data: created });
      
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  async list(req, res) {
    try {
      const { page=1, limit=12, status, search } = req.query;
      const landlord = req.query.landlord || req.user?.userId;
      const data = await contractRepository.list({ page:Number(page), limit:Number(limit), status, search, landlord });
      return res.json({ success:true, data });
    } catch (e) {
      return res.status(500).json({ success:false, message:e.message });
    }
  }

  async get(req, res) {
    try {
      const { id } = req.params;
      const contract = await contractRepository.findById(id);
      if (!contract) return res.status(404).json({ success:false, message:'Not found' });
      if (req.user?.role === 'landlord' && contract.landlord && contract.landlord._id.toString() !== req.user.userId) {
        return res.status(403).json({ success:false, message:'Forbidden' });
      }
      return res.json({ success:true, data: contract });
    } catch (e) {
      return res.status(500).json({ success:false, message:e.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const existing = await contractRepository.findById(id);
      if (!existing) return res.status(404).json({ success:false, message:'Not found' });
      if (req.user?.role === 'landlord' && existing.landlord && existing.landlord._id.toString() !== req.user.userId) {
        return res.status(403).json({ success:false, message:'Forbidden' });
      }
      const { landlord, ...rest } = req.body;
      const updated = await contractRepository.update(id, rest);
      return res.json({ success:true, data: updated });
    } catch (e) {
      return res.status(500).json({ success:false, message:e.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const existing = await contractRepository.findById(id);
      if (!existing) return res.status(404).json({ success:false, message:'Not found' });
      if (req.user?.role === 'landlord' && existing.landlord && existing.landlord._id.toString() !== req.user.userId) {
        return res.status(403).json({ success:false, message:'Forbidden' });
      }
      const deleted = await contractRepository.delete(id);
      return res.json({ success:true, data: deleted });
    } catch (e) {
      return res.status(500).json({ success:false, message:e.message });
    }
  }

  async terminate(req, res) {
    try {
      const { id } = req.params;
      const existing = await contractRepository.findById(id);
      if (!existing) return res.status(404).json({ success:false, message:'Not found' });
      if (existing.status === 'terminated') return res.json({ success:true, data: existing });
      if (req.user?.role === 'landlord' && existing.landlord && existing.landlord._id.toString() !== req.user.userId) {
        return res.status(403).json({ success:false, message:'Forbidden' });
      }
      const updated = await contractRepository.update(id, { status:'terminated', notes: req.body?.reason ? (existing.notes ? existing.notes + '\nTerminate: '+req.body.reason : 'Terminate: '+req.body.reason) : existing.notes });
      return res.json({ success:true, data: updated });
    } catch (e) {
      return res.status(500).json({ success:false, message:e.message });
    }
  }
}

export default new ContractController();
