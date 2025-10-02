/**
 * Property Controller - Xử lý business logic
 */
import propertyRepository from '../repositories/propertyRepository.js';
import { uploadToCloudinary } from '../../shared/utils/cloudinary.js'; // Chỉ dùng cho video

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

            // 3. VALIDATION - Địa chỉ bắt buộc (không được để trống).
            if (!req.body.province || req.body.province.trim() === '') {
                validationErrors.province = 'Tỉnh/Thành phố không được để trống';
            }
            if (!req.body.district || req.body.district.trim() === '') {
                validationErrors.district = 'Quận/Huyện không được để trống';
            }
            if (!req.body.ward || req.body.ward.trim() === '') {
                validationErrors.ward = 'Phường/Xã không được để trống';
            }
            if (!req.body.detailAddress || req.body.detailAddress.trim() === '') {
                validationErrors.detailAddress = 'Địa chỉ chi tiết không được để trống';
            } else if (req.body.detailAddress.trim().length < 5) {
                validationErrors.detailAddress = 'Địa chỉ chi tiết phải có ít nhất 5 ký tự';
            }

            // 4. VALIDATION - Hình ảnh bắt buộc và video (optional)
            // With AI moderation middleware, files are processed in req.uploadResults
            if (!req.uploadResults) {
                validationErrors.images = 'Lỗi xử lý files. Vui lòng thử lại';
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
                
                // Chỉ yêu cầu ảnh bắt buộc nếu không có video approved và không có ảnh approved
                if (approvedImages.length === 0 && approvedVideos.length === 0) {
                    if (totalImages === 0 && !hasImagesInForm) {
                        // Không có ảnh nào được upload
                        validationErrors.images = 'Vui lòng tải lên ít nhất 1 hình ảnh hoặc 1 video';
                    } else if (rejectedImages.length > 0) {
                        // Có ảnh được upload nhưng tất cả bị từ chối - CHO PHÉP tạo property nhưng cảnh báo
                        console.log('All images were rejected, but allowing property creation for user feedback');
                        validationErrors.images = `${rejectedImages.length} ảnh bị từ chối do vi phạm nội quy.`;
                    }
                } else if (approvedImages.length === 0 && rejectedImages.length > 0 && approvedVideos.length === 0) {
                    // Có ảnh bị từ chối nhưng không có video approved - cảnh báo thay thế
                    console.log('All images rejected and no approved videos, warning user');
                    validationErrors.images = `${rejectedImages.length} ảnh bị từ chối do vi phạm nội quy. `;
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
                
                if (totalVideos > 0 && rejectedVideos.length > 0 && hasVideoInForm) {
                    // Có video bị từ chối và vẫn còn video trong form - thông báo cảnh báo
                    console.log('Some videos were rejected, notifying user for replacement');
                    validationErrors.video = `${rejectedVideos.length} video bị từ chối do vi phạm nội quy. Vui lòng thay thế bằng video phù hợp.`;
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
            if (!amenities.length) validationErrors.amenities = 'Vui lòng chọn ít nhất 1 tiện ích';
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

            console.log('✅ Validation passed, proceeding to create property...');



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

                // Địa chỉ
                province: req.body.province.trim(),
                district: req.body.district.trim(),
                ward: req.body.ward.trim(),
                detailAddress: req.body.detailAddress.trim(),
                coordinates: {
                    lat: coordinates ? Number(coordinates.lat) : null,
                    lng: coordinates ? Number(coordinates.lng) : null
                },

                // Media
                images: imageUrls,
                video: videoUrl,

                // Trạng thái và metadata
                approvalStatus: 'pending', // Chờ admin duyệt
                status: 'available',
                views: 0,
                featured: false,
                createdAt: now,
                updatedAt: now
            };

            console.log('Final propertyData coordinates:', propertyData.coordinates);

            // Tạo property
            const property = await propertyRepository.create(propertyData);

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

  
}

export default new PropertyController();