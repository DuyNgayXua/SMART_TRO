/**
 * User Controller - Xử lý business logic
 */
import userRepository from '../repositories/userRepository.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

class UserController {
    // Đăng ký user mới
    async register(req, res) {
        try {
            const { fullName, email, phone, password, role = 'tenant' } = req.body;

            // Kiểm tra email đã tồn tại
            const existingUser = await userRepository.findByEmail(email);
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email đã được sử dụng'
                });
            }

            // Kiểm tra phone đã tồn tại
            const existingPhone = await userRepository.findByPhone(phone);
            if (existingPhone) {
                return res.status(400).json({
                    success: false,
                    message: 'Số điện thoại đã được sử dụng'
                });
            }

            // Tạo user mới
            const userData = {
                fullName,
                email,
                phone,
                password,
                role
            };

            const user = await userRepository.create(userData);

            // Không trả về password
            const { password: _, ...userResponse } = user.toObject();

            res.status(201).json({
                success: true,
                message: 'Đăng ký thành công',
                data: userResponse
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Đăng nhập
    async login(req, res) {
        try {
            const { email, password } = req.body;

            // Tìm user theo email
            const user = await userRepository.findByEmail(email);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Email hoặc mật khẩu không đúng'
                });
            }

            // Kiểm tra password
            const isPasswordValid = await user.comparePassword(password);
            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Email hoặc mật khẩu không đúng'
                });
            }

            // Kiểm tra trạng thái account
            if (user.status !== 'active') {
                return res.status(401).json({
                    success: false,
                    message: 'Tài khoản đã bị vô hiệu hóa'
                });
            }

            // Cập nhật last login
            await userRepository.updateLastLogin(user._id);

            // Tạo JWT token
            const token = jwt.sign(
                { 
                    userId: user._id, 
                    email: user.email, 
                    role: user.role 
                },
                process.env.JWT_SECRET || 'your_jwt_secret',
                { expiresIn: '24h' }
            );

            // Không trả về password
            const { password: _, ...userResponse } = user.toObject();

            res.status(200).json({
                success: true,
                message: 'Đăng nhập thành công',
                data: {
                    user: userResponse,
                    token
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

    // Lấy thông tin user hiện tại
    async getProfile(req, res) {
        try {
            const userId = req.user.userId;
            const user = await userRepository.findById(userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy user'
                });
            }

            res.status(200).json({
                success: true,
                data: user
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Cập nhật thông tin user
    async updateProfile(req, res) {
        try {
            const userId = req.user.userId;
            const updateData = req.body;

            // Loại bỏ các field không được phép update
            delete updateData.password;
            delete updateData.email;
            delete updateData.role;

            const user = await userRepository.update(userId, updateData);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy user'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Cập nhật thông tin thành công',
                data: user
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Lấy danh sách users (Admin only)
    async getUsers(req, res) {
        try {
            const options = {
                page: req.query.page || 1,
                limit: req.query.limit || 10,
                role: req.query.role,
                status: req.query.status,
                search: req.query.search
            };

            const result = await userRepository.findAll(options);

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

    // Lấy user theo ID (Admin only)
    async getUserById(req, res) {
        try {
            const { id } = req.params;
            const user = await userRepository.findById(id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy user'
                });
            }

            res.status(200).json({
                success: true,
                data: user
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

export default new UserController();
