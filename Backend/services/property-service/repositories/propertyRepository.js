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
                .populate('owner', 'fullName email phone')
                .populate('amenities', 'name key icon category')
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
                .populate('owner', 'fullName email phone')
                .populate('amenities', 'name key icon category')
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
            ).populate('owner', 'fullName email phone')
             .populate('amenities', 'name key icon category');
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
}

export default new PropertyRepository();
