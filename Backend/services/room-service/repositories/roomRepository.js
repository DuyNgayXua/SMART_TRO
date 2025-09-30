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
                .populate('tenants', 'fullName email phone')
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
                .populate('tenants', 'fullName')
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
                .populate('tenants', 'fullName')
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
            if (filter.owner) match.owner = new mongoose.Types.ObjectId(filter.owner);

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

    async transferRoom(fromRoomId, toRoomId, userId) {
        const session = await mongoose.startSession();
        
        try {
            const result = await session.withTransaction(async () => {
                // Import models
                const Contract = (await import('../../../schemas/Contract.js')).default;
                const Tenant = (await import('../../../schemas/Tenant.js')).default;
                
                // 1. Lấy thông tin phòng nguồn và đích
                const fromRoom = await Room.findById(fromRoomId).session(session);
                const toRoom = await Room.findById(toRoomId).session(session);
                
                if (!fromRoom || !toRoom) {
                    throw new Error('Không tìm thấy phòng');
                }

                // 2. Tìm hợp đồng thuê hiện tại của phòng nguồn
                const currentContract = await Contract.findOne({
                    room: fromRoomId,
                    status: 'active'
                }).populate('tenants').session(session);

                if (!currentContract) {
                    throw new Error('Không tìm thấy hợp đồng thuê hiện tại cho phòng nguồn');
                }

                // 3. Cập nhật hợp đồng - chuyển sang phòng mới
                currentContract.room = toRoomId;
                
                // Thêm lịch sử chuyển phòng vào hợp đồng
                if (!currentContract.transferHistory) {
                    currentContract.transferHistory = [];
                }
                
                currentContract.transferHistory.push({
                    fromRoom: fromRoomId,
                    toRoom: toRoomId,
                    transferDate: new Date(),
                    transferBy: userId,
                    reason: 'Room transfer'
                });

                await currentContract.save({ session });

                // 4. Cập nhật thông tin phòng cho tất cả tenant
                if (currentContract.tenants && currentContract.tenants.length > 0) {
                    const transferNote = `Chuyển từ phòng ${fromRoom.roomNumber} sang phòng ${toRoom.roomNumber} vào ${new Date().toLocaleDateString('vi-VN')}`;
                    
                    // Lấy thông tin tenants hiện tại để lấy notes cũ
                    const tenants = await Tenant.find({ 
                        _id: { $in: currentContract.tenants.map(t => t._id || t) } 
                    }, 'notes').session(session);

                    // Cập nhật từng tenant với updateOne để tránh validation issues
                    for (const tenant of tenants) {
                        const newNotes = tenant.notes 
                            ? `${tenant.notes}\n${transferNote}`
                            : transferNote;
                        
                        await Tenant.updateOne(
                            { _id: tenant._id },
                            { 
                                room: toRoomId,
                                notes: newNotes
                            }
                        ).session(session);
                    }
                }

                // 5. Cập nhật trạng thái phòng
                // Phòng cũ về available
                fromRoom.status = 'available';
                fromRoom.tenants = [];
                fromRoom.statusHistory.push({
                    status: 'available',
                    changedAt: new Date(),
                    note: `Tenant chuyển sang phòng ${toRoom.roomNumber}`,
                    changedBy: userId
                });

                // Phòng mới thành rented
                toRoom.status = 'rented';
                toRoom.tenants = currentContract.tenants.map(t => t._id || t);
                toRoom.statusHistory.push({
                    status: 'rented',
                    changedAt: new Date(),
                    note: `Tenant chuyển từ phòng ${fromRoom.roomNumber}`,
                    changedBy: userId
                });

                // Lưu cả hai phòng
                await fromRoom.save({ session });
                await toRoom.save({ session });

                return {
                    fromRoom: {
                        id: fromRoom._id,
                        roomNumber: fromRoom.roomNumber,
                        status: fromRoom.status
                    },
                    toRoom: {
                        id: toRoom._id,
                        roomNumber: toRoom.roomNumber,
                        status: toRoom.status
                    },
                    contract: {
                        id: currentContract._id,
                        room: currentContract.room
                    },
                    transferDate: new Date()
                };
            });

            return result;
            
        } catch (error) {
            throw new Error('Error transferring room: ' + error.message);
        } finally {
            await session.endSession();
        }
    }
}

export default new RoomRepository();
