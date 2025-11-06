/**
 * Package Expiry Service - Cron job tự động kiểm tra                                    
 1 phút để đảm bảo không có gói nào hết hạn mà vẫn active
 */
import cron from 'node-cron';
import User from '../schemas/User.js';
import { Property } from '../schemas/index.js';

/**
 * Hàm kiểm tra và xử lý gói hết hạn cho tất cả users
 */
const processExpiredPackages = async () => {
    try {
        console.log('Starting package expiry check...');
        const now = new Date();
        
        // Tìm tất cả users có currentPackagePlan hoặc packageHistory hết hạn nhưng chưa được xử lý
        const users = await User.find({
            $or: [
                { 
                    'currentPackagePlan.expiryDate': { $lt: now },
                    'currentPackagePlan.isActive': { $ne: false }
                },
                { 
                    'packageHistory': {
                        $elemMatch: {
                            'expiryDate': { $lt: now },
                            'status': { $ne: 'expired' }
                        }
                    }
                }
            ]
        });

        let totalProcessed = 0;
        let totalPropertiesUpdated = 0;
        let totalPackagesExpired = 0;

        for (const user of users) {
            try {
                let userUpdated = false;
                
                // 1. Kiểm tra currentPackagePlan
                if (user.currentPackagePlan && user.currentPackagePlan.expiryDate) {
                    const currentExpiryDate = new Date(user.currentPackagePlan.expiryDate);
                    
                    if (currentExpiryDate < now && user.currentPackagePlan.isActive !== false) {
                        console.log(`User ${user._id}: Current package expired on ${currentExpiryDate.toISOString()}`);
                        
                        // Cập nhật currentPackagePlan
                        user.currentPackagePlan.isActive = false;
                        user.currentPackagePlan.status = 'expired';
                        
                        // Cập nhật properties của gói hiện tại
                        const propertiesResult = await Property.updateMany(
                            {
                                owner: user._id,
                                'packageInfo.packageInstanceId': user.currentPackagePlan.packageInstanceId,
                                'packageInfo.isActive': true,
                            },
                            {
                                $set: {
                                    'packageInfo.isActive': false,
                                    'packageInfo.status': 'expired',
                                    'packageInfo.expiryDate': currentExpiryDate,
                                    updatedAt: new Date(),
                                },
                            }
                        );
                        
                        totalPropertiesUpdated += propertiesResult.modifiedCount;
                        totalPackagesExpired++;
                        userUpdated = true;
                        
                        console.log(`Expired current package for user ${user._id}, updated ${propertiesResult.modifiedCount} properties`);
                    }
                }
                
                // 2. Kiểm tra packageHistory
                let historyUpdated = false;
                if (user.packageHistory && user.packageHistory.length > 0) {
                    for (let i = 0; i < user.packageHistory.length; i++) {
                        const historyPackage = user.packageHistory[i];
                        
                        if (historyPackage.expiryDate && historyPackage.status !== 'expired') {
                            const historyExpiryDate = new Date(historyPackage.expiryDate);
                            
                            if (historyExpiryDate < now) {
                                console.log(`User ${user._id}: History package ${historyPackage._id} expired on ${historyExpiryDate.toISOString()}`);
                                
                                // Cập nhật status trong packageHistory
                                user.packageHistory[i].status = 'expired';
                                user.packageHistory[i].isActive = false;
                                user.packageHistory[i].updatedAt = new Date();
                                
                                // Cập nhật properties của gói trong history
                                if (historyPackage.packageInstanceId) {
                                    const historyPropertiesResult = await Property.updateMany(
                                        {
                                            owner: user._id,
                                            'packageInfo.packageInstanceId': historyPackage.packageInstanceId,
                                            'packageInfo.isActive': true,
                                        },
                                        {
                                            $set: {
                                                'packageInfo.isActive': false,
                                                'packageInfo.status': 'expired',
                                                'packageInfo.expiryDate': historyExpiryDate,
                                                updatedAt: new Date(),
                                            },
                                        }
                                    );
                                    
                                    totalPropertiesUpdated += historyPropertiesResult.modifiedCount;
                                    console.log(`Expired history package ${historyPackage._id} for user ${user._id}, updated ${historyPropertiesResult.modifiedCount} properties`);
                                }
                                
                                totalPackagesExpired++;
                                historyUpdated = true;
                            }
                        }
                    }
                }
                
                // 3. Lưu user nếu có cập nhật
                if (userUpdated || historyUpdated) {
                    await user.save();
                    totalProcessed++;
                }
                
            } catch (error) {
                console.error(`Error processing user ${user._id}:`, error);
            }
        }
        
        if (totalProcessed > 0) {
            console.log(`Package expiry check completed: ${totalProcessed} users processed, ${totalPackagesExpired} packages expired, ${totalPropertiesUpdated} properties updated`);
        } else {
            console.log('Package expiry check completed: No expired packages found');
        }
        
    } catch (error) {
        console.error('Error in package expiry check:', error);
    }
};

/**
 * Hàm kiểm tra và xử lý một user cụ thể (dùng khi user login hoặc thực hiện action)
 */
