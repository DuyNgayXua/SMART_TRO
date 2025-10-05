import amenityRepository from '../repositories/amenityRepository.js';

class AmenityController {
  // Get all amenities with filtering and pagination
  async getAmenities(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        sortBy = 'displayOrder',
        sortOrder = 1,
        category,
        isActive,
        search
      } = req.query;

      const owner = req.user?.userId || null;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder: parseInt(sortOrder),
        category,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        search,
        owner
      };

      const result = await amenityRepository.findAll({}, options);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get amenities error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách tiện ích',
        error: error.message
      });
    }
  }

  // Get all amenities without owner filtering - for public use
  async getAllAmenities(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        sortBy = 'displayOrder',
        sortOrder = 1,
        category,
        isActive,
        search
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder: parseInt(sortOrder),
        category,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        search,
       
      };

      const result = await amenityRepository.findAll({}, options);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get all amenities error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy tất cả danh sách tiện ích',
        error: error.message
      });
    }
  }

  // Get active amenities for dropdown/selection
  async getActiveAmenities(req, res) {
    try {
      const owner = req.user?.userId || null;
      const amenities = await amenityRepository.getActiveAmenities(owner);
      
      res.json({
        success: true,
        data: amenities
      });
    } catch (error) {
      console.error('Get active amenities error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách tiện ích hoạt động',
        error: error.message
      });
    }
  }

  // Get amenity by ID
  async getAmenityById(req, res) {
    try {
      const { id } = req.params;
      const amenity = await amenityRepository.findById(id);
      
      if (!amenity) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tiện ích'
        });
      }

      res.json({
        success: true,
        data: amenity
      });
    } catch (error) {
      console.error('Get amenity by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thông tin tiện ích',
        error: error.message
      });
    }
  }

  // Create new amenity
  async createAmenity(req, res) {
    try {
      const { name, icon, category, description, isActive, displayOrder } = req.body;
      const owner = req.user?.userId || null;

      // Validate required fields
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Tên là bắt buộc'
        });
      }

      const amenityData = {
        owner,
        name,
        icon: icon || 'fas fa-check',
        category: category || 'other',
        description,
        isActive: isActive !== undefined ? isActive : true,
        displayOrder: displayOrder || 0
      };

      const amenity = await amenityRepository.create(amenityData);
      
      res.status(201).json({
        success: true,
        data: amenity,
        message: 'Tạo tiện ích thành công'
      });
    } catch (error) {
      console.error('Create amenity error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tạo tiện ích',
        error: error.message
      });
    }
  }

  // Update amenity
  async updateAmenity(req, res) {
    try {
      const { id } = req.params;
      const { name, icon, category, description, isActive, displayOrder } = req.body;

      // Check if amenity exists
      const existingAmenity = await amenityRepository.findById(id);
      if (!existingAmenity) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tiện ích'
        });
      }

      // Check ownership - only owner can update their amenity, admin can update global amenities
      const currentUser = req.user?.userId;
      const isAdmin = req.user?.role === 'admin';
      
      if (!isAdmin) {
        // Non-admin users can only update their own amenities
        if (existingAmenity.owner && existingAmenity.owner.toString() !== currentUser) {
          return res.status(403).json({
            success: false,
            message: 'Bạn không có quyền sửa tiện ích này'
          });
        }
        // Can't update global amenities if not admin
        if (!existingAmenity.owner) {
          return res.status(403).json({
            success: false,
            message: 'Bạn không có quyền sửa tiện ích chung'
          });
        }
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (icon !== undefined) updateData.icon = icon;
      if (category !== undefined) updateData.category = category;
      if (description !== undefined) updateData.description = description;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (displayOrder !== undefined) updateData.displayOrder = displayOrder;

      const amenity = await amenityRepository.update(id, updateData);
      
      res.json({
        success: true,
        data: amenity,
        message: 'Cập nhật tiện ích thành công'
      });
    } catch (error) {
      console.error('Update amenity error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật tiện ích',
        error: error.message
      });
    }
  }

  // Delete amenity
  async deleteAmenity(req, res) {
    try {
      const { id } = req.params;

      const amenity = await amenityRepository.findById(id);
      if (!amenity) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tiện ích'
        });
      }

      // Check ownership - only owner can delete their amenity, admin can delete global amenities
      const currentUser = req.user?.userId;
      const isAdmin = req.user?.role === 'admin';
      
      if (!isAdmin) {
        // Non-admin users can only delete their own amenities
        if (amenity.owner && amenity.owner.toString() !== currentUser) {
          return res.status(403).json({
            success: false,
            message: 'Bạn không có quyền xóa tiện ích này'
          });
        }
        // Can't delete global amenities if not admin
        if (!amenity.owner) {
          return res.status(403).json({
            success: false,
            message: 'Bạn không có quyền xóa tiện ích chung'
          });
        }
      }

      await amenityRepository.delete(id);
      
      res.json({
        success: true,
        message: 'Xóa tiện ích thành công'
      });
    } catch (error) {
      console.error('Delete amenity error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xóa tiện ích',
        error: error.message
      });
    }
  }

  // Get amenity categories
  async getCategories(req, res) {
    try {
      const categories = await amenityRepository.getCategories();
      
      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách danh mục',
        error: error.message
      });
    }
  }

  // Update display order
  async updateDisplayOrder(req, res) {
    try {
      const { orderUpdates } = req.body;

      if (!Array.isArray(orderUpdates) || orderUpdates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu sắp xếp không hợp lệ'
        });
      }

      await amenityRepository.bulkUpdateOrder(orderUpdates);
      
      res.json({
        success: true,
        message: 'Cập nhật thứ tự hiển thị thành công'
      });
    } catch (error) {
      console.error('Update display order error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật thứ tự hiển thị',
        error: error.message
      });
    }
  }
}

export default new AmenityController();
