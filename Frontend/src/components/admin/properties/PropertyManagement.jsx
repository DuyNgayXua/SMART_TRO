import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import SideBar from '../../common/adminSidebar';
import adminPropertiesAPI from '../../../services/adminPropertiesAPI';
import { locationAPI } from '../../../services/locationAPI';
import '../admin-global.css';
import './PropertyManagement.css';

const PropertyManagement = () => {
    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending'); // pending, approved, rejected, all
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalProperties, setTotalProperties] = useState(0);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [processingPropertyId, setProcessingPropertyId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0
    });
    const [addressCache, setAddressCache] = useState(new Map());
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Load properties from API
    const loadProperties = async (page = 1, status = filter, search = searchTerm) => {
        try {
            setLoading(true);

            const data = await adminPropertiesAPI.getPropertiesForAdmin(page, status, 10, search);

            if (data.success) {
                setProperties(data.data.properties);
                setTotalPages(data.data.pagination.totalPages);
                setCurrentPage(data.data.pagination.currentPage);
                setTotalProperties(data.data.pagination.totalProperties);

                // Load address info for all properties
                data.data.properties.forEach(property => {
                    if (property.province && property.district && property.ward) {
                        loadAddressInfo(property.province, property.district, property.ward);
                    }
                });
            } else {
                toast.error(data.message || 'Không thể tải danh sách bài đăng');
            }
        } catch (error) {
            console.error('Error loading properties:', error);
            toast.error(error.message || 'Lỗi khi tải danh sách bài đăng');
        } finally {
            setLoading(false);
        }
    };

    // Load statistics
    const loadStats = async () => {
        try {
            const data = await adminPropertiesAPI.getPropertyStats();
            if (data.success) {
                setStats(data.data);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    // Load address info and cache it
    const loadAddressInfo = async (provinceCode, districtCode, wardCode) => {
        const cacheKey = `${provinceCode}-${districtCode}-${wardCode}`;

        if (addressCache.has(cacheKey)) {
            return addressCache.get(cacheKey);
        }

        try {
            // Step 1: Load provinces and find province name
            const provincesRes = await locationAPI.getProvinces();
            if (provincesRes.success && provincesRes.data) {
                const foundProvince = provincesRes.data.find(p => p.code == provinceCode);
                if (foundProvince) {
                    let provinceName = foundProvince.name;
                    let districtName = '';
                    let wardName = '';

                    // Step 2: Load districts for this province and find district name
                    const districtsRes = await locationAPI.getDistricts(provinceCode);
                    if (districtsRes.success && districtsRes.data) {
                        const foundDistrict = districtsRes.data.find(d => d.code == districtCode);
                        if (foundDistrict) {
                            districtName = foundDistrict.name;

                            // Step 3: Load wards for this district and find ward name
                            const wardsRes = await locationAPI.getWards(districtCode);
                            if (wardsRes.success && wardsRes.data) {
                                const foundWard = wardsRes.data.find(w => w.code == wardCode);
                                if (foundWard) {
                                    wardName = foundWard.name;
                                }
                            }
                        }
                    }

                    const addressInfo = { provinceName, districtName, wardName };
                    // Cache the result
                    setAddressCache(prev => new Map(prev.set(cacheKey, addressInfo)));
                    return addressInfo;
                }
            }
        } catch (error) {
            console.error('Error loading address info:', error);
        }

        // Return default if failed
        const defaultInfo = { provinceName: provinceCode, districtName: districtCode, wardName: wardCode };
        setAddressCache(prev => new Map(prev.set(cacheKey, defaultInfo)));
        return defaultInfo;
    };

    // Format address with names instead of codes
    const formatAddress = (property) => {

        const cacheKey = `${property.province}-${property.district}-${property.ward}`;
        const cached = addressCache.get(cacheKey);

        if (cached) {
            return ` ${cached.wardName}, ${cached.districtName}, ${cached.provinceName}`;
        }

        // Return codes as fallback while loading
        return `${property.district}, ${property.province}`;
    };

    // Approve property
    const handleApproveProperty = async (propertyId) => {
        if (processingPropertyId) return;

        try {
            setProcessingPropertyId(propertyId);

            const data = await adminPropertiesAPI.approveProperty(propertyId);

            if (data.success) {
                toast.success('Bài đăng đã được duyệt thành công!');
                // Refresh properties list và stats
                loadProperties(currentPage, filter);
                loadStats();
                // Close detail modal if open
                if (showDetailModal) {
                    setShowDetailModal(false);
                }
            } else {
                toast.error(data.message || 'Không thể duyệt bài đăng');
            }
        } catch (error) {
            console.error('Error approving property:', error);
            toast.error(error.message || 'Lỗi khi duyệt bài đăng');
        } finally {
            setProcessingPropertyId(null);
        }
    };

    // Reject property
    const handleRejectProperty = async () => {
        if (!selectedProperty || !rejectReason.trim() || processingPropertyId) return;

        try {
            setProcessingPropertyId(selectedProperty._id);

            const data = await adminPropertiesAPI.rejectProperty(selectedProperty._id, rejectReason);

            if (data.success) {
                toast.success('Bài đăng đã bị từ chối');
                // Refresh properties list và stats
                loadProperties(currentPage, filter);
                loadStats();
                // Close modals
                setShowRejectModal(false);
                setShowDetailModal(false);
                setRejectReason('');
                setSelectedProperty(null);
            } else {
                toast.error(data.message || 'Không thể từ chối bài đăng');
            }
        } catch (error) {
            console.error('Error rejecting property:', error);
            toast.error(error.message || 'Lỗi khi từ chối bài đăng');
        } finally {
            setProcessingPropertyId(null);
        }
    };

    // Handle filter change
    const handleFilterChange = (newFilter) => {
        setFilter(newFilter);
        setCurrentPage(1);
        setSearchTerm('');
        loadProperties(1, newFilter, '');
    };

    // Handle page change
    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            loadProperties(page, filter, searchTerm);
        }
    };

    // Handle search
    const handleSearch = (e) => {
        e.preventDefault();
        setCurrentPage(1);
        loadProperties(1, filter, searchTerm);
    };

    // Handle search input change - only update state, no auto search
    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString('vi-VN');
    };

    // Format price
    const formatPrice = (price) => {
        if (price === null || price === undefined) return 'N/A';
        return new Intl.NumberFormat('vi-VN').format(price) + ' VNĐ';
    };

    // Get status badge
    const getStatusBadge = (status) => {
        const statusConfig = {
            pending: { label: 'Chờ duyệt', className: 'status-pending-manager-property' },
            approved: { label: 'Đã duyệt', className: 'status-approved-manager-property' },
            rejected: { label: 'Bị từ chối', className: 'status-rejected-manager-property' },
        };

        const config = statusConfig[status] || { label: status, className: 'status-unknown' };

        return (
            <span className={`status-badge-manager-property ${config.className}`}>
                {config.label}
            </span>
        );
    };
    const formatCategory = (category) => {
        const categoryMap = {
            'phong_tro': 'Phòng trọ',
            'can_ho': 'Căn hộ',
            'nha_nguyen_can': 'Nhà nguyên căn',
            'chung_cu_mini': 'Chung cư mini',
            'homestay': 'Homestay'
        };
        return categoryMap[category] || category;
    };


    // Handle image navigation
    const handlePrevImage = () => {
        if (selectedProperty?.images?.length > 1) {
            setCurrentImageIndex(prev =>
                prev === 0 ? selectedProperty.images.length - 1 : prev - 1
            );
        }
    };

    const handleNextImage = () => {
        if (selectedProperty?.images?.length > 1) {
            setCurrentImageIndex(prev =>
                prev === selectedProperty.images.length - 1 ? 0 : prev + 1
            );
        }
    };

    // Reset image index when modal opens
    useEffect(() => {
        if (showDetailModal) {
            setCurrentImageIndex(0);
        }
    }, [showDetailModal]);

    // Load properties and stats on component mount
    useEffect(() => {
        loadProperties();
        loadStats();
    }, []);

    return (
        <div className="dashboard-container">
            <SideBar />
            <div className="dashboard-content">
                <div className="property-management">
                    <div className="page-header-admin">
                        <h2>
                            Quản lý bài đăng
                        </h2>
                        <p>Duyệt và quản lý các bài đăng thuê phòng trọ</p>
                    </div>

                    {/* Statistics */}
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon">
                                <i className="fa fa-list"></i>
                            </div>
                            <div className="stat-content">
                                <h3>{stats.total}</h3>
                                <p>Tổng bài đăng</p>
                            </div>
                        </div>
                        <div className="stat-card pending">
                            <div className="stat-icon">
                                <i className="fa fa-clock"></i>
                            </div>
                            <div className="stat-content">
                                <h3>{stats.pending}</h3>
                                <p>Chờ duyệt</p>
                            </div>
                        </div>
                        <div className="stat-card approved">
                            <div className="stat-icon">
                                <i className="fa fa-check-circle"></i>
                            </div>
                            <div className="stat-content">
                                <h3>{stats.approved}</h3>
                                <p>Đã duyệt</p>
                            </div>
                        </div>
                        <div className="stat-card rejected">
                            <div className="stat-icon">
                                <i className="fa fa-times-circle"></i>
                            </div>
                            <div className="stat-content">
                                <h3>{stats.rejected}</h3>
                                <p>Bị từ chối</p>
                            </div>
                        </div>
                    </div>

                    {/* Search and Filter */}
                    <div className="controls-section">
                        <form onSubmit={handleSearch} className="search-form">
                            <div className="search-input-group">
                                <i className="fa fa-search" style={{ left: '12px' }}></i>
                                <input
                                    type="text"
                                    placeholder="Tìm kiếm theo tiêu đề, tên liên hệ, số điện thoại..."
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    className={`search-input ${searchTerm ? 'has-clear' : ''}`}
                                />
                                <div className="search-buttons">
                                    {searchTerm && (
                                        <button
                                            type="button"
                                            className="clear-search-btn-manager-property"
                                            onClick={() => {
                                                setSearchTerm('');
                                                setCurrentPage(1);
                                                loadProperties(1, filter, '');
                                            }}
                                            title="Xóa tìm kiếm"
                                        >
                                            <i className="fa fa-times"></i>
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        className="search-btn-manager-property"
                                        title="Tìm kiếm"
                                    >
                                        <i className="fa fa-search"></i>
                                    </button>
                                </div>
                            </div>
                        </form>

                        <div className="filter-tabs">
                            <button
                                className={`tab-btn ${filter === 'pending' ? 'active' : ''}`}
                                onClick={() => handleFilterChange('pending')}
                            >
                                <i className="fa fa-clock-o"></i>
                                Chờ duyệt ({stats.pending})
                            </button>
                            <button
                                className={`tab-btn ${filter === 'approved' ? 'active' : ''}`}
                                onClick={() => handleFilterChange('approved')}
                            >
                                <i className="fa fa-check-circle"></i>
                                Đã duyệt ({stats.approved})
                            </button>
                            <button
                                className={`tab-btn ${filter === 'rejected' ? 'active' : ''}`}
                                onClick={() => handleFilterChange('rejected')}
                            >
                                <i className="fa fa-times-circle"></i>
                                Bị từ chối ({stats.rejected})
                            </button>
                            <button
                                className={`tab-btn ${filter === 'all' ? 'active' : ''}`}
                                onClick={() => handleFilterChange('all')}
                            >
                                <i className="fa fa-list"></i>
                                Tất cả ({stats.total})
                            </button>
                        </div>
                    </div>

                    {/* Properties list */}
                    {loading ? (
                        <div className="loading-container">
                            <div className="loading-spinner"></div>
                            <p>Đang tải danh sách bài đăng...</p>
                        </div>
                    ) : properties.length === 0 ? (
                        <div className="empty-state">
                            <i className="fa fa-home"></i>
                            <p>Không có bài đăng nào</p>
                        </div>
                    ) : (
                        <>
                            <div className="properties-list-table">
                                <div className="table-container">
                                    <table className="properties-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '80px' }}>Hình</th>
                                                <th style={{ width: '35%' }}>Thông tin, Liên hệ</th>
                                                <th style={{ width: '20%' }}>Địa chỉ, Giá</th>
                                                <th style={{ width: '20%' }}>Trạng thái, Ngày đăng</th>
                                                <th style={{ width: '20%' }}>Lý do từ chối</th>
                                                <th style={{ width: '120px' }}>Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {properties.map((property) => (
                                                <tr key={property._id} className="property-row">
                                                    <td className="image-cell">
                                                        <div className="property-image-thumb">
                                                            {property.images && property.images.length > 0 ? (
                                                                <img
                                                                    src={property.images[0]}
                                                                    alt={property.title}
                                                                    onError={(e) => {
                                                                        e.target.src = '/images/placeholder.jpg';
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="placeholder-image">
                                                                    <i className="fa fa-image"></i>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="combined-info-cell">
                                                        <div className="property-title-section">
                                                            <h4 className="property-title">{property.title}</h4>
                                                            <div className="property-meta">
                                                                <span className="area-tag">{property.area}m²</span>
                                                                <span className="category-tag">{formatCategory(property.category)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="contact-section">
                                                            <div className="contact-row">
                                                                <i className="fa fa-user"></i>
                                                                <span>{property.contactName}</span>
                                                            </div>
                                                            <div className="contact-row">
                                                                <i className="fa fa-phone"></i>
                                                                <span>{property.contactPhone}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="location-price-cell">
                                                        <div className="location-section">
                                                            <div className="district-line">
                                                                {property.detailAddress},{formatAddress(property)}
                                                            </div>
                                                        </div>
                                                        <div className="price-section">
                                                            <div className="main-price">
                                                                {formatPrice(property.rentPrice)}/tháng
                                                            </div>

                                                            {property.promotionPrice !== null &&
                                                                property.promotionPrice !== undefined &&
                                                                property.promotionPrice > 0 && (
                                                                    <div className="promo-price">
                                                                        KM: {formatPrice(property.promotionPrice)}
                                                                    </div>
                                                                )}
                                                        </div>

                                                    </td>
                                                    <td className="status-date-cell">
                                                        <div className="status-section">
                                                            {getStatusBadge(property.approvalStatus)}
                                                        </div>
                                                        <div className="date-section">
                                                            <span>{formatDate(property.createdAt)}</span>
                                                        </div>

                                                    </td>
                                                    <td className="reason-cell">
                                                        {property.rejectionReason ? (
                                                            <div className="reason-section">
                                                                <span className="reason-text">
                                                                    <i className="fa fa-exclamation-triangle"></i>
                                                                    {property.rejectionReason.length > 30
                                                                        ? property.rejectionReason.substring(0, 30) + '...'
                                                                        : property.rejectionReason}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="reason-text"></span>
                                                        )}
                                                    </td>

                                                    <td className="actions-cell">
                                                        <div className="action-buttons-compact">
                                                            <button
                                                                className="btn-action view"
                                                                onClick={() => {
                                                                    setSelectedProperty(property);
                                                                    setShowDetailModal(true);
                                                                }}
                                                                title="Xem chi tiết"
                                                            >
                                                                <i className="fa fa-eye"></i>
                                                            </button>

                                                            {property.approvalStatus === 'pending' && (
                                                                <>
                                                                    <button
                                                                        className="btn-action approve"
                                                                        onClick={() => handleApproveProperty(property._id)}
                                                                        disabled={processingPropertyId === property._id}
                                                                        title="Duyệt"
                                                                    >
                                                                        <i className="fa fa-check"></i>
                                                                    </button>
                                                                    <button
                                                                        className="btn-action reject"
                                                                        onClick={() => {
                                                                            setSelectedProperty(property);
                                                                            setShowRejectModal(true);
                                                                        }}
                                                                        title="Từ chối"
                                                                    >
                                                                        <i className="fa fa-times"></i>
                                                                    </button>
                                                                </>
                                                            )}
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
                                <div className="pagination">
                                    <button
                                        className="pagination-btn"
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                    >
                                        <i className="fa fa-chevron-left"></i>
                                        Trước
                                    </button>

                                    <div className="page-numbers">
                                        {[...Array(Math.min(totalPages, 10))].map((_, index) => {
                                            let pageNum;
                                            if (totalPages <= 10) {
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
                                        className="pagination-btn"
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                    >
                                        Sau
                                        <i className="fa fa-chevron-right"></i>
                                    </button>

                                    <div className="pagination-info">
                                        <span>
                                            Trang {currentPage} / {totalPages} (Tổng: {totalProperties} bài đăng)
                                        </span>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Property Detail Modal */}
                    {showDetailModal && selectedProperty && (
                        <div className="modal-overlay-management" onClick={() => setShowDetailModal(false)}>
                            <div className="property-detail-modal" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header-management">
                                    <h2>Chi tiết bài đăng</h2>
                                    <button
                                        className="close-btn-management"
                                        onClick={() => setShowDetailModal(false)}
                                    >
                                        <i className="fa fa-times"></i>
                                    </button>
                                </div>

                                <div className="modal-content-management">
                                    <div className="property-detail-content-management">


                                        <div className="property-details-content">
                                            <div className="detail-header">
                                                <h4>{selectedProperty.title}</h4>
                                                {getStatusBadge(selectedProperty.approvalStatus)}
                                            </div>
                                            <div className="property-images">
                                                {selectedProperty.images && selectedProperty.images.length > 0 ? (
                                                    <div className="image-slider-container">
                                                        <div className="main-image-container">
                                                            <img
                                                                src={selectedProperty.images[currentImageIndex]}
                                                                alt={`${selectedProperty.title} ${currentImageIndex + 1}`}
                                                                className="main-image"
                                                                onError={(e) => {
                                                                    e.target.src = '/images/placeholder.jpg';
                                                                }}
                                                            />

                                                            {selectedProperty.images.length > 1 && (
                                                                <>
                                                                    <button
                                                                        className="slider-btn prev-btn"
                                                                        onClick={handlePrevImage}
                                                                    >
                                                                        <i className="fa fa-chevron-left"></i>
                                                                    </button>
                                                                    <button
                                                                        className="slider-btn next-btn"
                                                                        onClick={handleNextImage}
                                                                    >
                                                                        <i className="fa fa-chevron-right"></i>
                                                                    </button>
                                                                </>
                                                            )}

                                                            <div className="image-counter">
                                                                {currentImageIndex + 1} / {selectedProperty.images.length}
                                                            </div>
                                                        </div>

                                                        {selectedProperty.images.length > 1 && (
                                                            <div className="image-thumbnails">
                                                                {selectedProperty.images.map((image, index) => (
                                                                    <img
                                                                        key={index}
                                                                        src={image}
                                                                        alt={`Thumbnail ${index + 1}`}
                                                                        className={`thumbnail ${index === currentImageIndex ? 'active' : ''}`}
                                                                        onClick={() => setCurrentImageIndex(index)}
                                                                        onError={(e) => {
                                                                            e.target.style.display = 'none';
                                                                        }}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="no-images">Không có hình ảnh</div>
                                                )}
                                            </div>

                                            <div className="detail-grid-management">
                                                <div className="detail-item-management">
                                                    <strong>Giá thuê:</strong>
                                                    <span>{formatPrice(selectedProperty.rentPrice)}/tháng</span>
                                                </div>
                                                <div className="detail-item-management">
                                                    <strong>Giá khuyến mãi:</strong>
                                                    <span>{selectedProperty.promotionPrice ? formatPrice(selectedProperty.promotionPrice) : '0 VNĐ'}/tháng</span>
                                                </div>
                                                <div className="detail-item-management">
                                                    <strong>Diện tích:</strong>
                                                    <span>{selectedProperty.area}m²</span>
                                                </div>
                                                <div className="detail-item-management">
                                                    <strong>Danh mục:</strong>
                                                    <span>{formatCategory(selectedProperty.category)}</span>
                                                </div>
                                                <div className="detail-item-management">
                                                    <strong>Liên hệ:</strong>
                                                    <span>{selectedProperty.contactName} - {selectedProperty.contactPhone}</span>
                                                </div>
                                                <div className="detail-item-management">
                                                    <strong>Địa chỉ:</strong>
                                                    <span>
                                                        {selectedProperty.detailAddress}, {(() => {
                                                            const cacheKey = `${selectedProperty.province}-${selectedProperty.district}-${selectedProperty.ward}`;
                                                            const cached = addressCache.get(cacheKey);
                                                            if (cached) {
                                                                return `${cached.wardName}, ${cached.districtName}, ${cached.provinceName}`;
                                                            }
                                                            return `${selectedProperty.ward}, ${selectedProperty.district}, ${selectedProperty.province}`;
                                                        })()}
                                                    </span>
                                                </div>
                                                <div className="detail-item-management">
                                                    <strong>Ngày đăng:</strong>
                                                    <span>{formatDate(selectedProperty.createdAt)}</span>
                                                </div>
                                                {selectedProperty.owner && (
                                                    <div className="detail-item-management">
                                                        <strong>Chủ sở hữu:</strong>
                                                        <span>{selectedProperty.owner.fullName} ({selectedProperty.owner.email})</span>
                                                    </div>
                                                )}
                                                {selectedProperty.approvalStatus === 'rejected' && selectedProperty.rejectionReason && (
                                                    <div className="detail-item-management reject-reason">
                                                        <strong>Lý do từ chối:</strong>
                                                        <span>{selectedProperty.rejectionReason}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {selectedProperty.description && (
                                                <div className="description">
                                                    <strong>Mô tả:</strong>
                                                    <p>{selectedProperty.description}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {selectedProperty.approvalStatus === 'pending' && (
                                        <div className="modal-actions-management">
                                            <button
                                                className="btn-management btn-danger"
                                                onClick={() => setShowRejectModal(true)}
                                            >
                                                <i className="fa fa-times"></i>
                                                Từ chối bài đăng
                                            </button>
                                            <button
                                                className="btn-management btn-success"
                                                onClick={() => handleApproveProperty(selectedProperty._id)}
                                                disabled={processingPropertyId === selectedProperty._id}
                                            >
                                                <i className="fa fa-check"></i>
                                                {processingPropertyId === selectedProperty._id ? 'Đang duyệt...' : 'Duyệt bài đăng'}
                                            </button>

                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Reject Modal */}
                    {showRejectModal && (
                        <div className="modal-overlay-reject" onClick={() => setShowRejectModal(false)}>
                            <div className="reject-modal" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header-reject">
                                    <h3>Từ chối bài đăng</h3>
                                    <button
                                        className="close-btn"
                                        onClick={() => setShowRejectModal(false)}
                                    >
                                        <i className="fa fa-times"></i>
                                    </button>
                                </div>

                                <div className="modal-content">
                                    <p><strong>Bài đăng:</strong> {selectedProperty?.title}</p>
                                    <p>Vui lòng nhập lý do từ chối bài đăng:</p>

                                    <textarea
                                        className="reject-reason-input"
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        placeholder="Nhập lý do từ chối..."
                                        rows="4"
                                    />

                                    <div className="modal-actions">
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => {
                                                setShowRejectModal(false);
                                                setRejectReason('');
                                            }}
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            className="btn btn-danger"
                                            onClick={handleRejectProperty}
                                            disabled={!rejectReason.trim() || processingPropertyId}
                                        >
                                            <i className="fa fa-times"></i>
                                            {processingPropertyId ? 'Đang xử lý...' : 'Từ chối'}
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

export default PropertyManagement;