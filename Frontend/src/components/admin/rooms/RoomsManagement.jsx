import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import SideBar from "../../common/adminSidebar";
import "../admin-global.css";
import "./rooms.css";

// Mock data cho demo - di chuyển ra ngoài component để tránh re-render
const mockRooms = [
  {
    id: 1,
    name: "Phòng P101",
    status: "available",
    price: 3500000,
    area: 25,
    floor: 1,
    roomType: "single",
    description: "Phòng đơn đầy đủ tiện nghi, view đẹp, gần trung tâm thành phố",
    images: [],
    amenities: ["Điều hòa", "Tủ lạnh", "Wifi", "Máy nóng lạnh"]
  },
  {
    id: 2,
    name: "Phòng P201",
    status: "occupied",
    price: 4200000,
    area: 30,
    floor: 2,
    roomType: "double",
    description: "Phòng đôi rộng rãi, đầy đủ nội thất cao cấp",
    images: [],
    amenities: ["Điều hòa", "Tủ lạnh", "Wifi", "Máy giặt"]
  },
  {
    id: 3,
    name: "Phòng P301",
    status: "maintenance",
    price: 3800000,
    area: 28,
    floor: 3,
    roomType: "single",
    description: "Phòng đang bảo trì, sửa chữa hệ thống điện nước",
    images: [],
    amenities: ["Điều hòa", "Tủ lạnh", "Wifi"]
  },
  {
    id: 4,
    name: "Phòng P102",
    status: "reserved",
    price: 3600000,
    area: 26,
    floor: 1,
    roomType: "single",
    description: "Phòng đã được đặt trước, khách sẽ dọn vào tuần sau",
    images: [],
    amenities: ["Điều hòa", "Tủ lạnh", "Wifi", "Ban công"]
  },
  {
    id: 5,
    name: "Phòng P401",
    status: "available",
    price: 5000000,
    area: 35,
    floor: 4,
    roomType: "suite",
    description: "Phòng suite cao cấp với không gian rộng rãi và view toàn cảnh",
    images: [],
    amenities: ["Điều hòa", "Tủ lạnh", "Wifi", "Máy giặt", "Bếp", "Ban công"]
  },
  {
    id: 6,
    name: "Phòng P202",
    status: "occupied",
    price: 4000000,
    area: 28,
    floor: 2,
    roomType: "double",
    description: "Phòng đôi với thiết kế hiện đại",
    images: [],
    amenities: ["Điều hòa", "Tủ lạnh", "Wifi"]
  }
];

const RoomsManagement = () => {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchFilters, setSearchFilters] = useState({
    search: '',
    status: '',
    priceMin: '',
    priceMax: '',
    roomType: ''
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 12
  });

  const statusLabels = {
    all: t('rooms.status.all'),
    available: t('rooms.status.available'),
    occupied: t('rooms.status.occupied'),
    maintenance: t('rooms.status.maintenance'),
    reserved: t('rooms.status.reserved')
  };

  const statusCounts = {
    all: mockRooms.length,
    available: mockRooms.filter(room => room.status === 'available').length,
    occupied: mockRooms.filter(room => room.status === 'occupied').length,
    maintenance: mockRooms.filter(room => room.status === 'maintenance').length,
    reserved: mockRooms.filter(room => room.status === 'reserved').length
  };

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      let filteredRooms = [...mockRooms];
      
      // Filter by status
      if (activeTab !== 'all') {
        filteredRooms = filteredRooms.filter(room => room.status === activeTab);
      }
      
      // Filter by search
      if (searchFilters.search) {
        filteredRooms = filteredRooms.filter(room =>
          room.name.toLowerCase().includes(searchFilters.search.toLowerCase()) ||
          room.description.toLowerCase().includes(searchFilters.search.toLowerCase())
        );
      }
      
      // Filter by room type
      if (searchFilters.roomType) {
        filteredRooms = filteredRooms.filter(room => room.roomType === searchFilters.roomType);
      }
      
      // Filter by price range
      if (searchFilters.priceMin) {
        filteredRooms = filteredRooms.filter(room => room.price >= parseInt(searchFilters.priceMin));
      }
      if (searchFilters.priceMax) {
        filteredRooms = filteredRooms.filter(room => room.price <= parseInt(searchFilters.priceMax));
      }
      
      // Pagination
      const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
      const endIndex = startIndex + pagination.itemsPerPage;
      const paginatedRooms = filteredRooms.slice(startIndex, endIndex);
      
      setRooms(paginatedRooms);
      setPagination(prev => ({
        ...prev,
        totalItems: filteredRooms.length,
        totalPages: Math.ceil(filteredRooms.length / prev.itemsPerPage)
      }));
    } catch (error) {
      console.error('Error loading rooms list:', error);
    } finally {
      setLoading(false);
    }
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
      priceMax: '',
      roomType: ''
    });
  };

  const handleViewRoom = (roomId) => {
    console.log('Xem chi tiết phòng:', roomId);
    // Navigate to room detail page
  };

  const handleEditRoom = (roomId) => {
    console.log('Sửa phòng:', roomId);
    // Navigate to edit room page
  };

  const handleDeleteRoom = async (roomId) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa phòng này?')) {
      try {
        // await roomsService.deleteRoom(roomId);
        console.log('Xóa phòng:', roomId);
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
      maintenance: 'status-maintenance',
      reserved: 'status-reserved'
    };
    return `room-status-badge ${classes[status]}`;
  };

  const getStatusText = (status) => {
    const texts = {
      available: t('rooms.status.available'),
      occupied: t('rooms.status.occupied'),
      maintenance: t('rooms.status.maintenance'),
      reserved: t('rooms.status.reserved')
    };
    return texts[status];
  };

  const getRoomTypeText = (type) => {
    const types = {
      single: t('rooms.types.single'),
      double: t('rooms.types.double'),
      suite: t('rooms.types.suite')
    };
    return types[type];
  };

  return (
    <div className="rooms-container">
      <SideBar />
      <div className="rooms-content">
        {/* Header */}
        <div className="rooms-header">
          <h1 className="rooms-title">{t('rooms.title')}</h1>
          <button className="add-room-btn">
            <i className="fas fa-plus"></i>
            {t('rooms.addNew')}
          </button>
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
              <label className="filter-label">{t('rooms.roomType')}</label>
              <select
                className="filter-select"
                value={searchFilters.roomType}
                onChange={(e) => handleFilterChange('roomType', e.target.value)}
              >
                <option value="">{t('rooms.allTypes')}</option>
                <option value="single">{t('rooms.types.single')}</option>
                <option value="double">{t('rooms.types.double')}</option>
                <option value="suite">{t('rooms.types.suite')}</option>
              </select>
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
            <p>Đang tải danh sách phòng...</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="empty-container">
            <div className="empty-icon">🏠</div>
            <h3 className="empty-text">{t('rooms.noRoomsFound')}</h3>
            <p className="empty-description">{t('rooms.noRoomsDescription')}</p>
          </div>
        ) : (
          <div className="rooms-grid">
            {rooms.map(room => (
              <div key={room.id} className="room-card">
                <div className="room-image">
                  <i className="fas fa-home" style={{ fontSize: '48px' }}></i>
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
                      <i className="fas fa-layer-group"></i>
                      <span>{t('rooms.floor')} {room.floor}</span>
                    </div>
                    <div className="room-detail">
                      <i className="fas fa-bed"></i>
                      <span>{getRoomTypeText(room.roomType)}</span>
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
            ))}
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
  );
};

export default RoomsManagement;
