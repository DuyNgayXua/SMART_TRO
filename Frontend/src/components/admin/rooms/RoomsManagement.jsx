/* global XLSX */
import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import SideBar from "../../common/adminSidebar";
import { useToast } from "../../../hooks/useToast";
import { useAuth } from "../../../contexts/AuthContext";
import "../admin-global.css";
import "./rooms.css";
import roomsAPI from '../../../services/roomsAPI';
import amenitiesAPI from '../../../services/amenitiesAPI';
import depositContractsAPI from '../../../services/depositContractsAPI';
import contractsAPI from '../../../services/contractsAPI';
import tenantsAPI from '../../../services/tenantsAPI';
import invoicesAPI from '../../../services/invoicesAPI';
import api from '../../../services/api';

const RoomsManagement = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchFilters, setSearchFilters] = useState({
    search: ''
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 7
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
    tenantEmail: '',
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
    email: '',
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
  
  // Room Transfer Modal States
  const [showRoomTransferModal, setShowRoomTransferModal] = useState(false);
  
  // Import Excel Modal States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importData, setImportData] = useState([]);
  const [importLoading, setImportLoading] = useState(false);

  // Billing Excel Modal States
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [billingFile, setBillingFile] = useState(null);
  const [billingData, setBillingData] = useState([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [selectedRoomForTransfer, setSelectedRoomForTransfer] = useState(null);
  
  // Expiring Confirm Modal States
  const [showExpiringConfirmModal, setShowExpiringConfirmModal] = useState(false);
  const [selectedRoomForExpiring, setSelectedRoomForExpiring] = useState(null);
  
  // Cancel Expiring Modal States
  const [showCancelExpiringModal, setShowCancelExpiringModal] = useState(false);
  const [selectedRoomForCancelExpiring, setSelectedRoomForCancelExpiring] = useState(null);
  
  // Terminate Contract Modal States
  const [showTerminateContractModal, setShowTerminateContractModal] = useState(false);
  const [selectedRoomForTerminate, setSelectedRoomForTerminate] = useState(null);
  const [createFinalInvoice, setCreateFinalInvoice] = useState(false);
  const [terminatingContract, setTerminatingContract] = useState(false);
  const [pendingTermination, setPendingTermination] = useState(false); // Flag để xử lý kết thúc sau khi tạo hóa đơn
  
  const [currentRoomContract, setCurrentRoomContract] = useState(null);
  const [availableRoomsForTransfer, setAvailableRoomsForTransfer] = useState([]);
  const [loadingAvailableRooms, setLoadingAvailableRooms] = useState(false);
  const [selectedTargetRoom, setSelectedTargetRoom] = useState(null);
  const [transferring, setTransferring] = useState(false);
  
  // Invoice Modal States
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedRoomForInvoice, setSelectedRoomForInvoice] = useState(null);
  const [invoiceFormData, setInvoiceFormData] = useState({
    issueDate: new Date().toISOString().split('T')[0], // Ngày lập hóa đơn mặc định là hôm nay
    dueDate: '',
    periodStart: '',
    periodEnd: '',
    electricOldReading: 0,
    electricNewReading: 0,
    electricRate: 3500, // Giá điện mặc định
    waterOldReading: 0,
    waterNewReading: 0,
    waterRate: 20000, // Giá nước mặc định
    waterBillingType: 'perCubicMeter', // 'perCubicMeter' hoặc 'perPerson'
    waterPricePerPerson: 50000, // Giá nước theo người
    charges: [{
      type: 'rent',
      description: 'Tiền phòng',
      amount: 0,
      quantity: 1,
      unitPrice: 0
    }],
    discount: 0,
    notes: ''
  });
  const [loadingInvoiceInfo, setLoadingInvoiceInfo] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [contractInfo, setContractInfo] = useState(null);
  const [invoiceFormErrors, setInvoiceFormErrors] = useState({});
  
  const [rentalContractData, setRentalContractData] = useState({
    tenants: [{
      tenantName: '',
      tenantPhone: '',
      tenantEmail: '',
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
    if (!user) {
      return;
    }
    setLoading(true);
    try {
      const params = {
        page: pagination.currentPage,
        limit: pagination.itemsPerPage,
        search: searchFilters.search || undefined,
        status: activeTab !== 'all' ? activeTab : undefined
      };
      const res = await roomsAPI.searchRooms(params); // { success, data: { rooms, pagination } }
      if (res.success) {
    const list = res.data.rooms.map(r => ({
          id: r._id,
          name: r.roomNumber,
          roomNumber: r.roomNumber,
            status: r.status,
            price: r.price,
            deposit: r.deposit,
            electricityPrice: r.electricityPrice,
            waterPrice: r.waterPrice,
            servicePrice: r.servicePrice,
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
      if (!user) {
        return;
      }
      const statsRes = await roomsAPI.getRoomStatistics();
      if (statsRes.success) {
        const stats = statsRes.data;
        const counts = {
          available: stats.available?.count||0,
          rented: stats.rented?.count||0,
          reserved: stats.reserved?.count||0,
          expiring: stats.expiring?.count||0
        };
        const totalValidRooms = counts.available + counts.rented + counts.reserved + counts.expiring;
        
        setStatusCounts({
          all: totalValidRooms,
          ...counts
        });
      }
    } catch (e) {
      console.error('Error loading rooms list:', e);
      showToast('error', t('common.errors.loadFailed') || 'Lỗi tải dữ liệu');
    } finally { setLoading(false); }
  }, [activeTab, searchFilters, pagination.currentPage, pagination.itemsPerPage, showToast, t, user]);

  const fetchDepositContracts = useCallback(async () => {
    try {
      const res = await depositContractsAPI.getDepositContracts();
      if (res.success) {
        setDepositContracts(res.data || []); // Change: res.data instead of res.data.contracts
      }
    } catch (e) {
      console.error('Error loading deposit contracts:', e);
    }
  }, []);

  useEffect(() => {
    // Chỉ fetch data khi user đã được load
    if (user) {
      fetchRooms();
      fetchDepositContracts();
    }
  }, [fetchRooms, fetchDepositContracts, user]);

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

  // Helper function to get deposit contract info for room
  const getDepositContractInfo = (roomNumber) => {
    if (!depositContracts || depositContracts.length === 0) {
      return null;
    }
    
    return depositContracts.find(contract => {
      const contractRoomNumber = contract.room?.roomNumber || contract.room;
      const statusMatch = contract.status === 'active' || 
                         contract.status === 'confirmed' || 
                         contract.status === 'pending' ||
                         !contract.status;
      const roomMatch = contractRoomNumber === roomNumber || 
                       contractRoomNumber?.toString() === roomNumber?.toString();
      return roomMatch && statusMatch;
    });
  };

  // Helper function to get current rental contract info for room
  const getRentalContractInfo = async (roomId) => {
    try {
      const response = await contractsAPI.getContractsByRoom(roomId);
      if (response.success && response.data && response.data.length > 0) {
        // Tìm contract active (chưa kết thúc)
        const activeContract = response.data.find(contract => 
          contract.status === 'active' && 
          new Date(contract.endDate) > new Date()
        );
        return activeContract || response.data[0]; // Fallback to first contract if no active found
      }
      return null;
    } catch (error) {
      console.error('Error fetching rental contract:', error);
      return null;
    }
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
      search: ''
    });
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handleExportExcel = () => {
    try {
      if (!window.XLSX) {
        showToast('error', 'Thư viện Excel chưa được tải');
        return;
      }

      if (rooms.length === 0) {
        showToast('error', 'Không có dữ liệu để xuất');
        return;
      }

      // Prepare data for export
      const exportData = rooms.map((room, index) => {
        // Process amenities - more robust handling
        let amenitiesText = '-';
        if (room.amenities) {
          if (Array.isArray(room.amenities)) {
            // If array of strings
            if (typeof room.amenities[0] === 'string') {
              amenitiesText = room.amenities.join(', ');
            }
            // If array of objects with name/label property
            else if (typeof room.amenities[0] === 'object') {
              amenitiesText = room.amenities
                .map(a => a?.name || a?.label || a?.title || JSON.stringify(a))
                .filter(Boolean)
                .join(', ');
            }
          } else if (typeof room.amenities === 'object') {
            // If object, try to extract meaningful values
            const values = Object.entries(room.amenities)
              .filter(([key, value]) => value && key !== '_id' && key !== '__v')
              .map(([key, value]) => {
                if (typeof value === 'string') return value;
                if (typeof value === 'object' && value.name) return value.name;
                return key;
              });
            amenitiesText = values.length > 0 ? values.join(', ') : JSON.stringify(room.amenities);
          } else if (typeof room.amenities === 'string') {
            amenitiesText = room.amenities;
          }
        }

        // Format water price - Room schema only has waterPrice (VNĐ/m³)
        const waterPriceText = room.waterPrice 
          ? `${room.waterPrice.toLocaleString('vi-VN')} VNĐ/m³` 
          : '-';

        return {
          'STT': index + 1,
          'Tên phòng': room.name || room.roomNumber || '-',
          'Trạng thái': room.status === 'available' ? 'Trống' :
                       room.status === 'rented' ? 'Đã thuê' :
                       room.status === 'deposit' ? 'Đã đặt cọc' :
                       room.status === 'expiring' ? 'Sắp kết thúc' :
                       room.status === 'maintenance' ? 'Bảo trì' : room.status || '-',
          'Giá thuê (VNĐ/tháng)': room.price ? room.price.toLocaleString('vi-VN') : '-',
          'Giá cọc (VNĐ)': room.deposit ? room.deposit.toLocaleString('vi-VN') : '-',
          'Diện tích (m²)': room.area || '-',
          'Sức chứa (người)': room.capacity || '-',
          'Số xe tối đa': room.vehicleCount || room.maxVehicles || '-',
          'Giá điện (VNĐ/kWh)': room.electricityPrice ? room.electricityPrice.toLocaleString('vi-VN') : '-',
          'Giá nước': waterPriceText,
          'Phí dịch vụ (VNĐ/tháng)': room.servicePrice ? room.servicePrice.toLocaleString('vi-VN') : '-',
          'Tiện ích': amenitiesText
        };
      });

      // Create worksheet
      const ws = window.XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 5 },  // STT
        { wch: 20 }, // Tên phòng
        { wch: 15 }, // Trạng thái
        { wch: 18 }, // Giá thuê
        { wch: 15 }, // Giá cọc
        { wch: 12 }, // Diện tích
        { wch: 15 }, // Sức chứa
        { wch: 12 }, // Số xe tối đa
        { wch: 18 }, // Giá điện
        { wch: 25 }, // Giá nước
        { wch: 20 }, // Phí dịch vụ
        { wch: 40 }  // Tiện ích
      ];
      ws['!cols'] = colWidths;

      // Create workbook
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Danh sách phòng');

      // Generate filename with current date
      const today = new Date();
      const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
      const filename = `Danh_sach_phong_${dateStr}.xlsx`;

      // Save file
      window.XLSX.writeFile(wb, filename);

      showToast('success', t('rooms.exportSuccess', 'Xuất Excel thành công!'));
    } catch (error) {
      console.error('Error exporting Excel:', error);
      showToast('error', t('rooms.exportError', 'Lỗi khi xuất Excel: ') + error.message);
    }
  };

  // Import Excel Functions
  const handleDownloadTemplate = () => {
    try {
      if (!window.XLSX) {
        showToast('error', 'Thư viện Excel chưa được tải');
        return;
      }

      // Create template data with one example row
      const templateData = [
        {
          'Tên phòng': 'P101',
          'Giá thuê (VNĐ/tháng)': '3000000',
          'Giá cọc (VNĐ)': '3000000',
          'Diện tích (m²)': '25',
          'Sức chứa (người)': '2',
          'Số xe tối đa': '1',
          'Giá điện (VNĐ/kWh)': '3500',
          'Giá nước (VNĐ/m³)': '25000',
          'Phí dịch vụ (VNĐ/tháng)': '150000',
          'Mô tả': 'Phòng đầy đủ tiện nghi, thoáng mát'
        }
      ];

      const ws = window.XLSX.utils.json_to_sheet(templateData);
      
      // Set column widths
      const colWidths = [
        { wch: 15 }, // Tên phòng
        { wch: 20 }, // Giá thuê
        { wch: 18 }, // Giá cọc
        { wch: 15 }, // Diện tích
        { wch: 18 }, // Sức chứa
        { wch: 15 }, // Số xe
        { wch: 20 }, // Giá điện
        { wch: 22 }, // Giá nước
        { wch: 22 }, // Phí dịch vụ
        { wch: 40 }  // Mô tả
      ];
      ws['!cols'] = colWidths;

      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Mẫu Import Phòng');

      window.XLSX.writeFile(wb, 'Mau_Import_Phong.xlsx');
      showToast('success', 'Tải file mẫu thành công!');
    } catch (error) {
      console.error('Error downloading template:', error);
      showToast('error', 'Lỗi khi tải file mẫu: ' + error.message);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (!validTypes.includes(file.type)) {
      showToast('error', 'Vui lòng chọn file Excel (.xlsx, .xls)');
      return;
    }

    setImportFile(file);
    readExcelFile(file);
  };

  const readExcelFile = (file) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = window.XLSX.utils.sheet_to_json(firstSheet);

        // Transform data to match Room schema
        const transformedData = jsonData.map((row, index) => {
          return {
            id: `temp-${index}`,
            roomNumber: row['Tên phòng']?.toString() || '',
            status: 'available', // Mặc định trạng thái trống
            price: parseFloat(row['Giá thuê (VNĐ/tháng)']?.toString().replace(/[^0-9]/g, '') || 0),
            deposit: parseFloat(row['Giá cọc (VNĐ)']?.toString().replace(/[^0-9]/g, '') || 0),
            area: parseFloat(row['Diện tích (m²)'] || 0),
            capacity: parseInt(row['Sức chứa (người)'] || 1),
            vehicleCount: parseInt(row['Số xe tối đa'] || 0),
            electricityPrice: parseFloat(row['Giá điện (VNĐ/kWh)']?.toString().replace(/[^0-9]/g, '') || 3500),
            waterPrice: parseFloat(row['Giá nước (VNĐ/m³)']?.toString().replace(/[^0-9]/g, '') || 25000),
            servicePrice: parseFloat(row['Phí dịch vụ (VNĐ/tháng)']?.toString().replace(/[^0-9]/g, '') || 150000),
            description: row['Mô tả'] || '',
            isValid: true,
            errors: []
          };
        });

        // Validate data
        const validatedData = transformedData.map((room, index) => {
          const errors = [];
          
          // Check required fields
          if (!room.roomNumber) errors.push('Thiếu tên phòng');
          if (room.price <= 0) errors.push('Giá thuê không hợp lệ');
          if (room.deposit < 0) errors.push('Giá cọc không hợp lệ');
          if (room.area <= 0) errors.push('Diện tích không hợp lệ');

          // Check duplicate in import file
          const duplicateInFile = transformedData.filter(
            (r, i) => i !== index && r.roomNumber && r.roomNumber.toLowerCase() === room.roomNumber?.toLowerCase()
          );
          if (duplicateInFile.length > 0) {
            errors.push('Tên phòng bị trùng trong file');
          }

          // Check duplicate with existing rooms
          const duplicateInSystem = rooms.find(
            (r) => r.roomNumber && room.roomNumber && r.roomNumber.toLowerCase() === room.roomNumber.toLowerCase()
          );
          if (duplicateInSystem) {
            errors.push('Tên phòng đã tồn tại trong hệ thống');
          }
          
          return {
            ...room,
            isValid: errors.length === 0,
            errors
          };
        });

        setImportData(validatedData);
        showToast('success', `Đọc được ${validatedData.length} phòng từ file Excel`);
      } catch (error) {
        console.error('Error reading Excel file:', error);
        showToast('error', 'Lỗi khi đọc file Excel: ' + error.message);
        setImportData([]);
      }
    };

    reader.onerror = () => {
      showToast('error', 'Lỗi khi đọc file');
      setImportData([]);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (importData.length === 0) {
      showToast('error', 'Không có dữ liệu để import');
      return;
    }

    const validRooms = importData.filter(room => room.isValid);
    if (validRooms.length === 0) {
      showToast('error', 'Không có phòng hợp lệ để import');
      return;
    }

    setImportLoading(true);
    try {
      let successCount = 0;
      let failCount = 0;

      for (const room of validRooms) {
        try {
          const roomData = {
            roomNumber: room.roomNumber,
            price: room.price,
            deposit: room.deposit,
            area: room.area,
            capacity: room.capacity,
            vehicleCount: room.vehicleCount,
            electricityPrice: room.electricityPrice,
            waterPrice: room.waterPrice,
            servicePrice: room.servicePrice,
            description: room.description,
            status: room.status,
            amenities: [],
            images: []
          };

          await roomsAPI.createRoom(roomData);
          successCount++;
        } catch (error) {
          console.error('Error importing room:', room.roomNumber, error);
          failCount++;
        }
      }

      showToast('success', `Import thành công ${successCount} phòng${failCount > 0 ? `, thất bại ${failCount} phòng` : ''}`);
      
      // Close modal and refresh rooms list
      setShowImportModal(false);
      setImportFile(null);
      setImportData([]);
      fetchRooms();
    } catch (error) {
      console.error('Error during import:', error);
      showToast('error', 'Lỗi khi import: ' + error.message);
    } finally {
      setImportLoading(false);
    }
  };

  const handleEditImportRow = (index, field, value) => {
    const updatedData = [...importData];
    updatedData[index][field] = value;

    // Re-validate all rows (to check duplicates)
    updatedData.forEach((room, idx) => {
      const errors = [];
      
      // Check required fields
      if (!room.roomNumber) errors.push('Thiếu tên phòng');
      if (room.price <= 0) errors.push('Giá thuê không hợp lệ');
      if (room.deposit < 0) errors.push('Giá cọc không hợp lệ');
      if (room.area <= 0) errors.push('Diện tích không hợp lệ');

      // Check duplicate room name in import data
      const duplicateInImport = updatedData.filter(
        (r, i) => i !== idx && r.roomNumber && r.roomNumber.toLowerCase() === room.roomNumber?.toLowerCase()
      );
      if (duplicateInImport.length > 0) {
        errors.push('Tên phòng bị trùng trong file');
      }

      updatedData[idx].isValid = errors.length === 0;
      updatedData[idx].errors = errors;
    });

    setImportData(updatedData);
  };

  // Kiểm tra tên phòng khi rời khỏi ô input (onBlur)
  const handleCheckRoomNameExists = async (index, roomNumber) => {
    if (!roomNumber || !roomNumber.trim()) return;

    try {
      // Gọi API kiểm tra tên phòng có tồn tại chưa
      const response = await roomsAPI.searchRooms({
        search: roomNumber.trim(),
        page: 1,
        limit: 1
      });

      const existingRoom = response?.data?.rooms?.find(
        (r) => r.roomNumber?.toLowerCase() === roomNumber.trim().toLowerCase()
      );

      if (existingRoom) {
        const updatedData = [...importData];
        const currentErrors = updatedData[index].errors || [];
        
        // Thêm lỗi nếu chưa có
        if (!currentErrors.includes('Tên phòng đã tồn tại trong hệ thống')) {
          updatedData[index].errors = [...currentErrors, 'Tên phòng đã tồn tại trong hệ thống'];
          updatedData[index].isValid = false;
          setImportData(updatedData);
        }
        
        showToast('error', `Tên phòng "${roomNumber}" đã tồn tại!`);
      } else {
        // Xóa lỗi "tồn tại trong hệ thống" nếu có
        const updatedData = [...importData];
        const currentErrors = updatedData[index].errors || [];
        updatedData[index].errors = currentErrors.filter(
          err => err !== 'Tên phòng đã tồn tại trong hệ thống'
        );
        updatedData[index].isValid = updatedData[index].errors.length === 0;
        setImportData(updatedData);
      }
    } catch (error) {
      console.error('Error checking room name:', error);
    }
  };

  // ==================== BILLING EXCEL FUNCTIONS ====================
  
  const handleGenerateBillingTemplate = async () => {
    try {
      setBillingLoading(true);

      // Lấy tất cả các phòng đang được thuê
      const roomsResponse = await roomsAPI.searchRooms({
        status: 'rented',
        page: 1,
        limit: 1000
      });

      console.log('Rooms Response:', roomsResponse);

      // Fix: API trả về data.rooms chứ không phải data trực tiếp
      const rentedRooms = roomsResponse?.data?.rooms || roomsResponse?.rooms || [];
      
      if (rentedRooms.length === 0) {
        showToast('warning', 'Không có phòng nào đang được thuê');
        setBillingLoading(false);
        return;
      }

      console.log('Rented rooms:', rentedRooms.length, rentedRooms);

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Prepare data rows with billing period for each room
      const today = new Date();

      const data = [
        [
          'STT',
          'Tên phòng',
          'Khách thuê',
          'Kỳ thanh toán (Từ - Đến)',
          'Tiền phòng (đ/tháng)',
          'Số người thuê',
          'Giá điện (đ/kWh)',
          'Điện cũ (số)',
          'Điện mới (số)',
          'Loại tính nước',
          'Giá nước/Người (đ)',
          'Nước cũ (số)',
          'Nước mới (số)',
          'Phí dịch vụ (đ)',
          'Ghi chú',
          'Mã HĐ (ẩn - đừng xóa)' // Hidden column for invoice creation
        ]
      ];

      let recordCount = 0;

      // Process each rented room - giống như lúc lập hóa đơn
      for (let i = 0; i < rentedRooms.length; i++) {
        const room = rentedRooms[i];
        console.log(`\n=== Processing room ${i + 1}/${rentedRooms.length}: ${room.roomNumber} ===`);
        console.log('Room ID:', room._id || room.id);
        console.log('Room status:', room.status);
        
        try {
          // Lấy thông tin hợp đồng hiện tại của phòng - GIỐNG LÚC LẬP HÓA ĐƠN
          const contractResponse = await contractsAPI.getContractsByRoom(room._id || room.id);
          console.log('Contract Response:', contractResponse);
          
          if (!contractResponse.success || !contractResponse.data || contractResponse.data.length === 0) {
            console.log('❌ No contract for room:', room.roomNumber);
            continue;
          }

          console.log('Contracts found:', contractResponse.data.length);
          console.log('Contract statuses:', contractResponse.data.map(c => ({ id: c._id, status: c.status })));

          // Lấy hợp đồng đang hoạt động - GIỐNG LÚC LẬP HÓA ĐƠN
          const activeContract = contractResponse.data.find(contract => contract.status === 'active');
          
          if (!activeContract) {
            console.log('❌ No active contract for room:', room.roomNumber);
            console.log('Available contracts:', contractResponse.data.map(c => ({ status: c.status, id: c._id })));
            continue;
          }

          console.log('✅ Active contract found:', activeContract._id);

          const contractId = activeContract._id || activeContract.id;
          const isWaterPerPerson = activeContract.waterChargeType === 'per_person';
          const tenantCount = activeContract.tenants?.length || 0;
          
          // Lấy thông tin hóa đơn cuối cùng để lấy chỉ số và tính kỳ thanh toán
          let electricOld = activeContract.currentElectricIndex || 0;
          let waterOld = activeContract.currentWaterIndex || 0;
          let periodStartDate, periodEndDate;

          try {
            const invoiceInfoResponse = await invoicesAPI.getNewInvoiceInfo(contractId);
            
            if (invoiceInfoResponse.success) {
              const { lastInvoice } = invoiceInfoResponse.data;
              
              if (lastInvoice) {
                electricOld = lastInvoice.electricNewReading || electricOld;
                // Chỉ lấy waterOld nếu KHÔNG tính theo người
                if (!isWaterPerPerson) {
                  waterOld = lastInvoice.waterNewReading || waterOld;
                }
                
                // Kỳ thanh toán mới = từ ngày kết thúc kỳ cũ + 1 ngày
                if (lastInvoice.periodEnd) {
                  const lastPeriodEnd = new Date(lastInvoice.periodEnd);
                  periodStartDate = new Date(lastPeriodEnd);
                  periodStartDate.setDate(periodStartDate.getDate() + 1);
                }
              }
            }
          } catch (err) {
            console.log('No previous invoice for contract:', contractId);
          }

          // Nếu không có hóa đơn trước, lấy từ ngày bắt đầu hợp đồng
          if (!periodStartDate) {
            periodStartDate = activeContract.startDate ? new Date(activeContract.startDate) : new Date();
          }
          
          // Kỳ kết thúc = cuối tháng của periodStart (ngày 30 hoặc 31)
          periodEndDate = new Date(periodStartDate);
          periodEndDate.setMonth(periodEndDate.getMonth() + 1);
          periodEndDate.setDate(0); // Ngày cuối tháng trước = cuối tháng của periodStart
          
          const periodStr = `${periodStartDate.toLocaleDateString('vi-VN')} - ${periodEndDate.toLocaleDateString('vi-VN')}`;

          // Lấy tên khách thuê từ hợp đồng
          const tenantNames = activeContract.tenants?.map(t => t.fullName || '').filter(n => n).join(', ') || '';
          console.log('Tenant names:', tenantNames);
          console.log('Tenants array:', activeContract.tenants);
          
          // Lấy giá từ hợp đồng
          const monthlyRent = activeContract.monthlyRent || room.price || 0;
          const electricRate = activeContract.electricPrice || room.electricityPrice || 3000;
          const servicePrice = activeContract.servicePrice || room.servicePrice || 0;
          
          // Xử lý giá nước dựa trên loại tính
          let waterRateDisplay, waterOldDisplay, waterNewDisplay;
          
          if (isWaterPerPerson) {
            // Tính theo người: Hiển thị giá/người, không có chỉ số
            waterRateDisplay = activeContract.waterPricePerPerson || 50000;
            waterOldDisplay = '-'; // Không cần chỉ số cũ
            waterNewDisplay = '-'; // Không cần chỉ số mới
          } else {
            // Tính theo số đo: Hiển thị giá/m³, có chỉ số cũ/mới
            waterRateDisplay = activeContract.waterPrice || room.waterPrice || 20000;
            waterOldDisplay = waterOld;
            waterNewDisplay = ''; // User will fill
          }

          console.log('Water billing type:', isWaterPerPerson ? 'perPerson' : 'perCubicMeter');
          console.log('Rates - Rent:', monthlyRent, 'Electric:', electricRate, 'Water:', waterRateDisplay, 'Service:', servicePrice);
          console.log('Billing period:', periodStr);

          data.push([
            recordCount + 1,
            room.roomNumber || '',
            tenantNames,
            periodStr, // Kỳ thanh toán riêng cho từng phòng
            monthlyRent, // Tiền phòng
            tenantCount,
            electricRate,
            electricOld,
            '', // Electric new - user will fill
            isWaterPerPerson ? 'Theo người' : 'Theo số đo',
            waterRateDisplay,
            waterOldDisplay,
            waterNewDisplay,
            servicePrice,
            '', // Ghi chú
            contractId // Mã HĐ ở cột cuối (ẩn)
          ]);

          recordCount++;
          console.log(`✅ Added record ${recordCount} for room ${room.roomNumber}`);
        } catch (error) {
          console.error('❌ Error processing room:', room.roomNumber, error);
        }
      }

      console.log(`\n=== SUMMARY: ${recordCount} records added ===`);

      if (recordCount === 0) {
        showToast('warning', 'Không có hợp đồng nào đang hoạt động');
        setBillingLoading(false);
        return;
      }

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(data);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 5 },   // STT
        { wch: 25 },  // Mã hợp đồng
        { wch: 15 },  // Tên phòng
        { wch: 20 },  // Khách thuê
        { wch: 15 },  // Giá điện
        { wch: 12 },  // Điện cũ
        { wch: 12 },  // Điện mới
        { wch: 15 },  // Giá nước
        { wch: 18 },  // Loại tính nước
        { wch: 12 },  // Nước cũ
        { wch: 12 },  // Nước mới
        { wch: 15 },  // Phí dịch vụ
        { wch: 30 }   // Ghi chú
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Tính tiền');
      
      // Download file
      const date = new Date();
      const fileName = `Tinh_Tien_Thang_${date.getMonth() + 1}_${date.getFullYear()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      showToast('success', `Đã tạo file mẫu với ${recordCount} hợp đồng`);
    } catch (error) {
      console.error('Error generating billing template:', error);
      showToast('error', 'Lỗi khi tạo file mẫu: ' + error.message);
    } finally {
      setBillingLoading(false);
    }
  };

  const handleBillingFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/)) {
      showToast('error', 'Vui lòng chọn file Excel (.xlsx hoặc .xls)');
      return;
    }

    setBillingFile(file);
    readBillingExcelFile(file);
  };

  const readBillingExcelFile = (file) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        setBillingLoading(true);
        
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Skip header row
        const rows = jsonData.slice(1);
        
        const billingRecords = rows
          .filter(row => row && row.length > 0 && row[15]) // Must have contract ID (last column)
          .map((row, index) => {
            const isWaterPerPerson = row[9]?.toString().trim() === 'Theo người';
            const tenantCount = parseInt(row[5]) || 0;
            
            const record = {
              stt: row[0] || index + 1,
              roomNumber: row[1]?.toString().trim() || '',
              tenantName: row[2]?.toString().trim() || '',
              billingPeriod: row[3]?.toString().trim() || '', // Kỳ thanh toán
              monthlyRent: parseFloat(row[4]) || 0, // Tiền phòng
              tenantCount: tenantCount,
              electricRate: parseFloat(row[6]) || 3000,
              electricOld: parseFloat(row[7]) || 0,
              electricNew: parseFloat(row[8]) || 0,
              waterBillingType: isWaterPerPerson ? 'perPerson' : 'perCubicMeter',
              waterRate: parseFloat(row[10]) || (isWaterPerPerson ? 50000 : 20000),
              waterOld: row[11] === '-' ? 0 : (parseFloat(row[11]) || 0),
              waterNew: row[12] === '-' ? 0 : (parseFloat(row[12]) || 0),
              servicePrice: parseFloat(row[13]) || 0,
              note: row[14]?.toString().trim() || '',
              contractId: row[15]?.toString().trim() || '', // Mã HĐ ở cột cuối (ẩn)
              errors: [],
              isValid: true
            };

            // Validate
            const errors = [];
            
            if (!record.contractId) errors.push('Thiếu mã hợp đồng');
            if (record.electricNew < record.electricOld) errors.push('Chỉ số điện mới phải >= chỉ số cũ');
            
            // Chỉ validate chỉ số nước nếu tính theo số đo
            if (!isWaterPerPerson && record.waterNew < record.waterOld) {
              errors.push('Chỉ số nước mới phải >= chỉ số cũ');
            }
            
            if (record.electricRate <= 0) errors.push('Giá điện không hợp lệ');
            if (record.waterRate <= 0) errors.push('Giá nước không hợp lệ');
            
            if (isWaterPerPerson && tenantCount <= 0) {
              errors.push('Số người thuê phải > 0');
            }

            // Calculate amounts
            const electricConsumption = record.electricNew - record.electricOld;
            record.electricAmount = electricConsumption * record.electricRate;
            
            // Tính tiền nước dựa trên loại tính
            if (isWaterPerPerson) {
              // Tính theo người: số người × giá/người
              record.waterAmount = tenantCount * record.waterRate;
            } else {
              // Tính theo số đo: (mới - cũ) × giá/m³
              const waterConsumption = record.waterNew - record.waterOld;
              record.waterAmount = waterConsumption * record.waterRate;
            }
            
            record.totalAmount = (record.monthlyRent || 0) + record.electricAmount + record.waterAmount + record.servicePrice;

            record.errors = errors;
            record.isValid = errors.length === 0;
            
            return record;
          });

        setBillingData(billingRecords);
        
        if (billingRecords.length === 0) {
          showToast('warning', 'File không có dữ liệu hợp lệ');
        } else {
          const validCount = billingRecords.filter(r => r.isValid).length;
          showToast('success', `Đọc file thành công: ${validCount}/${billingRecords.length} bản ghi hợp lệ`);
        }
      } catch (error) {
        console.error('Error reading billing file:', error);
        showToast('error', 'Lỗi khi đọc file: ' + error.message);
        setBillingData([]);
      } finally {
        setBillingLoading(false);
      }
    };

    reader.onerror = () => {
      showToast('error', 'Lỗi khi đọc file');
      setBillingLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleEditBillingRow = (index, field, value) => {
    const updatedData = [...billingData];
    updatedData[index][field] = parseFloat(value) || 0;

    // Re-validate and recalculate
    const record = updatedData[index];
    const isWaterPerPerson = record.waterBillingType === 'perPerson';
    const errors = [];
    
    if (!record.contractId) errors.push('Thiếu mã hợp đồng');
    if (record.electricNew < record.electricOld) errors.push('Chỉ số điện mới phải >= chỉ số cũ');
    
    // Chỉ validate chỉ số nước nếu tính theo số đo
    if (!isWaterPerPerson && record.waterNew < record.waterOld) {
      errors.push('Chỉ số nước mới phải >= chỉ số cũ');
    }
    
    if (record.electricRate <= 0) errors.push('Giá điện không hợp lệ');
    if (record.waterRate <= 0) errors.push('Giá nước không hợp lệ');
    
    if (isWaterPerPerson && record.tenantCount <= 0) {
      errors.push('Số người thuê phải > 0');
    }

    // Recalculate amounts
    const electricConsumption = record.electricNew - record.electricOld;
    record.electricAmount = electricConsumption * record.electricRate;
    
    // Tính tiền nước dựa trên loại tính
    if (isWaterPerPerson) {
      // Tính theo người: số người × giá/người
      record.waterAmount = record.tenantCount * record.waterRate;
    } else {
      // Tính theo số đo: (mới - cũ) × giá/m³
      const waterConsumption = record.waterNew - record.waterOld;
      record.waterAmount = waterConsumption * record.waterRate;
    }
    
    record.totalAmount = (record.monthlyRent || 0) + record.electricAmount + record.waterAmount + record.servicePrice;

    record.errors = errors;
    record.isValid = errors.length === 0;

    setBillingData(updatedData);
  };

  const handleCreateInvoices = async () => {
    try {
      setBillingLoading(true);

      const validRecords = billingData.filter(r => r.isValid);
      if (validRecords.length === 0) {
        showToast('warning', 'Không có bản ghi hợp lệ để tạo hóa đơn');
        return;
      }

      let successCount = 0;
      let failCount = 0;
      const errors = [];

      for (const record of validRecords) {
        try {
          console.log('Creating invoice for contract:', record.contractId);
          
          // Calculate dates
          const today = new Date();
          const issueDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
          const dueDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // +7 days
          
          // Parse billing period from Excel (format: "DD/MM/YYYY - DD/MM/YYYY")
          let periodStart, periodEnd;
          if (record.billingPeriod) {
            const [startStr, endStr] = record.billingPeriod.split(' - ');
            if (startStr && endStr) {
              // Convert DD/MM/YYYY to YYYY-MM-DD
              const [startDay, startMonth, startYear] = startStr.trim().split('/');
              const [endDay, endMonth, endYear] = endStr.trim().split('/');
              periodStart = `${startYear}-${startMonth.padStart(2, '0')}-${startDay.padStart(2, '0')}`;
              periodEnd = `${endYear}-${endMonth.padStart(2, '0')}-${endDay.padStart(2, '0')}`;
            }
          }
          
          // Fallback to current month if parsing fails
          if (!periodStart || !periodEnd) {
            periodStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
          }
          
          console.log('Billing period:', periodStart, '-', periodEnd);
          
          // Build charges array (các khoản thu)
          const charges = [];
          
          // Tiền phòng (rent) - LUÔN có
          if (record.monthlyRent > 0) {
            charges.push({
              type: 'rent',
              description: 'Tiền thuê phòng',
              quantity: 1,
              unitPrice: record.monthlyRent,
              amount: record.monthlyRent
            });
          }
          
          // Tiền điện
          if (record.electricAmount > 0) {
            charges.push({
              type: 'electricity',
              description: `Tiền điện (${record.electricNew - record.electricOld} kWh × ${record.electricRate.toLocaleString('vi-VN')}đ)`,
              quantity: record.electricNew - record.electricOld,
              unitPrice: record.electricRate,
              amount: record.electricAmount
            });
          }
          
          // Tiền nước
          if (record.waterAmount > 0) {
            if (record.waterBillingType === 'perPerson') {
              charges.push({
                type: 'water',
                description: `Tiền nước (${record.tenantCount} người × ${record.waterRate.toLocaleString('vi-VN')}đ)`,
                quantity: record.tenantCount,
                unitPrice: record.waterRate,
                amount: record.waterAmount
              });
            } else {
              charges.push({
                type: 'water',
                description: `Tiền nước (${record.waterNew - record.waterOld} m³ × ${record.waterRate.toLocaleString('vi-VN')}đ)`,
                quantity: record.waterNew - record.waterOld,
                unitPrice: record.waterRate,
                amount: record.waterAmount
              });
            }
          }
          
          // Phí dịch vụ (dùng 'other' thay vì 'service')
          if (record.servicePrice > 0) {
            charges.push({
              type: 'other',
              description: 'Phí dịch vụ',
              quantity: 1,
              unitPrice: record.servicePrice,
              amount: record.servicePrice
            });
          }

          const invoiceData = {
            contractId: record.contractId,
            issueDate: issueDate,
            dueDate: dueDate,
            periodStart: periodStart,
            periodEnd: periodEnd,
            electricOldReading: record.electricOld,
            electricNewReading: record.electricNew,
            electricRate: record.electricRate,
            waterOldReading: record.waterOld,
            waterNewReading: record.waterNew,
            waterRate: record.waterRate,
            waterBillingType: record.waterBillingType,
            charges: charges,
            notes: record.note || '',
            sendZaloInvoice: true
          };

          console.log('Invoice data:', invoiceData);

          const response = await fetch('http://localhost:5000/api/invoices', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(invoiceData)
          });

          const result = await response.json();
          console.log('Invoice creation response:', result);

          if (response.ok && result.success) {
            successCount++;
            console.log(`✅ Invoice created for contract ${record.contractId}`);
          } else {
            failCount++;
            errors.push(`Phòng ${record.roomNumber}: ${result.message || 'Lỗi không xác định'}`);
            console.error(`❌ Failed to create invoice for contract ${record.contractId}:`, result);
          }
        } catch (error) {
          console.error('Error creating invoice for contract:', record.contractId, error);
          failCount++;
          errors.push(`Phòng ${record.roomNumber}: ${error.message}`);
        }
      }

      if (successCount > 0) {
        showToast('success', `Tạo thành công ${successCount} hóa đơn${failCount > 0 ? `, thất bại ${failCount} hóa đơn` : ''}. Email đã được gửi kèm mã QR thanh toán.`);
      }
      
      if (errors.length > 0) {
        console.error('Invoice creation errors:', errors);
        showToast('error', `Có lỗi xảy ra:\n${errors.slice(0, 3).join('\n')}`);
      }
      
      // Close modal and reset
      if (successCount > 0) {
        setShowBillingModal(false);
        setBillingFile(null);
        setBillingData([]);
      }
    } catch (error) {
      console.error('Error creating invoices:', error);
      showToast('error', 'Lỗi khi tạo hóa đơn: ' + error.message);
    } finally {
      setBillingLoading(false);
    }
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

  // Format number with dots (Vietnamese style)
  const formatNumberWithCommas = (num) => {
    if (!num) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // Parse number from formatted string
  const parseFormattedNumber = (str) => {
    if (!str) return '';
    // Remove dots and keep only digits
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
      showToast('info', isContractEditMode ? t('contracts.form.updating') : t('contracts.form.creating'));
      
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
          email: tenantData.tenantEmail,
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
    // Find the room to check its status
    const room = rooms.find(r => r.id === roomId);
    
    if (!room) {
      showToast('error', 'Không tìm thấy phòng');
      return;
    }

    // Check if room is rented or has active contracts
    if (room.status === 'rented' || room.status === 'expiring') {
      showToast('error', 'Không thể xóa phòng đang được thuê hoặc sắp hết hạn. Vui lòng kết thúc hợp đồng trước!');
      return;
    }

    // Check if room has deposit contract
    if (room.status === 'reserved' || room.status === 'deposited') {
      showToast('warning', 'Phòng có hợp đồng cọc. Vui lòng hủy hợp đồng cọc trước khi xóa!');
      return;
    }

    // Confirm deletion for available rooms
    if (window.confirm(`Bạn có chắc chắn muốn xóa phòng "${room.name}"?\n\nHành động này không thể hoàn tác!`)) {
      try {
        await roomsAPI.deleteRoom(roomId);
        showToast('success', `Đã xóa phòng "${room.name}" thành công`);
        fetchRooms();
      } catch (error) {
        console.error('Error deleting room:', error);
        showToast('error', error.response?.data?.message || 'Lỗi khi xóa phòng');
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
      // Open rental contract creation modal directly
      if (!selectedRoomForContract) {
        showToast('error', t('rooms.error.roomInfoNotFound'));
        return;
      }
      
      // Reset edit mode for new contract
      setIsContractEditMode(false);
      setEditingContractId(null);
      
      // Pre-fill rental contract data with room information
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
        deposit: selectedRoomForContract.price || '',
        monthlyRent: selectedRoomForContract.price || '',
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
      
      // Clear errors and open rental contract modal
      setRentalContractErrors({});
      setShowRentalContractModal(true);
      
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
            tenantEmail: tenant.email || '',
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
      email: tenant.email || '',
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
      // Xử lý images: chỉ lấy URL của những ảnh đã upload
      const processedImages = (tenantFormData.tenantImages || [])
        .filter(img => img.isUploaded && img.url) // Chỉ lấy ảnh đã upload
        .map(img => img.url); // Chỉ lấy URL string
      
      const payload = {
        fullName: tenantFormData.fullName,
        phone: tenantFormData.phone,
        email: tenantFormData.email || '', // Thêm email
        identificationNumber: tenantFormData.identificationNumber,
        address: tenantFormData.address,
        room: selectedRoomForTenants.id,
        images: processedImages, // Gửi array of strings
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

  const handleCreateInvoice = async (room) => {
    if (room.status !== 'rented') {
      showToast('warning', 'Chỉ có thể tạo hóa đơn cho phòng đang được thuê');
      return;
    }

    setSelectedRoomForInvoice(room);
    setShowInvoiceModal(true);
    setLoadingInvoiceInfo(true);

    try {
      // Lấy thông tin hợp đồng hiện tại của phòng
      const contractResponse = await contractsAPI.getContractsByRoom(room.id);
      
      if (!contractResponse.success || !contractResponse.data || contractResponse.data.length === 0) {
        showToast('error', 'Không tìm thấy hợp đồng thuê cho phòng này');
        setShowInvoiceModal(false);
        return;
      }

      const activeContract = contractResponse.data.find(contract => contract.status === 'active');
      
      if (!activeContract) {
        showToast('error', 'Không tìm thấy hợp đồng đang hoạt động cho phòng này');
        setShowInvoiceModal(false);
        return;
      }

      setContractInfo(activeContract);

      // Lấy thông tin để tạo hóa đơn mới
      const contractId = activeContract._id || activeContract.id;
      console.log('Contract ID:', contractId, 'Active Contract:', activeContract);
      
      const invoiceInfoResponse = await invoicesAPI.getNewInvoiceInfo(contractId);
      
      if (invoiceInfoResponse.success) {
        const { contract, suggestedPeriod, lastInvoice } = invoiceInfoResponse.data;
        
        // Set form data với thông tin đề xuất
        const periodEndDate = new Date(suggestedPeriod.end);
        const paymentDueDate = new Date(periodEndDate);
        paymentDueDate.setDate(paymentDueDate.getDate() + 5); // 5 ngày sau ngày kết thúc chu kỳ
        
        // Tạo charges ban đầu
        const initialCharges = [{
          type: 'rent',
          description: 'Tiền phòng',
          amount: contract.monthlyRent || 0,
          quantity: 1,
          unitPrice: contract.monthlyRent || 0
        }];

        // Thêm tiền dịch vụ nếu có
        if (contract.servicePrice && contract.servicePrice > 0) {
          initialCharges.push({
            type: 'other',
            description: 'Phí dịch vụ',
            quantity: 1,
            unitPrice: contract.servicePrice,
            amount: contract.servicePrice
          });
        }

        // Thêm charge nước nếu tính theo người
        if (contract.waterChargeType === 'per_person') {
          const tenantCount = contract.tenants?.length || 1;
          const waterAmount = tenantCount * (contract.waterPricePerPerson || 50000);
          initialCharges.push({
            type: 'water',
            description: `Tiền nước (${tenantCount} người)`,
            quantity: tenantCount,
            unitPrice: contract.waterPricePerPerson || 50000,
            amount: waterAmount
          });
        }

        setInvoiceFormData({
          issueDate: new Date().toISOString().split('T')[0], // Ngày lập hóa đơn hôm nay
          dueDate: paymentDueDate.toISOString().split('T')[0], // Tự động tính 5 ngày sau
          periodStart: new Date(suggestedPeriod.start).toISOString().split('T')[0],
          periodEnd: new Date(suggestedPeriod.end).toISOString().split('T')[0],
          electricOldReading: lastInvoice ? lastInvoice.electricNewReading : (contract.currentElectricIndex || 0),
          electricNewReading: lastInvoice ? lastInvoice.electricNewReading : (contract.currentElectricIndex || 0),
          electricRate: contract.electricPrice || 3500, // Lấy từ hợp đồng
          waterOldReading: lastInvoice ? lastInvoice.waterNewReading : (contract.currentWaterIndex || 0),
          waterNewReading: lastInvoice ? lastInvoice.waterNewReading : (contract.currentWaterIndex || 0),
          waterRate: contract.waterPrice || 20000, // Lấy từ hợp đồng
          waterBillingType: contract.waterChargeType === 'per_person' ? 'perPerson' : 'perCubicMeter', // Lấy từ hợp đồng
          waterPricePerPerson: contract.waterPricePerPerson || 50000, // Lấy từ hợp đồng
          charges: initialCharges,
          discount: 0,
          notes: `Hóa đơn tiền phòng ${contract.room.roomNumber} từ ${new Date(suggestedPeriod.start).toLocaleDateString('vi-VN')} đến ${new Date(suggestedPeriod.end).toLocaleDateString('vi-VN')}`
        });
      }
    } catch (error) {
      console.error('Error loading invoice info:', error);
      showToast('error', 'Lỗi khi tải thông tin hóa đơn');
      setShowInvoiceModal(false);
    } finally {
      setLoadingInvoiceInfo(false);
    }
  };

  const handleInvoiceFormChange = (field, value) => {
    // Clear error for this field
    if (invoiceFormErrors[field]) {
      setInvoiceFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
    
    setInvoiceFormData(prev => {
      const updated = {
        ...prev,
        [field]: value
      };

      // Tự động tính ngày đến hạn thanh toán (5 ngày sau ngày kết thúc chu kỳ)
      if (field === 'periodEnd' && value) {
        const endDate = new Date(value);
        const dueDate = new Date(endDate);
        dueDate.setDate(dueDate.getDate() + 5);
        updated.dueDate = dueDate.toISOString().split('T')[0];
      }

      // Tự động cập nhật charges khi thay đổi thông tin điện nước
      if (field.includes('electric') || field.includes('water')) {
        const updatedCharges = [...updated.charges];
        
        // Tính toán tiền điện
        if (field.includes('electric')) {
          const electricUsage = (updated.electricNewReading || 0) - (updated.electricOldReading || 0);
          const electricAmount = electricUsage * (updated.electricRate || 0);
          
          // Tìm và cập nhật charge điện hoặc thêm mới
          let electricIndex = updatedCharges.findIndex(c => c.type === 'electricity');
          if (electricIndex === -1 && electricUsage > 0) {
            // Thêm charge điện mới
            updatedCharges.push({
              type: 'electricity',
              description: `Tiền điện (${electricUsage} kWh)`,
              quantity: electricUsage,
              unitPrice: updated.electricRate || 0,
              amount: electricAmount
            });
          } else if (electricIndex !== -1) {
            // Cập nhật charge điện hiện tại
            updatedCharges[electricIndex] = {
              ...updatedCharges[electricIndex],
              description: `Tiền điện (${electricUsage} kWh)`,
              quantity: electricUsage,
              unitPrice: updated.electricRate || 0,
              amount: electricAmount
            };
            
            // Xóa nếu usage = 0
            if (electricUsage <= 0) {
              updatedCharges.splice(electricIndex, 1);
            }
          }
        }

        // Tính toán tiền nước
        if (field.includes('water')) {
          let waterAmount = 0;
          let waterQuantity = 1;
          let waterDescription = '';
          let waterUnitPrice = 0;

          if (updated.waterBillingType === 'perCubicMeter') {
            // Tính theo khối (m³)
            const waterUsage = (updated.waterNewReading || 0) - (updated.waterOldReading || 0);
            waterAmount = waterUsage * (updated.waterRate || 0);
            waterQuantity = waterUsage;
            waterUnitPrice = updated.waterRate || 0;
            waterDescription = `Tiền nước (${waterUsage} m³)`;
          } else if (updated.waterBillingType === 'perPerson') {
            // Tính theo người
            const tenantCount = contractInfo?.tenants?.length || 1;
            waterAmount = tenantCount * (updated.waterPricePerPerson || 0);
            waterQuantity = tenantCount;
            waterUnitPrice = updated.waterPricePerPerson || 0;
            waterDescription = `Tiền nước (${tenantCount} người)`;
          }
          
          // Tìm và cập nhật charge nước hoặc thêm mới
          let waterIndex = updatedCharges.findIndex(c => c.type === 'water');
          
          if (waterAmount > 0) {
            if (waterIndex === -1) {
              // Thêm charge nước mới
              updatedCharges.push({
                type: 'water',
                description: waterDescription,
                quantity: waterQuantity,
                unitPrice: waterUnitPrice,
                amount: waterAmount
              });
            } else {
              // Cập nhật charge nước hiện tại
              updatedCharges[waterIndex] = {
                ...updatedCharges[waterIndex],
                description: waterDescription,
                quantity: waterQuantity,
                unitPrice: waterUnitPrice,
                amount: waterAmount
              };
            }
          } else if (waterIndex !== -1) {
            // Xóa charge nước nếu amount = 0
            updatedCharges.splice(waterIndex, 1);
          }
        }

        updated.charges = updatedCharges;
      }

      return updated;
    });
  };

  const handleChargeChange = (index, field, value) => {
    setInvoiceFormData(prev => {
      const updatedCharges = [...prev.charges];
      updatedCharges[index] = {
        ...updatedCharges[index],
        [field]: value
      };
      
      // Tự động tính amount khi thay đổi quantity hoặc unitPrice
      if (field === 'quantity' || field === 'unitPrice') {
        updatedCharges[index].amount = updatedCharges[index].quantity * updatedCharges[index].unitPrice;
      }
      
      return {
        ...prev,
        charges: updatedCharges
      };
    });
  };

  const addCharge = () => {
    setInvoiceFormData(prev => ({
      ...prev,
      charges: [...prev.charges, {
        type: 'other',
        description: '',
        amount: 0,
        quantity: 1,
        unitPrice: 0
      }]
    }));
  };

  const removeCharge = (index) => {
    if (invoiceFormData.charges.length > 1) {
      setInvoiceFormData(prev => ({
        ...prev,
        charges: prev.charges.filter((_, i) => i !== index)
      }));
    }
  };

  const calculateInvoiceTotal = () => {
    const subtotal = invoiceFormData.charges.reduce((sum, charge) => sum + charge.amount, 0);
    return Math.max(0, subtotal - (invoiceFormData.discount || 0));
  };

  const validateInvoiceForm = () => {
    const errors = {};
    
    if (!invoiceFormData.issueDate) {
      errors.issueDate = 'Vui lòng chọn ngày lập hóa đơn';
    }
    
    if (!invoiceFormData.dueDate) {
      errors.dueDate = 'Vui lòng chọn ngày đến hạn thanh toán';
    }
    
    if (!invoiceFormData.periodStart) {
      errors.periodStart = 'Vui lòng chọn ngày bắt đầu chu kỳ';
    }
    
    if (!invoiceFormData.periodEnd) {
      errors.periodEnd = 'Vui lòng chọn ngày kết thúc chu kỳ';
    }
    
    // Date logic validation
    if (invoiceFormData.periodStart && invoiceFormData.periodEnd && 
        new Date(invoiceFormData.periodStart) >= new Date(invoiceFormData.periodEnd)) {
      errors.periodEnd = 'Ngày kết thúc phải sau ngày bắt đầu chu kỳ';
    }
    
    if (invoiceFormData.issueDate && invoiceFormData.dueDate && 
        new Date(invoiceFormData.issueDate) > new Date(invoiceFormData.dueDate)) {
      errors.dueDate = 'Ngày đến hạn phải sau ngày lập hóa đơn';
    }
    
    // Electric reading validation
    if (!invoiceFormData.electricNewReading || invoiceFormData.electricNewReading < 0) {
      errors.electricNewReading = 'Vui lòng nhập chỉ số điện mới';
    } else if (invoiceFormData.electricNewReading < invoiceFormData.electricOldReading) {
      errors.electricNewReading = 'Chỉ số điện mới phải lớn hơn hoặc bằng chỉ số cũ';
    }
    
    // Water reading validation (if per cubic meter)
    if (invoiceFormData.waterBillingType === 'perCubicMeter') {
      if (!invoiceFormData.waterNewReading || invoiceFormData.waterNewReading < 0) {
        errors.waterNewReading = 'Vui lòng nhập chỉ số nước mới';
      } else if (invoiceFormData.waterNewReading < invoiceFormData.waterOldReading) {
        errors.waterNewReading = 'Chỉ số nước mới phải lớn hơn hoặc bằng chỉ số cũ';
      }
    }
    
    // Charges validation
    if (invoiceFormData.charges.length === 0) {
      errors.charges = 'Vui lòng thêm ít nhất một khoản thu';
    } else {
      const invalidCharge = invoiceFormData.charges.find(charge => 
        !charge.description.trim() || charge.amount <= 0
      );
      if (invalidCharge) {
        errors.charges = 'Vui lòng điền đầy đủ thông tin các khoản thu';
      }
    }
    
    return errors;
  };

  const focusFirstError = (errors) => {
    const errorFields = Object.keys(errors);
    if (errorFields.length > 0) {
      const firstErrorField = errorFields[0];
      const element = document.querySelector(`[name="${firstErrorField}"]`) || 
                    document.querySelector(`#${firstErrorField}`) ||
                    document.querySelector(`input[name*="${firstErrorField}"]`);
      if (element) {
        element.focus();
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handleSaveInvoice = async () => {
    if (!contractInfo) {
      showToast('error', 'Không tìm thấy thông tin hợp đồng');
      return;
    }

    // Validate form
    const errors = validateInvoiceForm();
    setInvoiceFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      focusFirstError(errors);
      return;
    }



    setSavingInvoice(true);

    try {
      const invoiceData = {
        contractId: contractInfo._id || contractInfo.id,
        issueDate: invoiceFormData.issueDate,
        dueDate: invoiceFormData.dueDate,
        periodStart: invoiceFormData.periodStart,
        periodEnd: invoiceFormData.periodEnd,
        electricOldReading: invoiceFormData.electricOldReading,
        electricNewReading: invoiceFormData.electricNewReading,
        electricRate: invoiceFormData.electricRate,
        waterOldReading: invoiceFormData.waterOldReading,
        waterNewReading: invoiceFormData.waterNewReading,
        waterRate: invoiceFormData.waterRate,
        waterBillingType: invoiceFormData.waterBillingType,
        waterPricePerPerson: invoiceFormData.waterPricePerPerson,
        charges: invoiceFormData.charges,
        discount: invoiceFormData.discount || 0,
        notes: invoiceFormData.notes,
        sendZaloInvoice: true // Luôn gửi email với QR code
      };

      const response = await invoicesAPI.createInvoice(invoiceData);

      if (response.success) {
        // Backend tự động gửi email khi sendZaloInvoice = true
        showToast('success', 'Tạo hóa đơn thành công. Email đã được gửi kèm mã QR thanh toán.');
        setShowInvoiceModal(false);
        
        // Nếu đang trong flow kết thúc hợp đồng, thực hiện kết thúc sau khi tạo hóa đơn
        if (pendingTermination) {
          await executeTerminateContract();
          setPendingTermination(false);
        }
        
        // Reset form
        setInvoiceFormData({
          issueDate: new Date().toISOString().split('T')[0],
          dueDate: '',
          periodStart: '',
          periodEnd: '',
          electricOldReading: 0,
          electricNewReading: 0,
          electricRate: 3500,
          waterOldReading: 0,
          waterNewReading: 0,
          waterRate: 20000,
          waterBillingType: 'perCubicMeter',
          waterPricePerPerson: 50000,
          charges: [{
            type: 'rent',
            description: 'Tiền phòng',
            amount: 0,
            quantity: 1,
            unitPrice: 0
          }],
          discount: 0,
          notes: ''
        });
        setContractInfo(null);
        setSelectedRoomForInvoice(null);
        setInvoiceFormErrors({});
        fetchRooms(); // Refresh danh sách phòng
      } else {
        showToast('error', response.message || 'Lỗi khi tạo hóa đơn');
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      showToast('error', 'Lỗi server khi tạo hóa đơn');
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleRoomTransfer = async (room) => {
    setSelectedRoomForTransfer(room);
    setShowRoomTransferModal(true);
    setLoadingAvailableRooms(true);
    setSelectedTargetRoom(null);
    setCurrentRoomContract(null);
    
    try {
      // Fetch current rental contract info for the room
      const contractInfo = await getRentalContractInfo(room.id);
      setCurrentRoomContract(contractInfo);

      // Fetch available rooms of current landlord (exclude current room)
      const response = await roomsAPI.searchRooms({
        status: 'available',
        page: 1,
        limit: 100 // Get all available rooms for this landlord
      });
      
      if (response.success) {
        // Transform and filter out the current room
        const availableRooms = response.data.rooms
          .map(r => ({
            id: r._id,
            roomNumber: r.roomNumber,
            price: r.price,
            deposit: r.deposit,
            area: r.area,
            capacity: r.capacity,
            vehicleCount: r.vehicleCount,
            amenities: r.amenities,
            description: r.description,
            status: r.status
          }))
          .filter(r => r.id !== room.id);
        
        setAvailableRoomsForTransfer(availableRooms);
      } else {
        showToast('error', t('rooms.messages.loadAvailableRoomsFailed') || 'Không thể tải danh sách phòng trống');
        setAvailableRoomsForTransfer([]);
      }
    } catch (error) {
      console.error('Error loading available rooms:', error);
      showToast('error', t('rooms.messages.loadAvailableRoomsFailed') || 'Không thể tải danh sách phòng trống');
      setAvailableRoomsForTransfer([]);
    } finally {
      setLoadingAvailableRooms(false);
    }
  };

  // Handle room transfer submission
  const handleConfirmRoomTransfer = async () => {
    if (!selectedTargetRoom) {
      showToast('error', t('rooms.messages.selectTargetRoom') || 'Vui lòng chọn phòng đích');
      return;
    }

    if (window.confirm(
      t('rooms.messages.confirmRoomTransfer', { 
        fromRoom: selectedRoomForTransfer.roomNumber, 
        toRoom: selectedTargetRoom.roomNumber 
      }) || `Bạn có chắc chắn muốn chuyển từ phòng ${selectedRoomForTransfer.roomNumber} sang phòng ${selectedTargetRoom.roomNumber}?`
    )) {
      setTransferring(true);
      try {
        // TODO: Call API to transfer room
        const response = await roomsAPI.transferRoom({
          fromRoomId: selectedRoomForTransfer.id,
          toRoomId: selectedTargetRoom.id
        });

        if (response.success) {
          showToast('success', t('rooms.messages.roomTransferSuccess') || 'Chuyển phòng thành công');
          closeRoomTransferModal();
          fetchRooms(); // Refresh rooms list
        } else {
          showToast('error', response.message || t('rooms.messages.roomTransferFailed') || 'Chuyển phòng thất bại');
        }
      } catch (error) {
        console.error('Error transferring room:', error);
        showToast('error', t('rooms.messages.roomTransferFailed') || 'Chuyển phòng thất bại');
      } finally {
        setTransferring(false);
      }
    }
  };

  // Close room transfer modal
  const closeRoomTransferModal = () => {
    setShowRoomTransferModal(false);
    setSelectedRoomForTransfer(null);
    setCurrentRoomContract(null);
    setAvailableRoomsForTransfer([]);
    setSelectedTargetRoom(null);
  };

  const handleTerminateContract = (room) => {
    setSelectedRoomForTerminate(room);
    setCreateFinalInvoice(false);
    setShowTerminateContractModal(true);
  };

  const confirmTerminateContract = async () => {
    if (!selectedRoomForTerminate) return;
    
    // Nếu chọn tạo hóa đơn tháng cuối, mở form tạo hóa đơn
    if (createFinalInvoice) {
      setShowTerminateContractModal(false);
      setPendingTermination(true); // Đánh dấu sẽ kết thúc hợp đồng sau khi tạo hóa đơn
      await handleCreateInvoice(selectedRoomForTerminate);
      return;
    }
    
    // Nếu không tạo hóa đơn, kết thúc hợp đồng luôn
    await executeTerminateContract();
  };

  const executeTerminateContract = async () => {
    if (!selectedRoomForTerminate) return;
    
    setTerminatingContract(true);
    setShowTerminateContractModal(false);
    
    try {
      // 1. Lấy tất cả hợp đồng của phòng
      const contractsRes = await contractsAPI.getContractsByRoom(selectedRoomForTerminate.id);
      
      if (contractsRes.success && contractsRes.data) {
        const activeContracts = Array.isArray(contractsRes.data) 
          ? contractsRes.data.filter(c => c.status === 'active' || c.status === 'expiring')
          : (contractsRes.data.status === 'active' || contractsRes.data.status === 'expiring' ? [contractsRes.data] : []);
        
        // 2. Xóa hoặc cập nhật trạng thái hợp đồng về 'terminated'
        for (const contract of activeContracts) {
          await contractsAPI.updateContract(contract._id, { status: 'terminated' });
        }
        
        // 3. Lấy tất cả khách thuê của phòng
        const tenantsRes = await tenantsAPI.getTenantsByRoom(selectedRoomForTerminate.id, { status: 'active' });
        const tenants = tenantsRes.success ? (Array.isArray(tenantsRes.data) ? tenantsRes.data : []) : [];
        
        // 4. Xóa từng khách thuê khỏi hệ thống
        for (const tenant of tenants) {
          try {
            await tenantsAPI.deleteTenant(tenant._id);
          } catch (err) {
            console.error('Error deleting tenant:', tenant._id, err);
          }
        }
        
        // 5. Cập nhật phòng: xóa tenants và chuyển status về available
        await roomsAPI.updateRoom(selectedRoomForTerminate.id, { 
          status: 'available',
          tenants: []
        });
        
        showToast('success', `Đã kết thúc hợp đồng và xóa ${tenants.length} khách thuê khỏi hệ thống`);
        fetchRooms();
      }
    } catch (error) {
      console.error('Error terminating contract:', error);
      showToast('error', 'Lỗi khi kết thúc hợp đồng');
    } finally {
      setTerminatingContract(false);
      setSelectedRoomForTerminate(null);
      setCreateFinalInvoice(false);
    }
  };

  const cancelTerminateContract = () => {
    setShowTerminateContractModal(false);
    setSelectedRoomForTerminate(null);
    setCreateFinalInvoice(false);
  };

  const handleMarkAsExpiring = async (room) => {
    setSelectedRoomForExpiring(room);
    setShowExpiringConfirmModal(true);
  };

  const confirmMarkAsExpiring = async () => {
    if (!selectedRoomForExpiring) return;
    
    setShowExpiringConfirmModal(false);
    
    try {
      // 1. Cập nhật trạng thái phòng
      await roomsAPI.updateRoom(selectedRoomForExpiring.id, { status: 'expiring' });
      
      // 2. Lấy tất cả hợp đồng đang hoạt động của phòng
      const contractsRes = await contractsAPI.getContractsByRoom(selectedRoomForExpiring.id);
      
      if (contractsRes.success && contractsRes.data) {
        const activeContracts = Array.isArray(contractsRes.data) 
          ? contractsRes.data.filter(c => c.status === 'active')
          : (contractsRes.data.status === 'active' ? [contractsRes.data] : []);
        
        if (activeContracts.length > 0) {
          // 3. Cập nhật trạng thái tất cả hợp đồng đang hoạt động
          const updatePromises = activeContracts.map(contract => 
            contractsAPI.updateContract(contract._id, { status: 'expiring' })
          );
          
          await Promise.all(updatePromises);
          
          showToast('success', `Đã đánh dấu phòng và ${activeContracts.length} hợp đồng sắp kết thúc`);
        } else {
          showToast('success', t('rooms.messages.markedAsExpiring') || 'Đã đánh dấu phòng sắp kết thúc');
        }
      } else {
        showToast('success', t('rooms.messages.markedAsExpiring') || 'Đã đánh dấu phòng sắp kết thúc');
      }
      
      fetchRooms();
    } catch (error) {
      console.error('Error marking room as expiring:', error);
      showToast('error', t('rooms.messages.errorMarkingExpiring') || 'Lỗi khi đánh dấu sắp kết thúc');
    } finally {
      setSelectedRoomForExpiring(null);
    }
  };

  const cancelMarkAsExpiring = () => {
    setShowExpiringConfirmModal(false);
    setSelectedRoomForExpiring(null);
  };

  // Handle cancel expiring status - revert back to rented/active
  const handleCancelExpiring = (room) => {
    setSelectedRoomForCancelExpiring(room);
    setShowCancelExpiringModal(true);
  };

  const confirmCancelExpiring = async () => {
    if (!selectedRoomForCancelExpiring) return;
    
    setShowCancelExpiringModal(false);
    
    try {
      // 1. Cập nhật trạng thái phòng về 'rented'
      await roomsAPI.updateRoom(selectedRoomForCancelExpiring.id, { status: 'rented' });
      
      // 2. Lấy tất cả hợp đồng đang sắp kết thúc của phòng
      const contractsRes = await contractsAPI.getContractsByRoom(selectedRoomForCancelExpiring.id);
      
      if (contractsRes.success && contractsRes.data) {
        const expiringContracts = Array.isArray(contractsRes.data) 
          ? contractsRes.data.filter(c => c.status === 'expiring')
          : (contractsRes.data.status === 'expiring' ? [contractsRes.data] : []);
        
        if (expiringContracts.length > 0) {
          // 3. Cập nhật trạng thái tất cả hợp đồng về 'active'
          const updatePromises = expiringContracts.map(contract => 
            contractsAPI.updateContract(contract._id, { status: 'active' })
          );
          
          await Promise.all(updatePromises);
          
          showToast('success', `Đã hủy báo kết thúc phòng và ${expiringContracts.length} hợp đồng`);
        } else {
          showToast('success', 'Đã hủy báo kết thúc phòng');
        }
      } else {
        showToast('success', 'Đã hủy báo kết thúc phòng');
      }
      
      fetchRooms();
    } catch (error) {
      console.error('Error cancelling expiring status:', error);
      showToast('error', 'Lỗi khi hủy báo kết thúc');
    } finally {
      setSelectedRoomForCancelExpiring(null);
    }
  };

  const cancelCancelExpiring = () => {
    setShowCancelExpiringModal(false);
    setSelectedRoomForCancelExpiring(null);
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
    return num.toLocaleString('vi-VN');
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
    <div className="rooms-container">
      <SideBar />
      <div className="rooms-content">
        {/* Header */}
        <div className="rooms-header">
          <h1 className="rooms-title">{t('rooms.title')}</h1>
          <div className="header-search">
            <div className="search-box">
              <i className="fas fa-search search-icon"></i>
              <input
                type="text"
                className="search-input"
                placeholder="Tìm kiếm phòng theo số phòng, mô tả..."
                value={searchFilters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && fetchRooms()}
              />
              {searchFilters.search && (
                <button 
                  className="clear-search-btn"
                  onClick={() => {
                    setSearchFilters(prev => ({ ...prev, search: '' }));
                    fetchRooms();
                  }}
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="status-tabs">
          {Object.entries(statusLabels).map(([status, label]) => (
            <button
              key={status}
              className={`status-tab ${activeTab === status ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(status);
                setPagination(prev => ({ ...prev, currentPage: 1 }));
              }}
            >
              {label}
              <span className="tab-count">{statusCounts[status]}</span>
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="rooms-actions">
          <button className="action-btn primary" onClick={openCreateModal}>
            <i className="fas fa-plus"></i>
            {t('rooms.addNew', 'Thêm phòng mới')}
          </button>
          <button className="action-btn" onClick={() => setShowBillingModal(true)}>
            <i className="fas fa-file-invoice-dollar"></i>
            {t('rooms.billingExcel', 'Tính tiền Excel')}
          </button>
          <button className="action-btn" onClick={() => setShowImportModal(true)}>
            <i className="fas fa-file-import"></i>
            {t('rooms.importExcel', 'Import Excel')}
          </button>
          <button className="action-btn" onClick={handleExportExcel}>
            <i className="fas fa-file-excel"></i>
            {t('rooms.exportExcel', 'Xuất Excel')}
          </button>
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
                              
                              // Estimate dropdown height based on room status
                              let estimatedHeight = 60; // Base height (padding)
                              if (room.status === 'available' && !hasDepositContract(room.name)) {
                                estimatedHeight += 48; // Create contract
                              } else if ((room.status === 'available' || room.status === 'reserved' || room.status === 'deposited') && hasDepositContract(room.name)) {
                                estimatedHeight += 96; // Create rental + View deposit
                              } else if (room.status === 'rented' || room.status === 'expiring') {
                                estimatedHeight += 240; // Create invoice, transfer, expiring, terminate (4-5 items)
                              }
                              estimatedHeight += 96; // Edit + Delete
                              
                              const dropdownHeight = Math.max(estimatedHeight, 250); // Minimum 250px
                              
                              let top = buttonRect.bottom + 4;
                              let left = buttonRect.right - 180; // Dropdown width = 180px
                              
                              // If dropdown would go below viewport, show above button
                              if (top + dropdownHeight > viewportHeight) {
                                top = buttonRect.top - dropdownHeight - 4;
                                // Make sure it doesn't go above viewport
                                if (top < 10) {
                                  top = 10;
                                }
                              }
                              
                              // Ensure dropdown doesn't go off left edge
                              if (left < 4) {
                                left = 4;
                              }
                              
                              // Ensure dropdown doesn't go off right edge
                              const viewportWidth = window.innerWidth;
                              if (left + 180 > viewportWidth - 4) {
                                left = viewportWidth - 184;
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
                                  {room.status === 'expiring' && (
                                    <button
                                      className="action-menu-item success"
                                      onClick={() => {
                                        handleCancelExpiring(room);
                                        setOpenActionMenu(null);
                                      }}
                                    >
                                      <i className="fas fa-undo"></i>
                                      Hủy báo kết thúc
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
        {rooms.length > 0 && pagination.totalPages > 1 && (
          <div className="pagination">
            <div className="pagination-controls">
              {/* First Page Button */}
              <button
                className="pagination-btn"
                disabled={pagination.currentPage === 1}
                onClick={() => setPagination(p => ({ ...p, currentPage: 1 }))}
                title={t('rooms.pagination.firstPage', 'Trang đầu')}
              >
                <i className="fas fa-angle-double-left" />
              </button>

              {/* Previous Page Button */}
              <button
                className="pagination-btn"
                disabled={pagination.currentPage === 1}
                onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage - 1 }))}
                title={t('rooms.pagination.previousPage', 'Trang trước')}
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
                      title={`${t('rooms.pagination.page', 'Trang')} ${page}`}
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
                title={t('rooms.pagination.nextPage', 'Trang sau')}
              >
                <i className="fas fa-chevron-right" />
              </button>

              {/* Last Page Button */}
              <button
                className="pagination-btn"
                disabled={pagination.currentPage === pagination.totalPages}
                onClick={() => setPagination(p => ({ ...p, currentPage: pagination.totalPages }))}
                title={t('rooms.pagination.lastPage', 'Trang cuối')}
              >
                <i className="fas fa-angle-double-right" />
              </button>
            </div>
          </div>
        )}

        {/* Fallback pagination info nếu chỉ có 1 trang */}
        {rooms.length > 0 && pagination.totalPages <= 1 && (
          <div style={{textAlign: 'center', padding: '20px', color: '#666'}}>
            {t('rooms.pagination.allShown', 'Tất cả')} {pagination.totalItems} {t('rooms.pagination.rooms', 'phòng')} {t('rooms.pagination.displayed', 'đã được hiển thị')}
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
        <div className="room-modal deposit-contract-modal">
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
              <div className="form-input-group">
                <i className="input-icon fas fa-user"></i>
                <input
                  type="text"
                  className={`room-form-input ${depositContractErrors.tenantName ? 'error' : ''}`}
                  value={depositContractData.tenantName}
                  onChange={(e) => handleDepositContractChange('tenantName', e.target.value)}
                  placeholder={t('contracts.form.tenantNamePlaceholder') || 'Nhập tên người thuê'}
                  disabled={creatingDepositContract}
                />
              </div>
              {depositContractErrors.tenantName && (
                <div className="error-text">{depositContractErrors.tenantName}</div>
              )}
            </div>

            {/* Tenant Phone */}
            <div className="room-form-group">
              <label className="room-form-label">
                {t('contracts.form.tenantPhone') || 'Số điện thoại'} *
              </label>
              <div className="form-input-group">
                <i className="input-icon fas fa-phone"></i>
                <input
                  type="tel"
                  className={`room-form-input ${depositContractErrors.tenantPhone ? 'error' : ''}`}
                  value={depositContractData.tenantPhone}
                  onChange={(e) => handleDepositContractChange('tenantPhone', e.target.value)}
                  placeholder={t('contracts.form.tenantPhonePlaceholder') || 'Nhập số điện thoại'}
                  disabled={creatingDepositContract}
                />
              </div>
              {depositContractErrors.tenantPhone && (
                <div className="error-text">{depositContractErrors.tenantPhone}</div>
              )}
            </div>

            {/* Tenant Email */}
            <div className="room-form-group">
              <label className="room-form-label">
                {t('contracts.form.tenantEmail') || 'Email'}
              </label>
              <div className="form-input-group">
                <i className="input-icon fas fa-envelope"></i>
                <input
                  type="email"
                  className={`room-form-input ${depositContractErrors.tenantEmail ? 'error' : ''}`}
                  value={depositContractData.tenantEmail}
                  onChange={(e) => handleDepositContractChange('tenantEmail', e.target.value)}
                  placeholder={t('contracts.form.tenantEmailPlaceholder') || 'email@example.com'}
                  disabled={creatingDepositContract}
                />
              </div>
              {depositContractErrors.tenantEmail && (
                <div className="error-text">{depositContractErrors.tenantEmail}</div>
              )}
            </div>

            {/* Deposit Amount */}
            <div className="room-form-group full">
              <label className="room-form-label">
                {t('contracts.form.depositAmount') || 'Số tiền cọc'} *
              </label>
              <div className="form-input-group">
                <i className="input-icon fas fa-money-bill-wave"></i>
                <input
                  type="text"
                  className={`room-form-input ${depositContractErrors.depositAmount ? 'error' : ''}`}
                  value={depositContractData.depositAmount === '' ? '' : formatWithCommas(depositContractData.depositAmount)}
                  onChange={(e) => handleMoneyInlineChange('depositAmount', e.target.value, false, setDepositContractData)}
                  onKeyDown={(e) => handleMoneyInlineKey(e, 'depositAmount', false, setDepositContractData)}
                  placeholder="0"
                  disabled={creatingDepositContract}
                />
              </div>
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
                        Email
                      </label>
                      <div className="form-input-group">
                        <i className="input-icon fas fa-envelope"></i>
                        <input
                          type=""
                          className={`form-input ${rentalContractErrors[`tenantEmail_${index}`] ? 'error' : ''}`}
                          value={tenant.tenantEmail}
                          onChange={(e) => updateTenant(index, 'tenantEmail', e.target.value)}
                          placeholder="email@example.com"
                        />
                      </div>
                      {rentalContractErrors[`tenantEmail_${index}`] && (
                        <div className="error-message">{rentalContractErrors[`tenantEmail_${index}`]}</div>
                      )}
                    </div>

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
                                <span>{t('contracts.rental.form.addImage', 'Thêm ảnh')}</span>
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
                  <p>{t('contracts.rental.vehicleInfo.noVehicles', 'Chưa có thông tin phương tiện nào')}</p>
                  <small>{t('contracts.rental.vehicleInfo.noVehiclesDesc', 'Nhấn "Thêm xe" để thêm thông tin phương tiện')}</small>
                </div>
              )}
            </div>
            </div>

            {/* Right Column - Room & Service Information */}
            <div className="rental-contract-right">
              {/* Room Information */}
              <div className="form-section">
                <h3><i className="fas fa-home"></i> {t('contracts.rental.roomInfo.title', 'Thông tin phòng')}</h3>
                
                <div className="room-info-card">
                  <div className="room-info-item">
                    <span className="info-label">{t('contracts.rental.roomInfo.roomName', 'Tên phòng:')}</span>
                    <span className="info-value">{selectedRoomForContract.name}</span>
                  </div>
                  <div className="room-info-item">
                    <span className="info-label">{t('contracts.rental.roomInfo.capacity', 'Sức chứa:')}</span>
                    <span className="info-value">{selectedRoomForContract.capacity} {t('contracts.rental.roomInfo.capacityUnit', 'người')}</span>
                  </div>
                  <div className="room-info-item">
                    <span className="info-label">{t('contracts.rental.roomInfo.area', 'Diện tích:')}</span>
                    <span className="info-value">{selectedRoomForContract.area} m²</span>
                  </div>
                  <div className="room-info-item">
                    <span className="info-label">{t('contracts.rental.roomInfo.price', 'Giá phòng:')}</span>
                    <span className="info-value highlight">{Number(selectedRoomForContract.price).toLocaleString('vi-VN')} VNĐ</span>
                  </div>
                  
                  {/* Amenities */}
                  {selectedRoomForContract.amenities && selectedRoomForContract.amenities.length > 0 && (
                    <div className="room-info-item amenities-item">
                      <span className="info-label">{t('contracts.rental.roomInfo.amenities', 'Tiện ích:')}</span>
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
              <h3><i className="fas fa-calendar-alt"></i> {t('contracts.rental.contractInfo.title', 'Thông tin hợp đồng')}</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="startDate" className="form-label">
                    {t('contracts.rental.contractInfo.startDate', 'Ngày bắt đầu')} <span className="required">*</span>
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
                    {t('contracts.rental.contractInfo.endDate', 'Ngày kết thúc')} <span className="required">*</span>
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
                        title={t('contracts.rental.contractInfo.quickDate6M', '6 tháng từ ngày bắt đầu')}
                      >
                        {t('contracts.rental.contractInfo.quick6M', '6T')}
                      </button>
                      <button
                        type="button"
                        className="quick-date-btn"
                        onClick={() => setEndDateQuick(12)}
                        title={t('contracts.rental.contractInfo.quickDate1Y', '1 năm từ ngày bắt đầu')}
                      >
                        {t('contracts.rental.contractInfo.quick1Y', '1N')}
                      </button>
                    </div>
                  </div>
                  {rentalContractErrors.endDate && <div className="error-message">{rentalContractErrors.endDate}</div>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="deposit" className="form-label">
                    {t('contracts.rental.contractInfo.deposit', 'Tiền cọc')} <span className="required">*</span>
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
                    {t('contracts.rental.contractInfo.monthlyRent', 'Tiền thuê hàng tháng')} <span className="required">*</span>
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
              <h3><i className="fas fa-calculator"></i> {t('contracts.rental.serviceInfo.title', 'Chi phí dịch vụ')}</h3>
              
              <div className="service-pricing-grid">
                <div className="form-group">
                  <label htmlFor="electricityPrice" className="form-label">
                    {t('contracts.rental.serviceInfo.electricityPrice', 'Giá điện (VNĐ/kWh)')}
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
                    {t('contracts.rental.serviceInfo.servicePrice', 'Phí dịch vụ (VNĐ/tháng)')}
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
                    {t('contracts.rental.serviceInfo.waterChargeType', 'Cách tính tiền nước')}
                  </label>
                  <select
                    className="form-input"
                    value={rentalContractData.waterChargeType}
                    onChange={(e) => setRentalContractData(prev => ({...prev, waterChargeType: e.target.value}))}
                  >
                    <option value="fixed">{t('contracts.rental.serviceInfo.waterChargeFixed', '💧 Giá cố định')}</option>
                    <option value="per_person">{t('contracts.rental.serviceInfo.waterChargePerPerson', '👥 Tính theo người')}</option>
                  </select>
                </div>

                {rentalContractData.waterChargeType === 'fixed' && (
                  <div className="form-group">
                    <label htmlFor="waterPrice" className="form-label">
                      {t('contracts.rental.serviceInfo.waterPrice', 'Giá nước')}<br />{t('contracts.rental.serviceInfo.waterPriceUnit', '(VNĐ/khối)')}
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

                {rentalContractData.waterChargeType === 'per_person' && (
                  <div className="form-group">
                    <label htmlFor="waterPricePerPerson" className="form-label">
                      {t('contracts.rental.serviceInfo.waterPricePerPerson', 'Giá nước theo người (VNĐ/người/tháng)')}
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
                    {t('contracts.rental.serviceInfo.paymentCycle', 'Chu kỳ thanh toán')}
                  </label>
                  <select
                    id="paymentCycle"
                    className="form-input"
                    value={rentalContractData.paymentCycle}
                    onChange={(e) => setRentalContractData(prev => ({...prev, paymentCycle: e.target.value}))}
                  >
                    <option value="monthly">{t('contracts.rental.serviceInfo.paymentMonthly', '📅 Hàng tháng')}</option>
                    <option value="quarterly">{t('contracts.rental.serviceInfo.paymentQuarterly', '📊 Hàng quý')}</option>
                    <option value="yearly">{t('contracts.rental.serviceInfo.paymentYearly', '📈 Hàng năm')}</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="notes" className="form-label">
                    {t('contracts.rental.serviceInfo.notes', 'Ghi chú')}
                  </label>
                  <textarea
                    id="notes"
                    className="form-input"
                    rows="3"
                    value={rentalContractData.notes}
                    onChange={(e) => setRentalContractData(prev => ({...prev, notes: e.target.value}))}
                    placeholder={t('contracts.rental.serviceInfo.notesPlaceholder', 'Nhập ghi chú bổ sung (tùy chọn)')}
                    style={{resize: 'vertical', minHeight: '80px'}}
                  />
                </div>
              </div>

              {/* Current Meter Readings */}
              <div className="meter-readings-section">
                <h3><i className="fas fa-tachometer-alt"></i>{t('contracts.rental.meterReadings.title', 'Chỉ số điện nước hiện tại')}</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      {t('contracts.rental.meterReadings.electricIndex', 'Chỉ số điện (kWh)')} <span className="required">*</span>
                    </label>
                    <div className="form-input-group">
                      <i className="input-icon fas fa-bolt"></i>
                      <input
                        type="number"
                        min="0"
                        className={`form-input ${rentalContractErrors.currentElectricIndex ? 'error' : ''}`}
                        value={rentalContractData.currentElectricIndex}
                        onChange={(e) => setRentalContractData(prev => ({...prev, currentElectricIndex: e.target.value}))}
                        placeholder={t('contracts.rental.meterReadings.electricIndexPlaceholder', 'Nhập chỉ số điện hiện tại')}
                      />
                    </div>
                    {rentalContractErrors.currentElectricIndex && (
                      <div className="error-message">{rentalContractErrors.currentElectricIndex}</div>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">
                      {t('contracts.rental.meterReadings.waterIndex', 'Chỉ số nước (m³)')} <span className="required">*</span>
                    </label>
                    <div className="form-input-group">
                      <i className="input-icon fas fa-tint"></i>
                      <input
                        type="number"
                        min="0"
                        className={`form-input ${rentalContractErrors.currentWaterIndex ? 'error' : ''}`}
                        value={rentalContractData.currentWaterIndex}
                        onChange={(e) => setRentalContractData(prev => ({...prev, currentWaterIndex: e.target.value}))}
                        placeholder={t('contracts.rental.meterReadings.waterIndexPlaceholder', 'Nhập chỉ số nước hiện tại')}
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
                ? <><i className="fas fa-spinner fa-spin"></i> {isContractEditMode ? t('contracts.form.updating') : t('contracts.form.creating')}</>
                : <><i className="fas fa-check"></i> {isContractEditMode ? t('contracts.form.update') : t('contracts.form.create')}</>
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
                <p>{t('contracts.rental.tenantsSection.loading', 'Đang tải danh sách khách thuê...')}</p>
              </div>
            ) : roomTenants.length === 0 ? (
              <div className="empty-tenants">
                <div className="empty-icon">👥</div>
                <h3>{t('contracts.rental.tenantsSection.noTenants', 'Chưa có khách thuê')}</h3>
                <p>{t('contracts.rental.tenantsSection.noTenantsDesc', 'Phòng này chưa có khách thuê nào.')}</p>
                <button className="btn-primary" onClick={handleAddTenant}>
                  <i className="fas fa-user-plus"></i>
                  {t('contracts.rental.tenantInfo.addTenant', 'Thêm khách thuê đầu tiên')}
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
                  {t('contracts.rental.form.tenantInfoTitle', 'Thông tin khách thuê')}
                </h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t('contracts.rental.form.fullName', 'Họ và tên *')}</label>
                    <div className="form-input-group">
                      <i className="input-icon fas fa-user"></i>
                      <input
                        type="text"
                        className="form-input"
                        value={tenantFormData.fullName}
                        onChange={(e) => setTenantFormData(prev => ({...prev, fullName: e.target.value}))}
                        placeholder={t('contracts.rental.form.fullNamePlaceholder', 'Nhập họ và tên')}
                      />
                    </div>
                    {tenantFormErrors.fullName && (
                      <div className="error-message">{tenantFormErrors.fullName}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('contracts.rental.form.phone', 'Số điện thoại *')}</label>
                    <div className="form-input-group">
                      <i className="input-icon fas fa-phone"></i>
                      <input
                        type="tel"
                        className="form-input"
                        value={tenantFormData.phone}
                        onChange={(e) => setTenantFormData(prev => ({...prev, phone: e.target.value}))}
                        placeholder={t('contracts.rental.form.phonePlaceholder', 'Nhập số điện thoại')}
                      />
                    </div>
                    {tenantFormErrors.phone && (
                      <div className="error-message">{tenantFormErrors.phone}</div>
                    )}
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t('contracts.rental.form.email', 'Email')}</label>
                    <div className="form-input-group">
                      <i className="input-icon fas fa-envelope"></i>
                      <input
                        type="email"
                        className="form-input"
                        value={tenantFormData.email}
                        onChange={(e) => setTenantFormData(prev => ({...prev, email: e.target.value}))}
                        placeholder={t('contracts.rental.form.emailPlaceholder', 'email@example.com')}
                      />
                    </div>
                    {tenantFormErrors.email && (
                      <div className="error-message">{tenantFormErrors.email}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('contracts.rental.form.idNumber', 'CMND/CCCD *')}</label>
                    <div className="form-input-group">
                      <i className="input-icon fas fa-id-card"></i>
                      <input
                        type="text"
                        className="form-input"
                        value={tenantFormData.identificationNumber}
                        onChange={(e) => setTenantFormData(prev => ({...prev, identificationNumber: e.target.value}))}
                        placeholder={t('contracts.rental.form.idNumberPlaceholder', 'Nhập số CMND/CCCD')}
                      />
                    </div>
                    {tenantFormErrors.identificationNumber && (
                      <div className="error-message">{tenantFormErrors.identificationNumber}</div>
                    )}
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t('contracts.rental.form.address', 'Địa chỉ')}</label>
                    <div className="form-input-group">
                      <i className="input-icon fas fa-map-marker-alt"></i>
                      <input
                        type="text"
                        className="form-input"
                        value={tenantFormData.address}
                        onChange={(e) => setTenantFormData(prev => ({...prev, address: e.target.value}))}
                        placeholder={t('contracts.rental.form.addressPlaceholder', 'Nhập địa chỉ (không bắt buộc)')}
                      />
                    </div>
                    {tenantFormErrors.address && (
                      <div className="error-message">{tenantFormErrors.address}</div>
                    )}
                  </div>
                </div>
                
                {/* Image Upload Section */}
                <div className="form-row">
                  <div className="form-group full-width">
                    <label className="form-label">{t('contracts.rental.form.idImages', 'Ảnh căn cước/chân dung')}</label>
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
                              showToast(t('contracts.rental.form.maxImagesWarning', `Chỉ có thể tải lên tối đa 5 ảnh. Đã thêm ${filesToAdd.length} ảnh đầu tiên.`, {count: filesToAdd.length}), 'warning');
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
                              <i className="fas fa-plus"></i> {t('vehicles.form.addVehicleInfo', 'Thêm thông tin xe')} ({currentVehicles}/{maxVehicles})
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {showVehicleForm && (
                        <div className="vehicle-form-section">
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">{t('vehicles.form.licensePlate', 'Biển số xe')}</label>
                              <input
                                type="text"
                                className="form-input"
                                value={tenantFormData.vehicleLicensePlate}
                                onChange={(e) => setTenantFormData(prev => ({...prev, vehicleLicensePlate: e.target.value}))}
                                placeholder={t('vehicles.form.licensePlatePlaceholder', 'Nhập biển số xe')}
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
                                <i className="fas fa-times"></i> {t('vehicles.form.removeVehicleInfo', 'Bỏ thông tin xe')}
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
                              {t('vehicles.form.vehicleLimitReached', 'Phòng này đã đạt giới hạn xe')} ({currentVehicles}/{maxVehicles})
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
              <i className="fas fa-times"></i> {t('common.cancel', 'Hủy')}
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
                  {t('contracts.rental.form.tenantInfoTitle', 'Thông tin khách thuê')}
                </h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t('contracts.rental.form.fullName', 'Họ và tên *')}</label>
                    <div className="form-input-group">
                      <i className="input-icon fas fa-user"></i>
                      <input
                        type="text"
                        className="form-input"
                        value={tenantFormData.fullName}
                        onChange={(e) => setTenantFormData(prev => ({...prev, fullName: e.target.value}))}
                        placeholder={t('contracts.rental.form.fullNamePlaceholder', 'Nhập họ và tên')}
                      />
                    </div>
                    {tenantFormErrors.fullName && (
                      <div className="error-message">{tenantFormErrors.fullName}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('contracts.rental.form.phone', 'Số điện thoại *')}</label>
                    <div className="form-input-group">
                      <i className="input-icon fas fa-phone"></i>
                      <input
                        type="tel"
                        className="form-input"
                        value={tenantFormData.phone}
                        onChange={(e) => setTenantFormData(prev => ({...prev, phone: e.target.value}))}
                        placeholder={t('contracts.rental.form.phonePlaceholder', 'Nhập số điện thoại')}
                      />
                    </div>
                    {tenantFormErrors.phone && (
                      <div className="error-message">{tenantFormErrors.phone}</div>
                    )}
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t('contracts.rental.form.email', 'Email')}</label>
                    <div className="form-input-group">
                      <i className="input-icon fas fa-envelope"></i>
                      <input
                        type="email"
                        className="form-input"
                        value={tenantFormData.email}
                        onChange={(e) => setTenantFormData(prev => ({...prev, email: e.target.value}))}
                        placeholder={t('contracts.rental.form.emailPlaceholder', 'email@example.com')}
                      />
                    </div>
                    {tenantFormErrors.email && (
                      <div className="error-message">{tenantFormErrors.email}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('contracts.rental.form.idNumber', 'CMND/CCCD *')}</label>
                    <div className="form-input-group">
                      <i className="input-icon fas fa-id-card"></i>
                      <input
                        type="text"
                        className="form-input"
                        value={tenantFormData.identificationNumber}
                        onChange={(e) => setTenantFormData(prev => ({...prev, identificationNumber: e.target.value}))}
                        placeholder={t('contracts.rental.form.idNumberPlaceholder', 'Nhập số CMND/CCCD')}
                      />
                    </div>
                    {tenantFormErrors.identificationNumber && (
                      <div className="error-message">{tenantFormErrors.identificationNumber}</div>
                    )}
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t('contracts.rental.form.address', 'Địa chỉ')}</label>
                    <div className="form-input-group">
                      <i className="input-icon fas fa-map-marker-alt"></i>
                      <input
                        type="text"
                        className="form-input"
                        value={tenantFormData.address}
                        onChange={(e) => setTenantFormData(prev => ({...prev, address: e.target.value}))}
                        placeholder={t('contracts.rental.form.addressPlaceholder', 'Nhập địa chỉ (không bắt buộc)')}
                      />
                    </div>
                    {tenantFormErrors.address && (
                      <div className="error-message">{tenantFormErrors.address}</div>
                    )}
                  </div>
                </div>
                
                {/* Image Upload Section */}
                <div className="form-row">
                  <div className="form-group full-width">
                    <label className="form-label">{t('contracts.rental.form.idImages', 'Ảnh căn cước/chân dung')}</label>
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
                    <label className="form-label">{t('vehicles.form.licensePlate', 'Biển số xe *')}</label>
                    <input
                      type="text"
                      className={`form-input ${vehicleFormErrors.licensePlate ? 'error' : ''}`}
                      value={vehicleFormData.licensePlate}
                      onChange={(e) => setVehicleFormData(prev => ({
                        ...prev,
                        licensePlate: e.target.value
                      }))}
                      placeholder={t('vehicles.form.licensePlatePlaceholder', 'Nhập biển số xe')}
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
                      <option value="Xe máy">🏍️ {t('vehicles.types.motorcycle', 'Xe máy')}</option>
                      <option value="Xe đạp">🚲 {t('vehicles.types.bicycle', 'Xe đạp')}</option>
                      <option value="Ô tô">🚗 {t('vehicles.types.car', 'Ô tô')}</option>
                      <option value="Xe điện">⚡ {t('vehicles.types.electric', 'Xe điện')}</option>
                      <option value="Khác">🔧 {t('vehicles.types.other', 'Khác')}</option>
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
                  {t('vehicles.form.ownerInfoTitle', 'Thông tin chủ xe')}
                </h3>
                
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">{t('vehicles.form.ownerName', 'Tên chủ xe *')}</label>
                    <input
                      type="text"
                      className={`form-input ${vehicleFormErrors.ownerName ? 'error' : ''}`}
                      value={vehicleFormData.ownerName}
                      onChange={(e) => setVehicleFormData(prev => ({
                        ...prev,
                        ownerName: e.target.value
                      }))}
                      placeholder={t('vehicles.form.ownerNamePlaceholder', 'Nhập tên chủ xe')}
                    />
                    {vehicleFormErrors.ownerName && (
                      <span className="error-message">{vehicleFormErrors.ownerName}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('vehicles.form.ownerPhone', 'Số điện thoại *')}</label>
                    <input
                      type="tel"
                      className={`form-input ${vehicleFormErrors.ownerPhone ? 'error' : ''}`}
                      value={vehicleFormData.ownerPhone}
                      onChange={(e) => setVehicleFormData(prev => ({
                        ...prev,
                        ownerPhone: e.target.value
                      }))}
                      placeholder={t('vehicles.form.ownerPhonePlaceholder', 'Nhập số điện thoại')}
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
                  {t('vehicles.form.additionalInfoTitle', 'Thông tin bổ sung')}
                </h3>
                
                <div className="form-group">
                  <label className="form-label">{t('vehicles.form.notes', 'Ghi chú')}</label>
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
              <i className="fas fa-times"></i> {t('common.cancel', 'Hủy')}
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

    {/* Room Transfer Modal */}
    {showRoomTransferModal && selectedRoomForTransfer && (
      <div className="room-modal-backdrop">
        <div className="room-modal room-transfer-modal">
          <div className="room-modal-header">
            <h2 className="room-modal-title">
              {t('rooms.transfer.modalTitle')} #{selectedRoomForTransfer.roomNumber}
            </h2>
            <button className="room-modal-close" onClick={closeRoomTransferModal}>×</button>
          </div>
          
          <div className="room-modal-content">
            <div className="transfer-info">
              <p className="transfer-description">
                {t('rooms.transfer.description')}
              </p>
              <div className="current-room-info">
                <h4>{t('rooms.transfer.currentRoomInfo')} #{selectedRoomForTransfer.roomNumber}</h4>
                <div className="room-details-grid">
                  <div className="transfer-detail-item">
                    <i className="fas fa-money-bill-wave" style={{ color: '#28a745' }}></i>
                    <span>
                      <strong>{t('rooms.transfer.rent')}:</strong> {currentRoomContract?.monthlyRent ? formatPrice(currentRoomContract.monthlyRent) : formatPrice(selectedRoomForTransfer.price)}
                    </span>
                  </div>
                  <div className="transfer-detail-item">
                    <i className="fas fa-hand-holding-usd" style={{ color: '#ffc107' }}></i>
                    <span>
                      <strong>{t('rooms.transfer.deposit')}:</strong> {currentRoomContract?.deposit ? formatPrice(currentRoomContract.deposit) : t('rooms.transfer.noDeposit')}
                    </span>
                  </div>
                  <div className="transfer-detail-item">
                    <i className="fas fa-users" style={{ color: '#007bff' }}></i>
                    <span>
                      <strong>{t('rooms.transfer.currentTenants')}:</strong> {currentRoomContract?.tenants?.length || 0} {t('rooms.transfer.people')}
                    </span>
                  </div>
                  <div className="transfer-detail-item">
                    <i className="fas fa-motorcycle" style={{ color: '#6c757d' }}></i>
                    <span>
                      <strong>{t('rooms.transfer.currentVehicles')}:</strong> {currentRoomContract?.vehicles?.length || 0} {t('rooms.transfer.vehicles')}
                    </span>
                  </div>
                  <div className="transfer-detail-item">
                    <i className="fas fa-expand-arrows-alt" style={{ color: '#17a2b8' }}></i>
                    <span>
                      <strong>{t('rooms.transfer.area')}:</strong> {selectedRoomForTransfer.area || 'N/A'} {t('rooms.transfer.sqm')}
                    </span>
                  </div>
                  {currentRoomContract && (
                    <>
                      <div className="transfer-detail-item">
                        <i className="fas fa-bolt" style={{ color: '#ffc107' }}></i>
                        <span>
                          <strong>{t('rooms.transfer.electricityPrice')}:</strong> {formatPrice(currentRoomContract.electricPrice || 0)}{t('rooms.transfer.perKwh')}
                        </span>
                      </div>
                      <div className="transfer-detail-item">
                        <i className="fas fa-tint" style={{ color: '#007bff' }}></i>
                        <span>
                          <strong>{t('rooms.transfer.waterPrice')}:</strong> {formatPrice(currentRoomContract.waterPrice || 0)}{t('rooms.transfer.perMonth')}
                        </span>
                      </div>
                      <div className="transfer-detail-item">
                        <i className="fas fa-concierge-bell" style={{ color: '#6f42c1' }}></i>
                        <span>
                          <strong>{t('rooms.transfer.servicePrice')}:</strong> {formatPrice(currentRoomContract.servicePrice || 0)}{t('rooms.transfer.perMonth')}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {loadingAvailableRooms ? (
              <div className="loading-spinner">
                <i className="fas fa-spinner fa-spin"></i>
                <span>{t('rooms.transfer.loading')}</span>
              </div>
            ) : availableRoomsForTransfer.length === 0 ? (
              <div className="no-available-rooms">
                <i className="fas fa-exclamation-triangle"></i>
                <p>{t('rooms.transfer.noAvailableRooms')}</p>
              </div>
            ) : (
              <div className="available-rooms-list">
                <h3>{t('rooms.transfer.availableRooms')}</h3>
                <div className="rooms-table-container" style={{ overflowX: 'auto' }}>
                  <table className="rooms-table transfer-table">
                    <thead>
                      <tr>
                        <th>{t('rooms.transfer.select')}</th>
                        <th>{t('rooms.table.room')}</th>
                        <th>{t('rooms.table.status')}</th>
                        <th>{t('rooms.table.price')}</th>
                        <th>{t('rooms.table.details')}</th>
                        <th>{t('rooms.table.amenities')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableRoomsForTransfer.map(room => (
                        <tr 
                          key={room.id}
                          className={`transfer-room-row ${selectedTargetRoom?.id === room.id ? 'selected' : ''}`}
                          onClick={() => setSelectedTargetRoom(room)}
                        >
                          <td>
                            <div className="transfer-select-checkbox">
                              <input 
                                type="radio" 
                                name="transferRoom" 
                                checked={selectedTargetRoom?.id === room.id}
                                onChange={() => setSelectedTargetRoom(room)}
                              />
                            </div>
                          </td>
                          <td>
                            <div className="room-info-simple">
                              <div className="room-name">{room.roomNumber}</div>
                              {room.description && (
                                <div className="room-description">
                                  {room.description.length > 25 
                                    ? `${room.description.substring(0, 25)}...` 
                                    : room.description
                                  }
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="room-status">
                              <span className="status-badge status-available">
                                {t('rooms.status.available')}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="room-price">
                              <div className="price-main">{formatPrice(room.price)}</div>
                              <div className="price-period">{t('rooms.transfer.perMonth')}</div>
                            </div>
                          </td>
                          <td>
                            <div className="room-details">
                              <div className="detail-item">
                                <i className="fas fa-expand-arrows-alt"></i>
                                <span>{room.area || 'N/A'}{t('rooms.transfer.sqm')}</span>
                              </div>
                              <div className="detail-item">
                                <i className="fas fa-user-friends"></i>
                                <span>{room.capacity || 1} {t('rooms.transfer.people')}</span>
                              </div>
                              <div className="detail-item">
                                <i className="fas fa-motorcycle"></i>
                                <span>{room.vehicleCount || 0} {t('rooms.transfer.vehicles')}</span>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>          <div className="room-modal-footer">
            <button 
              className="btn-secondary" 
              onClick={closeRoomTransferModal}
              disabled={transferring}
            >
              {t('common.cancel')}
            </button>
            <button 
              className="btn-primary" 
              onClick={handleConfirmRoomTransfer}
              disabled={!selectedTargetRoom || transferring || loadingAvailableRooms}
            >
              {transferring ? (
                <><i className="fas fa-spinner fa-spin"></i> {t('rooms.transfer.transferring')}</>
              ) : (
                <><i className="fas fa-exchange-alt"></i> {t('rooms.transfer.confirm')}</>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Invoice Modal */}
    {showInvoiceModal && selectedRoomForInvoice && (
      <div className="room-modal-backdrop">
        <div className="room-modal invoice-modal">
          <div className="room-modal-header">
            <h2 className="room-modal-title">
              <i className="fas fa-file-invoice-dollar"></i>
              Tạo hóa đơn - Phòng {selectedRoomForInvoice.roomNumber || selectedRoomForInvoice.room_number}
            </h2>
            <button className="room-modal-close" onClick={() => setShowInvoiceModal(false)}>×</button>
          </div>
          
          <div className="room-modal-content">
            {loadingInvoiceInfo ? (
              <div className="loading-section">
                <div className="loading-spinner">
                  <i className="fas fa-spinner fa-spin"></i>
                </div>
                <p>{t('rooms.invoice.loading')}</p>
              </div>
            ) : (
              <>
                {/* Invoice Basic Information */}
                <div className="room-form-grid">
                  <div className="room-form-group">
                    <label className="room-form-label">
                      {t('rooms.invoice.issueDate') || 'Ngày lập hóa đơn'} *
                    </label>
                    <input
                      type="date"
                      className="room-form-input"
                      value={invoiceFormData.issueDate}
                      onChange={(e) => handleInvoiceFormChange('issueDate', e.target.value)}
                    />
                  </div>

                  <div className="room-form-group">
                    <label className="room-form-label">
                      {t('rooms.invoice.paymentDueDate') || 'Ngày đến hạn thanh toán'} *
                    </label>
                    <input
                      type="date"
                      className="room-form-input"
                      value={invoiceFormData.dueDate}
                      onChange={(e) => handleInvoiceFormChange('dueDate', e.target.value)}
                      style={{backgroundColor: '#f9fafb'}}
                      readOnly
                      title="Tự động tính 5 ngày sau ngày kết thúc chu kỳ"
                    />
                    <span className="form-helper-text" style={{color: '#6b7280', fontSize: '12px', fontStyle: 'italic'}}>
                      Tự động tính 5 ngày sau ngày kết thúc chu kỳ
                    </span>
                  </div>
                </div>

                {/* Billing Period */}
                <div className="room-form-grid">
                  <div className="room-form-group">
                    <label className="room-form-label">
                      {t('rooms.invoice.periodStart')} *
                    </label>
                    <input
                      type="date"
                      name="periodStart"
                      className={`room-form-input ${invoiceFormErrors.periodStart ? 'error' : ''}`}
                      value={invoiceFormData.periodStart}
                      onChange={(e) => handleInvoiceFormChange('periodStart', e.target.value)}
                    />
                    {invoiceFormErrors.periodStart && (
                      <div className="error-text">{invoiceFormErrors.periodStart}</div>
                    )}
                  </div>
                  
                  <div className="room-form-group">
                    <label className="room-form-label">
                      {t('rooms.invoice.periodEnd')} *
                    </label>
                    <input
                      type="date"
                      name="periodEnd"
                      className={`room-form-input ${invoiceFormErrors.periodEnd ? 'error' : ''}`}
                      value={invoiceFormData.periodEnd}
                      onChange={(e) => handleInvoiceFormChange('periodEnd', e.target.value)}
                    />
                    {invoiceFormErrors.periodEnd && (
                      <div className="error-text">{invoiceFormErrors.periodEnd}</div>
                    )}
                    <span className="form-helper-text" style={{color: '#6b7280', fontSize: '12px'}}>
                      Ngày đến hạn thanh toán sẽ tự động cập nhật (+5 ngày)
                    </span>
                  </div>
                </div>

                {/* Utility Readings Section */}
                <div className="room-form-section">
                  <h3 style={{color: '#1f2937', fontSize: '18px', fontWeight: '600', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid #e5e7eb'}}>
                    <i className="fas fa-tachometer-alt" style={{marginRight: '8px', color: '#3b82f6'}}></i>
                    {t('rooms.invoice.utilityReadings') || 'Chỉ số điện nước'}
                  </h3>

                  {/* Electric Readings */}
                  <div className="utility-readings-group">
                    <h4 style={{color: '#374151', fontSize: '16px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <i className="fas fa-bolt" style={{color: '#f59e0b'}}></i>
                      Điện ({(invoiceFormData.electricRate || 0).toLocaleString('vi-VN')} VNĐ/kWh)
                    </h4>
                    <div className="room-form-grid" style={{gridTemplateColumns: '1fr 1fr 1fr auto'}}>
                      <div className="room-form-group">
                        <label className="room-form-label">{t('invoices.form.oldReading', 'Chỉ số cũ')}</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="room-form-input"
                          value={invoiceFormData.electricOldReading || ''}
                          onChange={(e) => handleInvoiceFormChange('electricOldReading', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </div>

                      <div className="room-form-group">
                        <label className="room-form-label">{t('invoices.form.newReading', 'Chỉ số mới *')}</label>
                        <input
                          type="number"
                          name="electricNewReading"
                          min="0"
                          step="1"
                          className={`room-form-input ${invoiceFormErrors.electricNewReading ? 'error' : ''}`}
                          value={invoiceFormData.electricNewReading || ''}
                          onChange={(e) => handleInvoiceFormChange('electricNewReading', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                        />
                        {invoiceFormErrors.electricNewReading && (
                          <div className="error-text">{invoiceFormErrors.electricNewReading}</div>
                        )}
                      </div>

                      <div className="room-form-group">
                        <label className="room-form-label">{t('invoices.form.consumption', 'Tiêu thụ')}</label>
                        <input
                          type="number"
                          className="room-form-input"
                          value={(invoiceFormData.electricNewReading || 0) - (invoiceFormData.electricOldReading || 0)}
                          readOnly
                          style={{backgroundColor: '#f9fafb'}}
                        />
                      </div>

                      <div className="room-form-group">
                        <label className="room-form-label">{t('invoices.form.totalAmount', 'Thành tiền')}</label>
                        <div style={{
                          padding: '10px 12px',
                          backgroundColor: '#f0f9ff',
                          border: '2px solid #0ea5e9',
                          borderRadius: '8px',
                          fontWeight: '600',
                          color: '#0369a1',
                          textAlign: 'center',
                          minWidth: '120px'
                        }}>
                          {(((invoiceFormData.electricNewReading || 0) - (invoiceFormData.electricOldReading || 0)) * (invoiceFormData.electricRate || 0)).toLocaleString('vi-VN')} {t('common.currency', 'VNĐ')}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Water Billing */}
                  <div className="utility-readings-group" style={{marginTop: '16px'}}>
                    {invoiceFormData.waterBillingType === 'perCubicMeter' ? (
                      <>
                        <h4 style={{color: '#374151', fontSize: '16px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <i className="fas fa-tint" style={{color: '#06b6d4'}}></i>
                          Nước ({(invoiceFormData.waterRate || 0).toLocaleString('vi-VN')} VNĐ/m³)
                        </h4>
                        <div className="room-form-grid" style={{gridTemplateColumns: '1fr 1fr 1fr auto'}}>
                          <div className="room-form-group">
                            <label className="room-form-label">{t('invoices.form.oldReading', 'Chỉ số cũ')}</label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              className="room-form-input"
                              value={invoiceFormData.waterOldReading || ''}
                              onChange={(e) => handleInvoiceFormChange('waterOldReading', parseFloat(e.target.value) || 0)}
                              placeholder="0"
                            />
                          </div>

                          <div className="room-form-group">
                            <label className="room-form-label">{t('invoices.form.newReading', 'Chỉ số mới *')}</label>
                            <input
                              type="number"
                              name="waterNewReading"
                              min="0"
                              step="1"
                              className={`room-form-input ${invoiceFormErrors.waterNewReading ? 'error' : ''}`}
                              value={invoiceFormData.waterNewReading || ''}
                              onChange={(e) => handleInvoiceFormChange('waterNewReading', parseFloat(e.target.value) || 0)}
                              placeholder="0"
                            />
                            {invoiceFormErrors.waterNewReading && (
                              <div className="error-text">{invoiceFormErrors.waterNewReading}</div>
                            )}
                          </div>

                          <div className="room-form-group">
                            <label className="room-form-label">{t('invoices.form.consumption', 'Tiêu thụ')}</label>
                            <input
                              type="number"
                              className="room-form-input"
                              value={(invoiceFormData.waterNewReading || 0) - (invoiceFormData.waterOldReading || 0)}
                              readOnly
                              style={{backgroundColor: '#f9fafb'}}
                            />
                          </div>

                          <div className="room-form-group">
                            <label className="room-form-label">{t('invoices.form.totalAmount', 'Thành tiền')}</label>
                            <div style={{
                              padding: '10px 12px',
                              backgroundColor: '#f0fdfa',
                              border: '2px solid #14b8a6',
                              borderRadius: '8px',
                              fontWeight: '600',
                              color: '#0f766e',
                              textAlign: 'center',
                              minWidth: '120px'
                            }}>
                              {(((invoiceFormData.waterNewReading || 0) - (invoiceFormData.waterOldReading || 0)) * (invoiceFormData.waterRate || 0)).toLocaleString('vi-VN')} {t('common.currency', 'VNĐ')}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <h4 style={{color: '#374151', fontSize: '16px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <i className="fas fa-tint" style={{color: '#06b6d4'}}></i>
                          Nước ({(invoiceFormData.waterPricePerPerson || 0).toLocaleString('vi-VN')} VNĐ/người)
                        </h4>
                        <div className="room-form-grid" style={{gridTemplateColumns: '1fr auto'}}>
                          <div className="room-form-group">
                            <label className="room-form-label">{t('invoices.form.numberOfTenants', 'Số người thuê')}</label>
                            <input
                              type="number"
                              className="room-form-input"
                              value={contractInfo?.tenants?.length || 1}
                              readOnly
                              style={{backgroundColor: '#f9fafb'}}
                            />
                          </div>

                          <div className="room-form-group">
                            <label className="room-form-label">{t('invoices.form.totalAmount', 'Thành tiền')}</label>
                            <div style={{
                              padding: '10px 12px',
                              backgroundColor: '#f0fdfa',
                              border: '2px solid #14b8a6',
                              borderRadius: '8px',
                              fontWeight: '600',
                              color: '#0f766e',
                              textAlign: 'center',
                              minWidth: '120px'
                            }}>
                              {((contractInfo?.tenants?.length || 1) * (invoiceFormData.waterPricePerPerson || 0)).toLocaleString('vi-VN')} {t('common.currency', 'VNĐ')}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Charges Section */}
                <div className="room-form-section">
                  <div className="section-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                    <h3 style={{color: '#1f2937', fontSize: '18px', fontWeight: '600', margin: 0}}>
                      <i className="fas fa-list-ul" style={{marginRight: '8px', color: '#3b82f6'}}></i>
                      {t('rooms.invoice.charges')}
                    </h3>
                    <button type="button" className="btn-add-charge" onClick={addCharge} style={{
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <i className="fas fa-plus"></i>
                      {t('rooms.invoice.addCharge')}
                    </button>
                  </div>

                  {invoiceFormData.charges.map((charge, index) => (
                    <div key={index} className="charge-item" style={{
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '16px',
                      backgroundColor: '#ffffff'
                    }}>
                      <div className="charge-form-grid" style={{display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 1fr auto', gap: '12px', alignItems: 'end'}}>
                        <div className="room-form-group">
                          <label className="room-form-label">{t('rooms.invoice.chargeType')}</label>
                          <select
                            className="room-form-input"
                            value={charge.type}
                            onChange={(e) => handleChargeChange(index, 'type', e.target.value)}
                          >
                            <option value="rent">{t('rooms.invoice.chargeTypes.rent')}</option>
                            <option value="electricity">{t('rooms.invoice.chargeTypes.electricity')}</option>
                            <option value="water">{t('rooms.invoice.chargeTypes.water')}</option>
                            <option value="internet">{t('rooms.invoice.chargeTypes.internet')}</option>
                            <option value="parking">{t('rooms.invoice.chargeTypes.parking')}</option>
                            <option value="cleaning">{t('rooms.invoice.chargeTypes.cleaning')}</option>
                            <option value="other">{t('rooms.invoice.chargeTypes.other')}</option>
                          </select>
                        </div>

                        <div className="room-form-group">
                          <label className="room-form-label">{t('rooms.invoice.description')} *</label>
                          <input
                            type="text"
                            className="room-form-input"
                            value={charge.description}
                            onChange={(e) => handleChargeChange(index, 'description', e.target.value)}
                            placeholder={t('rooms.invoice.descriptionPlaceholder')}
                          />
                        </div>

                        <div className="room-form-group">
                          <label className="room-form-label">{t('rooms.invoice.quantity')}</label>
                          <input
                            type="number"
                            min="1"
                            step="0.01"
                            className="room-form-input"
                            value={charge.quantity}
                            onChange={(e) => handleChargeChange(index, 'quantity', parseFloat(e.target.value) || 1)}
                          />
                        </div>

                        <div className="room-form-group">
                          <label className="room-form-label">{t('rooms.invoice.unitPrice')}</label>
                          <input
                            type="text"
                            className="room-form-input"
                            value={charge.unitPrice ? charge.unitPrice.toLocaleString('vi-VN') : '0'}
                            onChange={(e) => {
                              const cleanValue = e.target.value.replace(/\D/g, '');
                              handleChargeChange(index, 'unitPrice', parseInt(cleanValue) || 0);
                            }}
                          />
                        </div>

                        <div className="room-form-group">
                          <label className="room-form-label">{t('rooms.invoice.amount')}</label>
                          <input
                            type="text"
                            className="room-form-input"
                            value={charge.amount ? charge.amount.toLocaleString('vi-VN') : '0'}
                            readOnly
                            style={{backgroundColor: '#f9fafb'}}
                          />
                        </div>

                        <div className="charge-actions">
                          {invoiceFormData.charges.length > 1 && (
                            <button
                              type="button"
                              className="btn-remove-charge"
                              onClick={() => removeCharge(index)}
                              title={t('rooms.invoice.removeCharge')}
                              style={{
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                padding: '8px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                width: '36px',
                                height: '36px'
                              }}
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary Section */}
                <div className="room-form-section" style={{
                  backgroundColor: '#f8fafc',
                  padding: '20px',
                  borderRadius: '8px',
                  marginBottom: '24px'
                }}>
                  <h3 style={{color: '#1f2937', fontSize: '18px', fontWeight: '600', marginBottom: '16px'}}>
                    <i className="fas fa-calculator" style={{marginRight: '8px', color: '#3b82f6'}}></i>
                    {t('rooms.invoice.summary')}
                  </h3>
                  
                  <div className="invoice-summary">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                      <span style={{fontWeight: '500', color: '#374151'}}>{t('rooms.invoice.subtotal')}:</span>
                      <span style={{fontWeight: '600', color: '#1f2937'}}>
                        {invoiceFormData.charges.reduce((sum, charge) => sum + charge.amount, 0).toLocaleString('vi-VN')} VNĐ
                      </span>
                    </div>
                    
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                      <span style={{fontWeight: '500', color: '#374151'}}>{t('rooms.invoice.discount')}:</span>
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <input
                          type="text"
                          className="room-form-input"
                          style={{width: '120px', textAlign: 'right'}}
                          value={invoiceFormData.discount ? invoiceFormData.discount.toLocaleString('vi-VN') : '0'}
                          onChange={(e) => {
                            const cleanValue = e.target.value.replace(/\D/g, '');
                            handleInvoiceFormChange('discount', parseInt(cleanValue) || 0);
                          }}
                        />
                        <span style={{color: '#6b7280', fontWeight: '500'}}>VNĐ</span>
                      </div>
                    </div>
                    
                    <hr style={{border: 'none', borderTop: '1px solid #d1d5db', margin: '12px 0'}} />
                    
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <span style={{fontWeight: '700', color: '#1f2937', fontSize: '18px'}}>{t('rooms.invoice.total')}:</span>
                      <span style={{fontWeight: '700', color: '#dc2626', fontSize: '20px'}}>
                        {calculateInvoiceTotal().toLocaleString('vi-VN')} VNĐ
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes Section */}
                <div className="room-form-group full">
                  <label className="room-form-label">
                    {t('rooms.invoice.notes')}
                  </label>
                  <textarea
                    className="room-form-textarea"
                    rows="3"
                    value={invoiceFormData.notes}
                    onChange={(e) => handleInvoiceFormChange('notes', e.target.value)}
                    placeholder={t('rooms.invoice.notesPlaceholder')}
                  />
                </div>
              </>
            )}
          </div>

          <div className="room-modal-footer">
            <div style={{display: 'flex', gap: '12px', width: '100%', justifyContent: 'flex-end'}}>
              <button 
                className="btn-secondary" 
                disabled={savingInvoice}
                onClick={() => {
                  setShowInvoiceModal(false);
                  setInvoiceFormErrors({}); // Reset errors
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveInvoice}
                disabled={savingInvoice || loadingInvoiceInfo}
              >
                {savingInvoice ? (
                  <><i className="fas fa-spinner fa-spin"></i> {t('rooms.invoice.creating')}</>
                ) : (
                  <><i className="fas fa-save"></i> {t('rooms.invoice.create')}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Mark as Expiring Confirmation Modal */}
    {showExpiringConfirmModal && selectedRoomForExpiring && (
      <div className="room-modal-overlay" onClick={cancelMarkAsExpiring}>
        <div className="room-confirm-modal" onClick={(e) => e.stopPropagation()}>
          <div className="room-confirm-header">
            <i className="fas fa-exclamation-circle room-confirm-icon"></i>
            <h3>Xác nhận đánh dấu sắp kết thúc</h3>
          </div>
          <div className="room-confirm-body">
            <p>Bạn có chắc chắn muốn đánh dấu phòng <strong>{selectedRoomForExpiring.roomNumber}</strong> sắp kết thúc?</p>
            <div className="room-confirm-info">
              <i className="fas fa-info-circle"></i>
              <div>
                <p><strong>Hành động này sẽ:</strong></p>
                <ul>
                  <li>Chuyển trạng thái phòng sang "Sắp kết thúc"</li>
                  <li>Cập nhật trạng thái các hợp đồng đang hoạt động sang "Sắp kết thúc"</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="room-confirm-footer">
            <button className="room-confirm-btn-cancel" onClick={cancelMarkAsExpiring}>
              <i className="fas fa-times"></i>
              Hủy
            </button>
            <button className="room-confirm-btn-confirm" onClick={confirmMarkAsExpiring}>
              <i className="fas fa-check"></i>
              Xác nhận
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Cancel Expiring Confirmation Modal */}
    {showCancelExpiringModal && selectedRoomForCancelExpiring && (
      <div className="room-modal-overlay" onClick={cancelCancelExpiring}>
        <div className="room-confirm-modal" onClick={(e) => e.stopPropagation()}>
          <div className="room-confirm-header">
            <i className="fas fa-undo room-confirm-icon"></i>
            <h3>Xác nhận hủy báo kết thúc</h3>
          </div>
          <div className="room-confirm-body">
            <p>Bạn có chắc chắn muốn hủy báo kết thúc phòng <strong>{selectedRoomForCancelExpiring.roomNumber}</strong>?</p>
            <div className="room-confirm-info">
              <i className="fas fa-info-circle"></i>
              <div>
                <p><strong>Hành động này sẽ:</strong></p>
                <ul>
                  <li>Chuyển trạng thái phòng về "Đã thuê"</li>
                  <li>Cập nhật trạng thái các hợp đồng về "Đang hoạt động"</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="room-confirm-footer">
            <button className="room-confirm-btn-cancel" onClick={cancelCancelExpiring}>
              <i className="fas fa-times"></i>
              Hủy
            </button>
            <button className="room-confirm-btn-confirm" onClick={confirmCancelExpiring}>
              <i className="fas fa-check"></i>
              Xác nhận
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Terminate Contract Confirmation Modal */}
    {showTerminateContractModal && selectedRoomForTerminate && (
      <div className="room-modal-overlay" onClick={cancelTerminateContract}>
        <div className="room-confirm-modal" onClick={(e) => e.stopPropagation()}>
          <div className="room-confirm-header">
            <i className="fas fa-ban room-confirm-icon" style={{color: '#dc2626'}}></i>
            <h3>Xác nhận kết thúc hợp đồng</h3>
          </div>
          <div className="room-confirm-body">
            <p>Bạn có chắc chắn muốn kết thúc hợp đồng phòng <strong>{selectedRoomForTerminate.roomNumber}</strong>?</p>
            
            <div className="room-confirm-checkbox">
              <label style={{display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '12px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bfdbfe'}}>
                <input
                  type="checkbox"
                  checked={createFinalInvoice}
                  onChange={(e) => setCreateFinalInvoice(e.target.checked)}
                  style={{
                    width: '18px',
                    height: '18px',
                    accentColor: '#3b82f6',
                    cursor: 'pointer'
                  }}
                />
                <span style={{fontSize: '14px', color: '#1e40af', fontWeight: '500'}}>
                  <i className="fas fa-file-invoice" style={{marginRight: '6px'}}></i>
                  Tạo hóa đơn tháng cuối trước khi kết thúc
                </span>
              </label>
            </div>
            
            <div className="room-confirm-info" style={{marginTop: '16px'}}>
              <i className="fas fa-exclamation-triangle" style={{color: '#dc2626'}}></i>
              <div>
                <p><strong>Hành động này sẽ:</strong></p>
                <ul>
                  <li>Chuyển trạng thái hợp đồng sang "Đã kết thúc"</li>
                  <li>Xóa tất cả khách thuê khỏi phòng</li>
                  <li>Chuyển trạng thái phòng về "Trống"</li>
                  {createFinalInvoice && <li style={{color: '#2563eb', fontWeight: '500'}}>Mở form tạo hóa đơn thanh toán tháng cuối</li>}
                </ul>
              </div>
            </div>
          </div>
          <div className="room-confirm-footer">
            <button className="room-confirm-btn-cancel" onClick={cancelTerminateContract}>
              <i className="fas fa-times"></i>
              Hủy
            </button>
            <button 
              className="room-confirm-btn-confirm" 
              onClick={confirmTerminateContract}
              style={{background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'}}
              disabled={terminatingContract}
            >
              <i className="fas fa-ban"></i>
              {terminatingContract ? 'Đang xử lý...' : 'Kết thúc hợp đồng'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Import Excel Modal */}
    {showImportModal && (
      <div className="modal-overlay" onClick={() => {
        if (!importLoading) {
          setShowImportModal(false);
          setImportFile(null);
          setImportData([]);
        }
      }}>
        <div className="import-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>
              <i className="fas fa-file-import"></i> {t('rooms.importExcel', 'Import Excel')}
            </h3>
            <button 
              className="modal-close-btn" 
              onClick={() => {
                if (!importLoading) {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportData([]);
                }
              }}
              disabled={importLoading}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="modal-body">
            {/* Top Section with Template Button */}
            <div className="import-top-section">
              <div className="template-download-area">
                <button className="template-download-btn" onClick={handleDownloadTemplate}>
                  <i className="fas fa-download"></i>
                  {t('rooms.downloadTemplate', 'Tải file mẫu')}
                </button>
              </div>
              <p className="import-hint">
                <i className="fas fa-info-circle"></i>
                {t('rooms.templateHint', 'Tải file mẫu để xem định dạng dữ liệu cần import')}
              </p>
            </div>

            {/* File Upload */}
            <div className="import-section">
              <label className="file-upload-label">
                <i className="fas fa-file-excel"></i>
                {t('rooms.selectFile', 'Chọn file Excel')}
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="file-input"
                id="excel-file-input"
                disabled={importLoading}
              />
              <label htmlFor="excel-file-input" className="file-input-btn">
                <i className="fas fa-upload"></i>
                {importFile ? importFile.name : t('rooms.chooseFile', 'Chọn file...')}
              </label>
            </div>

            {/* Error Warning - Positioned after file upload for immediate visibility */}
            {importData.length > 0 && importData.some(r => !r.isValid) && (
              <div className="import-section">
                <p className="import-warning">
                  <i className="fas fa-exclamation-triangle"></i>
                  {t('rooms.invalidRowsWarning', 'Có một số dòng không hợp lệ. Hãy sửa dữ liệu trực tiếp trên bảng để có thể import.')}
                </p>
              </div>
            )}

            {/* Data Preview Grid */}
            {importData.length > 0 && (
              <div className="import-section">
                <h4 className="preview-title">
                  <i className="fas fa-table"></i>
                  {t('rooms.dataPreview', 'Xem trước dữ liệu')} ({importData.length} phòng)
                </h4>
                
                <div className="import-data-grid">
                  <table className="import-table">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <th>Tên phòng</th>
                        <th>Giá thuê</th>
                        <th>Giá cọc</th>
                        <th>Diện tích</th>
                        <th>Sức chứa</th>
                        <th>Điện</th>
                        <th>Nước</th>
                        <th>Hợp lệ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importData.map((room, index) => (
                        <tr key={room.id} className={!room.isValid ? 'invalid-row' : ''}>
                          <td>{index + 1}</td>
                          <td>
                            <input
                              type="text"
                              className="editable-cell"
                              value={room.roomNumber}
                              onChange={(e) => handleEditImportRow(index, 'roomNumber', e.target.value)}
                              onBlur={(e) => handleCheckRoomNameExists(index, e.target.value)}
                              placeholder="Tên phòng"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="editable-cell"
                              value={room.price}
                              onChange={(e) => handleEditImportRow(index, 'price', parseFloat(e.target.value) || 0)}
                              placeholder="Giá thuê"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="editable-cell"
                              value={room.deposit}
                              onChange={(e) => handleEditImportRow(index, 'deposit', parseFloat(e.target.value) || 0)}
                              placeholder="Giá cọc"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="editable-cell"
                              value={room.area}
                              onChange={(e) => handleEditImportRow(index, 'area', parseFloat(e.target.value) || 0)}
                              placeholder="Diện tích"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="editable-cell"
                              value={room.capacity}
                              onChange={(e) => handleEditImportRow(index, 'capacity', parseInt(e.target.value) || 0)}
                              placeholder="Sức chứa"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="editable-cell"
                              value={room.electricityPrice}
                              onChange={(e) => handleEditImportRow(index, 'electricityPrice', parseFloat(e.target.value) || 0)}
                              placeholder="Giá điện"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="editable-cell"
                              value={room.waterPrice}
                              onChange={(e) => handleEditImportRow(index, 'waterPrice', parseFloat(e.target.value) || 0)}
                              placeholder="Giá nước"
                            />
                          </td>
                          <td>
                            {room.isValid ? (
                              <span className="valid-icon"><i className="fas fa-check-circle"></i></span>
                            ) : (
                              <span className="invalid-icon" title={room.errors.join(', ')}>
                                <i className="fas fa-exclamation-circle"></i>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Summary Stats */}
                <div className="import-summary">
                  <div className="summary-item summary-total">
                    <i className="fas fa-list"></i>
                    <span>Tổng: <strong>{importData.length}</strong> phòng</span>
                  </div>
                  <div className="summary-item summary-valid">
                    <i className="fas fa-check-circle"></i>
                    <span>Hợp lệ: <strong>{importData.filter(r => r.isValid).length}</strong> phòng</span>
                  </div>
                  <div className="summary-item summary-invalid">
                    <i className="fas fa-exclamation-circle"></i>
                    <span>Lỗi: <strong>{importData.filter(r => !r.isValid).length}</strong> phòng</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              className="btn-cancel"
              onClick={() => {
                setShowImportModal(false);
                setImportFile(null);
                setImportData([]);
              }}
              disabled={importLoading}
            >
              <i className="fas fa-times"></i>
              {t('common.cancel', 'Hủy')}
            </button>
            <button
              className="btn-import"
              onClick={handleImport}
              disabled={importLoading || importData.length === 0 || !importData.some(r => r.isValid)}
            >
              <i className={importLoading ? "fas fa-spinner fa-spin" : "fas fa-file-import"}></i>
              {importLoading ? t('rooms.importing', 'Đang import...') : t('rooms.import', 'Import')}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Billing Excel Modal */}
    {showBillingModal && (
      <div className="modal-overlay" onClick={() => {
        if (!billingLoading) {
          setShowBillingModal(false);
          setBillingFile(null);
          setBillingData([]);
        }
      }}>
        <div className="import-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>
              <i className="fas fa-file-invoice-dollar"></i> {t('rooms.billingExcel', 'Tính tiền bằng Excel')}
            </h3>
            <button
              className="modal-close-btn"
              onClick={() => {
                setShowBillingModal(false);
                setBillingFile(null);
                setBillingData([]);
              }}
              disabled={billingLoading}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="modal-body">
            {/* Top Section with Template Button */}
            <div className="import-top-section">
              <div className="template-download-area">
                <button className="template-download-btn" onClick={handleGenerateBillingTemplate} disabled={billingLoading}>
                  <i className={billingLoading ? "fas fa-spinner fa-spin" : "fas fa-download"}></i>
                  {billingLoading ? t('rooms.generating', 'Đang tạo...') : t('rooms.generateTemplate', 'Tải file mẫu')}
                </button>
              </div>
              <p className="import-hint">
                <i className="fas fa-info-circle"></i>
                {t('rooms.billingTemplateHint', 'File sẽ chứa danh sách phòng đang thuê và chỉ số điện nước cũ. Bạn chỉ cần điền chỉ số mới.')}
              </p>
            </div>

            {/* File Upload */}
            <div className="import-section">
              <label className="file-upload-label">
                <i className="fas fa-file-excel"></i>
                {t('rooms.selectBillingFile', 'Chọn file Excel')}
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleBillingFileSelect}
                className="file-input"
                id="billing-file-input"
                disabled={billingLoading}
              />
              <label htmlFor="billing-file-input" className="file-input-btn">
                <i className="fas fa-upload"></i>
                {billingFile ? billingFile.name : t('rooms.chooseFile', 'Chọn file...')}
              </label>
            </div>

            {/* Error Warning - Positioned after file upload for immediate visibility */}
            {billingData.length > 0 && billingData.some(r => !r.isValid) && (
              <div className="import-section">
                <p className="import-warning">
                  <i className="fas fa-exclamation-triangle"></i>
                  {t('rooms.invalidBillingWarning', 'Có một số bản ghi không hợp lệ. Hãy sửa dữ liệu trực tiếp trên bảng để có thể tạo hóa đơn.')}
                </p>
              </div>
            )}

            {/* Data Preview Grid */}
            {billingData.length > 0 && (
              <div className="import-section">
                <h4 className="preview-title">
                  <i className="fas fa-table"></i>
                  {t('rooms.billingDataPreview', 'Xem trước hóa đơn')} ({billingData.length} phòng)
                </h4>
                
                <div className="import-data-grid">
                  <table className="billing-table">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <th>Phòng</th>
                        <th>Khách</th>
                        <th>Kỳ (Từ - Đến)</th>
                        <th>Tiền phòng</th>
                        <th>Loại nước</th>
                        <th>Điện cũ</th>
                        <th>Điện mới</th>
                        <th>Tiêu thụ</th>
                        <th>Tiền điện</th>
                        <th>Nước cũ</th>
                        <th>Nước mới</th>
                        <th>Tiêu thụ/SL</th>
                        <th>Tiền nước</th>
                        <th>Phí DV</th>
                        <th>Tổng tiền</th>
                        <th>Hợp lệ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingData.map((record, index) => {
                        const isWaterPerPerson = record.waterBillingType === 'perPerson';
                        return (
                        <tr key={index} className={!record.isValid ? 'invalid-row' : ''}>
                          <td>{record.stt}</td>
                          <td>{record.roomNumber}</td>
                          <td>{record.tenantName}</td>
                          <td style={{fontSize: '11px', whiteSpace: 'nowrap'}}>{record.billingPeriod}</td>
                          <td style={{fontWeight: '600', color: '#f59e0b'}}>{(record.monthlyRent || 0).toLocaleString('vi-VN')}đ</td>
                          <td>
                            <span className="badge-water-type">
                              {isWaterPerPerson ? '👥 Theo người' : '📊 Theo số'}
                            </span>
                          </td>
                          <td>
                            <input
                              type="number"
                              className="editable-cell"
                              value={record.electricOld}
                              readOnly
                              disabled
                              style={{backgroundColor: '#f3f4f6', cursor: 'not-allowed'}}
                              title="Chỉ số cũ không được chỉnh sửa"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="editable-cell"
                              value={record.electricNew}
                              onChange={(e) => handleEditBillingRow(index, 'electricNew', e.target.value)}
                              disabled={billingLoading}
                            />
                          </td>
                          <td>{(record.electricNew - record.electricOld).toFixed(0)}</td>
                          <td>{record.electricAmount.toLocaleString('vi-VN')} đ</td>
                          <td>
                            {isWaterPerPerson ? (
                              <span className="text-muted">-</span>
                            ) : (
                              <input
                                type="number"
                                className="editable-cell"
                                value={record.waterOld}
                                readOnly
                                disabled
                                style={{backgroundColor: '#f3f4f6', cursor: 'not-allowed'}}
                                title="Chỉ số cũ không được chỉnh sửa"
                              />
                            )}
                          </td>
                          <td>
                            {isWaterPerPerson ? (
                              <span className="text-muted">-</span>
                            ) : (
                              <input
                                type="number"
                                className="editable-cell"
                                value={record.waterNew}
                                onChange={(e) => handleEditBillingRow(index, 'waterNew', e.target.value)}
                                disabled={billingLoading}
                              />
                            )}
                          </td>
                          <td>
                            {isWaterPerPerson ? (
                              <span>{record.tenantCount} người</span>
                            ) : (
                              <span>{(record.waterNew - record.waterOld).toFixed(0)}</span>
                            )}
                          </td>
                          <td>{record.waterAmount.toLocaleString('vi-VN')} đ</td>
                          <td>
                            <input
                              type="number"
                              className="editable-cell"
                              value={record.servicePrice}
                              onChange={(e) => handleEditBillingRow(index, 'servicePrice', e.target.value)}
                              disabled={billingLoading}
                            />
                          </td>
                          <td className="total-cell">{record.totalAmount.toLocaleString('vi-VN')} đ</td>
                          <td>
                            {record.isValid ? (
                              <span className="valid-icon" title="Hợp lệ">
                                <i className="fas fa-check-circle"></i>
                              </span>
                            ) : (
                              <span className="invalid-icon" title={record.errors.join(', ')}>
                                <i className="fas fa-exclamation-triangle"></i>
                              </span>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {/* Summary Stats */}
                <div className="import-summary">
                  <div className="summary-item summary-total">
                    <i className="fas fa-list"></i>
                    <span>Tổng: <strong>{billingData.length}</strong> phòng</span>
                  </div>
                  <div className="summary-item summary-valid">
                    <i className="fas fa-check-circle"></i>
                    <span>Hợp lệ: <strong>{billingData.filter(r => r.isValid).length}</strong> phòng</span>
                  </div>
                  <div className="summary-item summary-invalid">
                    <i className="fas fa-exclamation-circle"></i>
                    <span>Lỗi: <strong>{billingData.filter(r => !r.isValid).length}</strong> phòng</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              className="btn-cancel"
              onClick={() => {
                setShowBillingModal(false);
                setBillingFile(null);
                setBillingData([]);
              }}
              disabled={billingLoading}
            >
              <i className="fas fa-times"></i>
              {t('common.cancel', 'Hủy')}
            </button>
            <button
              className="btn-import"
              onClick={handleCreateInvoices}
              disabled={billingLoading || billingData.length === 0 || !billingData.some(r => r.isValid)}
            >
              <i className={billingLoading ? "fas fa-spinner fa-spin" : "fas fa-file-invoice"}></i>
              {billingLoading ? t('rooms.creatingInvoices', 'Đang tạo...') : t('rooms.createInvoices', 'Tạo hóa đơn')}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default RoomsManagement;
