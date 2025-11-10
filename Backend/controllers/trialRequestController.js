import TrialRequest from '../schemas/TrialRequest.js';
import { sendEmail } from '../services/emailService.js';
<<<<<<< HEAD
=======
import User from '../schemas/User.js';
import bcrypt from 'bcryptjs';
import PackagePlan from '../schemas/PackagePlan.js';
import mongoose from 'mongoose';
>>>>>>> e90a8e5e40eb060dd78666cdf125f4a0925c0a99

// Đăng ký gói miễn phí - Chỉ dành cho user đã đăng nhập
export const createTrialRequest = async (req, res) => {
    try {
        const { fullName, email, phone } = req.body;
        const userId = req.user?.userId; // Lấy userId từ token

        // Bắt buộc phải đăng nhập
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Vui lòng đăng nhập để đăng ký gói miễn phí',
                requireLogin: true
            });
        }

        // Validate input
        if (!fullName || !email || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ thông tin (họ tên, email, số điện thoại)'
            });
        }

        // Validate email format
        const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Email không hợp lệ'
            });
        }

        // Validate phone format
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Số điện thoại phải có 10 chữ số'
            });
        }

        // Lấy thông tin user hiện tại
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông tin user'
            });
        }

        // Kiểm tra user đã đăng ký gói miễn phí chưa
        if (user.freeTrial && user.freeTrial.hasRegistered) {
            return res.status(400).json({
                success: false,
                message: 'Bạn đã đăng ký gói miễn phí rồi. Mỗi tài khoản chỉ được đăng ký 1 lần.'
            });
        }

        // Kiểm tra email đã đăng ký trial request chưa
        const existingTrialRequest = await TrialRequest.findOne({ 
            email,
            status: 'approved' 
        });
        if (existingTrialRequest) {
            return res.status(400).json({
                success: false,
                message: 'Email này đã đăng ký gói miễn phí. Mỗi email chỉ được đăng ký 1 lần.'
            });
        }

        // Kiểm tra số điện thoại đã đăng ký trial request chưa
        const existingTrialPhone = await TrialRequest.findOne({ 
            phone,
            status: 'approved' 
        });
        if (existingTrialPhone) {
            return res.status(400).json({
                success: false,
                message: 'Số điện thoại này đã đăng ký gói miễn phí. Mỗi số điện thoại chỉ được đăng ký 1 lần.'
            });
        }

        // Tìm gói trial (1 tháng miễn phí)
        const trialPackage = await PackagePlan.findOne({
            type: 'trial',
            isActive: true
        });

        // Tính ngày hết hạn (1 tháng)
        const now = new Date();
        const expiryDate = new Date(now);
        expiryDate.setMonth(now.getMonth() + 1);

        // Tạo trial request record
        const trialRequest = new TrialRequest({
            fullName,
            email,
            phone,
            status: 'approved',
            approvedAt: now
        });
        await trialRequest.save();

        // Cập nhật thông tin user hiện tại
        user.fullName = fullName || user.fullName;
        user.phone = phone || user.phone;
        user.role = 'landlord'; // Chuyển role sang landlord
        user.freeTrial = {
            hasRegistered: true,
            registeredAt: now,
            expiryDate,
            trialRequestId: trialRequest._id
        };

        // Nếu có gói trial trong hệ thống, gán cho user
        if (trialPackage) {
            user.packageType = 'trial';
            user.currentPackagePlan = {
                packagePlanId: trialPackage._id,
                packageInstanceId: new mongoose.Types.ObjectId(),
                packageName: trialPackage.name,
                displayName: trialPackage.displayName,
                priority: trialPackage.priority,
                color: trialPackage.color,
                stars: trialPackage.stars,
                freePushCount: trialPackage.freePushCount || 0,
                usedPushCount: 0,
                purchaseDate: now,
                expiryDate,
                isActive: true,
                status: 'active',
                propertiesLimits: trialPackage.propertiesLimits || []
            };
        }

        await user.save();

        // Gửi email thông báo nâng cấp thành công
        try {
            await sendEmail({
                to: email,
                subject: '🎉 Đăng ký gói dùng thử thành công - SMART TRO',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #22c55e;">✅ Đăng ký thành công!</h2>
                        
                        <p>Xin chào <strong>${fullName}</strong>,</p>
                        
                        <p>Cảm ơn bạn đã đăng ký gói dùng thử hệ thống quản lý trọ SMART TRO. Tài khoản của bạn đã được nâng cấp lên quyền Chủ trọ thành công!</p>
                        
                        <div style="background: #f0fdf4; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #22c55e;">
                            <h3 style="color: #1e293b; margin-top: 0;">Thông tin gói dùng thử:</h3>
                            <p>📧 <strong>Email:</strong> ${email}</p>
                            <p>⏰ <strong>Gói dùng thử:</strong> MIỄN PHÍ 1 THÁNG (đến ${expiryDate.toLocaleDateString('vi-VN')})</p>
                            <p>👤 <strong>Quyền:</strong> Chủ trọ (Landlord)</p>
                        </div>

                        <div style="background: #fefce8; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #eab308;">
                            <p style="margin: 0;"><strong>✨ Bạn có quyền truy cập đầy đủ:</strong></p>
                            <ul style="margin: 10px 0;">
                                <li>Quản lý phòng trọ</li>
                                <li>Quản lý khách thuê</li>
                                <li>Quản lý hợp đồng</li>
                                <li>Quản lý thu chi</li>
                                <li>Báo cáo thống kê</li>
                            </ul>
                        </div>
                        
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/dashboard" 
                           style="display: inline-block; padding: 14px 28px; background: #22c55e; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">
                            Vào trang quản lý
                        </a>
                        
                        <p>Chúc bạn có trải nghiệm tuyệt vời với SMART TRO!</p>
                        
                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                        
                        <p style="color: #64748b; font-size: 14px; text-align: center;">
                            © 2025 SMART TRO - Giải pháp quản lý trọ chuyên nghiệp
                        </p>
                    </div>
                `
            });
        } catch (emailError) {
            console.error('Error sending welcome email:', emailError);
            // Không throw error, vẫn trả về success vì đã cập nhật tài khoản
        }

        res.status(200).json({
            success: true,
            message: 'Đăng ký gói dùng thử thành công! Bạn đã được nâng cấp lên quyền Chủ trọ.',
            data: {
                userId: user._id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                trialExpiryDate: expiryDate
            }
        });
    } catch (error) {
        console.error('Error creating trial request:', error);
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
            error: error.message
        });
    }
};

// Lấy tất cả yêu cầu dùng thử (Admin)
export const getAllTrialRequests = async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        
        const filter = {};
        if (status && status !== 'all') {
            filter.status = status;
        }

        const total = await TrialRequest.countDocuments(filter);
        
        const requests = await TrialRequest.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('approvedBy', 'fullName email');

        const stats = {
            total: await TrialRequest.countDocuments(),
            pending: await TrialRequest.countDocuments({ status: 'pending' }),
            approved: await TrialRequest.countDocuments({ status: 'approved' }),
            rejected: await TrialRequest.countDocuments({ status: 'rejected' })
        };

        res.status(200).json({
            success: true,
            data: {
                requests,
                stats,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    total,
                    limit: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Error getting trial requests:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách yêu cầu',
            error: error.message
        });
    }
};

// Phê duyệt yêu cầu dùng thử (Admin)
export const approveTrialRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { notes } = req.body;

        const request = await TrialRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy yêu cầu'
            });
        }

        request.status = 'approved';
        request.approvedBy = req.user.userId;
        request.approvedAt = new Date();
        request.notes = notes || '';
        
        await request.save();

        // Gửi email thông báo phê duyệt
        try {
            await sendEmail({
                to: request.email,
                subject: 'Yêu cầu dùng thử đã được chấp nhận - SMART TRO',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #22c55e;">Chúc mừng ${request.fullName}!</h2>
                        
                        <p>Yêu cầu dùng thử của bạn đã được <strong style="color: #22c55e;">PHÊ DUYỆT</strong>.</p>
                        
                        <div style="background: #f0fdf4; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #22c55e;">
                            <h3 style="color: #1e293b; margin-top: 0;">Bước tiếp theo:</h3>
                            <p>Vui lòng nhấn vào nút bên dưới để tạo tài khoản với email: <strong>${request.email}</strong></p>
                            <p>Bạn sẽ được cấp <strong style="color: #22c55e;">MIỄN PHÍ 1 THÁNG</strong> sử dụng đầy đủ tính năng quản lý trọ.</p>
                            ${notes ? `<p><strong>Ghi chú:</strong> ${notes}</p>` : ''}
                        </div>
                        
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dang-ky-dung-thu?email=${encodeURIComponent(request.email)}" 
                           style="display: inline-block; padding: 14px 28px; background: #22c55e; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">
                            Đăng ký tài khoản ngay
                        </a>
                        
                        <p>Chúng tôi rất vui được đồng hành cùng bạn!</p>
                        
                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                        
                        <p style="color: #64748b; font-size: 14px; text-align: center;">
                            © 2025 SMART TRO - Giải pháp quản lý trọ chuyên nghiệp
                        </p>
                    </div>
                `
            });
        } catch (emailError) {
            console.error('Error sending approval email:', emailError);
        }

        res.status(200).json({
            success: true,
            message: 'Đã phê duyệt yêu cầu',
            data: request
        });
    } catch (error) {
        console.error('Error approving trial request:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi phê duyệt yêu cầu',
            error: error.message
        });
    }
};

