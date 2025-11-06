import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import PaymentHistoryAPI from '../../../services/paymentHistoryAPI';
import PropertiesPackageAPI from '../../../services/PropertiesPackageAPI';
import './PaymentHistory.css';

const PaymentHistory = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    payment_status: 'all',
    sortBy: 'created_at',
    sortOrder: 'desc'
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  // Load packages
  const loadPackages = async () => {
    try {
      const response = await PropertiesPackageAPI.getAllPackages();
      if (response.success) {
        setPackages(response.data || []);
      }
    } catch (error) {
      console.error('Error loading packages:', error);
    }
  };

  // Load payment history
  const loadPayments = async () => {
    console.log('Loading payments with filters:', filters, 'and pagination:', pagination);
    try {
      setLoading(true);
      const params = {
        ...filters,
        page: pagination.page,
        limit: pagination.limit
      };

      // Loại bỏ 'all' status khỏi params
      if (params.payment_status === 'all') {
        delete params.payment_status;
      }

      console.log('Calling API with params:', params);
      const response = await PaymentHistoryAPI.getPaymentHistory(params);
      console.log('API Response:', response);

      if (response.success) {
        console.log('Setting payments:', response.data.orders || []);

        // Xử lý dữ liệu orders để convert các field đặc biệt
        const processedOrders = (response.data.orders || []).map(order => ({
          ...order,
          // Convert Decimal128 to number
          total: order.total?.$numberDecimal ? parseFloat(order.total.$numberDecimal) : order.total,
          // Ensure ObjectId is string
          _id: order._id?.toString ? order._id.toString() : order._id,
          propertyId: order.propertyId ? {
            ...order.propertyId,
            _id: order.propertyId._id?.toString ? order.propertyId._id.toString() : order.propertyId._id
          } : null
        }));

        console.log('Processed orders:', processedOrders);
        setPayments(processedOrders);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination?.total || 0,
          totalPages: response.data.pagination?.totalPages || 0
        }));
      } else {
        console.log('API call failed:', response);
        toast.error('Không thể tải lịch sử thanh toán');
        setPayments([]);
      }
    } catch (error) {
      console.error('Error loading payments:', error);
      console.error('Error details:', error.message);
      toast.error('Lỗi khi tải lịch sử thanh toán: ' + (error.message || 'Unknown error'));
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  // Debug component mount
  useEffect(() => {
    console.log('PaymentHistory component mounted');
    loadPackages();
  }, []);

  // Load payments on component mount and filter changes
  useEffect(() => {
    console.log('useEffect triggered - loading payments');
    loadPayments();
  }, [filters.payment_status, filters.sortBy, filters.sortOrder, pagination.page]);

  // Handle filter change
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setPagination(prev => ({
      ...prev,
      page: 1
    }));
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    setPagination(prev => ({
      ...prev,
      page: newPage
    }));
  };

  // Handle payment action
  const handlePayment = (payment) => {
    console.log('Handling payment for order:', payment);
    // Xác định loại thanh toán (gia hạn hay nâng cấp)
    const getPaymentAction = (payment) => {
      // Kiểm tra từ tên gói hoặc description để xác định
      const name = payment.name || '';
      const packageName = payment.packageInfo?.name || '';

      if (name.toLowerCase().includes('gia hạn') || name.toLowerCase().includes('renewal')) {
        return 'renewal';
      } else if (name.toLowerCase().includes('nâng cấp') || name.toLowerCase().includes('upgrade')) {
        return 'upgrade';
      } else {
        // Mặc định là upgrade nếu không xác định được
        return 'upgrade';
      }
    };

    const paymentAction = getPaymentAction(payment);
    const isRenewal = paymentAction === 'renewal';
    const isUpgrade = paymentAction === 'upgrade';

    // Calculate pricing information for existing order
    const totalAmount = typeof payment.total === 'object' && payment.total?.$numberDecimal ?
      parseFloat(payment.total.$numberDecimal) :
      (typeof payment.total === 'number' ? payment.total : 0);

    // Reverse calculate VAT (assuming 8% VAT was included)
    const subtotalAmount = Math.round(totalAmount / 1.08);
    const vatAmount = totalAmount - subtotalAmount;

    // Calculate expiry date based on duration
    const duration = payment.packageInfo?.duration || 1;
    const durationUnit = payment.packageInfo?.durationUnit || 'month';
    let expiryDate = new Date();

    if (durationUnit === 'day') {
      expiryDate.setDate(expiryDate.getDate() + duration);
    } else if (durationUnit === 'month') {
      expiryDate.setMonth(expiryDate.getMonth() + duration);
    } else if (durationUnit === 'year') {
      expiryDate.setFullYear(expiryDate.getFullYear() + duration);
    }

    // Prepare payment data for direct navigation to payment page
    // QUAN TRỌNG: Đây là đơn hàng ĐÃ TỒN TẠI, không tạo mới
    const paymentData = {
      // Thông tin đơn hàng cũ - KHÔNG TẠO MỚI
      existingOrder: {
        orderId: payment._id,
        orderCode: payment.orderCode || '', // Mã đơn hàng như TKPH13 DH714772
        status: payment.payment_status,
        createdAt: payment.created_at
      },
      packageInfo: {
        _id: payment.packagePlanId || payment.packageId?._id,
        packageId: payment.packagePlanId || payment.packageId?._id,
        name: payment.packageInfo?.name || payment.name || 'Gói cơ bản',
        displayName: payment.packageInfo?.displayName || payment.packageInfo?.name || payment.name || 'Gói cơ bản',
        dailyPrice: Math.round(totalAmount / duration),
        color: '#007bff'
      },
      pricing: {
        basePrice: subtotalAmount,
        subtotal: subtotalAmount,
        vatAmount: vatAmount,
        totalPrice: totalAmount
      },
      timeline: {
        duration: duration,
        durationUnit: durationUnit,
        expiryDate: expiryDate.toISOString(),
        expiryTime: '23:59',
        durationDisplay: (() => {
          const unitLabels = {
            'day': 'ngày',
            'month': 'tháng',
            'year': 'năm'
          };
          return `${duration} ${unitLabels[durationUnit] || 'ngày'}`;
        })()
      },
      paymentMethod: 'sepay_qr',
      isUpgrade: isUpgrade,
      isRenewal: isRenewal,
      packagePlanId: payment.packagePlanId || payment.packageId?._id,
      totalAmount: totalAmount,
      // Add renewal info if it's a renewal
      renewalInfo: isRenewal ? {
        expiredPackageId: payment.packagePlanId || payment.packageId?._id,
        packageName: payment.packageInfo?.name || payment.name || 'Gói cơ bản'
      } : null,
      // Add migration data if available
      migration: payment.migration || null,
      // CỜ QUAN TRỌNG: Đánh dấu đây là thanh toán từ lịch sử, KHÔNG TẠO ĐỢN MỚI
      fromPaymentHistory: true,
      existingOrderId: payment._id,
      // Thêm flag để payment page biết không tạo đơn mới
      skipOrderCreation: true,
      resumeExistingOrder: true
    };

    console.log('Tiếp tục thanh toán đơn hàng cũ:', {
      orderId: payment._id,
      orderCode: payment.orderCode,
      totalAmount: totalAmount,
      paymentData
    });

    // Navigate directly to payment page with state
    navigate('/profile/payment', { state: paymentData });
  };

  // Format price
  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN').format(price) + ' VNĐ';
  };

  // Format duration display
  const formatDuration = (packageInfo) => {
    console.log('Formatting duration for packageInfo:', packageInfo);
    // Kiểm tra cả packageName và name cho gói trial, vĩnh viễn
    if (packageInfo?.packageName === 'trial' || packageInfo?.name === 'trial') {
      return 'vĩnh viễn';
    }
    if (packageInfo?.duration && packageInfo?.durationUnit) {
      const unitLabels = {
        'day': 'ngày',
        'month': 'tháng',
        'year': 'năm'
      };
      return `${packageInfo.duration} ${unitLabels[packageInfo.durationUnit]}`;
    } else if (packageInfo?.durationDays) {
      return `${packageInfo.durationDays} ngày`;
    } else {
      return '1 tháng';
    }
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      Paid: { class: 'status-paid', text: 'Đã thanh toán', icon: 'fa-check-circle' },
      Unpaid: { class: 'status-pending-payment-history', text: 'Chưa thanh toán', icon: 'fa-clock' },
      Failed: { class: 'status-failed', text: 'Thất bại', icon: 'fa-times-circle' },
      Cancelled: { class: 'status-cancelled', text: 'Đã hủy', icon: 'fa-ban' }
    };

    const config = statusConfig[status] || statusConfig.Pending;
    return (
      <span className={`status-badge ${config.class}`}>
        <i className={`fa ${config.icon}`}></i>
        {config.text}
      </span>
    );
  };

  // Get package style and stars
  const getPackageStyle = (packageInfo, packageId, packagePlanId) => {
    // Tìm package từ danh sách packages đã load
    const packageDisplayName = packageInfo?.displayName || packageId?.displayName || packageInfo?.name || '';
    const packageFromList = packages.find(pkg =>
      pkg.displayName === packageDisplayName ||
      pkg.displayName === packageId?.displayName ||
      pkg._id === packageId?._id ||
      pkg._id === packagePlanId
    );

    if (packageFromList) {
      return {
        color: packageFromList.color || '#6c757d',
        stars: packageFromList.stars || 0,
        displayName: packageFromList.displayName || packageFromList.name || 'Gói cơ bản',
        textStyle: packageFromList.textStyle || 'normal'
      };
    }

    // Fallback nếu không tìm thấy trong danh sách
    const nameToCheck = (packageInfo?.name || packageDisplayName || '').toLowerCase();
    if (nameToCheck.includes('vip_dac_biet') || nameToCheck.includes('vip đặc biệt')) {
      return {
        color: '#ff6b35',
        stars: 5,
        displayName: 'TIN VIP ĐẶC BIỆT',
        textStyle: 'uppercase'
      };
    } else if (nameToCheck.includes('tin_vip_noi_bat') || nameToCheck.includes('tin vip nổi bật')) {
      return {
        color: '#dc3545',
        stars: 3,
        displayName: 'TIN VIP NỔI BẬT',
        textStyle: 'uppercase'
      };
    } else if (nameToCheck.includes('tin_vip_1') || nameToCheck.includes('tin vip 1')) {
      return {
        color: '#e83e8c',
        stars: 2,
        displayName: 'TIN VIP 1',
        textStyle: 'uppercase'
      };
    } else {
      return {
        color: '#6c757d',
        stars: 0,
        displayName: packageInfo?.name || packageId?.name || 'Gói cơ bản',
        textStyle: 'normal'
      };
    }
  };

  // Render stars
  const renderStars = (count) => {
    return Array.from({ length: count }, (_, index) => (
      <span key={index} className="star">★</span>
    ));
  };

  // Generate page numbers for pagination
  const generatePageNumbers = () => {
    const pages = [];
    const maxPages = 5;
    const start = Math.max(1, pagination.page - Math.floor(maxPages / 2));
    const end = Math.min(pagination.totalPages, start + maxPages - 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  console.log('PaymentHistory component rendering with payments:', payments.length);
  console.log('Loading state:', loading);

  return (
    <div className="payment-history-my-properties">
      {/* Header */}
      <div className="payment-history-header">
        <h2>
          <i className="fa fa-credit-card"></i>
          Lịch Sử Thanh Toán
        </h2>
        <p>Quản lý và theo dõi tất cả các giao dịch thanh toán của bạn</p>
      </div>

      {/* Filters */}
      <div className="payment-history-filters">
        <div className="filter-row">
          <div className="filter-group-payment-history">
            <label>Trạng thái thanh toán</label>
            <select
              className="filter-select"
              value={filters.payment_status}
              onChange={(e) => handleFilterChange('payment_status', e.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="Paid">Đã thanh toán</option>
              <option value="Unpaid">Chưa thanh toán</option>
              <option value="Failed">Thất bại</option>
              <option value="Cancelled">Đã hủy</option>
            </select>
          </div>

          <div className="filter-group-payment-history">
            <label>Thứ tự</label>
            <select
              className="filter-select"
              value={filters.sortOrder}
              onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
            >
              <option value="desc">Mới nhất</option>
              <option value="asc">Cũ nhất</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payment Table */}
      <div className="payment-history-table">
        <div className="table-container">
          <table className="payment-table">
            <thead>
              <tr>
                <th className="stt-column">STT</th>
                <th>Phí Thanh Toán</th>
                <th>Gói</th>
                <th>Phương thức</th>
                <th>Thời hạn</th>
                <th>Trạng Thái</th>
                <th>Ngày Tạo Hóa Đơn</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8">

                    <div className="spinner-container">
                      <div className="spinner"></div>
                      <span className="loading-text">Đang tải dữ liệu...</span>
                    </div>

                  </td>
                </tr>
              ) : payments.length > 0 ? (
                payments.map((payment, index) => (
                  <tr key={payment._id}>
                    <td className="stt-cell">
                      {(pagination.page - 1) * pagination.limit + index + 1}
                    </td>
                    <td className="total-cell">
                      {formatPrice(typeof payment.total === 'object' && payment.total?.$numberDecimal ?
                        parseFloat(payment.total.$numberDecimal) :
                        (typeof payment.total === 'number' ? payment.total : 0))}
                    </td>


                    <td>
                      <div className="package-info">
                        <div className="property-title-payment-history">
                          {payment.propertyId?.title || payment.name || (payment.packagePlanId ? 'Nâng cấp tài khoản' : 'Không có thông tin')}

                        </div>
                        {(() => {
                          const packageStyle = getPackageStyle(payment.packageInfo, payment.packageId, payment.packagePlanId);
                          return (
                            <div
                              className="package-name-payment-history"
                              style={{
                                color: packageStyle.color,
                                textTransform: packageStyle.textStyle
                              }}
                            >
                              {packageStyle.displayName}
                              {packageStyle.stars > 0 && (
                                <span className="package-stars">
                                  {renderStars(packageStyle.stars)}
                                </span>
                              )}
                            </div>
                          );
                        })()}

                      </div>
                    </td>

                    <td className="method-cell">
                      <span className={`payment-badge ${payment.paymentMethod.toLowerCase()}`}>
                        {payment.paymentMethod}
                      </span>
                    </td>
                    <td className="duration-cell">
                      <span className="duration-badge">
                        {formatDuration(payment.packageInfo)}
                      </span>
                    </td>
                    <td>
                      {getStatusBadge(payment.payment_status)}
                    </td>

                    <td className="time-cell">
                      {formatDate(payment.created_at)}
                    </td>
                    <td className="action-cell">
                      {payment.payment_status === 'Unpaid' ? (
                        <button
                          className="btn-payment-action"
                          onClick={() => handlePayment(payment)}
                          title="Thanh toán ngay"
                        >
                          <i className="fa fa-credit-card"></i>
                          Thanh toán
                        </button>
                      ) : (
                        <span className="no-action">-</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8">
                    <div className="no-payments">
                      <i className="fa fa-credit-card"></i>
                      <h3>Chưa có giao dịch nào</h3>
                      <p>Bạn chưa thực hiện giao dịch thanh toán nào.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {payments.length > 0 && (
        <div className="payment-history-pagination">
          <button
            className="pagination-btn-payment-history"
            disabled={pagination.page <= 1}
            onClick={() => handlePageChange(pagination.page - 1)}
          >
            <i className="fa fa-chevron-left"></i>
            Trước
          </button>

          <div className="page-numbers">
            {generatePageNumbers().map(pageNum => (
              <button
                key={pageNum}
                className={`page-number-payment-history ${pageNum === pagination.page ? 'active' : ''}`}
                onClick={() => handlePageChange(pageNum)}
              >
                {pageNum}
              </button>
            ))}
          </div>

          <button
            className="pagination-btn-payment-history"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => handlePageChange(pagination.page + 1)}
          >
            Sau
            <i className="fa fa-chevron-right"></i>
          </button>

          <div className="pagination-info">
            Trang {pagination.page} / {pagination.totalPages} -
            Tổng {pagination.total} giao dịch
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentHistory;
