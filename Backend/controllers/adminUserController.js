import User from '../schemas/User.js';
import PropertiesPackage from '../schemas/PropertiesPackage.js';
import Property from '../schemas/Property.js';

// Get all users with filters
export const getUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, role, status, search } = req.query;
        
        // Build filter query
        const filter = {};
        
        if (role && role !== 'all') {
            filter.role = role;
        }
        
        if (status && status !== 'all') {
            filter.status = status;
        }
        
        if (search) {
            filter.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }
        
        // Get total count
        const total = await User.countDocuments(filter);
        
        // Get paginated users
        const users = await User.find(filter)
            .select('fullName email phone avatar role isActive createdAt')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .lean();
        
        // Map isActive to status for frontend compatibility
        const mappedUsers = users.map(user => ({
            ...user,
            phoneNumber: user.phone, // Map phone to phoneNumber for frontend
            status: user.isActive ? 'active' : 'blocked'
        }));
        
        // Get statistics
        const stats = {
            total: await User.countDocuments(),
            landlord: await User.countDocuments({ role: 'landlord' }),
            tenant: await User.countDocuments({ role: 'tenant' }), // tenant thay vì user
            user: await User.countDocuments({ role: 'tenant' }), // Alias for frontend
            admin: await User.countDocuments({ role: 'admin' }),
            active: await User.countDocuments({ isActive: true }),
            blocked: await User.countDocuments({ isActive: false })
        };
        
        res.status(200).json({
            success: true,
            data: {
                users: mappedUsers,
                stats,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalUsers: total,
                    limit: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách người dùng',
            error: error.message
        });
    }
};

// Toggle block/unblock user
export const toggleBlockUser = async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
        }
        
        // Don't allow blocking admin users
        if (user.role === 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Không thể khóa tài khoản quản trị viên'
            });
        }
        
        // Toggle isActive status
        user.isActive = !user.isActive;
        await user.save();
        
        res.status(200).json({
            success: true,
            message: !user.isActive ? 'Đã khóa người dùng' : 'Đã mở khóa người dùng',
            data: {
                userId: user._id,
                status: user.isActive ? 'active' : 'blocked'
            }
        });
    } catch (error) {
        console.error('Error toggling block user:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thay đổi trạng thái người dùng',
            error: error.message
        });
    }
};

// Get user details
export const getUserDetails = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await User.findById(userId)
            .select('-password')
            .populate('properties', 'title status')
            .populate('contracts', 'contractNumber status');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
        }
        
        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error getting user details:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy thông tin người dùng',
            error: error.message
        });
    }
};

// Update user role
export const updateUserRole = async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;
        
        if (!['tenant', 'landlord', 'admin'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Vai trò không hợp lệ'
            });
        }
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
        }
        
        user.role = role;
        await user.save();
        
        res.status(200).json({
            success: true,
            message: 'Đã cập nhật vai trò người dùng',
            data: {
                userId: user._id,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật vai trò người dùng',
            error: error.message
        });
    }
};

