/**
 * Property Controller - Xử lý business logic
 */
import propertyRepository from '../repositories/propertyRepository.js';
import { uploadToCloudinary } from '../../shared/utils/cloudinary.js'; // Chỉ dùng cho video
import User from '../../../schemas/User.js';
import Property from '../../../schemas/Property.js';
import PropertiesPackage from '../../../schemas/PropertiesPackage.js';
import PackagePlan from '../../../schemas/PackagePlan.js';

class PropertyController {
    // Tạo property mới với validation đầy đủ
    async createProperty(req, res) {
        try {
            // Kiểm tra xác thực user trước tiên
            if (!req.user || (!req.user.id && !req.user.userId)) {
                return res.status(401).json({
                    success: false,
                    message: 'Bạn cần đăng nhập để đăng tin',
                    errors: { auth: 'Chưa xác thực người dùng' }
                });
            }


            const userId = req.user.id || req.user.userId;


            const validationErrors = {};



            if (!req.body.contactName || req.body.contactName.trim() === '') {
                validationErrors.contactName = 'Tên liên hệ không được để trống';
            } else if (req.body.contactName.trim().length < 2) {
                validationErrors.contactName = 'Tên liên hệ phải có ít nhất 2 ký tự';
            } else {
                // Cho phép mọi chữ cái Unicode + khoảng trắng
                const nameRegex = /^[\p{L}\s]+$/u;
                if (!nameRegex.test(req.body.contactName.trim())) {
                    validationErrors.contactName = 'Tên liên hệ chỉ được chứa chữ cái và khoảng trắng';
                }
            }



            // 1. VALIDATION - Thông tin cơ bản bắt buộc (không được để trống)
            if (!req.body.title || req.body.title.trim() === '') {
                validationErrors.title = 'Tiêu đề không được để trống';
            } else if (req.body.title.trim().length < 10) {
                validationErrors.title = 'Tiêu đề phải có ít nhất 10 ký tự';
            } else if (req.body.title.length > 200) {
                validationErrors.title = 'Tiêu đề không được vượt quá 200 ký tự';
            }


            if (!req.body.contactPhone || req.body.contactPhone.trim() === '') {
                validationErrors.contactPhone = 'Số điện thoại không được để trống';
            } else {
                const phoneRegex = /^[0-9]{10}$/;
                if (!phoneRegex.test(req.body.contactPhone.trim())) {
                    validationErrors.contactPhone = 'Số điện thoại phải có 10 chữ số';
                }
            }

            if (!req.body.description || req.body.description.trim() === '') {
                validationErrors.description = 'Mô tả không được để trống';
            } else if (req.body.description.trim().length < 20) {
                validationErrors.description = 'Mô tả phải có ít nhất 20 ký tự';
            }

            if (!req.body.category || req.body.category.trim() === '') {
                validationErrors.category = 'Vui lòng chọn loại hình cho thuê';
            } else {
                const validCategories = ['phong_tro', 'can_ho', 'nha_nguyen_can', 'chung_cu_mini', 'homestay'];
                if (!validCategories.includes(req.body.category)) {
                    validationErrors.category = 'Loại hình cho thuê không hợp lệ';
                }
            }

            // 2. VALIDATION - Thông tin giá cả (bắt buộc, không được để trống)
            if (!req.body.rentPrice || req.body.rentPrice.toString().trim() === '') {
                validationErrors.rentPrice = 'Giá thuê không được để trống';
            } else {
                const rentPrice = Number(req.body.rentPrice);
                if (isNaN(rentPrice) || rentPrice < 0) {
                    validationErrors.rentPrice = 'Giá thuê phải là số dương';
                } else if (rentPrice < 500000) {
                    validationErrors.rentPrice = 'Giá thuê phải ít nhất 500,000 VNĐ';
                } else if (rentPrice > 100000000) {
                    validationErrors.rentPrice = 'Giá thuê không được vượt quá 100,000,000 VNĐ';
                }
            }

            if (!req.body.area || req.body.area.toString().trim() === '') {
                validationErrors.area = 'Diện tích không được để trống';
            } else {
                const area = Number(req.body.area);
                if (isNaN(area) || area < 0) {
                    validationErrors.area = 'Diện tích (m²) phải là số dương';
                } else if (area < 10) {
                    validationErrors.area = 'Diện tích phải ít nhất 10m²';
                } else if (area > 1000) {
                    validationErrors.area = 'Diện tích không được vượt quá 1000m²';
                }
            }

            // 3. VALIDATION - Địa chỉ bắt buộc (API mới: Tỉnh → Phường/Xã)
            if (!req.body.province || req.body.province.trim() === '') {
                validationErrors.province = 'Tỉnh/Thành phố không được để trống';
            }

            // District không còn bắt buộc vì API mới đã sáp nhập
            if (!req.body.ward || req.body.ward.trim() === '') {
                validationErrors.ward = 'Phường/Xã không được để trống';
            }
            if (!req.body.detailAddress || req.body.detailAddress.trim() === '') {
                validationErrors.detailAddress = 'Địa chỉ chi tiết không được để trống';
            } else if (req.body.detailAddress.trim().length < 5) {
                validationErrors.detailAddress = 'Địa chỉ chi tiết phải có ít nhất 5 ký tự';
            }

            // 4. VALIDATION - Hình ảnh bắt buộc và video (optional)
            // Kiểm tra xem có files nào được upload không
            let hasFiles = false;
            let hasImagesInRequest = false;
            let hasVideosInRequest = false;
            
            // Kiểm tra req.files trước để xác định có file nào được upload không
            if (req.files) {
                if (Array.isArray(req.files)) {
                    hasFiles = req.files.length > 0;
                    hasImagesInRequest = req.files.some(file => file.fieldname === 'images');
                    hasVideosInRequest = req.files.some(file => file.fieldname === 'video');
                } else if (typeof req.files === 'object') {
                    const allFiles = Object.values(req.files).flat();
                    hasFiles = allFiles.length > 0;
                    hasImagesInRequest = req.files.images && req.files.images.length > 0;
                    hasVideosInRequest = req.files.video && req.files.video.length > 0;
                }
            }
            
            console.log('File upload check:', {
                hasFiles,
                hasImagesInRequest,
                hasVideosInRequest,
                filesType: typeof req.files,
                uploadResults: !!req.uploadResults
            });
            
            // Nếu không có files nào được upload
            if (!hasFiles) {
                validationErrors.images = 'Vui lòng tải lên ít nhất 1 hình ảnh để tạo bài đăng';
            } else if (!req.uploadResults) {
                // Có files nhưng không có uploadResults -> lỗi xử lý
                validationErrors.images = 'Lỗi xử lý files đã tải lên. Vui lòng thử lại';
            } else {
                console.log('Upload results from moderation middleware:', req.uploadResults);
                console.log('Rejected images:', req.uploadResults.images?.rejected);
                console.log('Rejected videos:', req.uploadResults.videos?.rejected);
                
                // Handle both old and new structure
                let approvedImages, rejectedImages, approvedVideos, rejectedVideos;
                
                if (req.uploadResults.images && req.uploadResults.videos) {
                    // New nested structure
                    approvedImages = req.uploadResults.images?.approved || [];
                    rejectedImages = req.uploadResults.images?.rejected || [];
                    approvedVideos = req.uploadResults.videos?.approved || [];
                    rejectedVideos = req.uploadResults.videos?.rejected || [];
                } else {
                    // Old flat structure - filter by type
                    const allApproved = req.uploadResults.approved || [];
                    const allRejected = req.uploadResults.rejected || [];
                    
                    approvedImages = allApproved.filter(file => file.type === 'image');
                    rejectedImages = allRejected.filter(file => file.type === 'image');
                    approvedVideos = allApproved.filter(file => file.type === 'video');
                    rejectedVideos = allRejected.filter(file => file.type === 'video');
                }
                
                console.log('Processed results - Approved images:', approvedImages.length, 'Rejected images:', rejectedImages.length);
                console.log('Processed results - Approved videos:', approvedVideos.length, 'Rejected videos:', rejectedVideos.length);
                
                // Kiểm tra có ảnh nào được upload không (kể cả bị reject)
                const totalImages = approvedImages.length + rejectedImages.length;
                
                // Xử lý req.files an toàn - có thể là array hoặc object .
                let hasImagesInForm = false;
                let filesCount = 0;
                
                if (req.files) {
                    if (Array.isArray(req.files)) {
                        // req.files là array
                        hasImagesInForm = req.files.some(file => file.fieldname === 'images');
                        filesCount = req.files.length;
                    } else if (typeof req.files === 'object') {
                        // req.files là object (multer format)
                        hasImagesInForm = req.files.images && req.files.images.length > 0;
                        filesCount = Object.keys(req.files).reduce((count, key) => {
                            return count + (Array.isArray(req.files[key]) ? req.files[key].length : 1);
                        }, 0);
                    }
                }
                
                console.log('Image validation check:', {
                    totalImages,
                    approvedImages: approvedImages.length,
                    rejectedImages: rejectedImages.length,
                    hasImagesInForm,
                    filesCount,
                    filesType: typeof req.files,
                    filesIsArray: Array.isArray(req.files)
                });
                
                // Logic validation cho hình ảnh và video
                if (approvedImages.length === 0 && approvedVideos.length === 0) {
                    if (totalImages === 0 && approvedVideos.length === 0) {
                        // Không có ảnh và video nào được upload thành công
                        if (!hasImagesInRequest && !hasVideosInRequest) {
                            validationErrors.images = 'Vui lòng tải lên ít nhất 1 hình ảnh để tạo bài đăng';
                        } else {
                            // Có upload files nhưng không có file nào được approve
                            validationErrors.images = 'Không có ảnh hoặc video nào hợp lệ. Vui lòng tải lên ảnh phù hợp với nội quy';
                        }
                    } else if (rejectedImages.length > 0 && approvedVideos.length === 0) {
                        // Tất cả ảnh bị từ chối và không có video
                        validationErrors.images = `Tất cả ${rejectedImages.length} ảnh đã tải lên bị từ chối do vi phạm nội quy. Vui lòng tải lên ảnh khác phù hợp`;
                    }
                } else if (approvedImages.length === 0 && rejectedImages.length > 0 && approvedVideos.length === 0) {
                    // Có ảnh bị từ chối nhưng không có video approved
                    validationErrors.images = `${rejectedImages.length} ảnh bị từ chối do vi phạm nội quy. Vui lòng tải lên ảnh khác để hoàn thành bài đăng`;
                }
                
                // Kiểm tra video bị từ chối (nếu có upload video)
                const totalVideos = approvedVideos.length + rejectedVideos.length;
                let hasVideoInForm = false;
                
                if (req.files) {
                    if (Array.isArray(req.files)) {
                        hasVideoInForm = req.files.some(file => file.fieldname === 'video');
                    } else if (typeof req.files === 'object') {
                        hasVideoInForm = req.files.video && req.files.video.length > 0;
                    }
                }
                
                console.log('Video validation check:', {
                    totalVideos,
                    approvedVideos: approvedVideos.length,
                    rejectedVideos: rejectedVideos.length,
                    hasVideoInForm
                });
                
                // Validation cho video (video là optional)
                if (hasVideoInForm && totalVideos > 0) {
                    if (approvedVideos.length === 0 && rejectedVideos.length > 0) {
                        // Có upload video nhưng tất cả bị từ chối
                        validationErrors.video = `Video đã tải lên bị từ chối do vi phạm nội quy. Vui lòng tải lên video khác hoặc bỏ qua phần video`;
                    } else if (rejectedVideos.length > 0 && approvedVideos.length > 0) {
                        // Có video được approve nhưng cũng có video bị từ chối
                        validationErrors.video = `${rejectedVideos.length} video bị từ chối do vi phạm nội quy. Video đã được tải lên thành công sẽ được sử dụng`;
                    }
                }
                
                // Log thông tin về quá trình upload
                console.log(`Upload summary: ${approvedImages.length} images approved, ${rejectedImages.length} images rejected, ${approvedVideos.length} videos uploaded, ${rejectedVideos.length} videos failed`);
                
                // Hiển thị cảnh báo nếu có files bị từ chối/thất bại
                if (rejectedImages.length > 0) {
                    console.warn(`${rejectedImages.length} ảnh bị từ chối:`, rejectedImages.map(r => `${r.originalname} - ${r.reason}`));
                }
                if (rejectedVideos.length > 0) {
                    console.warn(`${rejectedVideos.length} video thất bại:`, rejectedVideos.map(r => `${r.originalname} - ${r.reason}`));
                }
            }

            // 6. VALIDATION - Giá trị số khác (optional nhưng nếu có thì validate)
            if (req.body.promotionPrice && req.body.promotionPrice.toString().trim() !== '') {
                const promotionPrice = Number(req.body.promotionPrice);
                const rentPrice = Number(req.body.rentPrice);
                if (isNaN(promotionPrice) || promotionPrice < 0) {
                    validationErrors.promotionPrice = 'Giá thuê khuyến mãi phải là số dương';
                } else if (promotionPrice >= rentPrice) {
                    validationErrors.promotionPrice = 'Giá khuyến mãi phải nhỏ hơn giá thuê';
                }
            }

            if (req.body.deposit && req.body.deposit.toString().trim() !== '') {
                const deposit = Number(req.body.deposit);
                const rentPrice = Number(req.body.rentPrice);
                if (isNaN(deposit) || deposit < 0) {
                    validationErrors.deposit = 'Tiền cọc (VNĐ) phải là số dương';
                } else if (deposit > rentPrice * 3) {
                    validationErrors.deposit = 'Tiền cọc không được vượt quá 3 lần giá thuê';
                }
            }

            if (req.body.electricPrice && req.body.electricPrice.toString().trim() !== '') {
                const electricPrice = Number(req.body.electricPrice);
                if (isNaN(electricPrice) || electricPrice < 0) {
                    validationErrors.electricPrice = 'Giá điện (VNĐ/kWh) phải là số dương';
                } else if (electricPrice > 10000) {
                    validationErrors.electricPrice = 'Giá điện không hợp lý (tối đa 10,000 VNĐ/kWh)';
                }
            }

            if (req.body.waterPrice && req.body.waterPrice.toString().trim() !== '') {
                const waterPrice = Number(req.body.waterPrice);
                if (isNaN(waterPrice) || waterPrice < 0) {
                    validationErrors.waterPrice = 'Giá nước (VNĐ/m³) phải là số dương';
                } else if (waterPrice > 50000) {
                    validationErrors.waterPrice = 'Giá nước không hợp lý (tối đa 50,000 VNĐ/m³)';
                }
            }

            // 7. VALIDATION - Ngày có thể vào ở (định dạng DD-MM-YYYY)
            if (req.body.availableDate && req.body.availableDate.toString().trim() !== '') {
                const dateValue = req.body.availableDate.toString().trim();

                // Kiểm tra định dạng DD-MM-YYYY
                const dateRegex = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-\d{4}$/;
                if (!dateRegex.test(dateValue)) {
                    validationErrors.availableDate = 'Ngày có thể vào ở phải có định dạng DD-MM-YYYY (ví dụ: 25-12-2024)';
                } else {
                    // Chuyển đổi từ DD-MM-YYYY sang Date object
                    const dateParts = dateValue.split('-');
                    const day = parseInt(dateParts[0]);
                    const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
                    const year = parseInt(dateParts[2]);
                    const availableDate = new Date(year, month, day);

                    // Kiểm tra ngày hợp lệ
                    if (availableDate.getDate() !== day ||
                        availableDate.getMonth() !== month ||
                        availableDate.getFullYear() !== year) {
                        validationErrors.availableDate = 'Ngày không hợp lệ, vui lòng kiểm tra lại';
                    } else {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);

                        if (availableDate < today) {
                            validationErrors.availableDate = 'Ngày có thể vào ở không được là ngày trong quá khứ';
                        }
                    }
                }
            }

            // Parse JSON fields
            let amenities = [];
            let houseRules = [];
            let coordinates = null;

            try {
                amenities = req.body.amenities
                    ? typeof req.body.amenities === 'string'
                        ? JSON.parse(req.body.amenities)
                        : req.body.amenities
                    : [];
                houseRules = req.body.houseRules
                    ? typeof req.body.houseRules === 'string'
                        ? JSON.parse(req.body.houseRules)
                        : req.body.houseRules
                    : [];
                
                // Parse coordinates from request body
                console.log('Raw coordinates from request:', req.body.coordinates);
                if (req.body.coordinates) {
                    coordinates = typeof req.body.coordinates === 'string'
                        ? JSON.parse(req.body.coordinates)
                        : req.body.coordinates;
                }
                console.log('Parsed coordinates:', coordinates);
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                return res.status(400).json({
                    success: false,
                    message: 'Dữ liệu JSON không hợp lệ',
                    error: parseError.message
                });
            }

            // Bắt lỗi ngay sau khi parse
            // Amenities có thể rỗng, không bắt buộc
            if (!houseRules.length) validationErrors.houseRules = 'Vui lòng chọn ít nhất 1 nội quy';
            if (!req.body.timeRules || req.body.timeRules.toString().trim() === '')
                validationErrors.timeRules = 'Vui lòng nhập quy định giờ giấc';
            
            // Validate coordinates
            if (!coordinates) {
                validationErrors.coordinates = 'Tọa độ không được để trống';
            } else if (!coordinates.lat || !coordinates.lng) {
                validationErrors.coordinates = 'Tọa độ phải có đầy đủ lat và lng';
            } else if (isNaN(coordinates.lat) || isNaN(coordinates.lng)) {
                validationErrors.coordinates = 'Tọa độ phải là số hợp lệ';
            }

            if (Object.keys(validationErrors).length > 0) {
                console.log('Validation failed, errors:', validationErrors);
                
                // Nếu có rejected files, trả về thông tin để frontend hiển thị blur ngay
                let rejectedFilesInfo = null;
                if (req.uploadResults) {
                    let finalRejectedImages, finalRejectedVideos;
                    
                    if (req.uploadResults.images && req.uploadResults.videos) {
                        // New nested structure
                        finalRejectedImages = req.uploadResults.images?.rejected || [];
                        finalRejectedVideos = req.uploadResults.videos?.rejected || [];
                    } else {
                        // Old flat structure - filter by type
                        const allRejected = req.uploadResults.rejected || [];
                        finalRejectedImages = allRejected.filter(file => file.type === 'image');
                        finalRejectedVideos = allRejected.filter(file => file.type === 'video');
                    }
                    
                    if (finalRejectedImages.length > 0 || finalRejectedVideos.length > 0) {
                        rejectedFilesInfo = {
                            images: finalRejectedImages,
                            videos: finalRejectedVideos
                        };
                        console.log('📤 Sending rejectedFiles in validation error:', rejectedFilesInfo);
                    }
                }
                
                return res.status(400).json({
                    success: false,
                    message: `Thông tin không hợp lệ. Vui lòng kiểm tra lại ${Object.keys(validationErrors).length} trường bị lỗi.`,
                    errors: validationErrors,
                    rejectedFiles: rejectedFilesInfo // Thêm thông tin rejected files vào validation error
                });
            }

            console.log('Validation passed, proceeding to create property...');
            console.log('req body postType:', req.body.postType);
            // Kiểm tra postType và trừ limit từ gói user
            if (!req.body.postType) {
                return res.status(400).json({
                    success: false,
                    message: 'Loại tin đăng không được để trống',
                    errors: { postType: 'Vui lòng chọn loại tin đăng' }
                });
            }

            // Lấy thông tin user với gói tin hiện tại
            const user = await User.findById(userId)
                .populate({
                    path: 'currentPackagePlan.packagePlanId',
                    populate: {
                        path: 'propertiesLimits.packageType',
                        model: 'PropertiesPackage'
                    }
                })
                .populate('currentPackagePlan.propertiesLimits.packageType');

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy thông tin user'
                });
            }

            // Đếm số tin đã đăng của user theo loại postType được chọn từ User schema
            const postTypeId = req.body.postType;

            // Lấy thông tin user với gói tin hiện tại để kiểm tra limit hiện tại
            console.log(`Checking limits for user ${userId} and postType ${postTypeId}`);

            // Kiểm tra limit từ gói hiện tại
            let allowedLimit = 0;
            let currentUsedCount = 0;
            let hasValidPackage = false;
            let packagePlan = null;
            let userPackageLimit = null;

            // Lấy gói hiện tại từ user
            if (user.currentPackagePlan && user.currentPackagePlan.isActive) {
                const currentPackage = user.currentPackagePlan;
                
                // Kiểm tra gói còn hiệu lực
                const now = new Date();
                const isActive = currentPackage.isActive && 
                    (!currentPackage.expiryDate || new Date(currentPackage.expiryDate) > now);

                if (isActive && currentPackage.packagePlanId) {
                    // Lấy PackagePlan từ database với populate propertiesLimits
                    packagePlan = await PackagePlan.findById(currentPackage.packagePlanId)
                        .populate('propertiesLimits.packageType', 'name displayName')
                        .lean();
                    
                
                    
                    if (packagePlan) {
                        hasValidPackage = true;
                        
                        // Tìm limit hiện tại trong currentPackagePlan.propertiesLimits
                        userPackageLimit = currentPackage.propertiesLimits?.find(limit => {
                            // Xử lý cả trường hợp packageType là ObjectId và là object đã populate
                            const packageTypeId = limit.packageType?._id ? 
                                limit.packageType._id.toString() : 
                                limit.packageType.toString();
                            console.log(`Comparing packageTypeId: ${packageTypeId} with postTypeId: ${postTypeId}`);
                            return packageTypeId === postTypeId;
                        });
                        
                        console.log('Found userPackageLimit:', userPackageLimit);
                        
                        if (userPackageLimit) {
                            allowedLimit = userPackageLimit.limit;
                            currentUsedCount = userPackageLimit.used || 0;
                           
                        } else {
                            // Nếu không tìm thấy trong currentPackage.propertiesLimits, 
                            // tìm trong packagePlan.propertiesLimits và tạo mới
                            const packageLimit = packagePlan.propertiesLimits?.find(limit => {
                                // Xử lý cả trường hợp packageType là ObjectId và là object đã populate
                                const packageTypeId = limit.packageType?._id ? 
                                    limit.packageType._id.toString() : 
                                    limit.packageType.toString();
                                console.log(`Comparing packageLimit packageTypeId: ${packageTypeId} with postTypeId: ${postTypeId}`);
                                return packageTypeId === postTypeId;
                            });
                            
                          
                            
                            if (packageLimit) {
                                allowedLimit = packageLimit.limit;
                                currentUsedCount = 0; // Mới khởi tạo
                                
                                // Tạo mới entry trong currentPackagePlan.propertiesLimits
                                if (!currentPackage.propertiesLimits) {
                                    currentPackage.propertiesLimits = [];
                                }
                                
                                currentPackage.propertiesLimits.push({
                                    packageType: postTypeId,
                                    limit: allowedLimit,
                                    used: 0
                                });
                                
                                await User.findByIdAndUpdate(userId, {
                                    'currentPackagePlan.propertiesLimits': currentPackage.propertiesLimits
                                });
                                
                                userPackageLimit = { packageType: postTypeId, limit: allowedLimit, used: 0 };
                                console.log(`Created new limit entry: limit=${allowedLimit}, used=${currentUsedCount}`);
                            }
                        }
                    }
                }
            }

            // Nếu không có gói trả phí active, lấy gói trial
            if (!hasValidPackage) {
                packagePlan = await PackagePlan.findOne({ 
                    type: 'trial', 
                    isActive: true 
                })
                .populate('propertiesLimits.packageType', 'name displayName')
                .lean();

                if (packagePlan) {
                    hasValidPackage = true;
                    console.log('Using trial package for user:', userId);
                    
                    // Với gói trial, cũng lấy từ currentPackagePlan.propertiesLimits
                    const trialLimit = packagePlan.propertiesLimits?.find(limit => {
                        // Xử lý cả trường hợp packageType là ObjectId và là object đã populate
                        const packageTypeId = limit.packageType?._id ? 
                            limit.packageType._id.toString() : 
                            limit.packageType.toString();
                        console.log(`Trial limit - Comparing packageTypeId: ${packageTypeId} with postTypeId: ${postTypeId}`);
                        return packageTypeId === postTypeId;
                    });
                    
                    if (trialLimit) {
                        allowedLimit = trialLimit.limit;
                        
                        // Tìm hoặc tạo limit trong currentPackagePlan.propertiesLimits cho trial
                        if (user.currentPackagePlan && user.currentPackagePlan.propertiesLimits) {
                            userPackageLimit = user.currentPackagePlan.propertiesLimits.find(limit => {
                                // Xử lý cả trường hợp packageType là ObjectId và là object đã populate
                                const packageTypeId = limit.packageType?._id ? 
                                    limit.packageType._id.toString() : 
                                    limit.packageType.toString();
                                console.log(`Trial userLimit - Comparing packageTypeId: ${packageTypeId} with postTypeId: ${postTypeId}`);
                                return packageTypeId === postTypeId;
                            });
                        }
                        
                        if (userPackageLimit) {
                            currentUsedCount = userPackageLimit.used || 0;
                        } else {
                            // Nếu chưa có trong currentPackagePlan, khởi tạo với used = 0
                            currentUsedCount = 0;
                            
                            // Tạo mới entry trong currentPackagePlan.propertiesLimits
                            if (!user.currentPackagePlan) {
                                user.currentPackagePlan = {
                                    packagePlanId: packagePlan._id,
                                    isActive: true,
                                    propertiesLimits: []
                                };
                            }
                            
                            if (!user.currentPackagePlan.propertiesLimits) {
                                user.currentPackagePlan.propertiesLimits = [];
                            }
                            
                            user.currentPackagePlan.propertiesLimits.push({
                                packageType: postTypeId,
                                limit: allowedLimit,
                                used: 0
                            });
                            
                            await user.save();
                            userPackageLimit = { packageType: postTypeId, limit: allowedLimit, used: 0 };
                        }
                    }
                }
            }

            console.log(`PostType ${postTypeId}: used ${currentUsedCount}, allowed ${allowedLimit}`);

            // Kiểm tra đã vượt quá limit chưa
            if (currentUsedCount >= allowedLimit) {
                const postTypeName = await PropertiesPackage.findById(postTypeId).select('displayName');
                return res.status(400).json({
                    success: false,
                    message: `Bạn đã hết lượt đăng ${postTypeName?.displayName || 'loại tin này'}. Vui lòng nâng cấp gói hoặc chọn loại tin khác.`,
                    errors: { 
                        postType: `Đã vượt quá giới hạn ${allowedLimit} tin cho loại này` 
                    },
                    data: {
                        usedCount: currentUsedCount,
                        allowedLimit: allowedLimit,
                        needsUpgrade: true
                    }
                });
            }

            // Lấy kết quả từ AI moderation middleware (cả images và videos)
            let imageUrls = [];
            let videoUrl = null;
            const uploadWarnings = [];
            
            // Handle both old and new structure - khai báo ở scope rộng hơn
            let finalApprovedImages = [], finalRejectedImages = [], finalApprovedVideos = [], finalRejectedVideos = [];
            
            if (req.uploadResults) {
                // Use the processed arrays from validation section
                
                if (req.uploadResults.images && req.uploadResults.videos) {
                    // New nested structure
                    finalApprovedImages = req.uploadResults.images?.approved || [];
                    finalRejectedImages = req.uploadResults.images?.rejected || [];
                    finalApprovedVideos = req.uploadResults.videos?.approved || [];
                    finalRejectedVideos = req.uploadResults.videos?.rejected || [];
                } else {
                    // Old flat structure - filter by type
                    const allApproved = req.uploadResults.approved || [];
                    const allRejected = req.uploadResults.rejected || [];
                    
                    finalApprovedImages = allApproved.filter(file => file.type === 'image');
                    finalRejectedImages = allRejected.filter(file => file.type === 'image');
                    finalApprovedVideos = allApproved.filter(file => file.type === 'video');
                    finalRejectedVideos = allRejected.filter(file => file.type === 'video');
                }
                
                // Lấy URLs của ảnh đã được duyệt
                imageUrls = finalApprovedImages.map(img => img.url);
                
                // Lấy video đã được upload
                if (finalApprovedVideos.length > 0) {
                    videoUrl = finalApprovedVideos[0].url; // Chỉ lấy video đầu tiên
                }
                
                // Ghi log về files bị từ chối
                const rejectedImages = finalRejectedImages;
                const rejectedVideos = finalRejectedVideos;
                
                if (rejectedImages.length > 0) {
                    const rejectedImageList = rejectedImages.map(img => `'${img.originalname} - ${img.reason}'`);
                    const shortWarning = `${rejectedImages.length} ảnh bị từ chối: [${rejectedImageList.join(', ')}]`;
                    uploadWarnings.push(shortWarning);
                    console.log('Ảnh bị từ chối do AI moderation:', rejectedImages.map(r => `${r.originalname} - ${r.reason}`));
                }
                
                if (rejectedVideos.length > 0) {
                    const rejectedVideoList = rejectedVideos.map(video => `'${video.originalname} - ${video.reason}'`);
                    const shortVideoWarning = `${rejectedVideos.length} video thất bại: [${rejectedVideoList.join(', ')}]`;
                    uploadWarnings.push(shortVideoWarning);
                    console.log('Video upload errors:', rejectedVideos.map(r => `${r.originalname} - ${r.reason}`));
                }
            }

            // Chuẩn bị dữ liệu property
            const now = new Date();
            const propertyData = {
                // Thông tin chủ nhà
                title: req.body.title.trim(),
                category: req.body.category,
                contactName: req.body.contactName.trim(),
                contactPhone: req.body.contactPhone.trim(),
                description: req.body.description.trim(),
                owner: userId,

                // Thông tin cơ bản & giá
                rentPrice: Math.round(Number(req.body.rentPrice)),
                promotionPrice: req.body.promotionPrice ? Math.round(Number(req.body.promotionPrice)) : undefined,
                deposit: req.body.deposit ? Math.round(Number(req.body.deposit)) : Math.round(Number(req.body.rentPrice)),
                area: Number(req.body.area),
                electricPrice: req.body.electricPrice ? Number(req.body.electricPrice) : 3500,
                waterPrice: req.body.waterPrice ? Number(req.body.waterPrice) : 15000,
                maxOccupants: req.body.maxOccupants || '1',
                availableDate: req.body.availableDate && req.body.availableDate.toString().trim() !== ''
                    ? (() => {
                        // Chuyển đổi từ định dạng DD-MM-YYYY sang Date
                        const dateParts = req.body.availableDate.toString().trim().split('-');
                        const day = parseInt(dateParts[0]);
                        const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
                        const year = parseInt(dateParts[2]);
                        return new Date(year, month, day);
                    })()
                    : now,

                // Tiện ích
                amenities: amenities || [],
                fullAmenities: req.body.fullAmenities === 'true',
                timeRules: req.body.timeRules || '',

                // Nội quy
                houseRules: houseRules || [],

                // Địa chỉ (sử dụng API vietnamlabs.com)
                province: req.body.province.trim(),
                ward: req.body.ward.trim(),
                detailAddress: req.body.detailAddress.trim(),
                coordinates: {
                    lat: coordinates ? Number(coordinates.lat) : null,
                    lng: coordinates ? Number(coordinates.lng) : null
                },

                // Media
                images: imageUrls,
                video: videoUrl,

                // Package & Post Type
                packageInfo: {
                    plan: packagePlan._id,
                    packageInstanceId: user.currentPackagePlan?.packageInstanceId, // Gắn với instance hiện tại
                    postType: postTypeId,
                    purchaseDate: now,
                    expiryDate: user.currentPackagePlan?.expiryDate,
                    isActive: true,
                    status: 'active',
                    // Theo dõi nguồn gói gốc (khi migrate) - lưu gói hiện tại cho property mới
                    sourcePackageId: packagePlan._id,
                    sourcePackageName: packagePlan.displayName || packagePlan.name
                },

                // Trạng thái và metadata
                approvalStatus: 'pending', // Chờ admin duyệt
                status: 'available',
                views: 0,
                featured: false,
                createdAt: now,
                updatedAt: now
            };

            console.log('Final propertyData coordinates:', propertyData.coordinates);

            // Removed postOrder logic since propertyOrder field is removed from schema

            // Tạo property
            const property = await propertyRepository.create(propertyData);

            // Cập nhật currentPackagePlan.propertiesLimits.used sau khi tạo property thành công
            if (hasValidPackage && userPackageLimit) {
                // Cập nhật used count trong currentPackagePlan.propertiesLimits
                await User.findOneAndUpdate(
                    { 
                        _id: userId,
                        'currentPackagePlan.propertiesLimits.packageType': postTypeId
                    },
                    {
                        $inc: {
                            'currentPackagePlan.propertiesLimits.$.used': 1
                        }
                    }
                );
                console.log(`Updated user ${userId} propertiesLimits.used for postType ${postTypeId}: ${currentUsedCount} -> ${currentUsedCount + 1}`);
            } else {
                console.warn(`Could not update propertiesLimits.used - hasValidPackage: ${hasValidPackage}, userPackageLimit: ${!!userPackageLimit}`);
            }

            // Success response với thông tin AI moderation đầy đủ
            let message = 'Đăng tin thành công! Tin của bạn đang chờ admin duyệt.';
            if (uploadWarnings.length > 0) {
                message += ` Lưu ý: ${uploadWarnings.join('; ')}`;
            }
            console.log('Property created with ID:', property._id);
            
            res.status(201).json({
                success: true,
                message: message,
                data: {
                    id: property._id,
                    title: property.title,
                    approvalStatus: property.approvalStatus,
                    createdAt: property.createdAt,
                    packageInfo: {
                        plan: packagePlan._id,
                        packageInstanceId: user.currentPackagePlan?.packageInstanceId, // Instance ID để debug
                        postType: {
                            id: postTypeId,
                            usedCount: currentUsedCount + 1, // Số tin đã sử dụng sau khi đăng tin này
                            allowedLimit: allowedLimit,
                        },
                        packageName: packagePlan?.name || 'unknown',
                        packageType: packagePlan?.type || 'unknown'
                    },
                    mediaUploaded: {
                        images: imageUrls.length,
                        video: videoUrl ? 1 : 0
                    },
                    uploadWarnings: uploadWarnings,
                    moderationResults: req.uploadResults ? {
                        images: {
                            approved: finalApprovedImages?.length || 0,
                            rejected: finalRejectedImages?.length || 0
                        },
                        videos: {
                            uploaded: finalApprovedVideos?.length || 0,
                            failed: finalRejectedVideos?.length || 0
                        },
                        summary: req.uploadResults.summary
                    } : null,
                    rejectedFiles: {
                        images: finalRejectedImages || [],
                        videos: finalRejectedVideos || []
                    }
                }
            });

            console.log('📤 Sending rejectedFiles to frontend:', {
                images: finalRejectedImages || [],
                videos: finalRejectedVideos || []
            });

        } catch (error) {
            console.error('Create property error:', error);

            // Xử lý các loại lỗi cụ thể
            let errorMessage = 'Lỗi server khi tạo bài đăng';
            let statusCode = 500;

            if (error.name === 'ValidationError') {
                statusCode = 400;
                errorMessage = 'Dữ liệu không hợp lệ';
                const mongoErrors = {};
                Object.keys(error.errors).forEach(key => {
                    mongoErrors[key] = error.errors[key].message;
                });

                return res.status(statusCode).json({
                    success: false,
                    message: errorMessage,
                    errors: mongoErrors
                });
            } else if (error.code === 11000) {
                statusCode = 400;
                errorMessage = 'Dữ liệu đã tồn tại trong hệ thống';
            }

            res.status(statusCode).json({
                success: false,
                message: errorMessage,
                error: process.env.NODE_ENV === 'development' ? error.message : 'Lỗi server'
            });
        }
    }

    // Helper function để cập nhật propertiesLimits.used khi xóa property
    static async updateUsedCountOnDelete(userId, postTypeId) {
        try {
            await User.findOneAndUpdate(
                { 
                    _id: userId,
                    'currentPackagePlan.propertiesLimits.packageType': postTypeId
                },
                {
                    $inc: {
                        'currentPackagePlan.propertiesLimits.$.used': -1
                    }
                }
            );
            console.log(`Decreased user ${userId} propertiesLimits.used for postType ${postTypeId}`);
        } catch (error) {
            console.error('Error updating used count on delete:', error);
        }
    }

    // Helper function để đồng bộ dữ liệu cũ
    static async syncPropertiesLimits(userId) {
        try {
            const user = await User.findById(userId);
            if (!user || !user.currentPackagePlan) {
                return false;
            }

            // Đếm số bài đăng thực tế từ Property collection
            const postTypeCounts = await Property.aggregate([
                {
                    $match: {
                        owner: new mongoose.Types.ObjectId(userId),
                        approvalStatus: { $in: ['pending', 'approved'] }
                    }
                },
                {
                    $group: {
                        _id: '$packageInfo.postType',
                        count: { $sum: 1 }
                    }
                }
            ]);

            const usedCountMap = new Map();
            postTypeCounts.forEach(item => {
                if (item._id) {
                    usedCountMap.set(item._id.toString(), item.count);
                }
            });

            // Cập nhật used count trong propertiesLimits
            for (const limit of user.currentPackagePlan.propertiesLimits) {
                const actualUsed = usedCountMap.get(limit.packageType.toString()) || 0;
                if (limit.used !== actualUsed) {
                    limit.used = actualUsed;
                    console.log(`Synced postType ${limit.packageType}: used count ${limit.used} -> ${actualUsed}`);
                }
            }

            await user.save();
            return true;
        } catch (error) {
            console.error('Error syncing propertiesLimits:', error);
            return false;
        }
    }
  
}

export default new PropertyController();