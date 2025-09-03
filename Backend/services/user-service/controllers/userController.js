/**
 * User Controller - Xử lý business logic
 */
import userRepository from '../repositories/userRepository.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cloudinary from '../../../config/cloudinary.js';
import crypto from 'crypto';
import { EmailVerification } from '../../../schemas/index.js';
import { sendVerificationEmail } from '../../emailService.js';
import LoginSession from '../../../schemas/LoginSession.js';
import DeviceInfoService from '../../shared/utils/deviceInfoService.js';
import { OAuth2Client } from 'google-auth-library';

// Helper function tạo device string có ý nghĩa
function createDeviceString(deviceInfo) {
    const browser = deviceInfo.browser !== 'Unknown' ? deviceInfo.browser : 'Trình duyệt';
    const browserVersion = deviceInfo.browserVersion !== 'Unknown' ? deviceInfo.browserVersion : '';
    const os = deviceInfo.os !== 'Unknown' ? deviceInfo.os : 'Hệ điều hành';
    
    if (browserVersion) {
        return `${browser} ${browserVersion} trên ${os}`;
    }
    return `${browser} trên ${os}`;
}

// Helper function tạo location string có ý nghĩa  
function createLocationString(locationInfo) {
    const city = locationInfo.city !== 'Unknown' ? locationInfo.city : '';
    const region = locationInfo.region !== 'Unknown' ? locationInfo.region : '';
    const country = locationInfo.country !== 'Unknown' ? locationInfo.country : 'Việt Nam';
    
    if (city && region) {
        return `${city}, ${region}, ${country}`;
    } else if (region) {
        return `${region}, ${country}`;
    } else if (city) {
        return `${city}, ${country}`;
    }
    return country;
}

class UserController {
    // Đăng ký user mới
    async register(req, res) {
        try {
            
            const { fullName, email, phone, password, role } = req.body;
            
            // Basic validation
            if (!fullName || !email || !phone || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng điền đầy đủ thông tin'
                });
            }
            
            let avatarUrl = undefined;
            
