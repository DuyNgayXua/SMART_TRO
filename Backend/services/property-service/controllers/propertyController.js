/**
 * Property Controller - Xử lý business logic
 */
import propertyRepository from '../repositories/propertyRepository.js';

class PropertyController {
    // Tạo property mới (Landlord only)
    async createProperty(req, res) {
        try {
            const propertyData = {
                ...req.body,
                owner: req.user.userId
            };

            const property = await propertyRepository.create(propertyData);

            res.status(201).json({
                success: true,
                message: 'Tạo bất động sản thành công',
                data: property
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Lấy property theo ID
    async getProperty(req, res) {
        try {
            const { id } = req.params;
            
            // Tăng view count
            await propertyRepository.incrementViews(id);
            
            const property = await propertyRepository.findById(id);

            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy bất động sản'
                });
            }

            res.status(200).json({
                success: true,
                data: property
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Tìm kiếm properties
    async searchProperties(req, res) {
        try {
            const criteria = req.query;
            const result = await propertyRepository.search(criteria);

            res.status(200).json({
                success: true,
                data: result
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Lấy properties của landlord hiện tại
    async getMyProperties(req, res) {
        try {
            const ownerId = req.user.userId;
            const options = {
                page: req.query.page || 1,
                limit: req.query.limit || 10,
                status: req.query.status
            };

            const result = await propertyRepository.findByOwner(ownerId, options);

            res.status(200).json({
                success: true,
                data: result
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Cập nhật property (Owner only)
    async updateProperty(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            // Kiểm tra quyền sở hữu
            const property = await propertyRepository.findById(id);
            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy bất động sản'
                });
            }

            if (property.owner._id.toString() !== req.user.userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Không có quyền cập nhật bất động sản này'
                });
            }

            const updatedProperty = await propertyRepository.update(id, updateData);

            res.status(200).json({
                success: true,
                message: 'Cập nhật bất động sản thành công',
                data: updatedProperty
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Xóa property (Owner only)
    async deleteProperty(req, res) {
        try {
            const { id } = req.params;

            // Kiểm tra quyền sở hữu
            const property = await propertyRepository.findById(id);
            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy bất động sản'
                });
            }

            if (property.owner._id.toString() !== req.user.userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Không có quyền xóa bất động sản này'
                });
            }

            await propertyRepository.delete(id);

            res.status(200).json({
                success: true,
                message: 'Xóa bất động sản thành công'
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Đánh giá property
    async rateProperty(req, res) {
        try {
            const { id } = req.params;
            const { rating } = req.body;

            if (rating < 1 || rating > 5) {
                return res.status(400).json({
                    success: false,
                    message: 'Đánh giá phải từ 1 đến 5 sao'
                });
            }

            const property = await propertyRepository.updateRating(id, rating);

            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy bất động sản'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Đánh giá thành công',
                data: {
                    rating: property.rating
                }
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }
}

export default new PropertyController();
