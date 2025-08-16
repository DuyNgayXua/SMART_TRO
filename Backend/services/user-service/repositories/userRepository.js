/**
 * User Repository - Tương tác với database
 */
import { User } from '../../../schemas/index.js';

class UserRepository {
    // Tạo user mới
    async create(userData) {
        try {
            const user = new User(userData);
            return await user.save();
        } catch (error) {
            throw new Error(`Error creating user: ${error.message}`);
        }
    }

    // Lấy user theo ID
    async findById(id) {
        try {
            return await User.findById(id).select('-password');
        } catch (error) {
            throw new Error(`Error finding user by ID: ${error.message}`);
        }
    }

    // Lấy user theo email
    async findByEmail(email) {
        try {
            return await User.findOne({ email });
        } catch (error) {
            throw new Error(`Error finding user by email: ${error.message}`);
        }
    }

    // Lấy user theo phone
    async findByPhone(phone) {
        try {
            return await User.findOne({ phone });
        } catch (error) {
            throw new Error(`Error finding user by phone: ${error.message}`);
        }
    }

    // Cập nhật user
    async update(id, updateData) {
        try {
            return await User.findByIdAndUpdate(
                id, 
                updateData, 
                { new: true, runValidators: true }
            ).select('-password');
        } catch (error) {
            throw new Error(`Error updating user: ${error.message}`);
        }
    }

    // Xóa user
    async delete(id) {
        try {
            return await User.findByIdAndDelete(id);
        } catch (error) {
            throw new Error(`Error deleting user: ${error.message}`);
        }
    }

    // Lấy danh sách users với phân trang
    async findAll(options = {}) {
        try {
            const { 
                page = 1, 
                limit = 10, 
                role, 
                status,
                search 
            } = options;

            const query = {};
            
            if (role) query.role = role;
            if (status) query.status = status;
            if (search) {
                query.$or = [
                    { fullName: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ];
            }

            const skip = (page - 1) * limit;
            
            const users = await User.find(query)
                .select('-password')
                .skip(skip)
                .limit(parseInt(limit))
                .sort({ createdAt: -1 });

            const total = await User.countDocuments(query);

            return {
                users,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw new Error(`Error fetching users: ${error.message}`);
        }
    }

    // Cập nhật last login
    async updateLastLogin(id) {
        try {
            return await User.findByIdAndUpdate(
                id,
                { lastLogin: new Date() },
                { new: true }
            );
        } catch (error) {
            throw new Error(`Error updating last login: ${error.message}`);
        }
    }

    // Verify user
    async verifyUser(id) {
        try {
            return await User.findByIdAndUpdate(
                id,
                { isVerified: true },
                { new: true }
            ).select('-password');
        } catch (error) {
            throw new Error(`Error verifying user: ${error.message}`);
        }
    }
}

export default new UserRepository();
