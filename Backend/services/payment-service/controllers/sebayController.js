/**
 * Sebay Payment Controller - Xử lý tạo QR thanh toán hóa đơn qua Sebay/Sepay
 */
import Invoice from '../../../schemas/Invoice.js';
import { sendEmail } from '../../emailService.js';

// Tạo QR Code thanh toán hóa đơn
export const createInvoicePaymentQR = async (req, res) => {
  try {
    const { amount, description, invoiceId, accountNumber, accountName } = req.body;

    // Validate input
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Số tiền không hợp lệ'
      });
    }

    // Lấy thông tin ngân hàng từ env hoặc request
    const bankCode = process.env.SEPAY_BANK_CODE || 'TPBank';
    const accNumber = accountNumber || process.env.SEPAY_ACCOUNT_NUMBER || '10002322482';
    const accName = accountName || process.env.SEPAY_ACCOUNT_NAME || 'TRAN QUOC HUY';
    
    // Format nội dung chuyển khoản (loại bỏ dấu, viết hoa)
    const transferContent = description || `Thanh toan hoa don ${invoiceId?.slice(-6) || ''}`;
    const formattedContent = transferContent
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    const amountValue = parseFloat(amount);

    // Tạo QR Code URL theo format Sepay
    const qrCodeUrl = `https://qr.sepay.vn/img?acc=${accNumber}&bank=${bankCode}&amount=${amountValue}&des=${encodeURIComponent(formattedContent)}`;

    // Nếu có invoiceId, cập nhật thông tin QR vào invoice
    if (invoiceId) {
      try {
        await Invoice.findByIdAndUpdate(invoiceId, {
          $set: {
            paymentQRCode: qrCodeUrl,
            paymentQRContent: formattedContent
          }
        });
      } catch (updateError) {
        console.error('Error updating invoice with QR code:', updateError);
        // Không return error, vẫn trả về QR code
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        qrCodeUrl,
        qrContent: formattedContent,
        bankInfo: {
          bankCode,
          accountNumber: accNumber,
          accountName: accName,
          amount: amountValue
        }
      },
      message: 'Tạo mã QR thanh toán thành công'
    });

  } catch (error) {
    console.error('Error creating payment QR:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo mã QR thanh toán',
      error: error.message
    });
  }
};

// Gửi email hóa đơn kèm QR code
export const sendInvoiceEmailWithQR = async (req, res) => {
  try {
    const { invoiceId, tenantEmail, qrCodeUrl } = req.body;

    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin hóa đơn'
      });
    }

    // Lấy thông tin hóa đơn
    const invoice = await Invoice.findById(invoiceId)
      .populate('contractId')
      .populate({
        path: 'contractId',
        populate: {
          path: 'room'
        }
      });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hóa đơn'
      });
    }

    // Lấy email từ request hoặc từ contract
    const recipientEmail = tenantEmail || invoice.contractId?.tenants?.[0]?.email;
    
    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy email khách thuê'
      });
    }

    // Sử dụng QR code đã có hoặc từ invoice
    const qrCode = qrCodeUrl || invoice.paymentQRCode;

    if (!qrCode) {
      return res.status(400).json({
        success: false,
        message: 'Chưa có mã QR thanh toán'
      });
    }

    // Tạo nội dung email HTML
    const emailSubject = `Hóa đơn phòng ${invoice.contractId?.room?.roomNumber || ''} - Tháng ${new Date(invoice.periodStart).getMonth() + 1}/${new Date(invoice.periodStart).getFullYear()}`;
    
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #333; text-align: center;">HÓA ĐƠN TIỀN PHÒNG</h2>
        
        <div style="margin: 20px 0;">
          <p><strong>Phòng:</strong> ${invoice.contractId?.room?.roomNumber || ''}</p>
          <p><strong>Kỳ thanh toán:</strong> ${new Date(invoice.periodStart).toLocaleDateString('vi-VN')} - ${new Date(invoice.periodEnd).toLocaleDateString('vi-VN')}</p>
          <p><strong>Ngày lập:</strong> ${new Date(invoice.issueDate).toLocaleDateString('vi-VN')}</p>
          <p><strong>Hạn thanh toán:</strong> ${new Date(invoice.dueDate).toLocaleDateString('vi-VN')}</p>
        </div>

        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Chi tiết thanh toán:</h3>
          ${invoice.charges?.map(charge => `
            <div style="display: flex; justify-content: space-between; margin: 5px 0;">
              <span>${charge.description}</span>
              <span>${charge.amount.toLocaleString('vi-VN')} VNĐ</span>
            </div>
          `).join('') || ''}
          ${invoice.discount > 0 ? `
            <div style="display: flex; justify-content: space-between; margin: 5px 0; color: #e74c3c;">
              <span>Giảm giá</span>
              <span>-${invoice.discount.toLocaleString('vi-VN')} VNĐ</span>
            </div>
          ` : ''}
          <hr style="margin: 10px 0; border: none; border-top: 2px solid #333;">
          <div style="display: flex; justify-content: space-between; margin: 10px 0; font-size: 18px; font-weight: bold; color: #e74c3c;">
            <span>TỔNG CỘNG</span>
            <span>${invoice.totalAmount.toLocaleString('vi-VN')} VNĐ</span>
          </div>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <h3 style="color: #333;">Quét mã QR để thanh toán</h3>
          <img src="${qrCode}" alt="QR Code thanh toán" style="max-width: 300px; border: 2px solid #ddd; border-radius: 8px; padding: 10px;" />
          <p style="margin-top: 10px; color: #666; font-size: 14px;">
            Nội dung chuyển khoản: <strong>${invoice.paymentQRContent || ''}</strong>
          </p>
        </div>

        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
          <p style="margin: 0; color: #856404;">
            <strong>Lưu ý:</strong> Vui lòng thanh toán đúng số tiền và nội dung chuyển khoản để hệ thống tự động xác nhận thanh toán.
          </p>
        </div>

        ${invoice.notes ? `
          <div style="margin: 20px 0; padding: 10px; background-color: #f8f9fa; border-radius: 5px;">
            <p style="margin: 0;"><strong>Ghi chú:</strong></p>
            <p style="margin: 5px 0 0 0;">${invoice.notes}</p>
          </div>
        ` : ''}

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
          <p>Cảm ơn bạn đã tin tưởng sử dụng dịch vụ của chúng tôi!</p>
        </div>
      </div>
    `;

    // Gửi email
    await sendEmail({
      to: recipientEmail,
      subject: emailSubject,
      html: emailContent
    });

    return res.status(200).json({
      success: true,
      message: 'Gửi email hóa đơn thành công'
    });

  } catch (error) {
    console.error('Error sending invoice email:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi email hóa đơn',
      error: error.message
    });
  }
};
