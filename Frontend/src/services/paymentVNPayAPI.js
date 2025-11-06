/**
 * VNPay Payment API Service
 * Tập trung các API calls liên quan đến thanh toán VNPay
 */

import { apiUtils } from './api.js';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

/**
 * Create API headers with authentication
 */
const createHeaders = (includeAuth = true) => {
    const headers = {
        'Content-Type': 'application/json'
    };

    if (includeAuth) {
        const token = apiUtils.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }

    return headers;
};

/**
 * Handle API response
 */
const handleResponse = async (response) => {
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }
    
    return data;
};

/**
 * Tạo URL thanh toán VNPay cho đơn hàng đã tồn tại
 * @param {string} orderId - ID của đơn hàng
 * @returns {Promise<Object>} Response data với vnpayUrl
 */
export const createVNPayPaymentUrl = async (orderId) => {
    if (!orderId) {
        throw new Error('Order ID is required');
    }

    if (!apiUtils.isAuthenticated()) {
        throw new Error('Authentication token not found. Please login again.');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/payments/vnpay/create-payment-url`, {
            method: 'POST',
            headers: createHeaders(true),
            body: JSON.stringify({
                orderId: orderId
            })
        });

        return await handleResponse(response);
    } catch (error) {
        console.error('Error creating VNPay payment URL:', error);
        throw error;
    }
};

/**
 * Lấy thông tin đơn hàng đã tồn tại (để hiển thị QR SePay)
 * @param {string} orderId - ID của đơn hàng
 * @returns {Promise<Object>} Response data với thông tin đơn hàng và QR code
 */
export const getOrderInfo = async (orderId) => {
    if (!orderId) {
        throw new Error('Order ID is required');
    }

    if (!apiUtils.isAuthenticated()) {
        throw new Error('Authentication token not found. Please login again.');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/payments/order/${orderId}`, {
            method: 'GET',
            headers: createHeaders(true)
        });

        return await handleResponse(response);
    } catch (error) {
        console.error('Error getting order info:', error);
        throw error;
    }
};

/**
 * Kiểm tra trạng thái thanh toán của đơn hàng
 * @param {string} orderId - ID của đơn hàng
 * @returns {Promise<Object>} Response data với trạng thái thanh toán
 */
export const checkPaymentStatus = async (orderId) => {
    if (!orderId) {
        throw new Error('Order ID is required');
    }

    if (!apiUtils.isAuthenticated()) {
        throw new Error('Authentication token not found. Please login again.');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/payments/status/${orderId}`, {
            method: 'GET',
            headers: createHeaders(true)
        });

        return await handleResponse(response);
    } catch (error) {
        console.error('Error checking payment status:', error);
        throw error;
    }
};

/**
 * Tạo đơn hàng thanh toán mới với PackagePlan
 * @param {Object} orderData - Dữ liệu đơn hàng
 * @param {string} orderData.packagePlanId - ID của gói
 * @param {number} orderData.totalAmount - Tổng số tiền
 * @param {number} orderData.duration - Thời hạn
 * @param {string} orderData.durationUnit - Đơn vị thời hạn
 * @param {Object} orderData.migration - Dữ liệu migration (optional)
 * @returns {Promise<Object>} Response data với thông tin đơn hàng mới
 */
export const createPaymentOrder = async (orderData) => {
    const requiredFields = ['packagePlanId', 'totalAmount'];
    for (const field of requiredFields) {
        if (!orderData[field]) {
            throw new Error(`${field} is required`);
        }
    }

    if (!apiUtils.isAuthenticated()) {
        throw new Error('Authentication token not found. Please login again.');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/payments/create-order`, {
            method: 'POST',
            headers: createHeaders(true),
            body: JSON.stringify(orderData)
        });

        return await handleResponse(response);
    } catch (error) {
        console.error('Error creating payment order:', error);
        throw error;
    }
};

/**
 * Tạo đơn hàng gia hạn gói
 * @param {Object} renewalData - Dữ liệu gia hạn
 * @param {string} renewalData.packagePlanId - ID của gói
 * @param {string} renewalData.expiredPackageId - ID gói đã hết hạn
 * @param {number} renewalData.totalAmount - Tổng số tiền
 * @param {number} renewalData.duration - Thời hạn
 * @param {string} renewalData.durationUnit - Đơn vị thời hạn
 * @param {string} renewalData.packageName - Tên gói
 * @param {boolean} renewalData.isRenewal - Đánh dấu là renewal
 * @returns {Promise<Object>} Response data với thông tin đơn hàng gia hạn
 */