const processExpiredPackagesForUser = async (userId) => {
    try {
        const now = new Date();
        const user = await User.findById(userId);
        
        if (!user) {
            console.log(`User ${userId} not found`);
            return { success: false, message: 'User not found' };
        }
        
        let userUpdated = false;
        let packagesExpired = 0;
        let propertiesUpdated = 0;
        
        // 1. Kiểm tra currentPackagePlan
        if (user.currentPackagePlan && user.currentPackagePlan.expiryDate) {
            const currentExpiryDate = new Date(user.currentPackagePlan.expiryDate);
            
            if (currentExpiryDate < now && user.currentPackagePlan.isActive !== false) {
                user.currentPackagePlan.isActive = false;
                user.currentPackagePlan.status = 'expired';
                user.currentPackagePlan.freePushCount = 0; // Set freePushCount = 0
                
                // Set tất cả propertiesLimits.limit = 0
                if (user.currentPackagePlan.propertiesLimits) {
                    user.currentPackagePlan.propertiesLimits.forEach(limit => {
                        limit.limit = 0;
                    });
                }
                
                // Cập nhật properties của gói hiện tại
                const propertiesResult = await Property.updateMany(
                    {
                        owner: user._id,
                        'packageInfo.packageInstanceId': user.currentPackagePlan.packageInstanceId,
                        'packageInfo.isActive': true,
                    },
                    {
                        $set: {
                            'packageInfo.isActive': false,
                            'packageInfo.status': 'expired',
                            'packageInfo.expiryDate': currentExpiryDate,
                            updatedAt: new Date(),
                        },
                    }
                );
                
                propertiesUpdated += propertiesResult.modifiedCount;
                packagesExpired++;
                userUpdated = true;
                
                console.log(`Auto-expired current package for user ${userId}, updated ${propertiesResult.modifiedCount} properties`);
            }
        }
        
        // 2. Kiểm tra packageHistory
        if (user.packageHistory && user.packageHistory.length > 0) {
            for (let i = 0; i < user.packageHistory.length; i++) {
                const historyPackage = user.packageHistory[i];
                
                if (historyPackage.expiryDate && historyPackage.status !== 'expired') {
                    const historyExpiryDate = new Date(historyPackage.expiryDate);
                    
                    if (historyExpiryDate < now) {
                        user.packageHistory[i].status = 'expired';
                        user.packageHistory[i].updatedAt = new Date();
                        user.packageHistory[i].freePushCount = 0; // Set freePushCount = 0
                        
                        // Set tất cả propertiesLimits.limit = 0
                        if (user.packageHistory[i].propertiesLimits) {
                            user.packageHistory[i].propertiesLimits.forEach(limit => {
                                limit.limit = 0;
                            });
                        }
                        
                        if (historyPackage.packageInstanceId) {
                            const historyPropertiesResult = await Property.updateMany(
                                {
                                    owner: user._id,
                                    'packageInfo.packageInstanceId': historyPackage.packageInstanceId,
                                    'packageInfo.isActive': true,
                                },
                                {
                                    $set: {
                                        'packageInfo.isActive': false,
                                        'packageInfo.status': 'expired',
                                        'packageInfo.expiryDate': historyExpiryDate,
                                        updatedAt: new Date(),
                                    },
                                }
                            );
                            
                            propertiesUpdated += historyPropertiesResult.modifiedCount;
                            console.log(`Auto-expired history package ${historyPackage._id} for user ${userId}, updated ${historyPropertiesResult.modifiedCount} properties`);
                        }
                        
                        packagesExpired++;
                        userUpdated = true;
                    }
                }
            }
        }
        
        // 3. Lưu user nếu có cập nhật
        if (userUpdated) {
            await user.save();
        }
        
        return {
            success: true,
            packagesExpired,
            propertiesUpdated,
            userUpdated
        };
        
    } catch (error) {
        console.error(`Error processing expired packages for user ${userId}:`, error);
        return { success: false, error: error.message };
    }
};

/**
 * Khởi tạo cron job
 */
const initPackageExpiryCron = () => {
    // Chạy mỗi 1 phút để kiểm tra gói hết hạn
    cron.schedule('*/1 * * * *', () => {
        console.log('Running scheduled package expiry check...');
        processExpiredPackages();
    }, {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh"
    });
    
    // Chạy mỗi ngày lúc 00:00 để đảm bảo
    cron.schedule('0 0 * * *', () => {
        console.log('Running daily package expiry check...');
        processExpiredPackages();
    }, {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh"
    });
    
    console.log('Package expiry cron jobs initialized');
    console.log('   Every 1 minutes: */1 * * * *');
    console.log('   Daily at midnight: 0 0 * * *');
    
    // Chạy ngay lập tức khi khởi động (delay 5 giây)
    setTimeout(() => {
        console.log('Running initial package expiry check...');
        processExpiredPackages();
    }, 5000);
};



export {
    initPackageExpiryCron,
    processExpiredPackages,
    processExpiredPackagesForUser
};