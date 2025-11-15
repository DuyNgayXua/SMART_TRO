import User from '../schemas/User.js';
import Property from '../schemas/Property.js';
import Order from '../schemas/Order.js';
import PackagePlan from '../schemas/PackagePlan.js';

// Lấy thống kê tổng quan cho admin dashboard
export const getDashboardStats = async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentDate = new Date();
    const selectedMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
    const selectedYear = year ? parseInt(year) : currentDate.getFullYear();

    // 1. Thống kê người dùng
    const totalUsers = await User.countDocuments();
    const totalLandlords = await User.countDocuments({ role: 'landlord' });
    const totalTenants = await User.countDocuments({ role: { $in: ['user', 'tenant'] } });

    // 2. Thống kê tin đăng
    const totalProperties = await Property.countDocuments();
    const activeProperties = await Property.countDocuments({ status: 'approved' });

    // 3. Thống kê gói tin
    const totalPackagePlans = await PackagePlan.countDocuments();
    
    // 4. Thống kê thanh toán gói tin
    const allOrders = await Order.find({ packagePlanId: { $exists: true, $ne: null } })
      .populate('userId', 'fullName email')
      .populate('packagePlanId', 'name price')
      .sort({ created_at: -1 });

    const totalPackagePayments = allOrders.length;
    const paidOrders = allOrders.filter(o => o.payment_status === 'Paid');

    // Tính tổng doanh thu
    const totalRevenue = paidOrders.reduce((sum, order) => {
      const amount = order.total?.$numberDecimal 
        ? parseFloat(order.total.$numberDecimal) 
        : (typeof order.total === 'number' ? order.total : 0);
      return sum + amount;
    }, 0);

    // Tính doanh thu tháng được chọn
    const selectedMonthStart = new Date(selectedYear, selectedMonth - 1, 1);
    const selectedMonthEnd = new Date(selectedYear, selectedMonth, 1);
    
    const monthlyRevenue = paidOrders
      .filter(order => {
        const paidDate = order.paid_at ? new Date(order.paid_at) : null;
        return paidDate && paidDate >= selectedMonthStart && paidDate < selectedMonthEnd;
      })
      .reduce((sum, order) => {
        const amount = order.total?.$numberDecimal 
          ? parseFloat(order.total.$numberDecimal) 
          : (typeof order.total === 'number' ? order.total : 0);
        return sum + amount;
      }, 0);

    // 5. Doanh thu theo tháng (6 tháng gần nhất)
    const revenueByMonth = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 1);
      
      const monthRevenue = paidOrders
        .filter(order => {
          const paidDate = order.paid_at ? new Date(order.paid_at) : null;
          return paidDate && paidDate >= monthDate && paidDate < nextMonthDate;
        })
        .reduce((sum, order) => {
          const amount = order.total?.$numberDecimal 
            ? parseFloat(order.total.$numberDecimal) 
            : (typeof order.total === 'number' ? order.total : 0);
          return sum + amount;
        }, 0);
      
      revenueByMonth.push({
        month: `${monthDate.getMonth() + 1}/${monthDate.getFullYear()}`,
        revenue: monthRevenue
      });
    }

    // 6. Thống kê theo gói tin
    const packageStats = await Order.aggregate([
      {
        $match: {
          packagePlanId: { $exists: true, $ne: null },
          payment_status: 'Paid'
        }
      },
      {
        $lookup: {
          from: 'packageplans',
          localField: 'packagePlanId',
          foreignField: '_id',
          as: 'package'
        }
      },
      {
        $unwind: '$package'
      },
      {
        $group: {
          _id: '$packagePlanId',
          name: { $first: '$package.name' },
          count: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: {
                if: { $eq: [{ $type: '$total' }, 'decimal'] },
                then: { $toDouble: '$total' },
                else: '$total'
              }
            }
          }
        }
      },
      {
        $sort: { revenue: -1 }
      }
    ]);

    // 7. Top người đăng tin nhiều nhất
    const topPosters = await Property.aggregate([
      {
        $match: { status: 'approved' }
      },
      {
        $group: {
          _id: '$userId',
          postCount: { $sum: 1 }
        }
      },
      {
        $sort: { postCount: -1 }
      },
      {
        $limit: 5
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $lookup: {
          from: 'orders',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$userId', '$$userId'] },
                payment_status: 'Paid',
                packagePlanId: { $exists: true, $ne: null }
              }
            }
          ],
          as: 'orders'
        }
      },
      {
        $project: {
          name: '$user.fullName',
          email: '$user.email',
          posts: '$postCount',
          revenue: {
            $reduce: {
              input: '$orders',
              initialValue: 0,
              in: {
                $add: [
                  '$$value',
                  {
                    $cond: {
                      if: { $eq: [{ $type: '$$this.total' }, 'decimal'] },
                      then: { $toDouble: '$$this.total' },
                      else: { $ifNull: ['$$this.total', 0] }
                    }
                  }
                ]
              }
            }
          }
        }
      }
    ]);

    // 8. Hoạt động gần đây (kết hợp users mới, payments, properties mới)
    const recentActivities = [];

    // Người dùng mới đăng ký (5 gần nhất)
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('email fullName createdAt');

    recentUsers.forEach(user => {
      recentActivities.push({
        type: 'user',
        action: 'Người dùng mới đăng ký',
        user: user.email,
        userName: user.fullName,
        time: getTimeAgo(user.createdAt)
      });
    });

    // Thanh toán gần đây (5 gần nhất)
    const recentPayments = await Order.find({
      packagePlanId: { $exists: true, $ne: null },
      payment_status: 'Paid'
    })
      .populate('userId', 'email fullName')
      .populate('packagePlanId', 'name')
      .sort({ paid_at: -1 })
      .limit(5);

    recentPayments.forEach(payment => {
      recentActivities.push({
        type: 'payment',
        action: `Thanh toán ${payment.packagePlanId?.name || 'gói tin'}`,
        user: payment.userId?.email || 'N/A',
        userName: payment.userId?.fullName,
        time: getTimeAgo(payment.paid_at)
      });
    });

    // Tin đăng mới (5 gần nhất)
    const recentProperties = await Property.find()
      .populate('userId', 'email fullName')
      .sort({ createdAt: -1 })
      .limit(5);

    recentProperties.forEach(property => {
      recentActivities.push({
        type: 'property',
        action: 'Đăng tin mới',
        user: property.userId?.email || 'N/A',
        userName: property.userId?.fullName,
        propertyTitle: property.title,
        time: getTimeAgo(property.createdAt)
      });
    });

    // Sắp xếp theo thời gian
    recentActivities.sort((a, b) => {
      const timeA = parseTimeAgo(a.time);
      const timeB = parseTimeAgo(b.time);
      return timeA - timeB;
    });

    // Lấy 10 hoạt động gần nhất
    const latestActivities = recentActivities.slice(0, 10);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalLandlords,
        totalTenants,
        totalProperties,
        activeProperties,
        totalPackagePlans,
        totalPackagePayments,
        totalRevenue,
        monthlyRevenue,
        revenueByMonth,
        packageStats,
        topPosters,
        recentActivities: latestActivities
      }
    });

  } catch (error) {
    console.error('Error getting admin dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thống kê',
      error: error.message
    });
  }
};

// Helper function: Tính thời gian đã qua
function getTimeAgo(date) {
  if (!date) return 'Không rõ';
  
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffMs / 604800000);
  const diffMonths = Math.floor(diffMs / 2592000000);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 7) return `${diffDays} ngày trước`;
  if (diffWeeks < 4) return `${diffWeeks} tuần trước`;
  return `${diffMonths} tháng trước`;
}

// Helper function: Parse time ago để sắp xếp
function parseTimeAgo(timeStr) {
  if (timeStr === 'Vừa xong') return 0;
  if (timeStr === 'Không rõ') return Infinity;
  
  const match = timeStr.match(/(\d+)\s+(phút|giờ|ngày|tuần|tháng)/);
  if (!match) return Infinity;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  const multipliers = {
    'phút': 1,
    'giờ': 60,
    'ngày': 1440,
    'tuần': 10080,
    'tháng': 43200
  };
  
  return value * (multipliers[unit] || 1);
}
