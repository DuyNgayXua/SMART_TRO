import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import SideBar from '../../common/adminSidebar';
import adminReportsAPI from '../../../services/adminReportsAPI';
import '../admin-global.css';
import './ReportManagement.css';

const ReportManagement = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending'); // pending, resolved, dismissed, all
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalReports, setTotalReports] = useState(0);
    const [selectedReport, setSelectedReport] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showActionModal, setShowActionModal] = useState(false);
    const [actionType, setActionType] = useState(''); // dismiss, warning, hide
    const [actionReason, setActionReason] = useState('');
    const [processingReportId, setProcessingReportId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [openDropdownId, setOpenDropdownId] = useState(null); // Thêm state cho dropdown menu
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        resolved: 0,
        dismissed: 0
    });

    // Load reports from API
    const loadReports = async (page = 1, status = filter, search = searchTerm) => {
        try {
            setLoading(true);

            const data = await adminReportsAPI.getReportsForAdmin(page, status, 12, search);
            console.log("Fetched reports data:", data);

            if (data.success) {
                setReports(data.data.reports);
                setTotalPages(data.data.pagination.totalPages);
                setCurrentPage(data.data.pagination.currentPage);
                setTotalReports(data.data.pagination.totalReports);
            } else {
                toast.error(data.message || 'Không thể tải danh sách báo cáo');
            }
        } catch (error) {
            console.error('Error loading reports:', error);
            toast.error(error.message || 'Lỗi khi tải danh sách báo cáo');
        } finally {
            setLoading(false);
        }
    };

    // Load statistics
    const loadStats = async () => {
        try {
            const data = await adminReportsAPI.getReportStats();
            if (data.success) {
                setStats(data.data);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    // Handle report action (dismiss, warning, hide)
    const handleReportAction = async () => {
        if (!selectedReport || !actionType || processingReportId) return;

        // Client-side validation trước khi gửi request
        if (actionType !== 'dismiss' && actionReason.trim()) {
            const reasonLength = actionReason.trim().length;
            
            if (actionType === 'warning') {
                if (reasonLength < 10) {
                    toast.error('Lý do cảnh báo phải có ít nhất 10 ký tự');
                    return;
                }
                if (reasonLength > 500) {
                    toast.error('Lý do cảnh báo không được quá 500 ký tự');
                    return;
                }
            } else if (actionType === 'hide') {
                if (reasonLength < 3) {
                    toast.error('Lý do ẩn bài đăng phải có ít nhất 3 ký tự');
                    return;
                }
                if (reasonLength > 500) {
                    toast.error('Lý do ẩn bài đăng không được quá 500 ký tự');
                    return;
                }
            }
        }

        try {
            setProcessingReportId(selectedReport._id);

            let data;
            switch (actionType) {
                case 'dismiss':
                    data = await adminReportsAPI.dismissReport(selectedReport._id);
                    break;
                case 'warning':
                    data = await adminReportsAPI.sendWarning(selectedReport._id, actionReason);
                    break;
                case 'hide':
                    data = await adminReportsAPI.hideProperty(selectedReport._id, actionReason);
                    break;
                default:
                    throw new Error('Invalid action type');
            }

            if (data.success) {
                const actionMessages = {
                    dismiss: 'Báo cáo đã được bỏ qua',
                    warning: 'Đã gửi email cảnh báo tới chủ bài đăng',
                    hide: 'Bài đăng đã được ẩn'
                };
                toast.success(actionMessages[actionType]);
                
                // Refresh reports list và stats
                loadReports(currentPage, filter);
                loadStats();
                
                // Close modals
                setShowActionModal(false);
                setShowDetailModal(false);
                setActionReason('');
                setActionType('');
                setSelectedReport(null);
            } else {
                toast.error(data.message || 'Không thể xử lý báo cáo');
            }
        } catch (error) {
            console.error('Error handling report:', error);
            
            // Hiển thị thông báo lỗi chi tiết từ backend
            if (error.validationErrors && Array.isArray(error.validationErrors)) {
                // Hiển thị từng lỗi validation riêng biệt
                error.validationErrors.forEach(validationError => {
                    toast.error(validationError.msg || validationError.message || 'Lỗi validation');
                });
            } else if (error.detailedMessage) {
                // Hiển thị chi tiết lỗi validation
                toast.error(`Lỗi validation: ${error.detailedMessage}`);
            } else if (error.message) {
                // Lỗi thông thường
                toast.error(error.message);
            } else {
                // Lỗi mặc định
                toast.error('Lỗi khi xử lý báo cáo');
            }
        } finally {
            setProcessingReportId(null);
        }
    };

    // Handle filter change
    const handleFilterChange = (newFilter) => {
        setFilter(newFilter);
        setCurrentPage(1);
        setSearchTerm('');
        loadReports(1, newFilter, '');
    };

    // Handle page change
    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            loadReports(page, filter, searchTerm);
        }
    };

    // Handle search
    const handleSearch = (e) => {
        e.preventDefault();
        setCurrentPage(1);
        loadReports(1, filter, searchTerm);
    };

    // Handle search input change
    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    // Toggle dropdown menu
    const toggleDropdown = (reportId) => {
        setOpenDropdownId(openDropdownId === reportId ? null : reportId);
    };

    // Close dropdown when clicking outside
    const closeDropdown = () => {
        setOpenDropdownId(null);
    };

    // Handle menu item click
    const handleMenuAction = (report, action) => {
        setSelectedReport(report);
        setActionType(action);
        if (action === 'view') {
            setShowDetailModal(true);
        } else {
            setShowActionModal(true);
        }
        closeDropdown();
    };

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString('vi-VN');
    };

    // Get status badge
    const getStatusBadge = (status) => {
        const statusConfig = {
            pending: { label: 'Chờ xử lý', className: 'status-pending-report' },
            resolved: { label: 'Đã xử lý', className: 'status-resolved-report' },
            dismissed: { label: 'Đã bỏ qua', className: 'status-dismissed-report' },
        };

        const config = statusConfig[status] || { label: status, className: 'status-unknown' };

        return (
            <span className={`status-badge-report ${config.className}`}>
                {config.label}
            </span>
        );
    };

    // Get severity badge
    const getSeverityBadge = (severity) => {
        const severityConfig = {
            low: { label: 'Nhẹ', className: 'severity-low' },
            medium: { label: 'Trung bình', className: 'severity-medium' },
            high: { label: 'Nghiêm trọng', className: 'severity-high' },
        };

        const config = severityConfig[severity] || { label: severity, className: 'severity-unknown' };

        return (
            <span className={`severity-badge ${config.className}`}>
                {config.label}
            </span>
        );
    };

    // Map report reasons to Vietnamese
    const getReasonInVietnamese = (reason) => {
        const reasonMapping = {
            'fake': 'Tin đăng giả mạo',
            'inappropriate': 'Nội dung không phù hợp',
            'spam': 'Spam hoặc lừa đảo',
            'duplicate': 'Tin đăng trùng lặp',
            'price': 'Giá cả không chính xác',
            'other': 'Lý do khác',
            // Fallback for existing Vietnamese reasons
            'Tin đăng giả mạo': 'Tin đăng giả mạo',
            'Nội dung không phù hợp': 'Nội dung không phù hợp',
            'Spam hoặc lừa đảo': 'Spam hoặc lừa đảo',
            'Tin đăng trùng lặp': 'Tin đăng trùng lặp',
            'Giá cả không chính xác': 'Giá cả không chính xác',
            'Lý do khác': 'Lý do khác'
        };

        return reasonMapping[reason] || reason;
    };

    // Load reports and stats on component mount
    useEffect(() => {
        loadReports();
        loadStats();
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.dropdown-menu-container')) {
                setOpenDropdownId(null);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    return (
        <div className="dashboard-container">
            <SideBar />
            <div className="dashboard-content">
                <div className="report-management">
                    {/* Header Section */}
                    <div className="rooms-header">
                        <h1 className="rooms-title">Quản lý báo cáo bài đăng</h1>
                        <div className="header-search">
                            <div className="search-box-report-management">
                                <i className="fas fa-search search-icon"></i>
                                <input
                                    type="text"
                                    className="search-input"
                                    placeholder="Tìm kiếm theo lý do báo cáo, tên bài đăng..."
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSearch(e);
                                        }
                                    }}
                                />
                                {searchTerm && (
                                    <button
                                        className="clear-search-btn-report-management"
                                        onClick={() => {
                                            setSearchTerm('');
                                            setCurrentPage(1);
                                            loadReports(1, filter, '');
                                        }}
                                    >
                                        <i className="fas fa-times"></i>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Status Tabs */}
                    <div className="status-tabs">
                        <button
                            className={`status-tab ${filter === 'all' ? 'active' : ''}`}
                            onClick={() => handleFilterChange('all')}
                        >
                            <i className="fas fa-list"></i>
                            Tất cả ({stats.total})
                        </button>
                        <button
                            className={`status-tab ${filter === 'pending' ? 'active' : ''}`}
                            onClick={() => handleFilterChange('pending')}
                        >
                            <i className="fas fa-clock"></i>
                            Chờ xử lý ({stats.pending})
                        </button>
                        <button
                            className={`status-tab ${filter === 'resolved' ? 'active' : ''}`}
                            onClick={() => handleFilterChange('resolved')}
                        >
                            <i className="fas fa-check-circle"></i>
                            Đã xử lý ({stats.resolved})
                        </button>
                        <button
                            className={`status-tab ${filter === 'dismissed' ? 'active' : ''}`}
                            onClick={() => handleFilterChange('dismissed')}
                        >
                            <i className="fas fa-times-circle"></i>
                            Đã bỏ qua ({stats.dismissed})
                        </button>
                    </div>

                    {/* Statistics */}
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon">
                                <i className="fa fa-flag"></i>
                            </div>
                            <div className="stat-content">
                                <h3>{stats.total}</h3>
                                <p>Tổng báo cáo</p>
                            </div>
                        </div>
                        <div className="stat-card pending">
                            <div className="stat-icon">
                                <i className="fa fa-clock"></i>
                            </div>
                            <div className="stat-content">
                                <h3>{stats.pending}</h3>
                                <p>Chờ xử lý</p>
                            </div>
                        </div>
                        <div className="stat-card resolved">
                            <div className="stat-icon">
                                <i className="fa fa-check-circle"></i>
                            </div>
                            <div className="stat-content">
                                <h3>{stats.resolved}</h3>
                                <p>Đã xử lý</p>
                            </div>
                        </div>
                        <div className="stat-card dismissed">
                            <div className="stat-icon">
                                <i className="fa fa-times-circle"></i>
                            </div>
                            <div className="stat-content">
                                <h3>{stats.dismissed}</h3>
                                <p>Đã bỏ qua</p>
                            </div>
                        </div>
                    </div>

                    {/* Reports list */}
                    {loading ? (
                        <div className="spinner-container">
                            <div className="spinner"></div>
                            <span className="loading-text">Đang tải danh sách báo cáo...</span>
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="empty-state">
                            <i className="fa fa-flag"></i>
                             <span className="loading-text">Không có báo cáo nào</span>
                           
                        </div>
                    ) : (
                        <>
                            <div className="reports-list-table">
                                <div className="table-container">
                                    <table className="reports-table">
                                        <thead>
                                            <tr>

                                                <th style={{ width: '20%' }}>Bài đăng</th>
                                                <th style={{ width: '15%' }}>Chủ bài đăng</th>
                                                <th style={{ width: '20%' }}>Người báo cáo</th>
                                                <th style={{ width: '20%' }}>Lý do / Mức độ</th>
                                                <th style={{ width: '10%' }}>Trạng thái</th>
                                                <th style={{ width: '15%' }}>Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reports.map((report) => (
                                                <tr key={report._id} className="report-row">
                                                    <td className="property-cell">
                                                        <div className="property-info-report">
                                                            {report.property?._id ? (
                                                                <span 
                                                                    className="property-title-report clickable-title"
                                                                    onClick={() => window.open(`/properties/${report.property._id}`, '_blank')}
                                                                    title="Xem bài đăng"
                                                                >
                                                                    {report.property.title || report.propertyTitle}
                                                                    <i className="fa fa-external-link" style={{marginLeft: '5px', fontSize: '12px'}}></i>
                                                                </span>
                                                            ) : (
                                                                <div className="deleted-property-info">
                                                                    <span className="property-title-report deleted-title">
                                                                        {report.propertyTitle || 'Bài đăng đã bị ẩn'}
                                                                    </span>
                                                                    <span className="deleted-badge">
                                                                        <i className="fa fa-trash"></i> Đã ẩn
                                                                    </span>
                                                                </div>
                                                            )}
                                                   
                                                        </div>
                                                    </td>
                                                    <td className="owner-property-cell">
                                                        <div className="owner-property-info">
                                                            <div className="owner-property-name">
                                                                {report.propertyOwner?.fullName || report.property?.owner?.fullName || 'Ẩn danh'}
                                                            </div>
                                                            <div 
                                                                className="owner-property-email"
                                                                title={report.propertyOwner?.email || report.property?.owner?.email || ''}
                                                            >
                                                                {report.propertyOwner?.email || report.property?.owner?.email || ''}
                                                            </div>
                                                            {report.propertyOwnerStats && (
                                                                <div className="owner-stats">
                                                                    <span className="stats-item" title="Tổng báo cáo">
                                                                        <i className="fa fa-flag"></i> {report.propertyOwnerStats.total}
                                                                    </span>
                                                                    {report.propertyOwnerStats.pending > 0 && (
                                                                        <span className="stats-item pending" title="Đang chờ xử lý">
                                                                            <i className="fa fa-clock-o"></i> {report.propertyOwnerStats.pending}
                                                                        </span>
                                                                    )}
                                                                    {report.propertyOwnerStats.resolved > 0 && (
                                                                        <span className="stats-item resolved" title="Đã xử lý">
                                                                            <i className="fa fa-check"></i> {report.propertyOwnerStats.resolved}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                          
                                                        </div>
                                                    </td>
                                                    <td className="reporter-cell">
                                                        <div className="reporter-info">
                                                            <div className="reporter-name">{report.reporter?.fullName || 'Ẩn danh'}</div>
                                                            <div 
                                                                className="reporter-email"
                                                                title={report.reporter?.email || ''}
                                                            >
                                                                {report.reporter?.email || ''}
                                                            </div>
                                                            <div className="report-date">{formatDate(report.createdAt)}</div>
                                                        </div>
                                                    </td>
                                                    <td className="reason-severity-cell">
                                                        <div className="reason-text">
                                                            <i className="fa fa-exclamation-triangle"></i>&nbsp;
                                                            {getReasonInVietnamese(report.reason)}
                                                        </div>
                                                        <div className="severity-container">
                                                            {getSeverityBadge(report.severity)}
                                                        </div>
                                                    </td>
                                                    <td className="status-cell">
                                                        {getStatusBadge(report.status)}
                                                    </td>
                                                    <td className="actions-cell">
                                                        <div className="action-buttons-compact">
                                                            <div className="dropdown-menu-container">
                                                                <button
                                                                    className="btn-action menu-toggle"
                                                                    onClick={() => toggleDropdown(report._id)}
                                                                    title="Thao tác"
                                                                >
                                                                    <i className="fa fa-ellipsis-v"></i>
                                                                </button>
                                                                
                                                                {openDropdownId === report._id && (
                                                                    <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                                                                        <div className="dropdown-menu-item">
                                                                            <button
                                                                                className="menu-item view"
                                                                                onClick={() => handleMenuAction(report, 'view')}
                                                                            >
                                                                                <i className="fa fa-eye"></i>
                                                                                Xem chi tiết
                                                                            </button>
                                                                        </div>
                                                                        
                                                                        {report.status === 'pending' && (
                                                                            <>
                                                                                <div className="dropdown-menu-item">
                                                                                    <button
                                                                                        className="menu-item dismiss"
                                                                                        onClick={() => handleMenuAction(report, 'dismiss')}
                                                                                    >
                                                                                        <i className="fa fa-ban"></i>
                                                                                        Bỏ qua
                                                                                    </button>
                                                                                </div>
                                                                                <div className="dropdown-menu-item">
                                                                                    <button
                                                                                        className="menu-item warning"
                                                                                        onClick={() => handleMenuAction(report, 'warning')}
                                                                                    >
                                                                                        <i className="fa fa-exclamation-triangle"></i>
                                                                                        Gửi cảnh báo
                                                                                    </button>
                                                                                </div>
                                                                                <div className="dropdown-menu-item">
                                                                                    <button
                                                                                        className="menu-item hide"
                                                                                        onClick={() => handleMenuAction(report, 'hide')}
                                                                                    >
                                                                                        <i className="fa fa-eye-slash"></i>
                                                                                        Ẩn bài đăng
                                                                                    </button>
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="pagination-container">
                                    <button
                                        className="pagination-btn-container"
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                    >
                                        <i className="fa fa-chevron-left"></i>
                                        Trước
                                    </button>

                                    <div className="page-numbers">
                                        {[...Array(Math.min(totalPages, 12))].map((_, index) => {
                                            let pageNum;
                                            if (totalPages <= 12) {
                                                pageNum = index + 1;
                                            } else {
                                                const start = Math.max(1, currentPage - 5);
                                                const end = Math.min(totalPages, start + 9);
                                                pageNum = start + index;
                                                if (pageNum > end) return null;
                                            }

                                            return (
                                                <button
                                                    key={pageNum}
                                                    className={`page-number ${currentPage === pageNum ? 'active' : ''}`}
                                                    onClick={() => handlePageChange(pageNum)}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <button
                                        className="pagination-btn-container"
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                    >
                                        Sau
                                        <i className="fa fa-chevron-right"></i>
                                    </button>

                                    <div className="pagination-info">
                                        <span>
                                            Trang {currentPage} / {totalPages} (Tổng: {totalReports} báo cáo)
                                        </span>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Report Detail Modal */}
                    {showDetailModal && selectedReport && (
                        <div className="modal-overlay-report" onClick={() => setShowDetailModal(false)}>
                            <div className="report-detail-modal" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header-report">
                                    <h2>Chi tiết báo cáo</h2>
                                    <button
                                        className="close-btn-report"
                                        onClick={() => setShowDetailModal(false)}
                                    >
                                        <i className="fa fa-times"></i>
                                    </button>
                                </div>

                                <div className="modal-content-report">
                                    <div className="report-detail-content">
                                        <div className="detail-header">
                                            <h4>Báo cáo #{selectedReport._id.slice(-6)}</h4>
                                            {getStatusBadge(selectedReport.status)}
                                            {getSeverityBadge(selectedReport.severity)}
                                        </div>

                                        <div className="detail-grid-report">
                                            <div className="detail-item-report">
                                                <strong>Bài đăng:</strong>
                                                {selectedReport.property?._id ? (
                                                    <span 
                                                        className="property-title-link"
                                                        onClick={() => window.open(`/properties/${selectedReport.property._id}`, '_blank')}
                                                        title="Xem bài đăng"
                                                        style={{
                                                            color: '#007bff',
                                                            cursor: 'pointer',
                                                            textDecoration: 'underline'
                                                        }}
                                                    >
                                                        {selectedReport.property.title || selectedReport.propertyTitle}
                                                        <i className="fa fa-external-link" style={{marginLeft: '5px', fontSize: '12px'}}></i>
                                                    </span>
                                                ) : (
                                                    <div className="deleted-property-detail">
                                                        <span className="deleted-title-text">
                                                            {selectedReport.propertyTitle || 'Bài đăng đã bị ẩn'}
                                                        </span>
                                                        <span className="deleted-status">
                                                            <i className="fa fa-trash"></i> Đã bị ẩn
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="detail-item-report">
                                                <strong>Người báo cáo:</strong>
                                                <span>{selectedReport.reporter?.fullName || 'Ẩn danh'} ({selectedReport.reporter?.email || 'N/A'})</span>
                                            </div>
                                            <div className="detail-item-report">
                                                <strong>Ngày báo cáo:</strong>
                                                <span>{formatDate(selectedReport.createdAt)}</span>
                                            </div>
                                            <div className="detail-item-report">
                                                <strong>Lý do báo cáo:</strong>
                                                <div className="reason-text">
                                                    <i className="fa fa-exclamation-triangle"></i>&nbsp;
                                                    <span>{getReasonInVietnamese(selectedReport.reason)}</span>
                                                </div>
                                            </div>
                                            {selectedReport.description && (
                                                <div className="detail-item-report full-width">
                                                    <strong>Mô tả chi tiết:</strong>
                                                     <div className="reason-text">
                                                    <i className="fa fa-exclamation-triangle"></i>&nbsp;
                                                    <span>{selectedReport.description}</span>
                                                </div>
                                                </div>
                                            )}
                                            {selectedReport.actionTaken && (
                                                <div className="detail-item-report full-width">
                                                    <strong>Hành động đã thực hiện:</strong>
                                                    <p>{selectedReport.actionTaken}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {selectedReport.status === 'pending' && (
                                        <div className="modal-actions-report">
                                            <button
                                                className="btn-report btn-dismiss"
                                                onClick={() => {
                                                    setActionType('dismiss');
                                                    setShowActionModal(true);
                                                }}
                                            >
                                                <i className="fa fa-ban"></i>
                                                Bỏ qua
                                            </button>
                                            <button
                                                className="btn-report btn-warning"
                                                onClick={() => {
                                                    setActionType('warning');
                                                    setShowActionModal(true);
                                                }}
                                            >
                                                <i className="fa fa-exclamation-triangle"></i>
                                                Gửi cảnh báo
                                            </button>
                                            <button
                                                className="btn-report btn-hide"
                                                onClick={() => {
                                                    setActionType('hide');
                                                    setShowActionModal(true);
                                                }}
                                            >
                                                <i className="fa fa-eye-slash"></i>
                                                Ẩn bài đăng
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Modal */}
                    {showActionModal && (
                        <div className="modal-overlay-action" onClick={() => setShowActionModal(false)}>
                            <div className="action-modal" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header-action">
                                    <h3 data-action={actionType}>
                                        {actionType === 'dismiss' && 'Bỏ qua báo cáo'}
                                        {actionType === 'warning' && 'Gửi cảnh báo'}
                                        {actionType === 'hide' && 'Ẩn bài đăng'}
                                    </h3>
                                    <button
                                        className="close-btn"
                                        onClick={() => setShowActionModal(false)}
                                    >
                                        <i className="fa fa-times"></i>
                                    </button>
                                </div>

                                <div className="modal-content-report">
                                    <p><strong>Báo cáo:</strong> {getReasonInVietnamese(selectedReport?.reason)}</p>
                                    <p><strong>Bài đăng:</strong> {selectedReport?.property?.title || selectedReport?.propertyTitle || 'Bài đăng đã bị ẩn'}</p>
                                    
                                    {actionType !== 'dismiss' && (
                                        <>
                                            <p>Vui lòng nhập lý do {actionType === 'warning' ? 'gửi cảnh báo' : 'ẩn bài đăng'}:</p>
                                            <textarea
                                                className="action-reason-input"
                                                value={actionReason}
                                                onChange={(e) => setActionReason(e.target.value)}
                                                placeholder={actionType === 'warning' ? 'Nhập lý do cảnh báo...' : 'Nhập lý do ẩn bài đăng...'}
                                                rows="4"
                                            />
                                            <div style={{ 
                                                fontSize: '12px', 
                                                color: actionReason.trim().length < (actionType === 'warning' ? 10 : 3) || actionReason.trim().length > 500 ? '#d00' : '#666',
                                                marginTop: '5px'
                                            }}>
                                                {actionReason.trim().length}/500 ký tự 
                                                {actionType === 'warning' && ' (tối thiểu 10 ký tự)'}
                                                {actionType === 'hide' && ' (tối thiểu 3 ký tự)'}
                                            </div>
                                        </>
                                    )}

                                    <div className="modal-actions-report">
                                        <button
                                            className="btn-report-cancel btn-secondary-report-cancel"
                                            onClick={() => {
                                                setShowActionModal(false);
                                                setActionReason('');
                                                setActionType('');
                                            }}
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            className={`btn-report-success ${actionType === 'dismiss' ? 'btn-secondary-report' : actionType === 'warning' ? 'btn-warning' : 'btn-danger'}`}
                                            onClick={handleReportAction}
                                            disabled={(actionType !== 'dismiss' && !actionReason.trim()) || processingReportId}
                                        >
                                            {actionType === 'dismiss' && <i className="fa fa-ban"></i>}
                                            {actionType === 'warning' && <i className="fa fa-exclamation-triangle"></i>}
                                            {actionType === 'hide' && <i className="fa fa-eye-slash"></i>}
                                            {processingReportId ? 'Đang xử lý...' : (
                                                actionType === 'dismiss' ? 'Bỏ qua' :
                                                actionType === 'warning' ? 'Gửi cảnh báo' : 'Ẩn bài đăng'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportManagement;
