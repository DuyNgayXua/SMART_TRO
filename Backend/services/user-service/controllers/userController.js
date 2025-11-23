/**
 * User Controller - Xử lý business logic
 */
import userRepository from '../repositories/userRepository.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import cloudinary from '../../../config/cloudinary.js';
import crypto from 'crypto';
import { EmailVerification } from '../../../schemas/index.js';
import { sendVerificationEmail } from '../../emailService.js';
import LoginSession from '../../../schemas/LoginSession.js';
import DeviceInfoService from '../../shared/utils/deviceInfoService.js';
import { OAuth2Client } from 'google-auth-library';
import User from '../../../schemas/User.js';
import Property from '../../../schemas/Property.js';
import PackagePlan from '../../../schemas/PackagePlan.js';


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

// Helper function cấp gói trial cho user mới
async function grantTrialPackage(userId) {
    try {
        // Tìm gói trial trong database
        const trialPackage = await PackagePlan.findOne({
            type: 'trial',
            isActive: true
        });

        if (!trialPackage) {
            console.log('Trial package not found in database');
            return { success: false, message: 'Không tìm thấy gói trial' };
        }

        // Tính toán ngày hết hạn dựa trên duration và durationUnit
        let expiryDate = new Date();
        if (trialPackage.duration && trialPackage.durationUnit) {
            const currentDate = new Date();
            switch (trialPackage.durationUnit) {
                case 'day':
                    expiryDate = new Date(currentDate.getTime() + trialPackage.duration * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    expiryDate = new Date(currentDate);
                    expiryDate.setMonth(currentDate.getMonth() + trialPackage.duration);
                    break;
                case 'year':
                    expiryDate = new Date(currentDate);
                    expiryDate.setFullYear(currentDate.getFullYear() + trialPackage.duration);
                    break;
                default:
                    // Mặc định là tháng nếu không nhận diện được
                    expiryDate = new Date(currentDate);
                    expiryDate.setMonth(currentDate.getMonth() + trialPackage.duration);
                    break;
            }
        }

        // Cập nhật user với gói trial update với $set
        await User.findByIdAndUpdate(userId, {
            $set: {
                packageType: 'trial',
                'currentPackagePlan.packagePlanId': trialPackage._id,
                'currentPackagePlan.packageInstanceId': new mongoose.Types.ObjectId(), // Tạo instance ID mới cho trial
                'currentPackagePlan.displayName': trialPackage.displayName,
                'currentPackagePlan.purchaseDate': new Date(),
                'currentPackagePlan.expiryDate': expiryDate,
                'currentPackagePlan.freePushCount': trialPackage.freePushCount || 0,
                'currentPackagePlan.usedPushCount': 0,
                'currentPackagePlan.isActive': true,
                'currentPackagePlan.propertiesLimits': trialPackage.propertiesLimits || 0,
            }
        });

        console.log(`Granted trial package to user ${userId}`);
        return {
            success: true,
            message: 'Đã cấp gói trial thành công',
            packageInfo: {
                packageName: trialPackage.name,
                displayName: trialPackage.displayName,
                type: 'trial'
            }
        };

    } catch (error) {
        console.error('Error granting trial package:', error);
        return { success: false, message: 'Lỗi khi cấp gói trial', error: error.message };
    }
}

// Helper function để tái kích hoạt properties khi gói được gia hạn/kích hoạt lại
async function reactivateUserProperties(userId, newPackageInfo, isRenewal = false, migrationData = null) {
    try {
        console.log('Reactivating properties for user:', userId, 'isRenewal:', isRenewal);
        console.log('Migration data:', migrationData);
        
        // Nếu là upgrade và KHÔNG có migration data (không chọn chuyển tin)
        if (!isRenewal && (!migrationData || !migrationData.selectedProperties || migrationData.selectedProperties.length === 0)) {
            console.log('Upgrade mode without migration - Not reactivating any old properties');
            return { 
                success: true, 
                reactivatedCount: 0, 
                message: 'Upgrade completed - No properties migrated as requested' 
            };
        }

        let query = {
            owner: userId,
            'packageInfo.plan': { $exists: true },
            $or: [
                { 'packageInfo.isActive': false },
                { 'packageInfo.status': 'expired' }
            ]
        };

        // Nếu là renewal (gia hạn cùng gói), chỉ tái kích hoạt tin đăng thuộc instance cụ thể của gói đó
        if (isRenewal) {
            // Lọc theo packageInstanceId thay vì plan để tránh tái kích hoạt tin cũ từ các phiên bản trước
            if (newPackageInfo.previousInstanceId) {
                query['packageInfo.packageInstanceId'] = newPackageInfo.previousInstanceId;
                console.log('Renewal mode: Reactivating properties for specific package instance:', newPackageInfo.previousInstanceId);
            } else {
                // Fallback: nếu không có previousInstanceId, vẫn dùng plan nhưng thêm điều kiện thời gian
                query['packageInfo.plan'] = newPackageInfo.packagePlanId;
                // Chỉ tái kích hoạt tin đăng hết hạn trong vòng 30 ngày gần đây để tránh tin cũ lâu
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                query['packageInfo.expiryDate'] = { $gte: thirtyDaysAgo };
                console.log('Renewal mode (fallback): Only reactivating recent properties of the same package:', newPackageInfo.packagePlanId);
            }
        } else if (migrationData && migrationData.selectedProperties && migrationData.selectedProperties.length > 0) {
            // Nếu là upgrade và có migration data, chỉ tái kích hoạt những tin được chọn
            const selectedPropertyIds = migrationData.selectedProperties.map(p => p.propertyId);
            query._id = { $in: selectedPropertyIds };
            console.log('Upgrade mode with migration: Only reactivating selected properties:', selectedPropertyIds);
        } else {
            // Upgrade không có migration - không tái kích hoạt gì
            console.log('Upgrade mode without migration - Skipping reactivation');
            return { success: true, reactivatedCount: 0, message: 'No properties selected for migration' };
        }
        
        // Tìm properties cần tái kích hoạt
        const expiredProperties = await Property.find(query);

        if (expiredProperties.length === 0) {
            console.log('No expired properties found for reactivation with current criteria');
            return { success: true, reactivatedCount: 0 };
        }

        console.log(`Found ${expiredProperties.length} properties eligible for reactivation`);

        // Cập nhật properties expired thành active với thông tin gói mới
        const updateResult = await Property.updateMany(
            query,
            {
                $set: {
                    'packageInfo.isActive': true,
                    'packageInfo.status': 'active',
                    'packageInfo.plan': newPackageInfo.packagePlanId,
                    'packageInfo.packageInstanceId': newPackageInfo.packageInstanceId, // Gắn instance mới
                    'packageInfo.purchaseDate': newPackageInfo.purchaseDate,
                    'packageInfo.expiryDate': newPackageInfo.expiryDate,
                    updatedAt: new Date()
                }
            }
        );

        console.log(`Reactivated ${updateResult.modifiedCount} properties for user ${userId}`);
        
        return {
            success: true,
            reactivatedCount: updateResult.modifiedCount,
            message: `Đã tái kích hoạt ${updateResult.modifiedCount} tin đăng`
        };

    } catch (error) {
        console.error('Error reactivating user properties:', error);
        return { 
            success: false, 
            reactivatedCount: 0,
            message: 'Lỗi khi tái kích hoạt tin đăng',
            error: error.message 
        };
    }
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

            // Cấp gói trial cho user mới
            const trialResult = await grantTrialPackage(user._id);
            console.log('Trial package grant result:', trialResult);

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
                    requiresVerification: true,
                    trialPackage: trialResult.success ? trialResult.packageInfo : null
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
                    fullName: user.fullName,
                    phone: user.phone,
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

    // Đăng nhập bằng Google, cấp gói trial nếu user mới
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
            let isNewUser = false;
            let trialResult = { success: false };

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
                isNewUser = true;
                console.log('Created new Google user:', user._id);

                // Cấp gói trial cho user mới Google
                trialResult = await grantTrialPackage(user._id);
                console.log('Trial package grant result for Google user:', trialResult);
            } else {
                // Kiểm tra xem user đã đăng nhập bằng Google trước đó chưa
                const hasGoogleLogin = await LoginSession.findOne({
                    userId: user._id,
                    loginMethod: 'google'
                });

                if (!hasGoogleLogin && !user.googleId) {
                    // Lần đầu đăng nhập bằng Google
                    isNewUser = true;
                    console.log('First time Google login for existing user:', user._id);
                }

                // Cập nhật googleId và avatar nếu chưa có hoặc đã thay đổi
                let needUpdate = false;
                
                if (!user.googleId) {
                    user.googleId = googleId;
                    needUpdate = true;
                }
                
                // Cập nhật avatar từ Google nếu có và khác với avatar hiện tại
                if (picture && user.avatar !== picture) {
                    user.avatar = picture;
                    needUpdate = true;
                }
                
                if (needUpdate) {
                    await user.save();
                    console.log('Updated user googleId and/or avatar:', user._id);
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
                    sessionToken: sessionId,
                    isNewUser: isNewUser,
                    trialPackage: trialResult.success ? trialResult.packageInfo : null
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

// Export both controller and utility functions
const userController = new UserController();

export { reactivateUserProperties };
export default userController;
