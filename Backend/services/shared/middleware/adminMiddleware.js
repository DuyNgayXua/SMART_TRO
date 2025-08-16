/**
 * Admin Middleware - Kiểm tra quyền admin
 */
const adminMiddleware = (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Chỉ admin mới có quyền truy cập'
            });
        }

        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi kiểm tra quyền admin'
        });
    }
};

export default adminMiddleware;
