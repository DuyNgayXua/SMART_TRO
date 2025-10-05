import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import SideBar from '../../common/adminSidebar';
import { useToast } from '../../../hooks/useToast';
import '../admin-global.css';
import './payments.css';
import invoicesAPI from '../../../services/invoicesAPI';

const PaymentsManagement = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchFilters, setSearchFilters] = useState({
    search: '',
    status: '',
    month: '',
    year: new Date().getFullYear().toString()
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 12
  });
  const [statusCounts, setStatusCounts] = useState({ 
    all: 0, 
    paid: 0, 
    unpaid: 0, 
    overdue: 0 
  });
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const statusLabels = {
    all: t('payments.status.all', 'Tất cả'),
    paid: t('payments.status.paid', 'Đã thanh toán'),
    unpaid: t('payments.status.unpaid', 'Chưa thanh toán'),
    overdue: t('payments.status.overdue', 'Quá hạn')
  };

  const fetchStats = useCallback(async () => {
    try {
      const response = await invoicesAPI.getInvoiceStats();
      
      if (response.success && response.data) {
        // Combine 'draft' and 'sent' as 'unpaid', and 'pending' if exists
        const unpaidCount = (response.data.draft?.count || 0) + 
                           (response.data.sent?.count || 0) + 
                           (response.data.pending?.count || 0);
        
        setStatusCounts({
          all: response.data.total || 0,
          paid: response.data.paid?.count || 0,
          unpaid: unpaidCount,
          overdue: response.data.overdue?.count || 0
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.currentPage,
        limit: pagination.itemsPerPage,
        search: searchFilters.search || undefined,
        status: activeTab !== 'all' ? activeTab : undefined,
        month: searchFilters.month || undefined,
        year: searchFilters.year || undefined
      };

      const response = await invoicesAPI.getInvoices(params);
      
      if (response.success) {
        setInvoices(response.data.items || []);
        
        setPagination(prev => ({
          ...prev,
          totalItems: response.data.pagination?.total || 0,
          totalPages: response.data.pagination?.pages || 1
        }));
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
      showToast('error', t('common.errors.loadFailed', 'Lỗi tải dữ liệu'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchFilters, pagination.currentPage, pagination.itemsPerPage, showToast, t]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const openDetail = async (invoice) => {
    setShowDetailModal(true);
    setLoadingDetail(true);
    try {
      const response = await invoicesAPI.getInvoiceById(invoice._id);
      if (response.success) {
        setSelectedInvoice(response.data);
      }
    } catch (error) {
      console.error('Error loading invoice detail:', error);
      showToast('error', t('common.errors.loadFailed', 'Lỗi tải chi tiết'));
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setShowDetailModal(false);
    setSelectedInvoice(null);
  };

  const handleMarkAsPaid = async (invoiceId) => {
    try {
      const response = await invoicesAPI.markAsPaid(invoiceId, {
        paymentDate: new Date().toISOString(),
        paymentMethod: 'cash'
      });
      
      if (response.success) {
        showToast('success', t('payments.markPaidSuccess', 'Đánh dấu thanh toán thành công'));
        fetchInvoices();
        fetchStats(); // Refetch stats after marking as paid
        if (selectedInvoice && selectedInvoice._id === invoiceId) {
          closeDetail();
        }
      }
    } catch (error) {
      console.error('Error marking as paid:', error);
      showToast('error', t('payments.markPaidError', 'Lỗi khi đánh dấu thanh toán'));
    }
  };

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
      case 'unpaid': return 'status-badge status-unpaid';
      case 'overdue': return 'status-badge status-overdue';
      case 'pending': return 'status-badge status-pending';
      default: return 'status-badge';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'paid': return t('payments.status.paid', 'Đã thanh toán');
      case 'unpaid': return t('payments.status.unpaid', 'Chưa thanh toán');
      case 'overdue': return t('payments.status.overdue', 'Quá hạn');
      case 'pending': return t('payments.status.pending', 'Chờ xử lý');
      default: return status;
    }
  };

  // Generate month options
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: (i + 1).toString(),
    label: `Tháng ${i + 1}`
  }));

  // Generate year options (current year and 2 years back)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 3 }, (_, i) => ({
    value: (currentYear - i).toString(),
    label: (currentYear - i).toString()
  }));

  return (
    <div className="payments-container">
      <SideBar />
      <div className="payments-content">
        <div className="payments-header">
          <h1 className="payments-title">{t('payments.title', 'Quản lý thanh toán')}</h1>
        </div>

        {/* Filters */}
        <div className="payments-filters">
          <div className="filters-grid">
            <div className="filter-group">
              <label className="filter-label">{t('common.search', 'Tìm kiếm')}</label>
              <input
                className="filter-input"
                value={searchFilters.search}
                onChange={e => {
                  setSearchFilters(f => ({ ...f, search: e.target.value }));
                  setPagination(p => ({ ...p, currentPage: 1 }));
                }}
                placeholder={t('payments.searchPlaceholder', 'Tìm theo phòng, khách thuê...')}
              />
            </div>
            
            <div className="filter-group">
              <label className="filter-label">{t('payments.month', 'Tháng')}</label>
              <select
                className="filter-select"
                value={searchFilters.month}
                onChange={e => {
                  setSearchFilters(f => ({ ...f, month: e.target.value }));
                  setPagination(p => ({ ...p, currentPage: 1 }));
                }}
              >
                <option value="">{t('common.all', 'Tất cả')}</option>
                {monthOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">{t('payments.year', 'Năm')}</label>
              <select
                className="filter-select"
                value={searchFilters.year}
                onChange={e => {
                  setSearchFilters(f => ({ ...f, year: e.target.value }));
                  setPagination(p => ({ ...p, currentPage: 1 }));
                }}
              >
                {yearOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <button className="search-btn" onClick={fetchInvoices}>
                <i className="fas fa-search" /> {t('common.search', 'Tìm kiếm')}
              </button>
            </div>
            
            <div className="filter-group">
              <button
                className="reset-btn"
                onClick={() => {
                  setSearchFilters({ search: '', status: '', month: '', year: currentYear.toString() });
                  setPagination(p => ({ ...p, currentPage: 1 }));
                }}
              >
                <i className="fas fa-redo" /> {t('common.reset', 'Đặt lại')}
              </button>
            </div>
          </div>
        </div>

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
              <span className="tab-count">{statusCounts[status]}</span>
            </button>
          ))}
        </div>

        {/* Invoices Grid */}
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>{t('common.loading', 'Đang tải...')}</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="empty-container">
            <div className="empty-icon">📄</div>
            <h3 className="empty-text">{t('payments.noInvoices', 'Không có hóa đơn nào')}</h3>
            <p className="empty-description">{t('payments.noInvoicesDescription', 'Chưa có hóa đơn nào được tạo')}</p>
          </div>
        ) : (
          <div className="payments-grid">
            {invoices.map(invoice => (
              <div key={invoice._id} className="payment-card" onClick={() => openDetail(invoice)}>
                <div className="payment-card-header">
                  <div className="payment-info">
                    <div className="payment-room">
                      <i className="fas fa-door-open"></i>
                      <span>Phòng {invoice.room?.roomNumber || '-'}</span>
                    </div>
                    <div className="payment-tenant">
                      <i className="fas fa-user"></i>
                      <span>{invoice.tenant?.fullName || '-'}</span>
                    </div>
                  </div>
                  <span className={getStatusBadgeClass(invoice.status)}>
                    {getStatusText(invoice.status)}
                  </span>
                </div>

                <div className="payment-card-body">
                  <div className="payment-period">
                    <i className="fas fa-calendar"></i>
                    <span>
                      Kỳ: {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}
                    </span>
                  </div>
                  
                  <div className="payment-dates">
                    <div className="date-item">
                      <label>Ngày lập:</label>
                      <span>{formatDate(invoice.issueDate)}</span>
                    </div>
                    <div className="date-item">
                      <label>Hạn thanh toán:</label>
                      <span>{formatDate(invoice.dueDate)}</span>
                    </div>
                  </div>

                  <div className="payment-amount">
                    <label>Tổng tiền:</label>
                    <span className="amount-value">{formatCurrency(invoice.totalAmount)}</span>
                  </div>

                  {invoice.status === 'paid' && invoice.paymentDate && (
                    <div className="payment-date-paid">
                      <i className="fas fa-check-circle"></i>
                      <span>Đã thanh toán: {formatDate(invoice.paymentDate)}</span>
                    </div>
                  )}
                </div>

                <div className="payment-card-footer">
                  {invoice.status !== 'paid' && (
                    <button
                      className="btn-mark-paid"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsPaid(invoice._id);
                      }}
                    >
                      <i className="fas fa-check"></i>
                      Đánh dấu đã thanh toán
                    </button>
                  )}
                  <button className="btn-view-detail">
                    <i className="fas fa-eye"></i>
                    Xem chi tiết
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {invoices.length > 0 && (
          <div className="pagination">
            <button
              className="pagination-btn"
              disabled={pagination.currentPage === 1}
              onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage - 1 }))}
            >
              <i className="fas fa-chevron-left" />
            </button>
            <span className="pagination-info">
              {t('rooms.pagination.page', 'Trang')} {pagination.currentPage} / {pagination.totalPages} ({pagination.totalItems})
            </span>
            <button
              className="pagination-btn"
              disabled={pagination.currentPage === pagination.totalPages}
              onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage + 1 }))}
            >
              <i className="fas fa-chevron-right" />
            </button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && (
        <div className="modal-backdrop" onClick={closeDetail}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Chi tiết hóa đơn</h2>
              <button className="modal-close" onClick={closeDetail}>×</button>
            </div>
            
            {loadingDetail ? (
              <div className="modal-loading">
                <div className="loading-spinner" />
                <p>Đang tải...</p>
              </div>
            ) : selectedInvoice ? (
              <div className="modal-body">
                <div className="invoice-detail-grid">
                  <div className="detail-section">
                    <h3>Thông tin chung</h3>
                    <div className="detail-row">
                      <label>Phòng:</label>
                      <span>Phòng {selectedInvoice.room?.roomNumber}</span>
                    </div>
                    <div className="detail-row">
                      <label>Khách thuê:</label>
                      <span>{selectedInvoice.tenant?.fullName}</span>
                    </div>
                    <div className="detail-row">
                      <label>Trạng thái:</label>
                      <span className={getStatusBadgeClass(selectedInvoice.status)}>
                        {getStatusText(selectedInvoice.status)}
                      </span>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Chi tiết thanh toán</h3>
                    {selectedInvoice.charges?.map((charge, index) => (
                      <div key={index} className="detail-row">
                        <label>{charge.description}:</label>
                        <span>{formatCurrency(charge.amount)}</span>
                      </div>
                    ))}
                    <div className="detail-row total">
                      <label>Tổng cộng:</label>
                      <span>{formatCurrency(selectedInvoice.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeDetail}>Đóng</button>
              {selectedInvoice && selectedInvoice.status !== 'paid' && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    handleMarkAsPaid(selectedInvoice._id);
                  }}
                >
                  Đánh dấu đã thanh toán
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsManagement;
