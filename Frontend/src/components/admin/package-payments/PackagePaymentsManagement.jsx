import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import SideBar from '../../common/adminSidebar';
import { useToast } from '../../../hooks/useToast';
import '../admin-global.css';
import '../payments/payments.css';

const PackagePaymentsManagement = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  
  const currentDate = new Date();
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  const [searchFilters, setSearchFilters] = useState({
    search: '',
    status: '',
    fromDate: startOfMonth.toISOString().split('T')[0],
    toDate: endOfMonth.toISOString().split('T')[0]
  });
  
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 8
  });
  
  const [statusCounts, setStatusCounts] = useState({ 
    all: 0, 
    paid: 0, 
    pending: 0
  });

  const statusLabels = {
    all: t('packagePayments.status.all', 'Tất cả'),
    paid: t('packagePayments.status.paid', 'Đã thanh toán'),
    pending: t('packagePayments.status.pending', 'Chờ thanh toán')
  };

  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: 1,
        limit: 9999,
        fromDate: searchFilters.fromDate || '',
        toDate: searchFilters.toDate || ''
      });

      const response = await fetch(
        `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api'}/admin/package-payments?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const allPayments = data.data.payments || [];
          const counts = {
            all: allPayments.length,
            paid: allPayments.filter(p => p.status === 'paid').length,
            pending: allPayments.filter(p => p.status === 'pending').length
          };
          setStatusCounts(counts);
        }
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [searchFilters.fromDate, searchFilters.toDate]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: pagination.currentPage,
        limit: pagination.itemsPerPage,
        status: activeTab !== 'all' ? activeTab : '',
        search: searchFilters.search || '',
        fromDate: searchFilters.fromDate || '',
        toDate: searchFilters.toDate || ''
      });

      const response = await fetch(
        `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api'}/admin/package-payments?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPayments(data.data.payments || []);
          setPagination(prev => ({
            ...prev,
            totalItems: data.data.pagination?.total || 0,
            totalPages: data.data.pagination?.totalPages || 1
          }));
        }
      }
    } catch (error) {
      console.error('Error loading package payments:', error);
      showToast('error', t('packagePayments.loadError', 'Lỗi tải dữ liệu'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchFilters, pagination.currentPage, pagination.itemsPerPage, showToast, t]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'paid': return 'status-badge status-paid';
      case 'pending': return 'status-badge status-pending';
      case 'cancelled': return 'status-badge status-cancelled';
      case 'failed': return 'status-badge status-overdue';
      default: return 'status-badge';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'paid': return t('packagePayments.status.paid', 'Đã thanh toán');
      case 'pending': return t('packagePayments.status.pending', 'Chờ thanh toán');
      case 'cancelled': return t('packagePayments.status.cancelled', 'Đã hủy');
      case 'failed': return 'Thất bại';
      default: return status;
    }
  };

  const getPaymentMethodText = (method) => {
    const methods = {
      momo: 'MoMo',
      vnpay: 'VNPay',
      bank_transfer: 'Chuyển khoản',
      cash: 'Tiền mặt'
    };
    return methods[method] || method;
  };

  const getPaginationRange = () => {
    const { currentPage, totalPages } = pagination;
    const range = [];
    const showPages = 7;
    
    if (totalPages <= showPages) {
      for (let i = 1; i <= totalPages; i++) {
        range.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= Math.min(5, totalPages); i++) {
          range.push(i);
        }
        if (totalPages > 5) {
          range.push('...');
          range.push(totalPages);
        }
      } else if (currentPage >= totalPages - 2) {
        range.push(1);
        if (totalPages > 5) {
          range.push('...');
        }
        for (let i = Math.max(totalPages - 4, 2); i <= totalPages; i++) {
          range.push(i);
        }
      } else {
        range.push(1);
        range.push('...');
        range.push(currentPage - 1, currentPage, currentPage + 1);
        range.push('...');
        range.push(totalPages);
      }
    }
    
    return range;
  };

  return (
    <div className="payments-container">
      <SideBar />
      <div className="payments-content">
        {/* Header */}
        <div className="payments-header">
          <h1 className="payments-title">{t('packagePayments.title', 'Quản lý thanh toán gói tin')}</h1>
          
          {/* Search Bar */}
          <div className="search-container">
            <div className="search-input-wrapper">
              <i className="fas fa-search search-icon"></i>
              <input
                type="text"
                className="search-input"
                placeholder={t('packagePayments.searchPlaceholder', 'Tìm theo tên, email, mã giao dịch...')}
                value={searchFilters.search}
                onChange={e => {
                  setSearchFilters(f => ({ ...f, search: e.target.value }));
                  setPagination(p => ({ ...p, currentPage: 1 }));
                }}
              />
              {searchFilters.search && (
                <button 
                  className="clear-search-btn"
                  onClick={() => {
                    setSearchFilters(f => ({ ...f, search: '' }));
                    setPagination(p => ({ ...p, currentPage: 1 }));
                  }}
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Date Filter Info Banner */}
        {(searchFilters.fromDate || searchFilters.toDate) && (
          <div className="date-filter-banner">
            <div className="banner-content">
              <i className="fas fa-calendar-alt"></i>
              <span className="banner-text">
                Hiển thị giao dịch 
                {searchFilters.fromDate && ` từ ${new Date(searchFilters.fromDate + 'T00:00:00').toLocaleDateString('vi-VN')}`}
                {searchFilters.toDate && ` đến ${new Date(searchFilters.toDate + 'T00:00:00').toLocaleDateString('vi-VN')}`}
              </span>
            </div>
            <button 
              className="banner-clear-btn"
              onClick={() => {
                setSearchFilters(f => ({ ...f, fromDate: '', toDate: '' }));
                setPagination(p => ({ ...p, currentPage: 1 }));
              }}
              title="Xóa bộ lọc ngày"
            >
              <i className="fas fa-times"></i>
              Xóa bộ lọc
            </button>
          </div>
        )}

        {/* Status Tabs */}
        <div className="status-tabs">
          {Object.keys(statusLabels).map(status => (
            <button
              key={status}
              className={`status-tab ${activeTab === status ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(status);
                setPagination(p => ({ ...p, currentPage: 1 }));
              }}
            >
              {statusLabels[status]}
              {statusCounts[status] > 0 && (
                <span className="tab-count">{statusCounts[status]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Action Buttons with Date Range */}
        <div className="payments-actions">
          {/* Date Range Filters */}
          <div className="date-filter-group">
            <label className="date-label">Từ ngày:</label>
            <input
              type="date"
              className="filter-date"
              value={searchFilters.fromDate || ''}
              onChange={e => {
                setSearchFilters(f => ({ ...f, fromDate: e.target.value }));
                setPagination(p => ({ ...p, currentPage: 1 }));
              }}
            />
          </div>

          <div className="date-filter-group">
            <label className="date-label">Đến ngày:</label>
            <input
              type="date"
              className="filter-date"
              value={searchFilters.toDate || ''}
              onChange={e => {
                setSearchFilters(f => ({ ...f, toDate: e.target.value }));
                setPagination(p => ({ ...p, currentPage: 1 }));
              }}
            />
          </div>
        </div>

        {/* Payments Grid */}
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>{t('packagePayments.loading', 'Đang tải...')}</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="empty-container">
            <div className="empty-icon">💳</div>
            <h3 className="empty-text">{t('packagePayments.noTransactions', 'Không có giao dịch nào')}</h3>
            <p className="empty-description">Chưa có giao dịch thanh toán gói tin nào</p>
          </div>
        ) : (
          <div className="payments-grid">
            {payments.map(payment => (
              <div 
                key={payment._id} 
                className="payment-card"
              >
                <div className="payment-card-header">
                  <div className="payment-info">
                    <div className="payment-room">
                      <i className="fas fa-user"></i>
                      <span>{payment.user?.fullName || '-'}</span>
                    </div>
                    <div className="payment-tenant">
                      <i className="fas fa-envelope"></i>
                      <span>{payment.user?.email || '-'}</span>
                    </div>
                  </div>
                  <span className={getStatusBadgeClass(payment.status)}>
                    {getStatusText(payment.status)}
                  </span>
                </div>

                <div className="payment-card-body">
                  <div className="payment-period">
                    <i className="fas fa-box"></i>
                    <span>
                      {payment.packagePlan?.name || '-'} ({payment.packagePlan?.duration || 0} ngày)
                    </span>
                  </div>
                  
                  <div className="payment-dates">
                    <div className="date-item">
                      <label>Mã GD:</label>
                      <span>{payment.transactionId || payment._id.slice(-8)}</span>
                    </div>
                    <div className="date-item">
                      <label>Phương thức:</label>
                      <span>{getPaymentMethodText(payment.paymentMethod)}</span>
                    </div>
                  </div>

                  <div className="payment-dates">
                    <div className="date-item">
                      <label>Ngày tạo:</label>
                      <span>{formatDate(payment.createdAt)}</span>
                    </div>
                    <div className="date-item">
                      <label>Ngày thanh toán:</label>
                      <span>{payment.paidAt ? formatDate(payment.paidAt) : '-'}</span>
                    </div>
                  </div>

                  <div className="payment-amount">
                    <label>Số tiền:</label>
                    <span className="amount-value">{formatCurrency(payment.amount)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {payments.length > 0 && pagination.totalPages > 1 && (
          <div className="pagination">
            <div className="pagination-info">
              <span className="pagination-text">
                Trang {pagination.currentPage} / {pagination.totalPages} 
                ({pagination.totalItems} giao dịch)
              </span>
            </div>

            <div className="pagination-controls">
              <button
                className="pagination-btn"
                disabled={pagination.currentPage === 1}
                onClick={() => setPagination(p => ({ ...p, currentPage: 1 }))}
                title="Trang đầu"
              >
                <i className="fas fa-angle-double-left" />
              </button>

              <button
                className="pagination-btn"
                disabled={pagination.currentPage === 1}
                onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage - 1 }))}
                title="Trang trước"
              >
                <i className="fas fa-chevron-left" />
              </button>
              
              <div className="pagination-numbers">
                {getPaginationRange().map((page, index) => (
                  page === '...' ? (
                    <span key={index} className="pagination-dots">...</span>
                  ) : (
                    <button
                      key={index}
                      className={`pagination-number ${pagination.currentPage === page ? 'active' : ''}`}
                      onClick={() => setPagination(p => ({ ...p, currentPage: page }))}
                      title={`Trang ${page}`}
                    >
                      {page}
                    </button>
                  )
                ))}
              </div>
              
              <button
                className="pagination-btn"
                disabled={pagination.currentPage === pagination.totalPages}
                onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage + 1 }))}
                title="Trang sau"
              >
                <i className="fas fa-chevron-right" />
              </button>

              <button
                className="pagination-btn"
                disabled={pagination.currentPage === pagination.totalPages}
                onClick={() => setPagination(p => ({ ...p, currentPage: pagination.totalPages }))}
                title="Trang cuối"
              >
                <i className="fas fa-angle-double-right" />
              </button>
            </div>
          </div>
        )}

        {payments.length > 0 && pagination.totalPages <= 1 && (
          <div style={{textAlign: 'center', padding: '20px', color: '#666'}}>
            Tất cả {pagination.totalItems} giao dịch đã được hiển thị
          </div>
        )}
      </div>
    </div>
  );
};

export default PackagePaymentsManagement;