            if (req.file) {
                console.log('File received, uploading to Cloudinary...');
                try {
                    // Upload avatar lên Cloudinary với timeout
                    const uploadResult = await Promise.race([
                        new Promise((resolve, reject) => {
                            cloudinary.uploader.upload_stream(
                                { 
                                    folder: 'user_avatars', 
                                    resource_type: 'image',
                                    timeout: 30000 // 30 giây timeout
                                },
                                (error, result) => {
                                    if (error) {
                                        console.error('Cloudinary upload error:', error);
                                        reject(error);
                                    } else {
                                        console.log('Cloudinary upload success:', result.secure_url);
                                        resolve(result);
                                    }
                                }
                            ).end(req.file.buffer);
                        }),
                        // Timeout sau 35 giây
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Upload timeout after 35 seconds')), 35000)
                        )
                    ]);
                    
                    avatarUrl = uploadResult.secure_url;
                    console.log('Avatar uploaded to Cloudinary:', avatarUrl);
                } catch (uploadError) {
                    console.error('Error uploading to Cloudinary:', uploadError);
                    
                    // Trả về lỗi cụ thể hơn
                    let errorMessage = 'Lỗi khi upload ảnh';
                    if (uploadError.message?.includes('timeout')) {
                        errorMessage = 'Upload ảnh quá lâu, vui lòng thử lại với ảnh nhỏ hơn';
                    } else if (uploadError.message?.includes('network') || uploadError.message?.includes('connection')) {
                        errorMessage = 'Lỗi kết nối mạng khi upload ảnh, vui lòng thử lại';
                    }
                    
                    return res.status(500).json({
                        success: false,
                        message: errorMessage,
                        error: process.env.NODE_ENV === 'development' ? uploadError.message : undefined
                    });
                }
            }

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
                role,
                isActive: false, // Mặc định là inactive
                avatar: avatarUrl
            };

            console.log('Creating user with data:', userData);
            const user = await userRepository.create(userData);
            console.log('User created successfully:', user._id);

            // Tạo verification token
            const verificationToken = crypto.randomBytes(32).toString('hex');
            
            // Lưu verification token vào database
            const emailVerification = new EmailVerification({
                userId: user._id,
                email: user.email,
                token: verificationToken
            });
            await emailVerification.save();

            // Gửi email xác thực
            const emailResult = await sendVerificationEmail(user.email, user.fullName, verificationToken);
            
            if (emailResult.success) {
                console.log('Verification email sent successfully');
            } else {
                console.error('Failed to send verification email:', emailResult.error);
            }

            // Không trả về password
            const { password: _, ...userResponse } = user.toObject();

            res.status(201).json({
                success: true,
                message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.',
                data: {
                    ...userResponse,
                    emailSent: emailResult.success,
                    requiresVerification: true
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
            if (user.isActive === false) {
                return res.status(401).json({
                    success: false,
                    message: 'Tài khoản chưa được xác thực. Vui lòng kiểm tra email để xác thực tài khoản.',
                    data: {
                        requiresVerification: true,
                        email: user.email
                    }
                });
            }

            // Cập nhật last login
            await userRepository.updateLastLogin(user._id);

            // Tạo session ID
            const sessionId = crypto.randomUUID();

            // Lấy thông tin thiết bị và IP
            const userAgent = req.headers['user-agent'] || '';
            const clientIP = DeviceInfoService.getClientIP(req);
            const deviceInfo = DeviceInfoService.parseUserAgent(userAgent);
            const locationInfo = await DeviceInfoService.getLocationFromIP(clientIP);

            // Lưu session information
            const deviceString = createDeviceString(deviceInfo);
            const locationString = createLocationString(locationInfo);
            
            const loginSession = new LoginSession({
                userId: user._id,
                deviceInfo: {
                    userAgent: userAgent,
                    browser: deviceInfo.browser,
                    browserVersion: deviceInfo.browserVersion,
                    os: deviceInfo.os,
                    osVersion: deviceInfo.osVersion,
                    deviceType: deviceInfo.deviceType,
                    platform: deviceInfo.platform,
                    deviceString: deviceString
                },
                location: {
                    ip: locationInfo.ip,
                    country: locationInfo.country,
                    region: locationInfo.region,
                    city: locationInfo.city,
                    timezone: locationInfo.timezone,
                    isp: locationInfo.isp,
                    locationString: locationString
                },
                sessionToken: sessionId,
                loginMethod: 'password'
            });

            await loginSession.save();

            // Tạo JWT token với sessionId
            const token = jwt.sign(
                { 
                    userId: user._id, 
                    email: user.email, 
                    role: user.role,
                    sessionToken: sessionId
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '4h' }
            );

            // Không trả về password
            const { password: _, ...userResponse } = user.toObject();

            res.status(200).json({
                success: true,
                message: 'Đăng nhập thành công',
                data: {
                    user: userResponse,
                    token,
                    sessionToken: sessionId
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

    // Đăng nhập bằng Google
    async googleLogin(req, res) {
        try {
            const { credential } = req.body;

            // Khởi tạo Google OAuth client
            const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

            // Verify Google token
            const ticket = await client.verifyIdToken({
                idToken: credential,
                audience: process.env.GOOGLE_CLIENT_ID
            });

            const payload = ticket.getPayload();
            const { email, name, picture, sub: googleId } = payload;

            if (!email || !name) {
                return res.status(400).json({
                    success: false,
                    message: 'Thông tin từ Google không đầy đủ'
                });
            }

            // Tìm hoặc tạo user
            let user = await userRepository.findByEmail(email);

            if (!user) {
                // Tạo user mới với thông tin từ Google
                const userData = {
                    fullName: name,
                    email: email,
                    avatar: picture,
                    googleId: googleId,
                    isActive: true, // Google account đã verify sẵn
                    role: 'tenant'
                    // Không gán phone để tránh lỗi unique constraint
                };

                user = await userRepository.create(userData);
            } else {
                // Cập nhật googleId nếu chưa có
                if (!user.googleId) {
                    user.googleId = googleId;
                    await user.save();
                }
            }

            // Cập nhật last login
            await userRepository.updateLastLogin(user._id);

            // Tạo session ID
            const sessionId = crypto.randomUUID();

            // Lấy thông tin thiết bị và IP
            const userAgent = req.headers['user-agent'] || '';
            const clientIP = DeviceInfoService.getClientIP(req);
            const deviceInfo = DeviceInfoService.parseUserAgent(userAgent);
            const locationInfo = await DeviceInfoService.getLocationFromIP(clientIP);

            // Lưu session information
            const deviceString = createDeviceString(deviceInfo);
            const locationString = createLocationString(locationInfo);
            
            const loginSession = new LoginSession({
                userId: user._id,
                deviceInfo: {
                    userAgent: userAgent,
                    browser: deviceInfo.browser,
                    browserVersion: deviceInfo.browserVersion,
                    os: deviceInfo.os,
                    osVersion: deviceInfo.osVersion,
                    deviceType: deviceInfo.deviceType,
                    platform: deviceInfo.platform,
                    deviceString: deviceString
                },
                location: {
                    ip: locationInfo.ip,
                    country: locationInfo.country,
                    region: locationInfo.region,
                    city: locationInfo.city,
                    timezone: locationInfo.timezone,
                    isp: locationInfo.isp,
                    locationString: locationString
                },
                sessionToken: sessionId,
                loginMethod: 'google'
            });

            await loginSession.save();
            console.log('Google login - Created session:', sessionId, 'for user:', user._id);

            // Tạo JWT token với sessionId
            const token = jwt.sign(
                { 
                    userId: user._id, 
                    email: user.email, 
                    role: user.role,
                    sessionToken: sessionId
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '4h' }
            );

            // Không trả về password
            const { password: _, ...userResponse } = user.toObject();

            res.status(200).json({
                success: true,
                message: 'Đăng nhập Google thành công',
                data: {
                    user: userResponse,
                    token,
                    sessionToken: sessionId
                }
            });

        } catch (error) {
            console.error('Google login error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi xác thực Google',
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

    // Lấy user mặc định theo DEFAULT_LANDLORD_ID (public)
    async getDefaultUser(req, res) {
        try {
            const id = process.env.DEFAULT_LANDLORD_ID;
            if (!id) {
                return res.status(404).json({ success: false, message: 'Chưa cấu hình DEFAULT_LANDLORD_ID' });
            }
            const user = await userRepository.findById(id);
            if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy user mặc định' });
            res.json({ success: true, data: user });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
        }
    }

    // Cập nhật thông tin user
    async updateProfile(req, res) {
        try {
            const userId = req.user.userId;
            const updateData = req.body;

            // Lấy thông tin user hiện tại để kiểm tra googleId
            const currentUser = await userRepository.findById(userId);
            if (!currentUser) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy user'
                });
            }

            // Loại bỏ các field không được phép update
            delete updateData.password;
            delete updateData.email;
            delete updateData.role;

            // Xử lý phone cho tài khoản Google
            if (currentUser.googleId) {
                // Nếu là tài khoản Google và phone rỗng, loại bỏ field phone khỏi updateData
                if (!updateData.phone || updateData.phone.trim() === '') {
                    delete updateData.phone;
                }
            }

            // Kiểm tra số điện thoại đã tồn tại (chỉ khi có phone)
            if (updateData.phone && updateData.phone.trim()) {
                const existingUser = await userRepository.findByPhone(updateData.phone);
                if (existingUser && existingUser._id.toString() !== userId) {
                    return res.status(400).json({
                        success: false,
                        message: 'Số điện thoại này đã được sử dụng bởi tài khoản khác',
                        errors: ['Số điện thoại đã tồn tại trong hệ thống, vui lòng nhập SĐT khác']
                    });
                }
            }

            let avatarUrl = undefined;
            
            // Xử lý upload avatar nếu có
            if (req.file) {
                console.log('File received for profile update, uploading to Cloudinary...');
                try {
                    const uploadResult = await new Promise((resolve, reject) => {
                        cloudinary.uploader.upload_stream(
                            { folder: 'user_avatars', resource_type: 'image' },
                            (error, result) => {
                                if (error) {
                                    console.error('Cloudinary upload error:', error);
                                    reject(error);
                                } else {
                                    console.log('Cloudinary upload success:', result.secure_url);
                                    resolve(result);
                                }
                            }
                        ).end(req.file.buffer);
                    });
                    avatarUrl = uploadResult.secure_url;
                    updateData.avatar = avatarUrl;
                    console.log('Avatar updated:', avatarUrl);
                } catch (uploadError) {
                    console.error('Error uploading avatar to Cloudinary:', uploadError);
                    return res.status(500).json({
                        success: false,
                        message: 'Lỗi khi upload ảnh đại diện'
                    });
                }
            }

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
            console.error('Update profile error:', error);
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

    // Đổi mật khẩu cho user đã đăng nhập
    async changePassword(req, res) {
        try {
            const { oldPassword, newPassword } = req.body;
            const userId = req.user.userId; // Từ auth middleware
            console.log('Changing password for user:', userId);

            // Validate input
            if (!oldPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    errors: ['Mật khẩu cũ và mật khẩu mới là bắt buộc']
                });
            }

            // Regex pattern cho mật khẩu mạnh
            const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
            
            if (!PASSWORD_REGEX.test(newPassword)) {
                return res.status(400).json({
                    success: false,
                    errors: ['Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt (@$!%*?&)']
                });
            }

            // Tìm user
            const user = await userRepository.findByIdWithPassword(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    errors: ['Không tìm thấy user']
                });
            }

            // Kiểm tra mật khẩu cũ
            const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
            if (!isOldPasswordValid) {
                return res.status(400).json({
                    success: false,
                    errors: ['Mật khẩu cũ không chính xác']
                });
            }

            // Kiểm tra mật khẩu mới không trùng với mật khẩu cũ
            const isSamePassword = await bcrypt.compare(newPassword, user.password);
            if (isSamePassword) {
                return res.status(400).json({
                    success: false,
                    errors: ['Mật khẩu mới phải khác mật khẩu cũ']
                });
            }

            // Hash mật khẩu mới
            const saltRounds = 12;
            const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

            // Cập nhật mật khẩu
            await userRepository.update(userId, {
                password: hashedNewPassword,
                updatedAt: new Date()
            });

            res.status(200).json({
                success: true,
                message: 'Đổi mật khẩu thành công',
                data: {
                    email: user.email,
                    fullName: user.fullName,
                    updatedAt: new Date()
                }
            });

        } catch (error) {
            console.error('Change password error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Xác thực email với token
    async verifyEmail(req, res) {
        try {
            const { token } = req.query; // Lấy từ query string

            if (!token) {
                return res.status(400).json({
                    success: false,
                    message: 'Token xác thực là bắt buộc'
                });
            }

            // Tìm verification record
            const verification = await EmailVerification.findOne({
                token,
                verified: false
            });

            if (!verification) {
                return res.status(400).json({
                    success: false,
                    message: 'Token xác thực không hợp lệ hoặc đã hết hạn'
                });
            }

            // Tìm user và update isActive
            const user = await userRepository.findById(verification.userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy user'
                });
            }

            // Cập nhật user thành active
            await userRepository.update(user._id, {
                isActive: true,
                emailVerifiedAt: new Date(),
                updatedAt: new Date()
            });

            // Đánh dấu verification đã hoàn thành
            await EmailVerification.findByIdAndUpdate(verification._id, {
                verified: true,
                verifiedAt: new Date()
            });

            // Tạo LoginSession cho auto-login sau khi verify email
            const sessionToken = crypto.randomUUID();
            
            // Tạo JWT token để auto login (sau khi đã có sessionToken)
            const authToken = jwt.sign(
                { 
                    userId: user._id, 
                    email: user.email, 
                    role: user.role,
                    sessionToken: sessionToken // Thêm sessionToken vào JWT
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '4h' }
            );
            
            // Lấy thông tin thiết bị và IP
            const userAgent = req.headers['user-agent'] || '';
            const clientIP = DeviceInfoService.getClientIP(req);
            const deviceInfo = DeviceInfoService.parseUserAgent(userAgent);
            const locationInfo = await DeviceInfoService.getLocationFromIP(clientIP);
            
            // Tạo device string có ý nghĩa
            const deviceString = createDeviceString(deviceInfo);
            const locationString = createLocationString(locationInfo);
            
            const loginSession = await LoginSession.create({
                sessionToken,
                userId: user._id,
                loginMethod: 'email_verification',
                deviceInfo: {
                    userAgent: userAgent,
                    browser: deviceInfo.browser,
                    browserVersion: deviceInfo.browserVersion,
                    os: deviceInfo.os,
                    osVersion: deviceInfo.osVersion,
                    deviceType: deviceInfo.deviceType,
                    platform: deviceInfo.platform,
                    deviceString: deviceString
                },
                location: {
                    ip: locationInfo.ip,
                    country: locationInfo.country,
                    region: locationInfo.region,
                    city: locationInfo.city,
                    timezone: locationInfo.timezone,
                    isp: locationInfo.isp,
                    locationString: locationString
                },
                loginTime: new Date(),
                isActive: true
            });

            // Response với auto login
            res.status(200).json({
                success: true,
                message: 'Xác thực email thành công! Tài khoản đã được kích hoạt.',
                data: {
                    user: {
                        _id: user._id,
                        fullName: user.fullName,
                        email: user.email,
                        phone: user.phone,
                        role: user.role,
                        isActive: true,
                        avatar: user.avatar
                    },
                    token: authToken,
                    sessionToken: sessionToken,
                    autoLogin: true
                }
            });

        } catch (error) {
            console.error('Email verification error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Lấy danh sách phiên đăng nhập hiện tại
    async getActiveSessions(req, res) {
        try {
            const userId = req.user.userId;
            const currentSessionToken = req.user.sessionToken;
            
            console.log('Current session token:', currentSessionToken);
            
            const sessions = await LoginSession.getActiveSessions(userId);
            console.log('Found sessions:', sessions.length);
            sessions.forEach(session => {
                // Session logging removed for cleaner output
            });

            const formattedSessions = sessions.map(session => ({
                sessionId: session._id.toString(),
                deviceString: session.deviceString || createDeviceString(session.deviceInfo),
                locationString: session.locationString || createLocationString(session.location),
                deviceInfo: {
                    deviceString: session.deviceString || `${session.deviceInfo.browser || 'Unknown'} ${session.deviceInfo.browserVersion || ''} trên ${session.deviceInfo.os || 'Unknown'}`,
                    deviceType: session.deviceInfo.deviceType || 'desktop',
                    platform: session.deviceInfo.platform || 'Unknown'
                },
                location: {
                    locationString: session.locationString || `${session.location.city || 'Unknown'}, ${session.location.region || 'Unknown'}, ${session.location.country || 'Unknown'}`,
                    ip: session.location.ip || 'Unknown',
                    isp: session.location.isp || 'Unknown'
                },
                loginTime: session.loginTime,
                lastActivity: session.lastActivity,
                duration: session.getFormattedDuration(),
                isCurrent: session.sessionToken === req.user.sessionToken
            }));

            res.status(200).json({
                success: true,
                data: formattedSessions
            });

        } catch (error) {
            console.error('Get active sessions error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Lấy lịch sử đăng nhập
    async getLoginHistory(req, res) {
        try {
            const userId = req.user.userId;
            const limit = parseInt(req.query.limit) || 20;
            const sessions = await LoginSession.getSessionHistory(userId, limit);

            const formattedSessions = sessions.map(session => ({
                sessionId: session._id.toString(),
                deviceInfo: {
                    deviceString: `${session.deviceInfo.browser || 'Unknown'} ${session.deviceInfo.browserVersion || ''} on ${session.deviceInfo.os || 'Unknown'}`,
                    deviceType: session.deviceInfo.deviceType || 'desktop'
                },
                location: {
                    locationString: `${session.location.city || 'Unknown'}, ${session.location.region || 'Unknown'}, ${session.location.country || 'Unknown'}`,
                    ip: session.location.ip || 'Unknown'
                },
                loginTime: session.loginTime,
                logoutTime: session.logoutTime,
                isActive: session.isActive,
                duration: session.getFormattedDuration()
            }));

            res.status(200).json({
                success: true,
                data: formattedSessions
            });

        } catch (error) {
            console.error('Get login history error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Đăng xuất phiên cụ thể
    async logoutSession(req, res) {
        try {
            const userId = req.user.userId;
            const { sessionId } = req.params;

            const session = await LoginSession.findOne({
                userId,
                _id: sessionId,
                isActive: true
            });

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy phiên đăng nhập'
                });
            }

            // Đánh dấu session là đã logout
            session.isActive = false;
            session.logoutTime = new Date();
            await session.save();

            res.status(200).json({
                success: true,
                message: 'Đã đăng xuất phiên thành công'
            });

        } catch (error) {
            console.error('Logout session error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Đăng xuất tất cả phiên khác (trừ phiên hiện tại)
    async logoutAllOtherSessions(req, res) {
        try {
            const userId = req.user.userId;
            const currentSessionToken = req.user.sessionToken;

            const result = await LoginSession.updateMany(
                {
                    userId,
                    sessionToken: { $ne: currentSessionToken },
                    isActive: true
                },
                {
                    $set: {
                        isActive: false,
                        logoutTime: new Date()
                    }
                }
            );

            res.status(200).json({
                success: true,
                message: `Đã đăng xuất ${result.modifiedCount} phiên khác`
            });

        } catch (error) {
            console.error('Logout all other sessions error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }
}

export default new UserController();
