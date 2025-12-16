/**
 * Sepay Webhook Controller - Xử lý webhook từ Sepay khi có giao dịch
 */
import Invoice from '../../../schemas/Invoice.js';
import { sendPaymentSuccessEmail } from '../../../services/emailService.js';
import crypto from 'crypto';

/**
 * Verify webhook signature từ Sepay
 * @param {Object} payload - Dữ liệu webhook
 * @param {String} signature - Chữ ký từ header
 * @returns {Boolean}
 */
const verifyWebhookSignature = (payload, signature) => {
  try {
    const apiKey = process.env.SEPAY_API_KEY_INVOICE;
    if (!apiKey) return true; // Skip verify nếu chưa config API key (dev mode)
    
    // Tạo hash từ payload + API key
    const hash = crypto
      .createHmac('sha256', apiKey)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return hash === signature;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
};

/**
 * Trích xuất thông tin từ nội dung chuyển khoản
 * @param {String} content - Nội dung chuyển khoản
 * @returns {Object} - { roomNumber, invoiceCode }
 */
const extractInfoFromContent = (content) => {
  if (!content) return { roomNumber: null, invoiceCode: null };
  
  // Loại bỏ dấu và chuyển thành chữ hoa để so sánh
  const normalizedContent = content
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  
  console.log('Normalized content:', normalizedContent);
  
  // Pattern 1: Tìm số phòng - VD: "PHONG P04" hoặc "PHONG 101"
  const roomPatterns = [
    /PHONG\s+([A-Z0-9]+)/i,
    /ROOM\s+([A-Z0-9]+)/i,
    /P\s*([0-9]+)/i
  ];
  
  let roomNumber = null;
  for (const pattern of roomPatterns) {
    const match = normalizedContent.match(pattern);
    if (match && match[1]) {
      roomNumber = match[1];
      console.log('Found room number:', roomNumber);
      break;
    }
  }
  
  // Pattern 2: Tìm mã invoice (6+ ký tự)
  const codePatterns = [
    /HOA DON\s+([A-Z0-9]{6,})/i,
    /HOADON\s+([A-Z0-9]{6,})/i,
    /HD\s*([A-Z0-9]{6,})/i,
    /INV\s*([A-Z0-9]{6,})/i,
    /([A-Z0-9]{6,})$/ // Mã ở cuối
  ];
  
  let invoiceCode = null;
  for (const pattern of codePatterns) {
    const match = normalizedContent.match(pattern);
    if (match && match[1]) {
      invoiceCode = match[1];
      console.log('Found invoice code:', invoiceCode);
      break;
    }
  }
  
  return { roomNumber, invoiceCode };
};

/**
 * Webhook endpoint nhận thông báo từ Sepay
 */
export const handleSepayWebhook = async (req, res) => {
  try {
    console.log('=== SEPAY WEBHOOK RECEIVED ===');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    
    const webhookData = req.body;
    
    // Verify signature (nếu có)
    const signature = req.headers['x-sepay-signature'] || req.headers['sepay-signature'];
    if (signature && !verifyWebhookSignature(webhookData, signature)) {
      console.error('Invalid webhook signature');
      return res.status(401).json({
        success: false,
        message: 'Invalid signature'
      });
    }
    
    // Lấy thông tin giao dịch từ webhook
    // Format của Sepay có thể khác nhau, điều chỉnh theo docs
    const transaction = webhookData.data || webhookData;
    
    // Sepay có thể gửi với các field name khác nhau
    const transaction_id = transaction.transaction_id || transaction.id || transaction.referenceCode;
    const transferAmount = transaction.transferAmount || transaction.amount;
    const content = transaction.content || transaction.description;
    const transferType = transaction.transferType;
    const status = transaction.status || (transferType === 'in' ? 'success' : null);
    const accountNumber = transaction.accountNumber;
    const bankCode = transaction.bankCode || transaction.gateway;
    
    console.log('Transaction details:', {
      transaction_id,
      transferAmount,
      content,
      status,
      transferType
    });
    
    // Chỉ xử lý giao dịch tiền vào (transferType = 'in')
    if (transferType !== 'in' && transferType !== 1) {
      console.log('Not an incoming transaction, skipping...');
      return res.status(200).json({
        success: true,
        message: 'Not an incoming transaction, ignored'
      });
    }
    
    // Trích xuất thông tin từ nội dung chuyển khoản
    const { roomNumber, invoiceCode } = extractInfoFromContent(content);
    
    if (!roomNumber && !invoiceCode) {
      console.log('Could not extract room or invoice info from content:', content);
      return res.status(200).json({
        success: true,
        message: 'No room or invoice info found in transfer content'
      });
    }
    
    console.log('Extracted info:', { roomNumber, invoiceCode });
    
    // Tìm invoice - ưu tiên theo invoiceCode, sau đó theo roomNumber
    let invoice = null;
    
    if (invoiceCode) {
      // Tìm theo mã invoice
      invoice = await Invoice.findOne({
        $or: [
          { paymentQRContent: new RegExp(invoiceCode, 'i') },
          { invoiceNumber: new RegExp(invoiceCode, 'i') }
        ]
      });
    }
    
    if (!invoice && roomNumber) {
      // Tìm theo số phòng - lấy invoice chưa thanh toán mới nhất
      const Room = (await import('../../../schemas/index.js')).Room;
      const room = await Room.findOne({
        $or: [
          { roomNumber: roomNumber },
          { roomNumber: new RegExp(roomNumber, 'i') }
        ]
      });
      
      if (room) {
        console.log('Found room:', room._id, room.roomNumber);
        
        // Tìm invoice chưa thanh toán của phòng này
        invoice = await Invoice.findOne({
          room: room._id,
          status: { $in: ['draft', 'sent', 'overdue'] },
          totalAmount: transferAmount // Khớp số tiền
        }).sort({ issueDate: -1 });
        
        if (!invoice) {
          // Nếu không tìm thấy với số tiền chính xác, tìm theo khoảng ±1000
          invoice = await Invoice.findOne({
            room: room._id,
            status: { $in: ['draft', 'sent', 'overdue'] },
            totalAmount: { 
              $gte: transferAmount - 1000,
              $lte: transferAmount + 1000
            }
          }).sort({ issueDate: -1 });
        }
      }
    }
    
    if (!invoice) {
      console.log('Invoice not found with room:', roomNumber, 'or code:', invoiceCode);
      return res.status(200).json({
        success: true,
        message: 'Invoice not found'
      });
    }
    
    console.log('Found invoice:', invoice._id, '- Current status:', invoice.status);
    
    // Kiểm tra hóa đơn đã thanh toán chưa
    if (invoice.status === 'paid') {
      console.log('Invoice already paid, skipping...');
      return res.status(200).json({
        success: true,
        message: 'Invoice already paid'
      });
    }
    
    // Kiểm tra số tiền khớp (cho phép sai lệch 1000 VNĐ)
    const amountDiff = Math.abs(transferAmount - invoice.totalAmount);
    if (amountDiff > 1000) {
      console.log('Amount mismatch:', {
        expected: invoice.totalAmount,
        received: transferAmount,
        diff: amountDiff
      });
      
      // Vẫn log lại nhưng không tự động cập nhật
      return res.status(200).json({
        success: true,
        message: 'Amount mismatch, manual verification required',
        data: {
          invoiceId: invoice._id,
          expectedAmount: invoice.totalAmount,
          receivedAmount: transferAmount
        }
      });
    }
    
    // Cập nhật trạng thái hóa đơn
    invoice.status = 'paid';
    invoice.paidDate = new Date();
    invoice.paymentMethod = 'bank_transfer';
    invoice.transactionId = transaction_id;
    
    await invoice.save();
    
    console.log('✅ Invoice updated successfully:', invoice._id);
    
    // Gửi email thông báo thanh toán thành công
    try {
      // Populate thông tin cần thiết
      await invoice.populate([
        { path: 'room', select: 'roomNumber' },
        { path: 'tenant', select: 'email fullName' },
        { path: 'landlord', select: 'fullName phone' }
      ]);
      
      if (invoice.tenant && invoice.room && invoice.landlord) {
        console.log('📧 Sending payment success email to:', invoice.tenant.email);
        
        const emailResult = await sendPaymentSuccessEmail(
          invoice,
          invoice.tenant,
          invoice.room,
          invoice.landlord
        );
        
        if (emailResult.success) {
          console.log('✅ Payment success email sent successfully');
        } else {
          console.error('❌ Failed to send payment success email:', emailResult.error);
        }
      } else {
        console.log('⚠️ Missing required data for email:', {
          hasTenant: !!invoice.tenant,
          hasRoom: !!invoice.room,
          hasLandlord: !!invoice.landlord
        });
      }
    } catch (emailError) {
      console.error('Error sending payment success email:', emailError);
      // Không throw error để không ảnh hưởng đến webhook response
    }
    
    return res.status(200).json({
      success: true,
      message: 'Payment processed successfully',
      data: {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        amount: transferAmount,
        status: 'paid'
      }
    });
    
  } catch (error) {
    console.error('Error processing Sepay webhook:', error);
    
    // Vẫn trả về 200 để Sepay không retry
    return res.status(200).json({
      success: false,
      message: 'Error processing webhook',
      error: error.message
    });
  }
};

/**
 * Test webhook endpoint (cho dev)
 */
export const testWebhook = async (req, res) => {
  try {
    const { invoiceId, amount, transactionId } = req.body;
    
    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: 'Invoice ID is required'
      });
    }
    
    const invoice = await Invoice.findById(invoiceId);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }
    
    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Invoice already paid'
      });
    }
    
    // Cập nhật trạng thái
    invoice.status = 'paid';
    invoice.paidDate = new Date();
    invoice.paymentMethod = 'bank_transfer';
    invoice.transactionId = transactionId || `TEST_${Date.now()}`;
    
    await invoice.save();
    
    // Gửi email thông báo thanh toán thành công (test mode)
    try {
      await invoice.populate([
        { path: 'room', select: 'roomNumber' },
        { path: 'tenant', select: 'email fullName' },
        { path: 'landlord', select: 'fullName phone' }
      ]);
      
      if (invoice.tenant && invoice.room && invoice.landlord) {
        console.log('📧 Sending payment success email (test mode) to:', invoice.tenant.email);
        
        const emailResult = await sendPaymentSuccessEmail(
          invoice,
          invoice.tenant,
          invoice.room,
          invoice.landlord
        );
        
        if (emailResult.success) {
          console.log('✅ Payment success email sent successfully (test mode)');
        }
      }
    } catch (emailError) {
      console.error('Error sending payment success email (test mode):', emailError);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Invoice marked as paid (test mode)',
      data: {
        invoiceId: invoice._id,
        status: 'paid',
        paidDate: invoice.paidDate
      }
    });
    
  } catch (error) {
    console.error('Error testing webhook:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing test webhook',
      error: error.message
    });
  }
};