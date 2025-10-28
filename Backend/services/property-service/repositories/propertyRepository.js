/**
 * Property Repository - Tương tác với database
 */
import { Property } from '../../../schemas/index.js';

class PropertyRepository {
    // Tạo property mới
    async create(propertyData) {
        try {
            const property = new Property(propertyData);
            return await property.save();
        } catch (error) {
            throw new Error(`Error creating property: ${error.message}`);
        }
    }

    // Lấy property theo ID
    async findById(id) {
        try {
            return await Property.findById(id)
                .populate('owner', 'fullName email phone avatar')
                .populate('amenities', 'name key icon category')
                .populate('packageInfo.plan', 'name displayName type priority color stars')
                .populate('packageInfo.postType', 'name displayName color priority description stars textStyle')
                .exec();
        } catch (error) {
            throw new Error(`Error finding property by ID: ${error.message}`);
        }
    }

    // Lấy properties theo owner
    async findByOwner(ownerId, options = {}) {
        try {
            const { page = 1, limit = 10, status } = options;
            
            const query = { owner: ownerId };
            if (status) query.status = status;

            const skip = (page - 1) * limit;
            
            const properties = await Property.find(query)
                .skip(skip)
                .limit(parseInt(limit))
                .sort({ createdAt: -1 })
                .populate('owner', 'fullName email phone avatar')
                .populate('amenities', 'name key icon category')
                .populate('packageInfo.plan', 'name displayName type priority color stars')
                .populate('packageInfo.postType', 'name displayName color priority description stars textStyle')
                .exec();

            const total = await Property.countDocuments(query);

            return {
                properties,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw new Error(`Error finding properties by owner: ${error.message}`);
        }
    }

    // Tìm kiếm properties
    async search(criteria = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                type,
                status = 'available',
                minPrice,
                maxPrice,
                province,
                district,
                ward,
                amenities,
                bedrooms,
                bathrooms,
                search
            } = criteria;

            const query = { status };

            // Filter theo type
            if (type) query.type = type;

            // Filter theo giá
            if (minPrice || maxPrice) {
                query['price.monthly'] = {};
                if (minPrice) query['price.monthly'].$gte = parseInt(minPrice);
                if (maxPrice) query['price.monthly'].$lte = parseInt(maxPrice);
            }

            // Filter theo địa chỉ
            if (province) query['address.province'] = new RegExp(province, 'i');
            if (district) query['address.district'] = new RegExp(district, 'i');
            if (ward) query['address.ward'] = new RegExp(ward, 'i');

            // Filter theo tiện ích
            if (amenities && amenities.length > 0) {
                query.amenities = { $in: amenities };
            }

            // Filter theo số phòng
            if (bedrooms) query.bedrooms = parseInt(bedrooms);
            if (bathrooms) query.bathrooms = parseInt(bathrooms);

            // Text search
            if (search) {
                query.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } },
                    { 'address.street': { $regex: search, $options: 'i' } }
                ];
            }

            const skip = (page - 1) * limit;
            
            const properties = await Property.find(query)
                .skip(skip)
                .limit(parseInt(limit))
                .sort({ createdAt: -1 })
                .populate('owner', 'fullName phone')
                .populate('amenities', 'name key icon category')
                .populate('packageInfo.plan', 'name displayName type priority color stars')
                .populate('packageInfo.postType', 'name displayName color priority description stars textStyle')
                .exec();

            const total = await Property.countDocuments(query);

            return {
                properties,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw new Error(`Error searching properties: ${error.message}`);
        }
    }

    // Cập nhật property
    async update(id, updateData) {
        try {
            return await Property.findByIdAndUpdate(
                id,
                updateData,
                { new: true, runValidators: true }
            ).populate('owner', 'fullName email phone avatar')
             .populate('amenities', 'name key icon category')
             .populate('packageInfo.plan', 'name displayName type priority color stars')
             .populate('packageInfo.postType', 'name displayName color priority description stars textStyle');
        } catch (error) {
            throw new Error(`Error updating property: ${error.message}`);
        }
    }

    // Xóa property
    async delete(id) {
        try {
            return await Property.findByIdAndDelete(id);
        } catch (error) {
            throw new Error(`Error deleting property: ${error.message}`);
        }
    }

    // Tăng view count
    async incrementViews(id) {
        try {
            return await Property.findByIdAndUpdate(
                id,
                { $inc: { views: 1 } },
                { new: true }
            );
        } catch (error) {
            throw new Error(`Error incrementing views: ${error.message}`);
        }
    }

    // Cập nhật rating
    async updateRating(id, rating) {
        try {
            const property = await Property.findById(id);
            if (!property) {
                throw new Error('Property not found');
            }

            const totalRating = property.rating.average * property.rating.count + rating;
            const newCount = property.rating.count + 1;
            const newAverage = totalRating / newCount;

            return await Property.findByIdAndUpdate(
                id,
                {
                    'rating.average': newAverage,
                    'rating.count': newCount
                },
                { new: true }
            );
        } catch (error) {
            throw new Error(`Error updating rating: ${error.message}`);
        }
    }

    // Find user rating for a property
    async findUserRating(propertyId, userId) {
        try {
            // Since we don't have a separate Rating model yet, 
            // we'll return null for now (user can always rate)
            return null;
        } catch (error) {
            throw new Error(`Error finding user rating: ${error.message}`);
        }
    }

    // Create a rating
    async createRating(ratingData) {
        try {
            // For now, we'll just update the property's rating average
            // In a real app, you'd want a separate Rating collection
            const { propertyId, rating } = ratingData;
            
            await this.updateRating(propertyId, rating);
            
            return {
                ...ratingData,
                id: Date.now().toString() // Temporary ID
            };
        } catch (error) {
            throw new Error(`Error creating rating: ${error.message}`);
        }
    }

    // Lấy property theo ID với thông tin đầy đủ cho trang chi tiết
    async getPropertyById(id) {
        try {
            const property = await Property.findById(id)
                .populate('owner', 'fullName email phone avatar role')
                .populate('amenities', 'name key icon category')
                .populate('packageInfo.plan', 'name displayName type priority color stars')
                .populate('packageInfo.postType', 'name displayName color priority description stars textStyle')
                .exec();

            if (property && property.owner) {
                // Đếm tổng số bài đăng của chủ trọ
                const propertyCount = await Property.countDocuments({
                    owner: property.owner._id,
                    approvalStatus: 'approved',
                    isDeleted: { $ne: true }
                });

                // Chuyển property thành plain object và thêm propertyCount . 
                const propertyObj = property.toObject();
                propertyObj.owner.propertyCount = propertyCount;
                return propertyObj;
            }
            
          
            return property;
        } catch (error) {
            throw new Error(`Error getting property by ID: ${error.message}`);
        }
    }

    // Tăng lượt xem
    async incrementViews(id) {
        try {
            return await Property.findByIdAndUpdate(
                id,
                { $inc: { views: 1 } },
                { new: true }
            );
        } catch (error) {
            throw new Error(`Error incrementing views: ${error.message}`);
        }
    }

    // Lấy properties liên quan (cùng khu vực hoặc giá tương tự)
    async getRelatedProperties(currentProperty, limit = 6) {
        try {
            const query = {
                _id: { $ne: currentProperty._id }, // Loại trừ property hiện tại
                status: 'available',
                $or: [
                    // Cùng quận/huyện
                    { 'location.district': currentProperty.location.district },
                    // Giá tương tự (±30%)
                    {
                        price: {
                            $gte: currentProperty.price * 0.7,
                            $lte: currentProperty.price * 1.3
                        }
                    }
                ]
            };

            return await Property.find(query)
                .limit(limit)
                .sort({ createdAt: -1, views: -1 })
                .populate('owner', 'fullName phone')
                .populate('amenities', 'name key')
                .populate('packageInfo.plan', 'name displayName type priority color stars')
                .populate('packageInfo.postType', 'name displayName color priority description stars textStyle')
                .select('title price images location area views createdAt packageInfo')
                .exec();
        } catch (error) {
            throw new Error(`Error getting related properties: ${error.message}`);
        }
    }

    // Lấy properties nổi bật (premium hoặc có lượt xem cao)
    async getFeaturedProperties(limit = 5) {
        try {
            return await Property.find({
                status: 'available',
                $or: [
                    { isPremium: true },
                    { views: { $gte: 100 } }
                ]
            })
                .limit(limit)
                .sort({ isPremium: -1, views: -1, createdAt: -1 })
                .populate('owner', 'fullName phone')
                .populate('packageInfo.plan', 'name displayName type priority color stars')
                .populate('packageInfo.postType', 'name displayName color priority description stars textStyle')
                .select('title price images location area views isPremium packageInfo')
                .exec();
        } catch (error) {
            throw new Error(`Error getting featured properties: ${error.message}`);
        }
    }

    // Count user properties (kept for other purposes)
    async countUserProperties(userId) {
        try {
            return await Property.countDocuments({ 
                owner: userId
                // Count all posts (including deleted) for statistics
            });
        } catch (error) {
            throw new Error(`Error counting user properties: ${error.message}`);
        }
    }
}

export default new PropertyRepository();