import api from './api';

/**
 * Sebay Payment QR API Service
 * Tạo mã QR thanh toán qua Sebay
 */
const sebayAPI = {
  /**
   * Tạo mã QR thanh toán
   * @param {Object} paymentData - Thông tin thanh toán
   * @param {number} paymentData.amount - Số tiền thanh toán
   * @param {string} paymentData.description - Nội dung chuyển khoản
   * @param {string} paymentData.invoiceId - Mã hóa đơn (optional)
   * @returns {Promise} Response chứa URL QR code
   */
  async createPaymentQR(paymentData) {
    try {
      const response = await api.post('/payments/sebay/create-qr', {
        amount: paymentData.amount,
        description: paymentData.description,
        invoiceId: paymentData.invoiceId,
        accountName: paymentData.accountName || '',
        accountNumber: paymentData.accountNumber || ''
      });
      return response.data;
    } catch (error) {
      console.error('Error creating Sebay QR code:', error);
      throw error;
    }
  },

  /**
   * Gửi email hóa đơn kèm QR code
   * @param {Object} emailData - Thông tin email
   * @param {string} emailData.invoiceId - ID hóa đơn
   * @param {string} emailData.tenantEmail - Email khách thuê
   * @param {string} emailData.qrCodeUrl - URL QR code (optional, sẽ tạo mới nếu không có)
   * @returns {Promise} Response
   */
  async sendInvoiceEmailWithQR(emailData) {
    try {
      const response = await api.post('/payments/sebay/send-invoice-email', {
        invoiceId: emailData.invoiceId,
        tenantEmail: emailData.tenantEmail,
        qrCodeUrl: emailData.qrCodeUrl
      });
      return response.data;
    } catch (error) {
      console.error('Error sending invoice email with QR:', error);
      throw error;
    }
  }
};

export default sebayAPI;
