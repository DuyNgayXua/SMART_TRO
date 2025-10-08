import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import SideBar from '../../common/adminSidebar';
import '../admin-global.css';
import './contracts.css';
import '../rooms/rooms.css'; // Import rooms CSS for modal styles
import contractsAPI from '../../../services/contractsAPI';
import depositContractsAPI from '../../../services/depositContractsAPI';
import roomsAPI from '../../../services/roomsAPI';
import tenantsAPI from '../../../services/tenantsAPI';

const ContractsManagement = () => {
  const { t } = useTranslation();
  const [contracts, setContracts] = useState([]);
  const [depositContracts, setDepositContracts] = useState([]);
  const [activeTab, setActiveTab] = useState('rental'); // 'rental' or 'deposit'
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ room:'', tenant:'', startDate:'', endDate:'', monthlyRent:'', deposit:'', electricPrice:'', waterPrice:'', servicePrice:'', rules:'', notes:'' });
  const [errors, setErrors] = useState({});
  const [pagination, setPagination] = useState({ currentPage:1, totalPages:1, totalItems:0, itemsPerPage:12 });
  const [filters, setFilters] = useState({ status:'', search:'' });
  const [statusCounts, setStatusCounts] = useState({ 
    all: 0,
    active: 0, 
    pending: 0, 
    expired: 0, 
    terminated: 0 
  });
  const [roomOptions, setRoomOptions] = useState([]);
  const [tenantOptions, setTenantOptions] = useState([]);
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  
  // Edit contract states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [editFormData, setEditFormData] = useState({
    tenants: [],
    vehicles: [],
    startDate: '',
    endDate: '',
    monthlyRent: '',
    deposit: '',
    electricityPrice: 3500,
    waterPrice: 25000,
    waterPricePerPerson: 50000,
    waterChargeType: 'fixed',
    servicePrice: 150000,
    currentElectricIndex: '',
    currentWaterIndex: '',
    paymentCycle: 'monthly',
    notes: ''
  });

  // Format number helper function
  const formatNumber = (num) => {
    if (!num && num !== 0) return '0';
    return Number(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const fetchOptions = useCallback(async () => {
    try {
      const roomsRes = await roomsAPI.getAllRooms({ limit:100 });
      const tenantsRes = await tenantsAPI.searchTenants({ role:'tenant', limit:100 });
      setRoomOptions((roomsRes.data?.rooms || roomsRes.data?.items || []).map(r=>({ id:r._id||r.id, label:r.roomNumber||r.name })));
      setTenantOptions((tenantsRes.data?.users || []).map(u=>({ id:u._id, label:u.fullName })));
    } catch(e){ console.error(e); }
  }, []);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'rental') {
        const params = { page: pagination.currentPage, limit: pagination.itemsPerPage, status: filters.status||undefined, search: filters.search||undefined };
        const res = await contractsAPI.searchContracts(params); // expected { success, data:{ items, pagination } }
        if (res.success) {
          const list = (res.data?.items || res.data?.contracts || []).map(c => ({
            id: c._id,
            room: c.room?.roomNumber || c.roomNumber || c.room,
            tenant: c.tenant?.fullName || c.tenantName || c.tenant,
            tenants: c.tenants || [], // Array of tenant objects
            tenantCount: Array.isArray(c.tenants) ? c.tenants.length : (c.tenant ? 1 : 0),
            startDate: c.startDate,
            endDate: c.endDate,
            monthlyRent: c.monthlyRent,
            deposit: c.deposit,
            status: c.status,
            signedDate: c.signedDate,
            notes: c.notes
          }));
          setContracts(list);
          const pag = res.data?.pagination || { total:list.length, pages:1 };
          setPagination(p=>({ ...p, totalItems: pag.total, totalPages: pag.pages||1 }));
        }
        
        // Fetch status counts for rental contracts
        try {
          const allParams = { ...params, status: undefined };
          const allRes = await contractsAPI.searchContracts(allParams);
          if (allRes.success) {
            const allContracts = allRes.data?.items || allRes.data?.contracts || [];
            const counts = {
              all: allContracts.length,
              active: allContracts.filter(c => c.status === 'active').length,
              pending: allContracts.filter(c => c.status === 'pending').length,
              expired: allContracts.filter(c => c.status === 'expired').length,
              terminated: allContracts.filter(c => c.status === 'terminated').length
            };
            setStatusCounts(counts);
          }
        } catch (e) { console.error('Error fetching status counts:', e); }
        
      } else if (activeTab === 'deposit') {
        const params = { page: pagination.currentPage, limit: pagination.itemsPerPage, status: filters.status||undefined };
        const res = await depositContractsAPI.getDepositContracts(params);
        if (res.success) {
          const list = (res.data || []).map(c => ({
            id: c._id,
            room: c.room?.roomNumber || c.roomNumber,
            tenant: c.tenantName,
            tenantPhone: c.tenantPhone,
            depositDate: c.depositDate,
            expectedMoveInDate: c.expectedMoveInDate,
            depositAmount: c.depositAmount,
            roomPrice: c.roomPrice,
            status: c.status,
            notes: c.notes
          }));
          setDepositContracts(list);
          const pag = res.pagination || { total:list.length, pages:1 };
          setPagination(p=>({ ...p, totalItems: pag.total, totalPages: pag.pages||1 }));
        }
        
        // Fetch status counts for deposit contracts
        try {
          const allParams = { ...params, status: undefined };
          const allRes = await depositContractsAPI.getDepositContracts(allParams);
          if (allRes.success) {
            const allContracts = allRes.data || [];
            const counts = {
              all: allContracts.length,
              active: allContracts.filter(c => c.status === 'active').length,
              pending: allContracts.filter(c => c.status === 'pending').length,
              expired: allContracts.filter(c => c.status === 'expired').length,
              terminated: allContracts.filter(c => c.status === 'terminated').length
            };
            setStatusCounts(counts);
          }
        } catch (e) { console.error('Error fetching deposit status counts:', e); }
      }
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }, [activeTab, filters, pagination.currentPage, pagination.itemsPerPage]);

  useEffect(()=>{ fetchContracts(); }, [fetchContracts]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openActionMenu && !e.target.closest('.action-menu-btn') && !e.target.closest('.action-menu-dropdown')) {
        setOpenActionMenu(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openActionMenu]);
  useEffect(()=>{ fetchOptions(); }, [fetchOptions]);

  // Handle edit contract
  const handleEditContract = async (contract) => {
    try {
      // Fetch full contract details from API
      const res = await contractsAPI.getContractById(contract.id);
      
      if (res.success && res.data) {
        const fullContract = res.data;
        
        // Prepare edit form data
        const editData = {
          tenants: (fullContract.tenants || []).map(tenant => ({
            _id: tenant._id,
            tenantName: tenant.fullName || '',
            tenantPhone: tenant.phone || '',
            tenantEmail: tenant.email || '',
            tenantId: tenant.identificationNumber || '',
            tenantImages: tenant.images || []
          })),
          vehicles: (fullContract.vehicles || []).map(vehicle => ({
            _id: vehicle._id,
            licensePlate: vehicle.licensePlate || '',
            vehicleType: vehicle.vehicleType || '',
            ownerIndex: 0 // Will be updated based on tenant mapping
          })),
          startDate: fullContract.startDate ? fullContract.startDate.split('T')[0] : '',
          endDate: fullContract.endDate ? fullContract.endDate.split('T')[0] : '',
          monthlyRent: fullContract.monthlyRent || 0,
          deposit: fullContract.deposit || 0,
          electricityPrice: fullContract.electricPrice !== undefined ? fullContract.electricPrice : 3500,
          waterPrice: fullContract.waterPrice !== undefined ? fullContract.waterPrice : 25000,
          waterPricePerPerson: fullContract.waterPricePerPerson !== undefined ? fullContract.waterPricePerPerson : 50000,
          waterChargeType: fullContract.waterChargeType || 'fixed',
          servicePrice: fullContract.servicePrice !== undefined ? fullContract.servicePrice : 150000,
          currentElectricIndex: fullContract.currentElectricIndex ? String(fullContract.currentElectricIndex) : '',
          currentWaterIndex: fullContract.currentWaterIndex ? String(fullContract.currentWaterIndex) : '',
          paymentCycle: fullContract.paymentCycle || 'monthly',
          notes: fullContract.notes || '',
          room: fullContract.room // Keep room info
        };
        
        setEditFormData(editData);
        setEditingContract(fullContract);
        setShowEditModal(true);
      }
    } catch (error) {
      console.error('Error loading contract for edit:', error);
      alert('Không thể tải thông tin hợp đồng để chỉnh sửa');
    }
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingContract(null);
    setEditFormData({
      tenants: [],
      vehicles: [],
      startDate: '',
      endDate: '',
      monthlyRent: '',
      deposit: '',
      electricityPrice: 3500,
      waterPrice: 25000,
      waterPricePerPerson: 50000,
      waterChargeType: 'fixed',
      servicePrice: 150000,
      currentElectricIndex: '',
      currentWaterIndex: '',
      paymentCycle: 'monthly',
      notes: ''
    });
  };

  const openCreate = () => { setForm({ room:'', tenant:'', startDate:'', endDate:'', monthlyRent:'', deposit:'', electricPrice:'', waterPrice:'', servicePrice:'', rules:'', notes:'' }); setErrors({}); setShowCreateModal(true); };
  const closeCreate = () => setShowCreateModal(false);

  const validate = () => {
    const err = {};
    if(!form.room) err.room = t('validation.required');
    if(!form.tenant) err.tenant = t('validation.required');
    if(!form.startDate) err.startDate = t('validation.required');
    if(!form.endDate) err.endDate = t('validation.required');
    if(!form.monthlyRent) err.monthlyRent = t('validation.required');
    if(!form.deposit) err.deposit = t('validation.required');
    return err;
  };

  const submitCreate = async () => {
    const err = validate();
    setErrors(err);
    if(Object.keys(err).length) return;
    setCreating(true);
    try {
      const payload = { ...form };
      const res = await contractsAPI.createContract(payload);
      if (res.success) {
        closeCreate();
        fetchContracts();
      }
    } catch(e){ console.error(e); }
    finally { setCreating(false); }
  };

  return (
    <div className="contracts-container">
      <SideBar />
      <div className="contracts-content">
        <div className="contracts-header">
          <h1 className="contracts-title">{t('contracts.title')}</h1>
          <button className="add-contract-btn" onClick={openCreate}><i className="fas fa-file-contract" /> {t('contracts.addNew')}</button>
        </div>

        {/* Contract Type Tabs */}
        <div className="contract-tabs">
          <button 
            className={`tab-btn ${activeTab === 'rental' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('rental');
              setPagination(p => ({ ...p, currentPage: 1 }));
              setFilters({ status: '', search: '' });
              setStatusCounts({ all: 0, active: 0, pending: 0, expired: 0, terminated: 0 });
            }}
          >
            <i className="fas fa-file-contract"></i>
            {t('contracts.tabs.rental') || 'Hợp đồng thuê'}
          </button>
          <button 
            className={`tab-btn ${activeTab === 'deposit' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('deposit');
              setPagination(p => ({ ...p, currentPage: 1 }));
              setFilters({ status: '', search: '' });
              setStatusCounts({ all: 0, active: 0, pending: 0, expired: 0, terminated: 0 });
            }}
          >
            <i className="fas fa-hand-holding-usd"></i>
            {t('contracts.tabs.deposit') || 'Hợp đồng đặt cọc'}
          </button>
        </div>

        {/* Filters */}
        <div className="contracts-filters">
          <div className="filters-grid">
            <div className="filter-group">
              <label className="filter-label">{t('common.search')}</label>
              <input 
                className="filter-input" 
                value={filters.search} 
                onChange={e=>{ setFilters(f=>({...f,search:e.target.value})); setPagination(p=>({...p,currentPage:1})); }} 
                placeholder={t('contracts.searchPlaceholder')} 
              />
            </div>
            <div className="filter-group">
              <label className="filter-label">{t('common.filter')}</label>
              <select 
                className="filter-select" 
                value={filters.status} 
                onChange={e=>{ setFilters(f=>({...f,status:e.target.value})); setPagination(p=>({...p,currentPage:1})); }}
              >
                <option value="">{t('common.all')}</option>
                <option value="active">{t('contracts.status.active')}</option>
                <option value="pending">{t('contracts.status.pending')}</option>
                <option value="expired">{t('contracts.status.expired')}</option>
                <option value="terminated">{t('contracts.status.terminated')}</option>
              </select>
            </div>
            <div className="filter-group">
              <button className="search-btn" onClick={fetchContracts}>
                <i className="fas fa-search" /> {t('common.search')}
              </button>
            </div>
            <div className="filter-group">
              <button className="reset-btn" onClick={()=>{ setFilters({ status:'', search:'' }); setPagination(p=>({...p,currentPage:1})); }}>
                <i className="fas fa-redo" /> {t('common.reset')}
              </button>
            </div>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="contracts-status-tabs">
          <button 
            className={`contracts-status-tab ${filters.status === '' ? 'active' : ''}`}
            onClick={() => {
              setFilters(prev => ({ ...prev, status: '' }));
              setPagination(prev => ({ ...prev, currentPage: 1 }));
            }}
          >
            {t('common.all') || 'Tất cả'}
            <span className="tab-count">{statusCounts.all}</span>
          </button>
          <button 
            className={`contracts-status-tab ${filters.status === 'active' ? 'active' : ''}`}
            onClick={() => {
              setFilters(prev => ({ ...prev, status: 'active' }));
              setPagination(prev => ({ ...prev, currentPage: 1 }));
            }}
          >
            {t('contracts.status.active') || 'Hiệu lực'}
            <span className="tab-count">{statusCounts.active}</span>
          </button>
          <button 
            className={`contracts-status-tab ${filters.status === 'pending' ? 'active' : ''}`}
            onClick={() => {
              setFilters(prev => ({ ...prev, status: 'pending' }));
              setPagination(prev => ({ ...prev, currentPage: 1 }));
            }}
          >
            {t('contracts.status.pending') || 'Chờ xử lý'}
            <span className="tab-count">{statusCounts.pending}</span>
          </button>
          <button 
            className={`contracts-status-tab ${filters.status === 'expired' ? 'active' : ''}`}
            onClick={() => {
              setFilters(prev => ({ ...prev, status: 'expired' }));
              setPagination(prev => ({ ...prev, currentPage: 1 }));
            }}
          >
            {t('contracts.status.expired') || 'Hết hạn'}
            <span className="tab-count">{statusCounts.expired}</span>
          </button>
          <button 
            className={`contracts-status-tab ${filters.status === 'terminated' ? 'active' : ''}`}
            onClick={() => {
              setFilters(prev => ({ ...prev, status: 'terminated' }));
              setPagination(prev => ({ ...prev, currentPage: 1 }));
            }}
          >
            {t('contracts.status.terminated') || 'Đã chấm dứt'}
            <span className="tab-count">{statusCounts.terminated}</span>
          </button>
        </div>

        {loading ? (
          <div className="loading-container"><div className="loading-spinner" /> <p>{t('common.loading')}</p></div>
        ) : (activeTab === 'rental' ? contracts : depositContracts).length === 0 ? (
          <div className="empty-container">
            <div className="empty-icon">📄</div>
            <h3 className="empty-text">{activeTab === 'rental' ? t('contracts.empty') : (t('contracts.deposit.empty') || 'Chưa có hợp đồng đặt cọc nào')}</h3>
            <p className="empty-description">{activeTab === 'rental' ? t('contracts.emptyDescription') : (t('contracts.deposit.emptyDescription') || 'Các hợp đồng đặt cọc sẽ hiển thị ở đây')}</p>
          </div>
        ) : (
          <div className="contracts-table-container">
            <table className="contracts-table">
              <thead>
                <tr>
                  {activeTab === 'rental' ? (
                    <>
                      <th>{t('contracts.room')}</th>
                      <th>{t('contracts.tenant')}</th>
                      <th>{t('contracts.startDate')}</th>
                      <th>{t('contracts.endDate')}</th>
                      <th>{t('contracts.monthlyRent')}</th>
                      <th>{t('contracts.status.label')}</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>{t('common.actions')}</th>
                    </>
                  ) : (
                    <>
                      <th>{t('contracts.room')}</th>
                      <th>{t('contracts.deposit.tenant')}</th>
                      <th>{t('contracts.deposit.phone')}</th>
                      <th>{t('contracts.deposit.depositDate')}</th>
                      <th>{t('contracts.deposit.expectedMoveIn')}</th>
                      <th>{t('contracts.deposit.amount')}</th>
                      <th>{t('contracts.status.label')}</th>
                      <th>{t('common.actions')}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {(activeTab === 'rental' ? contracts : depositContracts).map(c => (
                  <tr key={c.id}>
                    {activeTab === 'rental' ? (
                      <>
                        <td>{c.room}</td>
                        <td>
                          <span className="tenant-count-badge">
                            <i className="fas fa-users"></i>
                            {c.tenantCount} {c.tenantCount === 1 ? t('contracts.person') : t('contracts.people')}
                          </span>
                        </td>
                        <td>{new Date(c.startDate).toLocaleDateString('vi-VN')}</td>
                        <td>{new Date(c.endDate).toLocaleDateString('vi-VN')}</td>
                        <td>{formatNumber(c.monthlyRent)} VNĐ</td>
                        <td>
                          <span className={`status-badge status-${c.status}`}>
                            {t(`contracts.status.${c.status}`, { defaultValue: c.status })}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', position: 'relative' }}>
                          <button
                            className="action-menu-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                              const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                              
                              let top = rect.bottom + scrollTop + 4;
                              let left = rect.left + scrollLeft - 150;
                              
                              if (left < 4) {
                                left = 4;
                              }
                              
                              setDropdownPosition({ top, left });
                              setOpenActionMenu(c.id);
                            }}
                          >
                            <i className="fas fa-ellipsis-v"></i>
                          </button>
                          {openActionMenu === c.id && (
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
                                  handleEditContract(c);
                                  setOpenActionMenu(null);
                                }}
                              >
                                <i className="fas fa-edit"></i>
                                {t('common.edit')}
                              </button>
                            </div>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{c.room}</td>
                        <td>{c.tenant}</td>
                        <td>{c.tenantPhone}</td>
                        <td>{new Date(c.depositDate).toLocaleDateString('vi-VN')}</td>
                        <td>{new Date(c.expectedMoveInDate).toLocaleDateString('vi-VN')}</td>
                        <td>
                          <div className="price-info">
                            <div className="price-main">{formatNumber(c.depositAmount)} VNĐ</div>
                            <div className="price-sub">{t('contracts.deposit.roomPrice')}: {formatNumber(c.roomPrice)} VNĐ</div>
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge status-${c.status}`}>
                            {t(`contracts.status.${c.status}`, { defaultValue: c.status })}
                          </span>
                        </td>
                        <td>
                          <button 
                            className="action-btn view-btn"
                            onClick={() => handleEditContract(c)}
                            title={t('common.edit')}
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(activeTab === 'rental' ? contracts : depositContracts).length>0 && (
          <div className="pagination">
            <button className="pagination-btn" disabled={pagination.currentPage===1} onClick={()=>setPagination(p=>({...p,currentPage:p.currentPage-1}))}><i className="fas fa-chevron-left" /></button>
            <span className="pagination-info">{t('rooms.pagination.page')} {pagination.currentPage} / {pagination.totalPages} ({pagination.totalItems})</span>
            <button className="pagination-btn" disabled={pagination.currentPage===pagination.totalPages} onClick={()=>setPagination(p=>({...p,currentPage:p.currentPage+1}))}><i className="fas fa-chevron-right" /></button>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="room-modal-backdrop">
          <div className="room-modal">
            <div className="room-modal-header">
              <h2 className="room-modal-title">{t('contracts.createTitle')}</h2>
              <button className="room-modal-close" onClick={closeCreate}>×</button>
            </div>
            <div className="room-form-grid">
              <div className="room-form-group">
                <label className="room-form-label">{t('contracts.room')}</label>
                <select className="room-form-input" value={form.room} onChange={e=>setForm(f=>({...f,room:e.target.value}))}>
                  <option value="">--</option>
                  {roomOptions.map(r=> <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
                {errors.room && <div className="error-text">{errors.room}</div>}
              </div>
              <div className="room-form-group">
                <label className="room-form-label">{t('contracts.tenant')}</label>
                <select className="room-form-input" value={form.tenant} onChange={e=>setForm(f=>({...f,tenant:e.target.value}))}>
                  <option value="">--</option>
                  {tenantOptions.map(r=> <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
                {errors.tenant && <div className="error-text">{errors.tenant}</div>}
              </div>
              <div className="room-form-group">
                <label className="room-form-label">{t('contracts.startDate')}</label>
                <input type="date" className="room-form-input" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} />
                {errors.startDate && <div className="error-text">{errors.startDate}</div>}
              </div>
              <div className="room-form-group">
                <label className="room-form-label">{t('contracts.endDate')}</label>
                <input type="date" className="room-form-input" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))} />
                {errors.endDate && <div className="error-text">{errors.endDate}</div>}
              </div>
              <div className="room-form-group">
                <label className="room-form-label">{t('contracts.monthlyRent')}</label>
                <input className="room-form-input" value={form.monthlyRent} onChange={e=>setForm(f=>({...f,monthlyRent:e.target.value}))} />
                {errors.monthlyRent && <div className="error-text">{errors.monthlyRent}</div>}
              </div>
              <div className="room-form-group">
                <label className="room-form-label">{t('contracts.deposit')}</label>
                <input className="room-form-input" value={form.deposit} onChange={e=>setForm(f=>({...f,deposit:e.target.value}))} />
                {errors.deposit && <div className="error-text">{errors.deposit}</div>}
              </div>
              <div className="room-form-group">
                <label className="room-form-label">{t('contracts.electricPrice')}</label>
                <input className="room-form-input" value={form.electricPrice} onChange={e=>setForm(f=>({...f,electricPrice:e.target.value}))} />
              </div>
              <div className="room-form-group">
                <label className="room-form-label">{t('contracts.waterPrice')}</label>
                <input className="room-form-input" value={form.waterPrice} onChange={e=>setForm(f=>({...f,waterPrice:e.target.value}))} />
              </div>
              <div className="room-form-group">
                <label className="room-form-label">{t('contracts.servicePrice')}</label>
                <input className="room-form-input" value={form.servicePrice} onChange={e=>setForm(f=>({...f,servicePrice:e.target.value}))} />
              </div>
              <div className="room-form-group full">
                <label className="room-form-label">{t('contracts.rules')}</label>
                <textarea className="room-form-textarea" value={form.rules} onChange={e=>setForm(f=>({...f,rules:e.target.value}))} />
              </div>
              <div className="room-form-group full">
                <label className="room-form-label">{t('contracts.notes')}</label>
                <textarea className="room-form-textarea" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
              </div>
            </div>
            <div className="room-modal-footer">
              <button className="btn-secondary" onClick={closeCreate}>{t('common.cancel')}</button>
              <button className="btn-primary" disabled={creating} onClick={submitCreate}>{creating ? t('contracts.creating') : t('common.create')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Contract Modal - Copy from RoomsManagement */}
      {showEditModal && editingContract && (
        <div className="room-modal-backdrop" onClick={closeEditModal}>
          <div className="room-modal rental-contract-modal" onClick={e => e.stopPropagation()}>
            <div className="room-modal-header">
              <h2 className="room-modal-title">
                <i className="fas fa-file-contract"></i> 
                Chỉnh sửa hợp đồng - {editFormData.room?.roomNumber || editingContract.room?.roomNumber || ''}
              </h2>
              <button className="room-modal-close" onClick={closeEditModal}>×</button>
            </div>
            
            <div className="room-modal-content">
              <div className="rental-contract-two-columns">
                {/* Left Column - Tenant Information */}
                <div className="rental-contract-left">
                  {/* Tenant Information */}
                  <div className="form-section tenant-section">
                    <div className="section-header">
                      <h3><i className="fas fa-users"></i> Thông tin người thuê ({editFormData.tenants.length})</h3>
                    </div>
                    
                    <p className="info-message">
                      <i className="fas fa-info-circle"></i>
                      Để chỉnh sửa thông tin người thuê, vui lòng vào trang <strong>Quản lý phòng</strong> và chọn phòng tương ứng.
                    </p>

                    {editFormData.tenants.map((tenant, index) => (
                      <div key={index} className="tenant-item view-mode">
                        <div className="item-header">
                          <h4><i className="fas fa-user"></i> Người thuê {index + 1}</h4>
                        </div>
                        
                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label">Họ và tên</label>
                            <input
                              type="text"
                              className="form-input"
                              value={tenant.tenantName}
                              readOnly
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Số điện thoại</label>
                            <input
                              type="text"
                              className="form-input"
                              value={tenant.tenantPhone}
                              readOnly
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Vehicle Information */}
                  {editFormData.vehicles && editFormData.vehicles.length > 0 && (
                    <div className="form-section tenant-section">
                      <div className="section-header">
                        <h3><i className="fas fa-car"></i> Thông tin phương tiện ({editFormData.vehicles.length})</h3>
                      </div>
                      
                      <p className="info-message">
                        <i className="fas fa-info-circle"></i>
                        Để chỉnh sửa thông tin phương tiện, vui lòng vào trang <strong>Quản lý phòng</strong>.
                      </p>

                      {editFormData.vehicles.map((vehicle, idx) => (
                        <div key={idx} className="tenant-item view-mode">
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Biển số</label>
                              <input
                                type="text"
                                className="form-input"
                                value={vehicle.licensePlate}
                                readOnly
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Loại xe</label>
                              <input
                                type="text"
                                className="form-input"
                                value={vehicle.vehicleType}
                                readOnly
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Column - Contract Information (Editable) */}
                <div className="rental-contract-right">
                  {/* Contract Dates */}
                  <div className="form-section">
                    <h3><i className="fas fa-calendar-alt"></i> Thông tin hợp đồng</h3>
                    
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Ngày bắt đầu</label>
                        <input
                          type="date"
                          className="form-input"
                          value={editFormData.startDate}
                          onChange={(e) => setEditFormData(prev => ({...prev, startDate: e.target.value}))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Ngày kết thúc</label>
                        <input
                          type="date"
                          className="form-input"
                          value={editFormData.endDate}
                          onChange={(e) => setEditFormData(prev => ({...prev, endDate: e.target.value}))}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Tiền cọc (VNĐ)</label>
                        <input
                          type="text"
                          className="form-input"
                          value={formatNumber(editFormData.deposit)}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\./g, '');
                            if (!isNaN(value)) {
                              setEditFormData(prev => ({...prev, deposit: value}));
                            }
                          }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Tiền thuê hàng tháng (VNĐ)</label>
                        <input
                          type="text"
                          className="form-input"
                          value={formatNumber(editFormData.monthlyRent)}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\./g, '');
                            if (!isNaN(value)) {
                              setEditFormData(prev => ({...prev, monthlyRent: value}));
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pricing Information */}
                  <div className="form-section">
                    <h3><i className="fas fa-calculator"></i> Chi phí dịch vụ</h3>
                    
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Giá điện (VNĐ/kWh)</label>
                        <input
                          type="text"
                          className="form-input"
                          value={formatNumber(editFormData.electricityPrice)}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\./g, '');
                            if (!isNaN(value)) {
                              setEditFormData(prev => ({...prev, electricityPrice: value}));
                            }
                          }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Phí dịch vụ (VNĐ/tháng)</label>
                        <input
                          type="text"
                          className="form-input"
                          value={formatNumber(editFormData.servicePrice)}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\./g, '');
                            if (!isNaN(value)) {
                              setEditFormData(prev => ({...prev, servicePrice: value}));
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Cách tính tiền nước</label>
                      <select
                        className="form-input"
                        value={editFormData.waterChargeType}
                        onChange={(e) => setEditFormData(prev => ({...prev, waterChargeType: e.target.value}))}
                      >
                        <option value="fixed">💧 Giá cố định</option>
                        <option value="per_person">👥 Tính theo người</option>
                      </select>
                    </div>

                    {editFormData.waterChargeType === 'fixed' ? (
                      <div className="form-group">
                        <label className="form-label">Giá nước (VNĐ/khối)</label>
                        <input
                          type="text"
                          className="form-input"
                          value={formatNumber(editFormData.waterPrice)}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\./g, '');
                            if (!isNaN(value)) {
                              setEditFormData(prev => ({...prev, waterPrice: value}));
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="form-group">
                        <label className="form-label">Giá nước theo người (VNĐ/người/tháng)</label>
                        <input
                          type="text"
                          className="form-input"
                          value={formatNumber(editFormData.waterPricePerPerson)}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\./g, '');
                            if (!isNaN(value)) {
                              setEditFormData(prev => ({...prev, waterPricePerPerson: value}));
                            }
                          }}
                        />
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">Chu kỳ thanh toán</label>
                      <select
                        className="form-input"
                        value={editFormData.paymentCycle}
                        onChange={(e) => setEditFormData(prev => ({...prev, paymentCycle: e.target.value}))}
                      >
                        <option value="monthly">📅 Hàng tháng</option>
                        <option value="quarterly">📊 Hàng quý</option>
                        <option value="yearly">📈 Hàng năm</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Ghi chú</label>
                      <textarea
                        className="form-input"
                        value={editFormData.notes}
                        onChange={(e) => setEditFormData(prev => ({...prev, notes: e.target.value}))}
                        rows="3"
                        style={{resize: 'vertical'}}
                      />
                    </div>
                  </div>

                  {/* Meter Readings */}
                  <div className="form-section">
                    <h3><i className="fas fa-tachometer-alt"></i> Chỉ số điện nước hiện tại</h3>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Chỉ số điện (kWh)</label>
                        <input
                          type="text"
                          className="form-input"
                          value={formatNumber(editFormData.currentElectricIndex)}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\./g, '');
                            if (!isNaN(value)) {
                              setEditFormData(prev => ({...prev, currentElectricIndex: value}));
                            }
                          }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Chỉ số nước (m³)</label>
                        <input
                          type="text"
                          className="form-input"
                          value={formatNumber(editFormData.currentWaterIndex)}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\./g, '');
                            if (!isNaN(value)) {
                              setEditFormData(prev => ({...prev, currentWaterIndex: value}));
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="room-modal-footer">
              <button type="button" className="btn-cancel" onClick={closeEditModal}>
                <i className="fas fa-times"></i> Hủy bỏ
              </button>
              <button 
                type="submit" 
                className="btn-submit"
                onClick={async () => {
                  try {
                    const updateData = {
                      startDate: editFormData.startDate,
                      endDate: editFormData.endDate,
                      monthlyRent: Number(editFormData.monthlyRent),
                      deposit: Number(editFormData.deposit),
                      electricPrice: Number(editFormData.electricityPrice),
                      waterPrice: Number(editFormData.waterPrice),
                      waterPricePerPerson: Number(editFormData.waterPricePerPerson),
                      waterChargeType: editFormData.waterChargeType,
                      servicePrice: Number(editFormData.servicePrice),
                      currentElectricIndex: Number(editFormData.currentElectricIndex),
                      currentWaterIndex: Number(editFormData.currentWaterIndex),
                      paymentCycle: editFormData.paymentCycle,
                      notes: editFormData.notes
                    };

                    const res = await contractsAPI.updateContract(editingContract._id, updateData);
                    
                    if (res.success) {
                      alert('Cập nhật hợp đồng thành công!');
                      closeEditModal();
                      fetchContracts(); // Refresh list
                    } else {
                      alert('Lỗi: ' + (res.message || 'Không thể cập nhật hợp đồng'));
                    }
                  } catch (error) {
                    console.error('Error updating contract:', error);
                    alert('Lỗi khi cập nhật hợp đồng');
                  }
                }}
              >
                <i className="fas fa-check"></i> Cập nhật
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractsManagement;

