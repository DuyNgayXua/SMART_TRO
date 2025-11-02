import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import SideBar from '../../common/adminSidebar';
import { useToast } from '../../../hooks/useToast';
import jsPDF from 'jspdf';
import '../admin-global.css';
import './payments.css';
import invoicesAPI from '../../../services/invoicesAPI';

const PaymentsManagement = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  // Tính toán ngày đầu tháng và cuối tháng hiện tại
  const currentDate = new Date();
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  const [searchFilters, setSearchFilters] = useState({
    search: '',
    status: '',
    fromDate: startOfMonth.toISOString().split('T')[0], // Format: YYYY-MM-DD
    toDate: endOfMonth.toISOString().split('T')[0]      // Format: YYYY-MM-DD
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 8  // Số hóa đơn hiển thị mỗi trang
  });
  const [statusCounts, setStatusCounts] = useState({ 
    all: 0, 
    paid: 0, 
    unpaid: 0, 
    overdue: 0 
  });
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showBatchExportModal, setShowBatchExportModal] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [batchFilters, setBatchFilters] = useState({
    status: '',
    month: (new Date().getMonth() + 1).toString() // Mặc định tháng hiện tại
  });

  const statusLabels = {
    all: t('payments.status.all', 'Tất cả'),
    paid: t('payments.status.paid', 'Đã thanh toán'),
    unpaid: t('payments.status.unpaid', 'Chưa thanh toán'),
    overdue: t('payments.status.overdue', 'Quá hạn')
  };

  const fetchStats = useCallback(async () => {
    try {
      // Fetch ALL invoices with date filters (no pagination) to count statuses
      const params = {
        page: 1,
        limit: 9999, // Lấy tất cả
        fromDate: searchFilters.fromDate || undefined,
        toDate: searchFilters.toDate || undefined
      };
      
      const response = await invoicesAPI.getInvoices(params);
      
      if (response.success && response.data.items) {
        const allInvoices = response.data.items;
        
        // Đếm số lượng theo status từ danh sách invoices
        const counts = {
          all: allInvoices.length,
          paid: allInvoices.filter(inv => inv.status === 'paid').length,
          unpaid: allInvoices.filter(inv => ['draft', 'sent', 'pending'].includes(inv.status)).length,
          overdue: allInvoices.filter(inv => inv.status === 'overdue').length
        };
        
        setStatusCounts(counts);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [searchFilters.fromDate, searchFilters.toDate]);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.currentPage,
        limit: pagination.itemsPerPage,
        search: searchFilters.search || undefined,
        status: activeTab !== 'all' ? activeTab : undefined,
        fromDate: searchFilters.fromDate || undefined,
        toDate: searchFilters.toDate || undefined
      };

      const response = await invoicesAPI.getInvoices(params);
      
      if (response.success) {
        setInvoices(response.data.items || []);
        
        setPagination(prev => ({
          ...prev,
          totalItems: response.data.pagination?.total || 0,
          totalPages: response.data.pagination?.pages || 1
        }));
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
      showToast('error', t('common.errors.loadFailed', 'Lỗi tải dữ liệu'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchFilters, pagination.currentPage, pagination.itemsPerPage, showToast, t]);

  // Fetch stats when date filters change
  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFilters.fromDate, searchFilters.toDate]);

  // Fetch invoices on component mount and when dependencies change
  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const openDetail = async (invoice) => {
    setShowDetailModal(true);
    setLoadingDetail(true);
    try {
      const response = await invoicesAPI.getInvoiceById(invoice._id);
      if (response.success) {
        setSelectedInvoice(response.data);
      }
    } catch (error) {
      console.error('Error loading invoice detail:', error);
      showToast('error', t('common.errors.loadFailed', 'Lỗi tải chi tiết'));
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setShowDetailModal(false);
    setSelectedInvoice(null);
  };

  const handleMarkAsPaid = async (invoiceId) => {
    try {
      const response = await invoicesAPI.markAsPaid(invoiceId, {
        paymentDate: new Date().toISOString(),
        paymentMethod: 'cash'
      });
      
      if (response.success) {
        showToast('success', t('payments.markPaidSuccess', 'Đánh dấu thanh toán thành công'));
        fetchInvoices();
        fetchStats(); // Refetch stats after marking as paid
        if (selectedInvoice && selectedInvoice._id === invoiceId) {
          closeDetail();
        }
      }
    } catch (error) {
      console.error('Error marking as paid:', error);
      showToast('error', t('payments.markPaidError', 'Lỗi khi đánh dấu thanh toán'));
    }
  };

  // Toggle select invoice in modal
  const toggleSelectInvoice = (invoiceId) => {
    setSelectedInvoices(prev => {
      if (prev.includes(invoiceId)) {
        return prev.filter(id => id !== invoiceId);
      } else {
        return [...prev, invoiceId];
      }
    });
  };

  // Open batch export modal
  const openBatchExportModal = () => {
    setSelectedInvoices([]);
    setBatchFilters({
      status: '',
      month: (new Date().getMonth() + 1).toString() // Mặc định tháng hiện tại
    });
    setShowBatchExportModal(true);
  };

  // Close batch export modal
  const closeBatchExportModal = () => {
    setShowBatchExportModal(false);
    setSelectedInvoices([]);
    setBatchFilters({
      status: '',
      month: ''
    });
  };

  // Get filtered invoices for batch export
  const getFilteredInvoicesForBatch = () => {
    let filtered = [...invoices];
    
    if (batchFilters.status) {
      filtered = filtered.filter(inv => {
        if (batchFilters.status === 'unpaid') {
          return inv.status === 'draft' || inv.status === 'sent' || inv.status === 'pending';
        }
        return inv.status === batchFilters.status;
      });
    }
    
    if (batchFilters.month) {
      filtered = filtered.filter(inv => {
        const invoiceMonth = new Date(inv.issueDate).getMonth() + 1; // Lọc theo ngày tạo hóa đơn
        return invoiceMonth.toString() === batchFilters.month;
      });
    }
    
    return filtered;
  };

  // Select all filtered invoices in modal
  const handleSelectAll = () => {
    const filteredInvoices = getFilteredInvoicesForBatch();
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(filteredInvoices.map(inv => inv._id));
    }
  };

  // Export single invoice PDF (simplified version for batch)
  const exportSingleInvoicePDF = async (invoice) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    let yPos = margin;

    // Helper function to remove accents
    const removeAccents = (str) => {
      if (!str) return '';
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
    };

    // Helper function to format currency for PDF (without VND symbol)
    const formatMoney = (amount) => {
      if (!amount) return '0';
      return new Intl.NumberFormat('vi-VN').format(amount);
    };

    pdf.setFont('times');
    
    // ===== HEADER =====
    pdf.setFontSize(16);
    pdf.setFont('times', 'bold');
    pdf.setTextColor(41, 128, 185);
    pdf.text('NHA TRO SMART TRO', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    
    pdf.setFontSize(10);
    pdf.setFont('times', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text('Dia chi: [Dia chi nha tro]', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    pdf.text('Dien thoai: [So dien thoai]', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    pdf.setFontSize(22);
    pdf.setFont('times', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text('HOA DON TIEN PHONG', pageWidth / 2, yPos, { align: 'center' });
    yPos += 7;
    
    pdf.setFontSize(11);
    pdf.setFont('times', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text(`So hoa don: ${invoice.invoiceNumber || 'N/A'}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 12;

    // ===== INFO BOX =====
    const boxY = yPos;
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.rect(margin, boxY, pageWidth - 2 * margin, 42);
    
    pdf.setFontSize(11);
    pdf.setFont('times', 'bold');
    pdf.setTextColor(0, 0, 0);
    yPos = boxY + 7;
    
    pdf.text('THONG TIN KHACH THUE', margin + 3, yPos);
    yPos += 6;
    pdf.setFont('times', 'normal');
    pdf.setFontSize(10);
    pdf.text(`Phong: ${removeAccents(invoice.room?.roomNumber || 'N/A')}`, margin + 3, yPos);
    yPos += 5;
    pdf.text(`Ho ten: ${removeAccents(invoice.tenant?.fullName || 'N/A')}`, margin + 3, yPos);
    yPos += 5;
    pdf.text(`Dien thoai: ${invoice.tenant?.phone || 'N/A'}`, margin + 3, yPos);
    yPos += 5;
    pdf.text(`Email: ${invoice.tenant?.email || 'N/A'}`, margin + 3, yPos);

    yPos = boxY + 7;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(11);
    pdf.text('THONG TIN HOA DON', pageWidth / 2 + 5, yPos);
    yPos += 6;
    pdf.setFont('times', 'normal');
    pdf.setFontSize(10);
    pdf.text(`Ky: ${new Date(invoice.periodStart).toLocaleDateString('vi-VN')} - ${new Date(invoice.periodEnd).toLocaleDateString('vi-VN')}`, pageWidth / 2 + 5, yPos);
    yPos += 5;
    pdf.text(`Ngay lap: ${new Date(invoice.issueDate).toLocaleDateString('vi-VN')}`, pageWidth / 2 + 5, yPos);
    yPos += 5;
    pdf.text(`Han thanh toan: ${new Date(invoice.dueDate).toLocaleDateString('vi-VN')}`, pageWidth / 2 + 5, yPos);
    yPos += 5;
    
    const statusText = invoice.status === 'paid' ? 'Da thanh toan' : 
                      invoice.status === 'sent' ? 'Da gui' :
                      invoice.status === 'overdue' ? 'Qua han' : 'Chua thanh toan';
    const statusColor = invoice.status === 'paid' ? [39, 174, 96] : 
                       invoice.status === 'overdue' ? [231, 76, 60] : [243, 156, 18];
    pdf.setTextColor(...statusColor);
    pdf.setFont('times', 'bold');
    pdf.text(`Trang thai: ${removeAccents(statusText)}`, pageWidth / 2 + 5, yPos);
    pdf.setTextColor(0, 0, 0);

    yPos = boxY + 47;

    // ===== METER READINGS (if available) =====
    const hasElectric = invoice.electricOldReading !== undefined && invoice.electricNewReading !== undefined;
    const hasWater = invoice.waterOldReading !== undefined && invoice.waterNewReading !== undefined;
    
    if (hasElectric || hasWater) {
      yPos += 8;
      pdf.setFontSize(13);
      pdf.setFont('times', 'bold');
      pdf.setTextColor(41, 128, 185);
      pdf.text('CHI SO DIEN NUOC', margin, yPos);
      yPos += 8;

      const tableWidth = pageWidth - 2 * margin;
      const col1 = 28;
      const col2 = 30;
      const col3 = 30;
      const col4 = 35;
      const col5 = tableWidth - col1 - col2 - col3 - col4;
      
      pdf.setFillColor(52, 152, 219);
      pdf.rect(margin, yPos, tableWidth, 9, 'F');
      pdf.setDrawColor(52, 152, 219);
      pdf.rect(margin, yPos, tableWidth, 9);
      
      pdf.setFontSize(11);
      pdf.setFont('times', 'bold');
      pdf.setTextColor(255, 255, 255);
      
      let xPos = margin + 2;
      pdf.text('Loai', xPos + col1 / 2, yPos + 6, { align: 'center' });
      xPos += col1;
      pdf.text('CS cu', xPos + col2 / 2, yPos + 6, { align: 'center' });
      xPos += col2;
      pdf.text('CS moi', xPos + col3 / 2, yPos + 6, { align: 'center' });
      xPos += col3;
      pdf.text('Tieu thu', xPos + col4 / 2, yPos + 6, { align: 'center' });
      xPos += col4;
      pdf.text('Don gia', xPos + col5 / 2, yPos + 6, { align: 'center' });
      yPos += 9;

      pdf.setFont('times', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      
      if (hasElectric) {
        pdf.setFillColor(236, 240, 241);
        pdf.rect(margin, yPos, tableWidth, 8);
        pdf.setDrawColor(189, 195, 199);
        pdf.setLineWidth(0.3);
        pdf.rect(margin, yPos, tableWidth, 8);
        
        const electricConsumption = invoice.electricNewReading - invoice.electricOldReading;
        xPos = margin + 2;
        pdf.setFont('times', 'bold');
        pdf.text('Dien', xPos + col1 / 2, yPos + 5.5, { align: 'center' });
        pdf.setFont('times', 'normal');
        xPos += col1;
        pdf.text(invoice.electricOldReading.toString(), xPos + col2 / 2, yPos + 5.5, { align: 'center' });
        xPos += col2;
        pdf.text(invoice.electricNewReading.toString(), xPos + col3 / 2, yPos + 5.5, { align: 'center' });
        xPos += col3;
        pdf.setFont('times', 'bold');
        pdf.text(`${electricConsumption}`, xPos + col4 / 2, yPos + 5.5, { align: 'center' });
        pdf.setFont('times', 'normal');
        xPos += col4;
        pdf.text(`${formatMoney(invoice.electricRate || 3500)}`, xPos + col5 / 2, yPos + 5.5, { align: 'center' });
        yPos += 8;
      }

      if (hasWater) {
        pdf.setFillColor(255, 255, 255);
        pdf.rect(margin, yPos, tableWidth, 8);
        pdf.setDrawColor(189, 195, 199);
        pdf.setLineWidth(0.3);
        pdf.rect(margin, yPos, tableWidth, 8);
        
        const waterConsumption = invoice.waterNewReading - invoice.waterOldReading;
        const waterPrice = invoice.waterBillingType === 'perPerson' 
          ? invoice.waterPricePerPerson || 50000
          : invoice.waterRate || 20000;
        
        xPos = margin + 2;
        pdf.setFont('times', 'bold');
        pdf.text('Nuoc', xPos + col1 / 2, yPos + 5.5, { align: 'center' });
        pdf.setFont('times', 'normal');
        xPos += col1;
        pdf.text(invoice.waterOldReading.toString(), xPos + col2 / 2, yPos + 5.5, { align: 'center' });
        xPos += col2;
        pdf.text(invoice.waterNewReading.toString(), xPos + col3 / 2, yPos + 5.5, { align: 'center' });
        xPos += col3;
        pdf.setFont('times', 'bold');
        pdf.text(`${waterConsumption}`, xPos + col4 / 2, yPos + 5.5, { align: 'center' });
        pdf.setFont('times', 'normal');
        xPos += col4;
        pdf.text(`${formatMoney(waterPrice)}`, xPos + col5 / 2, yPos + 5.5, { align: 'center' });
        yPos += 8;
      }
      
      yPos += 6;
    }

    // ===== CHARGES TABLE =====
    yPos += 3;
    pdf.setFontSize(13);
    pdf.setFont('times', 'bold');
    pdf.setTextColor(41, 128, 185);
    pdf.text('CHI TIET THANH TOAN', margin, yPos);
    yPos += 8;

    const chargesTableWidth = pageWidth - 2 * margin;
    const colSTT = 15;
    const colSoLuong = 20;
    const colDonGia = 38;
    const colThanhTien = 38;
    const colNoiDung = chargesTableWidth - colSTT - colSoLuong - colDonGia - colThanhTien;
    
    pdf.setFillColor(52, 152, 219);
    pdf.rect(margin, yPos, chargesTableWidth, 9, 'F');
    pdf.setDrawColor(52, 152, 219);
    pdf.rect(margin, yPos, chargesTableWidth, 9);
    
    pdf.setFontSize(11);
    pdf.setFont('times', 'bold');
    pdf.setTextColor(255, 255, 255);
    
    let xPos = margin;
    pdf.text('STT', xPos + colSTT / 2, yPos + 6, { align: 'center' });
    xPos += colSTT;
    pdf.text('Noi dung', xPos + 3, yPos + 6);
    xPos += colNoiDung;
    pdf.text('SL', xPos + colSoLuong / 2, yPos + 6, { align: 'center' });
    xPos += colSoLuong;
    pdf.text('Don gia', xPos + colDonGia / 2, yPos + 6, { align: 'center' });
    xPos += colDonGia;
    pdf.text('Thanh tien', xPos + colThanhTien / 2, yPos + 6, { align: 'center' });
    yPos += 9;

    pdf.setFont('times', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    
    invoice.charges?.forEach((charge, index) => {
      const rowHeight = 8;
      
      if (index % 2 === 0) {
        pdf.setFillColor(236, 240, 241);
      } else {
        pdf.setFillColor(255, 255, 255);
      }
      pdf.rect(margin, yPos, chargesTableWidth, rowHeight, 'F');
      
      pdf.setDrawColor(189, 195, 199);
      pdf.setLineWidth(0.3);
      pdf.rect(margin, yPos, chargesTableWidth, rowHeight);
      
      const description = removeAccents(charge.description || '');
      
      xPos = margin;
      pdf.text((index + 1).toString(), xPos + colSTT / 2, yPos + 5.5, { align: 'center' });
      xPos += colSTT;
      
      const maxWidth = colNoiDung - 6;
      const descLines = pdf.splitTextToSize(description, maxWidth);
      pdf.text(descLines[0] || '', xPos + 3, yPos + 5.5);
      xPos += colNoiDung;
      
      pdf.text((charge.quantity || 1).toString(), xPos + colSoLuong / 2, yPos + 5.5, { align: 'center' });
      xPos += colSoLuong;
      
      const unitPrice = formatMoney(charge.unitPrice || charge.amount);
      pdf.text(unitPrice, xPos + colDonGia - 3, yPos + 5.5, { align: 'right' });
      xPos += colDonGia;
      
      const amount = formatMoney(charge.amount);
      pdf.text(amount, xPos + colThanhTien - 3, yPos + 5.5, { align: 'right' });
      
      yPos += rowHeight;
    });

    // Subtotal section
    yPos += 4;
    const summaryX = pageWidth - margin - 85;
    const summaryLabelX = summaryX;
    const summaryValueX = pageWidth - margin - 3;
    
    pdf.setDrawColor(189, 195, 199);
    pdf.setLineWidth(0.5);
    pdf.line(summaryX, yPos, pageWidth - margin, yPos);
    yPos += 7;
    
    pdf.setFont('times', 'normal');
    pdf.setFontSize(11);
    pdf.text('Tam tinh:', summaryLabelX, yPos);
    pdf.text(formatMoney(invoice.subtotal || invoice.totalAmount), summaryValueX, yPos, { align: 'right' });

    if (invoice.discount > 0) {
      yPos += 6;
      pdf.setTextColor(231, 76, 60);
      pdf.text('Giam gia:', summaryLabelX, yPos);
      pdf.text(`-${formatMoney(invoice.discount)}`, summaryValueX, yPos, { align: 'right' });
      pdf.setTextColor(0, 0, 0);
    }

    yPos += 3;
    pdf.setDrawColor(52, 73, 94);
    pdf.setLineWidth(1);
    pdf.line(summaryX, yPos, pageWidth - margin, yPos);
    yPos += 8;
    
    pdf.setFontSize(14);
    pdf.setFont('times', 'bold');
    pdf.setTextColor(231, 76, 60);
    pdf.text('TONG CONG:', summaryLabelX, yPos);
    pdf.setFontSize(15);
    pdf.text(formatMoney(invoice.totalAmount) + ' VND', summaryValueX, yPos, { align: 'right' });
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    yPos += 10;

    // ===== QR CODE SECTION =====
    if (invoice.paymentQRCode && invoice.status !== 'paid') {
      if (yPos > pageHeight - 100) {
        pdf.addPage();
        yPos = margin;
      }

      pdf.setLineWidth(0.5);
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;

      pdf.setFontSize(13);
      pdf.setFont('times', 'bold');
      pdf.setTextColor(41, 128, 185);
      pdf.text('THANH TOAN QUA CHUYEN KHOAN', pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;

      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = invoice.paymentQRCode;
        
        await new Promise((resolve, reject) => {
          img.onload = () => {
            const qrSize = 70;
            const qrX = (pageWidth - qrSize) / 2;
            
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(1);
            pdf.rect(qrX - 2, yPos - 2, qrSize + 4, qrSize + 4);
            
            pdf.addImage(img, 'PNG', qrX, yPos, qrSize, qrSize);
            yPos += qrSize + 10;
            resolve();
          };
          img.onerror = reject;
          setTimeout(() => reject(new Error('QR load timeout')), 5000);
        });

        pdf.setFillColor(236, 240, 241);
        pdf.setDrawColor(189, 195, 199);
        pdf.setLineWidth(0.5);
        pdf.rect(margin + 10, yPos, pageWidth - 2 * margin - 20, 32, 'FD');
        
        pdf.setFontSize(11);
        pdf.setFont('times', 'bold');
        pdf.setTextColor(52, 73, 94);
        yPos += 7;
        
        const bankCode = process.env.REACT_APP_SEPAY_BANK_CODE || 'TPBank';
        const accountNumber = process.env.REACT_APP_SEPAY_ACCOUNT_NUMBER || '0382173105';
        const accountName = removeAccents(process.env.REACT_APP_SEPAY_ACCOUNT_NAME || 'TRUONG CONG DUY');
        
        pdf.text('Thong tin chuyen khoan:', margin + 13, yPos);
        yPos += 6;
        
        pdf.setFont('times', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        pdf.text(`Ngan hang: ${bankCode}`, margin + 13, yPos);
        yPos += 5;
        pdf.text(`So tai khoan: ${accountNumber}`, margin + 13, yPos);
        yPos += 5;
        pdf.text(`Chu tai khoan: ${accountName}`, margin + 13, yPos);
        yPos += 5;
        pdf.setFont('times', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(231, 76, 60);
        pdf.text(`So tien: ${formatMoney(invoice.totalAmount)} VND`, margin + 13, yPos);
        pdf.setTextColor(0, 0, 0);
        
        yPos += 8;
        if (invoice.paymentQRContent) {
          pdf.setFontSize(9);
          pdf.setFont('times', 'italic');
          pdf.setTextColor(100, 100, 100);
          pdf.text(`Noi dung: ${removeAccents(invoice.paymentQRContent)}`, pageWidth / 2, yPos, { align: 'center' });
          pdf.setTextColor(0, 0, 0);
        }
      } catch (error) {
        console.error('Error loading QR code:', error);
        pdf.setFontSize(10);
        pdf.setTextColor(231, 76, 60);
        pdf.text('Loi tai ma QR. Vui long lien he chu tro de nhan thong tin chuyen khoan.', pageWidth / 2, yPos, { align: 'center' });
        pdf.setTextColor(0, 0, 0);
      }
    }

    // ===== NOTES =====
    if (invoice.notes) {
      yPos += 15;
      if (yPos > pageHeight - 30) {
        pdf.addPage();
        yPos = margin;
      }
      
      pdf.setFontSize(10);
      pdf.setFont('times', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('Ghi chu:', margin, yPos);
      yPos += 5;
      
      pdf.setFont('times', 'italic');
      const notes = removeAccents(invoice.notes);
      const noteLines = pdf.splitTextToSize(notes, pageWidth - 2 * margin);
      pdf.text(noteLines, margin, yPos);
    }

    // ===== FOOTER =====
    yPos = pageHeight - 15;
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(margin, yPos - 5, pageWidth - margin, yPos - 5);
    
    pdf.setFontSize(9);
    pdf.setFont('times', 'italic');
    pdf.setTextColor(100, 100, 100);
    pdf.text('Cam on quy khach da su dung dich vu!', pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
    pdf.text('Moi thac mac xin lien he: [So dien thoai chu tro]', pageWidth / 2, yPos, { align: 'center' });

    return pdf;
  };

  // Export batch invoices
  const handleBatchExport = async () => {
    if (selectedInvoices.length === 0) {
      showToast('warning', 'Vui long chon it nhat mot hoa don');
      return;
    }

    setIsExporting(true);
    try {
      // Get full invoice details for selected invoices
      const invoicesToExport = invoices.filter(inv => selectedInvoices.includes(inv._id));
      
      for (let i = 0; i < invoicesToExport.length; i++) {
        const invoice = invoicesToExport[i];
        const detailResponse = await invoicesAPI.getInvoiceById(invoice._id);
        
        if (detailResponse.success) {
          const pdf = await exportSingleInvoicePDF(detailResponse.data);
          const fileName = `HoaDon_Phong${detailResponse.data.room?.roomNumber}_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.pdf`;
          pdf.save(fileName);
          
          // Small delay between exports
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      showToast('success', `Da xuat ${invoicesToExport.length} hoa don thanh cong!`);
      closeBatchExportModal();
    } catch (error) {
      console.error('Error batch exporting:', error);
      showToast('error', 'Loi khi xuat hoa don hang loat');
    } finally {
      setIsExporting(false);
    }
  };  const handleExportPDF = async () => {
    if (!selectedInvoice) return;

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = margin;

      // Helper function to remove accents
      const removeAccents = (str) => {
        if (!str) return '';
        return str
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/Đ/g, 'D');
      };

      // Helper function to format currency for PDF (without VND symbol)
      const formatMoney = (amount) => {
        if (!amount) return '0';
        return new Intl.NumberFormat('vi-VN').format(amount);
      };

      // Sử dụng font Times
      pdf.setFont('times');
      
      // ===== HEADER =====
      // Company/Property name (if available)
      pdf.setFontSize(16);
      pdf.setFont('times', 'bold');
      pdf.setTextColor(41, 128, 185); // Blue
      pdf.text('NHA TRO SMART TRO', pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;
      
      pdf.setFontSize(10);
      pdf.setFont('times', 'normal');
      pdf.setTextColor(100, 100, 100); // Gray
      pdf.text('Dia chi: [Dia chi nha tro]', pageWidth / 2, yPos, { align: 'center' });
      yPos += 5;
      pdf.text('Dien thoai: [So dien thoai]', pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;

      // Invoice title
      pdf.setFontSize(22);
      pdf.setFont('times', 'bold');
      pdf.setTextColor(0, 0, 0); // Black
      pdf.text('HOA DON TIEN PHONG', pageWidth / 2, yPos, { align: 'center' });
      yPos += 7;
      
      // Invoice number
      pdf.setFontSize(11);
      pdf.setFont('times', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text(`So hoa don: ${selectedInvoice.invoiceNumber || 'N/A'}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 12;

      // ===== INFO BOX =====
      const boxY = yPos;
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.5);
      pdf.rect(margin, boxY, pageWidth - 2 * margin, 42);
      
      // Left column
      pdf.setFontSize(11);
      pdf.setFont('times', 'bold');
      pdf.setTextColor(0, 0, 0);
      yPos = boxY + 7;
      
      pdf.text('THONG TIN KHACH THUE', margin + 3, yPos);
      yPos += 6;
      pdf.setFont('times', 'normal');
      pdf.setFontSize(10);
      pdf.text(`Phong: ${removeAccents(selectedInvoice.room?.roomNumber || 'N/A')}`, margin + 3, yPos);
      yPos += 5;
      pdf.text(`Ho ten: ${removeAccents(selectedInvoice.tenant?.fullName || 'N/A')}`, margin + 3, yPos);
      yPos += 5;
      pdf.text(`Dien thoai: ${selectedInvoice.tenant?.phone || 'N/A'}`, margin + 3, yPos);
      yPos += 5;
      pdf.text(`Email: ${selectedInvoice.tenant?.email || 'N/A'}`, margin + 3, yPos);

      // Right column
      yPos = boxY + 7;
      pdf.setFont('times', 'bold');
      pdf.setFontSize(11);
      pdf.text('THONG TIN HOA DON', pageWidth / 2 + 5, yPos);
      yPos += 6;
      pdf.setFont('times', 'normal');
      pdf.setFontSize(10);
      pdf.text(`Ky: ${new Date(selectedInvoice.periodStart).toLocaleDateString('vi-VN')} - ${new Date(selectedInvoice.periodEnd).toLocaleDateString('vi-VN')}`, pageWidth / 2 + 5, yPos);
      yPos += 5;
      pdf.text(`Ngay lap: ${new Date(selectedInvoice.issueDate).toLocaleDateString('vi-VN')}`, pageWidth / 2 + 5, yPos);
      yPos += 5;
      pdf.text(`Han thanh toan: ${new Date(selectedInvoice.dueDate).toLocaleDateString('vi-VN')}`, pageWidth / 2 + 5, yPos);
      yPos += 5;
      
      // Status
      const statusText = selectedInvoice.status === 'paid' ? 'Da thanh toan' : 
                        selectedInvoice.status === 'sent' ? 'Da gui' :
                        selectedInvoice.status === 'overdue' ? 'Qua han' : 'Chua thanh toan';
      const statusColor = selectedInvoice.status === 'paid' ? [39, 174, 96] : 
                         selectedInvoice.status === 'overdue' ? [231, 76, 60] : [243, 156, 18];
      pdf.setTextColor(...statusColor);
      pdf.setFont('times', 'bold');
      pdf.text(`Trang thai: ${removeAccents(statusText)}`, pageWidth / 2 + 5, yPos);
      pdf.setTextColor(0, 0, 0);

      yPos = boxY + 47;

      // ===== METER READINGS (if available) =====
      const hasElectric = selectedInvoice.electricOldReading !== undefined && selectedInvoice.electricNewReading !== undefined;
      const hasWater = selectedInvoice.waterOldReading !== undefined && selectedInvoice.waterNewReading !== undefined;
      
      if (hasElectric || hasWater) {
        yPos += 8;
        pdf.setFontSize(13);
        pdf.setFont('times', 'bold');
        pdf.setTextColor(41, 128, 185);
        pdf.text('CHI SO DIEN NUOC', margin, yPos);
        yPos += 8;

        // Table header
        const tableWidth = pageWidth - 2 * margin;
        const col1 = 28;  // Loại
        const col2 = 30;  // Chỉ số cũ
        const col3 = 30;  // Chỉ số mới
        const col4 = 35;  // Tiêu thụ
        const col5 = tableWidth - col1 - col2 - col3 - col4;  // Đơn giá
        
        pdf.setFillColor(52, 152, 219);
        pdf.rect(margin, yPos, tableWidth, 9, 'F');
        pdf.setDrawColor(52, 152, 219);
        pdf.rect(margin, yPos, tableWidth, 9);
        
        pdf.setFontSize(11);
        pdf.setFont('times', 'bold');
        pdf.setTextColor(255, 255, 255);
        
        let xPos = margin + 2;
        pdf.text('Loai', xPos + col1 / 2, yPos + 6, { align: 'center' });
        xPos += col1;
        pdf.text('CS cu', xPos + col2 / 2, yPos + 6, { align: 'center' });
        xPos += col2;
        pdf.text('CS moi', xPos + col3 / 2, yPos + 6, { align: 'center' });
        xPos += col3;
        pdf.text('Tieu thu', xPos + col4 / 2, yPos + 6, { align: 'center' });
        xPos += col4;
        pdf.text('Don gia', xPos + col5 / 2, yPos + 6, { align: 'center' });
        yPos += 9;

        pdf.setFont('times', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        
        // Electric row
        if (hasElectric) {
          pdf.setFillColor(236, 240, 241);
          pdf.rect(margin, yPos, tableWidth, 8);
          pdf.setDrawColor(189, 195, 199);
          pdf.setLineWidth(0.3);
          pdf.rect(margin, yPos, tableWidth, 8);
          
          const electricConsumption = selectedInvoice.electricNewReading - selectedInvoice.electricOldReading;
          xPos = margin + 2;
          pdf.setFont('times', 'bold');
          pdf.text('Dien', xPos + col1 / 2, yPos + 5.5, { align: 'center' });
          pdf.setFont('times', 'normal');
          xPos += col1;
          pdf.text(selectedInvoice.electricOldReading.toString(), xPos + col2 / 2, yPos + 5.5, { align: 'center' });
          xPos += col2;
          pdf.text(selectedInvoice.electricNewReading.toString(), xPos + col3 / 2, yPos + 5.5, { align: 'center' });
          xPos += col3;
          pdf.setFont('times', 'bold');
          pdf.text(`${electricConsumption}`, xPos + col4 / 2, yPos + 5.5, { align: 'center' });
          pdf.setFont('times', 'normal');
          xPos += col4;
          pdf.text(`${formatMoney(selectedInvoice.electricRate || 3500)}`, xPos + col5 / 2, yPos + 5.5, { align: 'center' });
          yPos += 8;
        }

        // Water row
        if (hasWater) {
          pdf.setFillColor(255, 255, 255);
          pdf.rect(margin, yPos, tableWidth, 8);
          pdf.setDrawColor(189, 195, 199);
          pdf.setLineWidth(0.3);
          pdf.rect(margin, yPos, tableWidth, 8);
          
          const waterConsumption = selectedInvoice.waterNewReading - selectedInvoice.waterOldReading;
          const waterPrice = selectedInvoice.waterBillingType === 'perPerson' 
            ? selectedInvoice.waterPricePerPerson || 50000
            : selectedInvoice.waterRate || 20000;
          
          xPos = margin + 2;
          pdf.setFont('times', 'bold');
          pdf.text('Nuoc', xPos + col1 / 2, yPos + 5.5, { align: 'center' });
          pdf.setFont('times', 'normal');
          xPos += col1;
          pdf.text(selectedInvoice.waterOldReading.toString(), xPos + col2 / 2, yPos + 5.5, { align: 'center' });
          xPos += col2;
          pdf.text(selectedInvoice.waterNewReading.toString(), xPos + col3 / 2, yPos + 5.5, { align: 'center' });
          xPos += col3;
          pdf.setFont('times', 'bold');
          pdf.text(`${waterConsumption}`, xPos + col4 / 2, yPos + 5.5, { align: 'center' });
          pdf.setFont('times', 'normal');
          xPos += col4;
          pdf.text(`${formatMoney(waterPrice)}`, xPos + col5 / 2, yPos + 5.5, { align: 'center' });
          yPos += 8;
        }
        
        yPos += 6;
      }

      // ===== CHARGES TABLE =====
      yPos += 3;
      pdf.setFontSize(13);
      pdf.setFont('times', 'bold');
      pdf.setTextColor(41, 128, 185);
      pdf.text('CHI TIET THANH TOAN', margin, yPos);
      yPos += 8;

      // Table header
      const tableWidth = pageWidth - 2 * margin;
      const colSTT = 15;
      const colSoLuong = 20;
      const colDonGia = 38;
      const colThanhTien = 38;
      const colNoiDung = tableWidth - colSTT - colSoLuong - colDonGia - colThanhTien;
      
      pdf.setFillColor(52, 152, 219);
      pdf.rect(margin, yPos, tableWidth, 9, 'F');
      pdf.setDrawColor(52, 152, 219);
      pdf.rect(margin, yPos, tableWidth, 9);
      
      pdf.setFontSize(11);
      pdf.setFont('times', 'bold');
      pdf.setTextColor(255, 255, 255);
      
      let xPos = margin;
      pdf.text('STT', xPos + colSTT / 2, yPos + 6, { align: 'center' });
      xPos += colSTT;
      pdf.text('Noi dung', xPos + 3, yPos + 6);
      xPos += colNoiDung;
      pdf.text('SL', xPos + colSoLuong / 2, yPos + 6, { align: 'center' });
      xPos += colSoLuong;
      pdf.text('Don gia', xPos + colDonGia / 2, yPos + 6, { align: 'center' });
      xPos += colDonGia;
      pdf.text('Thanh tien', xPos + colThanhTien / 2, yPos + 6, { align: 'center' });
      yPos += 9;

      // Table rows
      pdf.setFont('times', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      
      selectedInvoice.charges?.forEach((charge, index) => {
        const rowHeight = 8;
        
        // Zebra striping
        if (index % 2 === 0) {
          pdf.setFillColor(236, 240, 241);
        } else {
          pdf.setFillColor(255, 255, 255);
        }
        pdf.rect(margin, yPos, tableWidth, rowHeight, 'F');
        
        pdf.setDrawColor(189, 195, 199);
        pdf.setLineWidth(0.3);
        pdf.rect(margin, yPos, tableWidth, rowHeight);
        
        const description = removeAccents(charge.description || '');
        
        xPos = margin;
        pdf.text((index + 1).toString(), xPos + colSTT / 2, yPos + 5.5, { align: 'center' });
        xPos += colSTT;
        
        // Wrap text if too long
        const maxWidth = colNoiDung - 6;
        const descLines = pdf.splitTextToSize(description, maxWidth);
        pdf.text(descLines[0] || '', xPos + 3, yPos + 5.5);
        xPos += colNoiDung;
        
        pdf.text((charge.quantity || 1).toString(), xPos + colSoLuong / 2, yPos + 5.5, { align: 'center' });
        xPos += colSoLuong;
        
        const unitPrice = formatMoney(charge.unitPrice || charge.amount);
        pdf.text(unitPrice, xPos + colDonGia - 3, yPos + 5.5, { align: 'right' });
        xPos += colDonGia;
        
        const amount = formatMoney(charge.amount);
        pdf.text(amount, xPos + colThanhTien - 3, yPos + 5.5, { align: 'right' });
        
        yPos += rowHeight;
      });

      // Subtotal section
      yPos += 4;
      const summaryX = pageWidth - margin - 85;
      const summaryLabelX = summaryX;
      const summaryValueX = pageWidth - margin - 3;
      
      pdf.setDrawColor(189, 195, 199);
      pdf.setLineWidth(0.5);
      pdf.line(summaryX, yPos, pageWidth - margin, yPos);
      yPos += 7;
      
      pdf.setFont('times', 'normal');
      pdf.setFontSize(11);
      pdf.text('Tam tinh:', summaryLabelX, yPos);
      pdf.text(formatMoney(selectedInvoice.subtotal || selectedInvoice.totalAmount), summaryValueX, yPos, { align: 'right' });

      // Discount (if any)
      if (selectedInvoice.discount > 0) {
        yPos += 6;
        pdf.setTextColor(231, 76, 60);
        pdf.text('Giam gia:', summaryLabelX, yPos);
        pdf.text(`-${formatMoney(selectedInvoice.discount)}`, summaryValueX, yPos, { align: 'right' });
        pdf.setTextColor(0, 0, 0);
      }

      // Total
      yPos += 3;
      pdf.setDrawColor(52, 73, 94);
      pdf.setLineWidth(1);
      pdf.line(summaryX, yPos, pageWidth - margin, yPos);
      yPos += 8;
      
      pdf.setFontSize(14);
      pdf.setFont('times', 'bold');
      pdf.setTextColor(231, 76, 60);
      pdf.text('TONG CONG:', summaryLabelX, yPos);
      pdf.setFontSize(15);
      pdf.text(formatMoney(selectedInvoice.totalAmount) + ' VND', summaryValueX, yPos, { align: 'right' });
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      yPos += 10;

      // ===== QR CODE SECTION =====
      if (selectedInvoice.paymentQRCode && selectedInvoice.status !== 'paid') {
        // Check if we need a new page
        if (yPos > pageHeight - 100) {
          pdf.addPage();
          yPos = margin;
        }

        pdf.setLineWidth(0.5);
        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 10;

        pdf.setFontSize(13);
        pdf.setFont('times', 'bold');
        pdf.setTextColor(41, 128, 185);
        pdf.text('THANH TOAN QUA CHUYEN KHOAN', pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;

        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = selectedInvoice.paymentQRCode;
          
          await new Promise((resolve, reject) => {
            img.onload = () => {
              const qrSize = 70;
              const qrX = (pageWidth - qrSize) / 2;
              
              // QR border
              pdf.setDrawColor(200, 200, 200);
              pdf.setLineWidth(1);
              pdf.rect(qrX - 2, yPos - 2, qrSize + 4, qrSize + 4);
              
              pdf.addImage(img, 'PNG', qrX, yPos, qrSize, qrSize);
              yPos += qrSize + 10;
              resolve();
            };
            img.onerror = reject;
            setTimeout(() => reject(new Error('QR load timeout')), 5000);
          });

          // Bank info box
          pdf.setFillColor(236, 240, 241);
          pdf.setDrawColor(189, 195, 199);
          pdf.setLineWidth(0.5);
          pdf.rect(margin + 10, yPos, pageWidth - 2 * margin - 20, 32, 'FD');
          
          pdf.setFontSize(11);
          pdf.setFont('times', 'bold');
          pdf.setTextColor(52, 73, 94);
          yPos += 7;
          
          const bankCode = process.env.REACT_APP_SEPAY_BANK_CODE || 'TPBank';
          const accountNumber = process.env.REACT_APP_SEPAY_ACCOUNT_NUMBER || '0382173105';
          const accountName = removeAccents(process.env.REACT_APP_SEPAY_ACCOUNT_NAME || 'TRUONG CONG DUY');
          
          pdf.text('Thong tin chuyen khoan:', margin + 13, yPos);
          yPos += 6;
          
          pdf.setFont('times', 'normal');
          pdf.setFontSize(10);
          pdf.setTextColor(0, 0, 0);
          pdf.text(`Ngan hang: ${bankCode}`, margin + 13, yPos);
          yPos += 5;
          pdf.text(`So tai khoan: ${accountNumber}`, margin + 13, yPos);
          yPos += 5;
          pdf.text(`Chu tai khoan: ${accountName}`, margin + 13, yPos);
          yPos += 5;
          pdf.setFont('times', 'bold');
          pdf.setFontSize(11);
          pdf.setTextColor(231, 76, 60);
          pdf.text(`So tien: ${formatMoney(selectedInvoice.totalAmount)} VND`, margin + 13, yPos);
          pdf.setTextColor(0, 0, 0);
          
          yPos += 8;
          if (selectedInvoice.paymentQRContent) {
            pdf.setFontSize(9);
            pdf.setFont('times', 'italic');
            pdf.setTextColor(100, 100, 100);
            pdf.text(`Noi dung: ${removeAccents(selectedInvoice.paymentQRContent)}`, pageWidth / 2, yPos, { align: 'center' });
            pdf.setTextColor(0, 0, 0);
          }
        } catch (error) {
          console.error('Error loading QR code:', error);
          pdf.setFontSize(10);
          pdf.setTextColor(231, 76, 60);
          pdf.text('Loi tai ma QR. Vui long lien he chu tro de nhan thong tin chuyen khoan.', pageWidth / 2, yPos, { align: 'center' });
          pdf.setTextColor(0, 0, 0);
        }
      }

      // ===== NOTES =====
      if (selectedInvoice.notes) {
        yPos += 15;
        if (yPos > pageHeight - 30) {
          pdf.addPage();
          yPos = margin;
        }
        
        pdf.setFontSize(10);
        pdf.setFont('times', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text('Ghi chu:', margin, yPos);
        yPos += 5;
        
        pdf.setFont('times', 'italic');
        const notes = removeAccents(selectedInvoice.notes);
        const noteLines = pdf.splitTextToSize(notes, pageWidth - 2 * margin);
        pdf.text(noteLines, margin, yPos);
      }

      // ===== FOOTER =====
      yPos = pageHeight - 15;
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.3);
      pdf.line(margin, yPos - 5, pageWidth - margin, yPos - 5);
      
      pdf.setFontSize(9);
      pdf.setFont('times', 'italic');
      pdf.setTextColor(100, 100, 100);
      pdf.text('Cam on quy khach da su dung dich vu!', pageWidth / 2, yPos, { align: 'center' });
      yPos += 4;
      pdf.text('Moi thac mac xin lien he: [So dien thoai chu tro]', pageWidth / 2, yPos, { align: 'center' });

      // Save PDF
      const fileName = `HoaDon_Phong${selectedInvoice.room?.roomNumber}_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.pdf`;
      pdf.save(fileName);

      showToast('success', 'Xuat PDF thanh cong!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      showToast('error', 'Loi khi xuat PDF: ' + error.message);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'paid': return 'status-badge status-paid';
      case 'unpaid': return 'status-badge status-unpaid';
      case 'overdue': return 'status-badge status-overdue';
      case 'pending': return 'status-badge status-pending';
      default: return 'status-badge';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'paid': return t('payments.status.paid', 'Đã thanh toán');
      case 'unpaid': return t('payments.status.unpaid', 'Chưa thanh toán');
      case 'overdue': return t('payments.status.overdue', 'Quá hạn');
      case 'pending': return t('payments.status.pending', 'Chờ xử lý');
      default: return status;
    }
  };

  // Hàm tính toán các trang hiển thị
  const getPaginationRange = () => {
    const { currentPage, totalPages } = pagination;
    const range = [];
    const showPages = 7; // Số trang hiển thị tối đa
    
    if (totalPages <= showPages) {
      // Nếu tổng số trang <= showPages, hiển thị tất cả
      for (let i = 1; i <= totalPages; i++) {
        range.push(i);
      }
    } else {
      // Logic với dots để hiển thị thông minh
      if (currentPage <= 3) {
        // Đầu: 1 2 3 4 5 ... totalPages
        for (let i = 1; i <= Math.min(5, totalPages); i++) {
          range.push(i);
        }
        if (totalPages > 5) {
          range.push('...');
          range.push(totalPages);
        }
      } else if (currentPage >= totalPages - 2) {
        // Cuối: 1 ... (totalPages-4) (totalPages-3) (totalPages-2) (totalPages-1) totalPages
        range.push(1);
        if (totalPages > 5) {
          range.push('...');
        }
        for (let i = Math.max(totalPages - 4, 2); i <= totalPages; i++) {
          range.push(i);
        }
      } else {
        // Giữa: 1 ... (currentPage-1) currentPage (currentPage+1) ... totalPages
        range.push(1);
        range.push('...');
        range.push(currentPage - 1, currentPage, currentPage + 1);
        range.push('...');
        range.push(totalPages);
      }
    }
    
    return range;
  };



  return (
    <div className="payments-container">
      <SideBar />
      <div className="payments-content">
        {/* Header */}
        <div className="payments-header">
          <h1 className="payments-title">{t('payments.title', 'Quản lý thanh toán')}</h1>
          
          {/* Search Bar */}
          <div className="search-container">
            <div className="search-input-wrapper">
              <i className="fas fa-search search-icon"></i>
              <input
                type="text"
                className="search-input"
                placeholder={t('payments.searchPlaceholder', 'Tìm theo phòng, khách thuê...')}
                value={searchFilters.search}
                onChange={e => {
                  setSearchFilters(f => ({ ...f, search: e.target.value }));
                  setPagination(p => ({ ...p, currentPage: 1 }));
                }}
              />
              {searchFilters.search && (
                <button 
                  className="clear-search-btn"
                  onClick={() => {
                    setSearchFilters(f => ({ ...f, search: '' }));
                    setPagination(p => ({ ...p, currentPage: 1 }));
                  }}
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>




          </div>
        </div>

        {/* Date Filter Info Banner */}
        {(searchFilters.fromDate || searchFilters.toDate) && (
          <div className="date-filter-banner">
            <div className="banner-content">
              <i className="fas fa-calendar-alt"></i>
              <span className="banner-text">
                Hiển thị hóa đơn 
                {searchFilters.fromDate && ` từ ${new Date(searchFilters.fromDate + 'T00:00:00').toLocaleDateString('vi-VN')}`}
                {searchFilters.toDate && ` đến ${new Date(searchFilters.toDate + 'T00:00:00').toLocaleDateString('vi-VN')}`}
              </span>
            </div>
            <button 
              className="banner-clear-btn"
              onClick={() => {
                setSearchFilters(f => ({ ...f, fromDate: '', toDate: '' }));
                setPagination(p => ({ ...p, currentPage: 1 }));
              }}
              title="Xóa bộ lọc ngày"
            >
              <i className="fas fa-times"></i>
              Xóa bộ lọc
            </button>
          </div>
        )}

        {/* Status Tabs */}
        <div className="status-tabs">
          {Object.keys(statusLabels).map(status => (
            <button
              key={status}
              className={`status-tab ${activeTab === status ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(status);
                setPagination(p => ({ ...p, currentPage: 1 }));
              }}
            >
              {statusLabels[status]}
              {statusCounts[status] > 0 && (
                <span className="tab-count">{statusCounts[status]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Action Buttons with Date Range */}
        <div className="payments-actions">
          {/* Date Range Filters */}
          <div className="date-filter-group">
            <label className="date-label">Từ ngày:</label>
            <input
              type="date"
              className="filter-date"
              value={searchFilters.fromDate || ''}
              onChange={e => {
                setSearchFilters(f => ({ ...f, fromDate: e.target.value }));
                setPagination(p => ({ ...p, currentPage: 1 }));
              }}
            />
          </div>

          <div className="date-filter-group">
            <label className="date-label">Đến ngày:</label>
            <input
              type="date"
              className="filter-date"
              value={searchFilters.toDate || ''}
              onChange={e => {
                setSearchFilters(f => ({ ...f, toDate: e.target.value }));
                setPagination(p => ({ ...p, currentPage: 1 }));
              }}
            />
          </div>

          <button className="action-btn primary" onClick={openBatchExportModal}>
            <i className="fas fa-file-export"></i>
            {t('payments.batchExport', 'Xuất hóa đơn hàng loạt')}
          </button>
          <div className="date-filter-group">
          </div>
          <div className="date-filter-group">
          </div>
          <div className="date-filter-group">
          </div>
        </div>

        {/* Invoices Grid */}
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>{t('common.loading', 'Đang tải...')}</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="empty-container">
            <div className="empty-icon">📄</div>
            <h3 className="empty-text">{t('payments.noInvoices', 'Không có hóa đơn nào')}</h3>
            <p className="empty-description">{t('payments.noInvoicesDescription', 'Chưa có hóa đơn nào được tạo')}</p>
          </div>
        ) : (
          <div className="payments-grid">
            {invoices.map(invoice => (
              <div 
                key={invoice._id} 
                className="payment-card"
                onClick={() => openDetail(invoice)}
              >
                <div className="payment-card-header">
                  <div className="payment-info">
                    <div className="payment-room">
                      <i className="fas fa-door-open"></i>
                      <span>{t('payments.room', 'Phòng')} {invoice.room?.roomNumber || '-'}</span>
                    </div>
                    <div className="payment-tenant">
                      <i className="fas fa-user"></i>
                      <span>{invoice.tenant?.fullName || '-'}</span>
                    </div>
                  </div>
                  <span className={getStatusBadgeClass(invoice.status)}>
                    {getStatusText(invoice.status)}
                  </span>
                </div>

                <div className="payment-card-body">
                  <div className="payment-period">
                    <i className="fas fa-calendar"></i>
                    <span>
                      {t('payments.period', 'Kỳ')}: {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}
                    </span>
                  </div>
                  
                  <div className="payment-dates">
                    <div className="date-item">
                      <label>{t('payments.issueDate', 'Ngày lập')}:</label>
                      <span>{formatDate(invoice.issueDate)}</span>
                    </div>
                    <div className="date-item">
                      <label>{t('payments.dueDate', 'Hạn thanh toán')}:</label>
                      <span>{formatDate(invoice.dueDate)}</span>
                    </div>
                  </div>

                  <div className="payment-amount">
                    <label>{t('payments.totalAmount', 'Tổng tiền')}:</label>
                    <span className="amount-value">{formatCurrency(invoice.totalAmount)}</span>
                  </div>

                  {invoice.status === 'paid' && invoice.paymentDate && (
                    <div className="payment-date-paid">
                      <i className="fas fa-check-circle"></i>
                      <span>{t('payments.paidOn', 'Đã thanh toán')}: {formatDate(invoice.paymentDate)}</span>
                    </div>
                  )}
                </div>

                <div className="payment-card-footer">
                  {invoice.status !== 'paid' && (
                    <button
                      className="btn-mark-paid"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsPaid(invoice._id);
                      }}
                    >
                      <i className="fas fa-check"></i>
                      {t('payments.markAsPaid', 'Đánh dấu đã thanh toán')}
                    </button>
                  )}
                  <button className="btn-view-detail">
                    <i className="fas fa-eye"></i>
                    {t('payments.viewDetail', 'Xem chi tiết')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {invoices.length > 0 && pagination.totalPages > 1 && (
          <div className="pagination">
            {/* Pagination Info */}
            <div className="pagination-info">
              <span className="pagination-text">
                Trang {pagination.currentPage} / {pagination.totalPages} 
                ({pagination.totalItems} hóa đơn)
              </span>
            </div>

            <div className="pagination-controls">
              {/* First Page Button */}
              <button
                className="pagination-btn"
                disabled={pagination.currentPage === 1}
                onClick={() => setPagination(p => ({ ...p, currentPage: 1 }))}
                title="Trang đầu"
              >
                <i className="fas fa-angle-double-left" />
              </button>

              {/* Previous Page Button */}
              <button
                className="pagination-btn"
                disabled={pagination.currentPage === 1}
                onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage - 1 }))}
                title="Trang trước"
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
                      title={`Trang ${page}`}
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
                title="Trang sau"
              >
                <i className="fas fa-chevron-right" />
              </button>

              {/* Last Page Button */}
              <button
                className="pagination-btn"
                disabled={pagination.currentPage === pagination.totalPages}
                onClick={() => setPagination(p => ({ ...p, currentPage: pagination.totalPages }))}
                title="Trang cuối"
              >
                <i className="fas fa-angle-double-right" />
              </button>
            </div>
          </div>
        )}

        {/* Fallback pagination nếu không có điều kiện trên */}
        {invoices.length > 0 && pagination.totalPages <= 1 && (
          <div style={{textAlign: 'center', padding: '20px', color: '#666'}}>
            Tất cả {pagination.totalItems} hóa đơn đã được hiển thị
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && (
        <div className="modal-backdrop" onClick={closeDetail}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('payments.invoiceDetail', 'Chi tiết hóa đơn')}</h2>
              <button className="modal-close" onClick={closeDetail}>×</button>
            </div>
            
            {loadingDetail ? (
              <div className="modal-loading">
                <div className="loading-spinner" />
                <p>{t('common.loading', 'Đang tải...')}</p>
              </div>
            ) : selectedInvoice ? (
              <div className="modal-body">
                <div className="invoice-detail-grid">
                  {/* Thông tin cơ bản */}
                  <div className="detail-section">
                    <h3><i className="fas fa-info-circle"></i> {t('payments.generalInfo', 'Thông tin chung')}</h3>
                    <div className="detail-row">
                      <label><i className="fas fa-hashtag"></i> Mã hóa đơn:</label>
                      <span className="invoice-number">{selectedInvoice.invoiceNumber}</span>
                    </div>
                    <div className="detail-row">
                      <label><i className="fas fa-door-open"></i> {t('payments.room', 'Phòng')}:</label>
                      <span>{t('payments.room', 'Phòng')} {selectedInvoice.room?.roomNumber}</span>
                    </div>
                    <div className="detail-row">
                      <label><i className="fas fa-user"></i> {t('payments.tenant', 'Khách thuê')}:</label>
                      <span>{selectedInvoice.tenant?.fullName}</span>
                    </div>
                    <div className="detail-row">
                      <label><i className="fas fa-phone"></i> Số điện thoại:</label>
                      <span>{selectedInvoice.tenant?.phone || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <label><i className="fas fa-envelope"></i> Email:</label>
                      <span>{selectedInvoice.tenant?.email || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <label><i className="fas fa-tag"></i> {t('payments.status.label', 'Trạng thái')}:</label>
                      <span className={getStatusBadgeClass(selectedInvoice.status)}>
                        {getStatusText(selectedInvoice.status)}
                      </span>
                    </div>
                  </div>

                  {/* Kỳ thanh toán */}
                  <div className="detail-section period-section">
                    <h3><i className="fas fa-calendar-alt"></i> Kỳ thanh toán</h3>
                    <div className="detail-row">
                      <label><i className="fas fa-calendar-week"></i> Chu kỳ:</label>
                      <span className="period-range">
                        {new Date(selectedInvoice.periodStart).toLocaleDateString('vi-VN')} - {new Date(selectedInvoice.periodEnd).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <div className="detail-row">
                      <label><i className="fas fa-calendar-day"></i> Ngày lập:</label>
                      <span>{new Date(selectedInvoice.issueDate).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <div className="detail-row">
                      <label><i className="fas fa-calendar-check"></i> Hạn thanh toán:</label>
                      <span className={new Date(selectedInvoice.dueDate) < new Date() && selectedInvoice.status !== 'paid' ? 'overdue-date' : ''}>
                        {new Date(selectedInvoice.dueDate).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  </div>

                  {/* Chỉ số điện nước */}
                  <div className="detail-section utilities-section">
                    <h3><i className="fas fa-bolt"></i> Chỉ số điện nước</h3>
                    <div className="utility-grid">
                      <div className="utility-item electric">
                        <div className="utility-icon">
                          <i className="fas fa-plug"></i>
                        </div>
                        <div className="utility-details">
                          <label>Điện</label>
                          <div className="utility-reading">
                            <span className="old-reading">{selectedInvoice.electricOldReading || 0}</span>
                            <i className="fas fa-arrow-right"></i>
                            <span className="new-reading">{selectedInvoice.electricNewReading || 0}</span>
                          </div>
                          <div className="utility-consumption">
                            Tiêu thụ: <strong>{(selectedInvoice.electricNewReading - selectedInvoice.electricOldReading) || 0} kWh</strong> × {(selectedInvoice.electricRate || 0).toLocaleString('vi-VN')}đ
                          </div>
                        </div>
                      </div>
                      
                      <div className="utility-item water">
                        <div className="utility-icon">
                          <i className="fas fa-tint"></i>
                        </div>
                        <div className="utility-details">
                          <label>Nước {selectedInvoice.waterBillingType === 'perPerson' ? '(Theo người)' : '(Theo số đo)'}</label>
                          {selectedInvoice.waterBillingType === 'perPerson' ? (
                            <div className="utility-consumption">
                              <strong>N/A</strong> - Tính theo {selectedInvoice.tenant?.fullName ? '1 người' : 'số người'} × {(selectedInvoice.waterRate || 0).toLocaleString('vi-VN')}đ
                            </div>
                          ) : (
                            <>
                              <div className="utility-reading">
                                <span className="old-reading">{selectedInvoice.waterOldReading || 0}</span>
                                <i className="fas fa-arrow-right"></i>
                                <span className="new-reading">{selectedInvoice.waterNewReading || 0}</span>
                              </div>
                              <div className="utility-consumption">
                                Tiêu thụ: <strong>{(selectedInvoice.waterNewReading - selectedInvoice.waterOldReading) || 0} m³</strong> × {(selectedInvoice.waterRate || 0).toLocaleString('vi-VN')}đ
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chi tiết thanh toán */}
                  <div className="detail-section payment-section">
                    <h3><i className="fas fa-money-bill-wave"></i> {t('payments.paymentDetail', 'Chi tiết thanh toán')}</h3>
                    <div className="charges-list">
                      {selectedInvoice.charges?.map((charge, index) => (
                        <div key={index} className="charge-item">
                          <div className="charge-info">
                            <i className={`fas ${
                              charge.type === 'rent' ? 'fa-home' :
                              charge.type === 'electricity' ? 'fa-bolt' :
                              charge.type === 'water' ? 'fa-tint' :
                              charge.type === 'internet' ? 'fa-wifi' :
                              charge.type === 'parking' ? 'fa-car' :
                              'fa-clipboard-list'
                            }`}></i>
                            <span className="charge-desc">{charge.description}</span>
                          </div>
                          <span className="charge-amount">{formatCurrency(charge.amount)}</span>
                        </div>
                      ))}
                    </div>
                    
                    {selectedInvoice.discount > 0 && (
                      <div className="discount-row">
                        <label><i className="fas fa-tag"></i> Giảm giá:</label>
                        <span className="discount-amount">-{formatCurrency(selectedInvoice.discount)}</span>
                      </div>
                    )}
                    
                    <div className="total-row">
                      <label><i className="fas fa-calculator"></i> {t('payments.totalAmount', 'Tổng cộng')}:</label>
                      <span className="total-amount">{formatCurrency(selectedInvoice.totalAmount)}</span>
                    </div>
                  </div>

                  {/* Ghi chú */}
                  {selectedInvoice.notes && (
                    <div className="detail-section notes-section">
                      <h3><i className="fas fa-sticky-note"></i> Ghi chú</h3>
                      <p className="notes-content">{selectedInvoice.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeDetail}>{t('payments.close', 'Đóng')}</button>
              <button 
                className="btn-success" 
                onClick={handleExportPDF}
                title={t('payments.exportPDFTooltip', 'Xuất hóa đơn PDF kèm QR thanh toán')}
              >
                📄 {t('payments.exportPDF', 'Xuất PDF')}
              </button>
              {selectedInvoice && selectedInvoice.status !== 'paid' && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    handleMarkAsPaid(selectedInvoice._id);
                  }}
                >
                  {t('payments.markAsPaid', 'Đánh dấu đã thanh toán')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Batch Export Modal */}
      {showBatchExportModal && (
        <div className="modal-backdrop" onClick={closeBatchExportModal}>
          <div className="modal-container batch-export-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                <i className="fas fa-file-export"></i>
                {t('payments.batchExportModal.title', 'Xuất hóa đơn hàng loạt')}
              </h2>
              <button className="modal-close" onClick={closeBatchExportModal}>×</button>
            </div>
            
            <div className="modal-body">
              {/* Filters Section */}
              <div className="batch-filters">
                <div className="batch-filter-group">
                  <label className="batch-filter-label">
                    <i className="fas fa-filter"></i>
                    {t('payments.batchExportModal.filterStatus', 'Trạng thái')}
                  </label>
                  <select
                    className="batch-filter-select"
                    value={batchFilters.status}
                    onChange={e => {
                      setBatchFilters(f => ({ ...f, status: e.target.value }));
                      setSelectedInvoices([]);
                    }}
                  >
                    <option value="">{t('common.all', 'Tất cả')}</option>
                    <option value="paid">{t('payments.status.paid', 'Đã thanh toán')}</option>
                    <option value="unpaid">{t('payments.status.unpaid', 'Chưa thanh toán')}</option>
                    <option value="overdue">{t('payments.status.overdue', 'Quá hạn')}</option>
                  </select>
                </div>

                <div className="batch-filter-group">
                  <label className="batch-filter-label">
                    <i className="fas fa-calendar"></i>
                    {t('payments.batchExportModal.filterMonth', 'Tháng')}
                  </label>
                  <select
                    className="batch-filter-select"
                    value={batchFilters.month}
                    onChange={e => {
                      setBatchFilters(f => ({ ...f, month: e.target.value }));
                      setSelectedInvoices([]);
                    }}
                  >
                    <option value="">{t('common.all', 'Tất cả')}</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={(i + 1).toString()}>
                        {t('common.monthNumber', { number: i + 1, defaultValue: `Tháng ${i + 1}` })}
                      </option>
                    ))}
                  </select>
                </div>

                {(batchFilters.status || batchFilters.month) && (
                  <button 
                    className="batch-filter-reset"
                    onClick={() => {
                      setBatchFilters({ status: '', month: '' });
                      setSelectedInvoices([]);
                    }}
                  >
                    <i className="fas fa-times-circle"></i>
                    {t('payments.batchExportModal.clearFilter', 'Xóa lọc')}
                  </button>
                )}
              </div>

              <div className="batch-select-header">
                <button 
                  className="btn-select-all-modal"
                  onClick={handleSelectAll}
                >
                  <i className={`fas ${selectedInvoices.length === getFilteredInvoicesForBatch().length && getFilteredInvoicesForBatch().length > 0 ? 'fa-check-square' : 'fa-square'}`}></i>
                  {selectedInvoices.length === getFilteredInvoicesForBatch().length && getFilteredInvoicesForBatch().length > 0 
                    ? t('payments.batchExportModal.deselectAll', 'Bỏ chọn tất cả') 
                    : t('payments.batchExportModal.selectAll', 'Chọn tất cả')}
                </button>
                <span className="selected-info">
                  {t('payments.batchExportModal.selected', 'Đã chọn')}: <strong>{selectedInvoices.length}</strong> / {getFilteredInvoicesForBatch().length}
                </span>
              </div>

              <div className="batch-invoice-list">
                {getFilteredInvoicesForBatch().length === 0 ? (
                  <div className="batch-empty">
                    <i className="fas fa-inbox"></i>
                    <p>{t('payments.batchExportModal.noInvoices', 'Không có hóa đơn nào phù hợp với bộ lọc')}</p>
                  </div>
                ) : (
                  getFilteredInvoicesForBatch().map(invoice => (
                    <div 
                      key={invoice._id}
                      className={`batch-invoice-item ${selectedInvoices.includes(invoice._id) ? 'selected' : ''}`}
                      onClick={() => toggleSelectInvoice(invoice._id)}
                    >
                      <div className="batch-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedInvoices.includes(invoice._id)}
                          onChange={() => {}}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="batch-invoice-info">
                      <div className="batch-invoice-main">
                        <span className="batch-room">
                          <i className="fas fa-door-open"></i>
                          {t('payments.room', 'Phòng')} {invoice.room?.roomNumber}
                        </span>
                        <span className="batch-tenant">
                          <i className="fas fa-user"></i>
                          {invoice.tenant?.fullName}
                        </span>
                      </div>
                      <div className="batch-invoice-meta">
                        <span className="batch-amount">
                          {formatCurrency(invoice.totalAmount)}
                        </span>
                        <span className={`batch-status ${invoice.status}`}>
                          {getStatusText(invoice.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                  ))
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeBatchExportModal}>
                {t('payments.cancel', 'Hủy')}
              </button>
              <button 
                className="btn-primary"
                onClick={handleBatchExport}
                disabled={selectedInvoices.length === 0 || isExporting}
              >
                {isExporting ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    {t('payments.batchExportModal.exporting', 'Đang xuất...')}
                  </>
                ) : (
                  <>
                    <i className="fas fa-file-pdf"></i>
                    {t('payments.batchExportModal.exportCount', `Xuất ${selectedInvoices.length} hóa đơn`, { count: selectedInvoices.length })}
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

export default PaymentsManagement;
