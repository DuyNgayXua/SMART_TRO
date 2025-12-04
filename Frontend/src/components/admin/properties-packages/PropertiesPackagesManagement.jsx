import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import SideBar from '../../common/adminSidebar';
import PropertiesPackageAPI from '../../../services/PropertiesPackageAPI';
import './PropertiesPackagesManagement.css';
import '../admin-global.css';

const PropertiesPackagesManagement = () => {
  // States
  const [packages, setPackages] = useState([]);
  const [filteredPackages, setFilteredPackages] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [isSearched, setIsSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create'); // 'create', 'edit', 'delete'
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [formData, setFormData] = useState({
    name: 'tin_vip_dac_biet', // Mặc định chọn loại đầu tiên
    displayName: '',
    description: '',
    freePushCount: '',
    priority: '',
    color: '#007bff',
    textStyle: 'normal',
    stars: 0,
    features: [''],
    isActive: true
  });

  // Package name options
  const packageNameOptions = [
    { value: 'tin_vip_dac_biet', label: 'TIN VIP ĐẶC BIỆT' },
    { value: 'tin_vip_noi_bat', label: 'TIN VIP NỔI BẬT' },
    { value: 'tin_vip_1', label: 'TIN VIP 1' },
    { value: 'tin_vip_2', label: 'TIN VIP 2' },
    { value: 'tin_vip_3', label: 'TIN VIP 3' },
    { value: 'tin_thuong', label: 'TIN THƯỜNG' }
  ];

  // Text style options
  const textStyleOptions = [
    { value: 'normal', label: 'Bình thường' },
    { value: 'uppercase', label: 'Chữ hoa' }
  ];

  // Load packages on component mount
  useEffect(() => {
    loadPackages();
  }, []);

  // Apply filters when packages or filters change
  useEffect(() => {
    applyFilters();
  }, [packages, statusFilter]);

  // Load packages from API
  const loadPackages = async () => {
    try {
      setLoading(true);
      const response = await PropertiesPackageAPI.getAllPackages();
      
      if (response.success) {
        const packagesData = response.data || [];
        setPackages(packagesData);
        setFilteredPackages(packagesData);
        setIsSearched(false);
        setCurrentPage(1); // Reset to first page when loading data
      } else {
        toast.error('Không thể tải danh sách loại tin đăng');
      }
    } catch (error) {
      console.error('Error loading packages:', error);
      toast.error('Lỗi khi tải danh sách loại tin đăng');
    } finally {
      setLoading(false);
    }
  };

  // Initialize default packages
  const handleInitializePackages = async () => {
    try {
      // Kiểm tra nếu đã có loại tin đăng
      if (packages.length > 0) {
        toast.warning('Đã có loại tin đăng trong hệ thống. Vui lòng xóa hết tất cả loại tin để thực hiện chức năng này.');
        return;
      }

      const response = await PropertiesPackageAPI.initializePackages();
      
      if (response && response.success) {
        toast.success('Khởi tạo loại tin đăng mặc định thành công');
        loadPackages(); // Reload list
      } else {
        toast.error(response?.message || 'Không thể khởi tạo loại tin đăng');
      }
    } catch (error) {
      console.error('Error initializing packages:', error);
      toast.error('Lỗi khi khởi tạo loại tin đăng');
    }
  };

  // Handle create package
  const handleCreate = () => {
    setModalType('create');
    setFormData({
      name: 'tin_vip_dac_biet', // Mặc định chọn loại đầu tiên
      displayName: '',
      description: '',
      freePushCount: '',
      priority: '',
      color: '#007bff',
      textStyle: 'normal',
      stars: 0,
      features: [''],
      isActive: true
    });
    setShowModal(true);
  };

  // Handle edit package
  const handleEdit = (pkg) => {
    setModalType('edit');
    setSelectedPackage(pkg);
    setFormData({
      name: pkg.name,
      displayName: pkg.displayName,
      description: pkg.description,
      freePushCount: pkg.freePushCount?.toString() || '',
      priority: pkg.priority.toString(),
      color: pkg.color,
      textStyle: pkg.textStyle || 'normal',
      stars: pkg.stars || 0,
      features: pkg.features && pkg.features.length > 0 ? pkg.features : [''],
      isActive: pkg.isActive
    });
    setShowModal(true);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = (pkg) => {
    setModalType('delete');
    setSelectedPackage(pkg);
    setShowModal(true);
  };

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Handle features change
  const handleFeaturesChange = (index, value) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData(prev => ({
      ...prev,
      features: newFeatures
    }));
  };

  // Add new feature
  const addFeature = () => {
    setFormData(prev => ({
      ...prev,
      features: [...prev.features, '']
    }));
  };

  // Remove feature
  const removeFeature = (index) => {
    if (formData.features.length > 1) {
      const newFeatures = formData.features.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        features: newFeatures
      }));
    }
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Validate form
      if (!formData.name || !formData.displayName || !formData.priority) {
        toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
        return;
      }

      // Prepare data - không filter features để backend validate
      const submitData = {
        ...formData,
        freePushCount: formData.freePushCount ? parseInt(formData.freePushCount) : 0, // Default to 0 if empty
        priority: parseInt(formData.priority),
        features: formData.features // Gửi tất cả features, kể cả rỗng để backend validate
      };
      console.log('Submitting data:', submitData);

      let response;
      if (modalType === 'create') {
        response = await PropertiesPackageAPI.createPackage(submitData);
      } else if (modalType === 'edit') {
        response = await PropertiesPackageAPI.updatePackage(selectedPackage._id, submitData);
      }

      if (response && response.success) {
        toast.success(modalType === 'create' ? 'Tạo loại tin đăng thành công' : 'Cập nhật loại tin đăng thành công');
        setShowModal(false);
        loadPackages(); // Reload list
      } else {
        console.error('API Response:', response);
        if (response && response.errors) {
          // Show validation errors
          const errorMessages = response.errors.map(err => err.msg).join(', ');
          toast.error(`Lỗi: ${errorMessages}`);
        } else {
          toast.error(response?.message || 'Có lỗi xảy ra khi lưu loại tin đăng');
        }
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      
      // Parse error response if available
      if (error.response) {
        const errorData = await error.response.json().catch(() => null);
        console.error('Error response data:', errorData);
        
        if (errorData && errorData.errors) {
          const errorMessages = errorData.errors.map(err => err.msg).join(', ');
          toast.error(`Lỗi validation: ${errorMessages}`);
        } else {
          toast.error(errorData?.message || 'Lỗi khi lưu thông tin loại tin đăng');
        }
      } else {
        toast.error('Lỗi kết nối server');
      }
    }
  };

  // Handle delete
  const handleDelete = async () => {
    try {
      const response = await PropertiesPackageAPI.deletePackage(selectedPackage._id);
      
      if (response.success) {
        toast.success('Xóa loại tin đăng thành công');
        setShowModal(false);
        loadPackages(); // Reload list
      } else {
        toast.error('Không thể xóa loại tin đăng');
      }
    } catch (error) {
      console.error('Error deleting package:', error);
      toast.error('Lỗi khi xóa loại tin đăng');
    }
  };

  // Apply filters (search + status)
  const applyFilters = () => {
    let filtered = [...packages];

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(pkg => 
        pkg.name.toLowerCase().includes(searchLower) ||
        pkg.displayName.toLowerCase().includes(searchLower) ||
        pkg.description.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(pkg => {
        if (statusFilter === 'active') return pkg.isActive === true;
        if (statusFilter === 'inactive') return pkg.isActive === false;
        return true;
      });
    }

    setFilteredPackages(filtered);
    setCurrentPage(1); // Reset to first page when filtering
  };

  // Handle search
  const handleSearch = () => {
    setIsSearched(searchTerm.trim() !== '');
    applyFilters();
  };

  // Handle clear search
  const handleClearSearch = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setIsSearched(false);
    setFilteredPackages(packages);
    setCurrentPage(1);
  };

  // Handle status filter change
  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    applyFilters();
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle search on Enter key
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };



  // Pagination calculations
  const totalPages = Math.ceil(filteredPackages.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPackages = filteredPackages.slice(startIndex, endIndex);

  // Handle page change
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Generate page numbers for pagination
  const generatePageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, currentPage - 2);
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  // Render stars
  const renderStars = (count) => {
    return Array.from({ length: count }, (_, i) => (
      <i key={i} className="fa fa-star" style={{ color: '#ffc107' }}></i>
    ));
  };

  return (
    <div className="dashboard-container">
      <SideBar />
      <div className="dashboard-content">
        <div className="packages-management-container">
          {/* Header Section */}
          <div className="rooms-header">
            <h1 className="rooms-title">Quản lý loại tin</h1>
            <div className="header-search">
              <div className="search-box-properties-packages">
                <i className="fas fa-search search-icon"></i>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Tìm kiếm loại tin đăng theo tên..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onKeyPress={handleSearchKeyPress}
                />
                {searchTerm && (
                  <button
                    className="clear-search-btn-properties-packages"
                    onClick={handleClearSearch}
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
              className={`status-tab ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => handleStatusFilterChange({ target: { value: 'all' } })}
            >
              <i className="fas fa-list"></i>
              Tất cả
            </button>
            <button
              className={`status-tab ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => handleStatusFilterChange({ target: { value: 'active' } })}
            >
              <i className="fas fa-check-circle"></i>
              Đang hoạt động
            </button>
            <button
              className={`status-tab ${statusFilter === 'inactive' ? 'active' : ''}`}
              onClick={() => handleStatusFilterChange({ target: { value: 'inactive' } })}
            >
              <i className="fas fa-times-circle"></i>
              Tạm dừng
            </button>
          </div>

          {/* Action Buttons */}
          <div className="package-actions-bar">
            <button className="btn-add-package" onClick={handleCreate}>
              <i className="fas fa-plus"></i>
              Thêm loại tin mới
            </button>
            {packages.length === 0 && (
              <button 
                className="btn-initialize-default"
                onClick={handleInitializePackages}
                disabled={packages.length > 0}
                title="Khởi tạo 6 loại tin đăng mặc định"
              >
                <i className="fa fa-refresh"></i>
                Khởi tạo loại mặc định
              </button>
            )}
          </div>

          {/* Results Info */}
          {!loading && packages.length > 0 && (
            <div className="admin-results-info">
              <span>
                <i className="fa fa-list"></i>
                Hiển thị {currentPackages.length} / {filteredPackages.length} loại tin đăng
                {filteredPackages.length !== packages.length && (
                  <span> (đã lọc từ {packages.length} loại)</span>
                )}
              </span>
            </div>
          )}

          {/* Search Results Info */}
          {isSearched && searchTerm && !loading && packages.length > 0 && (
            <div className="search-results-info">
              <i className="fa fa-info-circle"></i>
              Tìm thấy <strong>{filteredPackages.length}</strong> loại tin đăng phù hợp với từ khóa "<strong>{searchTerm}</strong>"
              {filteredPackages.length !== packages.length && (
                <span> trong tổng số <strong>{packages.length}</strong> loại</span>
              )}
            </div>
          )}

          {/* Packages List */}
          <div className="content-card-properties-packages">
            {loading ? (
              <div className="loading-state">
                <i className="fa fa-spinner fa-spin"></i>
                <p>Đang tải danh sách loại tin đăng...</p>
              </div>
            ) : packages.length === 0 ? (
              <div className="empty-state">
                <i className="fa-box"></i>
                <h3>Chưa có loại tin đăng nào</h3>
                <p>Hãy tạo loại tin đăng mới hoặc khởi tạo loại mặc định</p>
              
              </div>
            ) : isSearched && filteredPackages.length === 0 ? (
              <div className="empty-state">
                <i className="fa fa-search"></i>
                <h3>Không tìm thấy loại tin đăng nào</h3>
                <p>Không có loại tin đăng nào phù hợp với từ khóa: <strong>"{searchTerm}"</strong></p>
                <button className="btn btn-secondary" onClick={handleClearSearch}>
                  <i className="fa fa-times"></i>
                  Xóa bộ lọc
                </button>
              </div>
            ) : (
              <div className="packages-table-container">
                <table className="packages-table">
                  <thead>
                    <tr>
                      <th>Gói tin đăng</th>
                      <th>Độ ưu tiên</th>
                      <th>Màu sắc</th>
                      <th>Tính năng</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPackages.map(pkg => (
                      <tr key={pkg._id} className="package-row">
                        <td className="package-info">
                          <div className="package-name-cell">
                            <h4 style={{ color: pkg.color, textTransform: pkg.textStyle }}>
                              {pkg.displayName}
                              {pkg.stars > 0 && (
                                <span className="package-stars">
                                  {renderStars(pkg.stars)}
                                </span>
                              )}
                            </h4>
                            <p className="package-description-cell">{pkg.description}</p>
                          </div>
                        </td>
                        <td className="package-priority-cell">
                          <span className="priority-badge priority-{pkg.priority}">
                            {pkg.priority}
                          </span>
                        </td>
                        
                        <td className="package-color-cell">
                          <div className="color-preview">
                            <div 
                              className="color-box" 
                              style={{ backgroundColor: pkg.color }}
                            ></div>
                            <span className="color-code">{pkg.color}</span>
                          </div>
                        </td>
                        
                        <td className="package-features-cell">
                          {pkg.features && pkg.features.length > 0 ? (
                            <div className="features-list">
                              {pkg.features.slice(0, 2).map((feature, index) => (
                                <div key={index} className="feature-item">
                                  {feature}
                                </div>
                              ))}
                              {pkg.features.length > 2 && (
                                <div className="feature-more">
                                  +{pkg.features.length - 2} tính năng khác
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="no-features">Chưa có tính năng</span>
                          )}
                        </td>
                        
                        <td className="package-status-cell">
                          <span className={`status-badge-properties-packages ${pkg.isActive ? 'status-package-active' : 'status-package-inactive'}`}>
                            <i className={`fa ${pkg.isActive ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                            {pkg.isActive ? 'Hoạt động' : 'Tạm dừng'}
                          </span>
                        </td>
                        
                        <td className="package-actions-cell">
                          <div className="actions-group">
                            <button 
                              className="btn-action btn-edit"
                              onClick={() => handleEdit(pkg)}
                              title="Chỉnh sửa"
                            >
                              <i className="fa fa-edit"></i>
                            </button>
                            <button 
                              className="btn-action btn-delete"
                              onClick={() => handleDeleteConfirm(pkg)}
                              title="Xóa"
                            >
                              <i className="fa fa-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="pagination-container-property-package-management">
                    <div className="pagination-info">
                      Trang {currentPage} / {totalPages}
                    </div>
                    <div className="pagination-controls">
                      <button
                        className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage === 1}
                        title="Trang đầu"
                      >
                        <i className="fa fa-angle-double-left"></i>
                      </button>
                      
                      <button
                        className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        title="Trang trước"
                      >
                        <i className="fa fa-angle-left"></i>
                      </button>

                      {generatePageNumbers().map(pageNum => (
                        <button
                          key={pageNum}
                          className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        title="Trang sau"
                      >
                        <i className="fa fa-angle-right"></i>
                      </button>
                      
                      <button
                        className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        title="Trang cuối"
                      >
                        <i className="fa fa-angle-double-right"></i>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>
                  {modalType === 'create' && 'Thêm loại tin đăng mới'}
                  {modalType === 'edit' && 'Chỉnh sửa loại tin đăng'}
                  {modalType === 'delete' && 'Xác nhận xóa loại tin đăng'}
                </h3>
                <button className="modal-close-package-management" onClick={() => setShowModal(false)}>
                  <i className="fa fa-times"></i>
                </button>
              </div>

              <div className="modal-content-properties-packages">
                {modalType === 'delete' ? (
                  <div className="delete-confirmation">
                    <p>Bạn có chắc chắn muốn xóa loại tin đăng:</p>
                    <p className="package-name-delete">"{selectedPackage?.displayName}"</p>
                    <p className="warning-text">
                      <i className="fa fa-warning"></i>
                      Hành động này không thể hoàn tác!
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="package-form">
                    <div className="form-grid">
                      <div className="form-group">
                        <label style={{ color: 'red' }}>Tên loại *</label>
                        <select
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          required
                          disabled={modalType === 'edit'}
                          className='package-name-select'
                        >
                          {packageNameOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label style={{ color: 'red' }}>Tên hiển thị *</label>
                        <input
                          type="text"
                          name="displayName"
                          value={formData.displayName}
                          onChange={handleInputChange}
                          placeholder="Nhập tên hiển thị"
                          required
                        />
                      </div>

             

                      <div className="form-group">
                        <label>Độ ưu tiên *</label>
                        <input
                          type="number"
                          name="priority"
                          value={formData.priority}
                          onChange={handleInputChange}
                          placeholder="Nhập độ ưu tiên (1-6)"
                          min="1"
                          max="6"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>Màu sắc</label>
                        <input
                          type="color"
                          name="color"
                          value={formData.color}
                          onChange={handleInputChange}
                        />
                      </div>

                      <div className="form-group">
                        <label>Kiểu chữ</label>
                        <select
                          name="textStyle"
                          value={formData.textStyle}
                          onChange={handleInputChange}
                          className='package-name-select'
                        >
                          {textStyleOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Số sao</label>
                        <input
                          type="number"
                          name="stars"
                          value={formData.stars}
                          onChange={handleInputChange}
                          min="0"
                          max="5"
                        />
                      </div>

                      <div className="form-group switch-group">
                        <label className="switch-label">
                          Trạng thái loại tin đăng
                        </label>
                        <div className="switch-container">
                          <input
                            type="checkbox"
                            id="isActiveSwitch"
                            name="isActive"
                            checked={formData.isActive}
                            onChange={handleInputChange}
                            className="switch-input"
                          />
                          <label htmlFor="isActiveSwitch" className="switch">
                            <span className="switch-slider"></span>
                          </label>
                          <span className={`switch-text ${formData.isActive ? 'active' : 'inactive'}`}>
                            {formData.isActive ? 'Đang hoạt động' : 'Tạm dừng'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="form-group full-width">
                      <label>Mô tả</label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        placeholder="Nhập mô tả loại tin đăng"
                        rows="3"
                      />
                    </div>

                    <div className="form-group full-width">
                      <label>Tính năng</label>
                      {formData.features.map((feature, index) => (
                        <div key={index} className="feature-input">
                          <div className="feature-number">
                            {index + 1}
                          </div>
                          <input
                            type="text"
                            value={feature}
                            onChange={(e) => handleFeaturesChange(index, e.target.value)}
                            placeholder={`Nhập tính năng thứ ${index + 1}`}
                          />
                          {formData.features.length > 1 && (
                            <button
                              type="button"
                              className="btn-remove-feature"
                              onClick={() => removeFeature(index)}
                              title={`Xóa tính năng thứ ${index + 1}`}
                            >
                              <i className="fa fa-times"></i>
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn btn-secondary btn-add-feature"
                        onClick={addFeature}
                      >
                        <i className="fa fa-plus"></i>
                        Thêm tính năng
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div className="modal-actions-properties-packages">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Hủy
                </button>
                {modalType === 'delete' ? (
                  <button className="btn btn-danger" onClick={handleDelete}>
                    <i className="fa fa-trash"></i>
                    Xóa loại tin
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={handleSubmit}>
                    <i className="fa fa-save"></i>
                    {modalType === 'create' ? 'Tạo loại tin' : 'Cập nhật'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertiesPackagesManagement;