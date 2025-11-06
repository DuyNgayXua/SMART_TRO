/**
 * Package Plan Controller - Quản lý các gói tin đăng
 */
import PackagePlan from '../../../schemas/PackagePlan.js';
import PropertiesPackage from '../../../schemas/PropertiesPackage.js';
import User from '../../../schemas/User.js';
import mongoose from 'mongoose';

class PackagePlanController {
    // Lấy danh sách các gói tin cho user
    async getPackagePlans(req, res) {
        try {
            const packages = await PackagePlan.find({ isActive: true })
                .populate('propertiesLimits.packageType', 'name displayName color priority')
                .sort({ priority: -1, price: 1 });

            // Transform data để frontend dễ sử dụng
            const packageOptions = packages.map(pkg => ({
                _id: pkg._id,
                name: pkg.name,
                displayName: pkg.displayName,
                description: pkg.description,
                price: pkg.price,
                duration: pkg.duration,
                durationUnit: pkg.durationUnit || 'month', // Mặc định là tháng để tương thích
                freePushCount: pkg.freePushCount,
                propertiesLimits: pkg.propertiesLimits
                    .map(limit => ({
                        packageType: limit.packageType,
                        limit: limit.limit,
                        priority: limit.packageType?.priority || 0
                    }))
                    .sort((a, b) => a.priority - b.priority),
                isActive: pkg.isActive,
                // Tính tổng số tin có thể đăng
                totalPosts: pkg.propertiesLimits.reduce((sum, item) => sum + item.limit, 0),
                // Tính giá trung bình mỗi tin
                pricePerPost: pkg.propertiesLimits.reduce((sum, item) => sum + item.limit, 0) > 0 
                    ? Math.round(pkg.price / pkg.propertiesLimits.reduce((sum, item) => sum + item.limit, 0))
                    : pkg.price,
                createdAt: pkg.createdAt,
                updatedAt: pkg.updatedAt
            }));

            res.json({
                success: true,
                message: 'Lấy danh sách gói tin thành công',
                data: packageOptions
            });

        } catch (error) {
            console.error('Error getting package plans:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Lấy thông tin chi tiết một gói
    async getPackagePlanById(req, res) {
        try {
            const { planId } = req.params;
            
            const packagePlan = await PackagePlan.findById(planId)
                .populate('propertiesLimits.packageType', 'name displayName color priority');
                
            if (!packagePlan || !packagePlan.isActive) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy gói tin'
                });
            }

            res.json({
                success: true,
                message: 'Lấy thông tin gói tin thành công',
                data: packagePlan
            });

        } catch (error) {
            console.error('Error getting package plan by ID:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Lấy danh sách PropertiesPackage để chọn khi tạo PackagePlan
    async getPropertiesPackages(req, res) {
        try {
            const propertiesPackages = await PropertiesPackage.find({ isActive: true })
                .sort({ priority: 1 })
                .select('name displayName color priority description')
                .lean();

            res.json({
                success: true,
                message: 'Lấy danh sách loại tin thành công',
                data: propertiesPackages
            });

        } catch (error) {
            console.error('Error getting properties packages:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Admin: Lấy tất cả gói tin (bao gồm inactive)
    async getAllPackagePlans(req, res) {
        try {
            const packages = await PackagePlan.find()
                .populate('propertiesLimits.packageType', 'name displayName color priority description')
                .sort({ createdAt: -1 });

            // Transform data để admin dễ sử dụng
            const packageOptions = packages.map(pkg => ({
                _id: pkg._id,
                name: pkg.name,
                type: pkg.type || 'custom', // Thêm type field
                displayName: pkg.displayName,
                description: pkg.description,
                price: pkg.price,
                duration: pkg.duration || pkg.durationDays || 30, // Backward compatibility
                durationUnit: pkg.durationUnit || 'day', // Mặc định là ngày để tương thích
                freePushCount: pkg.freePushCount,
                propertiesLimits: pkg.propertiesLimits
                    .map(limit => ({
                        packageType: limit.packageType,
                        limit: limit.limit,
                        priority: limit.packageType?.priority || 0
                    }))
                    .sort((a, b) => a.priority - b.priority),
                isActive: pkg.isActive,
                // Tính tổng số tin có thể đăng
                totalPosts: pkg.propertiesLimits.reduce((sum, item) => sum + item.limit, 0),
                createdAt: pkg.createdAt,
                updatedAt: pkg.updatedAt
            }));

            res.json({
                success: true,
                message: 'Lấy danh sách gói tin thành công',
                data: packageOptions
            });

        } catch (error) {
            console.error('Error getting all package plans:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Admin: Tạo gói tin mới
    async createPackagePlan(req, res) {
        try {
            const {
                name,
                type,
                displayName,
                description,
                price,
                duration,
                durationUnit,
                durationDays, // Backward compatibility
                freePushCount,
                propertiesLimits,
                isActive
            } = req.body;
            console.log('Creating package plan with data:', req.body);

            // Validate required fields
            if (!displayName || displayName.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Tên hiển thị không được rỗng'
                });
            }

            if (!description || description.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Mô tả không được rỗng'
                });
            }

            // Validate giá không được undefined/null/empty và phải >= 0 (bao gồm 0 cho gói miễn phí)
            if (price === undefined || price === null || price === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Giá không được rỗng'
                });
            }

            const priceNum = Number(price);
            if (isNaN(priceNum) || priceNum < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Giá phải là số và lớn hơn hoặc bằng 0 (có thể là 0 cho gói miễn phí)'
                });
            }

            if (freePushCount === undefined || freePushCount === null || freePushCount === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Lượt đẩy tin không được rỗng'
                });
            }

            // Validate displayName không chứa ký tự đặc biệt
            const specialCharsRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/;
            if (specialCharsRegex.test(displayName)) {
                return res.status(400).json({
                    success: false,
                    message: 'Tên hiển thị không được chứa ký tự đặc biệt'
                });
            }

            // Validate lượt đẩy tin phải lớn hơn hoặc bằng 0
            const freePushCountNum = Number(freePushCount);
            if (isNaN(freePushCountNum) || freePushCountNum < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Lượt đẩy tin phải là số và lớn hơn hoặc bằng 0'
                });
            }

            // Validate thời hạn - cho phép 0 hoặc null cho gói trial
            if (duration !== undefined && duration !== null) {
                const durationNum = Number(duration);
                if (isNaN(durationNum) || durationNum < 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Thời hạn phải là số và lớn hơn hoặc bằng 0'
                    });
                }
                
                // Nếu không phải gói trial, duration phải > 0
                if (type !== 'trial' && durationNum <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Thời hạn phải lớn hơn 0 cho các gói không phải trial'
                    });
                }
            }

            // Generate unique name if not provided
            let packageName = name;
            if (!packageName) {
                // Tạo name từ displayName (loại bỏ ký tự đặc biệt, chuyển thành lowercase)
                packageName = displayName
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '') // Loại bỏ dấu
                    .replace(/[^a-z0-9\s]/g, '') // Chỉ giữ chữ, số và khoảng trắng
                    .replace(/\s+/g, '_') // Thay khoảng trắng bằng underscore
                    .substring(0, 40); // Giới hạn độ dài
            }

            // Đảm bảo name là unique
            let uniqueName = packageName;
            let counter = 1;
            while (await PackagePlan.findOne({ name: uniqueName })) {
                uniqueName = `${packageName}_${counter}`;
                counter++;
            }

            // Validate propertiesLimits format
            if (propertiesLimits && Array.isArray(propertiesLimits)) {
                for (let limit of propertiesLimits) {
                    if (!limit.packageType || !mongoose.Types.ObjectId.isValid(limit.packageType)) {
                        return res.status(400).json({
                            success: false,
                            message: 'ID loại tin không hợp lệ'
                        });
                    }
                    
                    // Kiểm tra PropertiesPackage tồn tại
                    const packageExists = await PropertiesPackage.findById(limit.packageType);
                    if (!packageExists) {
                        return res.status(400).json({
                            success: false,
                            message: `Loại tin ${limit.packageType} không tồn tại`
                        });
                    }
                }
            }

            // Xử lý duration và durationUnit với backward compatibility và support cho gói trial
            let finalDuration, finalDurationUnit;
            
            // Nếu là gói trial và có duration/durationUnit được set explicitly
            if (type === 'trial') {
                finalDuration = duration !== undefined ? duration : 0; // Mặc định 0 cho trial
                finalDurationUnit = durationUnit !== undefined ? durationUnit : null; // Mặc định null cho trial
            } else {
                // Các gói khác
                finalDuration = duration || 1;
                finalDurationUnit = durationUnit || 'month';
                
                // Backward compatibility: convert durationDays to duration/durationUnit
                if (durationDays && !duration) {
                    finalDuration = durationDays;
                    finalDurationUnit = 'day';
                }
            }

            const packagePlan = new PackagePlan({
                name: uniqueName,
                type: type || 'custom', // Mặc định là custom nếu không có
                displayName,
                description,
                price,
                duration: finalDuration,
                durationUnit: finalDurationUnit,
                freePushCount: freePushCount || 0,
                propertiesLimits: propertiesLimits || [],
                isActive: isActive !== undefined ? isActive : true // Lấy từ request body, mặc định true
            });

            await packagePlan.save();

            res.status(201).json({
                success: true,
                message: 'Tạo gói tin thành công',
                data: packagePlan
            });

        } catch (error) {
            console.error('Error creating package plan:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Admin: Cập nhật gói tin
    async updatePackagePlan(req, res) {
        try {
            const { planId } = req.params;
            const updateData = req.body;

            // Kiểm tra gói tin hiện tại
            const currentPackage = await PackagePlan.findById(planId);
            if (!currentPackage) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy gói tin'
                });
            }

            // Validate displayName nếu có trong updateData
            if (updateData.displayName !== undefined) {
                if (!updateData.displayName || updateData.displayName.trim() === '') {
                    return res.status(400).json({
                        success: false,
                        message: 'Tên hiển thị không được rỗng'
                    });
                }

                // Validate displayName không chứa ký tự đặc biệt
                const specialCharsRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/;
                if (specialCharsRegex.test(updateData.displayName)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Tên hiển thị không được chứa ký tự đặc biệt'
                    });
                }
            }

            // Validate description nếu có trong updateData
            if (updateData.description !== undefined) {
                if (!updateData.description || updateData.description.trim() === '') {
                    return res.status(400).json({
                        success: false,
                        message: 'Mô tả không được rỗng'
                    });
                }
            }

            // Validate price nếu có trong updateData - cho phép giá 0 cho gói miễn phí
            if (updateData.price !== undefined) {
                const priceNum = Number(updateData.price);
                if (isNaN(priceNum) || priceNum < 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Giá phải là số và lớn hơn hoặc bằng 0 (có thể là 0 cho gói miễn phí)'
                    });
                }
            }

            // Validate freePushCount nếu có trong updateData
            if (updateData.freePushCount !== undefined) {
                const freePushCountNum = Number(updateData.freePushCount);
                if (isNaN(freePushCountNum) || freePushCountNum < 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Lượt đẩy tin phải là số và lớn hơn hoặc bằng 0'
                    });
                }
            }

            // Validate duration nếu có trong updateData - cho phép 0 hoặc null cho gói trial
            if (updateData.duration !== undefined) {
                const packageType = updateData.type || currentPackage.type;
                
                // Nếu là gói trial, cho phép duration = null hoặc >= 0
                if (packageType === 'trial') {
                    if (updateData.duration !== null && updateData.duration !== undefined) {
                        const durationNum = Number(updateData.duration);
                        if (isNaN(durationNum) || durationNum < 0) {
                            return res.status(400).json({
                                success: false,
                                message: 'Thời hạn gói trial phải là số và lớn hơn hoặc bằng 0, hoặc null cho vĩnh viễn'
                            });
                        }
                    }
                    // Cho phép duration = null cho gói trial (không cần validate gì thêm)
                } else {
                    // Các gói khác phải có duration hợp lệ và > 0
                    if (updateData.duration === null) {
                        return res.status(400).json({
                            success: false,
                            message: 'Các gói không phải trial không thể có thời hạn null'
                        });
                    }
                    
                    const durationNum = Number(updateData.duration);
                    if (isNaN(durationNum) || durationNum <= 0) {
                        return res.status(400).json({
                            success: false,
                            message: 'Thời hạn phải là số và lớn hơn 0 cho các gói không phải trial'
                        });
                    }
                }
            }

            // Validate durationUnit nếu có trong updateData - cho phép null cho gói trial
            if (updateData.durationUnit !== undefined) {
                const packageType = updateData.type || currentPackage.type;
                
                // Nếu là gói trial, cho phép durationUnit = null
                if (packageType === 'trial') {
                    if (updateData.durationUnit !== null && 
                        updateData.durationUnit !== undefined && 
                        !['day', 'month', 'year'].includes(updateData.durationUnit)) {
                        return res.status(400).json({
                            success: false,
                            message: 'DurationUnit cho gói trial phải là day, month, year hoặc null'
                        });
                    }
                } else {
                    // Các gói khác không được null và phải hợp lệ
                    if (updateData.durationUnit === null) {
                        return res.status(400).json({
                            success: false,
                            message: 'Các gói không phải trial không thể có durationUnit null'
                        });
                    }
                    
                    if (!['day', 'month', 'year'].includes(updateData.durationUnit)) {
                        return res.status(400).json({
                            success: false,
                            message: 'DurationUnit phải là day, month hoặc year cho các gói không phải trial'
                        });
                    }
                }
            }

            // Kiểm tra name trùng lặp nếu name được thay đổi .
            if (updateData.name && updateData.name !== currentPackage.name) {
                const existingPackage = await PackagePlan.findOne({ 
                    name: updateData.name,
                    _id: { $ne: planId } // Loại trừ chính gói tin đang update
                });
                
                if (existingPackage) {
                    return res.status(400).json({
                        success: false,
                        message: `Tên gói "${updateData.name}" đã tồn tại. Vui lòng chọn tên khác.`
                    });
                }
            }

            // Validate propertiesLimits nếu có trong updateData
            if (updateData.propertiesLimits && Array.isArray(updateData.propertiesLimits)) {
                for (let limit of updateData.propertiesLimits) {
                    if (!limit.packageType || !mongoose.Types.ObjectId.isValid(limit.packageType)) {
                        return res.status(400).json({
                            success: false,
                            message: 'ID loại tin không hợp lệ'
                        });
                    }
                    
                    const packageExists = await PropertiesPackage.findById(limit.packageType);
                    if (!packageExists) {
                        return res.status(400).json({
                            success: false,
                            message: `Loại tin ${limit.packageType} không tồn tại`
                        });
                    }
                }
            }

            const packagePlan = await PackagePlan.findByIdAndUpdate(
                planId,
                { ...updateData, updatedAt: new Date() },
                { new: true, runValidators: true }
            ).populate('propertiesLimits.packageType', 'name displayName color priority');

            if (!packagePlan) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy gói tin'
                });
            }

            // Đồng bộ thông tin gói đã cập nhật cho tất cả user đang sử dụng gói này
            console.log(`Syncing updated package ${packagePlan.name} to all users...`);
            
            try {
               
                
                // Tìm tất cả user đang dùng gói này
                const usersUsingPackage = await User.find({
                    'currentPackagePlan.packagePlanId': planId
                });

                console.log(`Found ${usersUsingPackage.length} users using package ${packagePlan.name}`);

                // Cập nhật từng user
                for (const user of usersUsingPackage) {
                    const currentPackagePlan = user.currentPackagePlan;
                    
                    // Giữ lại thông tin used count hiện tại
                    const currentUsedData = {};
                    if (currentPackagePlan && currentPackagePlan.propertiesLimits) {
                        currentPackagePlan.propertiesLimits.forEach(limit => {
                            currentUsedData[limit.packageType.toString()] = limit.used || 0;
                        });
                    }

                    // Cập nhật với thông tin mới từ packagePlan
                    const updatedPropertiesLimits = packagePlan.propertiesLimits.map(limit => ({
                        packageType: limit.packageType._id,
                        limit: limit.limit,
                        used: currentUsedData[limit.packageType._id.toString()] || 0 // Giữ nguyên used count cũ hoặc 0
                    }));

                    // Cập nhật thông tin gói cho user
                    await User.findByIdAndUpdate(user._id, {
                        'currentPackagePlan.propertiesLimits': updatedPropertiesLimits,
                        'currentPackagePlan.freePushCount': packagePlan.freePushCount,
                        'currentPackagePlan.displayName': packagePlan.displayName,
                        'currentPackagePlan.packageName': packagePlan.name,
                        // Giữ nguyên các thông tin quan trọng khác
                        // purchaseDate, expiryDate, usedPushCount, isActive, etc.
                    });

                    console.log(`Updated package info for user ${user._id} (${user.fullName || user.email})`);
                }

                console.log(`Successfully synced package ${packagePlan.name} to ${usersUsingPackage.length} users`);
            } catch (syncError) {
                console.error('Error syncing package to users:', syncError);
                // Không throw error để không ảnh hưởng đến việc cập nhật gói chính
            }

            res.json({
                success: true,
                message: 'Cập nhật gói tin thành công',
                data: packagePlan
            });

        } catch (error) {
            console.error('Error updating package plan:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Admin: Xóa gói tin
    async deletePackagePlan(req, res) {
        try {
            const { planId } = req.params;

            // Kiểm tra xem có đơn hàng nào đang sử dụng gói này không
            // TODO: Thêm logic kiểm tra dependencies nếu cần

            const packagePlan = await PackagePlan.findByIdAndDelete(planId);

            if (!packagePlan) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy gói tin'
                });
            }

            res.json({
                success: true,
                message: 'Xóa gói tin thành công',
                data: packagePlan
            });

        } catch (error) {
            console.error('Error deleting package plan:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Admin: Toggle trạng thái gói tin
    async togglePackagePlanStatus(req, res) {
        try {
            const { planId } = req.params;
            const { isActive } = req.body;

            const packagePlan = await PackagePlan.findByIdAndUpdate(
                planId,
                { isActive: isActive, updatedAt: new Date() },
                { new: true, runValidators: true }
            ).populate('propertiesLimits.packageType', 'name displayName color priority');

            if (!packagePlan) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy gói tin'
                });
            }

            res.json({
                success: true,
                message: `${isActive ? 'Kích hoạt' : 'Vô hiệu hóa'} gói tin thành công`,
                data: packagePlan
            });

        } catch (error) {
            console.error('Error toggling package plan status:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    }

    // Khởi tạo gói tin mặc định
    async initializeDefaultPackages(req, res) {
        try {
            // Kiểm tra xem đã có gói tin nào chưa
            const existingPlans = await PackagePlan.find();
            if (existingPlans.length > 0) {
                return res.json({
                    success: false,
                    message: 'Đã có gói tin tồn tại, không thể khởi tạo lại'
                });
            }

            // Lấy danh sách PropertiesPackage để tạo limits
            const propertiesPackages = await PropertiesPackage.find({ isActive: true });
            
            if (propertiesPackages.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Không tìm thấy PropertiesPackage, cần tạo trước khi khởi tạo PackagePlan'
                });
            }

            // Tìm các loại tin cụ thể
            const tinThuong = propertiesPackages.find(p => p.name === 'tin_thuong');
            const tinVip1 = propertiesPackages.find(p => p.name === 'tin_vip_1');
            const tinVip2 = propertiesPackages.find(p => p.name === 'tin_vip_2');
            const tinVipNoiBat = propertiesPackages.find(p => p.name === 'tin_vip_noi_bat');
            const tinVipDacBiet = propertiesPackages.find(p => p.name === 'tin_vip_dac_biet');

            // Tạo gói tin mặc định bao gồm gói dùng thử miễn phí
            const defaultPlans = [
                  {
                    name: 'trial',
                    type: 'trial',
                    displayName: 'Gói Dùng Thử Miễn Phí',
                    description: 'Gói dùng thử miễn phí vĩnh viễn với 2 tin thường và 1 tin VIP 1 để trải nghiệm',
                    price: 0,
                    duration: 1, 
                    durationUnit: 'month', 
                    freePushCount: 0,
                    propertiesLimits: [
                        ...(tinThuong ? [{ packageType: tinThuong._id, limit: 2 }] : []),
                        ...(tinVip1 ? [{ packageType: tinVip1._id, limit: 1 }] : []),
                    ],
                    isActive: true
                },
                {
                    name: 'basic',
                    type: 'basic',
                    displayName: 'Gói Cơ Bản',
                    description: 'Gói cơ bản dành cho người dùng mới bắt đầu',
                    price: 50000,
                    duration: 1,
                    durationUnit: 'month',
                    freePushCount: 5,
                    propertiesLimits: [
                        ...(tinThuong ? [{ packageType: tinThuong._id, limit: 5 }] : []),
                        ...(tinVip1 ? [{ packageType: tinVip1._id, limit: 5 }] : []),
                        ...(tinVipNoiBat ? [{ packageType: tinVipNoiBat._id, limit: 1 }] : []),
                        ...(tinVipDacBiet ? [{ packageType: tinVipDacBiet._id, limit: 1 }] : [])
                    ],
                    isActive: true
                },
                {
                    name: 'vip',
                    type: 'vip',
                    displayName: 'Gói VIP',
                    description: 'Gói VIP với nhiều tính năng nâng cao',
                    price: 200000,
                    duration: 1,
                    durationUnit: 'month',
                    freePushCount: 15,
                    propertiesLimits: [
                        ...(tinThuong ? [{ packageType: tinThuong._id, limit: 10 }] : []),
                        ...(tinVip1 ? [{ packageType: tinVip1._id, limit: 10 }] : []),
                        ...(tinVip2 ? [{ packageType: tinVip2._id, limit: 5 }] : []),
                        ...(tinVipNoiBat ? [{ packageType: tinVipNoiBat._id, limit: 5 }] : []),
                        ...(tinVipDacBiet ? [{ packageType: tinVipDacBiet._id, limit: 5 }] : [])
                    ],
                    isActive: true
                },
                {
                    name: 'premium',
                    type: 'premium',
                    displayName: 'Gói Premium',
                    description: 'Gói cao cấp nhất với đầy đủ tính năng',
                    price: 500000,
                    duration: 1,
                    durationUnit: 'month',
                    freePushCount: 20,
                    propertiesLimits: [
                        ...(tinThuong ? [{ packageType: tinThuong._id, limit: 20 }] : []),
                        ...(tinVip1 ? [{ packageType: tinVip1._id, limit: 20 }] : []),
                        ...(tinVip2 ? [{ packageType: tinVip2._id, limit: 15 }] : []),
                        ...(tinVipNoiBat ? [{ packageType: tinVipNoiBat._id, limit: 10 }] : []),
                        ...(tinVipDacBiet ? [{ packageType: tinVipDacBiet._id, limit: 10 }] : [])
                    ],
                    isActive: true
                }
            ];

            // Tạo các gói tin
            const createdPlans = [];
            for (const planData of defaultPlans) {
                const plan = new PackagePlan(planData);
                const savedPlan = await plan.save();
                createdPlans.push(savedPlan);
            }

            // Populate dữ liệu để trả về
            const populatedPlans = await PackagePlan.find({ 
                _id: { $in: createdPlans.map(p => p._id) } 
            }).populate('propertiesLimits.packageType', 'name displayName color priority');

            res.json({
                success: true,
                message: 'Khởi tạo 4 gói tin mặc định thành công (bao gồm gói dùng thử miễn phí)',
                data: populatedPlans
            });

        } catch (error) {
            console.error('Error initializing default packages:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi khởi tạo gói tin mặc định',
                error: error.message
            });
        }
    }
}

const packagePlanController = new PackagePlanController();
export default packagePlanController;
