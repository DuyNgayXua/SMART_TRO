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
  const [filters, setFilters] = useState({ status:'active', search:'' });
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
  
  // Print contract states
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedContractsToPrint, setSelectedContractsToPrint] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  
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
        

      }
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }, [activeTab, filters, pagination.currentPage, pagination.itemsPerPage]);

  // Separate function to fetch status counts
  const fetchStatusCounts = useCallback(async () => {
    try {
      if (activeTab === 'rental') {
        const params = { search: filters.search || undefined };
        const allRes = await contractsAPI.searchContracts(params);
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
      } else if (activeTab === 'deposit') {
        const params = { search: filters.search || undefined };
        const allRes = await depositContractsAPI.getDepositContracts(params);
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
      }
    } catch (e) { 
      console.error('Error fetching status counts:', e); 
    }
  }, [activeTab, filters.search]);

  useEffect(()=>{ fetchContracts(); }, [fetchContracts]);
  useEffect(()=>{ fetchStatusCounts(); }, [fetchStatusCounts]);
  
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

  // Print contract functions
  const handlePrintContract = () => {
    setSelectedContractsToPrint([]);
    setSelectAll(false);
    setShowPrintModal(true);
  };

  const handleToggleSelectContract = (contractId) => {
    setSelectedContractsToPrint(prev => {
      if (prev.includes(contractId)) {
        return prev.filter(id => id !== contractId);
      } else {
        return [...prev, contractId];
      }
    });
  };

  const handleSelectAllContracts = () => {
    if (selectAll) {
      setSelectedContractsToPrint([]);
    } else {
      setSelectedContractsToPrint(contracts.map(c => c.id));
    }
    setSelectAll(!selectAll);
  };

  const handleConfirmPrint = async () => {
    if (selectedContractsToPrint.length === 0) {
      alert('Vui lòng chọn ít nhất 1 hợp đồng để tải');
      return;
    }

    // Fetch full details for selected contracts
    const contractDetailPromises = selectedContractsToPrint.map(id => 
      contractsAPI.getContractById(id)
    );

    try {
      const responses = await Promise.all(contractDetailPromises);
      const contractDetails = responses
        .filter(res => res.success && res.data)
        .map(res => res.data);

      // Generate Word documents (one file per contract)
      for (const contract of contractDetails) {
        await generateWordDocument(contract);
      }
      
      setShowPrintModal(false);
      alert(`Đã tải xuống ${contractDetails.length} file hợp đồng`);
    } catch (error) {
      console.error('Error fetching contract details:', error);
      alert('Có lỗi khi tải thông tin hợp đồng');
    }
  };

  const generateWordDocument = async (contract) => {
    if (!window.docx || !window.saveAs) {
      alert('Thư viện tạo file Word chưa được tải. Vui lòng tải lại trang.');
      return;
    }

    const { Document, Paragraph, TextRun, AlignmentType, HeadingLevel } = window.docx;

    try {
      const tenantsList = (contract.tenants || [])
        .map((t, idx) => `${idx + 1}. Họ và tên: ${t.fullName || ''}, CMND/CCCD: ${t.identificationNumber || ''}, ĐT: ${t.phone || ''}`)
        .join('\n');

      const vehiclesList = (contract.vehicles || [])
        .map((v, idx) => `${idx + 1}. Loại xe: ${v.vehicleType || ''}, Biển số: ${v.licensePlate || ''}`)
        .join('\n');

      const contractDate = new Date(contract.startDate);
      const endDate = new Date(contract.endDate);

      const sectionChildren = [
          // Header
          new Paragraph({
            text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            style: 'Heading1'
          }),
          new Paragraph({
            text: "Độc lập - Tự do - Hạnh phúc",
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "***",
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 }
          }),

          // Title
          new Paragraph({
            text: "HỢP ĐỒNG THUÊ PHÒNG TRỌ",
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: `Số: HD-${contract.room?.roomNumber || 'XX'}-${contractDate.getFullYear()}`,
            alignment: AlignmentType.CENTER,
            italics: true,
            spacing: { after: 300 }
          }),

          // Opening
          new Paragraph({
            children: [
              new TextRun({ text: "- Căn cứ Bộ luật Dân sự năm 2015;", bold: true })
            ],
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "- Căn cứ vào nhu cầu và khả năng của các bên tham gia hợp đồng;", bold: true })
            ],
            spacing: { after: 200 }
          }),
          new Paragraph({
            children: [
              new TextRun({ 
                text: `Hôm nay, ngày ${contractDate.getDate()} tháng ${contractDate.getMonth() + 1} năm ${contractDate.getFullYear()}, chúng tôi gồm:`, 
                bold: true 
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 }
          }),

          // Party A
          new Paragraph({
            text: "BÊN CHO THUÊ (Bên A):",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Họ và tên: ", bold: true }),
              new TextRun(contract.landlord?.fullName || '[Tên chủ trọ]')
            ],
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "CMND/CCCD: ", bold: true }),
              new TextRun(contract.landlord?.identificationNumber || '[CMND chủ trọ]')
            ],
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Số điện thoại: ", bold: true }),
              new TextRun(contract.landlord?.phone || '[SĐT chủ trọ]')
            ],
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Địa chỉ thường trú: ", bold: true }),
              new TextRun(contract.landlord?.address || '[Địa chỉ chủ trọ]')
            ],
            spacing: { after: 300 }
          }),

          // Party B
          new Paragraph({
            text: "BÊN THUÊ (Bên B):",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: tenantsList || '[Thông tin người thuê]',
            spacing: { after: 300 }
          }),

          // Main terms
          new Paragraph({
            text: "HAI BÊN THỎA THUẬN KÝ KẾT HỢP ĐỒNG VỚI CÁC ĐIỀU KHOẢN SAU:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 300 }
          }),

          // Article 1
          new Paragraph({
            text: "Điều 1: Đối tượng và nội dung của hợp đồng",
            heading: HeadingLevel.HEADING_3,
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "1.1. ", bold: true }),
              new TextRun("Bên A đồng ý cho Bên B thuê phòng trọ tại:")
            ],
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Địa chỉ: ", bold: true }),
              new TextRun(`Phòng số ${contract.room?.roomNumber || '[Số phòng]'}`)
            ],
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "1.2. ", bold: true }),
              new TextRun(`Diện tích phòng: ${contract.room?.size || '[Diện tích]'} m²`)
            ],
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "1.3. ", bold: true }),
              new TextRun(`Trang thiết bị kèm theo: ${
                (contract.room?.amenities && Array.isArray(contract.room.amenities))
                  ? contract.room.amenities.map(a => a.name || a).join(', ')
                  : '[Danh sách trang thiết bị]'
              }`)
            ],
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "1.4. ", bold: true }),
              new TextRun("Mục đích sử dụng: Để ở")
            ],
            spacing: { after: 300 }
          }),

          // Article 2
          new Paragraph({
            text: "Điều 2: Thời hạn hợp đồng",
            heading: HeadingLevel.HEADING_3,
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "2.1. ", bold: true }),
              new TextRun(`Thời hạn thuê: Từ ngày ${contractDate.toLocaleDateString('vi-VN')} đến ngày ${endDate.toLocaleDateString('vi-VN')}`)
            ],
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "2.2. ", bold: true }),
              new TextRun("Khi hết hạn hợp đồng, nếu Bên B có nhu cầu thuê tiếp, hai bên sẽ tiến hành ký hợp đồng mới.")
            ],
            spacing: { after: 300 }
          }),

          // Article 3
          new Paragraph({
            text: "Điều 3: Giá thuê và phương thức thanh toán",
            heading: HeadingLevel.HEADING_3,
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "3.1. ", bold: true }),
              new TextRun(`Giá thuê phòng: ${formatNumber(contract.monthlyRent || 0)} VNĐ/tháng`)
            ],
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "3.2. ", bold: true }),
              new TextRun(`Tiền đặt cọc: ${formatNumber(contract.deposit || 0)} VNĐ`)
            ],
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "Số tiền đặt cọc sẽ được hoàn trả khi kết thúc hợp đồng nếu Bên B không vi phạm các điều khoản trong hợp đồng.",
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "3.3. ", bold: true }),
              new TextRun("Các khoản phí khác:")
            ],
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: `- Tiền điện: ${formatNumber(contract.electricPrice || 0)} VNĐ/kWh`,
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: `- Tiền nước: ${contract.waterChargeType === 'per_person' 
              ? `${formatNumber(contract.waterPricePerPerson || 0)} VNĐ/người/tháng`
              : `${formatNumber(contract.waterPrice || 0)} VNĐ/khối`
            }`,
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: `- Phí dịch vụ (rác, internet, v.v.): ${formatNumber(contract.servicePrice || 0)} VNĐ/tháng`,
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "3.4. ", bold: true }),
              new TextRun(`Phương thức thanh toán: Bên B thanh toán tiền thuê phòng ${contract.paymentCycle === 'monthly' ? 'hàng tháng' : 'theo chu kỳ'} vào đầu tháng.`)
            ],
            spacing: { after: 300 }
          }),

          // Article 4
          new Paragraph({
            text: "Điều 4: Nghĩa vụ của Bên A",
            heading: HeadingLevel.HEADING_3,
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "- Giao phòng cho Bên B đúng thời hạn và theo đúng hiện trạng như đã thỏa thuận;",
            spacing: { after: 50 }
          }),
          new Paragraph({
            text: "- Đảm bảo các trang thiết bị trong phòng hoạt động tốt;",
            spacing: { after: 50 }
          }),
          new Paragraph({
            text: "- Giữ gìn an ninh trật tự chung của khu vực;",
            spacing: { after: 50 }
          }),
          new Paragraph({
            text: "- Không được tùy tiện tăng giá thuê trong thời gian hợp đồng còn hiệu lực;",
            spacing: { after: 50 }
          }),
          new Paragraph({
            text: "- Không được vào phòng của Bên B khi không có sự đồng ý.",
            spacing: { after: 300 }
          }),

          // Article 5
          new Paragraph({
            text: "Điều 5: Nghĩa vụ của Bên B",
            heading: HeadingLevel.HEADING_3,
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "- Thanh toán đầy đủ và đúng hạn các khoản tiền theo thỏa thuận;",
            spacing: { after: 50 }
          }),
          new Paragraph({
            text: "- Giữ gìn vệ sinh chung, không gây ồn ào ảnh hưởng đến người xung quanh;",
            spacing: { after: 50 }
          }),
          new Paragraph({
            text: "- Chấp hành đúng các quy định về PCCC và an ninh trật tự;",
            spacing: { after: 50 }
          }),
          new Paragraph({
            text: "- Bảo quản tài sản trong phòng, nếu có hư hỏng do lỗi của Bên B thì phải bồi thường;",
            spacing: { after: 50 }
          }),
          new Paragraph({
            text: "- Không được tự ý sửa chữa, cải tạo phòng trọ khi chưa có sự đồng ý của Bên A;",
            spacing: { after: 50 }
          }),
          new Paragraph({
            text: "- Báo trước cho Bên A ít nhất 30 ngày nếu muốn chấm dứt hợp đồng;",
            spacing: { after: 50 }
          }),
          new Paragraph({
            text: "- Giao lại phòng cho Bên A trong tình trạng ban đầu (trừ hao mòn tự nhiên).",
            spacing: { after: 300 }
          }),
        ];

        // Add vehicle section if exists
        if (vehiclesList) {
          sectionChildren.push(
            new Paragraph({
              text: "Điều 6: Phương tiện gửi xe",
              heading: HeadingLevel.HEADING_3,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: "Bên B đăng ký gửi các phương tiện sau:",
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: vehiclesList,
              spacing: { after: 300 }
            })
          );
        }

        // Termination clause
        const articleNum = vehiclesList ? '7' : '6';
        sectionChildren.push(
          new Paragraph({
            text: `Điều ${articleNum}: Điều khoản chấm dứt hợp đồng`,
            heading: HeadingLevel.HEADING_3,
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `${articleNum}.1. `, bold: true }),
              new TextRun("Hợp đồng chấm dứt khi hết thời hạn hoặc hai bên thỏa thuận chấm dứt trước thời hạn.")
            ],
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `${articleNum}.2. `, bold: true }),
              new TextRun("Một trong hai bên có quyền đơn phương chấm dứt hợp đồng nếu bên kia vi phạm nghiêm trọng các điều khoản đã thỏa thuận.")
            ],
            spacing: { after: 300 }
          })
        );

        // Other terms
        const finalArticleNum = vehiclesList ? '8' : '7';
        sectionChildren.push(
          new Paragraph({
            text: `Điều ${finalArticleNum}: Điều khoản khác`,
            heading: HeadingLevel.HEADING_3,
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "Mọi tranh chấp phát sinh sẽ được hai bên giải quyết trên tinh thần thương lượng, hòa giải. Nếu không thỏa thuận được thì sẽ đưa ra Tòa án nhân dân có thẩm quyền để giải quyết.",
            spacing: { after: 100 }
          })
        );

        if (contract.notes) {
          sectionChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: "Ghi chú: ", bold: true }),
                new TextRun(contract.notes)
              ],
              spacing: { after: 300 }
            })
          );
        }

        // Signatures
        sectionChildren.push(
          new Paragraph({
            text: "",
            spacing: { after: 500 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "BÊN CHO THUÊ", bold: true }),
              new TextRun("\t\t\t\t"),
              new TextRun({ text: "BÊN THUÊ", bold: true })
            ],
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "(Ký và ghi rõ họ tên)", italics: true }),
              new TextRun("\t\t\t"),
              new TextRun({ text: "(Ký và ghi rõ họ tên)", italics: true })
            ],
            spacing: { after: 400 }
          }),
          new Paragraph({
            children: [
              new TextRun(contract.landlord?.fullName || '[Tên chủ trọ]'),
              new TextRun("\t\t\t\t"),
              new TextRun((contract.tenants && contract.tenants[0]?.fullName) || '[Tên người thuê]')
            ]
          })
        );

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
            }
          },
          children: sectionChildren
        }]
      });

      const blob = await window.docx.Packer.toBlob(doc);
      const fileName = `Hop_Dong_${contract.room?.roomNumber || 'Contract'}.docx`;
      
      window.saveAs(blob, fileName);
    } catch (error) {
      console.error('Error generating Word document:', error);
      alert('Có lỗi khi tạo file Word: ' + error.message);
    }
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

  const getPaginationRange = () => {
    const delta = 2;
    const range = [];
    const left = Math.max(2, pagination.currentPage - delta);
    const right = Math.min(pagination.totalPages - 1, pagination.currentPage + delta);

    // Always show first page
    range.push(1);

    // Add dots if needed before current range
    if (left > 2) {
      range.push('...');
    }

    // Add pages around current page
    for (let i = left; i <= right; i++) {
      range.push(i);
    }

    // Add dots if needed after current range
    if (right < pagination.totalPages - 1) {
      range.push('...');
    }

    // Always show last page if more than 1 page
    if (pagination.totalPages > 1) {
      range.push(pagination.totalPages);
    }

    // Remove duplicates while preserving order
    return range.filter((v, i, a) => a.indexOf(v) === i);
  };

  return (
    <div className="contracts-container">
      <SideBar />
      <div className="contracts-content">
        {/* Header */}
        <div className="contracts-header">
          <h1 className="contracts-title">{t('contracts.title')}</h1>
          
          {/* Search Bar */}
          <div className="search-container">
            <div className="search-input-wrapper">
              <i className="fas fa-search search-icon"></i>
              <input
                type="text"
                className="search-input"
                placeholder={t('contracts.searchPlaceholder', 'Tìm kiếm hợp đồng...')}
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

        {/* Contract Type Tabs */}
        <div className="contract-tabs">
          <button 
            className={`tab-btn ${activeTab === 'rental' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('rental');
              setPagination(p => ({ ...p, currentPage: 1 }));
              setFilters({ status: 'active', search: filters.search });
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
              setFilters({ status: 'active', search: filters.search });
              setStatusCounts({ all: 0, active: 0, pending: 0, expired: 0, terminated: 0 });
            }}
          >
            <i className="fas fa-hand-holding-usd"></i>
            {t('contracts.tabs.deposit') || 'Hợp đồng đặt cọc'}
          </button>
        </div>

        {/* Status Tabs */}
        <div className="status-tabs">
          <button 
            className={`status-tab ${filters.status === '' || filters.status === undefined ? 'active' : ''}`}
            onClick={() => {
              setFilters(prev => ({ ...prev, status: '' }));
              setPagination(prev => ({ ...prev, currentPage: 1 }));
            }}
          >
            Tất cả
            <span className="tab-count">{statusCounts.all}</span>
          </button>
          <button 
            className={`status-tab ${filters.status === 'active' ? 'active' : ''}`}
            onClick={() => {
              setFilters(prev => ({ ...prev, status: 'active' }));
              setPagination(prev => ({ ...prev, currentPage: 1 }));
            }}
          >
            {t('contracts.status.active') || 'Hiệu lực'}
            <span className="tab-count">{statusCounts.active}</span>
          </button>
          <button 
            className={`status-tab ${filters.status === 'pending' ? 'active' : ''}`}
            onClick={() => {
              setFilters(prev => ({ ...prev, status: 'pending' }));
              setPagination(prev => ({ ...prev, currentPage: 1 }));
            }}
          >
            {t('contracts.status.pending') || 'Chờ xử lý'}
            <span className="tab-count">{statusCounts.pending}</span>
          </button>
          <button 
            className={`status-tab ${filters.status === 'expired' ? 'active' : ''}`}
            onClick={() => {
              setFilters(prev => ({ ...prev, status: 'expired' }));
              setPagination(prev => ({ ...prev, currentPage: 1 }));
            }}
          >
            {t('contracts.status.expired') || 'Hết hạn'}
            <span className="tab-count">{statusCounts.expired}</span>
          </button>
          <button 
            className={`status-tab ${filters.status === 'terminated' ? 'active' : ''}`}
            onClick={() => {
              setFilters(prev => ({ ...prev, status: 'terminated' }));
              setPagination(prev => ({ ...prev, currentPage: 1 }));
            }}
          >
            {t('contracts.status.terminated') || 'Đã chấm dứt'}
            <span className="tab-count">{statusCounts.terminated}</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="contracts-actions">
          <button className="action-btn primary" onClick={openCreate}>
            <i className="fas fa-file-contract"></i>
            {t('contracts.addNew', 'Thêm hợp đồng mới')}
          </button>
          <button className="action-btn" onClick={handlePrintContract}>
            <i className="fas fa-file-download"></i>
            {t('contracts.downloadContract', 'Tải hợp đồng')}
          </button>
          <button className="action-btn" onClick={() => {}}>
            <i className="fas fa-file-import"></i>
            {t('contracts.importExcel', 'Import Excel')}
          </button>
          <button className="action-btn" onClick={() => {}}>
            <i className="fas fa-file-excel"></i>
            {t('contracts.exportExcel', 'Xuất Excel')}
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
            <div className="pagination-controls">
              <button 
                className="pagination-btn" 
                disabled={pagination.currentPage === 1}
                onClick={() => setPagination(p => ({ ...p, currentPage: 1 }))}
                title={t('rooms.pagination.first')}
              >
                <i className="fas fa-angle-double-left"></i>
              </button>

              <button 
                className="pagination-btn" 
                disabled={pagination.currentPage === 1}
                onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage - 1 }))}
                title={t('rooms.pagination.previous')}
              >
                <i className="fas fa-chevron-left"></i>
              </button>

              <div className="pagination-numbers">
                {getPaginationRange().map((pageNum, index) => (
                  pageNum === '...' ? (
                    <span key={`dots-${index}`} className="pagination-dots">...</span>
                  ) : (
                    <button
                      key={pageNum}
                      className={`pagination-number ${pagination.currentPage === pageNum ? 'active' : ''}`}
                      onClick={() => setPagination(p => ({ ...p, currentPage: pageNum }))}
                    >
                      {pageNum}
                    </button>
                  )
                ))}
              </div>

              <button 
                className="pagination-btn" 
                disabled={pagination.currentPage === pagination.totalPages}
                onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage + 1 }))}
                title={t('rooms.pagination.next')}
              >
                <i className="fas fa-chevron-right"></i>
              </button>

              <button 
                className="pagination-btn" 
                disabled={pagination.currentPage === pagination.totalPages}
                onClick={() => setPagination(p => ({ ...p, currentPage: pagination.totalPages }))}
                title={t('rooms.pagination.last')}
              >
                <i className="fas fa-angle-double-right"></i>
              </button>
            </div>
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

      {/* Print Contract Modal */}
      {showPrintModal && (
        <div className="modal-overlay" onClick={() => setShowPrintModal(false)}>
          <div className="modal-content print-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <i className="fas fa-file-download"></i> Chọn hợp đồng để tải xuống
              </h2>
              <button className="close-modal-btn" onClick={() => setShowPrintModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="modal-body">
              <div className="print-select-all">
                <label>
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAllContracts}
                  />
                  <span>Chọn tất cả ({contracts.length} hợp đồng)</span>
                </label>
              </div>

              <div className="print-contracts-list">
                {contracts.map(contract => (
                  <div key={contract.id} className="print-contract-item">
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedContractsToPrint.includes(contract.id)}
                        onChange={() => handleToggleSelectContract(contract.id)}
                      />
                      <div className="contract-info">
                        <div className="contract-main">
                          <span className="room-number">
                            <i className="fas fa-door-open"></i> {contract.room}
                          </span>
                          <span className="tenant-name">
                            <i className="fas fa-user"></i> 
                            {contract.tenantCount > 1 
                              ? `${contract.tenantCount} người thuê`
                              : contract.tenant
                            }
                          </span>
                        </div>
                        <div className="contract-details">
                          <span className="contract-date">
                            <i className="fas fa-calendar"></i>
                            {new Date(contract.startDate).toLocaleDateString('vi-VN')} - {new Date(contract.endDate).toLocaleDateString('vi-VN')}
                          </span>
                          <span className="contract-rent">
                            <i className="fas fa-money-bill-wave"></i>
                            {formatNumber(contract.monthlyRent)} VNĐ/tháng
                          </span>
                          <span className={`contract-status status-${contract.status}`}>
                            {contract.status === 'active' && 'Hiệu lực'}
                            {contract.status === 'pending' && 'Chờ xử lý'}
                            {contract.status === 'expired' && 'Hết hạn'}
                            {contract.status === 'terminated' && 'Đã chấm dứt'}
                          </span>
                        </div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowPrintModal(false)}>
                <i className="fas fa-times"></i> Hủy
              </button>
              <button 
                className="btn-primary" 
                onClick={handleConfirmPrint}
                disabled={selectedContractsToPrint.length === 0}
              >
                <i className="fas fa-file-download"></i> 
                Tải xuống {selectedContractsToPrint.length > 0 ? `(${selectedContractsToPrint.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractsManagement;

