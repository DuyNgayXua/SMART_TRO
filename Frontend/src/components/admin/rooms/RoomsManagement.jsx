import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import SideBar from "../../common/adminSidebar";
import { useToast } from "../../../hooks/useToast";
import "../admin-global.css";
import "./rooms.css";
import roomsAPI from '../../../services/roomsAPI';
import amenitiesAPI from '../../../services/amenitiesAPI';
import depositContractsAPI from '../../../services/depositContractsAPI';
import contractsAPI from '../../../services/contractsAPI';
import tenantsAPI from '../../../services/tenantsAPI';
import api from '../../../services/api';

const RoomsManagement = () => {
  console.log('RoomsManagement component loaded');
  const { t } = useTranslation();
  console.log('useTranslation hook working');
  const { showToast } = useToast();
  console.log('useToast hook working');
  const [rooms, setRooms] = useState([]);
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
  const [depositContracts, setDepositContracts] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showContractOptionsModal, setShowContractOptionsModal] = useState(false);
  const [selectedRoomForContract, setSelectedRoomForContract] = useState(null);
  const [showDepositContractModal, setShowDepositContractModal] = useState(false);
  const [depositContractData, setDepositContractData] = useState({
    depositDate: new Date().toISOString().split('T')[0],
    expectedMoveInDate: '',
    tenantName: '',
    tenantPhone: '',
    depositAmount: '',
    notes: ''
  });
  const [depositContractErrors, setDepositContractErrors] = useState({});
  const [creatingDepositContract, setCreatingDepositContract] = useState(false);
  
  // Rental Contract Modal States
  const [showRentalContractModal, setShowRentalContractModal] = useState(false);
  const [rentalContractData, setRentalContractData] = useState({
    tenants: [{
      tenantName: '',
      tenantPhone: '',
      tenantId: '',
      tenantImages: [] // Array of max 5 images
    }],
    vehicles: [{
      licensePlate: '',
      vehicleType: '',
      ownerIndex: 0 // Index of tenant who owns this vehicle
    }],
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    deposit: '',
    monthlyRent: '',
    electricityPrice: 3500,
    waterPrice: 25000,
    waterPricePerPerson: 50000,
    waterChargeType: 'fixed', // 'fixed' or 'per_person'
    servicePrice: 150000,
    currentElectricIndex: '',
    currentWaterIndex: '',
    paymentCycle: 'monthly',
    notes: ''
  });
  const [rentalContractErrors, setRentalContractErrors] = useState({});
  const [creatingRentalContract, setCreatingRentalContract] = useState(false);
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
  const [openActionMenu, setOpenActionMenu] = useState(null); // Track which room's menu is open
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 }); // Track dropdown position
  // Clear temp create images when modal closed
  useEffect(()=>{ if(!showCreateModal) setSelectedImages([]); }, [showCreateModal]);
  // Clear temp edit images when modal closed
  useEffect(()=>{ if(!showEditModal) setNewEditImages([]); }, [showEditModal]);

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
    console.log('fetchRooms called with:', { activeTab, searchFilters, pagination });
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
      console.log('API params:', params);
      const res = await roomsAPI.searchRooms(params); // { success, data: { rooms, pagination } }
      console.log('API response:', res);
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
            amenities: r.amenities || [],
            // Keep original amenities structure for contract modals
            originalAmenities: r.amenities || []
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
      showToast('error', t('common.errors.loadFailed') || 'Lỗi tải dữ liệu');
    } finally { setLoading(false); }
  }, [activeTab, searchFilters, pagination.currentPage, pagination.itemsPerPage, showToast, t]);

  const fetchDepositContracts = useCallback(async () => {
    try {
      const res = await depositContractsAPI.getDepositContracts();
      if (res.success) {
        console.log('Fetched deposit contracts:', res.data);
        setDepositContracts(res.data || []); // Change: res.data instead of res.data.contracts
      }
    } catch (e) {
      console.error('Error loading deposit contracts:', e);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    fetchDepositContracts();
  }, [fetchRooms, fetchDepositContracts]);

  // Helper function to check if room has deposit contract
  const hasDepositContract = (roomNumber) => {
    console.log('=== CHECKING DEPOSIT CONTRACT ===');
    console.log('Room Number:', roomNumber);
    console.log('All deposit contracts:', depositContracts);
    console.log('Deposit contracts length:', depositContracts.length);
    
    if (!depositContracts || depositContracts.length === 0) {
      console.log('No deposit contracts found!');
      return false;
    }
    
    const hasDeposit = depositContracts.some(contract => {
      console.log('Checking contract:', contract);
      
      // Contract room structure from backend: { room: { roomNumber: "101", price: 5000000 } }
      const contractRoomNumber = contract.room?.roomNumber || contract.room;
      console.log('Contract room number:', contractRoomNumber, 'vs Room Number:', roomNumber);
      console.log('Contract status:', contract.status);
      
      // Check status - default is 'active' when created  
      const statusMatch = contract.status === 'active' || 
                         contract.status === 'confirmed' || 
                         contract.status === 'pending' ||
                         !contract.status; // Default case
      console.log('Status match:', statusMatch);
      
      // Room number comparison
      const roomMatch = contractRoomNumber === roomNumber || 
                       contractRoomNumber?.toString() === roomNumber?.toString();
      console.log('Room match:', roomMatch);
      
      const match = roomMatch && statusMatch;
      console.log('Final match result:', match);
      return match;
    });
    
    console.log(`Final result for room ${roomNumber}:`, hasDeposit);
    console.log('=== END CHECK ===');
    return hasDeposit;
  };

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

  const handleCancelDeposit = async (roomNumber) => {
    // Find deposit contract with populated room data
    const depositContract = depositContracts.find(contract => {
      const contractRoomNumber = contract.room?.roomNumber || contract.room;
      return contractRoomNumber === roomNumber && contract.status === 'active';
    });
    
    if (!depositContract) {
      showToast('error', 'Không tìm thấy hợp đồng cọc để hủy');
      return;
    }

    if (window.confirm(`Bạn có chắc chắn muốn hủy cọc cho phòng ${roomNumber}?`)) {
      try {
        // Update deposit contract status to 'cancelled'
        // Backend sẽ tự động update room status về 'available'
        const updateRes = await depositContractsAPI.updateDepositContractStatus(depositContract._id, 'cancelled');
        
        if (updateRes.success) {
          showToast('success', 'Đã hủy cọc thành công');
          fetchDepositContracts(); // Refresh deposit contracts
          fetchRooms(); // Refresh rooms
        } else {
          showToast('error', updateRes.message || 'Lỗi khi hủy cọc');
        }
      } catch (e) {
        console.error('Error canceling deposit:', e);
        showToast('error', 'Lỗi khi hủy cọc');
      }
    }
  };

  const handleCreateRentalContract = (roomNumber) => {
    // Find the room and deposit contract
    const room = rooms.find(r => r.name === roomNumber);
    const depositContract = depositContracts.find(contract => {
      const contractRoomNumber = contract.room?.roomNumber || contract.room;
      return contractRoomNumber === roomNumber && contract.status === 'active';
    });
    
    if (!room) {
      showToast('error', 'Không tìm thấy thông tin phòng');
      return;
    }
    
    if (!depositContract) {
      showToast('error', 'Không tìm thấy hợp đồng cọc');
      return;
    }
    
    // Set selected room for contract
    setSelectedRoomForContract(room);
    
    // Pre-fill rental contract data from deposit contract and room
    setRentalContractData({
      tenants: [{
        tenantName: depositContract.tenantName || '',
        tenantPhone: depositContract.tenantPhone || '',
        tenantId: '',
        tenantImages: []
      }],
      vehicles: [{
        licensePlate: '',
        vehicleType: '',
        ownerIndex: 0
      }],
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      deposit: depositContract.depositAmount || room.price || '',
      monthlyRent: room.price || '',
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
    
    // Clear errors and open modal
    setRentalContractErrors({});
    setShowRentalContractModal(true);
  };

  // Validate rental contract data
  const validateRentalContract = () => {
    const errors = {};
    
    // Validate tenants
    rentalContractData.tenants.forEach((tenant, index) => {
      if (!tenant.tenantName.trim()) {
        errors[`tenantName_${index}`] = 'Tên người thuê là bắt buộc';
      }
      
      if (!tenant.tenantPhone.trim()) {
        errors[`tenantPhone_${index}`] = 'Số điện thoại là bắt buộc';
      } else if (!/^\d{10}$/.test(tenant.tenantPhone.replace(/\s/g, ''))) {
        errors[`tenantPhone_${index}`] = 'Số điện thoại không hợp lệ';
      }
      
      if (!tenant.tenantId.trim()) {
        errors[`tenantId_${index}`] = 'CCCD/CMND là bắt buộc';
      }
    });
    
    if (!rentalContractData.startDate) {
      errors.startDate = 'Ngày bắt đầu là bắt buộc';
    }
    
    if (!rentalContractData.endDate) {
      errors.endDate = 'Ngày kết thúc là bắt buộc';
    } else if (new Date(rentalContractData.endDate) <= new Date(rentalContractData.startDate)) {
      errors.endDate = 'Ngày kết thúc phải sau ngày bắt đầu';
    }
    
    if (!rentalContractData.deposit || Number(rentalContractData.deposit) <= 0) {
      errors.deposit = 'Tiền cọc phải lớn hơn 0';
    }
    
    if (!rentalContractData.monthlyRent || Number(rentalContractData.monthlyRent) <= 0) {
      errors.monthlyRent = 'Tiền thuê phải lớn hơn 0';
    }
    
    if (!rentalContractData.electricityPrice || Number(rentalContractData.electricityPrice) < 0) {
      errors.electricityPrice = 'Giá điện không hợp lệ';
    }
    
    if (!rentalContractData.waterPrice || Number(rentalContractData.waterPrice) < 0) {
      errors.waterPrice = 'Giá nước không hợp lệ';
    }
    
    if (!rentalContractData.servicePrice || Number(rentalContractData.servicePrice) < 0) {
      errors.servicePrice = 'Phí dịch vụ không hợp lệ';
    }
    
    return errors;
  };

  // Helper function to scroll to first error field
  const scrollToFirstError = (errors) => {
    const firstErrorKey = Object.keys(errors)[0];
    if (!firstErrorKey) return;

    setTimeout(() => {
      // Simple approach: find any input with error styling
      const errorInputs = document.querySelectorAll('.form-input.error, .room-form-input[style*="border"], input.error');
      if (errorInputs.length > 0) {
        const firstErrorInput = errorInputs[0];
        firstErrorInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstErrorInput.focus();
        
        // Highlight briefly
        firstErrorInput.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.3)';
        setTimeout(() => {
          firstErrorInput.style.boxShadow = '';
        }, 2000);
      }
    }, 200);
  };

  // Submit rental contract
  const addTenant = () => {
    if (rentalContractData.tenants.length < selectedRoomForContract.capacity) {
      setRentalContractData(prev => ({
        ...prev,
        tenants: [...prev.tenants, {
          tenantName: '',
          tenantPhone: '',
          tenantId: '',
          tenantImages: [] // Initialize with empty array
        }]
      }));
    }
  };

  const removeTenant = (index) => {
    if (rentalContractData.tenants.length > 1) {
      setRentalContractData(prev => ({
        ...prev,
        tenants: prev.tenants.filter((_, i) => i !== index)
      }));
    }
  };

  const updateTenant = (index, field, value) => {
    setRentalContractData(prev => ({
      ...prev,
      tenants: prev.tenants.map((tenant, i) => 
        i === index ? { ...tenant, [field]: value } : tenant
      )
    }));
  };

  // Vehicle management functions
  const addVehicle = () => {
    const maxVehicles = selectedRoomForContract?.maxVehicles || 3;
    if (rentalContractData.vehicles.length < maxVehicles) {
      setRentalContractData(prev => ({
        ...prev,
        vehicles: [...prev.vehicles, { 
          licensePlate: '', 
          vehicleType: '', 
          ownerIndex: 0 
        }]
      }));
    }
  };

  const removeVehicle = (vehicleIndex) => {
    if (rentalContractData.vehicles.length > 0) {
      setRentalContractData(prev => ({
        ...prev,
        vehicles: prev.vehicles.filter((_, i) => i !== vehicleIndex)
      }));
    }
  };

  const updateVehicle = (vehicleIndex, field, value) => {
    setRentalContractData(prev => ({
      ...prev,
      vehicles: prev.vehicles.map((vehicle, i) =>
        i === vehicleIndex ? { ...vehicle, [field]: value } : vehicle
      )
    }));
  };

  // Image upload function - support multiple images (max 5)
  const handleTenantImageUpload = (tenantIndex, files) => {
    if (files && files.length > 0) {
      setRentalContractData(prev => ({
        ...prev,
        tenants: prev.tenants.map((tenant, i) => {
          if (i === tenantIndex) {
            const currentImages = tenant.tenantImages || [];
            const newImages = Array.from(files);
            const combinedImages = [...currentImages, ...newImages];
            
            // Limit to 5 images max
            const limitedImages = combinedImages.slice(0, 5);
            
            return { ...tenant, tenantImages: limitedImages };
          }
          return tenant;
        })
      }));
    }
  };

  // Remove tenant image
  const removeTenantImage = (tenantIndex, imageIndex) => {
    setRentalContractData(prev => ({
      ...prev,
      tenants: prev.tenants.map((tenant, i) => {
        if (i === tenantIndex) {
          const updatedImages = tenant.tenantImages.filter((_, idx) => idx !== imageIndex);
          return { ...tenant, tenantImages: updatedImages };
        }
        return tenant;
      })
    }));
  };

  // Format number with commas
  const formatNumberWithCommas = (num) => {
    if (!num) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Parse number from formatted string
  const parseFormattedNumber = (str) => {
    if (!str) return '';
    // Remove commas and keep only digits
    return str.toString().replace(/[^0-9]/g, '');
  };

  // Quick date selection functions
  const setEndDateQuick = (months) => {
    if (!rentalContractData.startDate) {
      setRentalContractErrors(prev => ({
        ...prev,
        startDate: 'Vui lòng chọn ngày bắt đầu trước'
      }));
      return;
    }
    
    const startDate = new Date(rentalContractData.startDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);
    
    setRentalContractData(prev => ({
      ...prev,
      endDate: endDate.toISOString().split('T')[0]
    }));
    
    // Clear any existing error
    if (rentalContractErrors.startDate === 'Vui lòng chọn ngày bắt đầu trước') {
      setRentalContractErrors(prev => {
        const newErrors = {...prev};
        delete newErrors.startDate;
        return newErrors;
      });
    }
  };

  const submitRentalContract = async () => {
    const errors = validateRentalContract();
    setRentalContractErrors(errors);

    // If there are errors, scroll to first error field
    if (Object.keys(errors).length) {
      scrollToFirstError(errors);
      showToast('error', 'Vui lòng kiểm tra và sửa các lỗi được đánh dấu');
      return;
    }

    setCreatingRentalContract(true);
    
    // Transaction state for rollback
    const transaction = {
      createdTenants: [],
      createdContract: null,
      uploadedImages: [],
      updatedRoom: false,
      updatedDepositContract: false,
      originalDepositContract: null
    };

    try {
      // 1. Tìm hợp đồng cọc (nếu có) để cập nhật trạng thái sau
      const depositContract = depositContracts.find(contract => {
        const contractRoomNumber = contract.room?.roomNumber || contract.room;
        return contractRoomNumber === selectedRoomForContract.name && contract.status === 'active';
      });
      
      if (depositContract) {
        transaction.originalDepositContract = depositContract;
      }

      // 2. PHASE 1: Tạo tenants
      showToast('info', 'Đang tạo thông tin khách thuê...');
      
      for (let i = 0; i < rentalContractData.tenants.length; i++) {
        const tenantData = rentalContractData.tenants[i];
        
        console.log('Creating tenant', i + 1, ':', tenantData);
        
        // Lấy vehicles của tenant này
        const tenantVehicles = rentalContractData.vehicles.filter(vehicle => 
          vehicle.ownerIndex === i && vehicle.licensePlate.trim()
        ).map(vehicle => ({
          licensePlate: vehicle.licensePlate,
          vehicleType: vehicle.vehicleType,
          notes: ''
        }));
        
        // Chuẩn bị dữ liệu tenant
        const tenantPayload = {
          fullName: tenantData.tenantName,
          phone: tenantData.tenantPhone,
          identificationNumber: tenantData.tenantId,
          landlord: null, // Sẽ được backend tự động gán
          room: selectedRoomForContract.id,
          leaseStart: rentalContractData.startDate,
          leaseEnd: rentalContractData.endDate,
          rentPrice: Number(rentalContractData.monthlyRent),
          deposit: Number(rentalContractData.deposit),
          status: 'active',
          notes: rentalContractData.notes,
          vehicles: tenantVehicles // Thêm vehicles của tenant này
        };

        console.log('Tenant payload:', tenantPayload);

        // Tạo tenant
        const tenantResponse = await tenantsAPI.createTenant(tenantPayload);
        
        console.log('Tenant response:', tenantResponse);
        
        if (tenantResponse.success) {
          const createdTenant = tenantResponse.data;
          transaction.createdTenants.push(createdTenant);

          // Upload hình ảnh sau khi tạo tenant thành công
          if (tenantData.tenantImages && tenantData.tenantImages.length > 0) {
            try {
              const uploadRes = await tenantsAPI.uploadTenantImages(createdTenant._id, tenantData.tenantImages);
              
              if (uploadRes.success) {
                console.log('Tenant images uploaded successfully:', uploadRes.data.images);
                transaction.uploadedImages.push({
                  tenantId: createdTenant._id,
                  images: uploadRes.data.images
                });
                
                // Cập nhật URLs hình ảnh vào rental contract data để hiển thị
                setRentalContractData(prev => ({
                  ...prev,
                  tenants: prev.tenants.map((tenant, idx) => 
                    idx === i ? { 
                      ...tenant, 
                      tenantImages: uploadRes.data.images.map(url => ({ 
                        url, 
                        isUploaded: true 
                      })) 
                    } : tenant
                  )
                }));
              }
            } catch (uploadError) {
              console.warn('Failed to upload tenant images:', uploadError);
              // Tiếp tục flow mà không có ảnh
            }
          }
        } else {
          console.error('Failed to create tenant:', tenantResponse);
          throw new Error(`Failed to create tenant ${i + 1}: ${tenantResponse.message}`);
        }
      }

      // 3. PHASE 2: Tạo contract
      showToast('info', 'Đang tạo hợp đồng...');
      
      const contractPayload = {
        room: selectedRoomForContract.id,
        tenants: transaction.createdTenants.map(t => t._id), // Gửi mảng tất cả tenants
        tenant: transaction.createdTenants[0]._id, // Primary tenant for backward compatibility
        landlord: null, // Backend sẽ tự động gán
        startDate: rentalContractData.startDate,
        endDate: rentalContractData.endDate,
        monthlyRent: Number(rentalContractData.monthlyRent),
        deposit: Number(rentalContractData.deposit),
        electricPrice: Number(rentalContractData.electricityPrice),
        waterPrice: Number(rentalContractData.waterPrice),
        servicePrice: Number(rentalContractData.servicePrice),
        // Thông tin xe
        vehicles: rentalContractData.vehicles.filter(v => v.licensePlate.trim()).map(vehicle => ({
          licensePlate: vehicle.licensePlate,
          vehicleType: vehicle.vehicleType,
          owner: transaction.createdTenants[vehicle.ownerIndex]?._id || transaction.createdTenants[0]._id
        })),
        notes: rentalContractData.notes,
        status: 'active'
      };
      
      console.log('Contract payload:', contractPayload);
      
      const contractResponse = await contractsAPI.createContract(contractPayload);
      
      console.log('Contract response:', contractResponse);
      
      if (contractResponse.success) {
        transaction.createdContract = contractResponse.data;
        
        // 4. PHASE 3: Cập nhật contract reference cho tenants
        for (const tenant of transaction.createdTenants) {
          await tenantsAPI.updateTenant(tenant._id, {
            contract: transaction.createdContract._id
          });
        }
        
        // 5. PHASE 4: Cập nhật trạng thái phòng
        showToast('info', 'Đang cập nhật trạng thái phòng...');
        await roomsAPI.updateRoom(selectedRoomForContract.id, {
          status: 'occupied',
          tenant: transaction.createdTenants[0]._id,
          leaseStart: rentalContractData.startDate,
          leaseEnd: rentalContractData.endDate
        });
        transaction.updatedRoom = true;

        // 6. PHASE 5: Cập nhật trạng thái hợp đồng cọc nếu có
        if (transaction.originalDepositContract) {
          showToast('info', 'Đang cập nhật hợp đồng cọc...');
          await depositContractsAPI.updateDepositContractStatus(
            transaction.originalDepositContract._id, 
            'fulfilled'
          );
          transaction.updatedDepositContract = true;
        }

        // 7. COMMIT: Thành công - đóng modal và refresh data
        showToast('info', 'Đang hoàn tất...');
        setShowRentalContractModal(false);
        setSelectedRoomForContract(null);
        
        showToast(
          'success',
          t('contracts.success.rentalCreated') || 'Hợp đồng thuê đã được tạo thành công!'
        );
        
        // Refresh UI
        setTimeout(() => {
          fetchRooms();
          fetchDepositContracts();
        }, 500);

      } else {
        throw new Error(contractResponse.message || 'Failed to create contract');
      }

    } catch (error) {
      console.error('Error creating rental contract:', error);
      
      // ROLLBACK: Hoàn tác tất cả các thay đổi
      showToast('info', 'Đang hoàn tác các thay đổi...');
      
      try {
        // Rollback room status if updated
        if (transaction.updatedRoom) {
          await roomsAPI.updateRoom(selectedRoomForContract.id, {
            status: 'available',
            tenant: null,
            leaseStart: null,
            leaseEnd: null
          });
        }

        // Rollback deposit contract status if updated
        if (transaction.updatedDepositContract && transaction.originalDepositContract) {
          await depositContractsAPI.updateDepositContractStatus(
            transaction.originalDepositContract._id, 
            'active'
          );
        }

        // Rollback contract if created
        if (transaction.createdContract) {
          await contractsAPI.deleteContract(transaction.createdContract._id);
        }

        // Rollback tenants if created
        for (const tenant of transaction.createdTenants) {
          await tenantsAPI.archiveTenant(tenant._id);
        }

        showToast('warning', 'Đã hoàn tác các thay đổi do có lỗi xảy ra');
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError);
        showToast('error', 'Có lỗi khi hoàn tác. Vui lòng kiểm tra dữ liệu thủ công.');
      }
      
      let errorMessage = t('contracts.error.createFailed') || 'Có lỗi xảy ra khi tạo hợp đồng thuê';
      
      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = t('common.unauthorized') || 'Bạn cần đăng nhập lại';
        } else if (error.response.status === 404) {
          errorMessage = t('contracts.error.roomNotFound') || 'Phòng không tồn tại';
        } else if (error.response.status === 400) {
          errorMessage = error.response.data?.message || t('contracts.error.invalidData') || 'Dữ liệu không hợp lệ';
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showToast('error', errorMessage);
    } finally {
      setCreatingRentalContract(false);
    }
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

  // Handle click on available room to show contract options
  const handleAvailableRoomClick = (room) => {
    setSelectedRoomForContract(room);
    setShowContractOptionsModal(true);
  };

  // Handle contract type selection
  const handleContractTypeSelect = (contractType) => {
    setShowContractOptionsModal(false);
    
    if (contractType === 'rental') {
      // Navigate to create rental contract
      console.log('Creating rental contract for room:', selectedRoomForContract);
      // TODO: Navigate to contract creation page or open contract modal
    } else if (contractType === 'deposit') {
      // Open deposit contract creation modal
      const defaultDepositAmount = selectedRoomForContract?.price ? String(selectedRoomForContract.price) : '';
      setDepositContractData({
        depositDate: new Date().toISOString().split('T')[0],
        expectedMoveInDate: '',
        tenantName: '',
        tenantPhone: '',
        depositAmount: defaultDepositAmount,
        notes: ''
      });
      setDepositContractErrors({});
      setShowDepositContractModal(true);
    }
  };

  // Handle deposit contract form changes
  const handleDepositContractChange = (field, value) => {
    if (field === 'tenantPhone') {
      // Format phone number: remove non-digits, limit to 11 chars
      const cleanValue = value.replace(/\D/g, '').slice(0, 11);
      setDepositContractData(prev => ({ ...prev, [field]: cleanValue }));
    } else {
      setDepositContractData(prev => ({ ...prev, [field]: value }));
    }
  };

  // Validate deposit contract form
  const validateDepositContract = () => {
    const errors = {};
    if (!depositContractData.tenantName.trim()) {
      errors.tenantName = t('contracts.validation.tenantNameRequired') || 'Tên người thuê là bắt buộc';
    }
    if (!depositContractData.tenantPhone.trim()) {
      errors.tenantPhone = t('contracts.validation.tenantPhoneRequired') || 'Số điện thoại là bắt buộc';
    } else if (!/^[0-9]{10,11}$/.test(depositContractData.tenantPhone.replace(/\s/g, ''))) {
      errors.tenantPhone = t('contracts.validation.tenantPhoneInvalid') || 'Số điện thoại không hợp lệ (10-11 số)';
    }
    if (!depositContractData.expectedMoveInDate) {
      errors.expectedMoveInDate = t('contracts.validation.expectedMoveInDateRequired') || 'Ngày dự kiến vào ở là bắt buộc';
    }
    if (!depositContractData.depositAmount || Number(depositContractData.depositAmount) <= 0) {
      errors.depositAmount = t('contracts.validation.depositAmountRequired') || 'Số tiền cọc không hợp lệ';
    }
    // Check if expected move-in date is after deposit date
    if (depositContractData.expectedMoveInDate && depositContractData.depositDate) {
      const depositDate = new Date(depositContractData.depositDate);
      const moveInDate = new Date(depositContractData.expectedMoveInDate);
      if (moveInDate <= depositDate) {
        errors.expectedMoveInDate = t('contracts.validation.moveInDateMustBeAfterDeposit') || 'Ngày vào ở phải sau ngày cọc';
      }
    }
    return errors;
  };

  // Submit deposit contract
  const submitDepositContract = async () => {
    const errors = validateDepositContract();
    setDepositContractErrors(errors);
    
    // If there are errors, scroll to first error field
    if (Object.keys(errors).length) {
      scrollToFirstError(errors);
      showToast('error', 'Vui lòng kiểm tra và sửa các lỗi được đánh dấu');
      return;
    }

    setCreatingDepositContract(true);
    try {
      const payload = {
        roomId: selectedRoomForContract.id,
        tenantName: depositContractData.tenantName,
        tenantPhone: depositContractData.tenantPhone,
        depositDate: depositContractData.depositDate,
        expectedMoveInDate: depositContractData.expectedMoveInDate,
        depositAmount: Number(depositContractData.depositAmount),
        notes: depositContractData.notes
      };
      
      const response = await depositContractsAPI.createDepositContract(payload);
      
      if (response.success) {
        // Close modal and refresh data
        setShowDepositContractModal(false);
        setSelectedRoomForContract(null);
        
        // Show success toast first
        showToast(
          'success',
          t('contracts.success.depositCreated') || 'Hợp đồng cọc đã được tạo thành công!'
        );
        
        // Refresh both rooms and deposit contracts to update UI
        // Add small delay to ensure backend has updated the data
        setTimeout(() => {
          fetchRooms();
          fetchDepositContracts();
        }, 500);
      } else {
        throw new Error(response.message || 'Failed to create deposit contract');
      }
    } catch (error) {
      console.error('Error creating deposit contract:', error);
      
      // Handle different types of errors
      let errorMessage = t('contracts.error.createFailed') || 'Có lỗi xảy ra khi tạo hợp đồng cọc';
      
      if (error.response) {
        // API returned an error response
        if (error.response.status === 401) {
          errorMessage = t('common.unauthorized') || 'Bạn cần đăng nhập lại';
        } else if (error.response.status === 404) {
          errorMessage = t('contracts.error.roomNotFound') || 'Phòng không tồn tại';
        } else if (error.response.status === 400) {
          errorMessage = error.response.data?.message || t('contracts.error.invalidData') || 'Dữ liệu không hợp lệ';
        }
      } else if (error.request) {
        // Network error
        errorMessage = t('common.networkError') || 'Lỗi kết nối mạng';
      }
      
      showToast('error', errorMessage);
    } finally {
      setCreatingDepositContract(false);
    }
  };

  // Close deposit contract modal
  const closeDepositContractModal = () => {
    setShowDepositContractModal(false);
    setSelectedRoomForContract(null);
    setDepositContractData({
      depositDate: new Date().toISOString().split('T')[0],
      expectedMoveInDate: '',
      tenantName: '',
      tenantPhone: '',
      depositAmount: '',
      notes: ''
    });
    setDepositContractErrors({});
  };

  // Close rental contract modal
  const closeRentalContractModal = () => {
    setShowRentalContractModal(false);
    setSelectedRoomForContract(null);
    setRentalContractData({
      tenants: [{
        tenantName: '',
        tenantPhone: '',
        tenantId: '',
        tenantImages: []
      }],
      vehicles: [{
        licensePlate: '',
        vehicleType: '',
        ownerIndex: 0
      }],
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      deposit: '',
      monthlyRent: '',
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
    setRentalContractErrors({});
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
    return `status-badge ${classes[status]}`;
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

  const handleMoneyInlineChange = (field, raw, edit=false, customSetter=null) => {
    const digits = raw.replace(/[^0-9]/g,'');
    if (customSetter) {
      customSetter(p=>({...p,[field]: digits}));
    } else if (edit) {
      setEditFormData(p=>({...p,[field]: digits}));
    } else {
      setFormData(p=>({...p,[field]: digits}));
    }
  };

  const handleMoneyInlineKey = (e, field, edit=false, customSetter=null) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const delta = 500000 * (e.key === 'ArrowUp' ? 1 : -1);
      if (customSetter) {
        customSetter(p=>{
          const current = p[field] === '' ? 0 : Number(p[field]);
          const next = Math.max(0, current + delta);
          return {...p,[field]: String(next)};
        });
      } else if (edit) {
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
          <div className="rooms-table-container">
            <table className="rooms-table">
              <thead>
                <tr>
                  <th>{t('rooms.table.room')}</th>
                  <th>{t('rooms.table.status')}</th>
                  <th>{t('rooms.table.price')}</th>
                  <th>{t('rooms.table.details')}</th>
                  <th>{t('rooms.table.amenities')}</th>
                  <th>{t('rooms.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room, index) => {
                  const isLastRow = index >= rooms.length - 2; // Last 2 rows
                  if (openActionMenu === room.id) {
                    console.log(`Room ${room.name} dropdown open, isLastRow:`, isLastRow, 'index:', index, 'total:', rooms.length);
                  }
                  return (
                    <tr key={room.id}>
                      <td>
                        <div className="room-info-simple">
                          <div className="room-name">{room.name}</div>
                          {room.description && (
                            <div className="room-description">{room.description}</div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="room-status">
                          <span className={getStatusBadgeClass(room.status)}>
                            {getStatusText(room.status)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="room-price">
                          <div className="price-main">{formatPrice(room.price)}</div>
                          <div className="price-period">/{t('rooms.month')}</div>
                        </div>
                      </td>
                      <td>
                        <div className="room-details">
                          <div className="detail-item">
                            <i className="fas fa-expand-arrows-alt"></i>
                            <span>{room.area}m²</span>
                          </div>
                          <div className="detail-item">
                            <i className="fas fa-user-friends"></i>
                            <span>{room.capacity || 1} {t('rooms.persons')}</span>
                          </div>
                          <div className="detail-item">
                            <i className="fas fa-motorcycle"></i>
                            <span>{room.vehicleCount || 0} {t('rooms.vehicles')}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="room-amenities">
                          <div className="amenities-count">
                            <i className="fas fa-list"></i>
                            <span>{room.amenities?.length || 0} {t('rooms.amenities')}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={`action-menu-container ${openActionMenu === room.id ? 'active' : ''}`}>
                          <button
                            className="action-menu-trigger"
                            onClick={(e) => {
                              e.stopPropagation();
                              
                              if (openActionMenu === room.id) {
                                setOpenActionMenu(null);
                                return;
                              }
                              
                              // Calculate position for fixed positioning
                              const buttonRect = e.target.getBoundingClientRect();
                              const viewportHeight = window.innerHeight;
                              const dropdownHeight = 200; // Estimated dropdown height
                              
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
                              setOpenActionMenu(room.id);
                            }}
                          >
                            <i className="fas fa-ellipsis-v"></i>
                          </button>
                          {openActionMenu === room.id && (
                            <div 
                              className="action-menu-dropdown fixed-position"
                              style={{
                                position: 'fixed',
                                top: `${dropdownPosition.top}px`,
                                left: `${dropdownPosition.left}px`,
                                zIndex: 2147483647
                              }}
                            >
                              {/* Available room without deposit - show create deposit contract */}
                              {room.status === 'available' && !hasDepositContract(room.name) && (
                                <button
                                  className="action-menu-item"
                                  onClick={() => {
                                    handleAvailableRoomClick(room);
                                    setOpenActionMenu(null);
                                  }}
                                >
                                  <i className="fas fa-file-contract"></i>
                                  {t('rooms.actions.createContract')}
                                </button>
                              )}
                              
                              {/* Room with deposit contract (available or reserved status) */}
                              {((room.status === 'available' || room.status === 'reserved' || room.status === 'deposited') && hasDepositContract(room.name)) && (
                                <>
                                  <button
                                    className="action-menu-item"
                                    onClick={() => {
                                      handleCreateRentalContract(room.name);
                                      setOpenActionMenu(null);
                                    }}
                                  >
                                    <i className="fas fa-file-contract"></i>
                                    Tạo hợp đồng thuê
                                  </button>
                                  <button
                                    className="action-menu-item danger"
                                    onClick={() => {
                                      handleCancelDeposit(room.name);
                                      setOpenActionMenu(null);
                                    }}
                                  >
                                    <i className="fas fa-times-circle"></i>
                                    Hủy cọc
                                  </button>
                                </>
                              )}
                              <button
                                className="action-menu-item"
                                onClick={() => {
                                  handleViewRoom(room.id);
                                  setOpenActionMenu(null);
                                }}
                              >
                                <i className="fas fa-eye"></i>
                                {t('rooms.actions.view')}
                              </button>
                              <button
                                className="action-menu-item"
                                onClick={() => {
                                  handleEditRoom(room.id);
                                  setOpenActionMenu(null);
                                }}
                              >
                                <i className="fas fa-edit"></i>
                                {t('rooms.actions.edit')}
                              </button>
                              <button
                                className="action-menu-item danger"
                                onClick={() => {
                                  handleDeleteRoom(room.id);
                                  setOpenActionMenu(null);
                                }}
                              >
                                <i className="fas fa-trash"></i>
                                {t('rooms.actions.delete')}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
            <button className="room-modal-close" disabled={creating || uploadingImages} onClick={closeCreateModal}>×</button>
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
            <button className="btn-secondary" disabled={creating || uploadingImages} onClick={closeCreateModal}>{t('rooms.form.cancel')}</button>
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

    {/* Contract Options Modal */}
    {showContractOptionsModal && (
      <div className="modal" onClick={() => setShowContractOptionsModal(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{t('contracts.create.selectType') || 'Chọn loại hợp đồng'}</h3>
            <button 
              className="modal-close-btn"
              onClick={() => setShowContractOptionsModal(false)}
            >
              ×
            </button>
          </div>
          <div className="modal-body">
            <p>{t('contracts.create.selectTypeDesc') || 'Bạn muốn tạo loại hợp đồng nào cho phòng này?'}</p>
            <div className="contract-options">
              <button 
                className="btn-contract-option rental-option"
                onClick={() => handleContractTypeSelect('rental')}
              >
                <div className="contract-option-icon">
                  <i className="fas fa-file-contract"></i>
                </div>
                <div className="contract-option-text">
                  <h4>{t('contracts.types.rental') || 'Hợp đồng thuê'}</h4>
                  <p>{t('contracts.types.rentalDesc') || 'Tạo hợp đồng thuê phòng dài hạn'}</p>
                </div>
              </button>
              <button 
                className="btn-contract-option deposit-option"
                onClick={() => handleContractTypeSelect('deposit')}
              >
                <div className="contract-option-icon">
                  <i className="fas fa-handshake"></i>
                </div>
                <div className="contract-option-text">
                  <h4>{t('contracts.types.deposit') || 'Hợp đồng đặt cọc'}</h4>
                  <p>{t('contracts.types.depositDesc') || 'Tạo hợp đồng đặt cọc giữ chỗ'}</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Deposit Contract Modal */}
    {showDepositContractModal && selectedRoomForContract && (
      <div className="room-modal-backdrop">
        <div className="room-modal" style={{maxWidth: '600px'}}>
          <div className="room-modal-header">
            <h2 className="room-modal-title">
              {t('contracts.create.depositTitle') || 'Tạo hợp đồng cọc'} - {selectedRoomForContract.name}
            </h2>
            <button className="room-modal-close" disabled={creatingDepositContract} onClick={closeDepositContractModal}>×</button>
          </div>
          
          <div className="room-form-grid">
            {/* Room Info Display */}
            <div className="room-form-group full">
              <div style={{
                background: '#f8fafc', 
                padding: '16px', 
                borderRadius: '8px', 
                border: '1px solid #e2e8f0',
                marginBottom: '16px'
              }}>
                <h4 style={{margin: '0 0 8px 0', color: '#374151'}}>
                  {t('rooms.info.title') || 'Thông tin phòng'}
                </h4>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px'}}>
                  <div>
                    <strong>{t('rooms.form.roomNumber') || 'Số phòng'}:</strong> {selectedRoomForContract.name}
                  </div>
                  <div>
                    <strong>{t('rooms.form.price') || 'Giá phòng'}:</strong> {formatPrice(selectedRoomForContract.price)}/{t('rooms.month') || 'tháng'}
                  </div>
                  <div>
                    <strong>{t('rooms.form.area') || 'Diện tích'}:</strong> {selectedRoomForContract.area || '-'}m²
                  </div>
                  <div>
                    <strong>{t('rooms.form.capacity') || 'Sức chứa'}:</strong> {selectedRoomForContract.capacity || 1} {t('rooms.persons') || 'người'}
                  </div>
                </div>
              </div>
            </div>

            {/* Deposit Date */}
            <div className="room-form-group">
              <label className="room-form-label">
                {t('contracts.form.depositDate') || 'Ngày cọc'} *
              </label>
              <input
                type="date"
                className={`room-form-input ${depositContractErrors.depositDate ? 'error' : ''}`}
                value={depositContractData.depositDate}
                onChange={(e) => handleDepositContractChange('depositDate', e.target.value)}
                disabled={creatingDepositContract}
              />
              {depositContractErrors.depositDate && (
                <div className="error-text">{depositContractErrors.depositDate}</div>
              )}
            </div>

            {/* Expected Move-in Date */}
            <div className="room-form-group">
              <label className="room-form-label">
                {t('contracts.form.expectedMoveInDate') || 'Ngày dự kiến vào ở'} *
              </label>
              <input
                type="date"
                className={`room-form-input ${depositContractErrors.expectedMoveInDate ? 'error' : ''}`}
                value={depositContractData.expectedMoveInDate}
                onChange={(e) => handleDepositContractChange('expectedMoveInDate', e.target.value)}
                min={depositContractData.depositDate}
                disabled={creatingDepositContract}
              />
              {depositContractErrors.expectedMoveInDate && (
                <div className="error-text">{depositContractErrors.expectedMoveInDate}</div>
              )}
            </div>

            {/* Tenant Name */}
            <div className="room-form-group">
              <label className="room-form-label">
                {t('contracts.form.tenantName') || 'Tên người thuê'} *
              </label>
              <input
                type="text"
                className={`room-form-input ${depositContractErrors.tenantName ? 'error' : ''}`}
                value={depositContractData.tenantName}
                onChange={(e) => handleDepositContractChange('tenantName', e.target.value)}
                placeholder={t('contracts.form.tenantNamePlaceholder') || 'Nhập tên người thuê'}
                disabled={creatingDepositContract}
              />
              {depositContractErrors.tenantName && (
                <div className="error-text">{depositContractErrors.tenantName}</div>
              )}
            </div>

            {/* Tenant Phone */}
            <div className="room-form-group">
              <label className="room-form-label">
                {t('contracts.form.tenantPhone') || 'Số điện thoại'} *
              </label>
              <input
                type="tel"
                className={`room-form-input ${depositContractErrors.tenantPhone ? 'error' : ''}`}
                value={depositContractData.tenantPhone}
                onChange={(e) => handleDepositContractChange('tenantPhone', e.target.value)}
                placeholder={t('contracts.form.tenantPhonePlaceholder') || 'Nhập số điện thoại'}
                disabled={creatingDepositContract}
              />
              {depositContractErrors.tenantPhone && (
                <div className="error-text">{depositContractErrors.tenantPhone}</div>
              )}
            </div>

            {/* Deposit Amount */}
            <div className="room-form-group full">
              <label className="room-form-label">
                {t('contracts.form.depositAmount') || 'Số tiền cọc'} *
              </label>
              <input
                type="text"
                className={`room-form-input ${depositContractErrors.depositAmount ? 'error' : ''}`}
                value={depositContractData.depositAmount === '' ? '' : formatWithCommas(depositContractData.depositAmount)}
                onChange={(e) => handleMoneyInlineChange('depositAmount', e.target.value, false, setDepositContractData)}
                onKeyDown={(e) => handleMoneyInlineKey(e, 'depositAmount', false, setDepositContractData)}
                placeholder="0"
                disabled={creatingDepositContract}
              />
              <span className="form-helper-text">
                {t('contracts.form.depositAmountHelper') || 'Số tiền người thuê đặt cọc để giữ chỗ'}
              </span>
              {depositContractErrors.depositAmount && (
                <div className="error-text">{depositContractErrors.depositAmount}</div>
              )}
            </div>

            {/* Notes */}
            <div className="room-form-group full">
              <label className="room-form-label">
                {t('contracts.form.notes') || 'Ghi chú'}
              </label>
              <textarea
                className="room-form-textarea"
                value={depositContractData.notes}
                onChange={(e) => handleDepositContractChange('notes', e.target.value)}
                placeholder={t('contracts.form.notesPlaceholder') || 'Ghi chú thêm về hợp đồng cọc...'}
                rows="3"
                disabled={creatingDepositContract}
              />
            </div>
          </div>

          <div className="room-modal-footer">
            <button className="btn-secondary" disabled={creatingDepositContract} onClick={closeDepositContractModal}>
              {t('common.cancel') || 'Hủy'}
            </button>
            <button 
              className="btn-primary" 
              disabled={creatingDepositContract}
              onClick={submitDepositContract}
            >
              {creatingDepositContract 
                ? (t('contracts.form.creating') || 'Đang tạo...') 
                : (t('contracts.form.createDeposit') || 'Tạo hợp đồng cọc')
              }
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Rental Contract Modal */}
    {showRentalContractModal && selectedRoomForContract && (
      <div className="room-modal-backdrop">
        <div className="room-modal rental-contract-modal">
          <div className="room-modal-header">
            <h2 className="room-modal-title">
              <i className="fas fa-file-contract"></i> Tạo hợp đồng thuê - {selectedRoomForContract.name}
            </h2>
            <button className="room-modal-close" disabled={creatingRentalContract} onClick={closeRentalContractModal}>×</button>
          </div>
          
          <div className="rental-contract-two-columns">
            {/* Left Column - Tenant Information */}
            <div className="rental-contract-left">
              {/* Tenant Information */}
              <div className="form-section tenant-section">
              <div className="section-header">
                <h3><i className="fas fa-users"></i> Thông tin người thuê ({rentalContractData.tenants.length}/{selectedRoomForContract.capacity})</h3>
                {rentalContractData.tenants.length < selectedRoomForContract.capacity && (
                  <button
                    type="button"
                    className="btn-add-tenant"
                    onClick={addTenant}
                    title="Thêm người thuê"
                  >
                    <i className="fas fa-plus"></i> Thêm người
                  </button>
                )}
              </div>
              
              {rentalContractData.tenants.map((tenant, index) => (
                <div key={index} className="tenant-item">
                  <div className="item-header">
                    <h4><i className="fas fa-user"></i>Người thuê {index + 1}</h4>
                    {rentalContractData.tenants.length > 1 && (
                      <button
                        type="button"
                        className="btn-remove-tenant"
                        onClick={() => removeTenant(index)}
                        title="Xóa người thuê này"
                      >
                        <i className="fas fa-trash"></i> Xóa
                      </button>
                    )}
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">
                        Họ và tên <span className="required">*</span>
                      </label>
                      <div className="form-input-group">
                        <i className="input-icon fas fa-user"></i>
                        <input
                          type="text"
                          className={`form-input ${rentalContractErrors[`tenantName_${index}`] ? 'error' : ''}`}
                          value={tenant.tenantName}
                          onChange={(e) => updateTenant(index, 'tenantName', e.target.value)}
                          placeholder="Nhập họ và tên đầy đủ"
                        />
                      </div>
                      {rentalContractErrors[`tenantName_${index}`] && (
                        <div className="error-message">{rentalContractErrors[`tenantName_${index}`]}</div>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Số điện thoại <span className="required">*</span>
                      </label>
                      <div className="form-input-group">
                        <i className="input-icon fas fa-phone"></i>
                        <input
                          type="tel"
                          className={`form-input ${rentalContractErrors[`tenantPhone_${index}`] ? 'error' : ''}`}
                          value={tenant.tenantPhone}
                          onChange={(e) => updateTenant(index, 'tenantPhone', e.target.value)}
                          placeholder="0xxx xxx xxx"
                        />
                      </div>
                      {rentalContractErrors[`tenantPhone_${index}`] && (
                        <div className="error-message">{rentalContractErrors[`tenantPhone_${index}`]}</div>
                      )}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">
                        CCCD/CMND <span className="required">*</span>
                      </label>
                      <div className="form-input-group">
                        <i className="input-icon fas fa-id-card"></i>
                        <input
                          type="text"
                          className={`form-input ${rentalContractErrors[`tenantId_${index}`] ? 'error' : ''}`}
                          value={tenant.tenantId}
                          onChange={(e) => updateTenant(index, 'tenantId', e.target.value)}
                          placeholder="012345678901"
                        />
                      </div>
                      {rentalContractErrors[`tenantId_${index}`] && (
                        <div className="error-message">{rentalContractErrors[`tenantId_${index}`]}</div>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Ảnh (Tối đa 5 ảnh)
                      </label>
                      <div className="tenant-image-upload-container">
                        {/* Display existing images */}
                        {tenant.tenantImages && tenant.tenantImages.length > 0 && (
                          <div className="tenant-images-gallery">
                            {tenant.tenantImages.map((image, imgIndex) => {
                              // Handle both File objects and uploaded URLs
                              const imageUrl = image?.url 
                                ? image.url // Uploaded URL from server
                                : (typeof image === 'string' ? image : URL.createObjectURL(image)); // File object
                              
                              return (
                                <div key={imgIndex} className="tenant-image-item">
                                  <img 
                                    src={imageUrl} 
                                    alt={`Tenant ${imgIndex + 1}`} 
                                    className="tenant-image-preview"
                                  />
                                  <button 
                                    type="button"
                                    className="remove-image-btn"
                                    onClick={() => removeTenantImage(index, imgIndex)}
                                  >
                                    <i className="fas fa-times"></i>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        
                        {/* Upload button - only show if less than 5 images */}
                        {(!tenant.tenantImages || tenant.tenantImages.length < 5) && (
                          <div className="tenant-image-upload">
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => handleTenantImageUpload(index, e.target.files)}
                              className="image-upload-input"
                              id={`tenantImages_${index}`}
                              style={{display: 'none'}}
                            />
                            <label htmlFor={`tenantImages_${index}`} className="image-upload-btn">
                              <div className="image-upload-placeholder">
                                <i className="fas fa-plus-circle"></i>
                                <span>Thêm ảnh</span>
                                <small>({tenant.tenantImages ? tenant.tenantImages.length : 0}/5)</small>
                              </div>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {index < rentalContractData.tenants.length - 1 && <hr style={{margin: '16px 0'}} />}
                </div>
              ))}
            </div>

            {/* Vehicle Information Section */}
            <div className="form-section tenant-section">
              <div className="section-header">
                <h3><i className="fas fa-car"></i> Thông tin phương tiện ({rentalContractData.vehicles.length}/3)</h3>
                {rentalContractData.vehicles.length < 3 && (
                  <button
                    type="button"
                    className="btn-add-tenant"
                    onClick={addVehicle}
                    title="Thêm phương tiện"
                  >
                    <i className="fas fa-plus"></i> Thêm xe
                  </button>
                )}
              </div>
              
              {rentalContractData.vehicles.length > 0 ? (
                rentalContractData.vehicles.map((vehicle, vehicleIndex) => (
                  <div key={vehicleIndex} className="tenant-item">
                    <div className="item-header">
                      <h4><i className="fas fa-car"></i>Xe {vehicleIndex + 1}</h4>
                      <button
                        type="button"
                        className="btn-remove-tenant"
                        onClick={() => removeVehicle(vehicleIndex)}
                        title="Xóa xe này"
                      >
                        <i className="fas fa-trash"></i> Xóa
                      </button>
                    </div>
                    
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">
                          Biển số xe <span className="required">*</span>
                        </label>
                        <div className="form-input-group">
                          <i className="input-icon fas fa-id-card"></i>
                          <input
                            type="text"
                            className="form-input"
                            value={vehicle.licensePlate}
                            onChange={(e) => updateVehicle(vehicleIndex, 'licensePlate', e.target.value)}
                            placeholder="30A-123.45"
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">
                          Loại xe <span className="required">*</span>
                        </label>
                        <div className="form-input-group">
                          <i className="input-icon fas fa-car"></i>
                          <input
                            type="text"
                            className="form-input"
                            value={vehicle.vehicleType}
                            onChange={(e) => updateVehicle(vehicleIndex, 'vehicleType', e.target.value)}
                            placeholder="Xe máy, Ô tô, Xe đạp..."
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Chủ xe <span className="required">*</span>
                      </label>
                      <div className="form-input-group">
                        <i className="input-icon fas fa-user"></i>
                        <select
                          className="form-input"
                          value={vehicle.ownerIndex}
                          onChange={(e) => updateVehicle(vehicleIndex, 'ownerIndex', parseInt(e.target.value))}
                        >
                          {rentalContractData.tenants.map((tenant, tenantIndex) => (
                            <option key={tenantIndex} value={tenantIndex}>
                              {tenant.tenantName || `Người thuê ${tenantIndex + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    {vehicleIndex < rentalContractData.vehicles.length - 1 && <hr style={{margin: '16px 0'}} />}
                  </div>
                ))
              ) : (
                <div className="no-vehicles-message">
                  <i className="fas fa-car"></i>
                  <p>Chưa có thông tin phương tiện nào</p>
                  <small>Nhấn "Thêm xe" để thêm thông tin phương tiện</small>
                </div>
              )}
            </div>
            </div>

            {/* Right Column - Room & Service Information */}
            <div className="rental-contract-right">
              {/* Room Information */}
              <div className="form-section">
                <h3><i className="fas fa-home"></i> Thông tin phòng</h3>
                
                <div className="room-info-card">
                  <div className="room-info-item">
                    <span className="info-label">Tên phòng:</span>
                    <span className="info-value">{selectedRoomForContract.name}</span>
                  </div>
                  <div className="room-info-item">
                    <span className="info-label">Sức chứa:</span>
                    <span className="info-value">{selectedRoomForContract.capacity} người</span>
                  </div>
                  <div className="room-info-item">
                    <span className="info-label">Diện tích:</span>
                    <span className="info-value">{selectedRoomForContract.area} m²</span>
                  </div>
                  <div className="room-info-item">
                    <span className="info-label">Giá phòng:</span>
                    <span className="info-value highlight">{Number(selectedRoomForContract.price).toLocaleString()} VNĐ</span>
                  </div>
                  
                  {/* Amenities */}
                  {selectedRoomForContract.amenities && selectedRoomForContract.amenities.length > 0 && (
                    <div className="room-info-item amenities-item">
                      <span className="info-label">Tiện ích:</span>
                      <div className="amenities-list" style={{
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '8px', 
                        marginTop: '8px'
                      }}>
                        {selectedRoomForContract.amenities.map((amenity, index) => (
                          <span 
                            key={amenity._id || index} 
                            className="amenity-tag"
                            style={{
                              display: 'inline-block',
                              padding: '4px 8px',
                              background: '#e3f2fd',
                              color: '#1976d2',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '500',
                              border: '1px solid #bbdefb'
                            }}
                          >
                            <i className={amenity.icon} style={{marginRight: '4px'}}></i>
                            {amenity.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

            {/* Contract Information */}
            <div className="form-section">
              <h3><i className="fas fa-calendar-alt"></i> Thông tin hợp đồng</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="startDate" className="form-label">
                    Ngày bắt đầu <span className="required">*</span>
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    className={`form-input ${rentalContractErrors.startDate ? 'error' : ''}`}
                    value={rentalContractData.startDate}
                    onChange={(e) => setRentalContractData(prev => ({...prev, startDate: e.target.value}))}
                  />
                  {rentalContractErrors.startDate && <div className="error-message">{rentalContractErrors.startDate}</div>}
                </div>

                <div className="form-group">
                  <label htmlFor="endDate" className="form-label">
                    Ngày kết thúc <span className="required">*</span>
                  </label>
                  <div className="date-input-container">
                    <input
                      type="date"
                      id="endDate"
                      className={`form-input ${rentalContractErrors.endDate ? 'error' : ''}`}
                      value={rentalContractData.endDate}
                      onChange={(e) => setRentalContractData(prev => ({...prev, endDate: e.target.value}))}
                    />
                    <div className="quick-date-buttons">
                      <button
                        type="button"
                        className="quick-date-btn"
                        onClick={() => setEndDateQuick(6)}
                        title="6 tháng từ ngày bắt đầu"
                      >
                        6T
                      </button>
                      <button
                        type="button"
                        className="quick-date-btn"
                        onClick={() => setEndDateQuick(12)}
                        title="1 năm từ ngày bắt đầu"
                      >
                        1N
                      </button>
                    </div>
                  </div>
                  {rentalContractErrors.endDate && <div className="error-message">{rentalContractErrors.endDate}</div>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="deposit" className="form-label">
                    Tiền cọc <span className="required">*</span>
                  </label>
                  <div className="form-input-group">
                    <i className="input-icon fas fa-money-bill-wave"></i>
                    <input
                      type="text"
                      id="deposit"
                      className={`form-input ${rentalContractErrors.deposit ? 'error' : ''}`}
                      value={formatNumberWithCommas(rentalContractData.deposit)}
                      onChange={(e) => {
                        const value = parseFormattedNumber(e.target.value);
                        setRentalContractData(prev => ({...prev, deposit: value}));
                      }}
                      placeholder="0"
                    />
                  </div>
                  {rentalContractErrors.deposit && <div className="error-message">{rentalContractErrors.deposit}</div>}
                </div>

                <div className="form-group">
                  <label htmlFor="monthlyRent" className="form-label">
                    Tiền thuê hàng tháng <span className="required">*</span>
                  </label>
                  <div className="form-input-group">
                    <i className="input-icon fas fa-home"></i>
                    <input
                      type="text"
                      id="monthlyRent"
                      className={`form-input ${rentalContractErrors.monthlyRent ? 'error' : ''}`}
                      value={formatNumberWithCommas(rentalContractData.monthlyRent)}
                      onChange={(e) => {
                        const value = parseFormattedNumber(e.target.value);
                        setRentalContractData(prev => ({...prev, monthlyRent: value}));
                      }}
                      placeholder="0"
                    />
                  </div>
                  {rentalContractErrors.monthlyRent && <div className="error-message">{rentalContractErrors.monthlyRent}</div>}
                </div>
              </div>
            </div>

            {/* Pricing Information */}
            <div className="form-section">
              <h3><i className="fas fa-calculator"></i> Chi phí dịch vụ</h3>
              
              <div className="service-pricing-grid">
                <div className="form-group">
                  <label htmlFor="electricityPrice" className="form-label">
                    Giá điện (VNĐ/kWh)
                  </label>
                  <div className="form-input-group">
                    <i className="input-icon fas fa-bolt"></i>
                    <input
                      type="text"
                      id="electricityPrice"
                      className="form-input"
                      value={formatNumberWithCommas(rentalContractData.electricityPrice)}
                      onChange={(e) => {
                        const value = parseFormattedNumber(e.target.value);
                        setRentalContractData(prev => ({...prev, electricityPrice: value}));
                      }}
                      placeholder="3,500"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="servicePrice" className="form-label">
                    Phí dịch vụ (VNĐ/tháng)
                  </label>
                  <div className="form-input-group">
                    <i className="input-icon fas fa-concierge-bell"></i>
                    <input
                      type="text"
                      id="servicePrice"
                      className="form-input"
                      value={formatNumberWithCommas(rentalContractData.servicePrice)}
                      onChange={(e) => {
                        const value = parseFormattedNumber(e.target.value);
                        setRentalContractData(prev => ({...prev, servicePrice: value}));
                      }}
                      placeholder="150,000"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Cách tính tiền nước
                  </label>
                  <select
                    className="form-input"
                    value={rentalContractData.waterChargeType}
                    onChange={(e) => setRentalContractData(prev => ({...prev, waterChargeType: e.target.value}))}
                  >
                    <option value="fixed">💧 Giá cố định</option>
                    <option value="per-person">👥 Tính theo người</option>
                  </select>
                </div>

                {rentalContractData.waterChargeType === 'fixed' && (
                  <div className="form-group">
                    <label htmlFor="waterPrice" className="form-label">
                      Giá nước<br />(VNĐ/khối)
                    </label>
                    <div className="form-input-group">
                      <i className="input-icon fas fa-tint"></i>
                      <input
                        type="text"
                        id="waterPrice"
                        className="form-input"
                        value={formatNumberWithCommas(rentalContractData.waterPrice)}
                        onChange={(e) => {
                          const value = parseFormattedNumber(e.target.value);
                          setRentalContractData(prev => ({...prev, waterPrice: value}));
                        }}
                        placeholder="25,000"
                      />
                    </div>
                  </div>
                )}

                {rentalContractData.waterChargeType === 'per-person' && (
                  <div className="form-group">
                    <label htmlFor="waterPricePerPerson" className="form-label">
                      Giá nước theo người (VNĐ/người/tháng)
                    </label>
                    <div className="form-input-group">
                      <i className="input-icon fas fa-user-friends"></i>
                      <input
                        type="text"
                        id="waterPricePerPerson"
                        className="form-input"
                        value={formatNumberWithCommas(rentalContractData.waterPricePerPerson)}
                        onChange={(e) => {
                          const value = parseFormattedNumber(e.target.value);
                          setRentalContractData(prev => ({...prev, waterPricePerPerson: value}));
                        }}
                        placeholder="50,000"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="paymentCycle" className="form-label">
                    Chu kỳ thanh toán
                  </label>
                  <select
                    id="paymentCycle"
                    className="form-input"
                    value={rentalContractData.paymentCycle}
                    onChange={(e) => setRentalContractData(prev => ({...prev, paymentCycle: e.target.value}))}
                  >
                    <option value="monthly">📅 Hàng tháng</option>
                    <option value="quarterly">📊 Hàng quý</option>
                    <option value="yearly">📈 Hàng năm</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="notes" className="form-label">
                    Ghi chú
                  </label>
                  <textarea
                    id="notes"
                    className="form-input"
                    value={rentalContractData.notes}
                    onChange={(e) => setRentalContractData(prev => ({...prev, notes: e.target.value}))}
                    placeholder="Nhập ghi chú bổ sung (tùy chọn)"
                    rows="3"
                    style={{resize: 'vertical', minHeight: '80px'}}
                  />
                </div>
              </div>

              {/* Current Meter Readings */}
              <div className="meter-readings-section">
                <h3><i className="fas fa-tachometer-alt"></i>Chỉ số điện nước hiện tại</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      Chỉ số điện (kWh) <span className="required">*</span>
                    </label>
                    <div className="form-input-group">
                      <i className="input-icon fas fa-bolt"></i>
                      <input
                        type="number"
                        min="0"
                        className={`form-input ${rentalContractErrors.currentElectricIndex ? 'error' : ''}`}
                        value={rentalContractData.currentElectricIndex}
                        onChange={(e) => setRentalContractData(prev => ({...prev, currentElectricIndex: e.target.value}))}
                        placeholder="Nhập chỉ số điện hiện tại"
                      />
                    </div>
                    {rentalContractErrors.currentElectricIndex && (
                      <div className="error-message">{rentalContractErrors.currentElectricIndex}</div>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">
                      Chỉ số nước (m³) <span className="required">*</span>
                    </label>
                    <div className="form-input-group">
                      <i className="input-icon fas fa-tint"></i>
                      <input
                        type="number"
                        min="0"
                        className={`form-input ${rentalContractErrors.currentWaterIndex ? 'error' : ''}`}
                        value={rentalContractData.currentWaterIndex}
                        onChange={(e) => setRentalContractData(prev => ({...prev, currentWaterIndex: e.target.value}))}
                        placeholder="Nhập chỉ số nước hiện tại"
                      />
                    </div>
                    {rentalContractErrors.currentWaterIndex && (
                      <div className="error-message">{rentalContractErrors.currentWaterIndex}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>

          <div className="room-modal-footer">
            <button type="button" className="btn-cancel" disabled={creatingRentalContract} onClick={closeRentalContractModal}>
              <i className="fas fa-times"></i> Hủy bỏ
            </button>
            <button 
              type="submit" 
              className="btn-submit"
              onClick={submitRentalContract}
              disabled={creatingRentalContract}
            >
              {creatingRentalContract 
                ? <><i className="fas fa-spinner fa-spin"></i> Đang tạo...</>
                : <><i className="fas fa-check"></i> Tạo hợp đồng thuê</>
              }
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default RoomsManagement;
