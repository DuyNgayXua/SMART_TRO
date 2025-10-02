import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { myPropertiesAPI } from '../../../services/myPropertiesAPI';
import EditPropertyModal from '../edit-property-modal/EditPropertyModal';
import '../ProfilePages.css';
import './MyProperties.css';
import { FaEllipsisV, FaComment  } from "react-icons/fa";


const MyProperties = () => {
  const { t } = useTranslation();

  // States
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0
  });

  // Filters & Search
  const [filters, setFilters] = useState({
    approvalStatus: 'all', // all, pending, approved, rejected, hidden .
    sortBy: 'createdAt',
    sortOrder: 'desc',
    search: ''
  });

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingProperty, setDeletingProperty] = useState(null);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [togglingProperty, setTogglingProperty] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);

  // Rejected files state
  const [rejectedFiles, setRejectedFiles] = useState({ images: [], video: [] });

  // Dropdown menu state
  const [activeDropdown, setActiveDropdown] = useState(null);

  // Status options
  const statusOptions = [
    { value: 'all', label: 'Tất cả', icon: 'fa-list' },
    { value: 'pending', label: 'Chờ duyệt', icon: 'fa-clock-o' },
    { value: 'approved', label: 'Đã duyệt', icon: 'fa-check-circle' },
    { value: 'rejected', label: 'Bị từ chối', icon: 'fa-times-circle' },
    { value: 'hidden', label: 'Đã ẩn', icon: 'fa-eye-slash' }
  ];

  // Load properties on component mount and filter changes
  useEffect(() => {
    loadProperties();
  }, [filters, pagination.page]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.property-dropdown')) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Load properties from API
  const loadProperties = async () => {
    try {
      setLoading(true);
      const params = {
        ...filters,
        page: pagination.page,
        limit: pagination.limit
      };

      const response = await myPropertiesAPI.getMyProperties(params);

      if (response.success) {
        setProperties(response.data.properties || []);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination?.total || 0,
          totalPages: response.data.pagination?.totalPages || 0
        }));
      } else {
        toast.error('Không thể tải danh sách tin đăng');
        setProperties([]);
      }
    } catch (error) {
      console.error('Error loading properties:', error);
      toast.error('Lỗi khi tải danh sách tin đăng');
      setProperties([]);
    } finally {
      setLoading(false);
    }
  };

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

  // Handle search
  const handleSearch = (e) => {
    const value = e.target.value;
    setFilters(prev => ({
      ...prev,
      search: value
    }));
    setPagination(prev => ({
      ...prev,
      page: 1
    }));
  };

  // Handle edit property
  const handleEdit = async (property) => {
    try {
      const response = await myPropertiesAPI.getPropertyForEdit(property._id);
      console.log('Edit send property data:', response);
      if (response.success) {
        setEditingProperty(response.data);
        setShowEditModal(true);
      } else {
        toast.error('Không thể tải thông tin tin đăng để chỉnh sửa');
      }
    } catch (error) {
      console.error('Error loading property for edit:', error);
      toast.error('Lỗi khi tải thông tin tin đăng');
    }
  };

  // Handle delete confirmation
  const handleDeleteConfirm = (property) => {
    setDeletingProperty(property);
    setShowDeleteModal(true);
  };

  // Handle delete property
  const handleDelete = async () => {
    if (!deletingProperty) return;

    try {
      const response = await myPropertiesAPI.deleteProperty(deletingProperty._id);
      if (response.success) {
        toast.success('Đã xóa tin đăng thành công');
        setShowDeleteModal(false);
        setDeletingProperty(null);
        loadProperties(); // Reload list
      } else {
        toast.error(response.message || 'Không thể xóa tin đăng');
      }
    } catch (error) {
      console.error('Error deleting property:', error);
      toast.error('Lỗi khi xóa tin đăng');
    }
  };

  // Handle dropdown toggle
  const handleDropdownToggle = (propertyId) => {
    setActiveDropdown(activeDropdown === propertyId ? null : propertyId);
  };

  // Handle promote property to top
  const handlePromoteProperty = async (property) => {
    try {
      // Đóng dropdown
      setActiveDropdown(null);

      // Call API để promote property lên đầu trang
      const response = await myPropertiesAPI.promotePropertyToTop(property._id);
      if (response.success) {
        toast.success('Đã đưa tin đăng lên đầu trang thành công');
        loadProperties(); // Reload list
      } else {
        toast.error(response.message || 'Không thể đưa tin đăng lên đầu trang');
      }
    } catch (error) {
      console.error('Error promoting property:', error);
      toast.error('Lỗi khi đưa tin đăng lên đầu trang');
    }
  };

  // Handle toggle status confirmation
  const handleToggleStatusConfirm = (property) => {
    setTogglingProperty(property);
    setShowToggleModal(true);
  };

  // Handle toggle status (hide/show)
  const handleToggleStatus = async () => {
    if (!togglingProperty) return;

    try {
      const response = await myPropertiesAPI.togglePropertyStatus(togglingProperty._id);
      if (response.success) {
        const action = togglingProperty.status === 'available' ? 'ẩn' : 'hiện';
        toast.success(`Đã ${action} tin đăng`);
        setShowToggleModal(false);
        setTogglingProperty(null);
        loadProperties(); // Reload list
      } else {
        toast.error(response.message || 'Không thể thay đổi trạng thái');
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Lỗi khi thay đổi trạng thái');
    }
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    setPagination(prev => ({
      ...prev,
      page: newPage
    }));
  };

  // Handle view property detail
  const handleViewDetail = (property) => {
    setSelectedProperty(property);
    setShowDetailModal(true);
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { class: 'status-pending', text: 'Chờ duyệt', icon: 'fa-clock-o' },
      approved: { class: 'status-approved', text: 'Đã duyệt', icon: 'fa-check-circle' },
      rejected: { class: 'status-rejected', text: 'Bị từ chối', icon: 'fa-times-circle' },
      hidden: { class: 'status-hidden', text: 'Đã ẩn', icon: 'fa-eye-slash' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`status-badge ${config.class}`}>
        <i className={`fa ${config.icon}`}></i>
        {config.text}
      </span>
    );
  };

  // Format price
  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN').format(price);
  };

  // Format large numbers for stats (views, comments, favorites)
  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="profile-page">
      <div className="page-header">
        <h2>
          <i className="fa fa-list"></i>
          Quản lý tin đăng của tôi
        </h2>
        <p>Xem và quản lý các tin đăng cho thuê phòng trọ của bạn</p>
      </div>

      <div className="content-card-my-properties">
        {/* Filters & Search */}
        <div className="properties-controls">
          <div className="controls-left">
            <div className="search-box">
              <i className="fa fa-search"></i>
              <input
                type="text"
                placeholder="Tìm kiếm theo tiêu đề..."
                value={filters.search}
                onChange={handleSearch}
              />
            </div>
          </div>

          <div className="controls-right">
            <div className="filter-group">
              <label>Trạng thái:</label>
              <select
                value={filters.approvalStatus}
                onChange={(e) => handleFilterChange('approvalStatus', e.target.value)}
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Sắp xếp:</label>
              <select
                value={`${filters.sortBy}_${filters.sortOrder}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split('_');
                  setFilters(prev => ({
                    ...prev,
                    sortBy,
                    sortOrder
                  }));
                }}
              >
                <option value="createdAt_desc">Mới nhất</option>
                <option value="createdAt_asc">Cũ nhất</option>
                <option value="title_asc">Tiêu đề A-Z</option>
                <option value="title_desc">Tiêu đề Z-A</option>
                <option value="rentPrice_desc">Giá cao nhất</option>
                <option value="rentPrice_asc">Giá thấp nhất</option>
              </select>
            </div>
          </div>
        </div>

        {/* Properties List */}
        <div className="properties-content">
          {loading ? (
            <div className="loading-state">
              <i className="fa fa-spinner fa-spin"></i>
              <p>Đang tải danh sách tin đăng...</p>
            </div>
          ) : properties.length === 0 ? (
            <div className="empty-state">
              <i className="fa fa-home"></i>
              <h3>Chưa có tin đăng nào</h3>
              <p>Bạn chưa có tin đăng nào. Hãy tạo tin đăng mới để bắt đầu!</p>
            </div>
          ) : (
            <>
              <div className="properties-grid">
                {properties.map(property => (
                  <div key={property._id} className="property-card">
                    <div className="property-image">
                      {property.images && property.images.length > 0 ? (
                        <img
                          src={property.images[0]}
                          alt={property.title}
                          onError={(e) => {
                            e.target.src = '/images/placeholder.jpg';
                          }}
                        />
                      ) : (
                        <div className="no-image">
                          <i className="fa fa-home"></i>
                        </div>
                      )}
                      <div className="property-status">
                        {getStatusBadge(property.approvalStatus)}
                      </div>

                      {/* Dropdown Menu - chỉ hiện khi approved */}
                      {property.approvalStatus === 'approved' && (
                        <div className="property-dropdown">
                          <button
                            className="dropdown-toggle"
                            onClick={() => handleDropdownToggle(property._id)}
                          >
                            <FaEllipsisV className="text-black cursor-pointer" />
                          </button>

                          {activeDropdown === property._id && (
                            <div className="dropdown-menu">
                              <button
                                className="dropdown-item"
                                onClick={() => handlePromoteProperty(property)}
                              >
                                <i className="fa fa-arrow-up"></i>
                                Đưa tin lên đầu trang
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="property-info">
                      <h3 className="property-title">{property.title}</h3>
                      <div className="property-details">
                        <div className="detail-item">
                          <i className="fa fa-money"></i>
                          <span>{formatPrice(property.rentPrice)}</span>
                          <span className="currency">VNĐ/tháng</span>
                        </div>
                        <div className="detail-item">
                          <i className="fa fa-expand"></i>
                          <span>{property.area}m²</span>
                        </div>
                        <div className="detail-item">
                          <i className="fa fa-map-marker"></i>
                          <span>{property.location?.detailAddress}, {property.location?.wardName}, {property.location?.districtName},{property.location?.provinceName}</span>
                        </div>
                        <div className="detail-item">
                          <i className="fa fa-calendar"></i>
                          <span>Đăng: {formatDate(property.createdAt)}</span>
                        </div>
                      </div>

                      <div className="property-stats">
                        <div className="stat-item">
                          <i className="fa fa-eye"></i>
                          <span>{formatNumber(property.views || 0)} lượt xem</span>
                        </div>
                        <div className="stat-item">
                          <i className="fa fa-comment"></i>
                          <span>{formatNumber(property.comments || 0)} bình luận</span>
                        </div>
                        <div className="stat-item">
                          <i className="fa fa-heart"></i>
                          <span>{formatNumber(property.favorites || 0)} yêu thích</span>
                        </div>
                      </div>

                      <div className="property-actions">
                        <button
                          className="btn btn-outline btn-edit"
                          onClick={() => handleEdit(property)}
                        >
                          <i className="fa fa-edit"></i>
                          Sửa
                        </button>

                        {property.approvalStatus === 'rejected' && (
                          <button
                            className="btn btn-info btn-view-detail"
                            onClick={() => handleViewDetail(property)}
                            title="Xem chi tiết và lý do từ chối"
                          >
                            <i className="fa fa-eye"></i>
                            Lý do
                          </button>
                        )}

                        {property.approvalStatus === 'approved' && (
                          <button
                            className={`btn btn-sm ${property.status === 'available' ? 'btn-secondary' : 'btn-warning'}`}
                            onClick={() => handleToggleStatusConfirm(property)}
                            style={{
                              backgroundColor: property.status === 'available' ? '#6c757d' : '#fd7e14',
                              borderColor: property.status === 'available' ? '#6c757d' : '#fd7e14',
                              color: 'white'
                            }}
                          >
                            <i className={`fa ${property.status === 'available' ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            {property.status === 'available' ? 'Ẩn' : 'Hiện'}
                          </button>
                        )}

                        <button
                          className="btn btn-danger btn-delete"
                          onClick={() => handleDeleteConfirm(property)}
                        >
                          <i className="fa fa-trash"></i>
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="pagination-container">
                  <div className="pagination">
                    <button
                      className="pagination-btn-my-properties"
                      disabled={pagination.page === 1}
                      onClick={() => handlePageChange(pagination.page - 1)}
                    >
                      <i className="fa fa-chevron-left"></i>
                      Trước
                    </button>

                    <div className="pagination-info-my-properties">
                      Trang {pagination.page} / {pagination.totalPages}
                      <span className="total-info">
                        ({pagination.total} tin đăng)
                      </span>
                    </div>

                    <button
                      className="pagination-btn-my-properties"
                      disabled={pagination.page === pagination.totalPages}
                      onClick={() => handlePageChange(pagination.page + 1)}
                    >
                      Sau
                      <i className="fa fa-chevron-right"></i>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Property Detail Modal */}
      {showDetailModal && selectedProperty && (
        <div className="modal-overlay-reason-my-properties" onClick={() => setShowDetailModal(false)}>
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
                <div className="detail-header">
                  <h4>{selectedProperty.title}</h4>
                  {getStatusBadge(selectedProperty.approvalStatus)}
                </div>

                {selectedProperty.images && selectedProperty.images.length > 0 && (
                  <div className="property-images">
                    <img
                      src={selectedProperty.images[0]}
                      alt={selectedProperty.title}
                      className="detail-main-image"
                      onError={(e) => {
                        e.target.src = '/images/placeholder.jpg';
                      }}
                    />
                  </div>
                )}

                <div className="property-info-detail">
                  <div className="detail-item">
                    <strong>Giá thuê:</strong>
                    <span>{formatPrice(selectedProperty.rentPrice)} VNĐ/tháng</span>
                  </div>
                  <div className="detail-item">
                    <strong>Diện tích:</strong>
                    <span>{selectedProperty.area}m²</span>
                  </div>
                  <div className="detail-item">
                    <strong>Địa chỉ:</strong>
                    <span>
                      {selectedProperty.location?.detailAddress}, {selectedProperty.location?.wardName}, 
                      {selectedProperty.location?.districtName}, {selectedProperty.location?.provinceName}
                    </span>
                  </div>
                  <div className="detail-item">
                    <strong>Ngày đăng:</strong>
                    <span>{formatDate(selectedProperty.createdAt)}</span>
                  </div>
                  
                  {selectedProperty.approvalStatus === 'rejected' && selectedProperty.rejectionReason && (
                    <div className="detail-item reject-reason">
                      <strong>Lý do từ chối:</strong>
                      <span className="rejection-text">{selectedProperty.rejectionReason}</span>
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
          </div>
        </div>
      )}

      {/* Edit Property Modal */}
      {showEditModal && editingProperty && (
        <EditPropertyModal
          property={editingProperty}
          onClose={() => {
            setShowEditModal(false);
            setEditingProperty(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setEditingProperty(null);
            loadProperties();
          }}
        />
      )}

      {/* Toggle Status Confirmation Modal */}
      {showToggleModal && togglingProperty && (
        <div className="modal-overlay-hidden">
          <div className="delete-modal">
            <div className="modal-header">
              <h3>Xác nhận {togglingProperty.status === 'available' ? 'ẩn' : 'hiện'} tin đăng</h3>
            </div>
            <div className="modal-content">
              <p>Bạn có chắc chắn muốn {togglingProperty.status === 'available' ? 'ẩn' : 'hiện'} tin đăng:</p>
              <p className="property-title-delete">"{togglingProperty.title}"</p>
              {togglingProperty.status === 'available' && (
                <p className="warning-text">
                  <i className="fa fa-info-circle"></i>
                  Tin đăng sẽ không hiển thị trên trang chủ khi bị ẩn!
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button
                className="btn-hidden btn-secondary-hidden"
                onClick={() => {
                  setShowToggleModal(false);
                  setTogglingProperty(null);
                }}
              >
                Hủy
              </button>
              <button
                className={`btn ${togglingProperty.status === 'available' ? 'btn-warning' : 'btn-success'}`}
                onClick={handleToggleStatus}
                style={{
                  backgroundColor: togglingProperty.status === 'available' ? '#6c757d' : '#fd7e14',
                  borderColor: togglingProperty.status === 'available' ? '#6c757d' : '#fd7e14'
                }}
              >
                <i className={`fa ${togglingProperty.status === 'available' ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                {togglingProperty.status === 'available' ? 'Ẩn tin đăng' : 'Hiện tin đăng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingProperty && (
        <div className="modal-overlay-management">
          <div className="delete-modal">
            <div className="modal-header-management">
              <h3>Xác nhận xóa tin đăng</h3>
              <button
                className="close-btn-management"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingProperty(null);
                }}
              >
                <i className="fa fa-times"></i>
              </button>
            </div>
            <div className="modal-content">
              <p>Bạn có chắc chắn muốn xóa tin đăng:</p>
              <p className="property-title-delete">"{deletingProperty.title}"</p>
              <p className="warning-text">
                <i className="fa fa-warning"></i>
                Hành động này không thể hoàn tác!
              </p>
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingProperty(null);
                }}
              >
                Hủy
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
              >
                <i className="fa fa-trash"></i>
                Xóa tin đăng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyProperties;