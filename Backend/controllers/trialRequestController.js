import TrialRequest from '../schemas/TrialRequest.js';
import { sendEmail } from '../services/emailService.js';

// Tạo yêu cầu dùng thử mới
export const createTrialRequest = async (req, res) => {
    try {
        const { fullName, email, phone } = req.body;

        // Validate input
        if (!fullName || !email || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ thông tin'
            });
        }

        // Kiểm tra email đã tồn tại chưa
        const existingRequest = await TrialRequest.findOne({
            email,
            status: 'pending'
        });

        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: 'Email này đã đăng ký dùng thử. Vui lòng chờ xét duyệt.'
            });
        }

        // Tạo yêu cầu mới
        const trialRequest = new TrialRequest({
            fullName,
            email,
            phone
        });

        await trialRequest.save();

        // Gửi email xác nhận cho người dùng
        try {
            await sendEmail({
                to: email,
                subject: 'Xác nhận đăng ký dùng thử - SMART TRO',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #8b5cf6;">Xin chào ${fullName}!</h2>
                        
                        <p>Cảm ơn bạn đã đăng ký dùng thử hệ thống quản lý trọ của SMART TRO.</p>
                        
                        <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <h3 style="color: #1e293b; margin-top: 0;">Thông tin đăng ký:</h3>
                            <p><strong>Họ tên:</strong> ${fullName}</p>
                            <p><strong>Email:</strong> ${email}</p>
                            <p><strong>Số điện thoại:</strong> ${phone}</p>
                            <p><strong>Trạng thái:</strong> <span style="color: #f59e0b; font-weight: bold;">Đang chờ xét duyệt</span></p>
                        </div>
                        
                        <p>Chúng tôi sẽ xem xét và liên hệ với bạn trong vòng <strong>24 giờ</strong>.</p>
                        
                        <p>Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ:</p>
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
            console.error('Error sending confirmation email:', emailError);
            // Không throw error, vẫn trả về success vì đã lưu vào DB
        }

        res.status(201).json({
            success: true,
            message: 'Đăng ký thành công! Chúng tôi sẽ liên hệ với bạn sớm nhất.',
            data: {
                id: trialRequest._id,
                status: trialRequest.status
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
                            <h3 style="color: #1e293b; margin-top: 0;">Thông tin tài khoản:</h3>
                            <p>Vui lòng truy cập vào hệ thống và đăng ký tài khoản với email: <strong>${request.email}</strong></p>
                            ${notes ? `<p><strong>Ghi chú:</strong> ${notes}</p>` : ''}
                        </div>
                        
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dang-ky" 
                           style="display: inline-block; padding: 14px 28px; background: #22c55e; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">
                            Đăng ký ngay
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
