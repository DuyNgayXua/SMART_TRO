import Property from '../../../schemas/Property.js';
import Comment from '../../../schemas/Comment.js';
import mongoose from 'mongoose';
import { fetchProvinces, fetchDistricts, fetchWards } from "../../shared/utils/locationService.js";

const searchController = {
  // Tìm kiếm properties theo nhiều tiêu chí
  searchProperties: async (req, res) => {
    try {
      // console.log('Search params:', req.query);

      // Pagination params
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 12;
      const skip = (page - 1) * limit;

      // Search params từ query string
      const {
        search,
        provinceId,
        districtId,
        category,
        minPrice,
        maxPrice,
        minArea,
        maxArea,
        amenities,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;
      console.log('Search parameters:', req.query);

      // Build query object
      let query = {
        approvalStatus: 'approved',
        status: 'available',
        isDeleted: { $ne: true }
      };

      // Text search - tìm trong title và description
      if (search && search.trim()) {
        query.$or = [
          { title: { $regex: search.trim(), $options: 'i' } },
          { description: { $regex: search.trim(), $options: 'i' } },
          { detailAddress: { $regex: search.trim(), $options: 'i' } }
        ];
      }

      // Location filters
      if (provinceId) {
        query.province = provinceId;
      }

      if (districtId) {
        query.district = districtId;
      }

      // Category filter
      if (category) {
        query.category = category;
      }

      // Price range filter
      if (minPrice || maxPrice) {
        query.rentPrice = {};
        if (minPrice) {
          query.rentPrice.$gte = parseInt(minPrice);
        }
        if (maxPrice) {
          query.rentPrice.$lte = parseInt(maxPrice);
        }
      }

      // Area range filter
      if (minArea || maxArea) {
        query.area = {};
        if (minArea) {
          query.area.$gte = parseInt(minArea);
        }
        if (maxArea) {
          query.area.$lte = parseInt(maxArea);
        }
      }

      // Amenities filter
      if (amenities) {
        const amenitiesArray = amenities.split(',').filter(id => id.trim());
        if (amenitiesArray.length > 0) {
          query.amenities = {
            $in: amenitiesArray.map(id => new mongoose.Types.ObjectId(id))
          };
        }
      }

      // console.log('Final query:', JSON.stringify(query, null, 2));

      // Build sort object - Ưu tiên approvedAt nếu có, fallback về createdAt
      let properties, total, provinces;

      if (sortBy === 'createdAt') {
        // Sắp xếp theo thời gian: promoted first, sau đó approvedAt nếu có, fallback về createdAt
        // Sử dụng aggregation pipeline để handle logic: approvedAt nếu có, fallback về createdAt
        [properties, total, provinces] = await Promise.all([
          Property.aggregate([
            { $match: query },
            {
              $addFields: {
                // Tạo field tạm để sort: dùng approvedAt nếu có, không thì dùng createdAt
                sortDate: {
                  $ifNull: ['$approvedAt', '$createdAt']
                }
              }
            },
            {
              $sort: {
                promotedAt: -1, // Promoted first
                sortDate: sortOrder === 'asc' ? 1 : -1 // Then by sortDate
              }
            },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'users',
                localField: 'owner',
                foreignField: '_id',
                as: 'owner',
                pipeline: [{ $project: { fullName: 1, email: 1, phone: 1, avatar: 1 } }]
              }
            },
            {
              $lookup: {
                from: 'amenities',
                localField: 'amenities',
                foreignField: '_id',
                as: 'amenities',
                pipeline: [{ $project: { name: 1, icon: 1 } }]
              }
            },
            {
              $addFields: {
                owner: { $arrayElemAt: ['$owner', 0] }
              }
            }
          ]),
          Property.countDocuments(query),
          fetchProvinces()
        ]);
      } else {
        // Các sort khác sử dụng find bình thường
        const sortObj = {};

        if (sortBy === 'price' || sortBy === 'rentPrice') {
          // Sắp xếp theo giá thuần túy, không ưu tiên promoted
          sortObj.rentPrice = sortOrder === 'asc' ? 1 : -1;
        } else if (sortBy === 'area') {
          // Sắp xếp theo diện tích thuần túy, không ưu tiên promoted
          sortObj.area = sortOrder === 'asc' ? 1 : -1;
        } else if (sortBy === 'views') {
          // Sắp xếp theo lượt xem thuần túy, không ưu tiên promoted
          sortObj.views = sortOrder === 'asc' ? 1 : -1;
        } else {
          sortObj.promotedAt = -1; // Always promoted first
          sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;
        }

        // Execute search với find bình thường
        [properties, total, provinces] = await Promise.all([
          Property.find(query)
            .sort(sortObj)
            .skip(skip)
            .limit(limit)
            .populate('owner', 'fullName email phone avatar')
            .populate('amenities', 'name icon')
            .lean(),
          Property.countDocuments(query),
          fetchProvinces()
        ]);
      }

      // console.log(`Found ${total} properties matching criteria`);

      // Map tỉnh
      const provinceMap = new Map(provinces.map(p => [String(p.code), p.name]));

      // Lấy districts & wards theo properties tìm được
      const districtMap = new Map();
      const wardMap = new Map();

      for (const property of properties) {
        if (property.province && !districtMap.has(property.district)) {
          try {
            const districts = await fetchDistricts(property.province);
            districts.forEach(d => districtMap.set(String(d.code), d.name));
          } catch (error) {
            console.error('Error fetching districts for province:', property.province, error);
          }
        }
        if (property.district && !wardMap.has(property.ward)) {
          try {
            const wards = await fetchWards(property.district);
            wards.forEach(w => wardMap.set(String(w.code), w.name));
          } catch (error) {
            console.error('Error fetching wards for district:', property.district, error);
          }
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

      // Transform data for frontend
      const transformedProperties = properties.map(property => ({
        _id: property._id,
        title: property.title,
        category: property.category,
        rentPrice: property.rentPrice,
        promotionPrice: property.promotionPrice,
        area: property.area,
        images: property.images,
        video: property.video,
        approvalStatus: property.approvalStatus,
        status: property.status,
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
        views: property.views || 0,
        favorites: property.stats?.favorites || 0,
        comments: commentsCountMap.get(property._id.toString()) || 0,
        createdAt: property.createdAt,
        updatedAt: property.updatedAt
      }));

      const totalPages = Math.ceil(total / limit);

      // Build response with search metadata
      const response = {
        success: true,
        message: total > 0 ? `Tìm thấy ${total} kết quả` : 'Không tìm thấy kết quả nào',
        data: {
          properties: transformedProperties,
          pagination: {
            page,
            limit,
            total,
            totalPages
          },
          searchCriteria: {
            search: search || '',
            provinceId: provinceId || '',
            districtId: districtId || '',
            category: category || '',
            priceRange: {
              min: minPrice ? parseInt(minPrice) : null,
              max: maxPrice ? parseInt(maxPrice) : null
            },
            areaRange: {
              min: minArea ? parseInt(minArea) : null,
              max: maxArea ? parseInt(maxArea) : null
            },
            amenities: amenities ? amenities.split(',') : [],
            sortBy,
            sortOrder
          }
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error in searchProperties:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi tìm kiếm',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Get search suggestions (auto-complete)
  getSearchSuggestions: async (req, res) => {
    try {
      const { q } = req.query;

      if (!q || q.trim().length < 2) {
        return res.json({
          success: true,
          data: []
        });
      }

      const searchTerm = q.trim();

      // Tìm suggestions từ title và địa chỉ
      const suggestions = await Property.aggregate([
        {
          $match: {
            approvalStatus: 'approved',
            status: 'available',
            isDeleted: { $ne: true },
            $or: [
              { title: { $regex: searchTerm, $options: 'i' } },
              { detailAddress: { $regex: searchTerm, $options: 'i' } }
            ]
          }
        },
        {
          $project: {
            title: 1,
            detailAddress: 1,
            rentPrice: 1
          }
        },
        {
          $limit: 10
        }
      ]);

      const transformedSuggestions = suggestions.map(item => ({
        _id: item._id,
        text: item.title,
        type: 'property',
        address: item.detailAddress,
        price: item.rentPrice
      }));

      res.json({
        success: true,
        data: transformedSuggestions
      });

    } catch (error) {
      console.error('Error in getSearchSuggestions:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy gợi ý tìm kiếm',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};

export default searchController;
