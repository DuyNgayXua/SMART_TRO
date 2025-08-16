/**
 * Landlord Middleware - Kiểm tra quyền landlord
 */
const landlordMiddleware = (req, res, next) => {
    try {
        if (req.user.role !== 'landlord' && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Chỉ chủ trọ hoặc admin mới có quyền truy cập'
            });
        }

        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi kiểm tra quyền landlord'
        });
    }
};

export default landlordMiddleware;
