/**
 * Validation Middleware - Validate request data
 */
class ValidationMiddleware {
    // Validate user registration
    validateRegister(req, res, next) {
        const { fullName, email, phone, password } = req.body;
        const errors = [];

        if (!fullName || fullName.trim().length < 2) {
            errors.push('Họ tên phải có ít nhất 2 ký tự');
        }

        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            errors.push('Email không hợp lệ');
        }

        if (!phone || !/^[0-9]{10,11}$/.test(phone)) {
            errors.push('Số điện thoại phải có 10-11 số');
        }

        if (!password || password.length < 6) {
            errors.push('Mật khẩu phải có ít nhất 6 ký tự');
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

        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            errors.push('Email không hợp lệ');
        }

        if (!password) {
            errors.push('Mật khẩu là bắt buộc');
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

        if (fullName && fullName.trim().length < 2) {
            errors.push('Họ tên phải có ít nhất 2 ký tự');
        }

        if (phone && !/^[0-9]{10,11}$/.test(phone)) {
            errors.push('Số điện thoại phải có 10-11 số');
        }

        if (dateOfBirth && new Date(dateOfBirth) > new Date()) {
            errors.push('Ngày sinh không hợp lệ');
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
}

export default new ValidationMiddleware();
