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

      // Kiểm tra phòng có đang được thuê không
      const existingActiveTenant = await tenantRepository.findActiveByRoom(room);
      if (existingActiveTenant) {
        return res.status(409).json({
          success: false,
          message: 'Room is already rented to another tenant'
        });
      }

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
        status: 'pending' // Bắt đầu với trạng thái pending
      };

      const tenant = await tenantRepository.create(tenantData);

      // Cập nhật trạng thái phòng nếu tenant active
      if (tenant.status === 'active') {
        await Room.findByIdAndUpdate(room, { 
          status: 'rented', 
          tenant: tenant._id, 
          leaseStart, 
          leaseEnd 
        });
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
      const { status: newStatus, ...updateData } = req.body;
      
      // Nếu cập nhật status, cần xử lý logic đặc biệt
      if (newStatus) {
        const tenant = await tenantRepository.findById(req.params.id);
        if (!tenant) {
          return res.status(404).json({ success: false, message: 'Tenant not found' });
        }

        // Xử lý thay đổi trạng thái
        if (newStatus === 'active' && tenant.status !== 'active') {
          // Kích hoạt tenant - cập nhật phòng
          await Room.findByIdAndUpdate(tenant.room, { 
            status: 'rented', 
            tenant: tenant._id 
          });
        } else if (newStatus === 'ended' && tenant.status === 'active') {
          // Kết thúc thuê - giải phóng phòng
          await Room.findByIdAndUpdate(tenant.room, { 
            status: 'available', 
            tenant: null 
          });
          updateData.moveOutDate = new Date();
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
      
      const tenant = await tenantRepository.endLease(req.params.id, endDate); 
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant not found' });
      }

      // Cập nhật trạng thái phòng
      await Room.findByIdAndUpdate(tenant.room, { 
        status: 'available', 
        tenant: null 
      });

      res.json({ success: true, data: tenant }); 
    } catch (e) { 
      console.error('End lease error:', e);
      res.status(500).json({ success: false, message: e.message }); 
    }
  }

  async archive(req, res) {
    try { 
      const tenant = await tenantRepository.softDelete(req.params.id); 
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant not found' });
      }
      res.json({ success: true, data: tenant }); 
    } catch (e) { 
      console.error('Archive tenant error:', e);
      res.status(500).json({ success: false, message: e.message }); 
    }
  }

  async forceDelete(req, res) {
    try { 
      const tenant = await tenantRepository.forceDelete(req.params.id); 
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant not found' });
      }
      res.json({ success: true, data: tenant }); 
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
      const { status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
      
      const filters = {};
      if (status) filters.status = status;
      
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
