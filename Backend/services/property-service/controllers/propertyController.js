/**
 * Property Controller - Xử lý business logic
 */
import propertyRepository from '../repositories/propertyRepository.js';
import { uploadToCloudinary } from '../../shared/utils/cloudinary.js';

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

            // 3. VALIDATION - Địa chỉ bắt buộc (không được để trống)
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

            // 4. VALIDATION - Hình ảnh bắt buộc
            // With upload.fields(), req.files is an object: { images: [...], video: [...] }
            const imageFilesForValidation = req.files?.images || [];
            const videoFilesForValidation = req.files?.video || [];

            if (imageFilesForValidation.length === 0) {
                validationErrors.images = 'Vui lòng tải lên ít nhất 1 hình ảnh';
            }

            if (imageFilesForValidation.length > 5) {
                validationErrors.images = 'Không được tải lên quá 5 hình ảnh';
            }

            // Check image file size (max 5MB per image)
            for (const file of imageFilesForValidation) {
                if (file.size > 5 * 1024 * 1024) {
                    validationErrors.images = 'Mỗi hình ảnh không được lớn hơn 5MB';
                    break;
                }
            }

            // 5. VALIDATION - Video (optional nhưng nếu có thì validate)
            if (videoFilesForValidation.length > 1) {
                validationErrors.video = 'Chỉ được tải lên 1 video';
            }
            if (videoFilesForValidation.length > 0 && videoFilesForValidation[0].size > 50 * 1024 * 1024) {
                validationErrors.video = 'Video không được lớn hơn 50MB';
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
            } catch (parseError) {
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

            if (Object.keys(validationErrors).length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Thông tin không hợp lệ. Vui lòng kiểm tra lại ${Object.keys(validationErrors).length} trường bị lỗi.`,
                    errors: validationErrors
                });
            }



            // Upload images to Cloudinary với cấu trúc upload.fields()
            let imageUrls = [];
            const uploadErrors = [];

            // Process images from req.files.images
            const imageFiles = req.files?.images || [];
            if (imageFiles.length > 0) {
                for (const file of imageFiles) {
                    try {
                        console.log(`Uploading image: ${file.originalname}`);
                        const result = await uploadToCloudinary(file.buffer, 'properties');
                        imageUrls.push(result.secure_url);
                    } catch (uploadError) {
                        console.error('Image upload error:', uploadError);
                        uploadErrors.push(`Lỗi tải ${file.originalname}: ${uploadError.message}`);
                    }
                }
            }

            // Upload video if exists from req.files.video
            let videoUrl = null;
            const videoFiles = req.files?.video || [];
            if (videoFiles.length > 0) {
                const videoFile = videoFiles[0]; // Chỉ lấy video đầu tiên
                try {
                    console.log(`Uploading video: ${videoFile.originalname}`);
                    const result = await uploadToCloudinary(videoFile.buffer, 'properties/videos');
                    videoUrl = result.secure_url;
                } catch (uploadError) {
                    console.error('Video upload error:', uploadError);
                    uploadErrors.push(`Lỗi tải video: ${uploadError.message}`);
                }
            }

            // Nếu có lỗi upload và không có ảnh nào thành công, báo lỗi
            if (uploadErrors.length > 0 && imageUrls.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Không thể tải lên hình ảnh',
                    errors: { images: uploadErrors.join(', ') }
                });
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
                coordinates: coordinates || null,

                // Media
                images: imageUrls,
                video: videoUrl,

                // Trạng thái và metadata
                approvalStatus: 'pending', // Chờ admin duyệt
                status: req.body.isForRent === 'false' ? 'inactive' : 'draft', // draft cho đến khi được duyệt, inactive nếu không cho thuê
                views: 0,
                featured: false,
                createdAt: now,
                updatedAt: now
            };

            console.log('Creating property with validated data:', propertyData);

            // Tạo property
            const property = await propertyRepository.create(propertyData);

            // Success response
            res.status(201).json({
                success: true,
                message: `Đăng tin thành công! Tin của bạn đang chờ admin duyệt. ${uploadErrors.length > 0 ? 'Có một số file không tải được: ' + uploadErrors.join(', ') : ''}`,
                data: {
                    id: property._id,
                    title: property.title,
                    approvalStatus: property.approvalStatus,
                    createdAt: property.createdAt,
                    uploadWarnings: uploadErrors
                }
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
