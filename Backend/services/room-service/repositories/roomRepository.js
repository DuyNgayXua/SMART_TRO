/**
 * Room Repository - Tương tác DB cho phòng
 */
import { Room, Property, User } from '../../../schemas/index.js';
import mongoose from 'mongoose';

class RoomRepository {
    async create(data) {
        try {
            const room = new Room(data);
            return await room.save();
        } catch (error) {
            throw new Error('Error creating room: ' + error.message);
        }
    }

    async findById(id) {
        try {
            return await Room.findById(id)
                .populate('property', 'title address owner')
                .populate('tenant', 'fullName email phone')
                .populate('amenities', 'name icon');
        } catch (error) {
            throw new Error('Error finding room by id: ' + error.message);
        }
    }

    async search(filter = {}) {
        try {
            const {
                page = 1,
                limit = 12,
                status,
                property,
                minPrice,
                maxPrice,
                roomType,
                search,
                owner
            } = filter;

            const query = {};
            if (status) query.status = status;
            if (property) query.property = property;
            if (owner) query.owner = owner;
            if (roomType) query.roomType = roomType;
            if (minPrice || maxPrice) {
                query.price = {};
                if (minPrice) query.price.$gte = Number(minPrice);
                if (maxPrice) query.price.$lte = Number(maxPrice);
            }
            if (search) {
                query.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { roomNumber: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            const skip = (page - 1) * limit;
            const rooms = await Room.find(query)
                .skip(skip)
                .limit(parseInt(limit))
                .sort({ createdAt: -1 })
                .populate('property', 'title address')
                .populate('tenant', 'fullName')
                .populate('amenities', 'name icon');
            const total = await Room.countDocuments(query);
            return {
                rooms,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw new Error('Error searching rooms: ' + error.message);
        }
    }

    async update(id, data) {
        try {
            return await Room.findByIdAndUpdate(id, data, { new: true, runValidators: true })
                .populate('property', 'title address')
                .populate('tenant', 'fullName')
                .populate('amenities', 'name icon');
        } catch (error) {
            throw new Error('Error updating room: ' + error.message);
        }
    }

    async delete(id) {
        try {
            return await Room.findByIdAndDelete(id);
        } catch (error) {
            throw new Error('Error deleting room: ' + error.message);
        }
    }

    async updateStatus(id, status, userId, note='') {
        try {
            const room = await Room.findById(id);
            if (!room) return null;
            room.status = status;
            room.statusHistory.push({ status, note, changedBy: userId });
            return await room.save();
        } catch (error) {
            throw new Error('Error updating room status: ' + error.message);
        }
    }

    async addImages(id, imageUrls = []) {
        try {
            const room = await Room.findById(id);
            if (!room) return null;
            room.images.push(...imageUrls);
            return await room.save();
        } catch (error) {
            throw new Error('Error adding images: ' + error.message);
        }
    }

    async removeImage(id, imageUrl) {
        try {
            const room = await Room.findById(id);
            if (!room) return null;
            room.images = room.images.filter(img => img !== imageUrl);
            return await room.save();
        } catch (error) {
            throw new Error('Error removing image: ' + error.message);
        }
    }

    async statistics(filter = {}) {
        try {
            const match = {};
            if (filter.property) match.property = new mongoose.Types.ObjectId(filter.property);

            const pipeline = [
                { $match: match },
                { $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalArea: { $sum: { $ifNull: ['$area', 0] } },
                    totalPrice: { $sum: { $ifNull: ['$price', 0] } }
                }}
            ];
            const data = await Room.aggregate(pipeline);
            const summary = data && Array.isArray(data) 
                ? data.reduce((acc, cur) => ({
                    ...acc,
                    [cur._id]: cur
                }), {})
                : {};
            return summary;
        } catch (error) {
            throw new Error('Error getting statistics: ' + error.message);
        }
    }

    async exists(filter) {
        try {
            return await Room.exists(filter);
        } catch (error) {
            throw new Error('Error checking existence: ' + error.message);
        }
    }
}

export default new RoomRepository();
