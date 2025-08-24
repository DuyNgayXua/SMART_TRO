/**
 * Auth Middleware - Xác thực JWT token
 */
import jwt from 'jsonwebtoken';
import LoginSession from '../../../schemas/LoginSession.js';

const authMiddleware = async (req, res, next) => {
    try {
        if (process.env.BYPASS_AUTH === 'true') {
            const defaultId = process.env.DEFAULT_LANDLORD_ID || null;
            req.user = { userId: defaultId, role: 'landlord', bypass: true };
            return next();
        }
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token is required'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Kiểm tra xem session có còn active không
        if (decoded.sessionToken) {
            const session = await LoginSession.findOne({
                sessionToken: decoded.sessionToken,
                isActive: true
            });

            if (!session) {
                return res.status(401).json({
                    success: false,
                    message: 'Phiên đăng nhập đã hết hạn hoặc bị đăng xuất'
                });
            }

            // Cập nhật last activity
            session.lastActivity = new Date();
            session.save().catch(err => console.error('Failed to update last activity:', err));
        }
        
        req.user = decoded;
        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token đã hết hạn'
            });
        }

        return res.status(401).json({
            success: false,
            message: 'Token không hợp lệ'
        });
    }
};

export default authMiddleware;
