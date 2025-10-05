/**
 * Room Controller - Xử lý logic nghiệp vụ cho phòng
 */
import roomRepository from '../repositories/roomRepository.js';
import cloudinary from '../../../config/cloudinary.js';
// Helper: extract public_id from Cloudinary URL
function extractPublicId(url) {
    if (!url) return null;
    try {
        // URL pattern: https://res.cloudinary.com/<cloud>/image/upload/v<version>/<folder>/<filename>.<ext>
        const parts = url.split('/');
        const uploadIndex = parts.findIndex(p => p === 'upload');
        if (uploadIndex === -1) return null;
        const publicPathParts = parts.slice(uploadIndex + 2); // skip version element (e.g., v1712345678)
        const last = publicPathParts.join('/');
        const noExt = last.replace(/\.[a-zA-Z0-9]+$/, '');
        return noExt; // includes folder path
    } catch { return null; }
}

class RoomController {
    // Tạo phòng mới
    async createRoom(req, res) {
        try {
            const data = { ...req.body };        
            const changedBy = req.user?.userId || null;
            // Gán owner nếu chưa có: ưu tiên user hiện tại nếu role landlord/admin và có userId; fallback ENV DEFAULT_LANDLORD_ID
            if (!data.owner) {
                if (req.user?.userId) {
                    data.owner = req.user.userId;
                } else if (process.env.DEFAULT_LANDLORD_ID) {
                    data.owner = process.env.DEFAULT_LANDLORD_ID;
                }
            }
            data.statusHistory = [{ status: 'available', changedBy, note: 'Khởi tạo' }];
            const room = await roomRepository.create(data);
            res.status(201).json({ success: true, message: 'Tạo phòng thành công', data: room });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
        }
    }

    // Kiểm tra roomNumber đã tồn tại
    async checkRoomNumber(req, res) {
        try {
            const { roomNumber, excludeId } = req.query;
            if (!roomNumber) return res.status(400).json({ success: false, message: 'roomNumber là bắt buộc' });
            
            const query = { 
                roomNumber,
                owner: req.user.userId // Chỉ kiểm tra trong phạm vi phòng của landlord này
            };
            if (excludeId) query._id = { $ne: excludeId };
            
            const exists = await roomRepository.exists(query);
            return res.json({ success: true, data: { available: !exists } });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
        }
    }

    // Lấy chi tiết phòng
    async getRoom(req, res) {
        try {
            const { id } = req.params;
            const room = await roomRepository.findById(id);
            if (!room) return res.status(404).json({ success: false, message: 'Không tìm thấy phòng' });
            // Quyền: landlord chỉ xem được phòng thuộc owner của mình
            if (req.user?.role === 'landlord' && req.user.userId && room.owner && room.owner.toString() !== req.user.userId) {
                return res.status(403).json({ success: false, message: 'Không có quyền xem phòng này' });
            }
            res.json({ success: true, data: room });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
        }
    }

    // Tìm kiếm / danh sách phòng
    async searchRooms(req, res) {
        try {
            const query = { ...req.query };
            // Landlord: chỉ thấy phòng của mình
            if (req.user?.role === 'landlord' && req.user.userId) {
                query.owner = req.user.userId;
            }
            const result = await roomRepository.search(query);
            res.json({ success: true, data: result });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
        }
    }

    // Cập nhật phòng
    async updateRoom(req, res) {
        try {
            const { id } = req.params;
            const room = await roomRepository.findById(id);
            if (!room) return res.status(404).json({ success: false, message: 'Không tìm thấy phòng' });
            if (req.user?.role === 'landlord' && req.user.userId && room.owner && room.owner.toString() !== req.user.userId) {
                return res.status(403).json({ success: false, message: 'Không có quyền cập nhật phòng này' });
            }
            const updated = await roomRepository.update(id, req.body);
            res.json({ success: true, message: 'Cập nhật phòng thành công', data: updated });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
        }
    }

