import PackagePayment from '../schemas/PackagePayment.js';
import User from '../schemas/User.js';
import PackagePlan from '../schemas/PackagePlan.js';

// Get all package payments (Admin only)
export const getPackagePayments = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, search, fromDate, toDate } = req.query;
        
        // Build filter
        const filter = {};
        
        if (status && status !== 'all' && status !== '') {
            filter.status = status;
        }
        
        // Date range filter
        if (fromDate || toDate) {
            filter.createdAt = {};
            if (fromDate) {
                filter.createdAt.$gte = new Date(fromDate);
            }
            if (toDate) {
                // Set to end of day
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = endDate;
            }
        }
        
        // Get payments with populated data
        let query = PackagePayment.find(filter)
            .populate('user', 'fullName email phone')
            .populate('packagePlan', 'name duration price maxRooms maxPosts')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const payments = await query.lean();
        
        // Filter by search term if provided
        let filteredPayments = payments;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredPayments = payments.filter(payment => 
                payment.user?.fullName?.toLowerCase().includes(searchLower) ||
                payment.user?.email?.toLowerCase().includes(searchLower) ||
                payment.transactionId?.toLowerCase().includes(searchLower) ||
                payment._id.toString().includes(searchLower)
            );
        }
        
        // Get total count
        const total = await PackagePayment.countDocuments(filter);
        
        res.status(200).json({
            success: true,
            data: {
                payments: filteredPayments,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error getting package payments:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách thanh toán',
            error: error.message
        });
    }
};

// Get payment by ID
export const getPackagePaymentById = async (req, res) => {
    try {
        const { paymentId } = req.params;
        
        const payment = await PackagePayment.findById(paymentId)
            .populate('user', 'fullName email phone')
            .populate('packagePlan')
            .lean();
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy giao dịch'
            });
        }
        
        res.status(200).json({
            success: true,
            data: payment
        });
    } catch (error) {
        console.error('Error getting payment:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy thông tin giao dịch',
            error: error.message
        });
    }
};

// Update payment status (Admin only)
export const updatePaymentStatus = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { status, note } = req.body;
        
        const payment = await PackagePayment.findById(paymentId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy giao dịch'
            });
        }
        
        payment.status = status;
        if (note) payment.note = note;
        if (status === 'paid' && !payment.paidAt) {
            payment.paidAt = new Date();
        }
        
        await payment.save();
        
        res.status(200).json({
            success: true,
            message: 'Đã cập nhật trạng thái thanh toán',
            data: payment
        });
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật trạng thái',
            error: error.message
        });
    }
};

// Get payment statistics (Admin only)
export const getPaymentStatistics = async (req, res) => {
    try {
        const total = await PackagePayment.countDocuments();
        const pending = await PackagePayment.countDocuments({ status: 'pending' });
        const paid = await PackagePayment.countDocuments({ status: 'paid' });
        const cancelled = await PackagePayment.countDocuments({ status: 'cancelled' });
        
        // Calculate total revenue
        const paidPayments = await PackagePayment.find({ status: 'paid' }).select('amount').lean();
        const totalRevenue = paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        
        // Revenue by month (last 12 months)
        const revenueByMonth = await PackagePayment.aggregate([
            {
                $match: {
                    status: 'paid',
                    paidAt: {
                        $gte: new Date(new Date().setMonth(new Date().getMonth() - 12))
                    }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$paidAt' },
                        month: { $month: '$paidAt' }
                    },
                    revenue: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);
        
        res.status(200).json({
            success: true,
            data: {
                total,
                pending,
                paid,
                cancelled,
                totalRevenue,
                revenueByMonth
            }
        });
    } catch (error) {
        console.error('Error getting payment statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy thống kê',
            error: error.message
        });
    }
};
