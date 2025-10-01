import Property from '../../../schemas/Property.js';
import Comment from '../../../schemas/Comment.js';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { fetchProvinces, fetchDistricts, fetchWards } from "../../shared/utils/locationService.js";
import propertyRepository from '../repositories/propertyRepository.js';
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

      // Filter params .
      const approvalStatus = req.query.approvalStatus || 'all';
      const sortBy = req.query.sortBy || 'createdAt';
      const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
      const search = req.query.search || '';

      // Build query
      let query = { owner: userId };

      // ApprovalStatus filter
      if (approvalStatus !== 'all') {
        if (approvalStatus === 'hidden') {
          // Hiển thị các tin đã duyệt nhưng đang bị ẩn
          query.approvalStatus = 'approved';
          query.status = 'inactive';
        } else {
          // Filter theo trạng thái duyệt
          query.approvalStatus = approvalStatus;
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
          .populate('owner', 'name email phone avatar')
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


      // Lấy số lượng comments cho mỗi property (chỉ đếm comments gốc, không đếm replies)
      const propertyIds = properties.map(p => p._id);
      const commentsCount = await Comment.aggregate([
        {
          $match: {
            property: { $in: propertyIds },
            parentComment: null, // Chỉ đếm comments gốc
            isDeleted: false
          }
        },
        {
          $group: {
            _id: '$property',
            count: { $sum: 1 }
          }
        }
      ]);

      // Tạo map để tra cứu comments count
      const commentsCountMap = new Map();
      commentsCount.forEach(item => {
        commentsCountMap.set(item._id.toString(), item.count);
      });

      // Transform data for frontend - CẬP NHẬT để sử dụng status
      const transformedProperties = properties.map(property => ({
        _id: property._id,
        title: property.title,
        category: property.category,
        rentPrice: property.rentPrice,
        promotionPrice: property.promotionPrice,
        area: property.area,
        images: property.images,
        description: property.description,
        approvalStatus: property.approvalStatus,
        status: property.status,
        rejectionReason: property.rejectionReason, // Thêm lý do từ chối
        location: {
          provinceName: provinceMap.get(String(property.province)) || "",
          districtName: districtMap.get(String(property.district)) || "",
          wardName: wardMap.get(String(property.ward)) || "",
          detailAddress: property.detailAddress
        },
        views: property.views || 0,
        favorites: property.stats?.favorites || 0,
        comments: commentsCountMap.get(property._id.toString()) || 0,
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
        status: { $ne: 'inactive' }, // Mặc định không lấy tin đăng bị ẩn
        isDeleted: { $ne: true }
      };

      // Status filter - chỉ áp dụng cho các property đã được duyệt (chỉ có 2 trạng thái)
      if (status !== 'all') {
        if (status === 'inactive') {
          query.status = 'inactive';
        } else if (status === 'available') {
          query.status = 'available';
        }
      }

      // Search filter
      if (search.trim()) {
        query.title = { $regex: search, $options: 'i' };
      }

      // Build sort object - Chỉ ưu tiên promotedAt khi sort theo createdAt
      const sortObj = {};
      
      if (sortBy === 'createdAt') {
        // Chỉ khi sắp xếp theo thời gian tạo thì mới ưu tiên tin được promote
        sortObj.promotedAt = -1; // Promoted properties first (newest promoted)
        sortObj.createdAt = sortOrder; // Then by creation date
      } else {
        // Các tiêu chí sắp xếp khác không ưu tiên promoted
        sortObj[sortBy] = sortOrder;
      }

      // Lấy data
      const [properties, total, provinces] = await Promise.all([
        Property.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .populate('owner', 'fullName email phone avatar')
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
          phone: property.owner.phone,
          avatar: property.owner.avatar
        },
        location: {
          provinceName: provinceMap.get(String(property.province)) || "",
          districtName: districtMap.get(String(property.district)) || "",
          wardName: wardMap.get(String(property.ward)) || "",
          detailAddress: property.detailAddress
        },
        views: property.views || 0,
        favorites: property.stats?.favorites || 0,
        createdAt: property.createdAt,
        updatedAt: property.updatedAt
      }));
      // console.log("Transformed approved properties:", transformedProperties);

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

  // Lấy danh sách tin đăng đã được duyệt theo district và ward
  getMyApprovedPropertiesByLocation: async (req, res) => {
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
      
      // Location filter params - THÊM MỚI
      const district = req.query.district || '';
      const ward = req.query.ward || '';

      // Build query với điều kiện approvalStatus = 'approved' và isDeleted = false
      let query = { 
        approvalStatus: 'approved',
        status: { $ne: 'inactive' },
        isDeleted: { $ne: true }
      };

      // Location filters - THÊM MỚI
      if (district.trim()) {
        query.district = district;
      }
      if (ward.trim()) {
        query.ward = ward;
      }

      // Status filter - chỉ áp dụng cho các property đã được duyệt (chỉ có 2 trạng thái)
      if (status !== 'all') {
        if (status === 'inactive') {
          query.status = 'inactive';
        } else if (status === 'available') {
          query.status = 'available';
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
          .populate('owner', 'fullName email phone avatar')
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
          phone: property.owner.phone,
          avatar: property.owner.avatar
        },
        location: {
          provinceName: provinceMap.get(String(property.province)) || "",
          districtName: districtMap.get(String(property.district)) || "",
          wardName: wardMap.get(String(property.ward)) || "",
          detailAddress: property.detailAddress,
          district: property.district, // THÊM MỚI
          ward: property.ward // THÊM MỚI
        },
        views: property.views || 0,
        favorites: property.stats?.favorites || 0,
        createdAt: property.createdAt,
        updatedAt: property.updatedAt
      }));
      // console.log("Transformed approved properties by location:", transformedProperties);

      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        message: 'Lấy danh sách tin đăng đã duyệt theo khu vực thành công',
        data: {
          properties: transformedProperties,
          pagination: {
            page,
            limit,
            total,
            totalPages
          },
          filters: {
            district,
            ward
          }
        }
      });

    } catch (error) {
      console.error('Error in getMyApprovedPropertiesByLocation:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy danh sách tin đăng đã duyệt theo khu vực',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Cập nhật tin đăng
  updateProperty: async (req, res) => {
    try {
      const { propertyId } = req.params;
      const userId = req.user.id || req.user.userId;
      // console.log("req body: ", req.body);

      // 1. Tìm property
      const existingProperty = await Property.findOne({ _id: propertyId, owner: userId });
      if (!existingProperty) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tin đăng hoặc bạn không có quyền chỉnh sửa'
        });
      }
      // console.log("Existing property:", existingProperty);

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

      // Initialize arrays for approved and rejected files
      let finalApprovedImages = [];
      let finalApprovedVideos = [];
      let rejectedImages = [];
      let rejectedVideos = [];

      // Xử lý AI moderation results từ middleware
      if (!req.uploadResults) {
        validationErrors.images = 'Lỗi xử lý files. Vui lòng thử lại';
      } else {
        console.log('Upload results from moderation middleware:', req.uploadResults);
        console.log('Rejected images:', req.uploadResults.images?.rejected);
        console.log('Rejected videos:', req.uploadResults.videos?.rejected);
        
        // Handle both old and new structure
        let approvedImages, rejectedImagesFromMiddleware, approvedVideos, rejectedVideosFromMiddleware;
        
        if (req.uploadResults.images && req.uploadResults.videos) {
          // New nested structure
          approvedImages = req.uploadResults.images?.approved || [];
          rejectedImagesFromMiddleware = req.uploadResults.images?.rejected || [];
          approvedVideos = req.uploadResults.videos?.approved || [];
          rejectedVideosFromMiddleware = req.uploadResults.videos?.rejected || [];
        } else {
          // Old flat structure - filter by type
          const allApproved = req.uploadResults.approved || [];
          const allRejected = req.uploadResults.rejected || [];
          
          approvedImages = allApproved.filter(file => file.type === 'image');
          rejectedImagesFromMiddleware = allRejected.filter(file => file.type === 'image');
          approvedVideos = allApproved.filter(file => file.type === 'video');
          rejectedVideosFromMiddleware = allRejected.filter(file => file.type === 'video');
        }
        
        console.log('Processed results - Approved images:', approvedImages.length, 'Rejected images:', rejectedImagesFromMiddleware.length);
        console.log('Processed results - Approved videos:', approvedVideos.length, 'Rejected videos:', rejectedVideosFromMiddleware.length);
        
        finalApprovedImages = approvedImages;
        finalApprovedVideos = approvedVideos;
        rejectedImages = rejectedImagesFromMiddleware;
        rejectedVideos = rejectedVideosFromMiddleware;

        // Validation logic for files
        const totalImages = approvedImages.length + rejectedImagesFromMiddleware.length;
        const hasImagesInForm = req.files && req.files.some(file => file.fieldname === 'images');
        
        console.log('Image validation check:', {
          totalImages,
          approvedImages: approvedImages.length,
          rejectedImages: rejectedImagesFromMiddleware.length,
          hasImagesInForm,
          filesCount: req.files?.length || 0
        });
        
        // Kiểm tra video bị từ chối (nếu có upload video)
        const totalVideos = approvedVideos.length + rejectedVideosFromMiddleware.length;
        let hasVideoInForm = false;
        
        if (req.files) {
          if (Array.isArray(req.files)) {
            hasVideoInForm = req.files.some(file => file.fieldname === 'video');
          } else if (typeof req.files === 'object') {
            hasVideoInForm = req.files.video && req.files.video.length > 0;
          }
        }
        
        console.log('Video validation check:', {
          totalVideos,
          approvedVideos: approvedVideos.length,
          rejectedVideos: rejectedVideosFromMiddleware.length,
          hasVideoInForm
        });
        
        // Video validation - chỉ báo lỗi nếu thực sự có video trong form
        if (totalVideos > 0 && rejectedVideosFromMiddleware.length > 0 && hasVideoInForm) {
          console.log('Some videos were rejected, notifying user for replacement');
          validationErrors.video = `${rejectedVideosFromMiddleware.length} video bị từ chối do vi phạm nội quy. Vui lòng thay thế bằng video phù hợp.`;
        }
      }

      // Images & video handling
      let images = existingProperty.images || [];
      let video = existingProperty.video || null; 

      // Thêm ảnh mới đã được approved
      if (finalApprovedImages.length > 0) {
        const newImageUrls = finalApprovedImages.map(img => img.url);
        images = [...images, ...newImageUrls]; // giữ ảnh cũ + ảnh mới approved
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

      // Video processing - Sử dụng approved video từ AI moderation
      // Nếu user xoá video (frontend gửi removeVideo=true)
      if (req.body.removeVideo === "true") {
        video = null; // Set thành null thay vì empty string
      } else if (finalApprovedVideos.length > 0) {
        // Nếu có video mới được approved từ AI moderation
        video = finalApprovedVideos[0].url; // Chỉ lấy video đầu tiên
      }
      // Nếu không có hành động nào với video, giữ nguyên video hiện tại


      if (Object.keys(validationErrors).length > 0) {
        const errorResponse = {
          success: false,
          message: 'Thông tin không hợp lệ',
          errors: validationErrors
        };

        // Thêm thông tin về files bị từ chối vào validation error response
        if (rejectedImages.length > 0 || rejectedVideos.length > 0) {
          errorResponse.rejectedFiles = {
            images: rejectedImages,
            videos: rejectedVideos
          };
          console.log('Returning rejected files with validation errors:', errorResponse.rejectedFiles);
        }

        return res.status(400).json(errorResponse);
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

      // Prepare response với rejected files info
      const responseData = {
        property: updatedProperty
      };

      // Thêm thông tin về files bị từ chối nếu có
      if (rejectedImages.length > 0 || rejectedVideos.length > 0) {
        responseData.rejectedFiles = {
          images: rejectedImages,
          videos: rejectedVideos
        };
        console.log('Files rejected during update:', responseData.rejectedFiles);
      }

      return res.json({
        success: true,
        message: 'Cập nhật tin đăng thành công. Tin đăng sẽ được admin duyệt lại.',
        data: responseData
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
      // console.log('Toggling property status:', propertyId);
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

  // Đưa tin đăng lên đầu trang (promote to top)
  promotePropertyToTop: async (req, res) => {
    try {
      const { propertyId } = req.params;
      const userId = req.user.userId;

      const property = await Property.findOne({
        _id: propertyId,
        owner: userId,
        approvalStatus: 'approved'
      });

      if (!property) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tin đăng hoặc tin đăng chưa được duyệt'
        });
      }

      // Cập nhật createdAt để đưa tin lên đầu trang
      const updatedProperty = await Property.findByIdAndUpdate(
        propertyId,
        {
          $set: {
            promotedAt: new Date(),
            updatedAt: new Date()
          }
        },
        { new: true }
      );

      res.json({
        success: true,
        message: 'Đã đưa tin đăng lên đầu trang thành công',
        data: {
          promotedAt: updatedProperty.promotedAt
        }
      });

    } catch (error) {
      console.error('Error in promotePropertyToTop:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi đưa tin đăng lên đầu trang',
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
            inactive: {
              $sum: {
                $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0]
              }
            },
            available: {
              $sum: {
                $cond: [{ $eq: ['$status', 'available'] }, 1, 0]
              }
            },
            inactive: {
              $sum: {
                $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0]
              }
            },
            available: {
              $sum: {
                $cond: [{ $eq: ['$status', 'available'] }, 1, 0]
              }
            },
          }
        }
      ]);

      const result = stats[0] || {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        inactive: 0,
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
  },

    // Lấy chi tiết property theo ID
    async getPropertyDetail(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID property không hợp lệ'
                });
            }

            const property = await propertyRepository.getPropertyById(id);
            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy phòng trọ'
                });
            }

            // View increment is now handled by separate endpoint
            // Do not auto-increment views on detail fetch to avoid double counting

            res.status(200).json({
                success: true,
                message: 'Lấy thông tin chi tiết thành công',
                data: property
            });

        } catch (error) {
            console.error('Error in getPropertyDetail:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy thông tin chi tiết',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Lỗi server'
            });
        }
    }
