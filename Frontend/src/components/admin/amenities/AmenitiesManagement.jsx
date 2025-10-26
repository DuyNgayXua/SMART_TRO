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
  const [categoryCounts, setCategoryCounts] = useState({ all: 0, furniture: 0, appliance: 0, utility: 0, service: 0, other: 0 });
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
      }
    } catch (error) {
      console.error('Error loading amenities:', error);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, searchFilters, pagination.currentPage, pagination.itemsPerPage]);

  // Separate function to fetch category counts
  const fetchCategoryCounts = useCallback(async () => {
    try {
      const params = {
        search: searchFilters.search || undefined,
        isActive: searchFilters.isActive !== '' ? searchFilters.isActive === 'true' : undefined
      };
      
      const response = await amenitiesAPI.getAmenities(params);
      if (response.success) {
        const allAmenities = response.data.amenities || [];
        const counts = {
          all: allAmenities.length,
          furniture: allAmenities.filter(a => a.category === 'furniture').length,
          appliance: allAmenities.filter(a => a.category === 'appliance').length,
          utility: allAmenities.filter(a => a.category === 'utility').length,
          service: allAmenities.filter(a => a.category === 'service').length,
          other: allAmenities.filter(a => a.category === 'other').length
        };
        setCategoryCounts(counts);
      }
    } catch (error) {
      console.error('Error loading category counts:', error);
    }
  }, [searchFilters.search, searchFilters.isActive]);

  useEffect(() => {
    fetchAmenities();
  }, [fetchAmenities]);

  useEffect(() => {
    fetchCategoryCounts();
  }, [fetchCategoryCounts]);

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
        fetchCategoryCounts();
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
        fetchCategoryCounts();
      } else {
        console.error(response.message);
      }
    } catch (error) {
      console.error('Error updating amenity:', error);
    } finally {
      setEditing(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      if (!window.XLSX) {
        alert('Thư viện Excel chưa được tải');
        return;
      }

      // Fetch all amenities without pagination
      const response = await amenitiesAPI.getAmenities({ limit: 10000 });
      
      if (!response.success || !response.data.amenities || response.data.amenities.length === 0) {
        alert('Không có dữ liệu để xuất');
        return;
      }

      const allAmenities = response.data.amenities;

      // Prepare data for export
      const exportData = allAmenities.map((amenity, index) => {
        const categoryMap = {
          furniture: 'Nội thất',
          appliance: 'Thiết bị',
          utility: 'Tiện ích',
          service: 'Dịch vụ',
          other: 'Khác'
        };

        return {
          'STT': index + 1,
          'Tên tiện ích': amenity.name || '-',
          'Key': amenity.key || '-',
          'Danh mục': categoryMap[amenity.category] || amenity.category || '-',
          'Icon': amenity.icon || '-',
          'Mô tả': amenity.description || '-',
          'Trạng thái': amenity.isActive ? 'Đang hoạt động' : 'Không hoạt động',
          'Thứ tự hiển thị': amenity.displayOrder || 0
        };
      });

      // Create worksheet
      const ws = window.XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 5 },  // STT
        { wch: 25 }, // Tên tiện ích
        { wch: 20 }, // Key
        { wch: 15 }, // Danh mục
        { wch: 20 }, // Icon
        { wch: 40 }, // Mô tả
        { wch: 18 }, // Trạng thái
        { wch: 15 }  // Thứ tự hiển thị
      ];
      ws['!cols'] = colWidths;

      // Create workbook
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Danh sách tiện ích');

      // Generate filename with current date
      const today = new Date();
      const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
      const filename = `Danh_sach_tien_ich_${dateStr}.xlsx`;

      // Save file
      window.XLSX.writeFile(wb, filename);

      alert(t('amenities.exportSuccess', 'Xuất Excel thành công!'));
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert(t('amenities.exportError', 'Lỗi khi xuất Excel: ') + error.message);
    }
  };

  const handleDelete = async (amenityId) => {
    if (window.confirm(t('amenities.confirmDelete'))) {
      try {
        await amenitiesAPI.deleteAmenity(amenityId);
        fetchAmenities();
        fetchCategoryCounts();
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

  // Pagination helper function (like payments management)
  const getPaginationRange = () => {
    const { currentPage, totalPages } = pagination;
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    range.forEach((i) => {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    });

    return rangeWithDots;
  };

  return (
    <>
      <div className="amenities-container">
        <SideBar />
        <div className="amenities-content">
          {/* Header */}
          <div className="amenities-header">
            <h1 className="amenities-title">{t('amenities.title')}</h1>
            
            {/* Search Bar */}
            <div className="search-container">
              <div className="search-input-wrapper">
                <i className="fas fa-search search-icon"></i>
                <input
                  type="text"
                  className="search-input"
                  placeholder={t('amenities.searchPlaceholder', 'Tìm kiếm tiện ích...')}
                  value={searchFilters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
                {searchFilters.search && (
                  <button 
                    className="clear-search-btn"
                    onClick={() => handleFilterChange('search', '')}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="status-tabs">
            {Object.entries(categoryLabels).map(([category, label]) => (
              <button
                key={category}
                className={`status-tab ${activeCategory === category ? 'active' : ''}`}
                onClick={() => {
                  setActiveCategory(category);
                  setPagination(prev => ({ ...prev, currentPage: 1 }));
                }}
              >
                {label}
                <span className="tab-count">{categoryCounts[category] || 0}</span>
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="amenities-actions">
            <button className="action-btn primary" onClick={openCreateModal}>
              <i className="fas fa-plus"></i>
              {t('amenities.addNew', 'Thêm tiện ích mới')}
            </button>
            <button className="action-btn" onClick={handleExportExcel}>
              <i className="fas fa-file-excel"></i>
              {t('amenities.exportExcel', 'Xuất Excel')}
            </button>
            <div className="date-filter-group">
            </div>
            <div className="date-filter-group">
            </div>
            <div className="date-filter-group">
            </div>
            <div className="date-filter-group">
            </div>
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
          {amenities.length > 0 && pagination.totalPages > 1 && (
            <div className="pagination">
              {/* Pagination Info */}
              <div className="pagination-info">
                <span className="pagination-text">
                  {t('amenities.pagination.page', 'Trang')} {pagination.currentPage} / {pagination.totalPages} 
                  ({pagination.totalItems} {t('amenities.pagination.items', 'tiện ích')})
                </span>
              </div>

              <div className="pagination-controls">
                {/* First Page Button */}
                <button
                  className="pagination-btn"
                  disabled={pagination.currentPage === 1}
                  onClick={() => setPagination(p => ({ ...p, currentPage: 1 }))}
                  title={t('amenities.pagination.firstPage', 'Trang đầu')}
                >
                  <i className="fas fa-angle-double-left" />
                </button>

                {/* Previous Page Button */}
                <button
                  className="pagination-btn"
                  disabled={pagination.currentPage === 1}
                  onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage - 1 }))}
                  title={t('amenities.pagination.previousPage', 'Trang trước')}
                >
                  <i className="fas fa-chevron-left" />
                </button>
                
                {/* Page Numbers */}
                <div className="pagination-numbers">
                  {getPaginationRange().map((page, index) => (
                    page === '...' ? (
                      <span key={index} className="pagination-dots">...</span>
                    ) : (
                      <button
                        key={index}
                        className={`pagination-number ${pagination.currentPage === page ? 'active' : ''}`}
                        onClick={() => setPagination(p => ({ ...p, currentPage: page }))}
                        title={`${t('amenities.pagination.page', 'Trang')} ${page}`}
                      >
                        {page}
                      </button>
                    )
                  ))}
                </div>
                
                {/* Next Page Button */}
                <button
                  className="pagination-btn"
                  disabled={pagination.currentPage === pagination.totalPages}
                  onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage + 1 }))}
                  title={t('amenities.pagination.nextPage', 'Trang sau')}
                >
                  <i className="fas fa-chevron-right" />
                </button>

                {/* Last Page Button */}
                <button
                  className="pagination-btn"
                  disabled={pagination.currentPage === pagination.totalPages}
                  onClick={() => setPagination(p => ({ ...p, currentPage: pagination.totalPages }))}
                  title={t('amenities.pagination.lastPage', 'Trang cuối')}
                >
                  <i className="fas fa-angle-double-right" />
                </button>
              </div>
            </div>
          )}

          {/* Fallback pagination info nếu chỉ có 1 trang */}
          {amenities.length > 0 && pagination.totalPages <= 1 && (
            <div style={{textAlign: 'center', padding: '20px', color: '#666'}}>
              {t('amenities.pagination.allShown', 'Tất cả')} {pagination.totalItems} {t('amenities.pagination.items', 'tiện ích')} {t('amenities.pagination.displayed', 'đã được hiển thị')}
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