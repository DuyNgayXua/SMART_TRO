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

    // 1. Thống kê người dùng (không tính admin)
    const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } });
    const totalLandlords = await User.countDocuments({ role: 'landlord' });
    const totalTenants = await User.countDocuments({ role: { $in: ['tenant'] } });

    // 2. Thống kê tin đăng - Logic giống như tìm kiếm
    // Chỉ đếm tin đăng: approved, available, chưa xóa, gói còn hiệu lực, đã đến ngày hiển thị
    const now = new Date();
    const totalProperties = await Property.countDocuments({ 
      approvalStatus: 'approved',
      status: 'available',
      isDeleted: { $ne: true },
      $and: [
        {
          $or: [
            { 'packageInfo.expiryDate': { $gt: now } }, // Gói còn hiệu lực
            { 'packageInfo.expiryDate': { $exists: false } }, // Không có gói
            { 'packageInfo.expiryDate': null }
          ]
        },
        {
          $or: [
            { 'packageInfo.isActive': true }, // Gói đang active
            { 'packageInfo.isActive': { $exists: false } }, 
            { 'packageInfo.isActive': null }
          ]
        },
        {
          $or: [
            { availableDate: { $lte: now } }, // Đã đến ngày hiển thị
            { availableDate: { $exists: false } },
            { availableDate: null }
          ]
        }
      ]
    });
    const activeProperties = totalProperties;
    
    console.log('📝 Active properties (matching search criteria):', totalProperties);
    console.log('✅ Properties shown on homepage:', activeProperties);

    // Thiết lập khoảng thời gian cho tháng được chọn
    const selectedMonthStart = new Date(selectedYear, selectedMonth - 1, 1);
    const selectedMonthEnd = new Date(selectedYear, selectedMonth, 1);

    // 3. Thống kê người dùng mới trong tháng (không tính admin)
    const newUsersThisMonth = await User.countDocuments({
      role: { $ne: 'admin' },
      createdAt: {
        $gte: selectedMonthStart,
        $lt: selectedMonthEnd
      }
    });
    
    console.log('👤 New users this month:', newUsersThisMonth);

    // 4. Thống kê gói tin
    const totalPackagePlans = await PackagePlan.countDocuments();
    
    // 5. Thống kê thanh toán gói tin
    const allOrders = await Order.find({ packagePlanId: { $exists: true, $ne: null } })
      .sort({ created_at: -1 })
      .lean();

    console.log('📊 Total orders found:', allOrders.length);
    if (allOrders.length > 0) {
      console.log('📄 Sample order:', JSON.stringify(allOrders[0], null, 2));
    }

    const totalPackagePayments = allOrders.length;
    const paidOrders = allOrders.filter(o => o.payment_status === 'Paid');
    
    console.log('✅ Paid orders:', paidOrders.length);

    // Tính tổng doanh thu
    const totalRevenue = paidOrders.reduce((sum, order) => {
      let amount = 0;
      if (order.total) {
        if (order.total.$numberDecimal) {
          amount = parseFloat(order.total.$numberDecimal);
        } else if (typeof order.total === 'object' && order.total.valueOf) {
          amount = parseFloat(order.total.valueOf());
        } else if (typeof order.total === 'number') {
          amount = order.total;
        }
      }
      return sum + amount;
    }, 0);

    console.log('💰 Total Revenue:', totalRevenue);

    // Tính doanh thu tháng được chọn
    const monthlyRevenue = paidOrders
      .filter(order => {
        const paidDate = order.paid_at ? new Date(order.paid_at) : null;
        return paidDate && paidDate >= selectedMonthStart && paidDate < selectedMonthEnd;
      })
      .reduce((sum, order) => {
        let amount = 0;
        if (order.total) {
          if (order.total.$numberDecimal) {
            amount = parseFloat(order.total.$numberDecimal);
          } else if (typeof order.total === 'object' && order.total.valueOf) {
            amount = parseFloat(order.total.valueOf());
          } else if (typeof order.total === 'number') {
            amount = order.total;
          }
        }
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
          let amount = 0;
          if (order.total) {
            if (order.total.$numberDecimal) {
              amount = parseFloat(order.total.$numberDecimal);
            } else if (typeof order.total === 'object' && order.total.valueOf) {
              amount = parseFloat(order.total.valueOf());
            } else if (typeof order.total === 'number') {
              amount = order.total;
            }
          }
          return sum + amount;
        }, 0);
      
      revenueByMonth.push({
        month: `${monthDate.getMonth() + 1}/${monthDate.getFullYear()}`,
        revenue: monthRevenue
      });
    }

    console.log('📈 Revenue by month:', revenueByMonth);
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
          as: 'packagePlan'
        }
      },
      {
        $unwind: {
          path: '$packagePlan',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          packageName: {
            $ifNull: ['$packagePlan.name', '$packageInfo.name', 'Gói không xác định']
          }
        }
      },
      {
        $group: {
          _id: '$packagePlanId',
          name: { $first: '$packageName' },
          count: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: {
                if: { $eq: [{ $type: '$total' }, 'decimal'] },
                then: { $toDouble: '$total' },
                else: { $ifNull: ['$total', 0] }
              }
            }
          }
        }
      },
      {
        $sort: { revenue: -1 }
      }
    ]);

    // 7. Top người đăng tin nhiều nhất - Dựa trên owner trong Property
    console.log('🔍 Fetching top posters...');
    const topPosters = await Property.aggregate([
      {
        $match: { 
          approvalStatus: 'approved',
          isDeleted: { $ne: true },
          owner: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$owner',
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
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          name: { $ifNull: ['$user.fullName', 'Người dùng không xác định'] },
          email: { $ifNull: ['$user.email', 'N/A'] },
          posts: '$postCount'
        }
      }
    ]);
    
    console.log('👥 Top posters found:', topPosters.length);
    if (topPosters.length > 0) {
      console.log('Sample top poster:', topPosters[0]);
    }

    // 8. Hoạt động gần đây (kết hợp users mới, payments, properties mới)
    const recentActivities = [];

    // Người dùng mới đăng ký (5 gần nhất, không tính admin)
    const recentUsers = await User.find({ role: { $ne: 'admin' } })
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

    // Thanh toán gần đây (5 gần nhất) - dùng aggregate
    const recentPayments = await Order.aggregate([
      {
        $match: {
          packagePlanId: { $exists: true, $ne: null },
          payment_status: 'Paid'
        }
      },
      { $sort: { paid_at: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
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
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$package', preserveNullAndEmptyArrays: true } }
    ]);

    recentPayments.forEach(payment => {
      recentActivities.push({
        type: 'payment',
        action: `Thanh toán ${payment.package?.name || 'gói tin'}`,
        user: payment.user?.email || 'N/A',
        userName: payment.user?.fullName,
        time: getTimeAgo(payment.paid_at)
      });
    });

    // Tin đăng mới (5 gần nhất) - dùng aggregate
    const recentProperties = await Property.aggregate([
      { $sort: { createdAt: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: 'owner',
          foreignField: '_id',
          as: 'ownerInfo'
        }
      },
      { $unwind: { path: '$ownerInfo', preserveNullAndEmptyArrays: true } }
    ]);

    recentProperties.forEach(property => {
      recentActivities.push({
        type: 'property',
        action: 'Đăng tin mới',
        user: property.ownerInfo?.email || 'N/A',
        userName: property.ownerInfo?.fullName,
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
        newUsersThisMonth,
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