// Từ chối yêu cầu dùng thử (Admin)
export const rejectTrialRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { rejectedReason } = req.body;

        const request = await TrialRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy yêu cầu'
            });
        }

        request.status = 'rejected';
        request.rejectedReason = rejectedReason || '';
        
        await request.save();

        // Gửi email thông báo từ chối
        try {
            await sendEmail({
                to: request.email,
                subject: 'Thông báo về yêu cầu dùng thử - SMART TRO',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #ef4444;">Xin chào ${request.fullName},</h2>
                        
                        <p>Rất tiếc, yêu cầu dùng thử của bạn chưa được chấp nhận lúc này.</p>
                        
                        ${rejectedReason ? `
                        <div style="background: #fef2f2; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #ef4444;">
                            <p><strong>Lý do:</strong> ${rejectedReason}</p>
                        </div>
                        ` : ''}
                        
                        <p>Bạn có thể đăng ký lại sau hoặc liên hệ với chúng tôi để được hỗ trợ.</p>
                        
                        <p>Liên hệ:</p>
                        <ul>
                            <li>Email: support@smarttro.com</li>
                            <li>Hotline: 1900 xxxx</li>
                        </ul>
                        
                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                        
                        <p style="color: #64748b; font-size: 14px; text-align: center;">
                            © 2025 SMART TRO - Giải pháp quản lý trọ chuyên nghiệp
                        </p>
                    </div>
                `
            });
        } catch (emailError) {
            console.error('Error sending rejection email:', emailError);
        }

        res.status(200).json({
            success: true,
            message: 'Đã từ chối yêu cầu',
            data: request
        });
    } catch (error) {
        console.error('Error rejecting trial request:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi từ chối yêu cầu',
            error: error.message
        });
    }
};

// Đăng ký tài khoản sau khi được approve (User)
export const registerTrialUser = async (req, res) => {
    try {
        const { email, password, fullName, phone } = req.body;

        // Validate input
        if (!email || !password || !fullName) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp đầy đủ thông tin (email, password, fullName)'
            });
        }

        // Kiểm tra request đã được approve chưa
        const trialRequest = await TrialRequest.findOne({ 
            email, 
            status: 'approved' 
        });

        if (!trialRequest) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy yêu cầu đã được phê duyệt với email này'
            });
        }

        // Kiểm tra user đã tồn tại chưa
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email đã được sử dụng'
            });
        }

        // Tìm gói trial (1 tháng miễn phí)
        const trialPackage = await PackagePlan.findOne({
            type: 'trial',
            isActive: true
        });

        // Tính ngày hết hạn (1 tháng)
        const now = new Date();
        const expiryDate = new Date(now);
        expiryDate.setMonth(now.getMonth() + 1);

        // Tạo user mới với gói trial
        const newUser = new User({
            fullName: fullName || trialRequest.fullName,
            email,
            phone: phone || trialRequest.phone,
            password, // Sẽ được hash tự động bởi pre-save hook
            role: 'landlord', // Gói quản lý trọ dành cho landlord
            isActive: true,
            freeTrial: {
                hasRegistered: true,
                registeredAt: now,
                expiryDate,
                trialRequestId: trialRequest._id
            }
        });

        // Nếu có gói trial trong hệ thống, gán cho user
        if (trialPackage) {
            newUser.packageType = 'trial';
            newUser.currentPackagePlan = {
                packagePlanId: trialPackage._id,
                packageInstanceId: new mongoose.Types.ObjectId(),
                packageName: trialPackage.name,
                displayName: trialPackage.displayName,
                priority: trialPackage.priority,
                color: trialPackage.color,
                stars: trialPackage.stars,
                freePushCount: trialPackage.freePushCount || 0,
                usedPushCount: 0,
                purchaseDate: now,
                expiryDate,
                isActive: true,
                status: 'active',
                propertiesLimits: trialPackage.propertiesLimits || []
            };
        }

        await newUser.save();

        // Gửi email chào mừng
        try {
            await sendEmail({
                to: email,
                subject: 'Chào mừng đến với SMART TRO!',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #8b5cf6;">Chào mừng ${fullName}!</h2>
                        
                        <p>Tài khoản của bạn đã được tạo thành công.</p>
                        
                        <div style="background: #f5f3ff; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #8b5cf6;">
                            <h3 style="color: #1e293b; margin-top: 0;">Gói dùng thử miễn phí:</h3>
                            <p>✅ Thời hạn: <strong>1 tháng (đến ${expiryDate.toLocaleDateString('vi-VN')})</strong></p>
                            <p>✅ Truy cập đầy đủ tính năng quản lý trọ</p>
                        </div>
                        
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dang-nhap" 
                           style="display: inline-block; padding: 14px 28px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">
                            Đăng nhập ngay
                        </a>
                        
                        <p>Hãy bắt đầu trải nghiệm hệ thống quản lý trọ chuyên nghiệp của chúng tôi!</p>
                        
                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                        
                        <p style="color: #64748b; font-size: 14px; text-align: center;">
                            © 2025 SMART TRO - Giải pháp quản lý trọ chuyên nghiệp
                        </p>
                    </div>
                `
            });
        } catch (emailError) {
            console.error('Error sending welcome email:', emailError);
        }

        res.status(201).json({
            success: true,
            message: 'Đăng ký thành công! Bạn có thể đăng nhập ngay.',
            data: {
                userId: newUser._id,
                email: newUser.email,
                fullName: newUser.fullName,
                trialExpiryDate: expiryDate
            }
        });
    } catch (error) {
        console.error('Error registering trial user:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi đăng ký tài khoản',
            error: error.message
        });
    }
};
