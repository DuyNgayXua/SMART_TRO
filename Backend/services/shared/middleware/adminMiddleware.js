/**
 * Admin Only Middleware - Đảm bảo chỉ admin mới có thể truy cập
 */
export const adminMiddleware = (req, res, next) => {
    try {
        // Bypass trong development nếu cần
        if (process.env.BYPASS_AUTH === 'true') {
            req.user = req.user || { role: 'admin', userId: 'admin' };
            return next();
        }

        // Kiểm tra user đã được authenticate
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Vui lòng đăng nhập để tiếp tục'
            });
        }

        // Kiểm tra role admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Chỉ admin mới có quyền truy cập chức năng này'
            });
        }
        next();
    } catch (error) {
        console.error('Error in adminOnly middleware:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi kiểm tra quyền truy cập'
        });
    }
};

export default adminMiddleware;
