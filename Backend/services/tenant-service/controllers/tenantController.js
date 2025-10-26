import tenantRepository from '../repositories/tenantRepository.js';
import Room from '../../../schemas/Room.js';
import Contract from '../../../schemas/Contract.js';
import { v2 as cloudinary } from 'cloudinary';

class TenantController {
  async create(req, res) {
    try {
      const { 
        fullName, email, phone, address, identificationNumber, dateOfBirth,
        emergencyContact, room, contract, leaseStart, leaseEnd, 
        rentPrice, deposit, notes, moveInDate, vehicles
      } = req.body;
      
      const landlord = req.body.landlord || req.user?.userId || req.body.owner;
      
      // Validation
      if (!fullName || !phone || !room || !leaseStart || !rentPrice) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required fields: fullName, phone, room, leaseStart, rentPrice' 
        });
      }

      // Check identification number duplicate 
      if (identificationNumber) {
        const isDuplicate = await tenantRepository.checkIdentificationNumberExists(identificationNumber);
        if (isDuplicate) {
          return res.status(409).json({
            success: false,
            message: 'Số CMND/CCCD đã được sử dụng bởi khách thuê khác'
          });
        }
      }

      // Kiểm tra quyền sở hữu phòng
      if (landlord) {
        const roomOwnership = await tenantRepository.ensureRoomOwnership(room, landlord);
        if (!roomOwnership) {
          return res.status(403).json({ 
            success: false, 
            message: 'Room not owned by landlord' 
          });
        }
      }

      // Removed: Check phòng có đang được thuê không - Now support multiple tenants
      // Multiple tenants can rent the same room

      // Kiểm tra duplicate tenant logic trong application
      const existingTenant = await tenantRepository.findOne({
        landlord: landlord,
        room: room,
        fullName: { $regex: new RegExp(`^${fullName}$`, 'i') }, // Case insensitive
        phone: phone,
        isArchived: false,
        $or: [
          { status: 'active' },
          { status: 'pending' }
        ]
      });

      if (existingTenant) {
        return res.status(400).json({
          success: false,
          message: 'Tenant đã tồn tại trong phòng này với thông tin tương tự',
          error: 'DUPLICATE_TENANT',
          existingTenant: {
            id: existingTenant._id,
            fullName: existingTenant.fullName,
            phone: existingTenant.phone,
            status: existingTenant.status
          }
        });
      }

      // Tạo tenant mới
      const tenantData = {
        fullName, email, phone, address, identificationNumber, dateOfBirth,
        emergencyContact, landlord, room, contract, leaseStart, leaseEnd,
        rentPrice, deposit, notes, moveInDate,
        vehicles: vehicles || [], // Thêm vehicles
        status: 'active' // Mặc định active khi tạo hợp đồng mới
      };

      const tenant = await tenantRepository.create(tenantData);

      // Cập nhật trạng thái phòng (tenant luôn active khi tạo mới)
      // Get current room to preserve existing tenants
      const currentRoom = await Room.findById(room);
      const currentTenants = currentRoom.tenants || [];
      
      // Add new tenant to tenants array if not already exists
      if (!currentTenants.includes(tenant._id)) {
        currentTenants.push(tenant._id);
      }
      
      await Room.findByIdAndUpdate(room, { 
        status: 'rented', 
        tenants: currentTenants, // New array field
        leaseStart, 
        leaseEnd 
      });

      // Tìm hợp đồng đang active của phòng này
      const activeContract = await Contract.findOne({
        room: room,
        status: { $in: ['active', 'pending'] }
      }).sort({ createdAt: -1 }); // Lấy hợp đồng mới nhất

      if (activeContract) {
        // Thêm tenant vào hợp đồng hiện tại
        const contractTenants = activeContract.tenants || [];
        if (!contractTenants.includes(tenant._id)) {
          contractTenants.push(tenant._id);
          await Contract.findByIdAndUpdate(activeContract._id, {
            tenants: contractTenants
          });
          console.log(`Added tenant ${tenant._id} to contract ${activeContract._id}`);
        }

        // Update tenant's contract reference
        tenant.contract = activeContract._id;
        await tenant.save();
      }

      res.status(201).json({ success: true, data: tenant });
    } catch (e) {
      if (e.code === 11000) {
        return res.status(409).json({ 
          success: false, 
          message: 'Duplicate tenant data detected' 
        });
      }
      res.status(500).json({ success: false, message: e.message });
    }
  }

  async list(req, res) {
    try {
      const { 
        page = 1, limit = 10, status, room, contract, search, 
        sortBy = 'createdAt', sortOrder = 'desc' 
      } = req.query;
      
      const landlord = req.query.landlord || req.user?.userId;
      
      const data = await tenantRepository.list({ 
        page: Number(page), 
        limit: Number(limit), 
        landlord, 
        room, 
        contract,
        status, 
        search,
        sortBy,
        sortOrder
      });
      
      res.json({ success: true, data });
    } catch (e) { 
      console.error('List tenants error:', e);
      res.status(500).json({ success: false, message: e.message }); 
    }
  }

  async get(req, res) {
    try { 
      const tenant = await tenantRepository.findById(req.params.id); 
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant not found' });
      }
      res.json({ success: true, data: tenant }); 
    } catch (e) { 
      console.error('Get tenant error:', e);
      res.status(500).json({ success: false, message: e.message }); 
    }
  }

  async update(req, res) {
    try { 
      const { status: newStatus, identificationNumber, ...updateData } = req.body;
      
      // Check identification number duplicate when updating
      if (identificationNumber) {
        const isDuplicate = await tenantRepository.checkIdentificationNumberExists(identificationNumber, req.params.id);
        if (isDuplicate) {
          return res.status(409).json({
            success: false,
            message: 'Số CMND/CCCD đã được sử dụng bởi khách thuê khác'
          });
        }
        updateData.identificationNumber = identificationNumber;
      }
      
      // Nếu cập nhật status, cần xử lý logic đặc biệt
      if (newStatus) {
        const tenant = await tenantRepository.findById(req.params.id);
        if (!tenant) {
          return res.status(404).json({ success: false, message: 'Tenant not found' });
        }

        // Xử lý thay đổi trạng thái
        if (newStatus === 'active' && tenant.status !== 'active') {
          // Kích hoạt tenant - cập nhật phòng
          const currentRoom = await Room.findById(tenant.room);
          const currentTenants = currentRoom.tenants || [];
          
          if (!currentTenants.includes(tenant._id)) {
            currentTenants.push(tenant._id);
          }
          
          await Room.findByIdAndUpdate(tenant.room, { 
            status: 'rented', 
            tenants: currentTenants // New array field
          });
        } else if (newStatus === 'ended' && tenant.status === 'active') {
          // Kết thúc thuê - xóa tenant khỏi phòng và database hoàn toàn
          const currentRoom = await Room.findById(tenant.room);
          const currentTenants = (currentRoom.tenants || []).filter(id => !id.equals(tenant._id));
          
          await Room.findByIdAndUpdate(tenant.room, { 
            status: currentTenants.length > 0 ? 'rented' : 'available', // Nếu còn tenant khác thì vẫn rented
            tenants: currentTenants // Updated array
          });
          
          // Xóa hoàn toàn tenant thay vì chỉ update status
          await tenantRepository.forceDelete(req.params.id);
          return res.json({ success: true, data: { message: 'Tenant deleted successfully', tenant } });
        }
        
        updateData.status = newStatus;
      }

      const updatedTenant = await tenantRepository.update(req.params.id, updateData); 
      if (!updatedTenant) {
        return res.status(404).json({ success: false, message: 'Tenant not found' });
      }
      
      res.json({ success: true, data: updatedTenant }); 
    } catch (e) { 
      console.error('Update tenant error:', e);
      res.status(500).json({ success: false, message: e.message }); 
    }
  }

  async addPayment(req, res) {
    try { 
      const { amount, method = 'cash', type = 'rent', note, receiptNumber } = req.body; 
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Valid amount is required' 
        });
      }

      const paymentData = { amount, method, type, note, receiptNumber };
      const tenant = await tenantRepository.addPayment(req.params.id, paymentData); 
      
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant not found' });
      }
      
      res.json({ success: true, data: tenant }); 
    } catch (e) { 
      console.error('Add payment error:', e);
      res.status(500).json({ success: false, message: e.message }); 
    }
  }

  async endLease(req, res) {
    try { 
      const { endDate = new Date() } = req.body;
      
      // Lấy thông tin tenant trước khi xóa
      const tenant = await tenantRepository.findById(req.params.id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant not found' });
      }

      // Xóa tenant khỏi mảng tenants của phòng
      const currentRoom = await Room.findById(tenant.room);
      const currentTenants = (currentRoom.tenants || []).filter(id => !id.equals(tenant._id));
      
      await Room.findByIdAndUpdate(tenant.room, { 
        status: currentTenants.length > 0 ? 'rented' : 'available', // Nếu còn tenant khác thì vẫn rented
        tenants: currentTenants // Updated array
      });

      // Xóa hoàn toàn tenant khỏi database
      await tenantRepository.forceDelete(req.params.id);

      res.json({ success: true, data: { message: 'Tenant deleted successfully', tenant } }); 
    } catch (e) { 
      console.error('End lease error:', e);
      res.status(500).json({ success: false, message: e.message }); 
    }
  }

  async archive(req, res) {
    try { 
      const tenant = await tenantRepository.findById(req.params.id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant not found' });
      }

      // Remove tenant from room's tenants array
      if (tenant.room) {
        const room = await Room.findById(tenant.room);
        if (room && room.tenants) {
          room.tenants = room.tenants.filter(t => t.toString() !== tenant._id.toString());
          await room.save();
        }
      }

      // Remove tenant from contract's tenants array
      if (tenant.contract) {
        const contract = await Contract.findById(tenant.contract);
        if (contract && contract.tenants) {
          contract.tenants = contract.tenants.filter(t => t.toString() !== tenant._id.toString());
          await contract.save();
        }
      }

      // Now archive the tenant
      const archivedTenant = await tenantRepository.softDelete(req.params.id);
      res.json({ success: true, data: archivedTenant }); 
    } catch (e) { 
      console.error('Archive tenant error:', e);
      res.status(500).json({ success: false, message: e.message }); 
    }
  }

  async forceDelete(req, res) {
    try { 
      const tenant = await tenantRepository.findById(req.params.id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant not found' });
      }

      // Remove tenant from room's tenants array
      if (tenant.room) {
        const room = await Room.findById(tenant.room);
        if (room && room.tenants) {
          room.tenants = room.tenants.filter(t => t.toString() !== tenant._id.toString());
          await room.save();
        }
      }

      // Remove tenant from contract's tenants array
      if (tenant.contract) {
        const contract = await Contract.findById(tenant.contract);
        if (contract && contract.tenants) {
          contract.tenants = contract.tenants.filter(t => t.toString() !== tenant._id.toString());
          await contract.save();
        }
      }

      // Now force delete the tenant
      const deletedTenant = await tenantRepository.forceDelete(req.params.id);
      res.json({ success: true, data: deletedTenant }); 
    } catch (e) { 
      console.error('Force delete tenant error:', e);
      res.status(500).json({ success: false, message: e.message }); 
    }
  }

  // Lấy danh sách tenant theo chủ trọ
  async getByLandlord(req, res) {
    try {
      const { landlordId } = req.params;
      const { status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
      
      const filters = {};
      if (status) filters.status = status;
      
      const tenants = await tenantRepository.findByLandlord(landlordId, filters, sortBy, sortOrder);
      res.json({ success: true, data: tenants });
    } catch (e) {
      console.error('Get tenants by landlord error:', e);
      res.status(500).json({ success: false, message: e.message });
    }
  }

  // Lấy danh sách tenant theo phòng
  async getByRoom(req, res) {
    try {
      const { roomId } = req.params;
      const { status = 'active', sortBy = 'status', sortOrder = 'asc' } = req.query;
      
      const filters = {};
      // Mặc định chỉ lấy tenant đang thuê (active)
      filters.status = status;
      
      const tenants = await tenantRepository.findByRoom(roomId, filters, sortBy, sortOrder);
      
      res.json({ success: true, data: tenants });
    } catch (e) {
      console.error('Get tenants by room error:', e);
      res.status(500).json({ success: false, message: e.message });
    }
  }

  // Lấy tenant hiện tại của phòng
  async getCurrentByRoom(req, res) {
    try {
      const { roomId } = req.params;
      const tenant = await tenantRepository.findActiveByRoom(roomId);
      
      if (!tenant) {
        return res.status(404).json({ 
          success: false, 
          message: 'No active tenant found for this room' 
        });
      }
      
      res.json({ success: true, data: tenant });
    } catch (e) {
      console.error('Get current tenant by room error:', e);
      res.status(500).json({ success: false, message: e.message });
    }
  }

  // Thống kê tenant theo chủ trọ
  async getStatsByLandlord(req, res) {
    try {
      const { landlordId } = req.params;
      const stats = await tenantRepository.getStatsByLandlord(landlordId);
      res.json({ success: true, data: stats });
    } catch (e) {
      console.error('Get tenant stats error:', e);
      res.status(500).json({ success: false, message: e.message });
    }
  }

  // Upload images for tenant (similar to room upload)
  async uploadImages(req, res) {
    try {
      const { id } = req.params; // tenant id
      const tenant = await tenantRepository.findById(id);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant not found' });
      }

      // Check permissions - landlord can only upload for their tenants
      if (req.user?.role === 'landlord' && req.user.userId && 
          tenant.landlord && tenant.landlord._id.toString() !== req.user.userId) {
        return res.status(403).json({ success: false, message: 'No permission to upload images for this tenant' });
      }

      if (!req.files || !req.files.length) {
        return res.status(400).json({ success: false, message: 'No files provided' });
      }

      const currentImages = tenant.images || [];
      const remaining = 5 - currentImages.length;
      if (remaining <= 0) {
        return res.status(400).json({ success: false, message: 'Maximum 5 images allowed' });
      }

      const filesToUpload = req.files.slice(0, remaining);
      const uploadedUrls = [];

      // Upload each file to Cloudinary
      for (const file of filesToUpload) {
        const buf = file.buffer;
        const url = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'tenant_images' }, 
            (error, result) => {
              if (error) return reject(error);
              resolve(result.secure_url);
            }
          );
          stream.end(buf);
        });
        uploadedUrls.push(url);
      }

      // Update tenant with new image URLs
      const updatedImagesList = [...currentImages, ...uploadedUrls];
      await tenantRepository.update(id, { images: updatedImagesList });

      res.json({ 
        success: true, 
        message: 'Images uploaded successfully', 
        data: { images: updatedImagesList } 
      });

    } catch (error) {
      console.error('Error uploading tenant images:', error);
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }
}

export default new TenantController();
