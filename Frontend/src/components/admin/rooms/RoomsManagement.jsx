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
  const [statusCounts, setStatusCounts] = useState({ all:0, available:0, rented:0, reserved:0, expiring:0 });
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
  
  // Tenants Modal States
  const [showTenantsModal, setShowTenantsModal] = useState(false);
  const [selectedRoomForTenants, setSelectedRoomForTenants] = useState(null);
  const [roomTenants, setRoomTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [showAddTenantModal, setShowAddTenantModal] = useState(false);
  const [showEditTenantModal, setShowEditTenantModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [tenantFormData, setTenantFormData] = useState({
    fullName: '',
    phone: '',
    identificationNumber: '',
    address: '',
    vehicleLicensePlate: '',
    vehicleType: '',
    tenantImages: [] // Array of max 5 images like in contract form
  });
  const [tenantFormErrors, setTenantFormErrors] = useState({});
  const [savingTenant, setSavingTenant] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  
  // Vehicles Modal States
  const [showVehiclesModal, setShowVehiclesModal] = useState(false);
  const [selectedRoomForVehicles, setSelectedRoomForVehicles] = useState(null);
  const [roomVehicles, setRoomVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showEditVehicleModal, setShowEditVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [vehicleFormData, setVehicleFormData] = useState({
    licensePlate: '',
    vehicleType: '',
    ownerName: '',
    ownerPhone: '',
    notes: ''
  });
  const [vehicleFormErrors, setVehicleFormErrors] = useState({});
  const [savingVehicle, setSavingVehicle] = useState(false);
  
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
  
  // Contract edit mode states
  const [isContractEditMode, setIsContractEditMode] = useState(false);
  const [editingContractId, setEditingContractId] = useState(null);
  
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
    rented: t('rooms.status.rented'),
    reserved: t('rooms.status.reserved'),
    expiring: t('rooms.status.expiring')
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
          all: (stats.available?.count||0)+(stats.rented?.count||0)+(stats.reserved?.count||0)+(stats.expiring?.count||0),
          available: stats.available?.count||0,
          rented: stats.rented?.count||0,
          reserved: stats.reserved?.count||0,
          expiring: stats.expiring?.count||0
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
      showToast('error', t('contracts.error.depositContractNotFound'));
      return;
    }

    if (window.confirm(t('rooms.confirm.cancelDeposit', { roomNumber }))) {
      try {
        // Update deposit contract status to 'cancelled'
        // Backend sẽ tự động update room status về 'available'
        const updateRes = await depositContractsAPI.updateDepositContractStatus(depositContract._id, 'cancelled');
        
        if (updateRes.success) {
          showToast('success', t('contracts.success.depositCancelled'));
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
      showToast('error', t('rooms.error.roomInfoNotFound'));
      return;
    }
    
    if (!depositContract) {
      showToast('error', t('contracts.error.depositContractNotFound'));
      return;
    }
    
    // Reset edit mode for new contract
    setIsContractEditMode(false);
    setEditingContractId(null);
    
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
        errors[`tenantName_${index}`] = t('validation.tenantNameRequired');
      }
      
      if (!tenant.tenantPhone.trim()) {
        errors[`tenantPhone_${index}`] = t('validation.phoneRequired');
      } else if (!/^\d{10}$/.test(tenant.tenantPhone.replace(/\s/g, ''))) {
        errors[`tenantPhone_${index}`] = t('validation.invalidPhoneNumber');
      }
      
      if (!tenant.tenantId.trim()) {
        errors[`tenantId_${index}`] = t('validation.idRequired');
      }
    });
    
    if (!rentalContractData.startDate) {
      errors.startDate = t('validation.startDateRequired');
    }
    
    if (!rentalContractData.endDate) {
      errors.endDate = t('validation.endDateRequired');
    } else if (new Date(rentalContractData.endDate) <= new Date(rentalContractData.startDate)) {
      errors.endDate = t('validation.endDateMustBeAfterStartDate');
    }
    
    if (!rentalContractData.deposit || Number(rentalContractData.deposit) <= 0) {
      errors.deposit = 'Tiền cọc phải lớn hơn 0';
    }
    
    if (!rentalContractData.monthlyRent || Number(rentalContractData.monthlyRent) <= 0) {
      errors.monthlyRent = 'Tiền thuê phải lớn hơn 0';
    }
    
    if (!rentalContractData.electricityPrice || Number(rentalContractData.electricityPrice) < 0) {
      errors.electricityPrice = t('validation.invalidElectricityPrice');
    }
    
    if (!rentalContractData.waterPrice || Number(rentalContractData.waterPrice) < 0) {
      errors.waterPrice = t('validation.invalidWaterPrice');
    }
    
    // Validate waterPricePerPerson if waterChargeType is 'per_person'
    if (rentalContractData.waterChargeType === 'per_person') {
      if (!rentalContractData.waterPricePerPerson || Number(rentalContractData.waterPricePerPerson) < 0) {
        errors.waterPricePerPerson = t('validation.invalidWaterPricePerPerson');
      }
    }
    
    if (!rentalContractData.servicePrice || Number(rentalContractData.servicePrice) < 0) {
      errors.servicePrice = t('validation.invalidServicePrice');
    }
    
    // Validate current meter readings (optional but must be non-negative if provided)
    if (rentalContractData.currentElectricIndex && Number(rentalContractData.currentElectricIndex) < 0) {
      errors.currentElectricIndex = t('validation.electricIndexCannotBeNegative');
    }
    
    if (rentalContractData.currentWaterIndex && Number(rentalContractData.currentWaterIndex) < 0) {
      errors.currentWaterIndex = t('validation.waterIndexCannotBeNegative');
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
        startDate: t('validation.pleaseSelectStartDateFirst')
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
    if (rentalContractErrors.startDate === t('validation.pleaseSelectStartDateFirst')) {
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
      showToast('error', t('rooms.messages.validateErrors'));
      return;
    }

    setCreatingRentalContract(true);
    
    // Transaction state for rollback
    const transaction = {
      originalRoomStatus: selectedRoomForContract.status, // Lưu status gốc
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

      // 2. PHASE 1: Xử lý tenant information (update existing + create new)
      // Show single loading message at the start
      showToast('info', isContractEditMode ? t('contracts.updating') : t('contracts.creating'));
      
      for (let i = 0; i < rentalContractData.tenants.length; i++) {
        const tenantData = rentalContractData.tenants[i];
        const isUpdatingExisting = isContractEditMode && tenantData._id;
        
        // Xử lý vehicles của tenant này - phân biệt update vs create
        let tenantVehicles = [];
        const vehiclesForThisTenant = rentalContractData.vehicles.filter(vehicle => 
          vehicle.ownerIndex === i && vehicle.licensePlate.trim()
        );
        
        if (isUpdatingExisting) {
          // Đối với tenant đang update, chỉ lấy vehicles mới (không có _id)
          // Vehicles cũ sẽ được update riêng thông qua tenant update API
          tenantVehicles = vehiclesForThisTenant
            .filter(vehicle => !vehicle._id) // Chỉ lấy vehicles mới
            .map(vehicle => ({
              licensePlate: vehicle.licensePlate,
              vehicleType: vehicle.vehicleType,
              notes: ''
            }));
        } else {
          // Đối với tenant mới, lấy tất cả vehicles
          tenantVehicles = vehiclesForThisTenant.map(vehicle => ({
            licensePlate: vehicle.licensePlate,
            vehicleType: vehicle.vehicleType,
            notes: ''
          }));
        }
        
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

        let tenantResponse;
        if (isUpdatingExisting) {
          // Update existing tenant
          tenantResponse = await tenantsAPI.updateTenant(tenantData._id, tenantPayload);
        } else {
          // Create new tenant
          tenantResponse = await tenantsAPI.createTenant(tenantPayload);
        }
        
        if (tenantResponse.success) {
          const processedTenant = tenantResponse.data;
          transaction.createdTenants.push(processedTenant);

          // Upload hình ảnh sau khi xử lý tenant thành công (chỉ khi có ảnh mới)
          if (tenantData.tenantImages && tenantData.tenantImages.length > 0) {
            try {
              const uploadRes = await tenantsAPI.uploadTenantImages(processedTenant._id, tenantData.tenantImages);
              
              if (uploadRes.success) {
                console.log('Tenant images uploaded successfully:', uploadRes.data.images);
                transaction.uploadedImages.push({
                  tenantId: processedTenant._id,
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
          console.error(isContractEditMode ? 'Failed to update tenant:' : 'Failed to create tenant:', tenantResponse);
          throw new Error(`Failed to ${isContractEditMode ? 'update' : 'create'} tenant ${i + 1}: ${tenantResponse.message}`);
        }
      }

      // 2.3. PHASE 1.3: Xóa tenants bị loại bỏ (chỉ trong edit mode)
      if (isContractEditMode && selectedRoomForContract.originalTenantIds) {
        const currentTenantIds = rentalContractData.tenants
          .filter(t => t._id) // Chỉ lấy tenants có ID
          .map(t => t._id);
        
        const tenantsToDelete = selectedRoomForContract.originalTenantIds.filter(
          originalId => !currentTenantIds.includes(originalId)
        );
        
        if (tenantsToDelete.length > 0) {
          // Remove intermediate toast for deletion
          for (const tenantId of tenantsToDelete) {
            try {
              console.log('Ending lease for removed tenant:', tenantId);
              // Set status to 'ended' instead of archiving
              await tenantsAPI.endLease(tenantId, { endDate: new Date() });
            } catch (deleteError) {
              console.warn(`Failed to end lease for tenant ${tenantId}:`, deleteError);
            }
          }
        }
      }

      // 2.5. PHASE 1.5: Xử lý vehicle updates riêng (chỉ trong edit mode)
      if (isContractEditMode) {
        // Remove intermediate toast for vehicles
        
        // Group vehicles by tenant owner
        const vehiclesByTenant = {};
        
        rentalContractData.vehicles
          .filter(vehicle => vehicle.licensePlate.trim())
          .forEach(vehicle => {
            const tenantIndex = vehicle.ownerIndex;
            if (!vehiclesByTenant[tenantIndex]) {
              vehiclesByTenant[tenantIndex] = [];
            }
            vehiclesByTenant[tenantIndex].push({
              licensePlate: vehicle.licensePlate,
              vehicleType: vehicle.vehicleType,
              notes: ''
            });
          });
        
        // Update vehicles for each tenant
        for (const [tenantIndex, vehicles] of Object.entries(vehiclesByTenant)) {
          const tenant = transaction.createdTenants[parseInt(tenantIndex)];
          if (tenant) {
            try {
              console.log(`Updating vehicles for tenant ${tenant.fullName}:`, vehicles);
              await tenantsAPI.updateTenant(tenant._id, { vehicles });
            } catch (vehicleError) {
              console.warn(`Failed to update vehicles for tenant ${tenant.fullName}:`, vehicleError);
              // Continue with other tenants
            }
          }
        }
      }

      // 3. PHASE 2: Xử lý contract
      // Remove intermediate toast - already shown at start
      
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
        waterPricePerPerson: Number(rentalContractData.waterPricePerPerson),
        waterChargeType: rentalContractData.waterChargeType,
        servicePrice: Number(rentalContractData.servicePrice),
        currentElectricIndex: Number(rentalContractData.currentElectricIndex) || 0,
        currentWaterIndex: Number(rentalContractData.currentWaterIndex) || 0,
        paymentCycle: rentalContractData.paymentCycle,
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
      
      let contractResponse;
      if (isContractEditMode && editingContractId) {
        // Update existing contract
        contractResponse = await contractsAPI.updateContract(editingContractId, contractPayload);
      } else {
        // Create new contract
        contractResponse = await contractsAPI.createContract(contractPayload);
      }
      
      console.log('Contract response:', contractResponse);
      
      if (contractResponse.success) {
        transaction.createdContract = contractResponse.data;
        
        // 4. PHASE 3: Cập nhật contract reference cho tenants (chỉ cho create mode)
        if (!isContractEditMode) {
          for (const tenant of transaction.createdTenants) {
            await tenantsAPI.updateTenant(tenant._id, {
              contract: transaction.createdContract._id
            });
          }
        }
        
        // 5. PHASE 4: Cập nhật trạng thái phòng (chỉ cho create mode)
        if (!isContractEditMode) {
          // Remove intermediate toast - already shown at start
          await roomsAPI.updateRoom(selectedRoomForContract.id, {
            status: 'rented',
            tenant: transaction.createdTenants[0]._id,
            leaseStart: rentalContractData.startDate,
            leaseEnd: rentalContractData.endDate
          });
          transaction.updatedRoom = true;
        }

        // 6. PHASE 5: Cập nhật trạng thái hợp đồng cọc nếu có (chỉ cho create mode)
        if (!isContractEditMode && transaction.originalDepositContract) {
          await depositContractsAPI.updateDepositContractStatus(
            transaction.originalDepositContract._id, 
            'fulfilled'
          );
          transaction.updatedDepositContract = true;
        }

        // 7. COMMIT: Thành công - đóng modal và refresh data
        setShowRentalContractModal(false);
        setSelectedRoomForContract(null);
        
        showToast(
          'success',
          isContractEditMode 
            ? (t('contracts.success.rentalUpdated') || 'Hợp đồng thuê đã được cập nhật thành công!')
            : (t('contracts.success.rentalCreated') || 'Hợp đồng thuê đã được tạo thành công!')
        );
        
        // Refresh UI
        setTimeout(() => {
          fetchRooms();
          fetchDepositContracts();
        }, 500);

      } else {
        throw new Error(contractResponse.message || (isContractEditMode ? 'Failed to update contract' : 'Failed to create contract'));
      }

    } catch (error) {
      console.error('Error creating rental contract:', error);
      
      // ROLLBACK: Hoàn tác tất cả các thay đổi
      try {
        // Rollback room status if updated
        if (transaction.updatedRoom) {
          await roomsAPI.updateRoom(selectedRoomForContract.id, {
            status: transaction.originalRoomStatus,
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

      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError);
        showToast('error', t('contracts.error.rollbackFailed'));
      }
      
      let errorMessage = isContractEditMode 
        ? (t('contracts.error.updateFailed') || 'Có lỗi xảy ra khi cập nhật hợp đồng thuê')
        : (t('contracts.error.createFailed') || 'Có lỗi xảy ra khi tạo hợp đồng thuê');
      
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

  // Rented room action handlers
  const handleViewContract = async (room) => {
    try {
      // Fetch contract data for this room
      const contractsRes = await contractsAPI.getContractsByRoom(room.id);
      
      if (contractsRes.success && contractsRes.data && contractsRes.data.length > 0) {
        const contract = contractsRes.data[0]; // Get the first/active contract
        
        // Extract tenant data from contract (contracts populate tenants array)
        const tenants = contract.tenants || []; // Only use tenants array
        
        // Optional: Also fetch from tenants API for comparison/additional data
        const tenantsRes = await tenantsAPI.getTenantsByRoom(room.id);
        
        // Use contract tenants as primary source, supplement with API tenants if needed
        const apiTenants = tenantsRes.success ? tenantsRes.data : [];
        
        // Merge or prefer contract tenants
        const finalTenants = tenants.length > 0 ? tenants : apiTenants;
        
        // Prepare rental contract data for editing
        const contractData = {
          tenants: finalTenants.map(tenant => ({
            _id: tenant._id, // Lưu ID để update
            tenantName: tenant.fullName || '',
            tenantPhone: tenant.phone || '',
            tenantId: tenant.identificationNumber || '', // Sửa từ idCard thành identificationNumber
            tenantImages: tenant.images || []
          })),
          vehicles: [
            // Use vehicles from tenants as primary source
            // Each tenant owns their vehicles
            ...finalTenants.reduce((allVehicles, tenant) => {
              return allVehicles.concat((tenant.vehicles || []).map(vehicle => ({
                _id: vehicle._id, // Lưu vehicle ID để update
                ...vehicle,
                ownerIndex: finalTenants.findIndex(t => t._id === tenant._id)
              })));
            }, [])
            // NOTE: Removed contract.vehicles to avoid duplicates
            // Contract.vehicles should sync with tenant.vehicles in backend
          ],
          startDate: contract.startDate ? contract.startDate.split('T')[0] : '',
          endDate: contract.endDate ? contract.endDate.split('T')[0] : '',
          monthlyRent: contract.monthlyRent || room.price,
          deposit: contract.deposit || 0,
          electricityPrice: contract.electricPrice !== undefined && contract.electricPrice !== null ? contract.electricPrice : 3500,
          waterPrice: contract.waterPrice !== undefined && contract.waterPrice !== null ? contract.waterPrice : 25000,
          waterPricePerPerson: contract.waterPricePerPerson !== undefined && contract.waterPricePerPerson !== null ? contract.waterPricePerPerson : 50000,
          waterChargeType: contract.waterChargeType || 'fixed',
          servicePrice: contract.servicePrice !== undefined && contract.servicePrice !== null ? contract.servicePrice : 150000,
          currentElectricIndex: contract.currentElectricIndex ? String(contract.currentElectricIndex) : '',
          currentWaterIndex: contract.currentWaterIndex ? String(contract.currentWaterIndex) : '',
          paymentCycle: contract.paymentCycle || 'monthly',
          notes: contract.notes || ''
        };
        
        // Set edit mode with original tenant IDs for comparison
        setIsContractEditMode(true);
        setEditingContractId(contract._id);
        
        // Store original tenant IDs to detect deletions
        const originalTenantIds = finalTenants.map(t => t._id);
        
        setSelectedRoomForContract({
          ...room,
          originalTenantIds // Store for later comparison
        });
        setRentalContractData(contractData);
        setShowRentalContractModal(true);
      } else {
        showToast('error', t('contracts.error.contractNotFound'));
      }
    } catch (error) {
      console.error('Error fetching contract data:', error);
      showToast('error', t('contracts.error.contractInfoLoadFailed'));
    }
  };

  const handleViewTenants = async (room) => {
    console.log('View tenants for room:', room);
    setSelectedRoomForTenants(room);
    setShowTenantsModal(true);
    setLoadingTenants(true);
    
    try {
      // Sử dụng API để lấy danh sách tenant theo roomId
      const response = await tenantsAPI.getTenantsByRoom(room.id);
      if (response.success) {
        const tenantList = response.data || [];
        
        // Sắp xếp danh sách: active trước, ended sau
        const sortedTenantList = tenantList.sort((a, b) => {
          // Ưu tiên active trước
          if (a.status === 'active' && b.status === 'ended') return -1;
          if (a.status === 'ended' && b.status === 'active') return 1;
          
          // Nếu cùng status thì sắp xếp theo tên
          return a.fullName.localeCompare(b.fullName);
        });
        
        setRoomTenants(sortedTenantList);
      } else {
        console.error('Failed to fetch tenants:', response.message);
        setRoomTenants([]);
        showToast('error', t('rooms.messages.fetchTenantsError') || 'Không thể tải danh sách khách thuê');
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
      setRoomTenants([]);
      showToast('error', t('rooms.messages.fetchTenantsError') || 'Không thể tải danh sách khách thuê');
    } finally {
      setLoadingTenants(false);
    }
  };

  // Thêm tenant mới
  const handleAddTenant = () => {
    setTenantFormData({
      fullName: '',
      phone: '',
      identificationNumber: '',
      address: '',
      vehicleLicensePlate: '',
      vehicleType: '',
      tenantImages: []
    });
    setTenantFormErrors({});
    setShowVehicleForm(false);
    setShowAddTenantModal(true);
  };

  // Sửa tenant
  const handleEditTenant = (tenant) => {
    setEditingTenant(tenant);
    setTenantFormData({
      fullName: tenant.fullName || '',
      phone: tenant.phone || '',
      identificationNumber: tenant.identificationNumber || '',
      address: tenant.address || '',
      // Backend trả về images array, convert thành tenantImages format cho UI
      tenantImages: (tenant.images || tenant.tenantImages || []).map(url => 
        typeof url === 'string' ? { url, isUploaded: true } : url
      )
    });
    setTenantFormErrors({});
    setShowEditTenantModal(true);
  };

  // Xóa tenant
  const handleDeleteTenant = async (tenant) => {
    if (!window.confirm(t('tenants.confirm.deleteTenant', { tenantName: tenant.fullName }))) {
      return;
    }

    try {
      const response = await tenantsAPI.endLease(tenant.id, { endDate: new Date() });
      if (response.success) {
        // Nếu phòng có contract hiện tại, cập nhật contract để loại bỏ tenant
        if (selectedRoomForTenants.currentContract) {
          try {
            // Lấy thông tin contract hiện tại
            const contractResponse = await contractsAPI.getContract(selectedRoomForTenants.currentContract.id);
            
            if (contractResponse.success) {
              const currentContract = contractResponse.data;
              
              // Loại bỏ tenant khỏi danh sách tenants
              const updatedTenants = (currentContract.tenants || []).filter(
                tenantId => tenantId !== tenant.id
              );
              
              // Loại bỏ các xe của tenant này khỏi contract
              const updatedVehicles = (currentContract.vehicles || []).filter(
                vehicle => vehicle.owner !== tenant.id
              );
              
              // Cập nhật contract
              const updatedContractPayload = {
                ...currentContract,
                tenants: updatedTenants,
                vehicles: updatedVehicles
              };
              
              const updateContractResponse = await contractsAPI.updateContract(
                selectedRoomForTenants.currentContract.id, 
                updatedContractPayload
              );
              
              if (!updateContractResponse.success) {
                console.warn('Failed to update contract after removing tenant:', updateContractResponse.message);
                showToast('warning', t('tenants.messages.deletedButContractUpdateFailed'));
              }
            }
          } catch (contractError) {
            console.error('Error updating contract after removing tenant:', contractError);
            showToast('warning', t('tenants.messages.deletedButContractUpdateFailed'));
          }
        }
        
        showToast('success', t('contracts.success.contractTerminated'));
        // Refresh danh sách tenants
        handleViewTenants(selectedRoomForTenants);
        // Refresh rooms để cập nhật status
        fetchRooms();
      } else {
        showToast('error', response.message || t('contracts.error.contractTerminateFailed'));
      }
    } catch (error) {
      console.error('Error ending lease:', error);
      showToast('error', t('contracts.error.contractTerminateFailed'));
    }
  };

  // Validate tenant form
  const validateTenantForm = () => {
    const errors = {};
    
    if (!tenantFormData.fullName?.trim()) {
      errors.fullName = t('validation.fullNameRequired');
    }
    
    if (!tenantFormData.phone?.trim()) {
      errors.phone = t('validation.phoneNumberRequired');
    } else if (!/^[0-9]{10,11}$/.test(tenantFormData.phone.replace(/\s/g, ''))) {
      errors.phone = t('validation.invalidPhoneNumber');
    }
    
    if (!tenantFormData.identificationNumber?.trim()) {
      errors.identificationNumber = 'Vui lòng nhập CCCD/CMND';
    }
    
    // Không cần bắt buộc nhập địa chỉ nữa
    // if (!tenantFormData.address?.trim()) {
    //   errors.address = 'Vui lòng nhập địa chỉ';
    // }
    
    return errors;
  };

  // Lưu tenant (thêm mới hoặc cập nhật)
  const handleSaveTenant = async () => {
    const errors = validateTenantForm();
    setTenantFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      return;
    }
    
    setSavingTenant(true);
    
    try {
      const payload = {
        fullName: tenantFormData.fullName,
        phone: tenantFormData.phone,
        identificationNumber: tenantFormData.identificationNumber,
        address: tenantFormData.address,
        room: selectedRoomForTenants.id,
        images: tenantFormData.tenantImages,
        // Thêm các field bắt buộc
        leaseStart: new Date(), // Ngày bắt đầu thuê là hôm nay
        rentPrice: selectedRoomForTenants.price || 0, // Lấy giá phòng
        deposit: 0, // Mặc định tiền cọc là 0
        vehicles: tenantFormData.vehicleLicensePlate ? [{
          licensePlate: tenantFormData.vehicleLicensePlate,
          vehicleType: tenantFormData.vehicleType || t('vehicles.types.motorcycle')
        }] : []
      };
      
      let response;
      if (editingTenant) {
        // Cập nhật tenant
        response = await tenantsAPI.updateTenant(editingTenant.id, payload);
      } else {
        // Thêm tenant mới
        response = await tenantsAPI.createTenant(payload);
        
        // Nếu tạo tenant mới thành công và phòng có contract hiện tại
        if (response.success && selectedRoomForTenants.currentContract) {
          try {
            // Lấy thông tin contract hiện tại
            const contractResponse = await contractsAPI.getContract(selectedRoomForTenants.currentContract.id);
            
            if (contractResponse.success) {
              const currentContract = contractResponse.data;
              
              // Cập nhật contract để thêm tenant mới
              const updatedContractPayload = {
                ...currentContract,
                tenants: [...(currentContract.tenants || []), response.data._id], // Thêm tenant mới vào danh sách
                // Cập nhật thông tin xe nếu có
                vehicles: [
                  ...(currentContract.vehicles || []),
                  ...(payload.vehicles.map(vehicle => ({
                    ...vehicle,
                    owner: response.data._id
                  })))
                ]
              };
              
              // Cập nhật contract
              const updateContractResponse = await contractsAPI.updateContract(
                selectedRoomForTenants.currentContract.id, 
                updatedContractPayload
              );
              
              if (!updateContractResponse.success) {
                console.warn('Failed to update contract with new tenant:', updateContractResponse.message);
                showToast('warning', t('tenants.messages.addedButContractUpdateFailed'));
              }
            }
          } catch (contractError) {
            console.error('Error updating contract with new tenant:', contractError);
            showToast('warning', t('tenants.messages.addedButContractUpdateFailed'));
          }
        }
      }
      
      if (response.success) {
        showToast('success', editingTenant ? t('tenants.messages.updateSuccess') : t('tenants.messages.addSuccess'));
        setShowAddTenantModal(false);
        setShowEditTenantModal(false);
        setEditingTenant(null);
        // Refresh danh sách tenants
        handleViewTenants(selectedRoomForTenants);
        // Refresh rooms để cập nhật status
        fetchRooms();
      } else {
        showToast('error', response.message || t('tenants.messages.saveFailed'));
      }
    } catch (error) {
      console.error('Error saving tenant:', error);
      showToast('error', t('tenants.messages.saveFailed'));
    } finally {
      setSavingTenant(false);
    }
  };

  const closeTenantModals = () => {
    setShowAddTenantModal(false);
    setShowEditTenantModal(false);
    setEditingTenant(null);
    setTenantFormData({
      fullName: '',
      phone: '',
      email: '',
      identificationNumber: '',
      dateOfBirth: '',
      address: '',
      emergencyContact: {
        name: '',
        phone: '',
        relationship: ''
      },
      leaseStart: '',
      leaseEnd: '',
      rentPrice: '',
      deposit: '',
      notes: ''
    });
    setTenantFormErrors({});
  };

  // ============ VEHICLE MANAGEMENT FUNCTIONS ============
  
  // Xem danh sách xe của phòng
  const handleViewVehicles = async (room) => {
    setSelectedRoomForVehicles(room);
    setShowVehiclesModal(true);
    setLoadingVehicles(true);
    
    try {
      // Lấy danh sách tenant để tìm xe của họ
      const tenantResponse = await tenantsAPI.getTenantsByRoom(room.id);
      
      if (tenantResponse.success) {
        const tenants = tenantResponse.data || [];
        
        // Set roomTenants để sử dụng trong form thêm xe
        setRoomTenants(tenants);
        
        // Lấy tất cả xe từ các tenant
        const allVehicles = [];
        tenants.forEach(tenant => {
          if (tenant.vehicles && tenant.vehicles.length > 0) {
            tenant.vehicles.forEach(vehicle => {
              allVehicles.push({
                ...vehicle,
                id: `${tenant.id}_${vehicle.licensePlate}`,
                ownerName: tenant.fullName,
                ownerPhone: tenant.phone,
                ownerId: tenant.id,
                status: tenant.status // inherit tenant status
              });
            });
          }
        });
        
        // Chỉ hiển thị xe của tenant đang thuê (active)
        const activeVehicles = allVehicles.filter(vehicle => vehicle.status === 'active');
        
        // Sắp xếp theo biển số
        const sortedVehicles = activeVehicles.sort((a, b) => 
          a.licensePlate.localeCompare(b.licensePlate)
        );
        
        setRoomVehicles(sortedVehicles);
      } else {
        console.error('Failed to fetch vehicles:', tenantResponse.message);
        setRoomVehicles([]);
        showToast('error', t('vehicles.messages.fetchError'));
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      setRoomVehicles([]);
      showToast('error', t('vehicles.messages.loadVehiclesFailed'));
    } finally {
      setLoadingVehicles(false);
    }
  };

  // Thêm xe mới
  const handleAddVehicle = () => {
    setVehicleFormData({
      licensePlate: '',
      vehicleType: '',
      ownerName: '',
      ownerPhone: '',
      notes: ''
    });
    setVehicleFormErrors({});
    setShowAddVehicleModal(true);
  };

  // Sửa xe
  const handleEditVehicle = (vehicle) => {
    setEditingVehicle(vehicle);
    setVehicleFormData({
      licensePlate: vehicle.licensePlate || '',
      vehicleType: vehicle.vehicleType || '',
      ownerName: vehicle.ownerName || '',
      ownerPhone: vehicle.ownerPhone || '',
      notes: vehicle.notes || ''
    });
    setVehicleFormErrors({});
    setShowEditVehicleModal(true);
  };

  // Xóa xe
  const handleDeleteVehicle = async (vehicle) => {
    if (!window.confirm(t('vehicles.confirm.deleteVehicle', { licensePlate: vehicle.licensePlate }))) {
      return;
    }

    try {
      // Tìm tenant sở hữu xe này
      const tenantResponse = await tenantsAPI.getTenantsByRoom(selectedRoomForVehicles.id);
      if (!tenantResponse.success) {
        showToast('error', t('tenants.messages.loadTenantInfoFailed'));
        return;
      }

      const tenant = tenantResponse.data.find(t => t.id === vehicle.ownerId);
      if (!tenant) {
        showToast('error', t('vehicles.messages.ownerNotFound'));
        return;
      }

      // Cập nhật danh sách xe của tenant (bỏ xe này)
      const updatedVehicles = (tenant.vehicles || []).filter(v => v.licensePlate !== vehicle.licensePlate);
      
      const response = await tenantsAPI.updateTenant(tenant.id, {
        vehicles: updatedVehicles
      });

      if (response.success) {
        showToast('success', t('vehicles.messages.deleteSuccess'));
        // Refresh danh sách xe
        handleViewVehicles(selectedRoomForVehicles);
      } else {
        showToast('error', response.message || t('vehicles.messages.deleteFailed'));
      }
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      showToast('error', t('vehicles.messages.deleteFailed'));
    }
  };

  // Validate vehicle form
  const validateVehicleForm = () => {
    const errors = {};
    
    if (!vehicleFormData.licensePlate?.trim()) {
      errors.licensePlate = t('validation.licensePlateRequired');
    }
    
    if (!vehicleFormData.vehicleType?.trim()) {
      errors.vehicleType = t('validation.vehicleTypeRequired');
    }
    
    if (!vehicleFormData.ownerName?.trim()) {
      errors.ownerName = 'Vui lòng nhập tên chủ xe';
    }
    
    if (!vehicleFormData.ownerPhone?.trim()) {
      errors.ownerPhone = t('validation.ownerPhoneRequired');
    } else if (!/^[0-9]{10,11}$/.test(vehicleFormData.ownerPhone.replace(/\s/g, ''))) {
      errors.ownerPhone = t('validation.invalidOwnerPhone');
    }
    
    return errors;
  };

  // Lưu xe (thêm mới hoặc cập nhật)
  const handleSaveVehicle = async () => {
    const errors = validateVehicleForm();
    setVehicleFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      return;
    }
    
    setSavingVehicle(true);
    
    try {
      // Lấy danh sách tenant hiện tại
      const tenantResponse = await tenantsAPI.getTenantsByRoom(selectedRoomForVehicles.id);
      if (!tenantResponse.success) {
        showToast('error', t('tenants.messages.loadTenantsFailed'));
        return;
      }

      // Tìm hoặc tạo tenant cho xe này
      let targetTenant = tenantResponse.data.find(t => 
        t.fullName === vehicleFormData.ownerName && t.phone === vehicleFormData.ownerPhone
      );

      if (!targetTenant) {
        showToast('error', t('tenants.messages.tenantNotFoundPleaseAdd'));
        return;
      }

      const vehicleData = {
        licensePlate: vehicleFormData.licensePlate,
        vehicleType: vehicleFormData.vehicleType,
        notes: vehicleFormData.notes
      };

      let updatedVehicles = targetTenant.vehicles || [];
      if (editingVehicle) {
        // Cập nhật xe hiện có
        updatedVehicles = updatedVehicles.map(v => 
          v.licensePlate === editingVehicle.licensePlate ? vehicleData : v
        );
      } else {
        // Thêm xe mới
        updatedVehicles = [...updatedVehicles, vehicleData];
      }

      const response = await tenantsAPI.updateTenant(targetTenant.id, {
        vehicles: updatedVehicles
      });
      
      if (response.success) {
        showToast('success', editingVehicle ? t('vehicles.messages.updateSuccess') : t('vehicles.messages.addSuccess'));
        closeVehicleModals();
        // Refresh danh sách xe
        handleViewVehicles(selectedRoomForVehicles);
      } else {
        showToast('error', response.message || 'Có lỗi khi lưu thông tin xe');
      }
    } catch (error) {
      console.error('Error saving vehicle:', error);
      showToast('error', 'Có lỗi khi lưu thông tin xe');
    } finally {
      setSavingVehicle(false);
    }
  };

  const closeVehicleModals = () => {
    setShowVehiclesModal(false);
    setShowAddVehicleModal(false);
    setShowEditVehicleModal(false);
    setEditingVehicle(null);
    setRoomVehicles([]);
    setRoomTenants([]); // Clear room tenants
    setVehicleFormData({
      licensePlate: '',
      vehicleType: '',
      ownerName: '',
      ownerPhone: '',
      notes: ''
    });
    setVehicleFormErrors({});
  };

  const closeAddVehicleModal = () => {
    setShowAddVehicleModal(false);
    setVehicleFormData({
      licensePlate: '',
      vehicleType: '',
      ownerName: '',
      ownerPhone: '',
      notes: ''
    });
    setVehicleFormErrors({});
    // Giữ lại modal danh sách xe
  };

  const closeEditVehicleModal = () => {
    setShowEditVehicleModal(false);
    setEditingVehicle(null);
    setVehicleFormData({
      licensePlate: '',
      vehicleType: '',
      ownerName: '',
      ownerPhone: '',
      notes: ''
    });
    setVehicleFormErrors({});
    // Giữ lại modal danh sách xe
  };

  const handleCreateInvoice = (room) => {
    // TODO: Implement create invoice modal/page
    console.log('Create invoice for room:', room);
    showToast('info', t('rooms.messages.createInvoiceDev') || 'Chức năng đang phát triển');
  };

  const handleRoomTransfer = (room) => {
    // TODO: Implement room transfer modal/page
    console.log('Room transfer for room:', room);
    showToast('info', t('rooms.messages.roomTransferDev') || 'Chức năng đang phát triển');
  };

  const handleTerminateContract = (room) => {
    // TODO: Implement terminate contract modal/page
    if (window.confirm(t('rooms.messages.confirmTerminate'))) {
      console.log('Terminate contract for room:', room);
      showToast('info', t('rooms.messages.terminateContractDev') || 'Chức năng đang phát triển');
    }
  };

  const handleMarkAsExpiring = async (room) => {
    if (window.confirm(t('rooms.messages.confirmMarkExpiring'))) {
      try {
        await roomsAPI.updateRoom(room.id, { status: 'expiring' });
        showToast('success', t('rooms.messages.markedAsExpiring'));
        fetchRooms();
      } catch (error) {
        console.error('Error marking room as expiring:', error);
        showToast('error', t('rooms.messages.errorMarkingExpiring'));
      }
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
      showToast('error', t('rooms.messages.validateErrors'));
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
    
    // Reset edit mode
    setIsContractEditMode(false);
    setEditingContractId(null);
    
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
      rented: 'status-rented',
      reserved: 'status-reserved',
      expiring: 'status-expiring'
    };
    return `status-badge ${classes[status]}`;
  };

  const getStatusText = (status) => {
    const texts = {
      available: t('rooms.status.available'),
      rented: t('rooms.status.rented') || 'Đã thuê',
      reserved: t('rooms.status.reserved'),
      expiring: t('rooms.status.expiring') || 'Sắp kết thúc'
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
                                    {t('rooms.actions.createRentalContract')}
                                  </button>
                                  <button
                                    className="action-menu-item danger"
                                    onClick={() => {
                                      handleCancelDeposit(room.name);
                                      setOpenActionMenu(null);
                                    }}
                                  >
                                    <i className="fas fa-times-circle"></i>
                                    {t('rooms.actions.cancelDeposit')}
                                  </button>
                                </>
                              )}

                              {/* Rented room - show rental management options */}
                              {(room.status === 'rented' || room.status === 'expiring') && (
                                <>
                                  <button
                                    className="action-menu-item"
                                    onClick={() => {
                                      handleViewContract(room);
                                      setOpenActionMenu(null);
                                    }}
                                  >
                                    <i className="fas fa-file-contract"></i>
                                    {t('rooms.actions.viewContract')}
                                  </button>
                                  <button
                                    className="action-menu-item"
                                    onClick={() => {
                                      handleViewTenants(room);
                                      setOpenActionMenu(null);
                                    }}
                                  >
                                    <i className="fas fa-users"></i>
                                    Xem người thuê
                                  </button>
                                  <button
                                    className="action-menu-item"
                                    onClick={() => {
                                      handleViewVehicles(room);
                                      setOpenActionMenu(null);
                                    }}
                                  >
                                    <i className="fas fa-car"></i>
                                    Xem xe
                                  </button>
                                  <button
                                    className="action-menu-item"
                                    onClick={() => {
                                      handleCreateInvoice(room);
                                      setOpenActionMenu(null);
                                    }}
                                  >
                                    <i className="fas fa-file-invoice-dollar"></i>
                                    {t('rooms.actions.createInvoice')}
                                  </button>
                                  <button
                                    className="action-menu-item"
                                    onClick={() => {
                                      handleRoomTransfer(room);
                                      setOpenActionMenu(null);
                                    }}
                                  >
                                    <i className="fas fa-exchange-alt"></i>
                                    {t('rooms.actions.roomTransfer')}
                                  </button>
                                  {room.status === 'rented' && (
                                    <button
                                      className="action-menu-item warning"
                                      onClick={() => {
                                        handleMarkAsExpiring(room);
                                        setOpenActionMenu(null);
                                      }}
                                    >
                                      <i className="fas fa-clock"></i>
                                      {t('rooms.actions.markAsExpiring')}
                                    </button>
                                  )}
                                  <button
                                    className="action-menu-item danger"
                                    onClick={() => {
                                      handleTerminateContract(room);
                                      setOpenActionMenu(null);
                                    }}
                                  >
                                    <i className="fas fa-ban"></i>
                                    {t('rooms.actions.terminateContract')}
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
          
          <div className="room-modal-content">
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
          
          <div className="room-modal-content">
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
              <div className="amenities-list" style={{gap:'50px'}}>
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
              <i className="fas fa-file-contract"></i> 
              {isContractEditMode ? 'Chỉnh sửa hợp đồng thuê' : 'Tạo hợp đồng thuê'} - {selectedRoomForContract.name}
            </h2>
            <button className="room-modal-close" disabled={creatingRentalContract} onClick={closeRentalContractModal}>×</button>
          </div>
          
          <div className="room-modal-content">
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
                          {t('vehicles.form.vehicleType')} <span className="required">*</span>
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
                    placeholder={t('contracts.form.notesPlaceholder')}
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
                ? <><i className="fas fa-spinner fa-spin"></i> {isContractEditMode ? t('contracts.updating') : t('contracts.creating')}</>
                : <><i className="fas fa-check"></i> {isContractEditMode ? t('contracts.update') : t('contracts.create')}</>
              }
            </button>
          </div>
        </div>
      </div>
      </div>
    )}

    {/* Tenants Modal */}
    {showTenantsModal && (
      <div className="room-modal-backdrop" onClick={() => setShowTenantsModal(false)}>
        <div className="room-modal tenant-modal large" onClick={e => e.stopPropagation()}>
          <div className="room-modal-header">
            <div className="modal-title-section">
              <h2 className="room-modal-title">
                <i className="fas fa-users"></i>
                Khách thuê - {selectedRoomForTenants?.name || selectedRoomForTenants?.roomNumber}
              </h2>
              <div className="tenant-count-info">
                {!loadingTenants && (
                  <span className="tenant-count">
                    {roomTenants.filter(t => t.status === 'active').length}/{selectedRoomForTenants?.capacity || 4} người
                  </span>
                )}
              </div>
            </div>
            <div className="modal-actions">
              {!loadingTenants && roomTenants.filter(t => t.status === 'active').length < (selectedRoomForTenants?.capacity || 4) && (
                <button className="btn-add-tenant" onClick={handleAddTenant}>
                  <i className="fas fa-user-plus"></i>
                  Thêm người thuê
                </button>
              )}
              <button className="room-modal-close" onClick={() => setShowTenantsModal(false)}>×</button>
            </div>
          </div>

          <div className="tenant-modal-content">
            {loadingTenants ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Đang tải danh sách khách thuê...</p>
              </div>
            ) : roomTenants.length === 0 ? (
              <div className="empty-tenants">
                <div className="empty-icon">👥</div>
                <h3>Chưa có khách thuê</h3>
                <p>Phòng này chưa có khách thuê nào.</p>
                <button className="btn-primary" onClick={handleAddTenant}>
                  <i className="fas fa-user-plus"></i>
                  Thêm khách thuê đầu tiên
                </button>
              </div>
            ) : (
              <div className="tenants-grid">
                {roomTenants.map((tenant, index) => (
                  <div key={tenant.id || index} className={`tenant-card pro-minimal ${tenant.status}`}>
                    <div className="tenant-content">
                      <div className="tenant-name">{tenant.fullName}</div>
                      <div className="tenant-phone">{tenant.phone}</div>
                      <div className={`tenant-status ${tenant.status}`}>
                        {tenant.status === 'active' ? t('tenants.status.active') : t('tenants.status.ended')}
                      </div>
                    </div>
                    {tenant.status === 'active' && (
                      <div className="tenant-actions">
                        <button 
                          className="action-btn edit" 
                          onClick={() => handleEditTenant(tenant)}
                          title="Sửa thông tin"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button 
                          className="action-btn delete" 
                          onClick={() => handleDeleteTenant(tenant)}
                          title="Kết thúc hợp đồng"
                        >
                          <i className="fas fa-user-times"></i>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="room-modal-footer">
            <div className="footer-info">
              {!loadingTenants && roomTenants.length > 0 && (
                <span className="tenant-summary">
                  Tổng: {roomTenants.length} người 
                  ({roomTenants.filter(t => t.status === 'active').length} {t('tenants.status.active')}, {roomTenants.filter(t => t.status === 'ended').length} {t('tenants.status.ended')})
                </span>
              )}
            </div>
            <button className="btn-secondary" onClick={() => setShowTenantsModal(false)}>
              <i className="fas fa-times"></i> Đóng
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Add Tenant Modal */}
    {showAddTenantModal && (
      <div className="room-modal-backdrop" onClick={closeTenantModals}>
        <div className="room-modal tenant-form-modal" onClick={e => e.stopPropagation()}>
          <div className="room-modal-header">
            <h2 className="room-modal-title">
              <i className="fas fa-user-plus"></i>
              Thêm khách thuê mới - {selectedRoomForTenants?.name || selectedRoomForTenants?.roomNumber}
            </h2>
            <button className="room-modal-close" onClick={closeTenantModals}>×</button>
          </div>

          <div className="tenant-form-content">
            <form className="tenant-form">
              <div className="form-section">
                <h4 className="section-title">
                  <i className="fas fa-user"></i>
                  Thông tin khách thuê
                </h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Họ và tên *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={tenantFormData.fullName}
                      onChange={(e) => setTenantFormData(prev => ({...prev, fullName: e.target.value}))}
                      placeholder="Nhập họ và tên"
                    />
                    {tenantFormErrors.fullName && (
                      <div className="error-message">{tenantFormErrors.fullName}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Số điện thoại *</label>
                    <input
                      type="tel"
                      className="form-input"
                      value={tenantFormData.phone}
                      onChange={(e) => setTenantFormData(prev => ({...prev, phone: e.target.value}))}
                      placeholder="Nhập số điện thoại"
                    />
                    {tenantFormErrors.phone && (
                      <div className="error-message">{tenantFormErrors.phone}</div>
                    )}
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">CMND/CCCD *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={tenantFormData.identificationNumber}
                      onChange={(e) => setTenantFormData(prev => ({...prev, identificationNumber: e.target.value}))}
                      placeholder="Nhập số CMND/CCCD"
                    />
                    {tenantFormErrors.identificationNumber && (
                      <div className="error-message">{tenantFormErrors.identificationNumber}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Địa chỉ</label>
                    <input
                      type="text"
                      className="form-input"
                      value={tenantFormData.address}
                      onChange={(e) => setTenantFormData(prev => ({...prev, address: e.target.value}))}
                      placeholder="Nhập địa chỉ (không bắt buộc)"
                    />
                    {tenantFormErrors.address && (
                      <div className="error-message">{tenantFormErrors.address}</div>
                    )}
                  </div>
                </div>
                
                {/* Image Upload Section */}
                <div className="form-row">
                  <div className="form-group full-width">
                    <label className="form-label">Ảnh căn cước/chân dung</label>
                    <div className="image-upload-section">
                      <div className="image-upload-area">
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => {
                            const files = Array.from(e.target.files);
                            const currentImagesCount = tenantFormData.tenantImages.length;
                            const availableSlots = Math.max(0, 5 - currentImagesCount);
                            const filesToAdd = files.slice(0, availableSlots);
                            
                            if (files.length > availableSlots) {
                              showToast(`Chỉ có thể tải lên tối đa 5 ảnh. Đã thêm ${filesToAdd.length} ảnh đầu tiên.`, 'warning');
                            }
                            
                            setTenantFormData(prev => ({
                              ...prev, 
                              tenantImages: [...prev.tenantImages, ...filesToAdd]
                            }));
                          }}
                          style={{display: 'none'}}
                          id="tenant-image-upload"
                        />
                        <label htmlFor="tenant-image-upload" className="upload-label">
                          <i className="fas fa-cloud-upload-alt"></i>
                          <span>{t('common.selectOrDragImage')}</span>
                          <small>{t('common.imageUploadHint')}</small>
                        </label>
                      </div>
                      
                      {/* Image Preview */}
                      {tenantFormData.tenantImages && tenantFormData.tenantImages.length > 0 && (
                        <div className="image-preview-grid">
                          {tenantFormData.tenantImages.map((image, index) => (
                            <div key={index} className="image-preview-item">
                              <img
                                src={typeof image === 'string' ? image : URL.createObjectURL(image)}
                                alt={`Tenant ${index + 1}`}
                                className="preview-image"
                              />
                              <button
                                type="button"
                                className="remove-image"
                                onClick={() => {
                                  setTenantFormData(prev => ({
                                    ...prev,
                                    tenantImages: prev.tenantImages.filter((_, i) => i !== index)
                                  }));
                                }}
                              >
                                <i className="fas fa-times"></i>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Vehicle Section */}
                {(() => {
                  const maxVehicles = selectedRoomForTenants?.maxVehicles || 3;
                  const currentVehicles = roomTenants.filter(t => t.status === 'active' && t.vehicles && t.vehicles.length > 0).length;
                  const canAddVehicle = currentVehicles < maxVehicles;
                  
                  return (
                    <div className="vehicle-section">
                      {!showVehicleForm && canAddVehicle && (
                        <div className="form-row">
                          <div className="form-group full-width">
                            <button 
                              type="button"
                              className="btn-add-vehicle"
                              onClick={() => setShowVehicleForm(true)}
                            >
                              <i className="fas fa-plus"></i> Thêm thông tin xe ({currentVehicles}/{maxVehicles})
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {showVehicleForm && (
                        <div className="vehicle-form-section">
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Biển số xe</label>
                              <input
                                type="text"
                                className="form-input"
                                value={tenantFormData.vehicleLicensePlate}
                                onChange={(e) => setTenantFormData(prev => ({...prev, vehicleLicensePlate: e.target.value}))}
                                placeholder="Nhập biển số xe"
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">{t('vehicles.form.vehicleType')}</label>
                              <input
                                type="text"
                                className="form-input"
                                value={tenantFormData.vehicleType}
                                onChange={(e) => setTenantFormData(prev => ({...prev, vehicleType: e.target.value}))}
                                placeholder={t('vehicles.form.vehicleTypePlaceholder')}
                              />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-group full-width">
                              <button 
                                type="button"
                                className="btn-remove-vehicle"
                                onClick={() => {
                                  setShowVehicleForm(false);
                                  setTenantFormData(prev => ({...prev, vehicleLicensePlate: '', vehicleType: ''}));
                                }}
                              >
                                <i className="fas fa-times"></i> Bỏ thông tin xe
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {!canAddVehicle && (
                        <div className="form-row">
                          <div className="form-group full-width">
                            <div className="vehicle-limit-message">
                              <i className="fas fa-info-circle"></i>
                              Phòng này đã đạt giới hạn xe ({currentVehicles}/{maxVehicles})
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </form>
          </div>

          <div className="room-modal-footer">
            <button className="btn-secondary" onClick={closeTenantModals} disabled={savingTenant}>
              <i className="fas fa-times"></i> Hủy
            </button>
            <button className="btn-primary" onClick={handleSaveTenant} disabled={savingTenant}>
              {savingTenant ? (
                <><i className="fas fa-spinner fa-spin"></i> {t('tenants.form.saving')}</>
              ) : (
                <><i className="fas fa-plus"></i> {t('tenants.form.add')}</>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Edit Tenant Modal */}
    {showEditTenantModal && (
      <div className="room-modal-backdrop" onClick={closeTenantModals}>
        <div className="room-modal tenant-form-modal" onClick={e => e.stopPropagation()}>
          <div className="room-modal-header">
            <h2 className="room-modal-title">
              <i className="fas fa-user-edit"></i>
              Sửa thông tin khách thuê - {editingTenant?.fullName}
            </h2>
            <button className="room-modal-close" onClick={closeTenantModals}>×</button>
          </div>

          <div className="tenant-form-content">
            <form className="tenant-form">
              <div className="form-section">
                <h4 className="section-title">
                  <i className="fas fa-user"></i>
                  Thông tin khách thuê
                </h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Họ và tên *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={tenantFormData.fullName}
                      onChange={(e) => setTenantFormData(prev => ({...prev, fullName: e.target.value}))}
                      placeholder="Nhập họ và tên"
                    />
                    {tenantFormErrors.fullName && (
                      <div className="error-message">{tenantFormErrors.fullName}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Số điện thoại *</label>
                    <input
                      type="tel"
                      className="form-input"
                      value={tenantFormData.phone}
                      onChange={(e) => setTenantFormData(prev => ({...prev, phone: e.target.value}))}
                      placeholder="Nhập số điện thoại"
                    />
                    {tenantFormErrors.phone && (
                      <div className="error-message">{tenantFormErrors.phone}</div>
                    )}
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">CMND/CCCD *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={tenantFormData.identificationNumber}
                      onChange={(e) => setTenantFormData(prev => ({...prev, identificationNumber: e.target.value}))}
                      placeholder="Nhập số CMND/CCCD"
                    />
                    {tenantFormErrors.identificationNumber && (
                      <div className="error-message">{tenantFormErrors.identificationNumber}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Địa chỉ</label>
                    <input
                      type="text"
                      className="form-input"
                      value={tenantFormData.address}
                      onChange={(e) => setTenantFormData(prev => ({...prev, address: e.target.value}))}
                      placeholder="Nhập địa chỉ (không bắt buộc)"
                    />
                    {tenantFormErrors.address && (
                      <div className="error-message">{tenantFormErrors.address}</div>
                    )}
                  </div>
                </div>
                
                {/* Image Upload Section */}
                <div className="form-row">
                  <div className="form-group full-width">
                    <label className="form-label">Ảnh căn cước/chân dung</label>
                    <div className="image-upload-section">
                      <div className="image-upload-area">
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => {
                            const files = Array.from(e.target.files);
                            setTenantFormData(prev => ({
                              ...prev, 
                              tenantImages: [...prev.tenantImages, ...files]
                            }));
                          }}
                          style={{display: 'none'}}
                          id="tenant-image-upload-edit"
                        />
                        <label htmlFor="tenant-image-upload-edit" className="upload-label">
                          <i className="fas fa-cloud-upload-alt"></i>
                          <span>{t('common.selectOrDragImage')}</span>
                          <small>{t('common.imageUploadHintEdit')}</small>
                        </label>
                      </div>
                      
                      {/* Image Preview */}
                      {tenantFormData.tenantImages && tenantFormData.tenantImages.length > 0 && (
                        <div className="image-preview-grid">
                          {tenantFormData.tenantImages.map((image, index) => {
                            // Xử lý nhiều định dạng hình ảnh: URL string, object với url, hoặc File object
                            const imageUrl = image?.url || (typeof image === 'string' ? image : URL.createObjectURL(image));
                            
                            return (
                              <div key={index} className="image-preview-item">
                                <img
                                  src={imageUrl}
                                  alt={`Tenant ${index + 1}`}
                                  className="preview-image"
                                />
                                <button
                                  type="button"
                                  className="remove-image"
                                  onClick={() => {
                                    setTenantFormData(prev => ({
                                      ...prev,
                                      tenantImages: prev.tenantImages.filter((_, i) => i !== index)
                                    }));
                                  }}
                                >
                                  <i className="fas fa-times"></i>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div className="room-modal-footer">
            <button className="btn-secondary" onClick={closeTenantModals} disabled={savingTenant}>
              <i className="fas fa-times"></i> {t('common.cancel')}
            </button>
            <button className="btn-primary" onClick={handleSaveTenant} disabled={savingTenant}>
              {savingTenant ? (
                <><i className="fas fa-spinner fa-spin"></i> {t('tenants.form.updating')}</>
              ) : (
                <><i className="fas fa-save"></i> {t('tenants.form.update')}</>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ============ VEHICLE MODALS ============ */}
    
    {/* Vehicle List Modal */}
    {showVehiclesModal && (
      <div className="room-modal-backdrop" onClick={closeVehicleModals}>
        <div className="room-modal vehicle-modal large" onClick={e => e.stopPropagation()}>
          <div className="room-modal-header">
            <div className="modal-title-section">
              <h2 className="room-modal-title">
                <i className="fas fa-car"></i>
                Danh sách xe - {selectedRoomForVehicles?.name || selectedRoomForVehicles?.roomNumber}
              </h2>
              <div className="vehicle-count-info">
                {!loadingVehicles && (
                  <span className="vehicle-count">
                    {roomVehicles.length} {t('vehicles.registered')}
                  </span>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-add-vehicle" onClick={handleAddVehicle}>
                <i className="fas fa-plus"></i>
                {t('vehicles.add')}
              </button>
              <button className="room-modal-close" onClick={closeVehicleModals}>×</button>
            </div>
          </div>

          <div className="room-modal-body">
            {loadingVehicles ? (
              <div className="loading-section">
                <div className="loading-spinner">
                  <i className="fas fa-spinner fa-spin"></i>
                </div>
                <p>{t('vehicles.loading')}</p>
              </div>
            ) : roomVehicles.length === 0 ? (
              <div className="empty-section">
                <div className="empty-icon">
                  <i className="fas fa-car"></i>
                </div>
                <div className="empty-content">
                  <h3>{t('vehicles.empty.title')}</h3>
                  <p>{t('vehicles.empty.description')}</p>
                  <button className="btn-primary" onClick={handleAddVehicle}>
                    <i className="fas fa-plus"></i>
                    {t('vehicles.empty.addFirst')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="vehicles-grid">
                {roomVehicles.map((vehicle) => (
                  <div key={vehicle.id} className="vehicle-card pro-minimal">
                    <div className="vehicle-content">
                      <div className="vehicle-license">{vehicle.licensePlate}</div>
                      <div className="vehicle-type">{vehicle.vehicleType}</div>
                      <div className="vehicle-owner">{vehicle.ownerName}</div>
                      <div className="vehicle-phone">{vehicle.ownerPhone}</div>
                      {vehicle.notes && (
                        <div className="vehicle-notes">{vehicle.notes}</div>
                      )}
                    </div>
                    <div className="vehicle-actions">
                      <button 
                        className="action-btn edit" 
                        onClick={() => handleEditVehicle(vehicle)}
                        title="Sửa thông tin"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button 
                        className="action-btn delete" 
                        onClick={() => handleDeleteVehicle(vehicle)}
                        title="Xóa xe"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="room-modal-footer">
            <div className="footer-info">
              {!loadingVehicles && roomVehicles.length > 0 && (
                <span className="vehicle-summary">
                  Tổng: {roomVehicles.length} xe đăng ký
                </span>
              )}
            </div>
            <button className="btn-secondary" onClick={closeVehicleModals}>
              <i className="fas fa-times"></i> Đóng
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Add Vehicle Modal */}
    {showAddVehicleModal && (
      <div className="room-modal-backdrop" onClick={closeAddVehicleModal}>
        <div className="room-modal vehicle-form-modal" onClick={e => e.stopPropagation()}>
          <div className="room-modal-header">
            <h2 className="room-modal-title">
              <i className="fas fa-plus"></i>
              {t('vehicles.form.addTitle')}
            </h2>
            <button className="room-modal-close" onClick={closeAddVehicleModal}>×</button>
          </div>

          <div className="room-modal-body">
            <div className="form-container">
              <div className="form-section">
                <h3 className="section-title">
                  <i className="fas fa-car"></i>
                  {t('vehicles.form.vehicleInfo')}
                </h3>
                
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">{t('vehicles.form.licensePlate')} *</label>
                    <input
                      type="text"
                      className={`form-input ${vehicleFormErrors.licensePlate ? 'error' : ''}`}
                      value={vehicleFormData.licensePlate}
                      onChange={(e) => setVehicleFormData(prev => ({
                        ...prev,
                        licensePlate: e.target.value
                      }))}
                      placeholder={t('vehicles.form.licensePlatePlaceholder')}
                    />
                    {vehicleFormErrors.licensePlate && (
                      <span className="error-message">{vehicleFormErrors.licensePlate}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('vehicles.form.vehicleType')} *</label>
                    <input
                      type="text"
                      className={`form-input ${vehicleFormErrors.vehicleType ? 'error' : ''}`}
                      value={vehicleFormData.vehicleType}
                      onChange={(e) => setVehicleFormData(prev => ({
                        ...prev,
                        vehicleType: e.target.value
                      }))}
                      placeholder={t('vehicles.form.vehicleTypePlaceholder')}
                    />
                    {vehicleFormErrors.vehicleType && (
                      <span className="error-message">{vehicleFormErrors.vehicleType}</span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">{t('vehicles.form.owner')} *</label>
                  <select
                    className={`form-input ${vehicleFormErrors.ownerName ? 'error' : ''}`}
                    value={vehicleFormData.selectedTenantId || ''}
                    onChange={(e) => {
                      const selectedTenant = roomTenants.find(t => t.id === e.target.value);
                      setVehicleFormData(prev => ({
                        ...prev,
                        selectedTenantId: e.target.value,
                        ownerName: selectedTenant ? selectedTenant.fullName : '',
                        ownerPhone: selectedTenant ? selectedTenant.phone : ''
                      }));
                    }}
                  >
                    <option value="">
                      {loadingVehicles ? t('common.loading') : t('vehicles.form.selectOwner')}
                    </option>
                    {!loadingVehicles && roomTenants.filter(t => t.status === 'active').map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.fullName} - {tenant.phone}
                      </option>
                    ))}
                    {!loadingVehicles && roomTenants.filter(t => t.status === 'active').length === 0 && (
                      <option value="" disabled>{t('vehicles.form.noTenants')}</option>
                    )}
                  </select>
                  {vehicleFormErrors.ownerName && (
                    <span className="error-message">{vehicleFormErrors.ownerName}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="room-modal-footer">
            <button className="btn-secondary" onClick={closeAddVehicleModal} disabled={savingVehicle}>
              <i className="fas fa-times"></i> {t('common.cancel')}
            </button>
            <button className="btn-primary" onClick={handleSaveVehicle} disabled={savingVehicle}>
              {savingVehicle ? (
                <><i className="fas fa-spinner fa-spin"></i> {t('vehicles.form.adding')}</>
              ) : (
                <><i className="fas fa-plus"></i> {t('vehicles.add')}</>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Edit Vehicle Modal */}
    {showEditVehicleModal && (
      <div className="room-modal-backdrop" onClick={closeEditVehicleModal}>
        <div className="room-modal vehicle-form-modal" onClick={e => e.stopPropagation()}>
          <div className="room-modal-header">
            <h2 className="room-modal-title">
              <i className="fas fa-edit"></i>
              {t('vehicles.form.editTitle')} - {editingVehicle?.licensePlate}
            </h2>
            <button className="room-modal-close" onClick={closeEditVehicleModal}>×</button>
          </div>

          <div className="room-modal-body">
            <div className="form-container">
              <div className="form-section">
                <h3 className="section-title">
                  <i className="fas fa-car"></i>
                  Thông tin xe
                </h3>
                
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Biển số xe *</label>
                    <input
                      type="text"
                      className={`form-input ${vehicleFormErrors.licensePlate ? 'error' : ''}`}
                      value={vehicleFormData.licensePlate}
                      onChange={(e) => setVehicleFormData(prev => ({
                        ...prev,
                        licensePlate: e.target.value
                      }))}
                      placeholder="Nhập biển số xe"
                    />
                    {vehicleFormErrors.licensePlate && (
                      <span className="error-message">{vehicleFormErrors.licensePlate}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('vehicles.form.vehicleType')} *</label>
                    <select
                      className={`form-input ${vehicleFormErrors.vehicleType ? 'error' : ''}`}
                      value={vehicleFormData.vehicleType}
                      onChange={(e) => setVehicleFormData(prev => ({
                        ...prev,
                        vehicleType: e.target.value
                      }))}
                    >
                      <option value="">{t('vehicles.form.selectVehicleType')}</option>
                      <option value="Xe máy">🏍️ Xe máy</option>
                      <option value="Xe đạp">🚲 Xe đạp</option>
                      <option value="Ô tô">🚗 Ô tô</option>
                      <option value="Xe điện">⚡ Xe điện</option>
                      <option value="Khác">🔧 Khác</option>
                    </select>
                    {vehicleFormErrors.vehicleType && (
                      <span className="error-message">{vehicleFormErrors.vehicleType}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3 className="section-title">
                  <i className="fas fa-user"></i>
                  Thông tin chủ xe
                </h3>
                
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Tên chủ xe *</label>
                    <input
                      type="text"
                      className={`form-input ${vehicleFormErrors.ownerName ? 'error' : ''}`}
                      value={vehicleFormData.ownerName}
                      onChange={(e) => setVehicleFormData(prev => ({
                        ...prev,
                        ownerName: e.target.value
                      }))}
                      placeholder="Nhập tên chủ xe"
                    />
                    {vehicleFormErrors.ownerName && (
                      <span className="error-message">{vehicleFormErrors.ownerName}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Số điện thoại *</label>
                    <input
                      type="tel"
                      className={`form-input ${vehicleFormErrors.ownerPhone ? 'error' : ''}`}
                      value={vehicleFormData.ownerPhone}
                      onChange={(e) => setVehicleFormData(prev => ({
                        ...prev,
                        ownerPhone: e.target.value
                      }))}
                      placeholder="Nhập số điện thoại"
                    />
                    {vehicleFormErrors.ownerPhone && (
                      <span className="error-message">{vehicleFormErrors.ownerPhone}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3 className="section-title">
                  <i className="fas fa-sticky-note"></i>
                  Thông tin bổ sung
                </h3>
                
                <div className="form-group">
                  <label className="form-label">Ghi chú</label>
                  <textarea
                    className="form-input"
                    value={vehicleFormData.notes}
                    onChange={(e) => setVehicleFormData(prev => ({
                      ...prev,
                      notes: e.target.value
                    }))}
                    placeholder={t('vehicles.form.notesPlaceholder')}
                    rows="3"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="room-modal-footer">
            <button className="btn-secondary" onClick={closeEditVehicleModal} disabled={savingVehicle}>
              <i className="fas fa-times"></i> Hủy
            </button>
            <button className="btn-primary" onClick={handleSaveVehicle} disabled={savingVehicle}>
              {savingVehicle ? (
                <><i className="fas fa-spinner fa-spin"></i> {t('vehicles.form.updating')}</>
              ) : (
                <><i className="fas fa-save"></i> {t('vehicles.form.update')}</>
              )}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default RoomsManagement;
