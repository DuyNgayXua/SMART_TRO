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
  const [form, setForm] = useState({ fullName:'', email:'', phone:'', address:'', identificationNumber:'', roomId:'', role:'tenant', tenantImages:[] });
  const [editForm, setEditForm] = useState({ fullName:'', email:'', phone:'', address:'', identificationNumber:'', isActive:true, role:'tenant', tenantImages:[] });
  const [deletedImageUrls, setDeletedImageUrls] = useState([]); // Track deleted image URLs
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [pagination, setPagination] = useState({ currentPage:1, totalPages:1, totalItems:0, itemsPerPage:12 });
  const [filters, setFilters] = useState({ search:'', status:'', role:'tenant' });
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Import Excel states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importData, setImportData] = useState([]);
  const [importLoading, setImportLoading] = useState(false);

  const fetchRoomsWithTenants = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all rooms first (without pagination to get accurate count)
      const roomsRes = await roomsAPI.getAllRooms({
        page: 1,
        limit: 1000, // Get all rooms to filter correctly
        search: filters.search || undefined
      });
      
      if (roomsRes.success) {
        const rooms = roomsRes.data.rooms || [];
        
        // Filter to only process rooms that are actually rented or expiring
        const occupiedRooms = rooms.filter(room => 
          room.status === 'rented' || room.status === 'expiring'
        );
        
        // For each occupied room, get only ACTIVE tenants
        const roomsWithTenantsData = await Promise.all(
          occupiedRooms.map(async (room) => {
            try {
              const tenantsRes = await tenantsAPI.getTenantsByRoom(room._id, { status: 'active' });
              const tenants = tenantsRes.success ? (tenantsRes.data || []) : [];
              const tenantsArray = Array.isArray(tenants) ? tenants : (tenants ? [tenants] : []);
              
              return {
                id: room._id,
                name: room.roomNumber,
                status: room.status,
                price: room.price,
                area: room.area,
                capacity: room.capacity,
                description: room.description,
                tenants: tenantsArray,
                isOccupied: tenantsArray.length > 0
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

        // Filter to only rooms that have active tenants
        const filteredRooms = roomsWithTenantsData.filter(room => {
          const hasActiveTenants = room.tenants.some(tenant => tenant.status === 'active');
          return (room.status === 'rented' || room.status === 'expiring') && hasActiveTenants;
        });

        setRoomsWithTenants(filteredRooms);
        
        // Calculate pagination based on filtered rooms (rooms with tenants only)
        const totalFilteredRooms = filteredRooms.length;
        const totalPages = Math.ceil(totalFilteredRooms / pagination.itemsPerPage);
        
        setPagination(p => ({ 
          ...p, 
          totalItems: totalFilteredRooms, 
          totalPages: totalPages || 1 
        }));
      }
    } catch(e){ 
      console.error('Error fetching rooms with tenants:', e); 
    }
    finally { setLoading(false); }
  }, [filters, pagination.itemsPerPage]);

  useEffect(()=>{ fetchRoomsWithTenants(); }, [fetchRoomsWithTenants]);

  const fetchAvailableRooms = async () => {
    try {
      const res = await roomsAPI.getAllRooms({});
      if (res.success) {
        const allRooms = res.data.rooms || [];
        
        // CHỈ lấy phòng đang thuê hoặc sắp hết hạn (không lấy phòng available/reserved)
        const rentedRooms = allRooms.filter(room => 
          room.status === 'rented' || room.status === 'expiring'
        );
        
        // Lấy chỉ những tenant đang có hợp đồng hiệu lực (status: active)
        const roomsWithSlots = await Promise.all(
          rentedRooms.map(async (room) => {
            try {
              const tenantsRes = await tenantsAPI.getTenantsByRoom(room._id, { status: 'active' });
              const currentTenants = tenantsRes.success ? (Array.isArray(tenantsRes.data) ? tenantsRes.data : (tenantsRes.data ? [tenantsRes.data] : [])) : [];
              const currentCount = currentTenants.length;
              const capacity = room.capacity || 1;
              const availableSlots = capacity - currentCount;
              
              return {
                ...room,
                currentCount,
                availableSlots,
                hasSlots: availableSlots > 0
              };
            } catch (error) {
              console.error(`Error fetching tenants for room ${room.roomNumber}:`, error);
              // Nếu có lỗi, coi như phòng không có tenant và không hiển thị
              return null;
            }
          })
        );
        
        // CHỈ lấy phòng còn slot
        const roomsWithAvailableSlots = roomsWithSlots
          .filter(room => room !== null) // Loại bỏ room có lỗi
          .filter(room => room.hasSlots); // Phòng còn chỗ
        
        setAvailableRooms(roomsWithAvailableSlots);
      }
    } catch(e) {
      console.error('Error fetching available rooms:', e);
    }
  };

  const handleExportExcel = async () => {
    try {
      if (!window.XLSX) {
        showToast('error', 'Thư viện Excel chưa được tải');
        return;
      }

      showToast('info', 'Đang chuẩn bị dữ liệu xuất Excel...');

      // Fetch all rooms with tenants
      const roomsRes = await roomsAPI.getAllRooms({
        page: 1,
        limit: 1000
      });

      if (!roomsRes.success || !roomsRes.data.rooms) {
        showToast('error', 'Không thể lấy dữ liệu phòng');
        return;
      }

      const rooms = roomsRes.data.rooms || [];
      const occupiedRooms = rooms.filter(room => 
        room.status === 'rented' || room.status === 'expiring'
      );

      // Get all tenants from occupied rooms
      let allTenants = [];
      for (const room of occupiedRooms) {
        try {
          const tenantsRes = await tenantsAPI.getTenantsByRoom(room._id, { status: 'active' });
          const tenants = tenantsRes.success ? (tenantsRes.data || []) : [];
          const tenantsArray = Array.isArray(tenants) ? tenants : (tenants ? [tenants] : []);
          
          tenantsArray.forEach(tenant => {
            allTenants.push({
              ...tenant,
              roomNumber: room.roomNumber,
              roomPrice: room.price
            });
          });
        } catch (error) {
          console.error(`Error fetching tenants for room ${room.roomNumber}:`, error);
        }
      }

      if (allTenants.length === 0) {
        showToast('error', 'Không có khách thuê nào để xuất');
        return;
      }

      // Prepare export data
      const exportData = allTenants.map((tenant, index) => {
        // Get all image URLs
        const imageUrls = tenant.images && tenant.images.length > 0 
          ? tenant.images.join(', ') 
          : 'Không có hình';

        return {
          'STT': index + 1,
          'Họ và tên': tenant.fullName || '-',
          'Email': tenant.email || '-',
          'Số điện thoại': tenant.phone || '-',
          'CCCD/CMND': tenant.identificationNumber || '-',
          'Địa chỉ': tenant.address || '-',
          'Phòng': tenant.roomNumber || '-',
          'Giá thuê (VNĐ/tháng)': tenant.roomPrice ? tenant.roomPrice.toLocaleString('vi-VN') : '-',
          'Trạng thái': tenant.status === 'active' ? 'Đang thuê' : 
                       tenant.status === 'inactive' ? 'Không hoạt động' : 
                       tenant.status || '-',
          'Ngày tạo': tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString('vi-VN') : '-',
          'Link hình ảnh': imageUrls
        };
      });

      // Create worksheet
      const ws = window.XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 5 },   // STT
        { wch: 25 },  // Họ và tên
        { wch: 30 },  // Email
        { wch: 15 },  // Số điện thoại
        { wch: 15 },  // CCCD/CMND
        { wch: 35 },  // Địa chỉ
        { wch: 12 },  // Phòng
        { wch: 18 },  // Giá thuê
        { wch: 15 },  // Trạng thái
        { wch: 15 },  // Ngày tạo
        { wch: 60 }   // Hình ảnh URL
      ];
      ws['!cols'] = colWidths;

      // Set row heights for better image display
      ws['!rows'] = exportData.map(() => ({ hpt: 20 }));

      // Create workbook
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Danh sách khách thuê');

      // Generate filename with current date
      const today = new Date();
      const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
      const filename = `Danh_sach_khach_thue_${dateStr}.xlsx`;

      // Save file
      window.XLSX.writeFile(wb, filename);

      showToast('success', t('tenants.exportSuccess', 'Xuất Excel thành công!'));
    } catch (error) {
      console.error('Error exporting Excel:', error);
      showToast('error', t('tenants.exportError', 'Lỗi khi xuất Excel: ') + error.message);
    }
  };

  // Import Excel Functions
  const handleDownloadTemplate = async () => {
    try {
      if (!window.XLSX) {
        showToast('error', 'Thư viện Excel chưa được tải');
        return;
      }

      showToast('info', 'Đang tạo file template...');

      // Fetch rooms that are rented/expiring with available slots
      const roomsRes = await roomsAPI.getAllRooms({ page: 1, limit: 1000 });
      
      if (!roomsRes.success || !roomsRes.data.rooms) {
        showToast('error', 'Không thể lấy danh sách phòng');
        return;
      }

      const rooms = roomsRes.data.rooms || [];
      
      // Filter rooms with available slots
      const roomsWithSlots = [];
      for (const room of rooms) {
        if (room.status === 'rented' || room.status === 'expiring') {
          try {
            const tenantsRes = await tenantsAPI.getTenantsByRoom(room._id, { status: 'active' });
            const tenants = tenantsRes.success ? (tenantsRes.data || []) : [];
            const tenantsArray = Array.isArray(tenants) ? tenants : (tenants ? [tenants] : []);
            const currentTenantCount = tenantsArray.length;
            const availableSlots = (room.capacity || 1) - currentTenantCount;
            
            if (availableSlots > 0) {
              roomsWithSlots.push({
                roomNumber: room.roomNumber,
                capacity: room.capacity || 1,
                currentTenants: currentTenantCount,
                availableSlots: availableSlots,
                price: room.price
              });
            }
          } catch (error) {
            console.error(`Error checking room ${room.roomNumber}:`, error);
          }
        }
      }

      if (roomsWithSlots.length === 0) {
        showToast('warning', 'Không có phòng nào còn slot trống để thêm khách thuê');
        return;
      }

      // Create template data
      const templateData = [];
      
      // Add example rows - including multiple tenants for the same room to demonstrate
      roomsWithSlots.forEach((room, index) => {
        // First tenant for this room (example)
        templateData.push({
          'Phòng': room.roomNumber,
          'Slot còn trống': room.availableSlots,
          'Đang có': room.currentTenants,
          'Tổng sức chứa': room.capacity,
          'Giá thuê (VNĐ/tháng)': room.price ? room.price.toLocaleString('vi-VN') : '',
          'Họ và tên': index === 0 ? 'Nguyễn Văn A' : '',
          'Email': index === 0 ? 'nguyenvana@email.com' : '',
          'Số điện thoại': index === 0 ? '0912345678' : '',
          'CCCD/CMND': index === 0 ? '123456789' : '',
          'Địa chỉ': index === 0 ? '123 Đường ABC, Quận 1, TP.HCM' : ''
        });
        
        // Add second tenant example for first room to show multiple tenants can be added
        if (index === 0 && room.availableSlots >= 2) {
          templateData.push({
            'Phòng': room.roomNumber,
            'Slot còn trống': room.availableSlots,
            'Đang có': room.currentTenants,
            'Tổng sức chứa': room.capacity,
            'Giá thuê (VNĐ/tháng)': room.price ? room.price.toLocaleString('vi-VN') : '',
            'Họ và tên': 'Trần Thị B',
            'Email': 'tranthib@email.com',
            'Số điện thoại': '0987654321',
            'CCCD/CMND': '987654321',
            'Địa chỉ': '456 Đường XYZ, Quận 2, TP.HCM'
          });
        }
      });

      const ws = window.XLSX.utils.json_to_sheet(templateData);
      
      // Set column widths
      const colWidths = [
        { wch: 12 },  // Phòng
        { wch: 15 },  // Slot còn trống
        { wch: 12 },  // Đang có
        { wch: 15 },  // Tổng sức chứa
        { wch: 22 },  // Giá thuê
        { wch: 25 },  // Họ và tên
        { wch: 30 },  // Email
        { wch: 15 },  // Số điện thoại
        { wch: 15 },  // CCCD/CMND
        { wch: 35 }   // Địa chỉ
      ];
      ws['!cols'] = colWidths;

      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Danh sách phòng còn slot');

      const today = new Date();
      const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
      window.XLSX.writeFile(wb, `Mau_Import_Khach_Thue_${dateStr}.xlsx`);
      
      showToast('success', 'Tải file mẫu thành công!');
    } catch (error) {
      console.error('Error downloading template:', error);
      showToast('error', 'Lỗi khi tải file mẫu: ' + error.message);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (!validTypes.includes(file.type)) {
      showToast('error', 'Vui lòng chọn file Excel (.xlsx, .xls)');
      return;
    }

    setImportFile(file);
    readExcelFile(file);
  };

  const readExcelFile = async (file) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = window.XLSX.utils.sheet_to_json(firstSheet);

        // Fetch available rooms to validate
        const roomsRes = await roomsAPI.getAllRooms({ page: 1, limit: 1000 });
        const rooms = roomsRes.success ? (roomsRes.data.rooms || []) : [];
        
        // Get room capacity and current tenant count
        const roomInfoMap = new Map();
        for (const room of rooms) {
          if (room.status === 'rented' || room.status === 'expiring') {
            try {
              const tenantsRes = await tenantsAPI.getTenantsByRoom(room._id, { status: 'active' });
              const tenants = tenantsRes.success ? (tenantsRes.data || []) : [];
              const tenantsArray = Array.isArray(tenants) ? tenants : (tenants ? [tenants] : []);
              
              roomInfoMap.set(room.roomNumber, {
                roomId: room._id,
                capacity: room.capacity || 1,
                currentTenants: tenantsArray.length,
                availableSlots: (room.capacity || 1) - tenantsArray.length,
                price: room.price || 0 // Add price to roomInfoMap
              });
            } catch (error) {
              console.error(`Error getting tenants for room ${room.roomNumber}:`, error);
            }
          }
        }

        // Transform and validate data
        const transformedData = jsonData.map((row, index) => {
          const roomNumber = row['Phòng']?.toString().trim() || '';
          const roomInfo = roomInfoMap.get(roomNumber);
          const errors = [];

          // Validate required fields
          if (!roomNumber) errors.push('Thiếu tên phòng');
          if (!row['Họ và tên']) errors.push('Thiếu họ và tên');
          if (!row['Email']) errors.push('Thiếu email');
          if (!row['Số điện thoại']) errors.push('Thiếu số điện thoại');
          if (!row['CCCD/CMND']) errors.push('Thiếu CCCD/CMND');

          // Validate room exists
          if (roomNumber && !roomInfo) {
            errors.push('Phòng không tồn tại hoặc không có slot trống');
          }

          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (row['Email'] && !emailRegex.test(row['Email'])) {
            errors.push('Email không hợp lệ');
          }

          // Validate phone format
          const phoneRegex = /^[0-9]{10,11}$/;
          if (row['Số điện thoại'] && !phoneRegex.test(row['Số điện thoại'].toString().replace(/[^0-9]/g, ''))) {
            errors.push('Số điện thoại không hợp lệ');
          }

          return {
            id: `temp-${index}`,
            roomNumber: roomNumber,
            roomId: roomInfo?.roomId || '',
            fullName: row['Họ và tên'] || '',
            email: row['Email'] || '',
            phone: row['Số điện thoại']?.toString() || '',
            identificationNumber: row['CCCD/CMND']?.toString() || '',
            address: row['Địa chỉ'] || '',
            rentPrice: roomInfo?.price || 0, // Get rent price from room info
            availableSlots: roomInfo?.availableSlots || 0,
            currentTenants: roomInfo?.currentTenants || 0,
            capacity: roomInfo?.capacity || 0,
            isValid: errors.length === 0,
            errors
          };
        });

        // Second pass: Check for multiple tenants in same room and adjust slot validation
        const roomTenantCount = new Map(); // Track how many tenants being added to each room
        
        transformedData.forEach((tenant, index) => {
          if (tenant.roomNumber) {
            const count = roomTenantCount.get(tenant.roomNumber) || 0;
            roomTenantCount.set(tenant.roomNumber, count + 1);
            
            const roomInfo = roomInfoMap.get(tenant.roomNumber);
            if (roomInfo) {
              const totalTenantsAfterImport = roomInfo.currentTenants + count + 1;
              const remainingSlots = roomInfo.availableSlots - count;
              
              // Update availableSlots for display
              tenant.availableSlots = remainingSlots;
              
              // Check if this tenant would exceed capacity
              if (totalTenantsAfterImport > roomInfo.capacity) {
                if (!tenant.errors.includes('Phòng đã hết slot trống')) {
                  tenant.errors.push(`Phòng đã hết slot (đã có ${roomInfo.currentTenants}, đang thêm ${count + 1}/${roomInfo.capacity})`);
                  tenant.isValid = false;
                }
              }
            }
          }
        });

        setImportData(transformedData);
        showToast('success', `Đọc được ${transformedData.length} khách thuê từ file Excel`);
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

  const handleEditImportRow = (index, field, value) => {
    setImportData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // Re-validate the row
      const errors = [];
      const row = updated[index];
      
      if (!row.roomNumber) errors.push('Thiếu tên phòng');
      if (!row.fullName) errors.push('Thiếu họ và tên');
      if (!row.email) errors.push('Thiếu email');
      if (!row.phone) errors.push('Thiếu số điện thoại');
      if (!row.identificationNumber) errors.push('Thiếu CCCD/CMND');
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (row.email && !emailRegex.test(row.email)) {
        errors.push('Email không hợp lệ');
      }
      
      const phoneRegex = /^[0-9]{10,11}$/;
      if (row.phone && !phoneRegex.test(row.phone.toString().replace(/[^0-9]/g, ''))) {
        errors.push('Số điện thoại không hợp lệ');
      }
      
      updated[index].isValid = errors.length === 0;
      updated[index].errors = errors;
      
      return updated;
    });
  };

  const handleImportTenants = async () => {
    try {
      const validTenants = importData.filter(t => t.isValid);
      
      if (validTenants.length === 0) {
        showToast('error', 'Không có khách thuê hợp lệ để import');
        return;
      }

      if (importData.some(t => !t.isValid)) {
        showToast('warning', t('rooms.invalidRowsWarning', 'Có một số dòng không hợp lệ. Hãy sửa dữ liệu trực tiếp trên bảng để có thể import.'));
        return;
      }

      setImportLoading(true);

      let successCount = 0;
      let failCount = 0;
      const errors = [];

      for (const tenant of validTenants) {
        try {
          // Get current date for leaseStart
          const today = new Date();
          const leaseStart = today.toISOString().split('T')[0]; // YYYY-MM-DD format
          
          // Calculate leaseEnd (1 year from now)
          const leaseEndDate = new Date(today);
          leaseEndDate.setFullYear(leaseEndDate.getFullYear() + 1);
          const leaseEnd = leaseEndDate.toISOString().split('T')[0];
          
          const payload = {
            fullName: tenant.fullName,
            email: tenant.email,
            phone: tenant.phone,
            identificationNumber: tenant.identificationNumber,
            address: tenant.address,
            room: tenant.roomId, // Backend expects 'room' not 'roomId'
            leaseStart: leaseStart, // Required field
            leaseEnd: leaseEnd, // Optional but good to have
            rentPrice: tenant.rentPrice || 0, // Use rent price from room data
            deposit: 0, // Optional
            role: 'tenant',
            status: 'active'
          };

          const res = await tenantsAPI.createTenant(payload);
          if (res.success) {
            successCount++;
          } else {
            failCount++;
            errors.push(`${tenant.fullName}: ${res.message || 'Lỗi không xác định'}`);
          }
        } catch (error) {
          failCount++;
          const errorMsg = error.response?.data?.message || error.message;
          errors.push(`${tenant.fullName}: ${errorMsg}`);
        }
      }

      // Show results
      if (successCount > 0) {
        showToast('success', `Import thành công ${successCount} khách thuê!`);
        fetchRoomsWithTenants();
        setShowImportModal(false);
        setImportFile(null);
        setImportData([]);
      }
      
      if (failCount > 0) {
        showToast('error', `Có ${failCount} khách thuê không thể import.`);
      }
    } catch (error) {
      showToast('error', 'Lỗi khi import khách thuê: ' + error.message);
    } finally {
      setImportLoading(false);
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
      
      const tenantsRes = await tenantsAPI.getTenantsByRoom(roomId, { status: 'active' });
      const activeTenants = tenantsRes.success ? (Array.isArray(tenantsRes.data) ? tenantsRes.data : []) : [];
      
      if (activeTenants.length <= 1) {
        showToast('error', 'Không thể xóa! Phòng phải có ít nhất 1 khách thuê. Nếu muốn xóa, vui lòng kết thúc hợp đồng.');
        setUpdating(false);
        return;
      }
      
      // Hiển thị confirm dialog
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

  // Filter displayed rooms based on current filters
  const filteredRooms = roomsWithTenants.filter(room => {
    // Filter by status tab
    if (filters.status && room.status !== filters.status) return false;
    
    // Filter by search term
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      const roomMatch = room.name.toLowerCase().includes(searchTerm);
      const tenantMatch = room.tenants.some(tenant => 
        tenant.fullName?.toLowerCase().includes(searchTerm) ||
        tenant.phone?.toLowerCase().includes(searchTerm) ||
        tenant.email?.toLowerCase().includes(searchTerm)
      );
      if (!roomMatch && !tenantMatch) return false;
    }
    
    return true;
  });

  // Apply client-side pagination to filtered rooms
  const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
  const endIndex = startIndex + pagination.itemsPerPage;
  const displayedRooms = filteredRooms.slice(startIndex, endIndex);

  // Update pagination when filters change
  useEffect(() => {
    const totalPages = Math.ceil(filteredRooms.length / pagination.itemsPerPage);
    setPagination(p => ({ 
      ...p, 
      totalItems: filteredRooms.length, 
      totalPages: totalPages || 1,
      // Reset to page 1 if current page exceeds total pages
      currentPage: p.currentPage > totalPages ? 1 : p.currentPage
    }));
  }, [filteredRooms.length, pagination.itemsPerPage]);

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
    <div className="tenants-container">
      <SideBar />
      <div className="tenants-content">
        {/* Header */}
        <div className="tenants-header">
          <h1 className="tenants-title">{t('tenants.title')}</h1>
          
          {/* Search Bar */}
          <div className="search-container">
            <div className="search-input-wrapper">
              <i className="fas fa-search search-icon"></i>
              <input
                type="text"
                className="search-input"
                placeholder={t('tenants.searchPlaceholder', 'Tìm kiếm khách thuê...')}
                value={filters.search}
                onChange={e => {
                  setFilters(f => ({...f, search: e.target.value}));
                  setPagination(p => ({...p, currentPage: 1}));
                }}
              />
              {filters.search && (
                <button 
                  className="clear-search-btn"
                  onClick={() => setFilters(f => ({...f, search: ''}))}
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="status-tabs">
          <button
            className={`status-tab ${filters.status === '' ? 'active' : ''}`}
            onClick={() => {
              setFilters(f => ({...f, status: ''}));
              setPagination(prev => ({ ...prev, currentPage: 1 }));
            }}
          >
            Tất cả
            <span className="tab-count">{roomsWithTenants.length}</span>
          </button>
          <button
            className={`status-tab ${filters.status === 'rented' ? 'active' : ''}`}
            onClick={() => {
              setFilters(f => ({...f, status: 'rented'}));
              setPagination(prev => ({ ...prev, currentPage: 1 }));
            }}
          >
            Đang thuê
            <span className="tab-count">{roomsWithTenants.filter(r => r.status === 'rented').length}</span>
          </button>
          <button
            className={`status-tab ${filters.status === 'expiring' ? 'active' : ''}`}
            onClick={() => {
              setFilters(f => ({...f, status: 'expiring'}));
              setPagination(prev => ({ ...prev, currentPage: 1 }));
            }}
          >
            Sắp hết hạn
            <span className="tab-count">{roomsWithTenants.filter(r => r.status === 'expiring').length}</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="tenants-actions">
          <button className="action-btn primary" onClick={openCreate}>
            <i className="fas fa-user-plus"></i>
            {t('tenants.addNew', 'Thêm khách thuê mới')}
          </button>
          <button className="action-btn" onClick={() => setShowImportModal(true)}>
            <i className="fas fa-file-import"></i>
            {t('tenants.importExcel', 'Import Excel')}
          </button>
          <button className="action-btn" onClick={handleExportExcel}>
            <i className="fas fa-file-excel"></i>
            {t('tenants.exportExcel', 'Xuất Excel')}
          </button>
        </div>

        {loading ? (
          <div className="loading-container"><div className="loading-spinner" /> <p>{t('common.loading')}</p></div>
        ) : displayedRooms.length === 0 ? (
          <div className="empty-container">
            <div className="empty-icon">👥</div>
            <h3 className="empty-text">{filters.search || filters.status ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có phòng nào có khách thuê'}</h3>
            <p className="empty-description">{filters.search || filters.status ? 'Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm' : 'Hiện tại chưa có phòng nào có khách thuê. Hãy thêm khách thuê vào các phòng trống để quản lý.'}</p>
          </div>
        ) : (
          <div className="tenants-grid">
            {displayedRooms.map(room => (
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
                    {room.tenants.filter(tenant => tenant.status === 'active').length}/{room.capacity}
                  </span>
                </div>

                {/* Tenants List */}
                <div className="tenant-room-content">
                  {room.tenants.filter(tenant => tenant.status === 'active').length === 0 ? (
                    <div className="tenant-empty-state">
                      <span>Chưa có khách thuê</span>
                    </div>
                  ) : (
                    <div className="tenant-list">
                      {room.tenants.filter(tenant => tenant.status === 'active').map(tenant => (
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

        {/* Pagination */}
        {filteredRooms.length > 0 && pagination.totalPages > 1 && (
          <div className="pagination">
            {/* Pagination Info */}
            <div className="pagination-info">
              <span className="pagination-text">
                {t('tenants.pagination.page', 'Trang')} {pagination.currentPage} / {pagination.totalPages} 
                ({pagination.totalItems} {t('tenants.pagination.rooms', 'phòng')})
              </span>
            </div>

            <div className="pagination-controls">
              {/* First Page Button */}
              <button
                className="pagination-btn"
                disabled={pagination.currentPage === 1}
                onClick={() => setPagination(p => ({ ...p, currentPage: 1 }))}
                title={t('tenants.pagination.firstPage', 'Trang đầu')}
              >
                <i className="fas fa-angle-double-left" />
              </button>

              {/* Previous Page Button */}
              <button
                className="pagination-btn"
                disabled={pagination.currentPage === 1}
                onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage - 1 }))}
                title={t('tenants.pagination.previousPage', 'Trang trước')}
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
                      title={`${t('tenants.pagination.page', 'Trang')} ${page}`}
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
                title={t('tenants.pagination.nextPage', 'Trang sau')}
              >
                <i className="fas fa-chevron-right" />
              </button>

              {/* Last Page Button */}
              <button
                className="pagination-btn"
                disabled={pagination.currentPage === pagination.totalPages}
                onClick={() => setPagination(p => ({ ...p, currentPage: pagination.totalPages }))}
                title={t('tenants.pagination.lastPage', 'Trang cuối')}
              >
                <i className="fas fa-angle-double-right" />
              </button>
            </div>
          </div>
        )}

        {/* Fallback pagination info nếu chỉ có 1 trang */}
        {filteredRooms.length > 0 && pagination.totalPages <= 1 && (
          <div style={{textAlign: 'center', padding: '20px', color: '#666'}}>
            {t('tenants.pagination.allShown', 'Tất cả')} {pagination.totalItems} {t('tenants.pagination.rooms', 'phòng')} {t('tenants.pagination.displayed', 'đã được hiển thị')}
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
                      <option disabled>Không có phòng nào còn chỗ trống (chỉ hiển thị phòng đã thuê và còn slot)</option>
                    ) : (
                      availableRooms.map(room => (
                        <option key={room._id} value={room._id}>
                          Phòng {room.roomNumber} - Đang có {room.currentCount}/{room.capacity} người (Còn {room.availableSlots} chỗ)
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

      {/* Import Modal */}
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
                <i className="fas fa-file-import"></i> {t('tenants.importExcel', 'Import Excel')}
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
              {/* Template Download */}
              <div className="import-top-section">
                <div className="template-download-area">
                  <button className="template-download-btn" onClick={handleDownloadTemplate}>
                    <i className="fas fa-download"></i>
                    {t('tenants.downloadTemplate', 'Tải file mẫu')}
                  </button>
                </div>
                <p className="import-hint">
                  <i className="fas fa-info-circle"></i>
                  {t('tenants.templateHint', 'Tải file mẫu để xem danh sách phòng còn slot và định dạng dữ liệu cần import')}
                </p>
                <p className="import-hint" style={{ marginTop: '8px', background: '#f0fdf4', borderLeftColor: '#10b981', color: '#065f46' }}>
                  <i className="fas fa-users" style={{ color: '#10b981' }}></i>
                  <span>
                    <strong>Mẹo:</strong> Bạn có thể thêm nhiều khách thuê vào cùng 1 phòng bằng cách thêm nhiều dòng với cùng tên phòng. 
                    Hệ thống sẽ tự động kiểm tra và trừ dần số slot còn trống.
                  </span>
                </p>
              </div>

              {/* File Upload */}
              <div className="import-section">
                <label className="file-upload-label">
                  <i className="fas fa-file-excel"></i>
                  {t('tenants.selectFile', 'Chọn file Excel')}
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="file-input"
                  id="tenant-excel-file-input"
                  disabled={importLoading}
                />
                <label htmlFor="tenant-excel-file-input" className="file-input-btn">
                  <i className="fas fa-upload"></i>
                  {importFile ? importFile.name : t('tenants.chooseFile', 'Chọn file...')}
                </label>
              </div>

              {/* Data Preview */}
              {importData.length > 0 && (
                <div className="import-section">
                  <h4 className="preview-title">
                    <i className="fas fa-table"></i>
                    {t('tenants.dataPreview', 'Xem trước dữ liệu')} ({importData.length} khách thuê)
                  </h4>
                  <div className="import-data-grid">
                    <table className="import-table">
                      <thead>
                        <tr>
                          <th>STT</th>
                          <th>Phòng</th>
                          <th>Slot</th>
                          <th>Họ và tên</th>
                          <th>Email</th>
                          <th>Số điện thoại</th>
                          <th>CCCD/CMND</th>
                          <th>Địa chỉ</th>
                          <th>Hợp lệ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importData.map((tenant, index) => (
                          <tr key={tenant.id} className={!tenant.isValid ? 'invalid-row' : ''}>
                            <td>{index + 1}</td>
                            <td>
                              <input
                                type="text"
                                className="editable-cell"
                                value={tenant.roomNumber}
                                onChange={(e) => handleEditImportRow(index, 'roomNumber', e.target.value)}
                                placeholder="Phòng"
                                disabled
                              />
                            </td>
                            <td className="slot-info">
                              {tenant.availableSlots > 0 ? (
                                <span className="slot-available">{tenant.availableSlots} trống</span>
                              ) : (
                                <span className="slot-full">Hết slot</span>
                              )}
                            </td>
                            <td>
                              <input
                                type="text"
                                className="editable-cell"
                                value={tenant.fullName}
                                onChange={(e) => handleEditImportRow(index, 'fullName', e.target.value)}
                                placeholder="Họ và tên"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="editable-cell"
                                value={tenant.email}
                                onChange={(e) => handleEditImportRow(index, 'email', e.target.value)}
                                placeholder="Email"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="editable-cell"
                                value={tenant.phone}
                                onChange={(e) => handleEditImportRow(index, 'phone', e.target.value)}
                                placeholder="Số điện thoại"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="editable-cell"
                                value={tenant.identificationNumber}
                                onChange={(e) => handleEditImportRow(index, 'identificationNumber', e.target.value)}
                                placeholder="CCCD/CMND"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="editable-cell"
                                value={tenant.address}
                                onChange={(e) => handleEditImportRow(index, 'address', e.target.value)}
                                placeholder="Địa chỉ"
                              />
                            </td>
                            <td className="validation-cell">
                              {tenant.isValid ? (
                                <span className="valid-badge">
                                  <i className="fas fa-check-circle"></i> Hợp lệ
                                </span>
                              ) : (
                                <span className="invalid-badge" title={tenant.errors.join(', ')}>
                                  <i className="fas fa-exclamation-circle"></i> Lỗi
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Import Summary */}
                  <div className="import-summary">
                    <div className="summary-item">
                      <span className="summary-label">{t('tenants.totalRecords', 'Tổng số')}:</span>
                      <span className="summary-value">{importData.length}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">{t('tenants.validRecords', 'Hợp lệ')}:</span>
                      <span className="summary-value valid">{importData.filter(t => t.isValid).length}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">{t('tenants.invalidRecords', 'Không hợp lệ')}:</span>
                      <span className="summary-value invalid">{importData.filter(t => !t.isValid).length}</span>
                    </div>
                  </div>

                  {importData.some(t => !t.isValid) && (
                    <div className="import-warning">
                      <i className="fas fa-exclamation-triangle"></i>
                      {t('tenants.invalidWarning', 'Có một số bản ghi không hợp lệ. Hãy sửa dữ liệu trực tiếp trên bảng để có thể import.')}
                    </div>
                  )}
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
                onClick={handleImportTenants}
                disabled={importLoading || importData.length === 0 || importData.every(t => !t.isValid)}
              >
                {importLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    {t('tenants.importing', 'Đang import...')}
                  </>
                ) : (
                  <>
                    <i className="fas fa-file-import"></i>
                    {t('tenants.import', 'Import')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TenantsManagement;
