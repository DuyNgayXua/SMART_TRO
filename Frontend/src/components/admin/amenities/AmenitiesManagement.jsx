import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import SideBar from "../../common/adminSidebar";
import "../admin-global.css";
import "./amenities.css";
import amenitiesAPI from '../../../services/amenitiesAPI';

const AmenitiesManagement = () => {
  const { t } = useTranslation();
  const [amenities, setAmenities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchFilters, setSearchFilters] = useState({
    search: '',
    category: '',
    isActive: ''
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 20
  });
  const [categories, setCategories] = useState([]);
  const [categoryCounts, setCategoryCounts] = useState({ all: 0 });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingAmenityId, setEditingAmenityId] = useState(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showEditIconPicker, setShowEditIconPicker] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState(null); // Track which amenity's menu is open
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 }); // Track dropdown position

  // Danh sách icon phổ biến cho amenities
  const popularIcons = [
    { class: 'fas fa-bed', name: 'Giường' },
    { class: 'fas fa-wifi', name: 'WiFi' },
    { class: 'fas fa-car', name: 'Parking' },
    { class: 'fas fa-tv', name: 'TV' },
    { class: 'fas fa-snowflake', name: 'Điều hòa' },
    { class: 'fas fa-bath', name: 'Phòng tắm' },
    { class: 'fas fa-utensils', name: 'Bếp' },
    { class: 'fas fa-tshirt', name: 'Máy giặt' },
    { class: 'fas fa-couch', name: 'Sofa' },
    { class: 'fas fa-fan', name: 'Quạt' },
    { class: 'fas fa-fire', name: 'Nóng lạnh' },
    { class: 'fas fa-shield-alt', name: 'An ninh' },
    { class: 'fas fa-dumbbell', name: 'Gym' },
    { class: 'fas fa-swimmer', name: 'Hồ bơi' },
    { class: 'fas fa-coffee', name: 'Cà phê' },
    { class: 'fas fa-microwave', name: 'Lò vi sóng' },
    { class: 'fas fa-ice-cream', name: 'Tủ lạnh' },
    { class: 'fas fa-chair', name: 'Bàn ghế' },
    { class: 'fas fa-lightbulb', name: 'Đèn' },
    { class: 'fas fa-window-maximize', name: 'Cửa sổ' },
    { class: 'fas fa-door-open', name: 'Ban công' },
    { class: 'fas fa-thermometer-half', name: 'Nhiệt độ' },
    { class: 'fas fa-plug', name: 'Điện' },
    { class: 'fas fa-tint', name: 'Nước' },
    { class: 'fas fa-broom', name: 'Dọn dẹp' },
    { class: 'fas fa-concierge-bell', name: 'Dịch vụ' },
    { class: 'fas fa-check', name: 'Tiện ích' },
    { class: 'fas fa-star', name: 'Đặc biệt' },
    { class: 'fas fa-home', name: 'Nhà' },
    { class: 'fas fa-building', name: 'Tòa nhà' },
    { class: 'fas fa-key', name: 'Chìa khóa' },
    { class: 'fas fa-lock', name: 'Khóa' },
    { class: 'fas fa-elevator', name: 'Thang máy' },
    { class: 'fas fa-stairs', name: 'Cầu thang' },
    { class: 'fas fa-bicycle', name: 'Xe đạp' },
    { class: 'fas fa-motorcycle', name: 'Xe máy' },
    { class: 'fas fa-gamepad', name: 'Giải trí' },
    { class: 'fas fa-music', name: 'Âm nhạc' },
    { class: 'fas fa-book', name: 'Thư viện' },
    { class: 'fas fa-laptop', name: 'Laptop' },
    { class: 'fas fa-desktop', name: 'Desktop' },
    { class: 'fas fa-phone', name: 'Điện thoại' },
    { class: 'fas fa-camera', name: 'Camera' },
    { class: 'fas fa-smoking-ban', name: 'Không hút thuốc' },
    { class: 'fas fa-paw', name: 'Thú cưng' },
    { class: 'fas fa-baby', name: 'Trẻ em' },
    { class: 'fas fa-wheelchair', name: 'Người khuyết tật' },
    { class: 'fas fa-medkit', name: 'Y tế' },
    { class: 'fas fa-shopping-cart', name: 'Mua sắm' },
    { class: 'fas fa-utensil-spoon', name: 'Ăn uống' }
  ];
  const [formData, setFormData] = useState({
    name: '',
    icon: 'fas fa-check',
    category: 'other',
    description: '',
    isActive: true,
    displayOrder: 0
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    icon: 'fas fa-check',
    category: 'other',
    description: '',
    isActive: true,
    displayOrder: 0
  });
  const [formErrors, setFormErrors] = useState({});
  const [editFormErrors, setEditFormErrors] = useState({});

  const categoryLabels = {
    all: t('amenities.categories.all'),
    furniture: t('amenities.categories.furniture'),
    appliance: t('amenities.categories.appliance'),
    utility: t('amenities.categories.utility'),
    service: t('amenities.categories.service'),
    other: t('amenities.categories.other')
  };

  const fetchAmenities = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.currentPage,
        limit: pagination.itemsPerPage,
        category: activeCategory !== 'all' ? activeCategory : undefined,
        isActive: searchFilters.isActive !== '' ? searchFilters.isActive === 'true' : undefined,
        search: searchFilters.search || undefined
      };
      
      const response = await amenitiesAPI.getAmenities(params);
      if (response.success) {
        setAmenities(response.data.amenities);
        setPagination(prev => ({
          ...prev,
          totalItems: response.data.pagination.total,
          totalPages: response.data.pagination.pages
        }));
        
        // Calculate category counts
        const counts = { all: response.data.pagination.total };
        // This is simplified - ideally we'd get counts from backend
        setCategoryCounts(counts);
      }
    } catch (error) {
      console.error('Error loading amenities:', error);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, searchFilters, pagination.currentPage, pagination.itemsPerPage]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await amenitiesAPI.getCategories();
      if (response.success) {
        setCategories(response.data);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }, []);

  useEffect(() => {
    fetchAmenities();
  }, [fetchAmenities]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Handle click outside to close icon pickers
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.icon-picker-container')) {
        setShowIconPicker(false);
        setShowEditIconPicker(false);
      }
    };

    if (showIconPicker || showEditIconPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showIconPicker, showEditIconPicker]);

  // Manage body scroll when modals are open
  useEffect(() => {
    if (showCreateModal || showEditModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showCreateModal, showEditModal]);

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.action-menu-container') && 
          !event.target.closest('.action-menu-dropdown')) {
        setOpenActionMenu(null);
      }
    };

    if (openActionMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openActionMenu]);

  const handleFilterChange = (key, value) => {
    setSearchFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const resetFilters = () => {
    setSearchFilters({
      search: '',
      category: '',
      isActive: ''
    });
    setActiveCategory('all');
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEditFormChange = (field, value) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const openCreateModal = () => {
    setFormData({
      name: '',
      key: '',
      icon: 'fas fa-check',
      category: 'other',
      description: '',
      isActive: true,
      displayOrder: 0
    });
    setFormErrors({});
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setFormErrors({});
  };

  const openEditModal = async (amenityId) => {
    try {
      const response = await amenitiesAPI.getAmenityById(amenityId);
      if (response.success) {
        const amenity = response.data;
        setEditingAmenityId(amenity._id);
        setEditFormData({
          name: amenity.name || '',
          key: amenity.key || '',
          icon: amenity.icon || 'fas fa-check',
          category: amenity.category || 'other',
          description: amenity.description || '',
          isActive: amenity.isActive !== undefined ? amenity.isActive : true,
          displayOrder: amenity.displayOrder || 0
        });
        setEditFormErrors({});
        setShowEditModal(true);
      }
    } catch (error) {
      console.error('Error loading amenity for edit:', error);
    }
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingAmenityId(null);
    setEditFormErrors({});
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name) errors.name = t('amenities.validation.nameRequired');
    return errors;
  };

  const validateEditForm = () => {
    const errors = {};
    if (!editFormData.name) errors.name = t('amenities.validation.nameRequired');
    return errors;
  };

  const submitCreate = async () => {
    const errors = validateForm();
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
    
    setCreating(true);
    try {
      const response = await amenitiesAPI.createAmenity(formData);
      if (response.success) {
        closeCreateModal();
        fetchAmenities();
      } else {
        console.error(response.message);
      }
    } catch (error) {
      console.error('Error creating amenity:', error);
    } finally {
      setCreating(false);
    }
  };

  const submitEdit = async () => {
    const errors = validateEditForm();
    setEditFormErrors(errors);
    if (Object.keys(errors).length) return;
    
    setEditing(true);
    try {
      const response = await amenitiesAPI.updateAmenity(editingAmenityId, editFormData);
      if (response.success) {
        closeEditModal();
        fetchAmenities();
      } else {
        console.error(response.message);
      }
    } catch (error) {
      console.error('Error updating amenity:', error);
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async (amenityId) => {
    if (window.confirm(t('amenities.confirmDelete'))) {
      try {
        await amenitiesAPI.deleteAmenity(amenityId);
        fetchAmenities();
      } catch (error) {
        console.error('Error deleting amenity:', error);
      }
    }
  };

  const getCategoryBadgeClass = (category) => {
    return `category-badge category-${category}`;
  };

  const getStatusBadgeClass = (isActive) => {
    return `status-badge ${isActive ? 'status-active' : 'status-inactive'}`;
  };

  return (
    <>
      <div className="amenities-container">
        <SideBar />
        <div className="amenities-content">
          {/* Header */}
          <div className="amenities-header">
            <h1 className="amenities-title">{t('amenities.title')}</h1>
            <button className="add-amenity-btn" onClick={openCreateModal}>
              <i className="fas fa-plus"></i>
              {t('amenities.addNew')}
            </button>
          </div>

          {/* Filters */}
          <div className="amenities-filters">
            <div className="filters-grid">
              <div className="filter-group">
                <label className="filter-label">{t('amenities.search')}</label>
                <input
                  type="text"
                  className="filter-input"
                  placeholder={t('amenities.searchPlaceholder')}
                  value={searchFilters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
              </div>
              <div className="filter-group">
                <label className="filter-label">{t('amenities.category')}</label>
                <select
                  className="filter-select"
                  value={searchFilters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                >
                  <option value="">{t('amenities.allCategories')}</option>
                  <option value="furniture">{t('amenities.categories.furniture')}</option>
                  <option value="appliance">{t('amenities.categories.appliance')}</option>
                  <option value="utility">{t('amenities.categories.utility')}</option>
                  <option value="service">{t('amenities.categories.service')}</option>
                  <option value="other">{t('amenities.categories.other')}</option>
                </select>
              </div>
              <div className="filter-group">
                <label className="filter-label">{t('amenities.status')}</label>
                <select
                  className="filter-select"
                  value={searchFilters.isActive}
                  onChange={(e) => handleFilterChange('isActive', e.target.value)}
                >
                  <option value="">{t('amenities.allStatuses')}</option>
                  <option value="true">{t('amenities.active')}</option>
                  <option value="false">{t('amenities.inactive')}</option>
                </select>
              </div>
              <div className="filter-group">
                <button className="search-btn" onClick={fetchAmenities}>
                  <i className="fas fa-search"></i> {t('amenities.search')}
                </button>
              </div>
              <div className="filter-group">
                <button className="reset-btn" onClick={resetFilters}>
                  <i className="fas fa-redo"></i> {t('amenities.reset')}
                </button>
              </div>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="category-tabs">
            {Object.entries(categoryLabels).map(([category, label]) => (
              <button
                key={category}
                className={`category-tab ${activeCategory === category ? 'active' : ''}`}
                onClick={() => setActiveCategory(category)}
              >
                {label}
                <span className="tab-count">{categoryCounts[category] || 0}</span>
              </button>
            ))}
          </div>

          {/* Amenities Table */}
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>{t('amenities.loading')}</p>
            </div>
          ) : amenities.length === 0 ? (
            <div className="empty-container">
              <div className="empty-icon">🏷️</div>
              <h3 className="empty-text">{t('amenities.noAmenitiesFound')}</h3>
              <p className="empty-description">{t('amenities.noAmenitiesDescription')}</p>
            </div>
          ) : (
            <div className="amenities-table-container">
              <table className="amenities-table">
                <thead>
                  <tr>
                    <th>{t('amenities.table.amenity')}</th>
                    <th>{t('amenities.table.category')}</th>
                    <th>{t('amenities.table.status')}</th>
                    <th>{t('amenities.table.order')}</th>
                    <th>{t('amenities.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {amenities.map(amenity => (
                    <tr key={amenity._id}>
                      <td>
                        <div className="amenity-info">
                          <div className="amenity-icon">
                            <i className={amenity.icon}></i>
                          </div>
                          <div>
                            <div className="amenity-name">{amenity.name}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={getCategoryBadgeClass(amenity.category)}>
                          {t(`amenities.categories.${amenity.category}`)}
                        </span>
                      </td>
                      <td>
                        <span className={getStatusBadgeClass(amenity.isActive)}>
                          <i className={`fas fa-circle ${amenity.isActive ? '' : 'fa-times'}`}></i>
                          {amenity.isActive ? t('amenities.active') : t('amenities.inactive')}
                        </span>
                      </td>
                      <td>
                        <div className="display-order">{amenity.displayOrder}</div>
                      </td>
                      <td>
                        <div className={`action-menu-container ${openActionMenu === amenity._id ? 'active' : ''}`}>
                          <button
                            className="action-menu-trigger"
                            onClick={(e) => {
                              e.stopPropagation();
                              
                              if (openActionMenu === amenity._id) {
                                setOpenActionMenu(null);
                                return;
                              }
                              
                              // Calculate position for fixed positioning
                              const buttonRect = e.target.getBoundingClientRect();
                              const viewportHeight = window.innerHeight;
                              const dropdownHeight = 120; // Estimated dropdown height
                              
                              let top = buttonRect.bottom + 4;
                              let left = buttonRect.right - 180; // Dropdown width = 180px
                              
                              // If dropdown would go below viewport, show above button
                              if (top + dropdownHeight > viewportHeight) {
                                top = buttonRect.top - dropdownHeight - 4;
                              }
                              
                              // Ensure dropdown doesn't go off left edge
                              if (left < 4) {
                                left = 4;
                              }
                              
                              setDropdownPosition({ top, left });
                              setOpenActionMenu(amenity._id);
                            }}
                          >
                            <i className="fas fa-ellipsis-v"></i>
                          </button>
                          {openActionMenu === amenity._id && (
                            <div 
                              className="action-menu-dropdown fixed-position"
                              style={{
                                position: 'fixed',
                                top: `${dropdownPosition.top}px`,
                                left: `${dropdownPosition.left}px`,
                                zIndex: 2147483647
                              }}
                            >
                              <button
                                className="action-menu-item"
                                onClick={() => {
                                  openEditModal(amenity._id);
                                  setOpenActionMenu(null);
                                }}
                              >
                                <i className="fas fa-edit"></i>
                                {t('amenities.actions.edit')}
                              </button>
                              <button
                                className="action-menu-item danger"
                                onClick={() => {
                                  handleDelete(amenity._id);
                                  setOpenActionMenu(null);
                                }}
                              >
                                <i className="fas fa-trash"></i>
                                {t('amenities.actions.delete')}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {amenities.length > 0 && (
            <div className="pagination">
              <button 
                className="pagination-btn"
                disabled={pagination.currentPage === 1}
                onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
              >
                <i className="fas fa-chevron-left"></i>
              </button>
              
              <span className="pagination-info">
                {t('amenities.pagination.page')} {pagination.currentPage} / {pagination.totalPages} 
                ({pagination.totalItems} {t('amenities.pagination.items')})
              </span>
              
              <button 
                className="pagination-btn"
                disabled={pagination.currentPage === pagination.totalPages}
                onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
              >
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="amenity-modal-backdrop">
          <div className="amenity-modal">
            <div className="amenity-modal-header">
              <h2 className="amenity-modal-title">{t('amenities.form.createTitle')}</h2>
              <button className="amenity-modal-close" onClick={closeCreateModal}>×</button>
            </div>
            <div className="amenity-form-grid">
              <div className="amenity-form-group">
                <label className="amenity-form-label">{t('amenities.form.name')} *</label>
                <input 
                  className="amenity-form-input" 
                  value={formData.name} 
                  onChange={e => handleFormChange('name', e.target.value)} 
                />
                {formErrors.name && <div className="error-text">{formErrors.name}</div>}
              </div>
              <div className="amenity-form-group">
                <label className="amenity-form-label">{t('amenities.form.icon')}</label>
                <div className="icon-picker-container">
                  <button 
                    type="button"
                    className={`icon-picker-trigger ${showIconPicker ? 'active' : ''}`}
                    onClick={() => setShowIconPicker(!showIconPicker)}
                  >
                    <i className={formData.icon}></i>
                    <span>{formData.icon}</span>
                    <i className="fas fa-chevron-down"></i>
                  </button>
                  {showIconPicker && (
                    <div className="icon-picker-dropdown">
                      <div className="icon-picker-grid">
                        {popularIcons.map((iconObj, index) => (
                          <button
                            key={index}
                            type="button"
                            className={`icon-picker-item ${formData.icon === iconObj.class ? 'selected' : ''}`}
                            onClick={() => {
                              handleFormChange('icon', iconObj.class);
                              setShowIconPicker(false);
                            }}
                            title={iconObj.name}
                          >
                            <i className={iconObj.class}></i>
                            <span>{iconObj.name}</span>
                          </button>
                        ))}
                      </div>
                      <div className="icon-picker-footer">
                        <input 
                          className="icon-picker-custom"
                          placeholder="Nhập tên icon tùy chỉnh (vd: fas fa-home)"
                          value={formData.icon}
                          onChange={e => handleFormChange('icon', e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="amenity-form-group">
                <label className="amenity-form-label">{t('amenities.form.category')}</label>
                <select 
                  className="amenity-form-select" 
                  value={formData.category} 
                  onChange={e => handleFormChange('category', e.target.value)}
                >
                  <option value="furniture">{t('amenities.categories.furniture')}</option>
                  <option value="appliance">{t('amenities.categories.appliance')}</option>
                  <option value="utility">{t('amenities.categories.utility')}</option>
                  <option value="service">{t('amenities.categories.service')}</option>
                  <option value="other">{t('amenities.categories.other')}</option>
                </select>
              </div>
              <div className="amenity-form-group">
                <label className="amenity-form-label">{t('amenities.form.displayOrder')}</label>
                <input 
                  type="number" 
                  className="amenity-form-input" 
                  value={formData.displayOrder} 
                  onChange={e => handleFormChange('displayOrder', parseInt(e.target.value) || 0)} 
                />
              </div>
              <div className="amenity-form-group">
                <label className="amenity-form-label">{t('amenities.form.status')}</label>
                <select 
                  className="amenity-form-select" 
                  value={formData.isActive} 
                  onChange={e => handleFormChange('isActive', e.target.value === 'true')}
                >
                  <option value="true">{t('amenities.active')}</option>
                  <option value="false">{t('amenities.inactive')}</option>
                </select>
              </div>
              <div className="amenity-form-group full">
                <label className="amenity-form-label">{t('amenities.form.description')}</label>
                <textarea 
                  className="amenity-form-textarea" 
                  value={formData.description} 
                  onChange={e => handleFormChange('description', e.target.value)} 
                />
              </div>
            </div>
            <div className="amenity-modal-footer">
              <button className="btn-secondary" onClick={closeCreateModal}>{t('amenities.form.cancel')}</button>
              <button 
                className="btn-primary" 
                disabled={creating} 
                onClick={submitCreate}
              >
                {creating ? t('amenities.form.creating') : t('amenities.form.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="amenity-modal-backdrop">
          <div className="amenity-modal">
            <div className="amenity-modal-header">
              <h2 className="amenity-modal-title">{t('amenities.form.editTitle')}</h2>
              <button className="amenity-modal-close" onClick={closeEditModal}>×</button>
            </div>
            <div className="amenity-form-grid">
              <div className="amenity-form-group">
                <label className="amenity-form-label">{t('amenities.form.name')} *</label>
                <input 
                  className="amenity-form-input" 
                  value={editFormData.name} 
                  onChange={e => handleEditFormChange('name', e.target.value)} 
                />
                {editFormErrors.name && <div className="error-text">{editFormErrors.name}</div>}
              </div>
              <div className="amenity-form-group">
                <label className="amenity-form-label">{t('amenities.form.icon')}</label>
                <div className="icon-picker-container">
                  <button 
                    type="button"
                    className={`icon-picker-trigger ${showEditIconPicker ? 'active' : ''}`}
                    onClick={() => setShowEditIconPicker(!showEditIconPicker)}
                  >
                    <i className={editFormData.icon}></i>
                    <span>{editFormData.icon}</span>
                    <i className="fas fa-chevron-down"></i>
                  </button>
                  {showEditIconPicker && (
                    <div className="icon-picker-dropdown">
                      <div className="icon-picker-grid">
                        {popularIcons.map((iconObj, index) => (
                          <button
                            key={index}
                            type="button"
                            className={`icon-picker-item ${editFormData.icon === iconObj.class ? 'selected' : ''}`}
                            onClick={() => {
                              handleEditFormChange('icon', iconObj.class);
                              setShowEditIconPicker(false);
                            }}
                            title={iconObj.name}
                          >
                            <i className={iconObj.class}></i>
                            <span>{iconObj.name}</span>
                          </button>
                        ))}
                      </div>
                      <div className="icon-picker-footer">
                        <input 
                          className="icon-picker-custom"
                          placeholder="Nhập tên icon tùy chỉnh (vd: fas fa-home)"
                          value={editFormData.icon}
                          onChange={e => handleEditFormChange('icon', e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="amenity-form-group">
                <label className="amenity-form-label">{t('amenities.form.category')}</label>
                <select 
                  className="amenity-form-select" 
                  value={editFormData.category} 
                  onChange={e => handleEditFormChange('category', e.target.value)}
                >
                  <option value="furniture">{t('amenities.categories.furniture')}</option>
                  <option value="appliance">{t('amenities.categories.appliance')}</option>
                  <option value="utility">{t('amenities.categories.utility')}</option>
                  <option value="service">{t('amenities.categories.service')}</option>
                  <option value="other">{t('amenities.categories.other')}</option>
                </select>
              </div>
              <div className="amenity-form-group">
                <label className="amenity-form-label">{t('amenities.form.displayOrder')}</label>
                <input 
                  type="number" 
                  className="amenity-form-input" 
                  value={editFormData.displayOrder} 
                  onChange={e => handleEditFormChange('displayOrder', parseInt(e.target.value) || 0)} 
                />
              </div>
              <div className="amenity-form-group">
                <label className="amenity-form-label">{t('amenities.form.status')}</label>
                <select 
                  className="amenity-form-select" 
                  value={editFormData.isActive} 
                  onChange={e => handleEditFormChange('isActive', e.target.value === 'true')}
                >
                  <option value="true">{t('amenities.active')}</option>
                  <option value="false">{t('amenities.inactive')}</option>
                </select>
              </div>
              <div className="amenity-form-group full">
                <label className="amenity-form-label">{t('amenities.form.description')}</label>
                <textarea 
                  className="amenity-form-textarea" 
                  value={editFormData.description} 
                  onChange={e => handleEditFormChange('description', e.target.value)} 
                />
              </div>
            </div>
            <div className="amenity-modal-footer">
              <button className="btn-secondary" onClick={closeEditModal}>{t('amenities.form.cancel')}</button>
              <button 
                className="btn-primary" 
                disabled={editing} 
                onClick={submitEdit}
              >
                {editing ? t('amenities.form.updating') : t('amenities.form.update')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AmenitiesManagement;