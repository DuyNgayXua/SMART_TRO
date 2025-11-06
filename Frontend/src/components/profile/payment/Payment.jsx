import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import PaymentAPI from '../../../services/PaymentPackageAPI.js';
import PropertiesPackageAPI from '../../../services/PropertiesPackageAPI.js';
import './Payment.css';

const Payment = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paymentData = location.state;
  
  console.log('Location object:', location);
  console.log('Payment component loaded with paymentData:', paymentData);
  console.log('PaymentData keys:', paymentData ? Object.keys(paymentData) : 'null');

  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('pending'); // pending, processing, success, failed
  const [countdown, setCountdown] = useState(900); // 15 minutes
  const [isPolling, setIsPolling] = useState(false);
  const [orderCreated, setOrderCreated] = useState(false); // Flag để tránh tạo order duplicate
  const orderCreationRef = useRef(false); // Ref để tránh duplicate trong StrictMode
  const pollingStartedRef = useRef(false); // Ref để tránh duplicate polling
  const toastShownRef = useRef(false); // Ref để tránh duplicate toast
  const createOrderToastRef = useRef(false); // Ref để tránh duplicate toast tạo đơn
  const successToastShownRef = useRef(false); // Ref để tránh duplicate toast thành công

  useEffect(() => {
    // Kiểm tra nếu đây là return từ VNPay
    const status = searchParams.get('status');
    const paymentMethod = searchParams.get('paymentMethod');
    const orderId = searchParams.get('orderId');
    const transactionNo = searchParams.get('transactionNo');
    const amount = searchParams.get('amount');
    const responseCode = searchParams.get('responseCode');
    const error = searchParams.get('error');

    if (status && paymentMethod === 'vnpay') {
      console.log('VNPay return detected:', { status, orderId, transactionNo, amount, responseCode, error });
      
      if (status === 'success') {
        setPaymentStatus('success');
        if (!successToastShownRef.current) {
          successToastShownRef.current = true;
         
        }
        
        // Hiển thị UI success trong Payment.jsx, sau đó chuyển hướng sau 3 giây
        setTimeout(() => {
          navigate('/profile/my-posts');
        }, 5000);
        // KHÔNG return ở đây, để component tiếp tục render UI success
      } else if (status === 'failed') {
        setPaymentStatus('failed');
        const errorMessage = error === 'invalid_signature' ? 'Chữ ký không hợp lệ' :
                           error === 'system_error' ? 'Lỗi hệ thống' :
                           responseCode ? `Lỗi thanh toán (${responseCode})` : 'Thanh toán thất bại';
        toast.error(`Thanh toán VNPay thất bại: ${errorMessage}`);
        // KHÔNG return ở đây, để component tiếp tục render UI failed
      }
      
      // Không tạo order mới khi đây là VNPay return
      return;
    }

    if (!paymentData) {
      toast.error('Thông tin thanh toán không hợp lệ');
      navigate('/profile/properties-package');
      return;
    }

    console.log('PaymentData validation passed:', {
      isRenewal: paymentData.isRenewal,
      isUpgrade: paymentData.isUpgrade,
      renewalInfo: paymentData.renewalInfo,
      existingOrderId: paymentData.existingOrderId,
      fromPaymentHistory: paymentData.fromPaymentHistory
    });

    // Kiểm tra nếu có existingOrderId (từ payment history)
    if (paymentData.existingOrderId && paymentData.fromPaymentHistory) {
      console.log('Lấy thông tin từ đơn hàng đã tồn tại:', paymentData.existingOrderId);
      getExistingOrderInfo(paymentData.existingOrderId);
    } else if (!orderCreated && !orderCreationRef.current) {
      // Chỉ tạo order mới nếu không có existing order
      orderCreationRef.current = true;
      createPaymentOrder();
    }
  }, [searchParams, paymentData, navigate, orderCreated]);

  // Countdown timer
  useEffect(() => {
    if (paymentStatus === 'processing' && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);

      return () => clearInterval(timer);
    } else if (countdown <= 0) {
      setPaymentStatus('failed');
      toast.error('Đã hết thời gian thanh toán');
    }
  }, [paymentStatus, countdown]);



  // Lấy thông tin đơn hàng đã tồn tại
  const getExistingOrderInfo = async (existingOrderId) => {
    try {
      setLoading(true);
      console.log('Đang lấy thông tin đơn hàng đã tồn tại:', existingOrderId);
      
      const response = await PaymentAPI.getOrderInfo(existingOrderId);
      
      if (response.success && response.data) {
        console.log('Thông tin đơn hàng đã tồn tại:', response.data);
        setOrderData(response.data);
        setPaymentStatus('processing');
        setOrderCreated(true); // Đánh dấu đã có order
        
        // Bắt đầu polling kiểm tra trạng thái thanh toán
        startPaymentPolling(response.data.orderId);
        
        // Chỉ hiển thị toast nếu chưa hiển thị
        if (!toastShownRef.current) {
          toastShownRef.current = true;
          toast.success(`Tiếp tục thanh toán đơn hàng ${response.data.orderCode || existingOrderId}`);
        }
      } else {
        throw new Error(response.message || 'Không thể lấy thông tin đơn hàng');
      }
    } catch (error) {
      console.error('Lỗi khi lấy thông tin đơn hàng:', error);
      toast.error('Không thể lấy thông tin đơn hàng. Tạo đơn hàng mới...');
      
      // Fallback: tạo đơn hàng mới nếu không lấy được thông tin đơn cũ
      if (!orderCreated && !orderCreationRef.current) {
        orderCreationRef.current = true;
        createPaymentOrder();
      }
    } finally {
      setLoading(false);
    }
  };

  // Tạo đơn hàng thanh toán
  const createPaymentOrder = async () => {
    // Tránh tạo duplicate order
    if (orderCreated || loading) {
      return;
    }

    try {
      setLoading(true);
      setOrderCreated(true); // Đánh dấu đã bắt đầu tạo order
      
      const orderRequest = {
        packagePlanId: paymentData.packageInfo?.packageId || paymentData.packageInfo?._id,
        duration: paymentData.timeline?.duration,
        durationUnit: paymentData.timeline?.durationUnit,
        totalAmount: paymentData.pricing?.totalPrice,
        packageInfo: paymentData.packageInfo,
        // Add migration data if available , cho chuyển gói
        migration: paymentData.migration || null,
        // Add renewal and upgrade flags
        isRenewal: Boolean(paymentData.isRenewal),
        isUpgrade: Boolean(paymentData.isUpgrade)
      };

      // Thêm thông tin bổ sung cho renewal
      if (paymentData.isRenewal && paymentData.renewalInfo) {
        orderRequest.expiredPackageId = paymentData.renewalInfo.expiredPackageId;
        orderRequest.packageName = paymentData.renewalInfo.packageName;
      }

      console.log('Payment data received:', paymentData);
      console.log('Creating payment order:', orderRequest);
      
      // Sử dụng endpoint khác nhau cho renewal vs upgrade/regular
      const response = paymentData.isRenewal 
        ? await PaymentAPI.createRenewalPaymentOrder(orderRequest)
        : await PaymentAPI.createPaymentOrder(orderRequest);

      
      if (response.success) {
        setOrderData(response.data);
        setPaymentStatus('processing');
        
        // Bắt đầu polling kiểm tra trạng thái thanh toán
        startPaymentPolling(response.data.orderId);
        
        // Chỉ hiển thị toast nếu chưa hiển thị
        if (!createOrderToastRef.current) {
          createOrderToastRef.current = true;
          toast.success(paymentData.isRenewal ? 'Đơn hàng gia hạn đã được tạo. Vui lòng thực hiện chuyển khoản!' : 'Đơn hàng đã được tạo. Vui lòng thực hiện chuyển khoản!');
        }
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      console.error('Error creating payment order:', error);
      toast.error(error.response?.data?.message || 'Lỗi khi tạo đơn hàng');
      setPaymentStatus('failed');
      setOrderCreated(false); // Reset flag nếu có lỗi để có thể thử lại
    } finally {
      setLoading(false);
    }
  };



  // Bắt đầu polling kiểm tra thanh toán
  const startPaymentPolling = async (orderId) => {
    // Ngăn chặn multiple polling sessions
    if (isPolling || pollingStartedRef.current) return;
    
    try {
      setIsPolling(true);
      pollingStartedRef.current = true; // Đánh dấu đã bắt đầu polling
      
      const result = await PaymentAPI.pollPaymentStatus(orderId, 60, 15000); // 60 attempts, 5s interval
      
      // Chỉ hiển thị toast và chuyển trang nếu chưa ở trạng thái success
      if (paymentStatus !== 'success' && !successToastShownRef.current) {
        console.log('Showing success toast for the first time');
        successToastShownRef.current = true; // Đánh dấu đã hiển thị toast
        setPaymentStatus('success');
        // Delay một chút rồi chuyển về trang quản lý tin
        setTimeout(() => {
          navigate('/profile/my-posts', { replace: true });
        }, 5000);
      } else if (paymentStatus !== 'success') {
        console.log('Success toast already shown, skipping...');
      }
      
    } catch (error) {
      console.error('Payment polling error:', error);
      // Chỉ hiển thị toast error nếu chưa có trạng thái error
      if (!['failed', 'cancelled'].includes(paymentStatus)) {
        if (error.message === 'Payment timeout') {
          setPaymentStatus('failed');
          toast.error('Hết thời gian chờ thanh toán');
        } else if (error.message === 'Payment cancelled') {
          setPaymentStatus('cancelled');
          toast.warning('Đơn hàng đã bị hủy');
        }
      }
    } finally {
      setIsPolling(false);
      // Không reset pollingStartedRef ở đây để tránh re-polling
    }
  };

  // Format thời gian countdown
  const formatCountdown = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Sao chép nội dung chuyển khoản
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Đã sao chép vào clipboard');
    }).catch(() => {
      toast.error('Không thể sao chép');
    });
  };

  // Quay lại trang chọn gói
  const handleBack = () => {
    // Thanh toán gói tin cho toàn bộ tài khoản - không cần truyền propertyId cụ thể
    navigate('/profile/properties-package');
  };
   const handleBackAgain = () => {
    // Thanh toán gói tin cho toàn bộ tài khoản - không cần truyền propertyId cụ thể
    navigate('/profile/my-posts');
  };

  if (loading) {
    const loadingMessage = paymentData?.existingOrderId && paymentData?.fromPaymentHistory 
      ? 'Đang tải thông tin đơn hàng...' 
      : 'Đang tạo đơn hàng...';
      
    return (
     <div className="payment-status">
            <div className="spinner-container">
               <div className="spinner"></div>
              <span className="loading-text">{loadingMessage}</span>
            </div>
          </div>
    );
  }

  if (paymentStatus === 'failed') {
    const isVNPayFailed = searchParams.get('paymentMethod') === 'vnpay';
    const vnpayError = searchParams.get('error');
    const vnpayResponseCode = searchParams.get('responseCode');
    
    return (
      <div className="payment-container">
        <div className="payment-failed">
          <div className="status-icon failed">
            <i className="fa fa-times-circle"></i>
          </div>
          <h2>Thanh toán không thành công</h2>
          {isVNPayFailed ? (
            <div className="vnpay-failed-details">
              <p>Thanh toán VNPay thất bại.</p>
              {vnpayError && (
                <p><strong>Lỗi:</strong> {
                  vnpayError === 'invalid_signature' ? 'Chữ ký không hợp lệ' :
                  vnpayError === 'system_error' ? 'Lỗi hệ thống' : vnpayError
                }</p>
              )}
              {vnpayResponseCode && (
                <p><strong>Mã lỗi VNPay:</strong> {vnpayResponseCode}</p>
              )}
            </div>
          ) : (
            <p>Đã xảy ra lỗi trong quá trình thanh toán. Vui lòng thử lại.</p>
          )}
          <button className="btn-retry" onClick={handleBackAgain}>
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'cancelled') {
    return (
      <div className="payment-container">
        <div className="payment-cancelled">
          <div className="status-icon cancelled">
            <i className="fa fa-ban"></i>
          </div>
          <h2>Đơn hàng đã bị hủy</h2>
          <p>Đơn hàng đã được hủy tự động do quá thời gian thanh toán (15 phút).</p>
          <p>Bạn có thể xem lại trong lịch sử thanh toán hoặc tạo đơn hàng mới.</p>
          <div className="cancelled-actions">
            <button className="btn-retry" onClick={handleBackAgain}>
              Tạo đơn mới
            </button>
            <button className="btn-history" onClick={() => navigate('/profile/payment-history')}>
              Xem lịch sử
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'success') {
    const isVNPaySuccess = searchParams.get('paymentMethod') === 'vnpay';
    const vnpayTransactionNo = searchParams.get('transactionNo');
    const vnpayAmount = searchParams.get('amount');
    
    return (
      <div className="payment-container">
        <div className="payment-success">
          <div className="status-icon success">
            <i className="fa fa-check-circle"></i>
          </div>
          <h2>Thanh toán thành công!</h2>
          {isVNPaySuccess ? (
            <div className="vnpay-success-details">
              {vnpayTransactionNo && (
                <p><strong>Mã giao dịch VNPay:</strong> {vnpayTransactionNo}</p>
              )}
              {vnpayAmount && (
                <p className='vnpay-amount'><strong>Số tiền:</strong> {PropertiesPackageAPI.formatPrice(parseFloat(vnpayAmount))} VNĐ</p>
              )}
              <p>Gói tin của bạn đã được giao dịch thành công.</p>
            </div>
          ) : (
            <p>Gói tin của bạn đã được giao dịch thành công.</p>
          )}
          <p>Đang chuyển hướng về trang quản lý tin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-container">
      <div className="payment-content">
        {/* Header */}
        <div className="payment-header">
          <button className="btn-back" onClick={handleBack}>
            <i className="fa fa-arrow-left"></i>
            Quay lại
          </button>
          
          <h2>
            {paymentData?.existingOrderId && paymentData?.fromPaymentHistory 
              ? `Thanh toán đơn hàng ${orderData?.orderCode || paymentData.existingOrderId}`
              : 'Thanh toán đăng tin'
            }
          </h2>
          
          <div className="payment-timers">
            <div className="payment-timer">
              <i className="fa fa-clock-o"></i>
              <span>Thời gian thanh toán: {formatCountdown(countdown)}</span>
            </div>
           
          </div>
        </div>

        <div className="payment-body">
          {/* QR Code Section */}
          <div className="qr-section">
            <h3>Quét mã QR để thanh toán</h3>
            
            {orderData?.qrCode && (
              <div className="qr-container">
                <img src={orderData.qrCode} alt="QR Code" className="qr-image" />
                <p className="qr-note">
                  Mở app ngân hàng và quét mã QR này để thanh toán
                </p>
              </div>
            )}
          </div>

          {/* Bank Info Section */}
          <div className="bank-info-section">
            <h3>Hoặc chuyển khoản thủ công</h3>
            
            {orderData?.bankInfo && (
              <div className="bank-details">
                <div className="bank-row">
                  <span className="label">Ngân hàng:</span>
                  <span className="value">TPBank (Ngân hàng TMCP Tiên Phong)</span>
                </div>
                
                <div className="bank-row">
                  <span className="label">Số tài khoản:</span>
                  <div className="value-with-copy">
                    <span>10002322482</span>
                    <button 
                      className="btn-copy"
                      onClick={() => copyToClipboard('10002322482')}
                    >
                      <i className="fa fa-copy"></i>
                    </button>
                  </div>
                </div>
                
                <div className="bank-row">
                  <span className="label">Tên tài khoản:</span>
                  <span className="value">TRAN QUOC HUY</span>
                </div>
                
                <div className="bank-row">
                  <span className="label">Số tiền:</span>
                  <div className="value-with-copy amount">
                    <span>{PaymentAPI.formatNumber(paymentData?.pricing?.totalPrice || orderData.amount)}₫</span>
                    <button 
                      className="btn-copy"
                      onClick={() => copyToClipboard((paymentData?.pricing?.totalPrice || orderData.amount).toString())}
                    >
                      <i className="fa fa-copy"></i>
                    </button>
                  </div>
                </div>
                
                <div className="bank-row">
                  <span className="label">Nội dung:</span>
                  <div className="value-with-copy">
                    <span className="transfer-content">{orderData.transferContent}</span>
                    <button 
                      className="btn-copy"
                      onClick={() => copyToClipboard(orderData.transferContent)}
                    >
                      <i className="fa fa-copy"></i>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="payment-warning">
              <i className="fa fa-exclamation-triangle"></i>
              <p>
                <strong>Lưu ý quan trọng:</strong> Vui lòng nhập chính xác nội dung chuyển khoản 
                để hệ thống có thể tự động xác nhận thanh toán của bạn.
              </p>
            </div>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="payment-summary-section">
          <h3>Thông tin đơn hàng</h3>
          <div className="summary-details">
            <div className="summary-row">
              <span>Gói tin:</span>
              {console.log(`paymentData`, paymentData)}
              <span>{paymentData?.packageInfo?.displayName}</span>
            </div>
            <div className="summary-row">
              <span>Thời gian:</span>
              <span>{paymentData?.timeline?.durationDisplay}</span>
            </div>
            <div className="summary-row">
              <span>Tổng tiền:</span>
              <span className="total-amount">
                {PropertiesPackageAPI.formatPrice(paymentData?.pricing?.totalPrice)}₫
              </span>
            </div>
          </div>
        </div>

        {/* Status */}
        {isPolling && (
          <div className="payment-status">
            <div className="spinner-container">
               <div className="spinner"></div>
              <span className="loading-text">Đang kiểm tra thanh toán...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Payment;