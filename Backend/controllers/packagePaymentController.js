import Order from '../schemas/Order.js';
import User from '../schemas/User.js';
import PackagePlan from '../schemas/PackagePlan.js';

// Get all package payments (Admin only)
export const getPackagePayments = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, search, fromDate, toDate } = req.query;
        
        // Build filter - chỉ lấy orders có packagePlanId (là thanh toán gói tin)
        const filter = {
            packagePlanId: { $exists: true, $ne: null }
        };
        
        if (status && status !== 'all' && status !== '') {
            filter.payment_status = status === 'paid' ? 'Paid' : status === 'pending' ? 'Unpaid' : status.charAt(0).toUpperCase() + status.slice(1);
        }
        
        // Date range filter
        if (fromDate || toDate) {
            filter.created_at = {};
            if (fromDate) {
                filter.created_at.$gte = new Date(fromDate);
            }
            if (toDate) {
                // Set to end of day
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);
                filter.created_at.$lte = endDate;
            }
        }
        
        // Get payments with populated data
        let query = Order.find(filter)
            .populate('userId', 'fullName email phone')
            .populate('packagePlanId', 'name duration price maxRooms maxPosts')
            .sort({ created_at: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const payments = await query.lean();
        
        // Filter by search term if provided
        let filteredPayments = payments;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredPayments = payments.filter(payment => 
                payment.userId?.fullName?.toLowerCase().includes(searchLower) ||
                payment.userId?.email?.toLowerCase().includes(searchLower) ||
                payment.transactionId?.toString().toLowerCase().includes(searchLower) ||
                payment._id.toString().includes(searchLower)
            );
        }
        
        // Get total count
        const total = await Order.countDocuments(filter);
        
        // Format response to match frontend expectations
        const formattedPayments = filteredPayments.map(payment => {
            // Map status từ Order schema sang frontend format
            let statusFormatted = 'pending';
            if (payment.payment_status === 'Paid') {
                statusFormatted = 'paid';
            } else if (payment.payment_status === 'Unpaid') {
                statusFormatted = 'pending';
            } else if (payment.payment_status === 'Cancelled') {
                statusFormatted = 'cancelled';
            } else if (payment.payment_status === 'Refunded') {
                statusFormatted = 'refunded';
            }
            
            return {
                _id: payment._id,
                user: payment.userId,
                packagePlan: payment.packagePlanId,
                amount: payment.total ? parseFloat(payment.total.toString()) : 0,
                transactionId: payment.transactionId?.toString() || payment._id.toString(),
                paymentMethod: payment.paymentMethod || 'vnpay',
                status: statusFormatted,
                createdAt: payment.created_at,
                paidAt: payment.paid_at,
                packageInfo: payment.packageInfo
            };
        });
        
        res.status(200).json({
            success: true,
            data: {
                payments: formattedPayments,
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
        
        const payment = await Order.findById(paymentId)
            .populate('userId', 'fullName email phone')
            .populate('packagePlanId')
            .lean();
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy giao dịch'
            });
        }
        
        res.status(200).json({
            success: true,
            data: {
                _id: payment._id,
                user: payment.userId,
                packagePlan: payment.packagePlanId,
                amount: payment.total ? parseFloat(payment.total.toString()) : 0,
                transactionId: payment.transactionId?.toString() || payment._id.toString(),
                paymentMethod: payment.paymentMethod || 'vnpay',
                status: payment.payment_status,
                createdAt: payment.created_at,
                paidAt: payment.paid_at,
                packageInfo: payment.packageInfo
            }
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
        
        const payment = await Order.findById(paymentId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy giao dịch'
            });
        }
        
        // Map status từ frontend sang Order schema
        if (status === 'paid') {
            payment.payment_status = 'Paid';
            if (!payment.paid_at) {
                payment.paid_at = new Date();
            }
        } else if (status === 'pending') {
            payment.payment_status = 'Unpaid';
        } else if (status === 'cancelled') {
            payment.payment_status = 'Cancelled';
        }
        
        if (note) payment.note = note;
        
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
        const filter = { packagePlanId: { $exists: true, $ne: null } };
        
        const total = await Order.countDocuments(filter);
        const pending = await Order.countDocuments({ ...filter, payment_status: 'Unpaid' });
        const paid = await Order.countDocuments({ ...filter, payment_status: 'Paid' });
        const cancelled = await Order.countDocuments({ ...filter, payment_status: 'Cancelled' });
        
        // Calculate total revenue
        const paidPayments = await Order.find({ ...filter, payment_status: 'Paid' }).select('total').lean();
        const totalRevenue = paidPayments.reduce((sum, p) => sum + (p.total ? parseFloat(p.total.toString()) : 0), 0);
        
        // Revenue by month (last 12 months)
        const revenueByMonth = await Order.aggregate([
            {
                $match: {
                    packagePlanId: { $exists: true, $ne: null },
                    payment_status: 'Paid',
                    paid_at: {
                        $gte: new Date(new Date().setMonth(new Date().getMonth() - 12))
                    }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$paid_at' },
                        month: { $month: '$paid_at' }
                    },
                    revenue: { $sum: { $toDouble: '$total' } },
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
