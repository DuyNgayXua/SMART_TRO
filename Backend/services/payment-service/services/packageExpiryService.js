/**
 * Package Expiry Service - Tự động cập nhật các gói tin hết hạn
 */
import { Property } from '../../../schemas/index.js';
import cron from 'node-cron';

class PackageExpiryService {
    constructor() {
        this.isRunning = false;
    }

    /**
     * Khởi động service kiểm tra gói hết hạn
     */
    start() {
        if (this.isRunning) {
            console.log('Package Expiry Service is already running');
            return;
        }

        console.log('Starting Package Expiry Service...');
        
        // Chạy mỗi giờ để kiểm tra các gói hết hạn
        this.cronJob = cron.schedule('0 * * * *', async () => {
            await this.processExpiredPackages();
        }, {
            scheduled: false
        });

        this.cronJob.start();
        this.isRunning = true;
        
        console.log('Package Expiry Service started successfully');
    }

    /**
     * Dừng service
     */
    stop() {
        if (!this.isRunning) {
            console.log('Package Expiry Service is not running');
            return;
        }

        console.log('Stopping Package Expiry Service...');
        
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob.destroy();
        }
        
        this.isRunning = false;
        console.log('Package Expiry Service stopped');
    }

    /**
     * Xử lý các gói đã hết hạn
     */
    async processExpiredPackages() {
        try {
            console.log('Checking for expired packages...');
            
            const now = new Date();
            
            // Tìm các properties có gói active nhưng đã hết hạn
            const expiredPackages = await Property.find({
                'packageInfo.isActive': true,
                'packageInfo.expiryDate': { $lt: now },
                'packageInfo.status': { $ne: 'expired' }
            });

            if (expiredPackages.length === 0) {
                console.log('No expired packages found');
                return;
            }

            console.log(`Found ${expiredPackages.length} expired packages to update`);

            // Cập nhật từng package
            let updatedCount = 0;
            for (const property of expiredPackages) {
                try {
                    await this.expirePackage(property);
                    updatedCount++;
                } catch (error) {
                    console.error(`Error expiring package for property ${property._id}:`, error);
                }
            }

            console.log(`Successfully updated ${updatedCount}/${expiredPackages.length} expired packages`);

        } catch (error) {
            console.error('Error processing expired packages:', error);
        }
    }

    /**
     * Cập nhật một gói đã hết hạn
     * @param {Object} property - Property object
     */
    async expirePackage(property) {
        try {
            // Kiểm tra lại trạng thái trước khi cập nhật (tránh race condition)
            const currentProperty = await Property.findById(property._id);
            if (!currentProperty || !currentProperty.packageInfo || !currentProperty.packageInfo.isActive) {
                console.log(`Property ${property._id} package is no longer active, skipping expiration`);
                return;
            }

            const now = new Date();
            if (new Date(currentProperty.packageInfo.expiryDate) >= now) {
                console.log(`Property ${property._id} package is not yet expired, skipping`);
                return;
            }

            // Cập nhật trạng thái gói
            currentProperty.packageInfo.isActive = false;
            currentProperty.packageInfo.status = 'expired';
            // Giữ nguyên expiryDate gốc vì nó đã chính xác thời điểm hết hạn
            currentProperty.packageInfo.expiredAt = now; // Timestamp khi phát hiện hết hạn

            await currentProperty.save();

            console.log(`Expired package for property ${property._id} (expired: ${currentProperty.packageInfo.expiryDate})`);

        } catch (error) {
            console.error(`Error expiring package for property ${property._id}:`, error);
            throw error;
        }
    }

    /**
     * Kiểm tra trạng thái service
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            nextRun: this.cronJob ? this.cronJob.nextDate() : null,
            checkInterval: '1 hour'
        };
    }

    /**
     * Chạy ngay lập tức (cho testing)
     */
    async runNow() {
        console.log('Running package expiry check immediately...');
        await this.processExpiredPackages();
    }

    /**
     * Thống kê gói hết hạn trong khoảng thời gian
     * @param {Date} startDate 
     * @param {Date} endDate 
     */
    async getExpiredPackagesStats(startDate, endDate) {
        try {
            const stats = await Property.aggregate([
                {
                    $match: {
                        'packageInfo.status': 'expired',
                        'packageInfo.expiredAt': {
                            $gte: startDate || new Date(Date.now() - 24 * 60 * 60 * 1000), // 24h ago default
                            $lte: endDate || new Date()
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalExpired: { $sum: 1 }
                    }
                }
            ]);

            return stats[0] || { totalExpired: 0 };
        } catch (error) {
            console.error('Error getting expired packages stats:', error);
            return { totalExpired: 0 };
        }
    }
}

// Tạo singleton instance
const packageExpiryService = new PackageExpiryService();

export default packageExpiryService;
