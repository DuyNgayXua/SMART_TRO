import Property from '../../../schemas/Property.js';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { fetchProvinces, fetchDistricts, fetchWards } from "../../shared/utils/locationService.js";

import { uploadToCloudinary, deleteFromCloudinary } from '../../shared/utils/cloudinary.js';
import { format } from 'path';


const myPropertiesController = {
  // Lấy danh sách tin đăng của user hiện tại
  getMyProperties: async (req, res) => {
    try {
      const userId = req.user.userId; // Từ middleware auth

      // Pagination params
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Filter params
      const status = req.query.status || 'all';
      const sortBy = req.query.sortBy || 'createdAt';
      const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
      const search = req.query.search || '';

      // Build query
      let query = { owner: userId };

      // Status filter - CẬP NHẬT để sử dụng status thay vì isForRent
      if (status !== 'all') {
        if (status === 'hidden') {
          query.status = 'inactive';
        } else if (status === 'available') {
          query.status = 'available';
        } else if (status === 'rented') {
          query.status = 'rented';
        } else if (status === 'maintenance') {
          query.status = 'maintenance';
        } else if (status === 'draft') {
          query.status = 'draft';
        } else {
          // Nếu filter theo approval status
          query.approvalStatus = status;
          query.status = { $ne: 'inactive' }; // Không bao gồm status inactive
        }
      }

      // Search filter
      if (search.trim()) {
        query.title = { $regex: search, $options: 'i' };
      }

      // Build sort object
      const sortObj = {};
      sortObj[sortBy] = sortOrder;

      // Lấy data
      const [properties, total, provinces] = await Promise.all([
        Property.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .populate('owner', 'name email phone')
          .populate('amenities', 'name icon')
          .lean(),
        Property.countDocuments(query),
        fetchProvinces(),

      ]);

      // Map tỉnh
      const provinceMap = new Map(provinces.map(p => [String(p.code), p.name]));

      // Lấy districts & wards phụ thuộc provinceCode, districtCode
      const districtMap = new Map();
      const wardMap = new Map();

      for (const property of properties) {
        if (property.province && !districtMap.has(property.district)) {
          const districts = await fetchDistricts(property.province);
          districts.forEach(d => districtMap.set(String(d.code), d.name));
        }
        if (property.district && !wardMap.has(property.ward)) {
          const wards = await fetchWards(property.district);
          wards.forEach(w => wardMap.set(String(w.code), w.name));
        }
      }


      // Transform data for frontend - CẬP NHẬT để sử dụng status
      const transformedProperties = properties.map(property => ({
        _id: property._id,
        title: property.title,
        category: property.category,
        rentPrice: property.rentPrice,
        promotionPrice: property.promotionPrice,
        area: property.area,
        images: property.images,
        approvalStatus: property.approvalStatus,
        status: property.status,
        isActive: property.status !== 'inactive',
        location: {
          provinceName: provinceMap.get(String(property.province)) || "",
          districtName: districtMap.get(String(property.district)) || "",
          wardName: wardMap.get(String(property.ward)) || "",
          detailAddress: property.detailAddress
        },
        views: property.stats?.views || 0,
        favorites: property.stats?.favorites || 0,
        createdAt: property.createdAt,
        updatedAt: property.updatedAt
      }));
      // console.log("Transformed properties:", transformedProperties);

      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        message: 'Lấy danh sách tin đăng thành công',
        data: {
          properties: transformedProperties,
          pagination: {
            page,
            limit,
            total,
            totalPages
          }
        }
      });

    } catch (error) {
      console.error('Error in getMyProperties:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy danh sách tin đăng',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Lấy thông tin tin đăng để edit
  getPropertyForEdit: async (req, res) => {
    try {
      const { propertyId } = req.params;
      const userId = req.user.userId;

      const property = await Property.findOne({
        _id: propertyId,
        owner: userId
      })
      .populate('amenities', 'name icon')
      .lean();
      console.log("Fetched property EDIT:", property);


      if (!property) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tin đăng hoặc bạn không có quyền chỉnh sửa'
        });
      }

      // Transform data for edit form - CẬP NHẬT để sử dụng status
      const editData = {
        _id: property._id,
        title: property.title,
        category: property.category,
        contactName: property.contactName,
        contactPhone: property.contactPhone,
        coordinates: property.coordinates,
        description: property.description,
        rentPrice: property.rentPrice,
        promotionPrice: property.promotionPrice,
        deposit: property.deposit,
        area: property.area,
        electricPrice: property.electricPrice,
        waterPrice: property.waterPrice,
        maxOccupants: property.maxOccupants,
        availableDate: property.availableDate,
        amenities: property.amenities,
        fullAmenities: property.fullAmenities,
        timeRules: property.timeRules,
        houseRules: property.houseRules,
        detailAddress: property.detailAddress,
        images: property.images,
        video: property.video,
        status: property.status, // Thay isForRent bằng status
        approvalStatus: property.approvalStatus,
        province: property.province || '',
        district: property.district || '',
        ward: property.ward || ''
      };

      res.json({
        success: true,
        message: 'Lấy thông tin tin đăng thành công',
        data: editData
      });

    } catch (error) {
      console.error('Error in getPropertyForEdit:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy thông tin tin đăng',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Lấy danh sách tin đăng đã được duyệt và chưa bị xóa của user hiện tại
  getMyApprovedProperties: async (req, res) => {
    try {

      // Pagination params
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Filter params
      const status = req.query.status || 'all';
      const sortBy = req.query.sortBy || 'createdAt';
      const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
      const search = req.query.search || '';

      // Build query với điều kiện approvalStatus = 'approved' và isDeleted = false
      let query = { 
        approvalStatus: 'approved',
        isDeleted: { $ne: true }
      };

      // Status filter - chỉ áp dụng cho các property đã được duyệt
      if (status !== 'all') {
        if (status === 'hidden') {
          query.status = 'inactive';
        } else if (status === 'available') {
          query.status = 'available';
        } else if (status === 'rented') {
          query.status = 'rented';
        } else if (status === 'maintenance') {
          query.status = 'maintenance';
        } else if (status === 'draft') {
          query.status = 'draft';
        }
      }

      // Search filter
      if (search.trim()) {
        query.title = { $regex: search, $options: 'i' };
      }

      // Build sort object
      const sortObj = {};
      sortObj[sortBy] = sortOrder;

      // Lấy data
      const [properties, total, provinces] = await Promise.all([
        Property.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .populate('owner', 'fullName email phone')
          .populate('amenities', 'name icon')
          .lean(),
        Property.countDocuments(query),
        fetchProvinces(),
      ]);

      // Map tỉnh
      const provinceMap = new Map(provinces.map(p => [String(p.code), p.name]));

      // Lấy districts & wards phụ thuộc provinceCode, districtCode
      const districtMap = new Map();
      const wardMap = new Map();

      for (const property of properties) {
        if (property.province && !districtMap.has(property.district)) {
          const districts = await fetchDistricts(property.province);
          districts.forEach(d => districtMap.set(String(d.code), d.name));
        }
        if (property.district && !wardMap.has(property.ward)) {
          const wards = await fetchWards(property.district);
          wards.forEach(w => wardMap.set(String(w.code), w.name));
        }
      }

      // Transform data for frontend
      const transformedProperties = properties.map(property => ({
        _id: property._id,
        title: property.title,
        category: property.category,
        rentPrice: property.rentPrice,
        promotionPrice: property.promotionPrice,
        area: property.area,
        images: property.images,
        approvalStatus: property.approvalStatus,
        status: property.status,
        isActive: property.status !== 'inactive',
        contactName: property.contactName,
        contactPhone: property.contactPhone,
        description: property.description,
        deposit: property.deposit,
        electricPrice: property.electricPrice,
        waterPrice: property.waterPrice,
        maxOccupants: property.maxOccupants,
        availableDate: property.availableDate,
        amenities: property.amenities,
        fullAmenities: property.fullAmenities,
        timeRules: property.timeRules,
        houseRules: property.houseRules,
        video: property.video,
        coordinates: property.coordinates,
        owner: {
          _id: property.owner._id,
          fullName: property.owner.fullName,
          email: property.owner.email,
          phone: property.owner.phone
        },
        location: {
          provinceName: provinceMap.get(String(property.province)) || "",
          districtName: districtMap.get(String(property.district)) || "",
          wardName: wardMap.get(String(property.ward)) || "",
          detailAddress: property.detailAddress
        },
        views: property.stats?.views || 0,
        favorites: property.stats?.favorites || 0,
        createdAt: property.createdAt,
        updatedAt: property.updatedAt
      }));
      console.log("Transformed approved properties:", transformedProperties);

      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        message: 'Lấy danh sách tin đăng đã duyệt thành công',
        data: {
          properties: transformedProperties,
          pagination: {
            page,
            limit,
            total,
            totalPages
          }
        }
      });

    } catch (error) {
      console.error('Error in getMyApprovedProperties:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy danh sách tin đăng đã duyệt',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Cập nhật tin đăng
  updateProperty: async (req, res) => {
    try {
      const { propertyId } = req.params;
      const userId = req.user.id || req.user.userId;
      console.log("req body: ", req.body);

      // 1. Tìm property
      const existingProperty = await Property.findOne({ _id: propertyId, owner: userId });
      if (!existingProperty) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tin đăng hoặc bạn không có quyền chỉnh sửa'
        });
      }
      console.log("Existing property:", existingProperty);

      // 2. Validation cơ bản
      const validationErrors = {};

      // Title
      if (!req.body.title || req.body.title.trim().length < 10) {
        validationErrors.title = 'Tiêu đề phải có ít nhất 10 ký tự';
      } else if (req.body.title.trim().length > 200) {
        validationErrors.title = 'Tiêu đề không được vượt quá 200 ký tự';
      }

      // Contact name - Sử dụng regex cải tiến
      if (!req.body.contactName || req.body.contactName.trim() === '') {
        validationErrors.contactName = 'Tên liên hệ không được để trống';
      } else if (req.body.contactName.trim().length < 2) {
        validationErrors.contactName = 'Tên liên hệ phải có ít nhất 2 ký tự';
      } else {
        // Sử dụng regex explicit thay vì Unicode property
        const nameRegex = /^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵýỷỹ\s]+$/;
        if (!nameRegex.test(req.body.contactName.trim())) {
          validationErrors.contactName = 'Tên liên hệ chỉ được chứa chữ cái và khoảng trắng';
        }
      }

      // Contact phone
      if (!req.body.contactPhone || !/^[0-9]{10}$/.test(req.body.contactPhone.trim())) {
        validationErrors.contactPhone = 'Số điện thoại phải có 10 chữ số';
      }

      // Description
      if (!req.body.description || req.body.description.trim().length < 20) {
        validationErrors.description = 'Mô tả phải có ít nhất 20 ký tự';
      }

      // Rent price
      if (req.body.rentPrice) {
        const rentPrice = Number(req.body.rentPrice);
        if (isNaN(rentPrice) || rentPrice < 500000) {
          validationErrors.rentPrice = 'Giá thuê phải ít nhất 500,000 VNĐ';
        } else if (rentPrice > 100000000) {
          validationErrors.rentPrice = 'Giá thuê không được vượt quá 100,000,000 VNĐ';
        }
      }

      // Promotion price
      if (req.body.promotionPrice) {
        const promotionPrice = Number(req.body.promotionPrice);
        const rentPrice = Number(req.body.rentPrice || existingProperty.rentPrice);
        if (promotionPrice >= rentPrice) {
          validationErrors.promotionPrice = 'Giá khuyến mãi phải nhỏ hơn giá thuê';
        }
      }

      // Deposit
      if (req.body.deposit) {
        const deposit = Number(req.body.deposit);
        const rentPrice = Number(req.body.rentPrice || existingProperty.rentPrice);
        if (deposit > rentPrice * 3) {
          validationErrors.deposit = 'Tiền cọc không được vượt quá 3 lần giá thuê';
        }
      }

      // Electric/Water price
      if (req.body.electricPrice && Number(req.body.electricPrice) > 10000) {
        validationErrors.electricPrice = 'Giá điện tối đa 10,000 VNĐ/kWh';
      }
      if (req.body.waterPrice && Number(req.body.waterPrice) > 50000) {
        validationErrors.waterPrice = 'Giá nước tối đa 50,000 VNĐ/m³';
      }

      // Detail address
      if (!req.body.detailAddress || req.body.detailAddress.trim().length < 5) {
        validationErrors.detailAddress = 'Địa chỉ chi tiết phải có ít nhất 5 ký tự';
      }

      let amenities = [];
      let houseRules = [];

      // Parse amenities
      if (req.body.amenities) {
        if (Array.isArray(req.body.amenities)) {
          amenities = req.body.amenities;
        } else if (typeof req.body.amenities === 'string') {
          try {
            const parsed = JSON.parse(req.body.amenities);
            amenities = Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            // Nếu không phải JSON, coi là 1 giá trị duy nhất
            amenities = [req.body.amenities];
          }
        }
      }

      // Parse houseRules
      if (req.body.houseRules) {
        if (Array.isArray(req.body.houseRules)) {
          houseRules = req.body.houseRules;
        } else if (typeof req.body.houseRules === 'string') {
          try {
            const parsed = JSON.parse(req.body.houseRules);
            houseRules = Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            // Nếu không phải JSON, coi là 1 giá trị duy nhất
            houseRules = [req.body.houseRules];
          }
        }
      }

      // Bắt lỗi ngay sau khi parse
      if (!amenities.length) validationErrors.amenities = 'Vui lòng chọn ít nhất 1 tiện ích';
      if (!houseRules.length) validationErrors.houseRules = 'Vui lòng chọn ít nhất 1 nội quy';
      if (!req.body.timeRules || req.body.timeRules.toString().trim() === '') {
        validationErrors.timeRules = 'Vui lòng nhập quy định giờ giấc';
      }

      let removedImages = [];
      try {
        removedImages = req.body.removedImages
          ? typeof req.body.removedImages === 'string'
            ? JSON.parse(req.body.removedImages)
            : req.body.removedImages
          : [];
      } catch (err) {
        removedImages = [];
      }

      // Coordinates
      let coords = existingProperty.coordinates;
      if (req.body.coordinates) {
        try {
          const parsed = typeof req.body.coordinates === 'string'
            ? JSON.parse(req.body.coordinates)
            : req.body.coordinates;
          if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
            coords = { lat: parsed.lat, lng: parsed.lng };
          } else {
            validationErrors.coordinates = 'Toạ độ không hợp lệ';
          }
        } catch (err) {
          validationErrors.coordinates = 'Toạ độ không hợp lệ';
        }
      }

      // Images & video validation
      let images = existingProperty.images || [];
      let video = existingProperty.video || null; 

      // Xử lý upload ảnh mới từ req.files.images
      if (req.files?.images && req.files.images.length > 0) {
        const uploadedImages = await Promise.all(
          req.files.images.map(file => uploadToCloudinary(file.buffer, 'properties/images'))
        );
    
        // uploadedImages là mảng, lấy tất cả secure_url
        const newImageUrls = uploadedImages.map(img => img.secure_url);
        images = [...images, ...newImageUrls]; // giữ ảnh cũ + ảnh mới
     
      }

      // Xử lý removedImages
      if (req.body.removedImages) {
        let removed = [];
        try {
          removed = typeof req.body.removedImages === 'string'
            ? JSON.parse(req.body.removedImages)
            : req.body.removedImages;
        } catch (err) {
          removed = [];
        }
        images = images.filter(img => !removed.includes(img));
      }

      if (!images || images.length === 0) {
        validationErrors.images = 'Vui lòng tải lên ít nhất 1 hình ảnh';
      }

      // Video processing - Sửa lại logic xử lý video
      // Nếu user xoá video (frontend gửi removeVideo=true)
      if (req.body.removeVideo === "true") {
        video = null; // Set thành null thay vì empty string
      } else if (req.files?.video && req.files.video.length > 0) {
        // Nếu user upload video mới
        try {
          const uploadedVideo = await uploadToCloudinary(
            req.files.video[0].buffer,
            'properties/videos'
          );
          video = uploadedVideo.secure_url;
        } catch (uploadError) {
          console.error('Video upload error:', uploadError);
          validationErrors.video = 'Lỗi khi tải video lên';
        }
      }
      // Nếu không có hành động nào với video, giữ nguyên video hiện tại


      if (Object.keys(validationErrors).length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Thông tin không hợp lệ',
          errors: validationErrors
        });
      }

      // 3. Chuẩn bị update data
      const updateData = {
        title: req.body.title,
        contactName: req.body.contactName,
        contactPhone: req.body.contactPhone,
        description: req.body.description,
        rentPrice: Number(req.body.rentPrice),
        promotionPrice: req.body.promotionPrice ? Number(req.body.promotionPrice) : 0,
        deposit: req.body.deposit ? Number(req.body.deposit) : 0,
        area: req.body.area ? Number(req.body.area) : 0,
        electricPrice: req.body.electricPrice ? Number(req.body.electricPrice) : 0,
        waterPrice: req.body.waterPrice ? Number(req.body.waterPrice) : 0,
        maxOccupants: req.body.maxOccupants || existingProperty.maxOccupants,
        timeRules: req.body.timeRules,
        amenities,
        houseRules,
        fullAmenities: req.body.fullAmenities === 'true',
        category: req.body.category ? JSON.parse(req.body.category) : existingProperty.category,
        province: req.body.province || existingProperty.province,
        district: req.body.district || existingProperty.district,
        ward: req.body.ward || existingProperty.ward,
        detailAddress: req.body.detailAddress,
        coordinates: coords,
        images,
        video,
        updatedAt: new Date(),
      };

      if (req.body.availableDate) {
        const [day, month, year] = req.body.availableDate.split('-').map(Number);
        updateData.availableDate = new Date(year, month - 1, day);
      }

      if (req.user.role !== 'admin') {
        updateData.approvalStatus = 'pending';
      }

      // 4. Update DB
      const updatedProperty = await Property.findByIdAndUpdate(
        propertyId,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      return res.json({
        success: true,
        message: 'Cập nhật tin đăng thành công. Tin đăng sẽ được admin duyệt lại.',
        data: updatedProperty
      });

    } catch (error) {
      console.error('Error in updateProperty:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi server khi cập nhật tin đăng',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },



  // Xóa tin đăng
  deleteProperty: async (req, res) => {
    try {
      const { propertyId } = req.params;
      const userId = req.user.userId;

      const property = await Property.findOne({
        _id: propertyId,
        owner: userId
      });

      if (!property) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tin đăng hoặc bạn không có quyền xóa'
        });
      }

      // Soft delete - chỉ đánh dấu là đã xóa
      await Property.findByIdAndUpdate(propertyId, {
        isDeleted: true,
        deletedAt: new Date()
      });

      res.json({
        success: true,
        message: 'Xóa tin đăng thành công'
      });

    } catch (error) {
      console.error('Error in deleteProperty:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi xóa tin đăng',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Thay đổi trạng thái ẩn/hiện tin đăng - CẬP NHẬT để sử dụng status
  togglePropertyStatus: async (req, res) => {
    try {
      const { propertyId } = req.params;
      console.log('Toggling property status:', propertyId);
      const userId = req.user.userId;

      const property = await Property.findOne({
        _id: propertyId,
        owner: userId
      });

      if (!property) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tin đăng hoặc bạn không có quyền thay đổi'
        });
      }

      // Toggle status giữa available và inactive
      const newStatus = property.status === 'inactive' ? 'available' : 'inactive';

      const updatedProperty = await Property.findByIdAndUpdate(
        propertyId,
        {
          $set: {
            status: newStatus,
            updatedAt: new Date()
          }
        },
        { new: true }
      );

      res.json({
        success: true,
        message: `Đã ${newStatus === 'available' ? 'hiện' : 'ẩn'} tin đăng`,
        data: {
          status: updatedProperty.status,
          isActive: updatedProperty.status !== 'inactive' // Tương thích với frontend
        }
      });

    } catch (error) {
      console.error('Error in togglePropertyStatus:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi thay đổi trạng thái tin đăng',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Thống kê tin đăng của user - CẬP NHẬT để sử dụng status
  getMyPropertiesStats: async (req, res) => {
    try {
      const userId = req.user.userId;

      const stats = await Property.aggregate([
        { $match: { owner: userId, isDeleted: { $ne: true } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: {
              $sum: {
                $cond: [{ $eq: ['$approvalStatus', 'pending'] }, 1, 0]
              }
            },
            approved: {
              $sum: {
                $cond: [{ $eq: ['$approvalStatus', 'approved'] }, 1, 0]
              }
            },
            rejected: {
              $sum: {
                $cond: [{ $eq: ['$approvalStatus', 'rejected'] }, 1, 0]
              }
            },
            // CẬP NHẬT: Đếm theo status thay vì isForRent
            hidden: {
              $sum: {
                $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0]
              }
            },
            available: {
              $sum: {
                $cond: [{ $eq: ['$status', 'available'] }, 1, 0]
              }
            },
            rented: {
              $sum: {
                $cond: [{ $eq: ['$status', 'rented'] }, 1, 0]
              }
            },
            maintenance: {
              $sum: {
                $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0]
              }
            },
            draft: {
              $sum: {
                $cond: [{ $eq: ['$status', 'draft'] }, 1, 0]
              }
            },
            totalViews: { $sum: '$stats.views' },
            totalFavorites: { $sum: '$stats.favorites' }
          }
        }
      ]);

      const result = stats[0] || {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        hidden: 0,
        available: 0,
        rented: 0,
        maintenance: 0,
        draft: 0,
        totalViews: 0,
        totalFavorites: 0
      };

      res.json({
        success: true,
        message: 'Lấy thống kê thành công',
        data: result
      });

    } catch (error) {
      console.error('Error in getMyPropertiesStats:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy thống kê',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};

export default myPropertiesController;