,
    // Lấy danh sách property liên quan
    async getRelatedProperties(req, res) {
        try {
            const { id } = req.params;
            const { limit = 6 } = req.query;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID property không hợp lệ'
                });
            }

            const currentProperty = await propertyRepository.getPropertyById(id);
            if (!currentProperty) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy phòng trọ'
                });
            }

            const relatedProperties = await propertyRepository.getRelatedProperties(currentProperty, parseInt(limit));

            res.status(200).json({
                success: true,
                message: 'Lấy danh sách phòng trọ liên quan thành công',
                data: relatedProperties
            });

        } catch (error) {
            console.error('Error in getRelatedProperties:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy danh sách phòng trọ liên quan',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Lỗi server'
            });
        }
    },

    // Lấy danh sách property nổi bật
    async getFeaturedProperties(req, res) {
        try {
            const { limit = 5 } = req.query;

            const featuredProperties = await propertyRepository.getFeaturedProperties(parseInt(limit));

            res.status(200).json({
                success: true,
                message: 'Lấy danh sách phòng trọ nổi bật thành công',
                data: featuredProperties
            });

        } catch (error) {
            console.error('Error in getFeaturedProperties:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy danh sách phòng trọ nổi bật',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Lỗi server'
            });
        }
    },

    // Ghi nhận lượt xem
    async recordView(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID property không hợp lệ'
                });
            }

            await propertyRepository.incrementViews(id);

            res.status(200).json({
                success: true,
                message: 'Ghi nhận lượt xem thành công'
            });

        } catch (error) {
            console.error('Error in recordView:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi ghi nhận lượt xem',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Lỗi server'
            });
        }
    },

    // Get user's favorites
    getFavorites: async (req, res) => {
        try {
            const userId = req.user.userId;
            
            // Find properties that user has favorited
            const favoriteProperties = await Property.find({
                'stats.favoritedBy': userId,
                status: { $ne: 'inactive' },
                approvalStatus: 'approved',
                isDeleted: { $ne: true }
            })
            .populate('owner', 'fullName email phone avatar')
            .populate('amenities', 'name icon')
            .sort({ 'stats.lastFavoritedAt': -1 })
            .lean();

            // Lấy provinces, districts, wards để map tên
            const [provinces] = await Promise.all([
                fetchProvinces()
            ]);

            // Map tỉnh
            const provinceMap = new Map(provinces.map(p => [String(p.code), p.name]));

            // Lấy districts & wards phụ thuộc provinceCode, districtCode
            const districtMap = new Map();
            const wardMap = new Map();

            for (const property of favoriteProperties) {
                if (property.province && !districtMap.has(property.district)) {
                    const districts = await fetchDistricts(property.province);
                    districts.forEach(d => districtMap.set(String(d.code), d.name));
                }
                if (property.district && !wardMap.has(property.ward)) {
                    const wards = await fetchWards(property.district);
                    wards.forEach(w => wardMap.set(String(w.code), w.name));
                }
            }
            // Format response như getMyApprovedProperties
            const formattedProperties = favoriteProperties.map(property => ({
                _id: property._id,
                title: property.title,
                category: property.category,
                rentPrice: property.rentPrice,
                promotionPrice: property.promotionPrice,
                area: property.area,
                images: property.images || [],
                video: property.video || null,
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
                amenities: property.amenities || [],
                fullAmenities: property.fullAmenities,
                timeRules: property.timeRules,
                houseRules: property.houseRules,
                coordinates: property.coordinates,
                owner: {
                    _id: property.owner._id,
                    fullName: property.owner.fullName,
                    email: property.owner.email,
                    phone: property.owner.phone,
                    avatar: property.owner.avatar
                },
                location: {
                    provinceName: provinceMap.get(String(property.province)) || "",
                    districtName: districtMap.get(String(property.district)) || "",
                    wardName: wardMap.get(String(property.ward)) || "",
                    detailAddress: property.detailAddress
                },
                views: property.stats?.views || 0,
                favorites: property.stats?.favorites || 0,
                isFavorited: true,
                createdAt: property.createdAt,
                updatedAt: property.updatedAt
            }));

            res.json({
                success: true,
                message: 'Lấy danh sách yêu thích thành công',
                data: {
                    favorites: favoriteProperties.map(p => p._id),
                    properties: formattedProperties,
                    count: formattedProperties.length
                }
            });

        } catch (error) {
            console.error('Error in getFavorites:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy danh sách yêu thích',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Lỗi server'
            });
        }
    },

    // Add to favorites
    addToFavorites: async (req, res) => {
        try {
            const userId = req.user.userId;
            const propertyId = req.params.propertyId;

            // Validate property exists
            const property = await Property.findById(propertyId);
            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy tin đăng'
                });
            }

            // Check if already favorited
            const alreadyFavorited = property.stats.favoritedBy.includes(userId);
            if (alreadyFavorited) {
                return res.json({
                    success: true,
                    message: 'Tin đăng đã có trong danh sách yêu thích',
                    data: { alreadyFavorited: true }
                });
            }

            // Add to favorites
            await Property.findByIdAndUpdate(propertyId, {
                $addToSet: { 'stats.favoritedBy': userId },
                $inc: { 'stats.favorites': 1 },
                $set: { 'stats.lastFavoritedAt': new Date() }
            });

            res.json({
                success: true,
                message: 'Đã thêm vào danh sách yêu thích'
            });

        } catch (error) {
            console.error('Error in addToFavorites:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi thêm vào yêu thích',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Lỗi server'
            });
        }
    },

    // Remove from favorites
    removeFromFavorites: async (req, res) => {
        try {
            const userId = req.user.userId;
            const propertyId = req.params.propertyId;

            // Validate property exists
            const property = await Property.findById(propertyId);
            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy tin đăng'
                });
            }

            // Check if favorited
            const isFavorited = property.stats.favoritedBy.includes(userId);
            if (!isFavorited) {
                return res.json({
                    success: true,
                    message: 'Tin đăng đã được xóa khỏi danh sách yêu thích',
                    data: { alreadyRemoved: true }
                });
            }

            // Remove from favorites
            await Property.findByIdAndUpdate(propertyId, {
                $pull: { 'stats.favoritedBy': userId },
                $inc: { 'stats.favorites': -1 }
            });

            res.json({
                success: true,
                message: 'Đã xóa khỏi danh sách yêu thích'
            });

        } catch (error) {
            console.error('Error in removeFromFavorites:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi xóa khỏi yêu thích',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Lỗi server'
            });
        }
    }

};

export default myPropertiesController;