// Get user packages
export const getUserPackages = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await User.findById(userId)
            .populate('currentPackagePlan.packagePlanId')
            .lean();
            
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
        }
        
        // Đếm số bài đăng thực tế của user
        const totalPosts = await Property.countDocuments({ owner: userId });
        
        let propertyPackage = null;
        let postPackage = null;
        
        // Nếu là landlord, lấy gói quản lý trọ
        if (user.role === 'landlord') {
            // Tìm gói đang active của landlord
            const activePackage = await PropertiesPackage.findOne({
                landlordId: userId,
                status: 'active'
            })
            .populate('packagePlanId')
            .sort({ expiryDate: -1 })
            .lean();
            
            if (activePackage && activePackage.packagePlanId) {
                // Đếm số phòng đã dùng
                const properties = await Property.find({ landlordId: userId });
                const usedRooms = properties.reduce((total, property) => {
                    return total + (property.rooms ? property.rooms.length : 0);
                }, 0);
                
                propertyPackage = {
                    packageName: activePackage.packagePlanId.name,
                    maxRooms: activePackage.packagePlanId.maxRooms,
                    usedRooms: usedRooms,
                    expiryDate: activePackage.expiryDate
                };
            }
        }
        
        // Nếu là tenant/user/admin, lấy gói đăng tin từ currentPackagePlan hoặc freeTrial
        if (user.role === 'tenant' || user.role === 'user' || user.role === 'admin') {
            // Ưu tiên lấy currentPackagePlan trước
            if (user.currentPackagePlan && user.currentPackagePlan.packagePlanId) {
                const packagePlan = user.currentPackagePlan.packagePlanId;
                
                postPackage = {
                    packageName: user.currentPackagePlan.displayName || user.currentPackagePlan.packageName || packagePlan.name,
                    packageType: user.packageType || 'trial',
                    priority: user.currentPackagePlan.priority || packagePlan.priority,
                    stars: user.currentPackagePlan.stars || packagePlan.stars,
                    color: user.currentPackagePlan.color || packagePlan.color,
                    totalPosts: packagePlan.maxProperties || packagePlan.properties || 0,
                    usedPosts: totalPosts,
                    totalPushes: user.currentPackagePlan.freePushCount || 0,
                    usedPushes: user.currentPackagePlan.usedPushCount || 0,
                    purchaseDate: user.currentPackagePlan.purchaseDate,
                    expiryDate: user.currentPackagePlan.expiryDate,
                    status: user.currentPackagePlan.status,
                    isActive: user.currentPackagePlan.isActive
                };
            }
            // Nếu không có currentPackagePlan, check freeTrial
            else if (user.freeTrial && user.freeTrial.hasRegistered) {
                postPackage = {
                    packageName: 'Gói Dùng Thử',
                    packageType: 'trial',
                    priority: 0,
                    stars: 0,
                    color: '#gray',
                    totalPosts: 3, // Gói trial thường cho phép 3 tin
                    usedPosts: totalPosts,
                    totalPushes: 0,
                    usedPushes: 0,
                    purchaseDate: user.freeTrial.registeredAt,
                    expiryDate: user.freeTrial.expiryDate,
                    status: new Date(user.freeTrial.expiryDate) < new Date() ? 'expired' : 'active',
                    isActive: new Date(user.freeTrial.expiryDate) >= new Date()
                };
            }
        }
        
        // Nếu landlord cũng có currentPackagePlan (trường hợp đặc biệt), lấy luôn
        if (user.role === 'landlord' && !propertyPackage) {
            // Ưu tiên lấy currentPackagePlan
            if (user.currentPackagePlan && user.currentPackagePlan.packagePlanId) {
                const packagePlan = user.currentPackagePlan.packagePlanId;
                
                propertyPackage = {
                    packageName: user.currentPackagePlan.displayName || user.currentPackagePlan.packageName || packagePlan.name,
                    packageType: user.packageType || 'trial',
                    priority: user.currentPackagePlan.priority || packagePlan.priority,
                    stars: user.currentPackagePlan.stars || packagePlan.stars,
                    color: user.currentPackagePlan.color || packagePlan.color,
                    totalPosts: packagePlan.maxRooms || packagePlan.maxProperties || 0,
                    usedPosts: totalPosts,
                    totalPushes: user.currentPackagePlan.freePushCount || 0,
                    usedPushes: user.currentPackagePlan.usedPushCount || 0,
                    purchaseDate: user.currentPackagePlan.purchaseDate,
                    expiryDate: user.currentPackagePlan.expiryDate,
                    status: user.currentPackagePlan.status,
                    isActive: user.currentPackagePlan.isActive
                };
            }
            // Nếu không có, check freeTrial
            else if (user.freeTrial && user.freeTrial.hasRegistered) {
                propertyPackage = {
                    packageName: 'Gói Dùng Thử',
                    packageType: 'trial',
                    priority: 0,
                    stars: 0,
                    color: '#gray',
                    totalPosts: 3,
                    usedPosts: totalPosts,
                    totalPushes: 0,
                    usedPushes: 0,
                    purchaseDate: user.freeTrial.registeredAt,
                    expiryDate: user.freeTrial.expiryDate,
                    status: new Date(user.freeTrial.expiryDate) < new Date() ? 'expired' : 'active',
                    isActive: new Date(user.freeTrial.expiryDate) >= new Date()
                };
            }
        }
        
        res.status(200).json({
            success: true,
            data: {
                propertyPackage,
                postPackage
            }
        });
    } catch (error) {
        console.error('Error getting user packages:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy thông tin gói',
            error: error.message
        });
    }
};
