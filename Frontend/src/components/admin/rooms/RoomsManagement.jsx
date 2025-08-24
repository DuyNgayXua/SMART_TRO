import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import SideBar from "../../common/adminSidebar";
import "../admin-global.css";
import "./rooms.css";
import roomsAPI from '../../../services/roomsAPI';
import amenitiesAPI from '../../../services/amenitiesAPI';
import api from '../../../services/api';

const RoomsManagement = () => {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState([]);
  const [carouselIndex, setCarouselIndex] = useState({}); // {roomId: idx}
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchFilters, setSearchFilters] = useState({
    search: '',
    status: '',
    priceMin: '',
    priceMax: ''
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 12
  });
  const [statusCounts, setStatusCounts] = useState({ all:0, available:0, occupied:0, maintenance:0, reserved:0 });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [viewRoom, setViewRoom] = useState(null);
  const [viewCarouselIndex, setViewCarouselIndex] = useState(0);
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [formData, setFormData] = useState({
    roomNumber: '',
    price: '',
    deposit: '',
    electricityPrice: 3500,
    waterPrice: 25000,
    servicePrice: 150000,
    area: '',
    capacity: '',
    vehicleCount: '',
    description: '',
    amenities: []
  });
  const [selectedImages, setSelectedImages] = useState([]); // File objects
  const [uploadingImages, setUploadingImages] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [roomNumberChecking, setRoomNumberChecking] = useState(false);
  const [roomNumberAvailable, setRoomNumberAvailable] = useState(true);
  const [editRoomNumberChecking, setEditRoomNumberChecking] = useState(false);
  const [editRoomNumberAvailable, setEditRoomNumberAvailable] = useState(true);
  const [editFormData, setEditFormData] = useState({
    roomNumber: '',
    price: '',
    deposit: '',
    electricityPrice: 3500,
    waterPrice: 25000,
    servicePrice: 150000,
    area: '',
    capacity: '',
    vehicleCount: '',
    description: '',
    amenities: [],
    images: []
  });
  const [newEditImages, setNewEditImages] = useState([]);
  const [editUploadingImages, setEditUploadingImages] = useState(false);
  // Clear temp create images when modal closed
  useEffect(()=>{ if(!showCreateModal) setSelectedImages([]); }, [showCreateModal]);
  // Clear temp edit images when modal closed
  useEffect(()=>{ if(!showEditModal) setNewEditImages([]); }, [showEditModal]);

  // Helper: refresh a single room in rooms list
  const refreshRoomInList = async (roomId, alsoUpdateView=false) => {
    try {
      const res = await roomsAPI.getRoomById(roomId);
      if (res.success) {
        setRooms(prev => prev.map(r => r.id === roomId ? ({
          id: res.data._id,
          name: res.data.roomNumber,
          status: res.data.status,
          price: res.data.price,
          area: res.data.area,
            capacity: res.data.capacity,
            vehicleCount: res.data.vehicleCount,
            description: res.data.description,
            images: res.data.images || [],
            amenities: res.data.amenities || []
        }) : r));
        if (alsoUpdateView) {
          setViewRoom(v => v && v._id === roomId ? res.data : v);
        }
      }
    } catch(e) { console.error('refreshRoomInList error', e); }
  };
  const [editFormErrors, setEditFormErrors] = useState({});
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [availableAmenities, setAvailableAmenities] = useState([]);
  // Bỏ danh sách properties vì không cần

  // Load amenities from API
  const loadAmenities = useCallback(async () => {
    try {
      const response = await amenitiesAPI.getActiveAmenities();
      if (response.success) {
        setAvailableAmenities(response.data);
      }
    } catch (error) {
      console.error('Error loading amenities:', error);
    }
  }, []);

  useEffect(() => {
    loadAmenities();
  }, [loadAmenities]);

  const statusLabels = {
    all: t('rooms.status.all'),
    available: t('rooms.status.available'),
    occupied: t('rooms.status.occupied')
  };

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.currentPage,
        limit: pagination.itemsPerPage,
        minPrice: searchFilters.priceMin || undefined,
        maxPrice: searchFilters.priceMax || undefined,
        search: searchFilters.search || undefined,
        status: activeTab !== 'all' ? activeTab : undefined
      };
      const res = await roomsAPI.searchRooms(params); // { success, data: { rooms, pagination } }
      if (res.success) {
    const list = res.data.rooms.map(r => ({
          id: r._id,
          name: r.roomNumber,
            status: r.status,
            price: r.price,
            area: r.area,
            capacity: r.capacity,
            vehicleCount: r.vehicleCount,
            description: r.description,
            images: r.images || [],
            amenities: r.amenities || []
        }));
        setRooms(list);
        setPagination(prev => ({
          ...prev,
          totalItems: res.data.pagination.total,
          totalPages: res.data.pagination.pages
        }));
      }
      // Lấy statistics để cập nhật counts
      const statsRes = await roomsAPI.getRoomStatistics();
      if (statsRes.success) {
        const stats = statsRes.data;
        setStatusCounts({
          all: (stats.available?.count||0)+(stats.rented?.count||0)+(stats.maintenance?.count||0)+(stats.reserved?.count||0),
          available: stats.available?.count||0,
          occupied: stats.rented?.count||0,
          maintenance: stats.maintenance?.count||0,
          reserved: stats.reserved?.count||0
        });
      }
    } catch (e) {
      console.error('Error loading rooms list:', e);
    } finally { setLoading(false); }
  }, [activeTab, searchFilters, pagination.currentPage, pagination.itemsPerPage]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

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
      status: '',
      priceMin: '',
      priceMax: ''
    });
  };

  const handleViewRoom = (roomId) => {
    (async () => {
      try {
        const res = await roomsAPI.getRoomById(roomId);
        if (res.success) {
          setViewRoom(res.data);
          setViewCarouselIndex(0);
          setShowViewModal(true);
        }
      } catch (e) { console.error('Load room detail error', e); }
    })();
  };

  const handleEditRoom = (roomId) => {
    (async () => {
      try {
        const res = await roomsAPI.getRoomById(roomId);
        if (res.success) {
          const r = res.data;
          setEditingRoomId(r._id);
          setEditFormData({
            roomNumber: r.roomNumber || '',
            price: r.price ?? '',
            deposit: r.deposit ?? '',
            electricityPrice: r.electricityPrice ?? 3500,
            waterPrice: r.waterPrice ?? 25000,
            servicePrice: r.servicePrice ?? 150000,
            electricityMeter: {
              enabled: r.electricityMeter?.enabled ?? true,
              lastReading: r.electricityMeter?.lastReading ?? 0,
              unit: r.electricityMeter?.unit ?? 'kWh'
            },
            waterMeter: {
              enabled: r.waterMeter?.enabled ?? true,
              lastReading: r.waterMeter?.lastReading ?? 0,
              unit: r.waterMeter?.unit ?? 'm³'
            },
            paymentConfig: {
              electricityIncluded: r.paymentConfig?.electricityIncluded ?? false,
              waterIncluded: r.paymentConfig?.waterIncluded ?? false,
              serviceIncluded: r.paymentConfig?.serviceIncluded ?? true,
              paymentDay: r.paymentConfig?.paymentDay ?? 1,
              advancePayment: r.paymentConfig?.advancePayment ?? 1
            },
            area: r.area ?? '',
            capacity: r.capacity ?? '',
            vehicleCount: r.vehicleCount ?? '',
            description: r.description || '',
            amenities: Array.isArray(r.amenities) ? r.amenities.map(amenity => {
              // If amenity is populated object, extract ID, otherwise use as is
              return typeof amenity === 'object' && amenity._id ? amenity._id : amenity;
            }) : [],
            images: Array.isArray(r.images) ? r.images : []
          });
          setEditFormErrors({});
          setShowEditModal(true);
        }
      } catch (e) { console.error('Load room for edit error', e); }
    })();
  };

  const handleDeleteRoom = async (roomId) => {
  if (window.confirm(t('rooms.confirmDelete'))) {
      try {
        await roomsAPI.deleteRoom(roomId);
         fetchRooms();
      } catch (error) {
        console.error('Error deleting room:', error);
      }
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      available: 'status-available',
      occupied: 'status-occupied',
    };
    return `room-status-badge ${classes[status]}`;
  };

  const getStatusText = (status) => {
    const texts = {
      available: t('rooms.status.available'),
      occupied: t('rooms.status.occupied'),
    };
    return texts[status];
  };

  const openCreateModal = async () => { setShowCreateModal(true); };
  const closeCreateModal = () => { 
    setShowCreateModal(false); 
    setFormErrors({}); 
    setFormData({
      roomNumber: '',
      price: '',
      deposit: '',
      electricityPrice: 3500,
      waterPrice: 25000,
      servicePrice: 150000,
      area: '',
      capacity: '',
      vehicleCount: '',
      description: '',
      amenities: []
    });
  };
  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatWithCommas = (val) => {
    if (val === '' || val === null || val === undefined) return '';
    const num = Number(val);
    if (Number.isNaN(num)) return '';
    return num.toLocaleString('en-US');
  };

  const handleMoneyInlineChange = (field, raw, edit=false) => {
    const digits = raw.replace(/[^0-9]/g,'');
    if (edit) {
      setEditFormData(p=>({...p,[field]: digits}));
    } else {
      setFormData(p=>({...p,[field]: digits}));
    }
  };

  const handleMoneyInlineKey = (e, field, edit=false) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const delta = 500000 * (e.key === 'ArrowUp' ? 1 : -1);
      if (edit) {
        setEditFormData(p=>{
          const current = p[field] === '' ? 0 : Number(p[field]);
            const next = Math.max(0, current + delta);
            return {...p,[field]: String(next)};
        });
      } else {
        setFormData(p=>{
          const current = p[field] === '' ? 0 : Number(p[field]);
          const next = Math.max(0, current + delta);
          return {...p,[field]: String(next)};
        });
      }
    }
  };

  // Debounce refs
  const roomNumberTimerRef = React.useRef(null);
  const editRoomNumberTimerRef = React.useRef(null);

  // Watch create form roomNumber
  useEffect(() => {
    const val = formData.roomNumber?.trim();
    if (roomNumberTimerRef.current) clearTimeout(roomNumberTimerRef.current);
    if (!val) {
      setRoomNumberChecking(false);
      setRoomNumberAvailable(true);
      return;
    }
    // Hiển thị trạng thái kiểm tra ngay lập tức
    setRoomNumberChecking(true);
    roomNumberTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/rooms/check-room-number', { params: { roomNumber: val } });
        if (res.data?.success) setRoomNumberAvailable(res.data.data.available);
      } catch (_) { /* ignore */ }
      finally { setRoomNumberChecking(false); }
    }, 350);
    return () => roomNumberTimerRef.current && clearTimeout(roomNumberTimerRef.current);
  }, [formData.roomNumber]);

  // Watch edit form roomNumber
  useEffect(() => {
    if (!showEditModal) return; // only when editing
    const val = editFormData.roomNumber?.trim();
    if (editRoomNumberTimerRef.current) clearTimeout(editRoomNumberTimerRef.current);
    if (!val) {
      setEditRoomNumberChecking(false);
      setEditRoomNumberAvailable(true);
      return;
    }
    setEditRoomNumberChecking(true);
    editRoomNumberTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/rooms/check-room-number', { params: { roomNumber: val, excludeId: editingRoomId } });
        if (res.data?.success) setEditRoomNumberAvailable(res.data.data.available);
      } catch (_) { /* ignore */ }
      finally { setEditRoomNumberChecking(false); }
    }, 350);
    return () => editRoomNumberTimerRef.current && clearTimeout(editRoomNumberTimerRef.current);
  }, [editFormData.roomNumber, editingRoomId, showEditModal]);
  const toggleAmenity = (val) => {
    setFormData(prev => {
      let nextAmenities = [...prev.amenities];
      const has = nextAmenities.includes(val);

      if (has) {
        nextAmenities = nextAmenities.filter(a => a !== val);
      } else {
        nextAmenities.push(val);
      }
      return { ...prev, amenities: nextAmenities };
    });
  };
  const toggleEditAmenity = (val) => {
    setEditFormData(prev => {
      let nextAmenities = [...prev.amenities];
      const has = nextAmenities.includes(val);
      
      if (has) {
        nextAmenities = nextAmenities.filter(a => a !== val);
      } else {
        nextAmenities.push(val);
      }
      return { ...prev, amenities: nextAmenities };
    });
  };
  const validateForm = () => {
    const errors = {};
  if (!formData.roomNumber) errors.roomNumber = t('rooms.validation.roomNumberRequired');
  if (formData.roomNumber && !roomNumberAvailable) errors.roomNumber = t('rooms.validation.roomNumberDuplicate');
  if (formData.price === '' || Number(formData.price) < 0) errors.price = t('rooms.validation.priceInvalid');
  if (formData.deposit === '' || Number(formData.deposit) < 0) errors.deposit = t('rooms.validation.depositInvalid');
  if (formData.capacity !== '' && Number(formData.capacity) < 1) errors.capacity = t('rooms.validation.capacityInvalid');
    return errors;
  };
  const submitCreate = async () => {
    const errors = validateForm();
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
    setCreating(true);
    try {
    const payload = {
          roomNumber: formData.roomNumber,
          price: Number(formData.price),
          deposit: Number(formData.deposit),
          electricityPrice: Number(formData.electricityPrice) || 3500,
          waterPrice: Number(formData.waterPrice) || 25000,
          servicePrice: Number(formData.servicePrice) || 150000,
          area: formData.area ? Number(formData.area) : undefined,
          capacity: formData.capacity ? Number(formData.capacity) : undefined,
          vehicleCount: formData.vehicleCount ? Number(formData.vehicleCount) : undefined,
          description: formData.description,
          amenities: formData.amenities
        };
      const res = await roomsAPI.createRoom(payload);
      if (res.success) {
        // Upload images if any
        if (selectedImages.length) {
          setUploadingImages(true);
          try {
            await roomsAPI.uploadRoomImages(res.data._id, selectedImages.slice(0,5));
          } catch(e) { console.error('Upload images error', e); }
          finally { setUploadingImages(false); }
        }
        closeCreateModal();
        setFormData({ roomNumber:'', price:'', deposit:'', area:'', capacity:'', vehicleCount:'', description:'', amenities:[] });
        setSelectedImages([]);
        fetchRooms();
      } else {
        console.error(res.message);
      }
    } catch (e) { console.error(e); }
    finally { setCreating(false); }
  };
  const validateEditForm = () => {
    const errors = {};
    if (!editFormData.roomNumber) errors.roomNumber = t('rooms.validation.roomNumberRequired');
  if (editFormData.roomNumber && !editRoomNumberAvailable) errors.roomNumber = t('rooms.validation.roomNumberDuplicate');
    if (editFormData.price === '' || Number(editFormData.price) < 0) errors.price = t('rooms.validation.priceInvalid');
    if (editFormData.deposit === '' || Number(editFormData.deposit) < 0) errors.deposit = t('rooms.validation.depositInvalid');
    if (editFormData.capacity !== '' && Number(editFormData.capacity) < 1) errors.capacity = t('rooms.validation.capacityInvalid');
    return errors;
  };
  const submitEdit = async () => {
    const errors = validateEditForm();
    setEditFormErrors(errors);
    if (Object.keys(errors).length) return;
    setSavingEdit(true);
    try {
      const payload = {
        roomNumber: editFormData.roomNumber,
        price: Number(editFormData.price),
        deposit: Number(editFormData.deposit),
        electricityPrice: Number(editFormData.electricityPrice) || 3500,
        waterPrice: Number(editFormData.waterPrice) || 25000,
        servicePrice: Number(editFormData.servicePrice) || 150000,
        area: editFormData.area ? Number(editFormData.area) : undefined,
        capacity: editFormData.capacity ? Number(editFormData.capacity) : undefined,
        vehicleCount: editFormData.vehicleCount ? Number(editFormData.vehicleCount) : undefined,
        description: editFormData.description,
        amenities: editFormData.amenities
      };
      const res = await roomsAPI.updateRoom(editingRoomId, payload);
      if (!res.success) return console.error(res.message);
      // Upload newly added images if any
      if (newEditImages.length) {
        setEditUploadingImages(true);
        try {
          await roomsAPI.uploadRoomImages(editingRoomId, newEditImages.slice(0, 5 - (editFormData.images?.length||0)));
          setNewEditImages([]); // clear selection after successful upload
        } catch(e) { console.error('Upload edit images error', e); }
        finally { setEditUploadingImages(false); }
      }
      // Ensure fresh data (includes images) before closing
      await refreshRoomInList(editingRoomId);
      setShowEditModal(false);
    } catch (e) { console.error(e); }
    finally { setSavingEdit(false); }
  };
  const closeViewModal = () => { setShowViewModal(false); setViewRoom(null); setViewCarouselIndex(0); };
  const closeEditModal = () => { 
    setShowEditModal(false); 
    setEditingRoomId(null); 
    setNewEditImages([]);
    setEditFormData({
      roomNumber: '',
      price: '',
      deposit: '',
      electricityPrice: 3500,
      waterPrice: 25000,
      servicePrice: 150000,
      area: '',
      capacity: '',
      vehicleCount: '',
      description: '',
      amenities: [],
      images: []
    });
  };

  return (
    <>
    <div className="rooms-container">
      <SideBar />
      <div className="rooms-content">
        {/* Header */}
        <div className="rooms-header">
          <h1 className="rooms-title">{t('rooms.title')}</h1>
          <div className="header-actions">
            <div className="view-toggle">
              <button 
                className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                <i className="fas fa-th"></i>
              </button>
              <button 
                className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List View"
              >
                <i className="fas fa-list"></i>
              </button>
            </div>
            <button className="add-room-btn" onClick={openCreateModal}>
              <i className="fas fa-plus"></i>
              {t('rooms.addNew')}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="rooms-filters">
          <div className="filters-grid">
            <div className="filter-group">
              <label className="filter-label">{t('rooms.search')}</label>
              <input
                type="text"
                className="filter-input"
                placeholder={t('rooms.searchPlaceholder')}
                value={searchFilters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label className="filter-label">{t('rooms.priceFrom')}</label>
              <input
                type="number"
                className="filter-input"
                placeholder="0"
                value={searchFilters.priceMin}
                onChange={(e) => handleFilterChange('priceMin', e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label className="filter-label">{t('rooms.priceTo')}</label>
              <input
                type="number"
                className="filter-input"
                placeholder="10000000"
                value={searchFilters.priceMax}
                onChange={(e) => handleFilterChange('priceMax', e.target.value)}
              />
            </div>
            <div className="filter-group">
              <button className="search-btn" onClick={fetchRooms}>
                <i className="fas fa-search"></i> {t('rooms.search')}
              </button>
            </div>
            <div className="filter-group">
              <button className="reset-btn" onClick={resetFilters}>
                <i className="fas fa-redo"></i> {t('rooms.reset')}
              </button>
            </div>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="status-tabs">
          {Object.entries(statusLabels).map(([status, label]) => (
            <button
              key={status}
              className={`status-tab ${activeTab === status ? 'active' : ''}`}
              onClick={() => setActiveTab(status)}
            >
              {label}
              <span className="tab-count">{statusCounts[status]}</span>
            </button>
          ))}
        </div>

        {/* Rooms Grid */}
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>{t('rooms.loadingList')}</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="empty-container">
            <div className="empty-icon">🏠</div>
            <h3 className="empty-text">{t('rooms.noRoomsFound')}</h3>
            <p className="empty-description">{t('rooms.noRoomsDescription')}</p>
          </div>
        ) : (
          <div className={`rooms-${viewMode}`}>
            {viewMode === 'grid' ? (
              rooms.map(room => {
                const imgs = room.images || [];
                const activeIdx = (carouselIndex[room.id] ?? 0) % (imgs.length || 1);
                const showIcon = imgs.length === 0;
                return (
                <div key={room.id} className="room-card">
                  <div className={`room-image ${imgs.length? 'has-images':''}`}
                    onMouseEnter={()=>{
                      if (!(room.id in carouselIndex) && imgs.length) setCarouselIndex(prev=>({...prev,[room.id]:0}));
                    }}
                  >
                    {showIcon && <i className="fas fa-home" style={{ fontSize: '48px' }}></i>}
                    {!showIcon && (
                      <div className="room-image-wrapper">
                        {imgs.map((src,idx)=>(
                          <div key={idx} className={`room-slide ${idx===activeIdx?'active':''}`}>
                            <img src={src} alt={`room-${room.name}-${idx}`} />
                          </div>
                        ))}
                        {imgs.length>1 && (
                          <>
                            <button type="button" className="nav-btn prev" onClick={(e)=>{e.stopPropagation(); setCarouselIndex(p=>({...p,[room.id]: ( ( (p[room.id]??0) -1 + imgs.length) % imgs.length)}));}}>
                              <i className="fas fa-chevron-left"></i>
                            </button>
                            <button type="button" className="nav-btn next" onClick={(e)=>{e.stopPropagation(); setCarouselIndex(p=>({...p,[room.id]: ( ( (p[room.id]??0) +1) % imgs.length)}));}}>
                              <i className="fas fa-chevron-right"></i>
                            </button>
                            <div className="image-indicators">
                              {imgs.map((_,i)=>(
                                <span key={i} className={i===activeIdx?'active':''} onClick={(e)=>{e.stopPropagation(); setCarouselIndex(p=>({...p,[room.id]:i}));}} />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    <span className={getStatusBadgeClass(room.status)}>
                      {getStatusText(room.status)}
                    </span>
                  </div>
                  <div className="room-info">
                    <div className="room-header">
                      <h3 className="room-name">{room.name}</h3>
                      <div className="room-price">{formatPrice(room.price)}/{t('rooms.month')}</div>
                    </div>
                    
                    <div className="room-details">
                      <div className="room-detail">
                        <i className="fas fa-expand-arrows-alt"></i>
                        <span>{room.area}m²</span>
                      </div>
                      <div className="room-detail">
                        <i className="fas fa-user-friends"></i>
                        <span>{room.capacity || 1} {t('rooms.persons')}</span>
                      </div>
                      <div className="room-detail">
                        <i className="fas fa-motorcycle"></i>
                        <span>{room.vehicleCount || 0} {t('rooms.vehicles')}</span>
                      </div>
                      <div className="room-detail">
                        <i className="fas fa-star"></i>
                        <span>{room.amenities?.length || 0} {t('rooms.amenities')}</span>
                      </div>
                    </div>
                    
                    <p className="room-description">{room.description}</p>
                    
                    <div className="room-actions">
                      <button 
                        className="action-btn btn-view"
                        onClick={() => handleViewRoom(room.id)}
                      >
                        <i className="fas fa-eye"></i>
                        {t('rooms.actions.view')}
                      </button>
                      <button 
                        className="action-btn btn-edit"
                        onClick={() => handleEditRoom(room.id)}
                      >
                        <i className="fas fa-edit"></i>
                        {t('rooms.actions.edit')}
                      </button>
                      <button 
                        className="action-btn btn-delete"
                        onClick={() => handleDeleteRoom(room.id)}
                      >
                        <i className="fas fa-trash"></i>
                        {t('rooms.actions.delete')}
                      </button>
                    </div>
                  </div>
                </div>
              )})
            ) : (
              /* List View */
              rooms.map(room => {
                const imgs = room.images || [];
                const activeIdx = (carouselIndex[room.id] ?? 0) % (imgs.length || 1);
                const showIcon = imgs.length === 0;
                return (
                <div key={room.id} className="room-list-item">
                  <div className={`room-list-image ${imgs.length? 'has-images':''}`}
                    onMouseEnter={()=>{
                      if (!(room.id in carouselIndex) && imgs.length) setCarouselIndex(prev=>({...prev,[room.id]:0}));
                    }}
                  >
                    {showIcon && <i className="fas fa-home" style={{ fontSize: '32px' }}></i>}
                    {!showIcon && (
                      <div className="room-image-wrapper">
                        {imgs.map((src,idx)=>(
                          <div key={idx} className={`room-slide ${idx===activeIdx?'active':''}`}>
                            <img src={src} alt={`room-${room.name}-${idx}`} />
                          </div>
                        ))}
                        {imgs.length>1 && (
                          <>
                            <button type="button" className="nav-btn prev" onClick={(e)=>{e.stopPropagation(); setCarouselIndex(p=>({...p,[room.id]: ( ( (p[room.id]??0) -1 + imgs.length) % imgs.length)}));}}>
                              <i className="fas fa-chevron-left"></i>
                            </button>
                            <button type="button" className="nav-btn next" onClick={(e)=>{e.stopPropagation(); setCarouselIndex(p=>({...p,[room.id]: ( ( (p[room.id]??0) +1) % imgs.length)}));}}>
                              <i className="fas fa-chevron-right"></i>
                            </button>
                            <div className="image-indicators">
                              {imgs.map((_,i)=>(
                                <span key={i} className={i===activeIdx?'active':''} onClick={(e)=>{e.stopPropagation(); setCarouselIndex(p=>({...p,[room.id]:i}));}} />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    <span className={getStatusBadgeClass(room.status)}>
                      {getStatusText(room.status)}
                    </span>
                  </div>
                  
                  <div className="room-list-content">
                    <div className="room-list-header">
                      <div className="room-list-title">
                        <h3 className="room-name">{room.name}</h3>
                        <span className="room-capacity-badge">{room.capacity || 1} {t('rooms.persons')}</span>
                      </div>
                      <div className="room-list-price">
                        <div className="price-main">{formatPrice(room.price)}</div>
                        <div className="price-period">/{t('rooms.month')}</div>
                      </div>
                    </div>
                    
                    <div className="room-list-details">
                      <div className="detail-row">
                        <div className="detail-group">
                          <i className="fas fa-expand-arrows-alt"></i>
                          <span>{room.area}m²</span>
                        </div>
                        <div className="detail-group">
                          <i className="fas fa-user-friends"></i>
                          <span>{room.capacity || 1} {t('rooms.persons')}</span>
                        </div>
                        <div className="detail-group">
                          <i className="fas fa-motorcycle"></i>
                          <span>{room.vehicleCount || 0} {t('rooms.vehicles')}</span>
                        </div>
                        <div className="detail-group">
                          <i className="fas fa-star"></i>
                          <span>{room.amenities?.length || 0} {t('rooms.amenities')}</span>
                        </div>
                      </div>
                    </div>
                    
                    {room.description && (
                      <p className="room-list-description">{room.description}</p>
                    )}
                    
                    <div className="room-list-amenities">
                      {room.amenities?.slice(0, 5).map(amenity => {
                        // Handle both populated amenities and ID-only amenities
                        if (typeof amenity === 'object' && amenity.name) {
                          // Populated amenity object
                          return (
                            <span key={amenity._id} className="amenity-tag">
                              <i className={amenity.icon} style={{marginRight: '4px', fontSize: '12px'}}></i>
                              {amenity.name}
                            </span>
                          );
                        } else {
                          // ID-only amenity - find in availableAmenities
                          const amenityId = typeof amenity === 'string' ? amenity : amenity._id;
                          const foundAmenity = availableAmenities.find(a => a._id === amenityId);
                          return foundAmenity ? (
                            <span key={amenityId} className="amenity-tag">
                              <i className={foundAmenity.icon} style={{marginRight: '4px', fontSize: '12px'}}></i>
                              {foundAmenity.name}
                            </span>
                          ) : (
                            <span key={amenityId} className="amenity-tag">
                              {t('common.unknown')}
                            </span>
                          );
                        }
                      })}
                      {room.amenities?.length > 5 && (
                        <span className="amenity-tag more">+{room.amenities.length - 5}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="room-list-actions">
                    <button 
                      className="action-btn btn-view"
                      onClick={() => handleViewRoom(room.id)}
                      title={t('rooms.actions.view')}
                    >
                      <i className="fas fa-eye"></i>
                    </button>
                    <button 
                      className="action-btn btn-edit"
                      onClick={() => handleEditRoom(room.id)}
                      title={t('rooms.actions.edit')}
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button 
                      className="action-btn btn-delete"
                      onClick={() => handleDeleteRoom(room.id)}
                      title={t('rooms.actions.delete')}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              )})
            )}
          </div>
        )}

        {/* Pagination */}
        {rooms.length > 0 && (
          <div className="pagination">
            <button 
              className="pagination-btn"
              disabled={pagination.currentPage === 1}
              onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
            >
              <i className="fas fa-chevron-left"></i>
            </button>
            
            <span className="pagination-info">
              {t('rooms.pagination.page')} {pagination.currentPage} / {pagination.totalPages} 
              ({pagination.totalItems} {t('rooms.pagination.rooms')})
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
    {showCreateModal && (
      <div className="room-modal-backdrop">
        <div className="room-modal">
          <div className="room-modal-header">
            <h2 className="room-modal-title">{t('rooms.form.modalTitle')}</h2>
            <button className="room-modal-close" onClick={closeCreateModal}>×</button>
          </div>
          <div className="room-form-grid">
            <div className="room-form-group">
              <label className="room-form-label">{t('rooms.form.roomNumber')} *</label>
              <input className="room-form-input" value={formData.roomNumber} onChange={e=>handleFormChange('roomNumber', e.target.value)} style={{borderColor: formData.roomNumber && !roomNumberChecking && !roomNumberAvailable ? '#dc2626' : undefined}} />
              {roomNumberChecking && <div style={{fontSize:'12px',color:'#64748b'}}>{t('rooms.validation.checking')}</div>}
              {!roomNumberChecking && formData.roomNumber && !roomNumberAvailable && <div className="error-text">{t('rooms.validation.roomNumberDuplicate')}</div>}
              {formErrors.roomNumber && <div className="error-text">{formErrors.roomNumber}</div>}
            </div>
            <div className="room-form-group">
              <label className="room-form-label">{t('rooms.form.price')} *</label>
              <input type="text" className="room-form-input" value={formData.price === '' ? '' : formatWithCommas(formData.price)}
                onChange={e=>handleMoneyInlineChange('price', e.target.value)}
                onKeyDown={e=>handleMoneyInlineKey(e,'price')}
                placeholder="0" />
              {formErrors.price && <div className="error-text">{formErrors.price}</div>}
            </div>
            <div className="room-form-group">
              <label className="room-form-label">{t('rooms.form.deposit')} *</label>
              <input type="text" className="room-form-input" value={formData.deposit === '' ? '' : formatWithCommas(formData.deposit)}
                onChange={e=>handleMoneyInlineChange('deposit', e.target.value)}
                onKeyDown={e=>handleMoneyInlineKey(e,'deposit')}
                placeholder="0" />
              {formErrors.deposit && <div className="error-text">{formErrors.deposit}</div>}
            </div>
            
            <div className="room-form-group">
              <label className="room-form-label">{t('rooms.form.electricityPrice')}</label>
              <input 
                type="text" 
                className="room-form-input" 
                value={formData.electricityPrice === '' ? '' : formatWithCommas(formData.electricityPrice)}
                onChange={e=>handleMoneyInlineChange('electricityPrice', e.target.value)}
                onKeyDown={e=>handleMoneyInlineKey(e,'electricityPrice')}
                placeholder="3,500" 
              />
              <span className="form-helper-text">{t('rooms.form.electricityPriceUnit')}</span>
            </div>
            
            <div className="room-form-group">
              <label className="room-form-label">{t('rooms.form.waterPrice')}</label>
              <input 
                type="text" 
                className="room-form-input" 
                value={formData.waterPrice === '' ? '' : formatWithCommas(formData.waterPrice)}
                onChange={e=>handleMoneyInlineChange('waterPrice', e.target.value)}
                onKeyDown={e=>handleMoneyInlineKey(e,'waterPrice')}
                placeholder="25,000" 
              />
              <span className="form-helper-text">{t('rooms.form.waterPriceUnit')}</span>
            </div>
            
            <div className="room-form-group">
              <label className="room-form-label">{t('rooms.form.servicePrice')}</label>
              <input 
                type="text" 
                className="room-form-input" 
                value={formData.servicePrice === '' ? '' : formatWithCommas(formData.servicePrice)}
                onChange={e=>handleMoneyInlineChange('servicePrice', e.target.value)}
                onKeyDown={e=>handleMoneyInlineKey(e,'servicePrice')}
                placeholder="150,000" 
              />
              <span className="form-helper-text">{t('rooms.form.servicePriceUnit')}</span>
            </div>
            
            <div className="room-form-group">
              <label className="room-form-label">{t('rooms.form.area')}</label>
              <input type="number" className="room-form-input" value={formData.area} onChange={e=>handleFormChange('area', e.target.value)} />
            </div>
            <div className="room-form-group">
              <label className="room-form-label">{t('rooms.form.capacity')}</label>
              <input type="number" min="1" step="1" className="room-form-input" value={formData.capacity} onChange={e=>{
                const v = e.target.value;
                if (v==='') return handleFormChange('capacity','');
                const num = Math.max(1, parseInt(v,10)||1);
                handleFormChange('capacity', String(num));
              }} />
            </div>
            <div className="room-form-group">
              <label className="room-form-label">{t('rooms.form.vehicleCount')}</label>
              <input type="number" min="0" step="1" className="room-form-input" value={formData.vehicleCount} onChange={e=>{
                const v = e.target.value;
                if (v==='') return handleFormChange('vehicleCount','');
                const num = Math.max(0, parseInt(v,10)||0);
                handleFormChange('vehicleCount', String(num));
              }} />
            </div>
            
            <div className="room-form-group full">
              <label className="room-form-label">{t('rooms.form.description')}</label>
              <textarea className="room-form-textarea" value={formData.description} onChange={e=>handleFormChange('description', e.target.value)} />
            </div>
            <div className="room-form-group full">
              <label className="room-form-label">{t('rooms.form.amenities')}</label>
              <div className="amenities-list" style={{gap:'12px'}}>
                {availableAmenities.map(amenity => (
                   <label key={amenity._id} style={{display:'flex',alignItems:'center',gap:'6px',background:'#f8fafc',padding:'8px 12px',borderRadius:'10px',border:'1px solid #e2e8f0',cursor:'pointer'}}>
                     <input
                       type="checkbox"
                       checked={formData.amenities.includes(amenity._id)}
                       onChange={()=>toggleAmenity(amenity._id)}
                     />
                     <i className={amenity.icon} style={{fontSize:'14px',color:'#667eea',width:'16px'}}></i>
                     <span style={{fontSize:'13px',fontWeight:600}}>{amenity.name}</span>
                   </label>
                ))}
                {availableAmenities.length === 0 && (
                  <div style={{fontSize:'12px', color:'#475569', padding:'8px'}}>
                    Chưa có tiện ích nào. Hãy thêm tiện ích trong phần quản lý tiện ích.
                  </div>
                )}
               </div>
             </div>
            <div className="room-form-group full">
              <label className="room-form-label">{t('rooms.form.imagesLabel')}</label>
              <input type="file" accept="image/*" multiple onChange={e=>{
                const files = Array.from(e.target.files||[]).slice(0,5);
                setSelectedImages(files);
              }} />
              {selectedImages.length>0 && (
                <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
                  {selectedImages.map((f,i)=>(
                    <div key={i} style={{position:'relative'}}>
                      <img src={URL.createObjectURL(f)} alt="preview" style={{width:70,height:70,objectFit:'cover',borderRadius:6,border:'1px solid #e2e8f0'}} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="room-modal-footer">
            <button className="btn-secondary" onClick={closeCreateModal}>{t('rooms.form.cancel')}</button>
            <button className="btn-primary" disabled={creating || uploadingImages || roomNumberChecking || !roomNumberAvailable} onClick={submitCreate}>{(creating||uploadingImages) ? (uploadingImages? t('rooms.form.uploading') : t('rooms.form.creating')) : t('rooms.form.create')}</button>
          </div>
        </div>
      </div>
    )}
    {showViewModal && viewRoom && (
      <div className="room-modal-backdrop">
        <div className="room-modal" style={{maxWidth:'860px'}}>
          <div className="room-modal-header">
            <h2 className="room-modal-title">{t('rooms.actions.view')} #{viewRoom.roomNumber}</h2>
            <button className="room-modal-close" onClick={closeViewModal}>×</button>
          </div>
          <div style={{padding:'10px 18px 20px'}}>
            <div className="room-view-gallery room-image has-images">
              {viewRoom.images && viewRoom.images.length ? (
                <div className="room-image-wrapper">
                  {viewRoom.images.map((url, idx) => (
                    <div key={idx} className={`room-slide ${idx===viewCarouselIndex?'active':''}`}>
                      <img src={url} alt={`room-${idx}`} />
                    </div>
                  ))}
                  {viewRoom.images.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="nav-btn prev"
                        onClick={()=>setViewCarouselIndex((viewCarouselIndex - 1 + viewRoom.images.length) % viewRoom.images.length)}
                      >
                        <i className="fas fa-chevron-left"></i>
                      </button>
                      <button
                        type="button"
                        className="nav-btn next"
                        onClick={()=>setViewCarouselIndex((viewCarouselIndex + 1) % viewRoom.images.length)}
                      >
                        <i className="fas fa-chevron-right"></i>
                      </button>
                      <div className="image-indicators">
                        {viewRoom.images.map((_,i)=>(
                          <span key={i} className={i===viewCarouselIndex?'active':''} onClick={()=>setViewCarouselIndex(i)} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="room-view-empty">
                  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></svg>
                  <div style={{fontSize:13}}>{t('common.none')}</div>
                </div>
              )}
            </div>

            <div className="room-view-details-grid">
              <div>
                <div className="room-view-detail-label">{t('rooms.form.roomNumber')}</div>
                <div className="room-view-detail-value">{viewRoom.roomNumber}</div>
              </div>
              <div>
                <div className="room-view-detail-label">{t('rooms.form.capacity')}</div>
                <div className="room-view-detail-value">{viewRoom.capacity || 1} {t('rooms.persons')}</div>
              </div>
              <div>
                <div className="room-view-detail-label">{t('rooms.form.vehicleCount')}</div>
                <div className="room-view-detail-value">{viewRoom.vehicleCount || 0} {t('rooms.vehicles')}</div>
              </div>
              <div>
                <div className="room-view-detail-label">{t('rooms.form.price')}</div>
                <div className="room-view-detail-value">{formatPrice(viewRoom.price)}</div>
              </div>
              <div>
                <div className="room-view-detail-label">{t('rooms.form.deposit')}</div>
                <div className="room-view-detail-value">{formatPrice(viewRoom.deposit)}</div>
              </div>
              <div>
                <div className="room-view-detail-label">{t('rooms.form.area')}</div>
                <div className="room-view-detail-value">{viewRoom.area ?? '-'}</div>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <div className="room-view-detail-label">{t('rooms.form.amenities')}</div>
                <div className="room-view-detail-value" style={{fontWeight:400}}>
                  {(viewRoom.amenities||[]).length ? (viewRoom.amenities||[]).map(amenity => {
                    // Handle both populated amenities and ID-only amenities
                    if (typeof amenity === 'object' && amenity.name) {
                      // Populated amenity object
                      return amenity.name;
                    } else {
                      // ID-only amenity - find in availableAmenities
                      const amenityId = typeof amenity === 'string' ? amenity : amenity._id;
                      const foundAmenity = availableAmenities.find(a => a._id === amenityId);
                      return foundAmenity ? foundAmenity.name : t('common.unknown');
                    }
                  }).join(', ') : t('common.none')}
                </div>
              </div>
              {viewRoom.description && (
                <div style={{gridColumn:'1/-1'}}>
                  <div className="room-view-detail-label">{t('rooms.form.description')}</div>
                  <div className="room-view-detail-value" style={{fontWeight:400, lineHeight:1.5}}>{viewRoom.description}</div>
                </div>
              )}
            </div>
          </div>
          <div className="room-modal-footer">
            <button className="btn-secondary" onClick={closeViewModal}>{t('common.close')}</button>
          </div>
        </div>
      </div>
    )}
    {showEditModal && (
      <div className="room-modal-backdrop">
        <div className="room-modal">
          <div className="room-modal-header">
            <h2 className="room-modal-title">{t('rooms.form.editModalTitle') || 'Edit Room'}</h2>
            <button className="room-modal-close" onClick={closeEditModal}>×</button>
          </div>
          <div className="room-form-grid">
            <div className="room-form-group">
              <label className="room-form-label">{t('rooms.form.roomNumber')} *</label>
              <input className="room-form-input" value={editFormData.roomNumber} onChange={e=>setEditFormData(p=>({...p,roomNumber:e.target.value}))} style={{borderColor: editFormData.roomNumber && !editRoomNumberChecking && !editRoomNumberAvailable ? '#dc2626' : undefined}} />
              {editRoomNumberChecking && <div style={{fontSize:'12px',color:'#64748b'}}>{t('rooms.validation.checking')}</div>}
              {!editRoomNumberChecking && editFormData.roomNumber && !editRoomNumberAvailable && <div className="error-text">{t('rooms.validation.roomNumberDuplicate')}</div>}
              {editFormErrors.roomNumber && <div className="error-text">{editFormErrors.roomNumber}</div>}
            </div>
            <div className="room-form-group">
              <label className="room-form-label">{t('rooms.form.price')} *</label>
              <input type="text" className="room-form-input" value={editFormData.price === '' ? '' : formatWithCommas(editFormData.price)}
                onChange={e=>handleMoneyInlineChange('price', e.target.value, true)}
                onKeyDown={e=>handleMoneyInlineKey(e,'price', true)}
                placeholder="0" />
              {editFormErrors.price && <div className="error-text">{editFormErrors.price}</div>}
            </div>
            <div className="room-form-group">
              <label className="room-form-label">{t('rooms.form.deposit')} *</label>
              <input type="text" className="room-form-input" value={editFormData.deposit === '' ? '' : formatWithCommas(editFormData.deposit)}
                onChange={e=>handleMoneyInlineChange('deposit', e.target.value, true)}
                onKeyDown={e=>handleMoneyInlineKey(e,'deposit', true)}
                placeholder="0" />
              {editFormErrors.deposit && <div className="error-text">{editFormErrors.deposit}</div>}
            </div>
            
            <div className="room-form-group">
              <label className="room-form-label">{t('rooms.form.electricityPrice')}</label>
              <input 
                type="text" 
                className="room-form-input" 
                value={editFormData.electricityPrice === '' ? '' : formatWithCommas(editFormData.electricityPrice)}
                onChange={e=>handleMoneyInlineChange('electricityPrice', e.target.value, true)}
                onKeyDown={e=>handleMoneyInlineKey(e,'electricityPrice', true)}
                placeholder="3,500" 
              />
              <span className="form-helper-text">{t('rooms.form.electricityPriceUnit')}</span>
            </div>
            
            <div className="room-form-group">
              <label className="room-form-label">{t('rooms.form.waterPrice')}</label>
              <input 
                type="text" 
                className="room-form-input" 
                value={editFormData.waterPrice === '' ? '' : formatWithCommas(editFormData.waterPrice)}
                onChange={e=>handleMoneyInlineChange('waterPrice', e.target.value, true)}
                onKeyDown={e=>handleMoneyInlineKey(e,'waterPrice', true)}
                placeholder="25,000" 
              />
              <span className="form-helper-text">{t('rooms.form.waterPriceUnit')}</span>
            </div>
            
            <div className="room-form-group">
              <label className="room-form-label">{t('rooms.form.servicePrice')}</label>
              <input 
                type="text" 
                className="room-form-input" 
                value={editFormData.servicePrice === '' ? '' : formatWithCommas(editFormData.servicePrice)}
                onChange={e=>handleMoneyInlineChange('servicePrice', e.target.value, true)}
                onKeyDown={e=>handleMoneyInlineKey(e,'servicePrice', true)}
                placeholder="150,000" 
              />
              <span className="form-helper-text">{t('rooms.form.servicePriceUnit')}</span>
            </div>
            
            <div className="room-form-group">
              <label className="room-form-label">{t('rooms.form.area')}</label>
              <input type="number" className="room-form-input" value={editFormData.area} onChange={e=>setEditFormData(p=>({...p,area:e.target.value}))} />
            </div>
            <div className="room-form-group">
              <label className="room-form-label">{t('rooms.form.capacity')}</label>
              <input type="number" min="1" step="1" className="room-form-input" value={editFormData.capacity} onChange={e=>{
                const v = e.target.value;
                if (v==='') return setEditFormData(p=>({...p,capacity:''}));
                const num = Math.max(1, parseInt(v,10)||1);
                setEditFormData(p=>({...p,capacity:String(num)}));
              }} />
              {editFormErrors.capacity && <div className="error-text">{editFormErrors.capacity}</div>}
            </div>
            <div className="room-form-group">
              <label className="room-form-label">{t('rooms.form.vehicleCount')}</label>
              <input type="number" min="0" step="1" className="room-form-input" value={editFormData.vehicleCount} onChange={e=>{
                const v = e.target.value;
                if (v==='') return setEditFormData(p=>({...p,vehicleCount:''}));
                const num = Math.max(0, parseInt(v,10)||0);
                setEditFormData(p=>({...p,vehicleCount:String(num)}));
              }} />
            </div>
            <div className="room-form-group full">
              <label className="room-form-label">{t('rooms.form.description')}</label>
              <textarea className="room-form-textarea" value={editFormData.description} onChange={e=>setEditFormData(p=>({...p,description:e.target.value}))} />
            </div>
            <div className="room-form-group full">
              <label className="room-form-label">{t('rooms.form.amenities')}</label>
              <div className="amenities-list" style={{gap:'12px'}}>
                {availableAmenities.map(amenity => (
                   <label key={amenity._id} style={{display:'flex',alignItems:'center',gap:'6px',background:'#f8fafc',padding:'8px 12px',borderRadius:'10px',border:'1px solid #e2e8f0',cursor:'pointer'}}>
                     <input
                       type="checkbox"
                       checked={editFormData.amenities.includes(amenity._id)}
                       onChange={()=>toggleEditAmenity(amenity._id)}
                     />
                     <i className={amenity.icon} style={{fontSize:'14px',color:'#667eea',width:'16px'}}></i>
                     <span style={{fontSize:'13px',fontWeight:600}}>{amenity.name}</span>
                   </label>
                ))}
                {availableAmenities.length === 0 && (
                  <div style={{fontSize:'12px', color:'#475569', padding:'8px'}}>
                    Chưa có tiện ích nào. Hãy thêm tiện ích trong phần quản lý tiện ích.
                  </div>
                )}
               </div>
             </div>
            <div className="room-form-group full">
              <label className="room-form-label">{t('rooms.form.imagesCurrent')}</label>
              {(!editFormData.images || !editFormData.images.length) && <div style={{fontSize:12,color:'#64748b'}}>{t('rooms.form.imagesNone')}</div>}
              {editFormData.images?.length>0 && (
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {editFormData.images.map((url,idx)=>(
                    <div key={idx} className="image-thumb-wrapper" style={{width:70,height:70}}>
                      <img src={url} alt={'img-'+idx} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:6,border:'1px solid #e2e8f0'}} />
                      <button type="button" className="image-delete-btn" aria-label="Xóa ảnh" onClick={async()=>{
                        if (!window.confirm(t('rooms.form.deleteImageConfirm'))) return;
                        try {
                          await roomsAPI.deleteRoomImage(editingRoomId, url);
                          // Update local modal state
                          setEditFormData(p=>({...p, images: p.images.filter(i=>i!==url)}));
                          // Refresh grid item without closing modal
                          refreshRoomInList(editingRoomId, false);
                        } catch(e) { console.error(e); }
                      }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="room-form-group full">
              <label className="room-form-label">{t('rooms.form.imagesAddNew', { count: Math.max(0,5-(editFormData.images?.length||0)) })}</label>
              <input type="file" accept="image/*" multiple disabled={(editFormData.images?.length||0)>=5} onChange={e=>{
                const files = Array.from(e.target.files||[]);
                const remain = 5 - (editFormData.images?.length||0);
                setNewEditImages(files.slice(0, remain));
              }} />
              {newEditImages.length>0 && (
                <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
                  {newEditImages.map((f,i)=>(
                    <div key={i} style={{position:'relative'}}>
                      <img src={URL.createObjectURL(f)} alt={'new-'+i} style={{width:70,height:70,objectFit:'cover',borderRadius:6,border:'1px solid #e2e8f0'}} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="room-modal-footer">
            <button className="btn-secondary" onClick={closeEditModal}>{t('rooms.form.cancel')}</button>
            <button className="btn-primary" disabled={savingEdit || editUploadingImages || editRoomNumberChecking || !editRoomNumberAvailable} onClick={submitEdit}>{(savingEdit||editUploadingImages) ? (editUploadingImages? t('rooms.form.uploading') : (t('rooms.form.updating') || 'Updating...')) : (t('rooms.form.update') || 'Update')}</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default RoomsManagement;
