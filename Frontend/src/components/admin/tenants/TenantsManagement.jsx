import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import SideBar from '../../common/adminSidebar';
import '../admin-global.css';
import './tenants.css';
import tenantsAPI from '../../../services/tenantsAPI';
import { roomsAPI } from '../../../services/roomsAPI';

const TenantsManagement = () => {
  const { t } = useTranslation();
  const [roomsWithTenants, setRoomsWithTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [form, setForm] = useState({ fullName:'', email:'', phone:'', password:'', address:'', role:'tenant' });
  const [editForm, setEditForm] = useState({ fullName:'', email:'', phone:'', address:'', isActive:true, role:'tenant' });
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
        
        // For each room, get current tenants
        const roomsWithTenantsData = await Promise.all(
          rooms.map(async (room) => {
            try {
              const tenantsRes = await tenantsAPI.getCurrentTenantByRoom(room._id);
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

  const openCreate = () => { setForm({ fullName:'', email:'', phone:'', password:'', address:'', role:'tenant' }); setErrors({}); setShowCreateModal(true); };
  const closeCreate = () => { setShowCreateModal(false); };
  const openEdit = async (id) => {
    try {
      const res = await tenantsAPI.getTenantById(id);
      if (res.success) {
        const u = res.data;
        setEditingId(id);
        setEditForm({
          fullName: u.fullName || '',
          email: u.email || '',
          phone: u.phone || '',
          address: u.address?.street || '',
          isActive: u.isActive !== false,
          role: u.role || 'tenant'
        });
        setErrors({});
        setShowEditModal(true);
      }
    } catch(e){ console.error(e); }
  };
  const closeEdit = () => { setShowEditModal(false); setEditingId(null); };

  const validate = () => {
    const err = {};
    if(!form.fullName) err.fullName = t('validation.required');
    if(!form.email) err.email = t('validation.required');
    if(!form.phone) err.phone = t('validation.required');
    if(!form.password) err.password = t('validation.required');
    return err;
  };

  const submitCreate = async () => {
    const err = validate();
    setErrors(err);
    if(Object.keys(err).length) return;
    setSaving(true);
    try {
      const payload = { ...form };
      const res = await tenantsAPI.createTenant(payload);
      if (res.success) {
        closeCreate();
        fetchRoomsWithTenants();
      }
    } catch(e){ console.error(e); }
    finally { setSaving(false); }
  };

  const submitEdit = async () => {
    setUpdating(true);
    try {
      const payload = { fullName: editForm.fullName, phone: editForm.phone, address: { street: editForm.address }, isActive: editForm.isActive };
      const res = await tenantsAPI.updateTenant(editingId, payload);
      if (res.success) {
        closeEdit();
        fetchRoomsWithTenants();
      }
    } catch(e){ console.error(e); }
    finally { setUpdating(false); }
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
                    <i className="fas fa-lock"></i>
                    {t('auth.password')}
                  </label>
                  <input 
                    type="password" 
                    className={`tenant-form-input ${errors.password ? 'error' : ''}`}
                    value={form.password} 
                    onChange={e=>setForm(f=>({...f,password:e.target.value}))} 
                    placeholder="••••••••"
                  />
                  {errors.password && <span className="tenant-error-text">{errors.password}</span>}
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
                    className="tenant-form-input disabled" 
                    value={editForm.email} 
                    disabled 
                  />
                  <span className="tenant-form-hint">Email không thể thay đổi</span>
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
              </div>
            </div>
            <div className="tenant-modal-footer">
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
      )}

    </div>
  );
};

export default TenantsManagement;
