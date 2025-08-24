/**
 * Validation Middleware - Validate request data
 */

// Regex pattern cho mật khẩu mạnh
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

class ValidationMiddleware {
    // Validate user registration
    validateRegister(req, res, next) {
        const { fullName, email, phone, password } = req.body;
        const errors = [];

        // Không được để trống
        if (!fullName || fullName.trim() === '') {
            errors.push('Họ tên không được để trống');
        } else if (!/^[\p{L}\p{M}\s]{2,}$/u.test(fullName.trim())) {
            errors.push('Họ tên chỉ được chứa chữ cái tiếng Việt và khoảng trắng, tối thiểu 2 ký tự');
        }

        if (!email || email.trim() === '') {
            errors.push('Email không được để trống');
        } else if (!/^[\w-.]+@[\w-]+\.[a-zA-Z]{2,}$/.test(email)) {
            errors.push('Email không hợp lệ');
        }

        if (!phone || phone.trim() === '') {
            errors.push('Số điện thoại không được để trống');
        } else if (!/^[0-9]{10}$/.test(phone)) {
            errors.push('Số điện thoại phải có 10 số');
        }

        if (!password || password === '') {
            errors.push('Mật khẩu không được để trống');
        } else if (!PASSWORD_REGEX.test(password)) {
            errors.push('Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt (@$!%*?&)');
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Dữ liệu không hợp lệ',
                errors
            });
        }

        next();
    }

    // Validate user login
    validateLogin(req, res, next) {
        const { email, password } = req.body;
        const errors = [];

        // Email validation
        if (!email || email.trim() === '') {
            errors.push('Email không được để trống');
        } else if (!/^[\w-.]+@[\w-]+\.[a-zA-Z]{2,}$/.test(email)) {
            errors.push('Email không hợp lệ');
        }

        // Password validation
        if (!password || password === '') {
            errors.push('Mật khẩu không được để trống');
        } else if (!PASSWORD_REGEX.test(password)) {
            errors.push('Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt (@$!%*?&)');
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Dữ liệu không hợp lệ',
                errors
            });
        }

        next();
    }

    // Validate update profile
    validateUpdateProfile(req, res, next) {
        const { fullName, phone, dateOfBirth } = req.body;
        const errors = [];

        if (fullName && !/^[\p{L}\p{M}\s]{2,}$/u.test(fullName.trim())) {
            errors.push('Họ tên chỉ được chứa chữ cái tiếng Việt và khoảng trắng, tối thiểu 2 ký tự');
        }

        if (phone && !/^[0-9]{10}$/.test(phone)) {
            errors.push('Số điện thoại phải có 10 số');
        }


        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Dữ liệu không hợp lệ',
                errors
            });
        }

        next();
    }

    // Validate property creation
    validateProperty(req, res, next) {
        const { title, description, type, address, price } = req.body;
        const errors = [];

        if (!title || title.trim().length < 5) {
            errors.push('Tiêu đề phải có ít nhất 5 ký tự');
        }

        if (!description || description.trim().length < 20) {
            errors.push('Mô tả phải có ít nhất 20 ký tự');
        }

        if (!type || !['apartment', 'house', 'room', 'studio'].includes(type)) {
            errors.push('Loại bất động sản không hợp lệ');
        }

        if (!address || !address.street || !address.ward || !address.district || !address.province) {
            errors.push('Địa chỉ không đầy đủ');
        }

        if (!price || !price.monthly || price.monthly < 0) {
            errors.push('Giá thuê hàng tháng không hợp lệ');
        }

        if (!price || !price.deposit || price.deposit < 0) {
            errors.push('Tiền cọc không hợp lệ');
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Dữ liệu không hợp lệ',
                errors
            });
        }

        next();
    }

    // Validate property update
    validatePropertyUpdate(req, res, next) {
        const { title, description, price } = req.body;
        const errors = [];

        if (title && title.trim().length < 5) {
            errors.push('Tiêu đề phải có ít nhất 5 ký tự');
        }

        if (description && description.trim().length < 20) {
            errors.push('Mô tả phải có ít nhất 20 ký tự');
        }

        if (price) {
            if (price.monthly && price.monthly < 0) {
                errors.push('Giá thuê hàng tháng không hợp lệ');
            }
            if (price.deposit && price.deposit < 0) {
                errors.push('Tiền cọc không hợp lệ');
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Dữ liệu không hợp lệ',
                errors
            });
        }

        next();
    }

    // Validate rating
    validateRating(req, res, next) {
        const { rating } = req.body;
        const errors = [];

        if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
            errors.push('Đánh giá phải là số nguyên từ 1 đến 5');
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Dữ liệu không hợp lệ',
                errors
            });
        }

        next();
    }

    // Validate room creation
    async validateRoom(req, res, next) {
    const { property, roomNumber, price, deposit, area, roomType, amenities, capacity } = req.body;
        const errors = [];

        // property không bắt buộc nữa
        if (!roomNumber || roomNumber.trim().length === 0) errors.push('Số phòng là bắt buộc');
        if (price == null || price < 0) errors.push('Giá phòng không hợp lệ');
        if (deposit == null || deposit < 0) errors.push('Tiền cọc không hợp lệ');
        if (area != null && area < 0) errors.push('Diện tích không hợp lệ');
        if (roomType && !['single','double','suite','dorm'].includes(roomType)) errors.push('Loại phòng không hợp lệ');
        if (amenities && !Array.isArray(amenities)) {
            errors.push('Danh sách tiện ích phải là một mảng');
        }

        if (errors.length) {
            return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ', errors });
        }
        // Gán capacity theo roomType nếu không truyền
        if (req.body.capacity == null) {
            const map = { single: 1, double: 2, suite: 3, dorm: 4 };
            req.body.capacity = map[roomType] || 1;
        }
        next();
    }

    // Validate room update
    async validateRoomUpdate(req, res, next) {
    const { price, deposit, area, roomType, status, amenities, capacity } = req.body;
        const errors = [];
        if (price != null && price < 0) errors.push('Giá phòng không hợp lệ');
        if (deposit != null && deposit < 0) errors.push('Tiền cọc không hợp lệ');
        if (area != null && area < 0) errors.push('Diện tích không hợp lệ');
        if (roomType && !['single','double','suite','dorm'].includes(roomType)) errors.push('Loại phòng không hợp lệ');
        if (status && !['available','rented','maintenance','reserved'].includes(status)) errors.push('Trạng thái phòng không hợp lệ');
        if (amenities && !Array.isArray(amenities)) {
            errors.push('Danh sách tiện ích phải là một mảng');
        }

            if (errors.length) {
                return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ', errors });
            }
        next();
    }

    // Validate update room status
    validateRoomStatus(req, res, next) {
        const { status } = req.body;
        if (!status || !['available','rented','maintenance','reserved'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Trạng thái phòng không hợp lệ' });
        }
        next();
    }
}

export default new ValidationMiddleware();