    // Xóa phòng
    async deleteRoom(req, res) {
        try {
            const { id } = req.params;
            const room = await roomRepository.findById(id);
            if (!room) return res.status(404).json({ success: false, message: 'Không tìm thấy phòng' });
            if (req.user?.role === 'landlord' && req.user.userId && room.owner && room.owner.toString() !== req.user.userId) {
                return res.status(403).json({ success: false, message: 'Không có quyền xóa phòng này' });
            }
            // Xóa ảnh Cloudinary nếu có
            if (Array.isArray(room.images) && room.images.length) {
                const publicIds = room.images.map(extractPublicId).filter(Boolean);
                for (const pid of publicIds) {
                    try { await cloudinary.uploader.destroy(pid); } catch (e) { /* ignore */ }
                }
            }
            await roomRepository.delete(id);
            res.json({ success: true, message: 'Xóa phòng thành công' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
        }
    }

    // Cập nhật trạng thái
    async updateStatus(req, res) {
        try {
            const { id } = req.params;
            const { status, note } = req.body;
            const room = await roomRepository.findById(id);
            if (!room) return res.status(404).json({ success: false, message: 'Không tìm thấy phòng' });
            if (room.property && room.property.owner && room.property.owner.toString() !== req.user.userId && req.user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Không có quyền cập nhật trạng thái' });
            }
            const updated = await roomRepository.updateStatus(id, status, req.user.userId, note);
            res.json({ success: true, message: 'Cập nhật trạng thái thành công', data: updated });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
        }
    }

    // Thống kê đơn giản
    async statistics(req, res) {
        try {
            // Thêm filter theo owner nếu là landlord
            const filter = { ...req.query };
            if (req.user?.role === 'landlord') {
                filter.owner = req.user.userId;
            }
            const stats = await roomRepository.statistics(filter);
            res.json({ success: true, data: stats });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
        }
    }
    // Upload images to Cloudinary (max 5)
    async uploadImages(req, res) {
        try {
            const { id } = req.params;
            const room = await roomRepository.findById(id);
            if (!room) return res.status(404).json({ success: false, message: 'Không tìm thấy phòng' });
            if (req.user?.role === 'landlord' && req.user.userId && room.owner && room.owner.toString() !== req.user.userId) {
                return res.status(403).json({ success: false, message: 'Không có quyền upload ảnh phòng này' });
            }
            if (!req.files || !req.files.length) {
                return res.status(400).json({ success: false, message: 'Không có file' });
            }
            const remaining = 5 - (room.images?.length || 0);
            if (remaining <= 0) return res.status(400).json({ success: false, message: 'Đã đủ 5 ảnh' });
            const filesToUpload = req.files.slice(0, remaining);
            // Need to promisify upload_stream per file
            const uploadedUrls = [];
            for (const file of filesToUpload) {
                const buf = file.buffer;
                const url = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream({ folder: 'room_images' }, (error, result) => {
                        if (error) return reject(error);
                        resolve(result.secure_url);
                    });
                    stream.end(buf);
                });
                uploadedUrls.push(url);
            }
            room.images.push(...uploadedUrls);
            await room.save();
            res.json({ success: true, message: 'Upload thành công', data: { images: room.images } });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
        }
    }
    // Xóa 1 ảnh của phòng
    async deleteImage(req, res) {
        try {
            const { id } = req.params; // room id
            const { url } = req.body; // image url gửi trong body
            if (!url) return res.status(400).json({ success: false, message: 'Thiếu url ảnh' });
            const room = await roomRepository.findById(id);
            if (!room) return res.status(404).json({ success: false, message: 'Không tìm thấy phòng' });
            if (req.user?.role === 'landlord' && req.user.userId && room.owner && room.owner.toString() !== req.user.userId) {
                return res.status(403).json({ success: false, message: 'Không có quyền xóa ảnh phòng này' });
            }
            room.images = (room.images||[]).filter(img => img !== url);
            await room.save();
            // Xóa Cloudinary
            const pid = extractPublicId(url);
            if (pid) {
                try { await cloudinary.uploader.destroy(pid); } catch(e) { /* ignore */ }
            }
            res.json({ success: true, message: 'Đã xóa ảnh', data: { images: room.images } });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
        }
    }

    // Transfer room - Chuyển phòng
    async transferRoom(req, res) {
        try {
            const { fromRoomId, toRoomId } = req.body;
            const userId = req.user?.userId;

            if (!fromRoomId || !toRoomId) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Thiếu thông tin phòng nguồn hoặc phòng đích' 
                });
            }

            if (fromRoomId === toRoomId) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Phòng nguồn và phòng đích không thể giống nhau' 
                });
            }

            // Kiểm tra quyền sở hữu phòng nguồn
            const fromRoom = await roomRepository.findById(fromRoomId);
            if (!fromRoom) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy phòng nguồn' });
            }

            if (req.user?.role === 'landlord' && fromRoom.owner && fromRoom.owner.toString() !== userId) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Không có quyền chuyển phòng này' 
                });
            }

            // Kiểm tra quyền sở hữu phòng đích
            const toRoom = await roomRepository.findById(toRoomId);
            if (!toRoom) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy phòng đích' });
            }

            if (req.user?.role === 'landlord' && toRoom.owner && toRoom.owner.toString() !== userId) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Không có quyền chuyển đến phòng này' 
                });
            }

            // Kiểm tra trạng thái phòng
            if (fromRoom.status !== 'rented') {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Phòng nguồn phải có trạng thái đã thuê' 
                });
            }

            if (toRoom.status !== 'available') {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Phòng đích phải có trạng thái còn trống' 
                });
            }

            // Gọi service để thực hiện transfer
            const result = await roomRepository.transferRoom(fromRoomId, toRoomId, userId);

            res.json({ 
                success: true, 
                message: 'Chuyển phòng thành công',
                data: result
            });

        } catch (error) {
            console.error('Error transferring room:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Lỗi server khi chuyển phòng', 
                error: error.message 
            });
        }
    }
}

export default new RoomController();
