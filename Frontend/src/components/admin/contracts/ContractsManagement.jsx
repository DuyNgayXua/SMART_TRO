import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import SideBar from '../../common/adminSidebar';
import '../admin-global.css';
import './contracts.css';
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
  const [viewing, setViewing] = useState(null);

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
  useEffect(()=>{ fetchOptions(); }, [fetchOptions]);

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
                      <th>{t('common.actions')}</th>
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
                        <td>{c.tenant}</td>
                        <td>{new Date(c.startDate).toLocaleDateString('vi-VN')}</td>
                        <td>{new Date(c.endDate).toLocaleDateString('vi-VN')}</td>
                        <td>{c.monthlyRent?.toLocaleString('vi-VN')} VNĐ</td>
                        <td>
                          <span className={`status-badge status-${c.status}`}>
                            {t(`contracts.status.${c.status}`, { defaultValue: c.status })}
                          </span>
                        </td>
                        <td>
                          <button 
                            className="action-btn view-btn"
                            onClick={() => setViewing(c)}
                            title={t('common.view')}
                          >
                            <i className="fas fa-eye"></i>
                          </button>
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
                            <div className="price-main">{c.depositAmount?.toLocaleString('vi-VN')} VNĐ</div>
                            <div className="price-sub">{t('contracts.deposit.roomPrice')}: {c.roomPrice?.toLocaleString('vi-VN')} VNĐ</div>
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
                            onClick={() => setViewing(c)}
                            title={t('common.view')}
                          >
                            <i className="fas fa-eye"></i>
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

      {viewing && (
        <div className="room-modal-backdrop" onClick={()=>setViewing(null)}>
          <div className="room-modal" onClick={e=>e.stopPropagation()}>
            <div className="room-modal-header">
              <h2 className="room-modal-title">{t('contracts.detailTitle')}</h2>
              <button className="room-modal-close" onClick={()=>setViewing(null)}>×</button>
            </div>
            <div className="room-view-grid">
              <p><strong>{t('contracts.room')}:</strong> {viewing.room}</p>
              <p><strong>{t('contracts.tenant')}:</strong> {viewing.tenant}</p>
              <p><strong>{t('contracts.startDate')}:</strong> {new Date(viewing.startDate).toLocaleDateString()}</p>
              <p><strong>{t('contracts.endDate')}:</strong> {new Date(viewing.endDate).toLocaleDateString()}</p>
              <p><strong>{t('contracts.monthlyRent')}:</strong> {viewing.monthlyRent?.toLocaleString()} VND</p>
              <p><strong>{t('contracts.deposit')}:</strong> {viewing.deposit?.toLocaleString()} VND</p>
              <p><strong>{t('contracts.status.label')}:</strong> {t(`contracts.status.${viewing.status}`, { defaultValue:viewing.status })}</p>
              {viewing.notes && <p><strong>{t('contracts.notes')}:</strong> {viewing.notes}</p>}
            </div>
            <div className="room-modal-footer">
              <button className="btn-secondary" onClick={()=>setViewing(null)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractsManagement;