export const createRenewalPaymentOrder = async (renewalData) => {
    const requiredFields = ['packagePlanId', 'totalAmount'];
    for (const field of requiredFields) {
        if (!renewalData[field]) {
            throw new Error(`${field} is required`);
        }
    }

    if (!apiUtils.isAuthenticated()) {
        throw new Error('Authentication token not found. Please login again.');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/payments/create-renewal-order`, {
            method: 'POST',
            headers: createHeaders(true),
            body: JSON.stringify(renewalData)
        });

        return await handleResponse(response);
    } catch (error) {
        console.error('Error creating renewal payment order:', error);
        throw error;
    }
};

/**
 * Lấy lịch sử gói của user
 * @returns {Promise<Object>} Response data với lịch sử gói
 */
export const getUserPackageHistory = async () => {
    if (!apiUtils.isAuthenticated()) {
        throw new Error('Authentication token not found. Please login again.');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/payments/package-history`, {
            method: 'GET',
            headers: createHeaders(true)
        });

        return await handleResponse(response);
    } catch (error) {
        console.error('Error getting user package history:', error);
        throw error;
    }
};

/**
 * Utility function để handle payment redirect
 * @param {string} vnpayUrl - URL VNPay để redirect
 */
export const redirectToVNPay = (vnpayUrl) => {
    if (!vnpayUrl) {
        throw new Error('VNPay URL is required');
    }
    
    // Validate URL format
    try {
        new URL(vnpayUrl);
    } catch (error) {
        throw new Error('Invalid VNPay URL format');
    }
    
    window.location.href = vnpayUrl;
};

/**
 * Parse URL parameters for payment result pages
 * @param {URLSearchParams} searchParams - URL search parameters
 * @returns {Object} Parsed payment result data
 */
export const parsePaymentResult = (searchParams) => {
    return {
        orderId: searchParams.get('orderId'),
        transactionNo: searchParams.get('transactionNo'),
        amount: searchParams.get('amount') ? parseFloat(searchParams.get('amount')) : null,
        responseCode: searchParams.get('responseCode'),
        error: searchParams.get('error')
    };
};

/**
 * Get error message from VNPay response code
 * @param {string} responseCode - VNPay response code
 * @returns {string} Human readable error message
 */
export const getVNPayErrorMessage = (responseCode) => {
    const errorMessages = {
        '07': 'Giao dịch bị nghi ngờ',
        '09': 'Thẻ/tài khoản chưa đăng ký dịch vụ',
        '10': 'Sai thông tin xác thực',
        '11': 'Quá hạn chờ thanh toán',
        '12': 'Thẻ/tài khoản bị khóa',
        '13': 'Sai mật khẩu xác thực',
        '24': 'Khách hàng hủy giao dịch',
        '51': 'Tài khoản không đủ số dư',
        '65': 'Vượt quá hạn mức giao dịch trong ngày',
        '75': 'Ngân hàng đang bảo trì',
        '79': 'Vượt quá số tiền giới hạn',
        '99': 'Lỗi không xác định',
        'invalid_signature': 'Chữ ký không hợp lệ',
        'system_error': 'Lỗi hệ thống'
    };

    return errorMessages[responseCode] || 'Giao dịch không thành công';
};

/**
 * Format currency amount for display
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: 'VNĐ')
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currency = 'VNĐ') => {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return 'N/A';
    }
    
    return `${amount.toLocaleString('vi-VN')} ${currency}`;
};

/**
 * Validate order data before creating payment
 * @param {Object} orderData - Order data to validate
 * @returns {Object} Validation result
 */
export const validateOrderData = (orderData) => {
    const errors = [];
    
    if (!orderData) {
        errors.push('Order data is required');
    } else {
        if (!orderData.orderId) {
            errors.push('Order ID is required');
        }
        
        if (!orderData.amount || typeof orderData.amount !== 'number' || orderData.amount <= 0) {
            errors.push('Valid amount is required');
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};
