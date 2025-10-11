import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import SideBar from '../../common/adminSidebar';
import { useToast } from '../../../hooks/useToast';
import '../admin-global.css';
import './tenants.css';
import tenantsAPI from '../../../services/tenantsAPI';
import { roomsAPI } from '../../../services/roomsAPI';

const TenantsManagement = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [roomsWithTenants, setRoomsWithTenants] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [form, setForm] = useState({ fullName:'', email:'', phone:'', address:'', identificationNumber:'', roomId:'', role:'tenant', tenantImages:[] });
  const [editForm, setEditForm] = useState({ fullName:'', email:'', phone:'', address:'', identificationNumber:'', isActive:true, role:'tenant', tenantImages:[] });
  const [deletedImageUrls, setDeletedImageUrls] = useState([]); // Track deleted image URLs
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [pagination, setPagination] = useState({ currentPage:1, totalPages:1, totalItems:0, itemsPerPage:12 });
  const [filters, setFilters] = useState({ search:'', status:'', role:'tenant' });
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchRoomsWithTenants = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all rooms first
      const roomsRes = await roomsAPI.getAllRooms({
        page: pagination.currentPage,
        limit: pagination.itemsPerPage,
        search: filters.search || undefined
      });
      
      if (roomsRes.success) {
        const rooms = roomsRes.data.rooms || [];
        
        // For each room, get ALL tenants (not just current one)
        const roomsWithTenantsData = await Promise.all(
          rooms.map(async (room) => {
            try {
              const tenantsRes = await tenantsAPI.getTenantsByRoom(room._id, { isActive: true });
              const tenants = tenantsRes.success ? (tenantsRes.data || []) : [];
              
              return {
                id: room._id,
                name: room.roomNumber,
                status: room.status,
                price: room.price,
                area: room.area,
                capacity: room.capacity,
                description: room.description,
                tenants: Array.isArray(tenants) ? tenants : (tenants ? [tenants] : []),
                isOccupied: tenants && (Array.isArray(tenants) ? tenants.length > 0 : true)
              };
            } catch (error) {
              console.error(`Error fetching tenants for room ${room.roomNumber}:`, error);
              return {
                id: room._id,
                name: room.roomNumber,
                status: room.status,
                price: room.price,
                area: room.area,
                capacity: room.capacity,
                description: room.description,
                tenants: [],
                isOccupied: false
              };
            }
          })
        );

        // Apply filters
        let filteredRooms = roomsWithTenantsData;
        if (filters.status === 'occupied') {
          filteredRooms = roomsWithTenantsData.filter(room => room.isOccupied);
        } else if (filters.status === 'vacant') {
          filteredRooms = roomsWithTenantsData.filter(room => !room.isOccupied);
        }

        setRoomsWithTenants(filteredRooms);
        
        const pag = roomsRes.data?.pagination || { total: filteredRooms.length, pages:1 };
        setPagination(p => ({ ...p, totalItems: pag.total, totalPages: pag.pages || 1 }));
      }
    } catch(e){ 
      console.error('Error fetching rooms with tenants:', e); 
    }
    finally { setLoading(false); }
  }, [filters, pagination.currentPage, pagination.itemsPerPage]);

  useEffect(()=>{ fetchRoomsWithTenants(); }, [fetchRoomsWithTenants]);

  const fetchAvailableRooms = async () => {
    try {
      const res = await roomsAPI.getAllRooms({});
      if (res.success) {
        const allRooms = res.data.rooms || [];
        
        // Lấy TẤT CẢ tenant đang hoạt động của mỗi phòng
        const roomsWithSlots = await Promise.all(
          allRooms.map(async (room) => {
            try {
              const tenantsRes = await tenantsAPI.getTenantsByRoom(room._id, { isActive: true });
              const currentTenants = tenantsRes.success ? (Array.isArray(tenantsRes.data) ? tenantsRes.data : (tenantsRes.data ? [tenantsRes.data] : [])) : [];
              const currentCount = currentTenants.length;
              const capacity = room.capacity || 1;
              const availableSlots = capacity - currentCount;
              
              return {
                ...room,
                currentCount,
                availableSlots,
                hasSlots: availableSlots > 0,
                hasContract: currentCount > 0 // Phòng có hợp đồng nếu đã có tenant
              };
            } catch (error) {
              console.error(`Error fetching tenants for room ${room.roomNumber}:`, error);
              return {
                ...room,
                currentCount: 0,
                availableSlots: room.capacity || 1,
                hasSlots: false,
                hasContract: false
              };
            }
          })
        );
        
        // CHỈ lấy phòng đã có hợp đồng (đã có tenant) VÀ còn slot
        const roomsWithAvailableSlots = roomsWithSlots.filter(room => room.hasContract && room.hasSlots);
        setAvailableRooms(roomsWithAvailableSlots);
      }
    } catch(e) {
      console.error('Error fetching available rooms:', e);
    }
  };

  const openCreate = async () => { 
    setForm({ fullName:'', email:'', phone:'', address:'', identificationNumber:'', roomId:'', role:'tenant', tenantImages:[] }); 
    setErrors({}); 
    await fetchAvailableRooms();
    setShowCreateModal(true); 
  };
  const closeCreate = () => { setShowCreateModal(false); };
  const openEdit = async (id) => {
    try {
      const res = await tenantsAPI.getTenantById(id);
      if (res.success) {
        const u = res.data;
        setEditingId(id);
        setDeletedImageUrls([]); // Reset deleted images list
        setEditForm({
          _id: u._id || id,
          fullName: u.fullName || '',
          email: u.email || '',
          phone: u.phone || '',
          address: u.address || '',
          identificationNumber: u.identificationNumber || '',
          isActive: u.isActive !== false,
          role: u.role || 'tenant',
          room: u.room || null,
          tenantImages: (u.images || []).map(url => 
            typeof url === 'string' ? { url, isExisting: true } : url
          )
        });
        setErrors({});
        setShowEditModal(true);
      }
    } catch(e){ console.error(e); }
  };
  const closeEdit = () => { setShowEditModal(false); setEditingId(null); };

  // Handle image upload for create form
  const handleCreateImageUpload = (files) => {
    if (files && files.length > 0) {
      const currentImages = form.tenantImages || [];
      const newImages = Array.from(files);
      const combinedImages = [...currentImages, ...newImages];
      const limitedImages = combinedImages.slice(0, 5);
      setForm(prev => ({ ...prev, tenantImages: limitedImages }));
    }
  };

  // Handle image upload for edit form
  const handleEditImageUpload = (files) => {
    if (files && files.length > 0) {
      const currentImages = editForm.tenantImages || [];
      const newImages = Array.from(files).map(file => ({ file, isExisting: false }));
      const combinedImages = [...currentImages, ...newImages];
      const limitedImages = combinedImages.slice(0, 5);
      setEditForm(prev => ({ ...prev, tenantImages: limitedImages }));
    }
  };

  // Remove image from create form
  const removeCreateImage = (imageIndex) => {
    const updatedImages = form.tenantImages.filter((_, idx) => idx !== imageIndex);
    setForm(prev => ({ ...prev, tenantImages: updatedImages }));
  };

  // Remove image from edit form
  const removeEditImage = (imageIndex) => {
    const imageToRemove = editForm.tenantImages[imageIndex];
    
    // If it's an existing image (from server), track it for deletion
    if (imageToRemove && imageToRemove.isExisting && imageToRemove.url) {
      setDeletedImageUrls(prev => [...prev, imageToRemove.url]);
    }
    
    const updatedImages = editForm.tenantImages.filter((_, idx) => idx !== imageIndex);
    setEditForm(prev => ({ ...prev, tenantImages: updatedImages }));
  };

  const validate = () => {
    const err = {};
    if(!form.fullName) err.fullName = t('validation.required');
    if(!form.email) err.email = t('validation.required');
    if(!form.phone) err.phone = t('validation.required');
    if(!form.roomId) err.roomId = t('tenants.form.selectRoom', 'Vui lòng chọn phòng');
    return err;
  };

  const submitCreate = async () => {
    const err = validate();
    setErrors(err);
    if(Object.keys(err).length) return;
    setSaving(true);
    try {
      // Get selected room info for rentPrice
      const selectedRoomInfo = availableRooms.find(r => r._id === form.roomId);
      
      const payload = { 
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        address: form.address,
        identificationNumber: form.identificationNumber,
        role: form.role,
        room: form.roomId,
        status: 'active',
        leaseStart: new Date().toISOString().split('T')[0],
        rentPrice: selectedRoomInfo?.price || 0,
        deposit: 0
      };
      const res = await tenantsAPI.createTenant(payload);
      if (res.success) {
        const createdTenant = res.data;
        
        // Upload images if any
        if (form.tenantImages && form.tenantImages.length > 0) {
          try {
            const uploadRes = await tenantsAPI.uploadTenantImages(createdTenant._id, form.tenantImages);
            if (!uploadRes.success) {
              showToast('warning', t('tenants.messages.addSuccessButImagesFailed', 'Tạo khách thuê thành công nhưng upload ảnh thất bại'));
            }
          } catch (uploadErr) {
            console.error('Error uploading images:', uploadErr);
            showToast('warning', t('tenants.messages.addSuccessButImagesFailed', 'Tạo khách thuê thành công nhưng upload ảnh thất bại'));
          }
        }
        
        showToast('success', t('tenants.messages.addSuccess', 'Tạo khách thuê thành công!'));
        closeCreate();
        fetchRoomsWithTenants();
      } else {
        showToast('error', res.message || 'Lỗi khi tạo khách thuê');
      }
    } catch(e){ 
      console.error(e);
      showToast('error', 'Lỗi khi tạo khách thuê');
    }
    finally { setSaving(false); }
  };

  const submitEdit = async () => {
    setUpdating(true);
    try {
      const payload = { 
        fullName: editForm.fullName, 
        email: editForm.email,
        phone: editForm.phone, 
        address: editForm.address,
        identificationNumber: editForm.identificationNumber,
        isActive: editForm.isActive
      };
      
      // Add remaining existing image URLs to payload
      const remainingImages = (editForm.tenantImages || [])
        .filter(img => img.isExisting && img.url)
        .map(img => img.url);
      
      if (remainingImages.length > 0 || deletedImageUrls.length > 0) {
        payload.images = remainingImages; // Backend should update to keep only these images
      }
      
      const res = await tenantsAPI.updateTenant(editingId, payload);
      if (res.success) {
        // Upload new images if any
        const newImages = (editForm.tenantImages || []).filter(img => !img.isExisting && img.file);
        if (newImages.length > 0) {
          try {
            const uploadRes = await tenantsAPI.uploadTenantImages(editingId, newImages.map(img => img.file));
            if (!uploadRes.success) {
              showToast('warning', 'Cập nhật khách thuê thành công nhưng upload ảnh thất bại');
            }
          } catch (uploadErr) {
            console.error('Error uploading images:', uploadErr);
            showToast('warning', 'Cập nhật khách thuê thành công nhưng upload ảnh thất bại');
          }
        }
        
        showToast('success', 'Cập nhật khách thuê thành công!');
        closeEdit();
        fetchRoomsWithTenants();
      } else {
        showToast('error', res.message || 'Lỗi khi cập nhật khách thuê');
      }
    } catch(e){ 
      console.error(e);
      showToast('error', 'Lỗi khi cập nhật khách thuê');
    }
    finally { setUpdating(false); }
  };

  const handleDeleteTenant = async () => {
    console.log('Delete button clicked, editForm:', editForm);
    
    if (!editForm._id) {
      showToast('error', 'Không tìm thấy thông tin khách thuê');
      return;
    }
    
    if (!editForm.room) {
      showToast('error', 'Không tìm thấy thông tin phòng');
      return;
    }
    
    setUpdating(true);
    try {
      // Kiểm tra số lượng khách thuê trong phòng
      const roomId = typeof editForm.room === 'object' ? editForm.room._id : editForm.room;
      console.log('Checking room:', roomId);
      
      const tenantsRes = await tenantsAPI.getTenantsByRoom(roomId, { isActive: true });
      const activeTenants = tenantsRes.success ? (Array.isArray(tenantsRes.data) ? tenantsRes.data : []) : [];
      
      console.log('Active tenants in room:', activeTenants);
      
      if (activeTenants.length <= 1) {
        showToast('error', 'Không thể xóa! Phòng phải có ít nhất 1 khách thuê. Nếu muốn xóa, vui lòng kết thúc hợp đồng.');
        setUpdating(false);
        return;
      }
      
      // Hiển thị confirm dialog
      console.log('Showing confirm dialog');
      setShowDeleteConfirm(true);
      setUpdating(false);
    } catch (e) {
      console.error('Error in handleDeleteTenant:', e);
      showToast('error', 'Lỗi khi kiểm tra thông tin phòng');
      setUpdating(false);
    }
  };

  const confirmDeleteTenant = async () => {
    setShowDeleteConfirm(false);
    setUpdating(true);
    
    try {
      const res = await tenantsAPI.deleteTenant(editForm._id);
      if (res.success) {
        showToast('success', 'Xóa khách thuê thành công!');
        closeEdit();
        fetchRoomsWithTenants();
      } else {
        showToast('error', res.message || 'Lỗi khi xóa khách thuê');
      }
    } catch (e) {
      console.error(e);
      showToast('error', 'Lỗi khi xóa khách thuê');
    } finally {
      setUpdating(false);
    }
  };

  const cancelDeleteTenant = () => {
    setShowDeleteConfirm(false);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'available': return 'status-badge status-available';
      case 'rented': return 'status-badge status-rented';
      case 'reserved': return 'status-badge status-reserved';
      case 'maintenance': return 'status-badge status-maintenance';
      default: return 'status-badge';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'available': return t('rooms.status.available', 'Trống');
      case 'rented': return t('rooms.status.rented', 'Đã thuê');
      case 'reserved': return t('rooms.status.reserved', 'Đã đặt');
      case 'maintenance': return t('rooms.status.maintenance', 'Bảo trì');
      default: return status;
    }
  };

  return (
    <div className="tenants-container">
      <SideBar />
      <div className="tenants-content">
        <div className="tenants-header">
          <h1 className="tenants-title">{t('tenants.title')}</h1>
          <button className="add-tenant-btn" onClick={openCreate}><i className="fas fa-user-plus" /> {t('tenants.addNew')}</button>
        </div>

        <div className="tenants-filters">
          <div className="filters-grid">
            <div className="filter-group">
              <label className="filter-label">{t('common.search')}</label>
              <input className="filter-input" value={filters.search} onChange={e=>{ setFilters(f=>({...f,search:e.target.value})); setPagination(p=>({...p,currentPage:1})); }} placeholder={t('tenants.searchPlaceholder')} />
            </div>
            <div className="filter-group">
              <label className="filter-label">{t('common.filter')}</label>
              <select className="filter-select" value={filters.status} onChange={e=>{ setFilters(f=>({...f,status:e.target.value})); setPagination(p=>({...p,currentPage:1})); }}>
                <option value="">{t('common.all')}</option>
                <option value="active">{t('status.active', { defaultValue:'Active' })}</option>
                <option value="inactive">{t('status.inactive', { defaultValue:'Inactive' })}</option>
              </select>
            </div>
            <div className="filter-group">
              <button className="search-btn" onClick={fetchRoomsWithTenants}><i className="fas fa-search" /> {t('common.search')}</button>
            </div>
            <div className="filter-group">
              <button className="reset-btn" onClick={()=>{ setFilters({ search:'', status:'', role:'tenant' }); setPagination(p=>({...p,currentPage:1})); }}><i className="fas fa-redo" /> {t('common.reset')}</button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-container"><div className="loading-spinner" /> <p>{t('common.loading')}</p></div>
        ) : roomsWithTenants.length === 0 ? (
          <div className="empty-container">
            <div className="empty-icon">🏠</div>
            <h3 className="empty-text">{t('tenants.noRooms', 'Không có phòng nào')}</h3>
            <p className="empty-description">{t('tenants.noRoomsDescription', 'Hãy tạo phòng trước khi quản lý khách thuê')}</p>
          </div>
        ) : (
          <div className="tenants-grid">
            {roomsWithTenants.map(room => (
              <div key={room.id} className={`tenant-room-card ${room.isOccupied ? 'occupied' : 'vacant'}`}>
                {/* Room Header */}
                <div className="tenant-room-header">
                  <div className="tenant-room-icon">
                    <i className="fas fa-door-open"></i>
                  </div>
                  <div className="tenant-room-info">
                    <h3 className="tenant-room-name">Phòng {room.name}</h3>
                    <span className={getStatusBadgeClass(room.status)}>
                      {getStatusText(room.status)}
                    </span>
                  </div>
                  <span className="tenant-count-badge">
                    {room.tenants.length}/{room.capacity}
                  </span>
                </div>

                {/* Tenants List */}
                <div className="tenant-room-content">
                  {room.tenants.length === 0 ? (
                    <div className="tenant-empty-state">
                      <span>Chưa có khách thuê</span>
                    </div>
                  ) : (
                    <div className="tenant-list">
                      {room.tenants.map(tenant => (
                        <div key={tenant._id || tenant.id} className="tenant-item">
                          <div className="tenant-avatar">
                            {tenant.avatar ? (
                              <img src={tenant.avatar} alt={tenant.fullName} />
                            ) : (
                              <div className="tenant-avatar-placeholder">
                                {tenant.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="tenant-info">
                            <div className="tenant-name">{tenant.fullName}</div>
                            <div className="tenant-contact">
                              {tenant.phone}
                            </div>
                          </div>
                          <button 
                            className="tenant-edit-btn"
                            onClick={() => openEdit(tenant._id || tenant.id)}
                            title="Chỉnh sửa"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {roomsWithTenants.length > 0 && (
          <div className="pagination">
            <button className="pagination-btn" disabled={pagination.currentPage===1} onClick={()=>setPagination(p=>({...p,currentPage:p.currentPage-1}))}><i className="fas fa-chevron-left" /></button>
            <span className="pagination-info">{t('rooms.pagination.page')} {pagination.currentPage} / {pagination.totalPages} ({pagination.totalItems})</span>
            <button className="pagination-btn" disabled={pagination.currentPage===pagination.totalPages} onClick={()=>setPagination(p=>({...p,currentPage:p.currentPage+1}))}><i className="fas fa-chevron-right" /></button>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="tenant-modal-backdrop" onClick={closeCreate}>
          <div className="tenant-modal" onClick={e => e.stopPropagation()}>
            <div className="tenant-modal-header">
              <div className="tenant-modal-title-wrapper">
                <div className="tenant-modal-icon">
                  <i className="fas fa-user-plus"></i>
                </div>
                <h2 className="tenant-modal-title">{t('tenants.createTitle')}</h2>
              </div>
              <button className="tenant-modal-close" onClick={closeCreate}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="tenant-modal-body">
              <div className="tenant-form-grid">
                <div className="tenant-form-group">
                  <label className="tenant-form-label">
                    <i className="fas fa-user"></i>
                    {t('form.fullName')}
                  </label>
                  <input 
                    className={`tenant-form-input ${errors.fullName ? 'error' : ''}`}
                    value={form.fullName} 
                    onChange={e=>setForm(f=>({...f,fullName:e.target.value}))} 
                    placeholder="Nhập họ và tên"
                  />
                  {errors.fullName && <span className="tenant-error-text">{errors.fullName}</span>}
                </div>
                <div className="tenant-form-group">
                  <label className="tenant-form-label">
                    <i className="fas fa-envelope"></i>
                    Email
                  </label>
                  <input 
                    className={`tenant-form-input ${errors.email ? 'error' : ''}`}
                    value={form.email} 
                    onChange={e=>setForm(f=>({...f,email:e.target.value}))} 
                    placeholder="example@email.com"
                  />
                  {errors.email && <span className="tenant-error-text">{errors.email}</span>}
                </div>
                <div className="tenant-form-group">
                  <label className="tenant-form-label">
                    <i className="fas fa-phone"></i>
                    {t('form.phone')}
                  </label>
                  <input 
                    className={`tenant-form-input ${errors.phone ? 'error' : ''}`}
                    value={form.phone} 
                    onChange={e=>setForm(f=>({...f,phone:e.target.value}))} 
                    placeholder="0123456789"
                  />
                  {errors.phone && <span className="tenant-error-text">{errors.phone}</span>}
                </div>
                <div className="tenant-form-group">
                  <label className="tenant-form-label">
                    <i className="fas fa-door-open"></i>
                    Phòng
                  </label>
                  <select
                    className={`tenant-form-select ${errors.roomId ? 'error' : ''}`}
                    value={form.roomId}
                    onChange={e=>setForm(f=>({...f,roomId:e.target.value}))}
                  >
                    <option value="">-- Chọn phòng --</option>
                    {availableRooms.length === 0 ? (
                      <option disabled>Không có phòng nào còn chỗ trống (phòng trống cần tạo hợp đồng trước)</option>
                    ) : (
                      availableRooms.map(room => (
                        <option key={room._id} value={room._id}>
                          {room.roomNumber} - Còn {room.availableSlots}/{room.capacity} chỗ
                        </option>
                      ))
                    )}
                  </select>
                  {errors.roomId && <span className="tenant-error-text">{errors.roomId}</span>}
                </div>
                <div className="tenant-form-group">
                  <label className="tenant-form-label">
                    <i className="fas fa-id-card"></i>
                    CCCD/CMND
                  </label>
                  <input 
                    className="tenant-form-input"
                    value={form.identificationNumber} 
                    onChange={e=>setForm(f=>({...f,identificationNumber:e.target.value}))} 
                    placeholder="Nhập số CCCD/CMND"
                  />
                </div>
                <div className="tenant-form-group full">
                  <label className="tenant-form-label">
                    <i className="fas fa-map-marker-alt"></i>
                    {t('form.address')}
                  </label>
                  <textarea 
                    className="tenant-form-textarea" 
                    value={form.address} 
                    onChange={e=>setForm(f=>({...f,address:e.target.value}))} 
                    placeholder="Nhập địa chỉ"
                    rows="3"
                  />
                </div>
                
                {/* Image Upload Section */}
                <div className="tenant-form-group full">
                  <label className="tenant-form-label">
                    <i className="fas fa-images"></i>
                    Hình ảnh (Tối đa 5 ảnh)
                  </label>
                  <div className="tenant-image-upload-container">
                    <input
                      type="file"
                      id="create-tenant-images"
                      accept="image/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => handleCreateImageUpload(e.target.files)}
                    />
                    <label htmlFor="create-tenant-images" className="tenant-image-upload-btn">
                      <i className="fas fa-cloud-upload-alt"></i>
                      <span>Chọn ảnh</span>
                    </label>
                    
                    {form.tenantImages && form.tenantImages.length > 0 && (
                      <div className="tenant-image-preview-grid">
                        {form.tenantImages.map((image, idx) => (
                          <div key={idx} className="tenant-image-preview-item">
                            <img 
                              src={URL.createObjectURL(image)} 
                              alt={`Preview ${idx + 1}`}
                            />
                            <button
                              type="button"
                              className="tenant-image-remove-btn"
                              onClick={() => removeCreateImage(idx)}
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <span className="tenant-form-hint">
                      {form.tenantImages?.length || 0}/5 ảnh
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="tenant-modal-footer">
              <button className="tenant-btn-cancel" onClick={closeCreate}>
                <i className="fas fa-times"></i>
                {t('common.cancel')}
              </button>
              <button className="tenant-btn-submit" disabled={saving} onClick={submitCreate}>
                <i className="fas fa-check"></i>
                {saving ? t('rooms.form.creating') : t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="tenant-modal-backdrop" onClick={closeEdit}>
          <div className="tenant-modal" onClick={e => e.stopPropagation()}>
            <div className="tenant-modal-header">
              <div className="tenant-modal-title-wrapper">
                <div className="tenant-modal-icon">
                  <i className="fas fa-user-edit"></i>
                </div>
                <h2 className="tenant-modal-title">{t('tenants.editTitle')}</h2>
              </div>
              <button className="tenant-modal-close" onClick={closeEdit}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="tenant-modal-body">
              <div className="tenant-form-grid">
                <div className="tenant-form-group">
                  <label className="tenant-form-label">
                    <i className="fas fa-user"></i>
                    {t('form.fullName')}
                  </label>
                  <input 
                    className="tenant-form-input" 
                    value={editForm.fullName} 
                    onChange={e=>setEditForm(f=>({...f,fullName:e.target.value}))} 
                    placeholder="Nhập họ và tên"
                  />
                </div>
                <div className="tenant-form-group">
                  <label className="tenant-form-label">
                    <i className="fas fa-envelope"></i>
                    Email
                  </label>
                  <input 
                    className="tenant-form-input" 
                    value={editForm.email} 
                    onChange={e=>setEditForm(f=>({...f,email:e.target.value}))} 
                    placeholder="example@email.com"
                  />
                </div>
                <div className="tenant-form-group">
                  <label className="tenant-form-label">
                    <i className="fas fa-phone"></i>
                    {t('form.phone')}
                  </label>
                  <input 
                    className="tenant-form-input" 
                    value={editForm.phone} 
                    onChange={e=>setEditForm(f=>({...f,phone:e.target.value}))} 
                    placeholder="0123456789"
                  />
                </div>
                <div className="tenant-form-group">
                  <label className="tenant-form-label">
                    <i className="fas fa-id-card"></i>
                    CCCD/CMND
                  </label>
                  <input 
                    className="tenant-form-input" 
                    value={editForm.identificationNumber} 
                    onChange={e=>setEditForm(f=>({...f,identificationNumber:e.target.value}))} 
                    placeholder="Nhập số CCCD/CMND"
                  />
                </div>
                <div className="tenant-form-group">
                  <label className="tenant-form-label">
                    <i className="fas fa-toggle-on"></i>
                    {t('common.status', { defaultValue:'Trạng thái' })}
                  </label>
                  <select 
                    className="tenant-form-select" 
                    value={editForm.isActive ? 'active':'inactive'} 
                    onChange={e=>setEditForm(f=>({...f,isActive:e.target.value==='active'}))}
                  >
                    <option value="active">{t('status.active', { defaultValue:'Hoạt động' })}</option>
                    <option value="inactive">{t('status.inactive', { defaultValue:'Ngừng hoạt động' })}</option>
                  </select>
                </div>
                <div className="tenant-form-group full">
                  <label className="tenant-form-label">
                    <i className="fas fa-map-marker-alt"></i>
                    {t('form.address')}
                  </label>
                  <textarea 
                    className="tenant-form-textarea" 
                    value={editForm.address} 
                    onChange={e=>setEditForm(f=>({...f,address:e.target.value}))} 
                    placeholder="Nhập địa chỉ"
                    rows="3"
                  />
                </div>
                
                {/* Image Upload Section */}
                <div className="tenant-form-group full">
                  <label className="tenant-form-label">
                    <i className="fas fa-images"></i>
                    Hình ảnh (Tối đa 5 ảnh)
                  </label>
                  <div className="tenant-image-upload-container">
                    <input
                      type="file"
                      id="edit-tenant-images"
                      accept="image/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => handleEditImageUpload(e.target.files)}
                    />
                    <label htmlFor="edit-tenant-images" className="tenant-image-upload-btn">
                      <i className="fas fa-cloud-upload-alt"></i>
                      <span>Thêm ảnh</span>
                    </label>
                    
                    {editForm.tenantImages && editForm.tenantImages.length > 0 && (
                      <div className="tenant-image-preview-grid">
                        {editForm.tenantImages.map((image, idx) => (
                          <div key={idx} className="tenant-image-preview-item">
                            <img 
                              src={image.isExisting ? image.url : URL.createObjectURL(image.file)} 
                              alt={`Preview ${idx + 1}`}
                            />
                            <button
                              type="button"
                              className="tenant-image-remove-btn"
                              onClick={() => removeEditImage(idx)}
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <span className="tenant-form-hint">
                      {editForm.tenantImages?.length || 0}/5 ảnh
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="tenant-modal-footer">
              <button className="tenant-btn-delete" onClick={handleDeleteTenant} disabled={updating}>
                <i className="fas fa-trash-alt"></i>
                Xóa khách thuê
              </button>
              <div className="tenant-modal-footer-right">
                <button className="tenant-btn-cancel" onClick={closeEdit}>
                  <i className="fas fa-times"></i>
                  {t('common.cancel')}
                </button>
                <button className="tenant-btn-submit" disabled={updating} onClick={submitEdit}>
                  <i className="fas fa-save"></i>
                  {updating ? (t('rooms.form.updating')||'Đang cập nhật...') : t('common.update')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="tenant-modal-overlay" onClick={cancelDeleteTenant}>
          <div className="tenant-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tenant-confirm-header">
              <i className="fas fa-exclamation-triangle tenant-confirm-icon"></i>
              <h3>Xác nhận xóa khách thuê</h3>
            </div>
            <div className="tenant-confirm-body">
              <p>Bạn có chắc chắn muốn xóa khách thuê <strong>"{editForm.fullName}"</strong>?</p>
              <p className="tenant-confirm-warning">
                <i className="fas fa-info-circle"></i>
                Lưu ý: Thao tác này sẽ xóa vĩnh viễn khỏi database và không thể khôi phục!
              </p>
            </div>
            <div className="tenant-confirm-footer">
              <button className="tenant-confirm-btn-cancel" onClick={cancelDeleteTenant}>
                <i className="fas fa-times"></i>
                Hủy
              </button>
              <button className="tenant-confirm-btn-delete" onClick={confirmDeleteTenant}>
                <i className="fas fa-trash-alt"></i>
                Xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TenantsManagement;
