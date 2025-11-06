import Property from '../../../schemas/Property.js';
import Comment from '../../../schemas/Comment.js';
import PackagePlan from '../../../schemas/PackagePlan.js';
import User from '../../../schemas/User.js';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
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
      let query = { owner: userId, isDeleted: false };

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

      // Search filter - tìm kiếm theo tiêu đề hoặc mã tin
      if (search.trim()) {
        const searchTerm = search.trim();

        // Nếu search term có đúng 6 ký tự và chỉ chứa số/chữ cái, tìm theo mã tin
        if (searchTerm.length === 6 && /^[a-fA-F0-9]{6}$/.test(searchTerm)) {
          // Tìm kiếm theo 6 ký tự cuối của ObjectId (mã tin)
          // Sử dụng $expr và $regexMatch để tìm kiếm trong chuỗi ObjectId
          query.$expr = {
            $regexMatch: {
              input: { $toString: "$_id" },
              regex: searchTerm.toLowerCase() + '$',
              options: 'i'
            }
          };
        } else {
          // Tìm kiếm theo tiêu đề
          query.title = { $regex: searchTerm, $options: 'i' };
        }
      }

      // Build sort object
      const sortObj = {};
      sortObj[sortBy] = sortOrder;

      // Lấy data
      const [properties, total] = await Promise.all([
        Property.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .populate('owner', 'name email phone avatar')
          .populate('amenities', 'name icon')
          .populate('packageInfo.plan', 'name displayName type')
          .populate('packageInfo.postType', 'name displayName priority color stars textStyle')
          .lean(),
        Property.countDocuments(query)
      ]);


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
        province: property.province,
        ward: property.ward,
        detailAddress: property.detailAddress,
        views: property.views || 0,
        favorites: property.stats?.favorites || 0,
        comments: commentsCountMap.get(property._id.toString()) || 0,
        packageInfo: {
          ...property.packageInfo,
          plan: property.packageInfo?.plan,
          postType: property.packageInfo?.postType ? {
            ...property.packageInfo.postType,
            textStyle: property.packageInfo.postType.textStyle || 'normal'
          } : null,
          purchaseDate: property.packageInfo?.purchaseDate,
          expiryDate: property.packageInfo?.expiryDate,
          isActive: property.packageInfo?.isActive,
          status: property.packageInfo?.status
        },
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
        .populate('packageInfo.plan', 'name displayName type priority color stars')
        .populate('packageInfo.postType', 'name displayName color priority description stars textStyle')
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
        ward: property.ward || '',
        packageInfo: property.packageInfo || null
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

      // Thêm điều kiện kiểm tra gói chưa hết hạn.
      // Chỉ hiển thị tin đăng có gói còn hiệu lực hoặc không có gói (tin miễn phí)
      const now = new Date();
      query.$and = [
        {
          $or: [
            { 'packageInfo.expiryDate': { $gt: now } }, // Gói còn hiệu lực theo thời gian
            { 'packageInfo.expiryDate': { $exists: false } }, // Không có thông tin gói
            { 'packageInfo.expiryDate': null } // Gói không có ngày hết hạn
          ]
        },
        {
          $or: [
            { 'packageInfo.isActive': true }, // Gói đang active
            { 'packageInfo.isActive': { $exists: false } }, // Không có thông tin isActive (tin miễn phí)
            { 'packageInfo.isActive': null } // isActive null (tin miễn phí)
          ]
        }
      ];

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

      // Build sort object - Ưu tiên priority, sau đó promotedAt, cuối cùng mới là tiêu chí khác
      // Sử dụng aggregation pipeline để có thể sort theo priority từ populated field

      const aggregationPipeline = [
        { $match: query },
        // Lookup để populate postType trước khi sort
        {
          $lookup: {
            from: 'propertiespackages',
            localField: 'packageInfo.postType',
            foreignField: '_id',
            as: 'postTypeData'
          }
        },
        // Add computed field for priority (default to 999 nếu không có postType)
        {
          $addFields: {
            sortPriority: {
              $ifNull: [
                { $arrayElemAt: ['$postTypeData.priority', 0] },
                999
              ]
            }
          }
        },
        // Sort theo priority -> promotedAt -> tiêu chí khác
        {
          $sort: sortBy === 'createdAt' ? {
            sortPriority: 1, // Priority tăng dần (số nhỏ lên trước)
            promotedAt: -1, // Promoted gần nhất trong cùng priority
            createdAt: sortOrder // Theo thứ tự user chọn
          } : {
            sortPriority: 1, // Priority tăng dần (số nhỏ lên trước)
            [sortBy]: sortOrder, // Tiêu chí sắp xếp chính
            promotedAt: -1 // Tin promoted gần nhất trong cùng priority
          }
        },
        { $skip: skip },
        { $limit: limit },
        // Remove computed field
        {
          $project: {
            sortPriority: 0,
            postTypeData: 0
          }
        }
      ];

      // Lấy data bằng aggregation
      const [propertiesResult, total] = await Promise.all([
        Property.aggregate(aggregationPipeline),
        Property.countDocuments(query)
      ]);

      // Populate các fields cần thiết cho kết quả aggregation
      const populatedProperties = await Property.populate(propertiesResult, [
        { path: 'owner', select: 'fullName email phone avatar' },
        { path: 'amenities', select: 'name icon' },
        { path: 'packageInfo.plan', select: 'name displayName type priority color stars textStyle' },
        { path: 'packageInfo.postType', select: 'name displayName priority color stars textStyle' }
      ]);

      // Convert populated results to plain objects để tránh lỗi _doc structure
      const properties = populatedProperties.map(property => {
        const plainProperty = JSON.parse(JSON.stringify(property));
        return plainProperty;
      });

      console.log("Approved properties fetched:", properties.length);

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
        province: property.province,
        ward: property.ward,
        detailAddress: property.detailAddress,
        views: property.views || 0,
        favorites: property.stats?.favorites || 0,
        createdAt: property.createdAt,
        updatedAt: property.updatedAt,
        packageInfo: {
          ...property.packageInfo,
          plan: property.packageInfo?.plan,
          postType: property.packageInfo?.postType ? {
            ...property.packageInfo.postType,
            textStyle: property.packageInfo.postType.textStyle || 'normal'
          } : null,
          purchaseDate: property.packageInfo?.purchaseDate,
          expiryDate: property.packageInfo?.expiryDate,
          isActive: property.packageInfo?.isActive,
          status: property.packageInfo?.status
        }
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

  // Lấy danh sách tin đăng đã được duyệt theo ward
  getMyApprovedPropertiesByLocation: async (req, res) => {
    try {

      // Pagination params search
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Filter params
      const status = req.query.status || 'all';
      const sortBy = req.query.sortBy || 'createdAt';
      const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
      const search = req.query.search || '';

      // Location filter params - CHỈ SỬ DỤNG WARD
      const ward = req.query.ward || '';

      // Build query với điều kiện approvalStatus = 'approved' và isDeleted = false
      let query = {
        approvalStatus: 'approved',
        status: { $ne: 'inactive' },
        isDeleted: { $ne: true }
      };

      // Thêm điều kiện kiểm tra gói chưa hết hạn
      // Chỉ hiển thị tin đăng có gói còn hiệu lực hoặc không có gói (tin miễn phí)
      const now = new Date();
      query.$and = [
        {
          $or: [
            { 'packageInfo.expiryDate': { $gt: now } }, // Gói còn hiệu lực theo thời gian
            { 'packageInfo.expiryDate': { $exists: false } }, // Không có thông tin gói
            { 'packageInfo.expiryDate': null } // Gói không có ngày hết hạn
          ]
        },
        {
          $or: [
            { 'packageInfo.isActive': true }, // Gói đang active
            { 'packageInfo.isActive': { $exists: false } }, // Không có thông tin isActive (tin miễn phí)
            { 'packageInfo.isActive': null } // isActive null (tin miễn phí)
          ]
        }
      ];

      // Location filters - CHỈ SỬ DỤNG WARD
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
      const [properties, total] = await Promise.all([
        Property.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .populate('owner', 'fullName email phone avatar')
          .populate('amenities', 'name icon')
          .populate('packageInfo.plan', 'name displayName type priority color stars')
          .populate('packageInfo.postType', 'name displayName priority color stars textStyle')
          .lean(),
        Property.countDocuments(query)
      ]);

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
        province: property.province,
        ward: property.ward,
        detailAddress: property.detailAddress,
        views: property.views || 0,
        favorites: property.stats?.favorites || 0,
        createdAt: property.createdAt,
        updatedAt: property.updatedAt,
        packageInfo: {
          ...property.packageInfo,
          plan: property.packageInfo?.plan,
          postType: property.packageInfo?.postType ? {
            ...property.packageInfo.postType,
            textStyle: property.packageInfo.postType.textStyle || 'normal'
          } : null,
          purchaseDate: property.packageInfo?.purchaseDate,
          expiryDate: property.packageInfo?.expiryDate,
          isActive: property.packageInfo?.isActive,
          status: property.packageInfo?.status
        }
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
      console.log("req body updateProperty: ", req.body);


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

      // Initialize arrays for approved and rejected files
      let finalApprovedImages = [];
      let finalApprovedVideos = [];
      let rejectedImages = [];
      let rejectedVideos = [];

      // Xử lý AI moderation results từ middleware (chỉ khi có upload files mới)
      if (req.uploadResults) {
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
        const hasImagesInForm = req.files && req.files.images && req.files.images.length > 0;

        console.log('Image validation check:', {
          totalImages,
          approvedImages: approvedImages.length,
          rejectedImages: rejectedImagesFromMiddleware.length,
          hasImagesInForm,
          imagesInReq: req.files?.images?.length || 0
        });

        // Kiểm tra video bị từ chối (nếu có upload video)
        const totalVideos = approvedVideos.length + rejectedVideosFromMiddleware.length;
        const hasVideoInForm = req.files && req.files.video && req.files.video.length > 0;

        console.log('Video validation check:', {
          totalVideos,
          approvedVideos: approvedVideos.length,
          rejectedVideos: rejectedVideosFromMiddleware.length,
          hasVideoInForm
        });

        // Video rejection sẽ được xử lý thông qua rejectedFiles response, không cần validation error
        if (totalVideos > 0 && rejectedVideosFromMiddleware.length > 0 && hasVideoInForm) {
          console.log('Some videos were rejected, will be handled via rejectedFiles response');
        }
      } else {
        console.log('No upload results - user did not upload new files');
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
      // Nếu user xoá video (frontend gửi removeVideo=true).
      if (req.body.removeVideo === "true") {
        video = null; // Set thành null thay vì empty string
      } else if (finalApprovedVideos.length > 0) {
        // Nếu có video mới được approved từ AI moderation
        video = finalApprovedVideos[0].url; // Chỉ lấy video đầu tiên
      }
      // Nếu không có hành động nào với video, giữ nguyên video hiện tại


      // Kiểm tra và xử lý files bị từ chối trước khi validate
      if (rejectedImages.length > 0 || rejectedVideos.length > 0) {
        // Nếu có files bị từ chối, trả về response với thông tin chi tiết
        const rejectedResponse = {
          success: false,
          message: '',
          errors: validationErrors, // Vẫn trả về validation errors khác nếu có
          rejectedFiles: {
            images: rejectedImages,
            videos: rejectedVideos
          }
        };
        console.log('Returning rejected files response:', rejectedResponse.rejectedFiles);
        return res.status(400).json(rejectedResponse);
      }

      if (Object.keys(validationErrors).length > 0) {
        const errorResponse = {
          success: false,
          message: `Thông tin không hợp lệ, có lỗi: ${Object.values(validationErrors).join(', ')}`,
          errors: validationErrors
        };

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

      // 4. Xử lý package và post type nếu có thay đổi
      let packageUpdateNeeded = false;
      let userPackage = null;

      if (req.body.postTypeId && req.body.packageId && req.body.isNewPostType === 'true') {
        console.log('Processing post type change in updateProperty');
        console.log('New postTypeId:', req.body.postTypeId);
        console.log('PackageId:', req.body.packageId);
        console.log('Existing property postType:', existingProperty.packageInfo?.postType);

        // Tìm user package hiện tại
        userPackage = await User.findById(userId).populate({
          path: 'currentPackagePlan.propertiesLimits.packageType',
          model: 'PropertiesPackage'
        });

        if (!userPackage || !userPackage.currentPackagePlan) {
          return res.status(400).json({
            success: false,
            message: 'Không tìm thấy gói tin của user'
          });
        }

        console.log('User package found:', userPackage.currentPackagePlan);
        console.log('Properties limits:', userPackage.currentPackagePlan.propertiesLimits);

        // Tìm post type limit trong package
        const selectedPostTypeLimit = userPackage.currentPackagePlan.propertiesLimits.find(
          limit => limit.packageType._id.toString() === req.body.postTypeId
        );

        if (!selectedPostTypeLimit) {
          return res.status(400).json({
            success: false,
            message: 'Loại tin không tồn tại trong gói hiện tại'
          });
        }

        // Kiểm tra limit còn lại
        const remainingLimit = selectedPostTypeLimit.limit - selectedPostTypeLimit.used;
        console.log(`Checking limits for postTypeId ${req.body.postTypeId}: used=${selectedPostTypeLimit.used}, limit=${selectedPostTypeLimit.limit}, remaining=${remainingLimit}`);

        if (remainingLimit <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Bạn đã hết lượt đăng loại tin này trong gói hiện tại'
          });
        }

        console.log(`Post type change validated. Remaining limit: ${remainingLimit}`);
        packageUpdateNeeded = true;

        // Cập nhật packageInfo trong property - giữ lại tất cả thông tin hiện có
        updateData.packageInfo = {
          ...existingProperty.packageInfo, // Giữ lại tất cả thông tin cũ
          packageId: req.body.packageId,
          postType: req.body.postTypeId,
          plan: userPackage.currentPackagePlan.packagePlanId,
          // Đảm bảo các trường quan trọng không bị mất
          purchaseDate: existingProperty.packageInfo?.purchaseDate || userPackage.currentPackagePlan.purchaseDate,
          expiryDate: existingProperty.packageInfo?.expiryDate || userPackage.currentPackagePlan.expiryDate,
          isActive: existingProperty.packageInfo?.isActive !== undefined ? existingProperty.packageInfo.isActive : true,
          status: existingProperty.packageInfo?.status || userPackage.currentPackagePlan.status || 'active',
          updatedAt: new Date()
        };
      }

      // 5. Update DB
      const updatedProperty = await Property.findByIdAndUpdate(
        propertyId,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      // 6. Cập nhật limit nếu cần
      if (packageUpdateNeeded && userPackage) {
        console.log('Updating package limits...');

        try {
          // Tìm index của post type trong propertiesLimits array
          const newPostTypeIndex = userPackage.currentPackagePlan.propertiesLimits.findIndex(
            limit => limit.packageType._id.toString() === req.body.postTypeId
          );

          if (newPostTypeIndex !== -1) {
            const newPostTypeLimit = userPackage.currentPackagePlan.propertiesLimits[newPostTypeIndex];
            console.log(`Found new post type at index ${newPostTypeIndex}, current used: ${newPostTypeLimit.used}, limit: ${newPostTypeLimit.limit}`);

            // Trừ 1 từ loại tin mới
            const updateResult = await User.updateOne(
              {
                _id: userId,
                'currentPackagePlan.propertiesLimits._id': newPostTypeLimit._id
              },
              {
                $inc: { 'currentPackagePlan.propertiesLimits.$.used': 1 }
              }
            );

            if (updateResult.modifiedCount > 0) {
              console.log(`Successfully decreased limit for new post type at index ${newPostTypeIndex}`);
            } else {
              console.error(`Failed to decrease limit for new post type at index ${newPostTypeIndex}`);
            }
          } else {
            console.error(`Could not find new post type index for postTypeId: ${req.body.postTypeId}`);
          }

          // Không cộng lại cho loại tin cũ vì người dùng đã sử dụng trong khoảng thời gian
          const oldPostTypeId = existingProperty.packageInfo?.postType;
          console.log(`Old post type: ${oldPostTypeId} - Không hoàn lại limit vì đã sử dụng`);

          if (oldPostTypeId && oldPostTypeId.toString() !== req.body.postTypeId) {
            console.log(`ℹPost type changed from ${oldPostTypeId} to ${req.body.postTypeId}. Old limit not restored as user already used it.`);
          } else {
            console.log(`ℹNo post type change detected`);
          }

          console.log(`Package limits updated for user ${userId}`);
        } catch (limitUpdateError) {
          console.error('Error updating package limits:', limitUpdateError);
          // Don't throw here, we still want to return success for property update
        }
      }

      // Prepare response với rejected files info
      const responseData = {
        property: updatedProperty
      };

      // Thêm thông tin về post type change nếu có
      if (packageUpdateNeeded && req.body.postTypeId) {
        // Reload user package để lấy thông tin mới nhất sau update
        const updatedUserPackage = await User.findById(userId).populate({
          path: 'currentPackagePlan.propertiesLimits.packageType',
          model: 'PropertiesPackage'
        });

        const selectedPostTypeLimit = updatedUserPackage.currentPackagePlan.propertiesLimits.find(
          limit => limit.packageType._id.toString() === req.body.postTypeId
        );

        if (selectedPostTypeLimit) {
          responseData.postType = {
            _id: req.body.postTypeId,
            displayName: selectedPostTypeLimit.packageType.displayName,
            usedCount: selectedPostTypeLimit.used, // Số đã sử dụng sau khi update
            allowedLimit: selectedPostTypeLimit.limit,
            remaining: selectedPostTypeLimit.limit - selectedPostTypeLimit.used
          };
          
        }
      }

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
      console.log(`propertyId to promote: ${propertyId} by user: ${userId}`);

      // Tìm property với populate để lấy thông tin plan
      const property = await Property.findOne({
        _id: propertyId,
        owner: userId,
        approvalStatus: 'approved'
      }).populate('packageInfo.plan');

      if (!property) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tin đăng hoặc tin đăng chưa được duyệt'
        });
      }

      // Kiểm tra tin đăng có package không
      if (!property.packageInfo || !property.packageInfo.plan) {
        return res.status(400).json({
          success: false,
          message: 'Tin đăng này chưa có gói, vui lòng chọn gói để sử dụng tính năng đẩy tin'
        });
      }

      // Kiểm tra gói của tin đăng có còn hoạt động không
      if (!property.packageInfo.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Gói của tin đăng này đã hết hạn hoặc không hoạt động'
        });
      }

      // Kiểm tra ngày hết hạn của gói tin đăng
      if (property.packageInfo.expiryDate && new Date() > new Date(property.packageInfo.expiryDate)) {
        return res.status(400).json({
          success: false,
          message: 'Gói của tin đăng này đã hết hạn'
        });
      }
      // Lấy thông tin gói của tin đăng
      const propertyPlan = property.packageInfo.plan;
     
      // Lấy thông tin user để kiểm tra lượt đẩy tin
      const user = await User.findById(userId).lean();
      // Xác định gói nào đang được sử dụng để đếm lượt đẩy tin
      let packageForPushCount;
      // Nếu tin đăng có packageInstanceId (ưu tiên tìm theo packageInstanceId)
      if (property.packageInfo.packageInstanceId) {

        
        // Tìm theo packageInstanceId trong currentPackagePlan
        if (user.currentPackagePlan && 
            user.currentPackagePlan.packageInstanceId?.toString() === property.packageInfo.packageInstanceId?.toString()) {
        
          packageForPushCount = user.currentPackagePlan;
        } else {
          console.log('Not found in currentPackagePlan, searching in packageHistory...');
          console.log('PackageHistory array:', user.packageHistory);
          
          // Tìm trong packageHistory theo packageInstanceId
          const historyPackage = user.packageHistory?.find(pkg => {
            return pkg.packageInstanceId?.toString() === property.packageInfo.packageInstanceId?.toString();
          });
          
        
          
          if (historyPackage) {
            packageForPushCount = historyPackage;
          } else {
            console.log('No match found in packageHistory');
            return res.status(400).json({
              success: false,
              message: 'Không tìm thấy thông tin gói của tin đăng này (packageInstanceId không hợp lệ)'
            });
          }
        }
      } else {
        // Fallback: Nếu tin đăng chưa có packageInstanceId, tìm theo packagePlanId (legacy)
        // Nếu tin đăng sử dụng gói hiện tại của user
        if (user.currentPackagePlan && 
            user.currentPackagePlan.packagePlanId.toString() === propertyPlan._id.toString()) {
          packageForPushCount = user.currentPackagePlan;
        } else {
          // Nếu tin đăng sử dụng gói cũ, cần tìm trong packageHistory
          const historyPackage = user.packageHistory?.find(pkg => 
            pkg.packagePlanId.toString() === propertyPlan._id.toString()
          );
          
          if (historyPackage) {
            packageForPushCount = historyPackage;
          } else {
            return res.status(400).json({
              success: false,
              message: 'Không tìm thấy thông tin gói của tin đăng này'
            });
          }
        }
      }

      // Kiểm tra lượt đẩy tin còn lại của gói
      const usedPushCount = packageForPushCount.usedPushCount || 0;
      const freePushCount = packageForPushCount.freePushCount || 0;
      const remainingPushCount = freePushCount - usedPushCount;

      if (remainingPushCount <= 0) {
        return res.status(400).json({
          success: false,
          message: `${propertyPlan.displayName} đã hết lượt đẩy tin. Đã sử dụng ${usedPushCount}/${freePushCount} lượt.`,
          data: {
            usedPushCount,
            freePushCount,
            remainingPushCount: 0,
            packageName: propertyPlan.displayName
          }
        });
      }

      // Cập nhật promotedAt cho property
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

      // Cập nhật usedPushCount của gói phù hợp (+1)
      let updatedUser;
      
      // Nếu tin đăng có packageInstanceId, cập nhật theo packageInstanceId (chính xác hơn)
      if (property.packageInfo.packageInstanceId) {
        if (user.currentPackagePlan && 
            user.currentPackagePlan.packageInstanceId?.toString() === property.packageInfo.packageInstanceId?.toString()) {
          // Cập nhật gói hiện tại theo packageInstanceId
          updatedUser = await User.findByIdAndUpdate(
            userId,
            {
              $inc: { 'currentPackagePlan.usedPushCount': 1 },
              $set: { 'currentPackagePlan.updatedAt': new Date() }
            },
            { new: true }
          );
        } else {
          // Cập nhật gói trong packageHistory theo packageInstanceId
          const historyIndex = user.packageHistory?.findIndex(pkg => 
            pkg.packageInstanceId?.toString() === property.packageInfo.packageInstanceId?.toString()
          );
          
          if (historyIndex !== -1) {
            updatedUser = await User.findByIdAndUpdate(
              userId,
              {
                $inc: { [`packageHistory.${historyIndex}.usedPushCount`]: 1 },
                $set: { [`packageHistory.${historyIndex}.updatedAt`]: new Date() }
              },
              { new: true }
            );
          }
        }
      } else {
        // Fallback: Cập nhật theo packagePlanId (legacy support)
        if (user.currentPackagePlan && 
            user.currentPackagePlan.packagePlanId.toString() === propertyPlan._id.toString()) {
          // Cập nhật gói hiện tại
          updatedUser = await User.findByIdAndUpdate(
            userId,
            {
              $inc: { 'currentPackagePlan.usedPushCount': 1 },
              $set: { 'currentPackagePlan.updatedAt': new Date() }
            },
            { new: true }
          );
        } else {
          // Cập nhật gói trong packageHistory
          const historyIndex = user.packageHistory?.findIndex(pkg => 
            pkg.packagePlanId.toString() === propertyPlan._id.toString()
          );
          
          if (historyIndex !== -1) {
            updatedUser = await User.findByIdAndUpdate(
              userId,
              {
                $inc: { [`packageHistory.${historyIndex}.usedPushCount`]: 1 },
                $set: { [`packageHistory.${historyIndex}.updatedAt`]: new Date() }
              },
              { new: true }
            );
          }
        }
      }

      // Tính toán lượt còn lại sau khi đẩy
      const newUsedCount = usedPushCount + 1;
      const newRemainingCount = freePushCount - newUsedCount;

      res.json({
        success: true,
        message: `Đã đưa tin đăng lên đầu trang thành công (${propertyPlan.displayName})`,
        data: {
          promotedAt: updatedProperty.promotedAt,
          pushCount: {
            used: newUsedCount,
            total: freePushCount,
            remaining: newRemainingCount
          },
          packageName: propertyPlan.displayName
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

      // Build query để tìm properties user đã favorite
      // Thêm điều kiện kiểm tra gói chưa hết hạn
      const now = new Date();
      const query = {
        'stats.favoritedBy': userId,
        status: { $ne: 'inactive' },
        approvalStatus: 'approved',
        isDeleted: { $ne: true },
        $and: [
          {
            $or: [
              { 'packageInfo.expiryDate': { $gt: now } }, // Gói còn hiệu lực theo thời gian
              { 'packageInfo.expiryDate': { $exists: false } }, // Không có thông tin gói
              { 'packageInfo.expiryDate': null } // Gói không có ngày hết hạn
            ]
          },
          {
            $or: [
              { 'packageInfo.isActive': true }, // Gói đang active
              { 'packageInfo.isActive': { $exists: false } }, // Không có thông tin isActive (tin miễn phí)
              { 'packageInfo.isActive': null } // isActive null (tin miễn phí)
            ]
          }
        ]
      };

      // Find properties that user has favorited
      const favoriteProperties = await Property.find(query)
        .populate('owner', 'fullName email phone avatar')
        .populate('amenities', 'name icon')
        .sort({ 'stats.lastFavoritedAt': -1 })
        .lean();

      // Không cần map provinces, wards nữa vì schema đã đơn giản hóa
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
        province: property.province,
        ward: property.ward,
        detailAddress: property.detailAddress,
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
  },


  // Lấy thông tin gói đang sử dụng của user hiện tại
  getCurrentUserPackage: async (req, res) => {
    try {
      const userId = req.user.userId;
      // Lấy thông tin user và gói hiện tại
      const user = await User.findById(userId).lean();
    

      // Đếm tổng số tin đã đăng của user (bao gồm cả miễn phí)
      const totalUserPosts = await Property.countDocuments({
        owner: userId
      });

      // Kiểm tra nếu user có currentPackagePlan (gói đã thanh toán hoặc hết hạn)
      if (user && user.currentPackagePlan && user.currentPackagePlan.packagePlanId) {
        const currentPackage = user.currentPackagePlan;

        // Lấy thông tin chi tiết PackagePlan
        const packagePlan = await PackagePlan.findById(currentPackage.packagePlanId)
          .populate('propertiesLimits.packageType', 'name displayName color priority description stars')
          .lean();

      

        if (packagePlan) {
          // Đồng bộ thông tin gói mới nhất từ database
        

          // Giữ lại thông tin used count hiện tại
          const currentUsedData = {};
          if (currentPackage.propertiesLimits) {
            currentPackage.propertiesLimits.forEach(limit => {
              currentUsedData[limit.packageType.toString()] = limit.used || 0;
            });
          }

          // Cập nhật user với thông tin mới từ packagePlan
          const updatedPropertiesLimits = packagePlan.propertiesLimits.map(limit => ({
            packageType: limit.packageType._id,
            limit: limit.limit,
            used: currentUsedData[limit.packageType._id.toString()] || 0
          }));

          await User.findByIdAndUpdate(userId, {
            'currentPackagePlan.propertiesLimits': updatedPropertiesLimits,
            'currentPackagePlan.freePushCount': packagePlan.freePushCount,
            'currentPackagePlan.displayName': packagePlan.displayName,
            'currentPackagePlan.packageName': packagePlan.name,
          });

          // Cập nhật currentPackage để sử dụng trong response
          currentPackage.propertiesLimits = updatedPropertiesLimits;
          currentPackage.freePushCount = packagePlan.freePushCount;
          currentPackage.displayName = packagePlan.displayName;
          currentPackage.packageName = packagePlan.name;
          // Kiểm tra ngày hết hạn
          const now = new Date();
          let isExpired = false;

          if (currentPackage.expiryDate) {
            const expiryDate = new Date(currentPackage.expiryDate);
            isExpired = now > expiryDate;
          }

          // Nếu gói đã hết hạn hoặc user.packageType đã là 'expired'
          if (isExpired || user.packageType === 'expired' || !currentPackage.isActive) {
            // Gói đã hết hạn - cập nhật user và tất cả properties thuộc user
            console.log('Package expired - updating user and properties...');

            // Lưu lại used count vào backupUsedCount trước khi đánh dấu hết hạn
            const backupPropertiesLimits = currentPackage.propertiesLimits.map(limit => ({
              ...limit,
              // Chỉ backup nếu chưa có backupUsedCount hoặc backupUsedCount = 0
              backupUsedCount: (limit.backupUsedCount && limit.backupUsedCount > 0) 
                ? limit.backupUsedCount // Giữ nguyên backup cũ nếu đã có
                : (limit.used || 0), // Backup từ used hiện tại nếu chưa có
              // Giữ nguyên used count, không reset về 0
            }));
            console.log('Backup properties limits with used counts:', backupPropertiesLimits);

            // Cập nhật thông tin user với backup data
            await User.findByIdAndUpdate(userId, {
              'currentPackagePlan.isActive': false,
              'currentPackagePlan.status': 'expired',
              'currentPackagePlan.propertiesLimits': backupPropertiesLimits
            });

            // Cập nhật tất cả properties có gói thuộc về user này
            const updateResult = await Property.updateMany(
              {
                owner: userId,
                'packageInfo.plan': currentPackage.packagePlanId, // chỉ bài đăng thuộc gói này
                'packageInfo.packageInstanceId': currentPackage.packageInstanceId, // chỉ bài đăng thuộc instance hiện tại
                'packageInfo.isActive': true
              },
              {
                $set: {
                  'packageInfo.isActive': false,
                  'packageInfo.status': 'expired',
                  'packageInfo.expiryDate': currentPackage.expiryDate, // Sử dụng ngày hết hạn chính xác từ user package
                  updatedAt: new Date()
                }
              }
            );

            console.log(`Updated ${updateResult.modifiedCount} properties to expired status for user ${userId}`);

            return res.json({
              success: true,
              message: 'Gói tin đã hết hạn. Vui lòng gia hạn để tiếp tục đăng tin.',
              data: {
                packageType: 'expired',
                packageId: packagePlan._id,
                packageName: packagePlan.name,
                displayName: packagePlan.displayName,
                price: packagePlan.price,
                priority: packagePlan.priority || 5,
                color: '#dc3545', // Màu đỏ cho gói hết hạn
                stars: packagePlan.stars || 0,
                duration: packagePlan.duration,
                durationUnit: packagePlan.durationUnit,
                startDate: currentPackage.purchaseDate,
                expiryDate: currentPackage.expiryDate,
                usedPosts: totalUserPosts,
                totalPosts: totalUserPosts,
                remainingFreePosts: 0, // Không còn bài miễn phí
                freePushCount: 0, // Không còn lượt đẩy tin
                isActive: false,
                isExpired: true,
                propertiesLimits: packagePlan.propertiesLimits.map(limit => {
                  // Tìm used count hiện tại từ currentPackage để backup
                  const currentLimit = currentPackage.propertiesLimits?.find(
                    cl => cl.packageType.toString() === limit.packageType._id.toString()
                  );
                  const currentUsed = currentLimit?.used || 0;
                  
                  return {
                    packageType: {
                      _id: limit.packageType._id,
                      name: limit.packageType.name,
                      displayName: limit.packageType.displayName,
                      color: limit.packageType.color,
                      priority: limit.packageType.priority,
                      description: limit.packageType.description,
                      stars: limit.packageType.stars
                    },
                    limit: 0, // Tất cả giới hạn về 0 để không thể đăng tin mới
                    used: currentUsed, // Giữ nguyên used count để hiển thị số tin đã đăng
                    backupUsedCount: currentUsed, // Lưu lại used count hiện tại để khôi phục khi gia hạn
                    _id: limit._id
                  };
                }).sort((a, b) => (a.packageType.priority || 999) - (b.packageType.priority || 999))
              }
            });
          }

          // Gói còn hiệu lực - trả về thông tin chi tiết
          const packageInfo = {
            packageType: user.packageType || packagePlan.type,
            packageId: packagePlan._id,
            packageName: packagePlan.name,
            displayName: packagePlan.displayName || currentPackage.displayName || packagePlan.name,
            price: packagePlan.price,
            priority: packagePlan.priority || 5,
            color: packagePlan.color || '#28a745',
            stars: packagePlan.stars || 5,
            startDate: currentPackage.purchaseDate,
            expiryDate: currentPackage.expiryDate,
            isActive: currentPackage.isActive,

            // Thông tin duration từ package plan
            duration: packagePlan.duration,
            durationUnit: packagePlan.durationUnit,

            // Thống kê sử dụng
            usedPosts: totalUserPosts,
            totalPosts: totalUserPosts,

            // Quyền lợi gói từ currentPackagePlan hoặc packagePlan
            freePushCount: currentPackage.freePushCount || packagePlan.freePushCount,
            usedPushCount: currentPackage.usedPushCount || 0,

            // Giới hạn tin đăng theo từng loại - Sử dụng dữ liệu từ currentPackage.propertiesLimits sau khi đã sync
            propertiesLimits: currentPackage.propertiesLimits.map(userLimit => {
              // Tìm thông tin chi tiết packageType từ packagePlan
              const packageTypeInfo = packagePlan.propertiesLimits.find(
                pl => pl.packageType._id.toString() === userLimit.packageType.toString()
              );

              return {
                packageType: packageTypeInfo ? {
                  _id: packageTypeInfo.packageType._id,
                  name: packageTypeInfo.packageType.name,
                  displayName: packageTypeInfo.packageType.displayName,
                  color: packageTypeInfo.packageType.color,
                  priority: packageTypeInfo.packageType.priority,
                  description: packageTypeInfo.packageType.description,
                  stars: packageTypeInfo.packageType.stars
                } : {
                  _id: userLimit.packageType,
                  name: 'Unknown',
                  displayName: 'Unknown Package Type',
                  priority: 999 // Mặc định priority cao nhất
                },
                limit: userLimit.limit,
                used: userLimit.used || 0,
                _id: userLimit._id
              };
            }).sort((a, b) => (a.packageType.priority || 999) - (b.packageType.priority || 999))
          };

         

          return res.json({
            success: true,
            message: 'Lấy thông tin gói đang sử dụng thành công',
            data: packageInfo
          });
        }
      }

      // Tìm các tin đăng có gói đang hoạt động (legacy support)
      const activePackageProperties = await Property.find({
        owner: userId,
        'packageInfo.status': { $in: ['active', 'pending'] },
        'packageInfo.isActive': true
      }).sort({ 'packageInfo.expiryDate': -1 }).lean();

      // Nếu user có gói đang hoạt động từ Property
      if (activePackageProperties.length > 0) {
        const latestPackage = activePackageProperties[0];

        const packageInfo = {
          packageType: 'paid',
          packageId: latestPackage.packageInfo.packageId,
          packageName: latestPackage.packageInfo.packageName,
          displayName: latestPackage.packageInfo.displayName || latestPackage.packageInfo.packageName,
          price: latestPackage.packageInfo.price || 0,
          priority: latestPackage.packageInfo.priority || 5,
          color: latestPackage.packageInfo.color || '#007bff',
          stars: latestPackage.packageInfo.stars || 0,
          startDate: latestPackage.packageInfo.startDate,
          expiryDate: latestPackage.packageInfo.expiryDate,
          isActive: true,
          duration: latestPackage.packageInfo.duration || 30,
          durationUnit: latestPackage.packageInfo.durationUnit || 'day',
          usedPosts: activePackageProperties.length,
          totalPosts: totalUserPosts,
          freePushCount: latestPackage.packageInfo.freePushCount || 5,
          propertiesLimits: [{
            packageType: {
              name: latestPackage.packageInfo.packageName,
              displayName: latestPackage.packageInfo.displayName,
              color: latestPackage.packageInfo.color
            },
            limit: 10,
            used: activePackageProperties.length
          }]
        };

        return res.json({
          success: true,
          message: 'Lấy thông tin gói đang sử dụng thành công',
          data: packageInfo
        });
      }

      // Nếu user chưa có gói trả phí, lấy gói trial từ database
      const trialPackage = await PackagePlan.findOne({
        type: 'trial',
        isActive: true
      })
        .populate('propertiesLimits.packageType', 'name displayName color priority description stars')
        .lean();

      if (!trialPackage) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy gói dùng thử trong hệ thống'
        });
      }

      // Tính tổng số tin có thể đăng từ propertiesLimits
      const totalTrialPosts = trialPackage.propertiesLimits.reduce((sum, limit) => sum + limit.limit, 0);
      const freePostsUsed = Math.min(totalUserPosts, totalTrialPosts);

      // Tính toán startDate và expiryDate cho gói trial theo duration và duraionUnit
      const startDate = new Date();
      let expiryDate = null;

      if (trialPackage.duration && trialPackage.durationUnit) {
        expiryDate = new Date(startDate);

        switch (trialPackage.durationUnit) {
          case 'day':
            expiryDate.setDate(startDate.getDate() + parseInt(trialPackage.duration));
            break;
          case 'month':
            expiryDate.setMonth(startDate.getMonth() + parseInt(trialPackage.duration));
            break;
          case 'year':
            expiryDate.setFullYear(startDate.getFullYear() + parseInt(trialPackage.duration));
            break;
          default:
            // Mặc định là day nếu không nhận diện được
            expiryDate.setDate(startDate.getDate() + parseInt(trialPackage.duration));
            break;
        }
      }

      const trialPackageInfo = {
        packageType: user.packageType || 'trial',
        packageId: trialPackage._id,
        packageName: trialPackage.name,
        displayName: trialPackage.displayName,
        price: trialPackage.price,
        priority: trialPackage.priority || 5,
        color: trialPackage.color || '#28a745',
        stars: trialPackage.stars || 0,
        startDate: startDate,
        expiryDate: expiryDate,
        isActive: true,
        duration: trialPackage.duration,
        durationUnit: trialPackage.durationUnit,
        usedPosts: freePostsUsed,
        totalPosts: totalUserPosts,
        remainingFreePosts: Math.max(0, totalTrialPosts - freePostsUsed),
        freePushCount: trialPackage.freePushCount,

        // Thêm propertiesLimits từ database với used count thực tế
        propertiesLimits: trialPackage.propertiesLimits.map(limit => {
          // Tìm used count từ user.currentPackagePlan.propertiesLimits nếu có
          let usedCount = 0;
          if (user.currentPackagePlan && user.currentPackagePlan.propertiesLimits) {
            const userLimit = user.currentPackagePlan.propertiesLimits.find(
              ul => ul.packageType.toString() === limit.packageType._id.toString()
            );
            usedCount = userLimit ? (userLimit.used || 0) : 0;
          }

          return {
            packageType: {
              _id: limit.packageType._id,
              name: limit.packageType.name,
              displayName: limit.packageType.displayName,
              color: limit.packageType.color,
              priority: limit.packageType.priority,
              description: limit.packageType.description,
              stars: limit.packageType.stars
            },
            limit: limit.limit,
            used: usedCount,
            _id: limit._id
          };
        }).sort((a, b) => (a.packageType.priority || 999) - (b.packageType.priority || 999))
      };

      res.json({
        success: true,
        message: 'Lấy thông tin gói dùng thử thành công',
        data: trialPackageInfo
      });

    } catch (error) {
      console.error('Error in getCurrentUserPackage:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy thông tin gói tin',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Lỗi server'
      });
    }
  },

  // Lấy danh sách loại tin có sẵn
  getAvailablePostTypes: async (req, res) => {
    try {
      const userId = req.user.userId;

      // Lấy thông tin user và gói hiện tại
      const user = await User.findById(userId).lean();
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thông tin user'
        });
      }

      let packagePlan = null;

      // Lấy gói hiện tại của user
      if (user.currentPackagePlan && user.currentPackagePlan.isActive) {
        packagePlan = await PackagePlan.findById(user.currentPackagePlan.packagePlanId)
          .populate('propertiesLimits.packageType', 'name displayName color priority description stars')
          .lean();
      }

      // Nếu không có gói trả phí active, lấy gói trial
      if (!packagePlan) {
        packagePlan = await PackagePlan.findOne({
          type: 'trial',
          isActive: true
        })
          .populate('propertiesLimits.packageType', 'name displayName color priority description stars')
          .lean();

        if (!packagePlan) {
          return res.status(404).json({
            success: false,
            message: 'Không tìm thấy gói dùng thử trong hệ thống'
          });
        }
      }

      // Đồng bộ dữ liệu cho user chưa có currentPackagePlan.propertiesLimits
      if (!user.currentPackagePlan || !user.currentPackagePlan.propertiesLimits || user.currentPackagePlan.propertiesLimits.length === 0) {
        console.log('Syncing propertiesLimits for user:', userId);

        // Đếm số bài đăng thực tế từ Property collection để đồng bộ
        const postTypeCounts = await Property.aggregate([
          {
            $match: {
              owner: new mongoose.Types.ObjectId(userId),
              approvalStatus: { $in: ['pending', 'approved'] }
            }
          },
          {
            $group: {
              _id: '$packageInfo.postType',
              count: { $sum: 1 }
            }
          }
        ]);

        const usedCountMap = new Map();
        postTypeCounts.forEach(item => {
          if (item._id) {
            usedCountMap.set(item._id.toString(), item.count);
          }
        });

        // Tạo hoặc cập nhật currentPackagePlan.propertiesLimits
        const propertiesLimits = packagePlan.propertiesLimits.map(limit => ({
          packageType: limit.packageType._id,
          limit: limit.limit,
          used: usedCountMap.get(limit.packageType._id.toString()) || 0
        }));

        await User.findByIdAndUpdate(userId, {
          $set: {
            'currentPackagePlan.propertiesLimits': propertiesLimits
          }
        });

        // Cập nhật user object trong memory
        if (!user.currentPackagePlan) {
          user.currentPackagePlan = {};
        }
        user.currentPackagePlan.propertiesLimits = propertiesLimits;

        console.log('Synced propertiesLimits for user:', userId, propertiesLimits);
      }

      // Xây dựng danh sách loại tin có sẵn với remainingCount
      const availablePostTypes = packagePlan.propertiesLimits.map(limit => {
        let usedCount = 0;

        // Luôn ưu tiên lấy usedCount từ currentPackagePlan.propertiesLimits (cả gói trial và trả phí)
        if (user.currentPackagePlan && user.currentPackagePlan.propertiesLimits) {
          const userLimit = user.currentPackagePlan.propertiesLimits.find(
            userLimit => userLimit.packageType.toString() === limit.packageType._id.toString()
          );
          if (userLimit) {
            usedCount = userLimit.used || 0;
          } else {
            // Nếu không có trong currentPackagePlan, tức là chưa từng đăng tin loại này
            usedCount = 0;
          }
        } else {
          // Nếu không có currentPackagePlan, khởi tạo với used = 0
          usedCount = 0;
        }

        const remainingCount = Math.max(0, limit.limit - usedCount);

        return {
          postType: {
            _id: limit.packageType._id,
            name: limit.packageType.name,
            displayName: limit.packageType.displayName,
            color: limit.packageType.color,
            priority: limit.packageType.priority,
            description: limit.packageType.description,
            stars: limit.packageType.stars
          },
          totalLimit: limit.limit,
          usedCount: usedCount,
          remainingCount: remainingCount,
          available: remainingCount > 0
        };
      }).sort((a, b) => (a.postType.priority || 999) - (b.postType.priority || 999));

      res.json({
        success: true,
        message: 'Lấy danh sách loại tin thành công',
        data: availablePostTypes
      });

    } catch (error) {
      console.error('Error in getAvailablePostTypes:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy danh sách loại tin',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Lỗi server'
      });
    }
  },

  // Kiểm tra xem có thể đăng loại tin này không
  canPostType: async (req, res) => {
    try {
      const userId = req.user.userId;
      const { postTypeId } = req.params;

      // Lấy thông tin user
      const user = await User.findById(userId).lean();
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thông tin user'
        });
      }

      // Đếm số tin đã đăng của user theo từng loại
      const userPropertiesCount = await Property.countDocuments({
        owner: userId,
        isDeleted: { $ne: true }
      });

      let canPost = false;
      let reason = '';
      let remainingPosts = 0;

      // Kiểm tra gói hiện tại
      if (user.currentPackagePlan && user.currentPackagePlan.isActive) {
        const packagePlan = await PackagePlan.findById(user.currentPackagePlan.packagePlanId)
          .populate('propertiesLimits.packageType')
          .lean();

        if (packagePlan) {
          const postTypeLimit = packagePlan.propertiesLimits.find(
            limit => limit.packageType._id.toString() === postTypeId
          );

          if (postTypeLimit) {
            // TODO: Đếm số tin đã đăng theo từng loại cụ thể
            remainingPosts = postTypeLimit.limit;
            canPost = remainingPosts > 0;
            reason = canPost ? '' : `Đã đạt giới hạn ${postTypeLimit.limit} tin cho loại này`;
          } else {
            reason = 'Loại tin không có trong gói hiện tại';
          }
        }
      } else {
        // Kiểm tra gói trial
        const trialPackage = await PackagePlan.findOne({
          type: 'trial',
          isActive: true
        })
          .populate('propertiesLimits.packageType')
          .lean();

        if (trialPackage) {
          const totalTrialLimit = trialPackage.propertiesLimits.reduce((sum, limit) => sum + limit.limit, 0);
          const postTypeLimit = trialPackage.propertiesLimits.find(
            limit => limit.packageType._id.toString() === postTypeId
          );

          if (postTypeLimit && userPropertiesCount < totalTrialLimit) {
            remainingPosts = totalTrialLimit - userPropertiesCount;
            canPost = remainingPosts > 0;
            reason = canPost ? '' : 'Đã hết lượt đăng tin miễn phí';
          } else if (!postTypeLimit) {
            reason = 'Loại tin không có trong gói dùng thử';
          } else {
            reason = 'Đã hết lượt đăng tin miễn phí';
          }
        }
      }

      res.json({
        success: true,
        message: 'Kiểm tra quyền đăng tin thành công',
        data: {
          canPost,
          reason,
          remainingPosts,
          totalPosts: userPropertiesCount
        }
      });

    } catch (error) {
      console.error('Error in canPostType:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi kiểm tra quyền đăng tin',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Lỗi server'
      });
    }
  },

  // Lấy danh sách gói đề xuất
  getRecommendedPackages: async (req, res) => {
    try {
      const userId = req.user.userId;

      // Lấy thông tin user
      const user = await User.findById(userId).lean();
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thông tin user'
        });
      }

      // Đếm số tin đã đăng
      const userPropertiesCount = await Property.countDocuments({
        owner: userId,
        isDeleted: { $ne: true }
      });

      // Lấy danh sách gói có sẵn
      const availablePackages = await PackagePlan.find({
        isActive: true,
        type: { $ne: 'trial' } // Loại trừ gói trial
      })
        .populate('propertiesLimits.packageType', 'name displayName color priority description stars')
        .sort({ price: 1 })
        .lean();

      // Đề xuất dựa trên số tin đã đăng
      let recommendedPackages = [];

      if (userPropertiesCount <= 3) {
        // User mới, đề xuất gói basic
        recommendedPackages = availablePackages.filter(pkg => pkg.type === 'basic').slice(0, 2);
      } else if (userPropertiesCount <= 10) {
        // User trung bình, đề xuất gói vip
        recommendedPackages = availablePackages.filter(pkg => ['basic', 'vip'].includes(pkg.type)).slice(0, 2);
      } else {
        // Power user, đề xuất gói premium
        recommendedPackages = availablePackages.filter(pkg => ['vip', 'premium'].includes(pkg.type)).slice(0, 2);
      }

      // Format dữ liệu
      const formattedPackages = recommendedPackages.map(pkg => ({
        _id: pkg._id,
        name: pkg.name,
        type: pkg.type,
        displayName: pkg.displayName,
        description: pkg.description,
        price: pkg.price,
        duration: pkg.duration,
        durationUnit: pkg.durationUnit,
        freePushCount: pkg.freePushCount,
        propertiesLimits: pkg.propertiesLimits.map(limit => ({
          packageType: {
            _id: limit.packageType._id,
            name: limit.packageType.name,
            displayName: limit.packageType.displayName,
            color: limit.packageType.color,
            priority: limit.packageType.priority,
            description: limit.packageType.description,
            stars: limit.packageType.stars
          },
          limit: limit.limit,
          _id: limit._id
        })),
        totalPosts: pkg.propertiesLimits.reduce((sum, limit) => sum + limit.limit, 0),
        pricePerPost: pkg.propertiesLimits.reduce((sum, limit) => sum + limit.limit, 0) > 0
          ? Math.round(pkg.price / pkg.propertiesLimits.reduce((sum, limit) => sum + limit.limit, 0))
          : pkg.price,
        recommended: true
      }));

      res.json({
        success: true,
        message: 'Lấy danh sách gói đề xuất thành công',
        data: {
          packages: formattedPackages,
          userStats: {
            totalPosts: userPropertiesCount,
            recommendationReason: userPropertiesCount <= 3
              ? 'Phù hợp cho người mới bắt đầu'
              : userPropertiesCount <= 10
                ? 'Phù hợp cho nhu cầu trung bình'
                : 'Phù hợp cho người dùng chuyên nghiệp'
          }
        }
      });

    } catch (error) {
      console.error('Error in getRecommendedPackages:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy danh sách gói đề xuất',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Lỗi server'
      });
    }
  },

  // TEST: Kiểm tra trạng thái gói và properties
  testPackageStatus: async (req, res) => {
    try {
      const userId = req.user.userId;

      // Lấy thông tin user và gói hiện tại
      const user = await User.findById(userId).lean();

      // Đếm properties theo trạng thái
      const propertiesStats = await Property.aggregate([
        { $match: { owner: userId } },
        {
          $group: {
            _id: {
              packageInfoIsActive: '$packageInfo.isActive',
              packageInfoStatus: '$packageInfo.status'
            },
            count: { $sum: 1 },
            properties: { $push: { _id: '$_id', title: '$title' } }
          }
        }
      ]);

      // Kiểm tra logic ẩn/hiện trong getMyApprovedProperties
      const now = new Date();
      const hiddenQuery = {
        owner: userId,
        approvalStatus: 'approved',
        status: { $ne: 'inactive' },
        isDeleted: { $ne: true },
        $or: [
          {
            $and: [
              { 'packageInfo.expiryDate': { $exists: true } },
              { 'packageInfo.expiryDate': { $ne: null } },
              { 'packageInfo.expiryDate': { $lte: now } }
            ]
          }, // Gói đã hết hạn theo thời gian
          {
            $and: [
              { 'packageInfo.isActive': { $exists: true } },
              { 'packageInfo.isActive': false }
            ]
          } // Gói không active
        ]
      };

      const hiddenProperties = await Property.find(hiddenQuery).select('_id title packageInfo');

      res.json({
        success: true,
        message: 'Kiểm tra trạng thái gói thành công',
        data: {
          userPackageType: user?.packageType,
          currentPackageActive: user?.currentPackagePlan?.isActive,
          currentPackageExpiry: user?.currentPackagePlan?.expiryDate,
          propertiesStats,
          hiddenPropertiesCount: hiddenProperties.length,
          hiddenProperties: hiddenProperties.map(p => ({
            _id: p._id,
            title: p.title,
            packageInfoActive: p.packageInfo?.isActive,
            packageInfoStatus: p.packageInfo?.status,
            packageInfoExpiry: p.packageInfo?.expiryDate
          }))
        }
      });

    } catch (error) {
      console.error('Error in testPackageStatus:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi kiểm tra trạng thái gói',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Lỗi server'
      });
    }
  },

  // Lấy danh sách properties của user cho migration
  getPropertiesForMigration: async (req, res) => {
    try {
      const userId = req.user.userId;

      // Lấy properties đã approved của user hiện tại có package info
      const properties = await Property.find({
        owner: userId,
        approvalStatus: 'approved',
        isDeleted: { $ne: true },
        'packageInfo.isActive': true, // Chỉ lấy properties có package active
        'packageInfo.postType': { $exists: true }
      })
        .populate('packageInfo.postType', 'name displayName color priority stars')
        .select('_id title rentPrice area images packageInfo createdAt province ward detailAddress')
        .sort({ createdAt: -1 })
        .lean();
      

      // Schema mới không cần load provinces nữa

      // Transform data for frontend
      const transformedProperties = properties.map(property => ({
        _id: property._id,
        title: property.title,
        rentPrice: property.rentPrice,
        area: property.area,
        images: property.images || [],
        packageInfo: {
          postType: property.packageInfo?.postType ? {
            _id: property.packageInfo.postType._id,
            name: property.packageInfo.postType.name,
            displayName: property.packageInfo.postType.displayName,
            color: property.packageInfo.postType.color,
            priority: property.packageInfo.postType.priority,
            stars: property.packageInfo.postType.stars
          } : null,
          expiryDate: property.packageInfo?.expiryDate,
          isActive: property.packageInfo?.isActive
        },
        province: property.province,
        ward: property.ward,
        detailAddress: property.detailAddress,
        createdAt: property.createdAt
      }));
      console.log(`Fetched ${transformedProperties.length} properties for migration for user ${userId}`);

      res.json({
        success: true,
        message: 'Lấy danh sách tin đăng cho migration thành công',
        data: {
          properties: transformedProperties,
          count: transformedProperties.length
        }
      });

    } catch (error) {
      console.error('Error in getPropertiesForMigration:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy danh sách tin đăng cho migration',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

};

export default myPropertiesController;