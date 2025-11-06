/**
 * VNPay Service - Xử lý thanh toán qua VNPay
 */
import crypto from 'crypto';
import qs from 'qs';

// Hàm sortObject theo chuẩn VNPay demo
const sortObject = (obj) => {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    const originalKey = decodeURIComponent(str[key]);
    sorted[originalKey] = encodeURIComponent(obj[originalKey]).replace(/%20/g, "+");
  }
  return sorted;
};

export const createVnpayUrl = (orderId, amount, ipAddr, orderInfo = null) => {
  const date = new Date();
  const createDate = date
    .toISOString()
    .replace(/[-:T.Z]/g, '')
    .slice(0, 14); // yyyyMMddHHmmss

  const tmnCode = process.env.VNP_TMN_CODE;
  const secretKey = process.env.VNP_HASH_SECRET;
  const vnpUrl = process.env.VNP_URL;
  const returnUrl = process.env.VNP_RETURN_URL;

  console.log('VNPay Config:', { tmnCode, secretKey: secretKey ? 'exists' : 'missing', vnpUrl, returnUrl });

  if (!tmnCode || !secretKey || !vnpUrl || !returnUrl) {
    throw new Error('VNPay configuration is missing in environment variables');
  }

  const vnp_Params = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode,
    vnp_Locale: 'vn',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: orderId.toString(),
    vnp_OrderInfo: orderInfo || `Thanh toan don hang ${orderId}`,
    vnp_OrderType: 'billpayment',
    vnp_Amount: (amount * 100).toString(), // nhân 100 và convert sang string
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: createDate,
  };

  console.log('VNPay Params before signing:', vnp_Params);

  // Sử dụng hàm sortObject chuẩn VNPay
  const sortedParams = sortObject(vnp_Params);
  
  // Tạo query string để ký
  const signData = Object.keys(sortedParams)
    .map(key => `${key}=${sortedParams[key]}`)
    .join('&');

  console.log('Sign data:', signData);

  // Tạo chữ ký
  const hmac = crypto.createHmac('sha512', secretKey);
  const signed = hmac.update(signData, 'utf-8').digest('hex');
  
  // Thêm chữ ký vào params đã được sort và encode
  const finalParams = { ...sortedParams, vnp_SecureHash: signed };

  console.log('Generated signature:', signed);

  // Tạo URL cuối cùng - sử dụng params đã được encode đúng chuẩn VNPay
  const finalUrl = `${vnpUrl}?${Object.keys(finalParams)
    .map(key => `${key}=${finalParams[key]}`)
    .join('&')}`;

  console.log('Final VNPay URL:', finalUrl);
  return finalUrl;
};

export const verifyVnpayCallback = (vnpParams) => {
  const secretKey = process.env.VNP_HASH_SECRET;
  const secureHash = vnpParams.vnp_SecureHash;
  
  console.log('Verifying VNPay callback with params:', vnpParams);
  console.log('Received signature:', secureHash);
  
  // Tạo bản sao để không thay đổi object gốc
  const params = { ...vnpParams };
  
  // Xóa các tham số không cần thiết cho việc verify
  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;

  // Lọc bỏ các params rỗng
  const filteredParams = {};
  Object.keys(params).forEach(key => {
    if (params[key] !== '' && params[key] !== null && params[key] !== undefined) {
      filteredParams[key] = params[key];
    }
  });

  // Sử dụng hàm sortObject chuẩn VNPay cho verify
  const sortedParams = sortObject(filteredParams);

  // Tạo query string để verify
  const signData = Object.keys(sortedParams)
    .map(key => `${key}=${sortedParams[key]}`)
    .join('&');

  console.log('Verify sign data:', signData);

  // Tạo chữ ký để so sánh
  const hmac = crypto.createHmac('sha512', secretKey);
  const signed = hmac.update(signData, 'utf-8').digest('hex');

  console.log('Generated signature for verification:', signed);
  console.log('Signature match:', secureHash === signed);

  return secureHash === signed;
};

export const parseVnpayResponse = (vnpParams) => {
  return {
    orderId: vnpParams.vnp_TxnRef,
    amount: parseInt(vnpParams.vnp_Amount) / 100, // chia 100 để trở về số tiền gốc
    responseCode: vnpParams.vnp_ResponseCode,
    transactionNo: vnpParams.vnp_TransactionNo,
    bankCode: vnpParams.vnp_BankCode,
    payDate: vnpParams.vnp_PayDate,
    isSuccess: vnpParams.vnp_ResponseCode === '00'
  };
};
