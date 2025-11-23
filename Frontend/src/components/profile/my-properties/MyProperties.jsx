import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { myPropertiesAPI } from '../../../services/myPropertiesAPI';
import PaymentAPI from '../../../services/PaymentPackageAPI';
import adminPackagePlanAPI from '../../../services/adminPackagePlanAPI';
import EditPropertyModal from '../edit-property-modal/EditPropertyModal';
import '../ProfilePages.css';
import './MyProperties.css';
import './PaymentTags.css';
import './PackageModals.css';

import { FaEllipsisV, FaComment } from "react-icons/fa";


const MyProperties = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  // States
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0
  });

  // Filters & Search
  const [filters, setFilters] = useState({
    approvalStatus: 'all', // all, pending, approved, rejected, hidden .
    sortBy: 'createdAt',
    sortOrder: 'desc',
    search: ''
  });

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingProperty, setDeletingProperty] = useState(null);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [togglingProperty, setTogglingProperty] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);

  // Package Info Modal
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);

  // Cancel Package Modal
  const [showCancelPackageModal, setShowCancelPackageModal] = useState(false);
  const [cancelingPackage, setCancelingPackage] = useState(null);

  // Current Package Info Modal
  const [showCurrentPackageModal, setShowCurrentPackageModal] = useState(false);
  const [currentPackageInfo, setCurrentPackageInfo] = useState(null);

  // Upgrade Package Modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [availablePackages, setAvailablePackages] = useState([]);
  const [hasShownUpgradeModal, setHasShownUpgradeModal] = useState(false);

  // Package History Modal
  const [showPackageHistoryModal, setShowPackageHistoryModal] = useState(false);
  const [packageHistory, setPackageHistory] = useState([]);
  const [loadingPackageHistory, setLoadingPackageHistory] = useState(false);
  const [expandedHistoryItems, setExpandedHistoryItems] = useState({}); // Track expanded state for each item

  // User package status
  const [userPackageInfo, setUserPackageInfo] = useState(null);

  // Rejected files state
  const [rejectedFiles, setRejectedFiles] = useState({ images: [], video: [] });

  // Dropdown menu state
  const [activeDropdown, setActiveDropdown] = useState(null);

  // Status options
  const statusOptions = [
    { value: 'all', label: 'Tất cả', icon: 'fa-list' },
    { value: 'pending', label: 'Chờ duyệt', icon: 'fa-clock-o' },
    { value: 'approved', label: 'Đã duyệt', icon: 'fa-check-circle' },
    { value: 'rejected', label: 'Bị từ chối', icon: 'fa-times-circle' },
    { value: 'hidden', label: 'Đã ẩn', icon: 'fa-eye-slash' }
  ];

  // Load properties on component mount and filter changes (bỏ filters.search để không tự động search)
  useEffect(() => {
    // If we have search results, re-sort them when sort options change
    if (searchResults.length > 0 && filters.search.trim()) {
      const sortedResults = sortProperties(searchResults);
      setSearchResults(sortedResults);

      // Update displayed properties for current page
      const startIndex = (pagination.page - 1) * pagination.limit;
      const endIndex = startIndex + pagination.limit;
      setProperties(sortedResults.slice(startIndex, endIndex));
    } else {
      // Normal API load when not in search mode
      loadProperties();
    }
  }, [filters.approvalStatus, filters.sortBy, filters.sortOrder, pagination.page]);

  // Load properties lần đầu khi component mount
  useEffect(() => {
    loadProperties();
    loadUserPackageInfo(); // Load thông tin gói user
  }, []);

  // Kiểm tra query parameters để tự động mở upgrade modal
  useEffect(() => {
    const openUpgradeModal = searchParams.get('openUpgradeModal');
    const selectedPlan = searchParams.get('selectedPlan');

    if (openUpgradeModal === 'true') {
      // Delay để đảm bảo component đã render xong
      setTimeout(() => {
        handleShowUpgradeModal(); // Sử dụng hàm này để load packages và mở modal
        // Xóa query params sau khi đã xử lý
        searchParams.delete('openUpgradeModal');
        searchParams.delete('selectedPlan');
        setSearchParams(searchParams);
      }, 1000);
    }
  }, [searchParams, setSearchParams]);

  // Lắng nghe thông báo cập nhật property status real-time
  useEffect(() => {
    const handlePropertyStatusChange = async (event) => {
      const { propertyId, notification } = event.detail;
      console.log('🔄 Property status change event received:', propertyId, notification);

      // Cập nhật property cụ thể thay vì reload toàn bộ danh sách
      await updateSingleProperty(propertyId, notification);
    };

    // Lắng nghe custom event
    window.addEventListener('propertyStatusChanged', handlePropertyStatusChange);

    // Cleanup listener khi component unmount
    return () => {
      window.removeEventListener('propertyStatusChanged', handlePropertyStatusChange);
    };
  }, []);

  // Hàm cập nhật một property cụ thể
  const updateSingleProperty = async (propertyId, notification) => {
    try {
      console.log('🔍 Updating single property:', propertyId);

      // Gọi API để lấy thông tin mới nhất của property này
      const response = await myPropertiesAPI.getProperty(propertyId);
      const updatedProperty = response.data;

      // Cập nhật property trong danh sách hiện tại
      setProperties(prevProperties => {
        return prevProperties.map(property => {
          if (property._id === propertyId) {
            console.log('✅ Updated property status from', property.approvalStatus, 'to', updatedProperty.approvalStatus);
            return { ...property, ...updatedProperty };
          }
          return property;
        });
      });

      // Cũng cập nhật trong search results nếu có
      setSearchResults(prevResults => {
        return prevResults.map(property => {
          if (property._id === propertyId) {
            return { ...property, ...updatedProperty };
          }
          return property;
        });
      });

      console.log('🎉 Property updated successfully without full reload');

    } catch (error) {
      console.error('❌ Error updating single property:', error);
      // Fallback: reload properties nếu cập nhật đơn lẻ thất bại
      loadProperties();
    }
  };

  // Kiểm tra URL parameter để mở modal nâng cấp từ file new property
  useEffect(() => {
    const showUpgrade = searchParams.get('showUpgradeModal');
    if (showUpgrade === 'true') {
      // Xóa parameter khỏi URL
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        newParams.delete('showUpgradeModal');
        return newParams;
      });

      // Mở modal sau một chút để đảm bảo component đã render xong
      setTimeout(() => {
        handleShowUpgradeModal();
      }, 500);
    }
  }, [searchParams, setSearchParams]);

  // Kiểm tra URL parameter để tự động mở upgrade modal từ component Pricing
  useEffect(() => {
    const autoUpgrade = searchParams.get('autoUpgrade');
    if (autoUpgrade === 'true') {
      // Xóa parameter khỏi URL
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        newParams.delete('autoUpgrade');
        return newParams;
      });

      // Mở modal sau một chút để đảm bảo component đã render xong
      setTimeout(() => {
        handleShowUpgradeModal();
      }, 800);
    }
  }, [searchParams, setSearchParams]);

  // Helper function to check if property package allows actions
  const canPropertyPerformActions = (property) => {
    // Kiểm tra tin đăng có thông tin gói không
    if (!property.packageInfo) {
      return {
        canPromote: false,
        canEdit: false,
        message: 'Tin đăng chưa có thông tin gói'
      };
    }

    // Kiểm tra tin đăng có gói plan không
    if (!property.packageInfo.plan) {
      return {
        canPromote: false,
        canEdit: false,
        message: 'Tin đăng chưa chọn gói'
      };
    }

    const packagePlan = property.packageInfo.plan;
    const packageName = packagePlan.displayName || packagePlan.name || 'Gói tin';

    // Kiểm tra gói có đang active không
    if (!property.packageInfo.isActive) {
      return {
        canPromote: false,
        canEdit: false,
        message: `${packageName} không hoạt động`
      };
    }

    // Kiểm tra xem gói của tin đăng còn hạn không
    const packageExpiryDate = property.packageInfo.expiryDate;
    if (packageExpiryDate) {
      const now = new Date();
      const expiryDate = new Date(packageExpiryDate);
      const isPackageExpired = expiryDate < now;

      if (isPackageExpired) {
        return {
          canPromote: false,
          canEdit: false,
          message: `${packageName} đã hết hạn vào ${expiryDate.toLocaleDateString('vi-VN')}`
        };
      }
    }

    // Kiểm tra gói trial đặc biệt
    const isTrialPackage = packagePlan.name === 'trial' ||
      packageName.toLowerCase().includes('thử') ||
      packageName.toLowerCase().includes('trial');

    if (isTrialPackage && !property.packageInfo.isActive) {
      return {
        canPromote: false,
        canEdit: false,
        message: 'Gói dùng thử đã hết hạn'
      };
    }

    // Nếu gói còn hạn và active, cho phép thực hiện các hành động
    return {
      canPromote: true,
      canEdit: true,
      message: `${packageName} đang hoạt động`,
      packageName: packageName,
      packagePlan: packagePlan
    };
  };

  // Load user package info
  const loadUserPackageInfo = async () => {
    try {
      const response = await myPropertiesAPI.getCurrentUserPackage();
      console.log('User package info:', response);
      if (response.success) {
        setUserPackageInfo(response.data);
      }
    } catch (error) {
      console.error('Error loading user package info:', error);
    }
  };

  // Check if user needs to upgrade when package limit reached or expired
  useEffect(() => {
    const checkUpgradeNeeded = async () => {
      if (userPackageInfo && !hasShownUpgradeModal) {
        let shouldShowUpgrade = false;

        // Kiểm tra gói đã hết hạn
        const now = new Date();
        const isExpired = userPackageInfo.expiryDate && new Date(userPackageInfo.expiryDate) < now;

        if (isExpired) {
          shouldShowUpgrade = true;
        }
        // Kiểm tra hết lượt đăng tin
        else if (userPackageInfo.propertiesLimits && userPackageInfo.propertiesLimits.length > 0) {
          const hasFullLimit = userPackageInfo.propertiesLimits.some(limit =>
            limit.used >= limit.limit
          );

          if (hasFullLimit) {
            shouldShowUpgrade = true;
          }
        }

      }
    };

    if (userPackageInfo) {
      checkUpgradeNeeded();
    }
  }, [properties, userPackageInfo, hasShownUpgradeModal]);

  // State để lưu danh sách properties gốc
  const [originalProperties, setOriginalProperties] = useState([]);

  // State để lưu toàn bộ kết quả search
  const [searchResults, setSearchResults] = useState([]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.property-dropdown-row')) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Load properties from API with custom parameters
  const loadPropertiesWithParams = async (customParams = null) => {
    try {
      setLoading(true);
      const params = customParams || {
        ...filters,
        page: pagination.page,
        limit: pagination.limit
      };

      const response = await myPropertiesAPI.getMyProperties(params);
      console.log('API response:', response);

      // Debug: Log post type info for first property
      if (response.success && response.data.properties && response.data.properties.length > 0) {
        const firstProperty = response.data.properties[0];
        console.log('First property packageInfo:', firstProperty.packageInfo);
        if (firstProperty.packageInfo?.postType) {
          console.log('Post type:', firstProperty.packageInfo.postType);
        }
      }
      if (response.success) {
        // console.log('Properties loaded:', response.data.properties);
        let loadedProperties = response.data.properties || [];

        // Apply client-side sorting for local search results
        if (params.search && params.search.trim() === '') {
          loadedProperties = sortProperties(loadedProperties);
        }

        setProperties(loadedProperties);

        // Lưu danh sách gốc khi không có search
        if (!params.search || params.search.trim() === '') {
          setOriginalProperties(loadedProperties);
        }

        // Cập nhật pagination với dữ liệu từ params nếu có
        setPagination(prev => ({
          ...prev,
          page: params.page || prev.page,
          total: response.data.pagination?.total || 0,
          totalPages: response.data.pagination?.totalPages || 0
        }));
      } else {
        toast.error('Không thể tải danh sách tin đăng');
        setProperties([]);
      }
    } catch (error) {
      console.error('Error loading properties:', error);
      toast.error('Lỗi khi tải danh sách tin đăng');
      setProperties([]);
    } finally {
      setLoading(false);
    }
  };

  // Load properties from API (wrapper for backward compatibility)
  const loadProperties = async () => {
    await loadPropertiesWithParams();
  };

  // Handle filter change
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setPagination(prev => ({
      ...prev,
      page: 1
    }));
  };

  // Handle search input change (chỉ update state, không search ngay)
  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setFilters(prev => ({
      ...prev,
      search: value
    }));
  };

  // Handle search execution (thực hiện tìm kiếm)
  const executeSearch = () => {
    const searchTerm = filters.search.trim();

    if (!searchTerm) {
      // Nếu search rỗng, reset search results và load lại từ API
      setSearchResults([]);
      setProperties([]);

      const resetParams = {
        approvalStatus: filters.approvalStatus,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        search: '',
        page: 1,
        limit: pagination.limit
      };

      loadPropertiesWithParams(resetParams);
      return;
    }

    // Kiểm tra nếu là tìm kiếm theo mã tin (6 ký tự hex)
    if (searchTerm.length === 6 && /^[a-fA-F0-9]{6}$/i.test(searchTerm)) {
      // Tìm kiếm theo ID trong danh sách hiện tại trước
      const localResult = originalProperties.filter(property =>
        property._id.slice(-6).toLowerCase() === searchTerm.toLowerCase()
      );

      if (localResult.length > 0) {
        handleSearchResults(localResult);
        return;
      }
    } else {
      // Tìm kiếm theo title trong danh sách hiện tại trước
      const localResult = originalProperties.filter(property =>
        property.title.toLowerCase().includes(searchTerm.toLowerCase())
      );

      if (localResult.length > 0) {
        handleSearchResults(localResult);
        return;
      }
    }

    // Nếu không tìm thấy local thì mới gọi API
    setPagination(prev => ({
      ...prev,
      page: 1
    }));
    loadProperties();
  };

  // Function để xử lý kết quả search và phân trang
  const handleSearchResults = (results) => {
    // Sort results according to current filters
    const sortedResults = sortProperties(results);

    setSearchResults(sortedResults);
    const totalPages = Math.ceil(sortedResults.length / pagination.limit);

    // Cập nhật pagination
    setPagination(prev => ({
      ...prev,
      page: 1,
      total: sortedResults.length,
      totalPages: totalPages
    }));

    // Hiển thị kết quả của trang đầu tiên
    const startIndex = 0;
    const endIndex = pagination.limit;
    setProperties(sortedResults.slice(startIndex, endIndex));
  };

  // Function to sort properties based on current filters
  const sortProperties = (propertiesToSort) => {
    const sorted = [...propertiesToSort];

    return sorted.sort((a, b) => {
      let aValue, bValue;

      switch (filters.sortBy) {
        case 'priority':
          // Lấy priority từ packageInfo.postType, ưu tiên số nhỏ hơn (priority cao hơn)
          aValue = a.packageInfo?.postType?.priority || 999;
          bValue = b.packageInfo?.postType?.priority || 999;
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'rentPrice':
          aValue = a.rentPrice || 0;
          bValue = b.rentPrice || 0;
          break;
        default:
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
      }

      if (filters.sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  };

  // Handle clear search - reset về trang 1 và load lại toàn bộ danh sách
  const clearSearch = () => {
    // Reset search term
    setFilters(prev => ({ ...prev, search: '' }));

    // Reset search results
    setSearchResults([]);

    // Reset properties
    setProperties([]);

    // Load lại danh sách từ API với params reset
    const resetParams = {
      approvalStatus: filters.approvalStatus,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      search: '', // Reset search term
      page: 1,
      limit: pagination.limit
    };

    loadPropertiesWithParams(resetParams);
  };

  // Handle Enter key press
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      executeSearch();
    }
  };

  // Handle edit property
  const handleEdit = async (property) => {
    try {
      const response = await myPropertiesAPI.getPropertyForEdit(property._id);

      if (response.success) {
        setEditingProperty(response.data);
        setShowEditModal(true);
      } else {
        toast.error('Không thể tải thông tin tin đăng để chỉnh sửa');
      }
    } catch (error) {
      console.error('Error loading property for edit:', error);
      toast.error('Lỗi khi tải thông tin tin đăng');
    }
  };

  // Handle delete confirmation
  const handleDeleteConfirm = (property) => {
    setDeletingProperty(property);
    setShowDeleteModal(true);
  };

  // Handle delete property
  const handleDelete = async () => {
    if (!deletingProperty) return;

    try {
      const response = await myPropertiesAPI.deleteProperty(deletingProperty._id);
      if (response.success) {
        toast.success('Đã xóa tin đăng thành công');
        setShowDeleteModal(false);
        setDeletingProperty(null);
        loadProperties(); // Reload list
      } else {
        toast.error(response.message || 'Không thể xóa tin đăng');
      }
    } catch (error) {
      console.error('Error deleting property:', error);
      toast.error('Lỗi khi xóa tin đăng');
    }
  };

  // Handle dropdown toggle
  const handleDropdownToggle = (propertyId) => {
    console.log('Dropdown toggle clicked for property:', propertyId);
    console.log('Current activeDropdown:', activeDropdown);
    setActiveDropdown(activeDropdown === propertyId ? null : propertyId);
  };

  // Handle promote property to top
  const handlePromoteProperty = async (property) => {
    try {
      // Đóng dropdown
      setActiveDropdown(null);

      // Call API để promote property lên đầu trang
      const response = await myPropertiesAPI.promotePropertyToTop(property._id);

      if (response.success) {
        // Thông báo thành công với thông tin lượt đẩy và gói
        const pushInfo = response.data?.pushCount;
        const packageName = response.data?.packageName;
        let successMessage = 'Đã đưa tin đăng lên đầu trang thành công';

        if (packageName) {
          successMessage += ` (${packageName})`;
        }

        if (pushInfo) {
          successMessage += ` - Còn lại ${pushInfo.remaining} lượt đẩy`;
        }

        toast.success(successMessage);

        // Reload properties để cập nhật thứ tự
        loadProperties();

        // Cập nhật thông tin gói nếu có để hiển thị lượt đẩy mới
        if (pushInfo && userPackageInfo) {
          setUserPackageInfo(prev => ({
            ...prev,
            usedPushCount: pushInfo.used,
            freePushCount: pushInfo.total
          }));
        }
      } else {
        toast.error(response.message || 'Không thể đưa tin đăng lên đầu trang');
      }
    } catch (error) {
      console.error('Error promoting property:', error);

      // Xử lý các loại lỗi cụ thể từ backend
      if (error.response && error.response.data) {
        const errorData = error.response.data;

        // Hiển thị thông báo lỗi chi tiết từ backend
        if (errorData.message) {
          toast.error(errorData.message);
        } else {
          toast.error('Lỗi khi đưa tin đăng lên đầu trang');
        }

        // Nếu có thông tin về lượt đẩy trong lỗi, hiển thị thêm
        if (errorData.data && errorData.data.usedPushCount !== undefined) {
          const { usedPushCount, freePushCount } = errorData.data;
          console.log(`Push count info: ${usedPushCount}/${freePushCount}`);
        }
      } else {
        toast.error('Lỗi kết nối khi đưa tin đăng lên đầu trang');
      }
    }
  };

  // Handle payment - redirect to payment page
  const handlePayment = (property) => {
    // Đóng dropdown nếu đang mở
    setActiveDropdown(null);

    // Navigate to payment page - không cần propertyId vì thanh toán cho toàn bộ tài khoản
    window.location.href = `/profile/properties-package`;
  };

  // Handle toggle status confirmation
  const handleToggleStatusConfirm = (property) => {
    setTogglingProperty(property);
    setShowToggleModal(true);
  };

  // Handle toggle status (hide/show)
  const handleToggleStatus = async () => {
    if (!togglingProperty) return;

    try {
      const response = await myPropertiesAPI.togglePropertyStatus(togglingProperty._id);
      if (response.success) {
        const action = togglingProperty.status === 'available' ? 'ẩn' : 'hiện';
        toast.success(`Đã ${action} tin đăng`);
        setShowToggleModal(false);
        setTogglingProperty(null);
        loadProperties(); // Reload list
      } else {
        toast.error(response.message || 'Không thể thay đổi trạng thái');
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Lỗi khi thay đổi trạng thái');
    }
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    setPagination(prev => ({
      ...prev,
      page: newPage
    }));

    // Chỉ sử dụng search results khi có dữ liệu search và search term không rỗng
    if (searchResults.length > 0 && filters.search.trim()) {
      // Apply sort to search results before pagination
      const sortedResults = sortProperties(searchResults);
      const startIndex = (newPage - 1) * pagination.limit;
      const endIndex = startIndex + pagination.limit;
      setProperties(sortedResults.slice(startIndex, endIndex));
    }
    // Nếu không có search results hoặc search rỗng, useEffect sẽ tự động load từ API
  };

  // Handle view property detail
  const handleViewDetail = (property) => {
    setSelectedProperty(property);
    setShowDetailModal(true);
  };

  // Handle view package info
  const handleViewPackageInfo = (property) => {
    setSelectedPackage(property);
    setShowPackageModal(true);
  };

  // Handle cancel package confirmation
  const handleCancelPackageConfirm = (property) => {
    setCancelingPackage(property);
    setShowCancelPackageModal(true);
    setShowPackageModal(false); // Đóng modal thông tin gói
  };

  // Handle cancel package
  const handleCancelPackage = async () => {
    if (!cancelingPackage) return;

    try {
      const response = await myPropertiesAPI.cancelPropertyPackage(cancelingPackage._id);
      if (response.success) {
        toast.success('Đã hủy gói tin thành công');
        setShowCancelPackageModal(false);
        setCancelingPackage(null);
        loadProperties(); // Reload list để cập nhật trạng thái
      } else {
        toast.error(response.message || 'Không thể hủy gói tin');
      }
    } catch (error) {
      console.error('Error canceling package:', error);
      toast.error('Lỗi khi hủy gói tin');
    }
  };

  // Handle view current package info
  const handleViewCurrentPackage = async () => {
    try {
      // Refresh thông tin gói trước khi hiển thị
      await loadUserPackageInfo();

      // API call để lấy thông tin gói hiện tại của user
      const response = await myPropertiesAPI.getCurrentUserPackage();
      console.log('Current package info:', response);
      if (response.success) {
        setCurrentPackageInfo(response.data);
        setShowCurrentPackageModal(true);
      } else {
        toast.error('Không thể tải thông tin gói tin');
      }
    } catch (error) {
      console.error('Error loading current package:', error);
      toast.error('Lỗi khi tải thông tin gói tin');
    }
  };

  // Handle show upgrade modal
  const handleShowUpgradeModal = async () => {
    try {
      // API call để lấy danh sách gói có sẵn
      const response = await adminPackagePlanAPI.getAvailablePackages();
      console.log('Available packages:', response.data);
      if (response.success) {
        setAvailablePackages(response.data || []);
        setShowUpgradeModal(true);
      } else {
        toast.error('Không thể tải danh sách gói tin');
      }
    } catch (error) {
      console.error('Error loading available packages:', error);
      toast.error('Lỗi khi tải danh sách gói tin');
    }
  };

  // Handle show package history modal
  const handleShowPackageHistoryModal = async () => {
    try {
      setLoadingPackageHistory(true);
      setShowPackageHistoryModal(true);

      // API call để lấy lịch sử gói
      const response = await PaymentAPI.getPackageHistory();
      console.log('Package history response:', response);

      if (response.success) {
        setPackageHistory(response.data.packageHistory || []);
        console.log('Package history loaded:', response.data.packageHistory);
      } else {
        toast.error('Không thể tải lịch sử gói tin');
        setPackageHistory([]);
      }
    } catch (error) {
      console.error('Error loading package history:', error);
      toast.error('Lỗi khi tải lịch sử gói tin');
      setPackageHistory([]);
    } finally {
      setLoadingPackageHistory(false);
    }
  };

  // Handle toggle package history expansion for individual items
  const handleToggleHistoryItemExpansion = (index) => {
    setExpandedHistoryItems(prev => {
      // Nếu item hiện tại đang mở, đóng nó
      if (prev[index]) {
        return {
          ...prev,
          [index]: false
        };
      }

      // Nếu item hiện tại đang đóng, đóng tất cả các item khác và mở item này
      return {
        [index]: true
      };
    });
  };

  // Handle close package history modal
  const handleClosePackageHistoryModal = () => {
    setShowPackageHistoryModal(false);
    setExpandedHistoryItems({}); // Reset all expansion states
  };

  // Handle upgrade package
  const handleUpgradePackage = (packagePlan) => {
    console.log('Upgrading to package:', packagePlan);
    const packageId = packagePlan._id || packagePlan.id;
    if (!packageId) {
      console.error('Package ID not found:', packagePlan);
      toast.error('Lỗi: Không tìm thấy ID gói tin');
      return;
    }

    // Chuyển đến trang payment với package đã chọn và thông tin bổ sung
    // Upgrade không cần propertyId vì là nâng cấp cho toàn bộ tài khoản
    const params = new URLSearchParams({
      packageId: packageId,
      upgrade: 'true',
      packageName: packagePlan.displayName || packagePlan.name,
      packagePrice: packagePlan.price || packagePlan.dailyPrice || 0,
      durationUnit: packagePlan.durationUnit || 'month',
      duration: packagePlan.duration ? packagePlan.duration.toString() : '1' // Số lượng tương ứng với đơn vị
    });

    window.location.href = `/profile/properties-package?${params.toString()}`;
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { class: 'status-pending', text: 'Chờ duyệt', icon: 'fa-regular fa-clock' },
      approved: { class: 'status-approved', text: 'Đã duyệt', icon: 'fa-check-circle' },
      rejected: { class: 'status-rejected', text: 'Bị từ chối', icon: 'fa-times-circle' },
      hidden: { class: 'status-hidden', text: 'Đã ẩn', icon: 'fa-eye-slash' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`status-badge-my-properties ${config.class}`}>
        <i className={`fa ${config.icon}`}></i>
        {config.text}
      </span>
    );
  };

  // Format price
  const formatPrice = (price) => {
    if (price === 0) {
      return 'Miễn phí';
    }
    return new Intl.NumberFormat('vi-VN').format(price);
  };

  // Format large numbers for stats (views, comments, favorites)
  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  // Calculate total posts from propertiesLimits
  const getTotalPosts = (propertiesLimits) => {
    if (!propertiesLimits || !Array.isArray(propertiesLimits)) {
      return 0;
    }
    return propertiesLimits.reduce((total, limit) => total + (limit.limit || 0), 0);
  };

  // Format price with currency (handles free packages)
  const formatPriceWithCurrency = (price) => {
    if (price === 0) {
      return 'Miễn phí';
    }
    return `${formatPrice(price)} VNĐ`;
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate days remaining until expiry
  const getDaysRemaining = (expiryDate) => {

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to start of day for accurate comparison

    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0); // Reset to start of day for accurate comparison

    const diffTime = expiry - today;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return 'Đã hết hạn';
    } else if (diffDays === 0) {
      return 'Hết hạn hôm nay';
    } else if (diffDays === 1) {
      return 'Còn 1 ngày';
    } else {
      return `Còn ${diffDays} ngày`;
    }
  };

  // Get CSS class based on days remaining
  const getDaysRemainingClass = (expiryDate) => {
    if (!expiryDate) {
      return 'permanent';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to start of day for accurate comparison

    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0); // Reset to start of day for accurate comparison

    const diffTime = expiry - today;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return 'expired';
    } else if (diffDays <= 3) {
      return 'critical';
    } else if (diffDays <= 7) {
      return 'warning';
    } else {
      return 'safe';
    }
  };

  // Check if package is expired
  const isPackageExpired = (property) => {
    if (!property.packageInfo || !property.packageInfo.expiryDate) {
      return false;
    }

    const now = new Date();
    const expiryDate = new Date(property.packageInfo.expiryDate);

    return now > expiryDate;
  };

  // Get package type info
  const getPackageTypeInfo = (type) => {
    const packageTypeOptions = {
      basic: { label: 'GÓI CƠ BẢN', color: '#28a745' },
      vip: { label: 'GÓI VIP', color: '#ffc107' },
      premium: { label: 'GÓI PREMIUM', color: '#dc3545' },
      custom: { label: 'TÙY CHỈNH', color: '#6c757d' },
      trial: { label: 'GÓI DÙNG THỬ', color: '#17a2b8' }
    };
    return packageTypeOptions[type] || { label: type?.toUpperCase(), color: '#000000ff' };
  };

  // Get post type info with priority and styling
  const getPostTypeInfo = (postType) => {
    if (!postType) return null;

    // Map priority to CSS class and star count
    const getPriorityInfo = (priority) => {
      console.log('Getting priority info for priority:', priority);
      if (priority <= 1) return { class: 'post-type-vip-dac-biet' };
      if (priority <= 2) return { class: 'post-type-vip-noi-bat' };
      if (priority <= 3) return { class: 'post-type-vip-1' };
      if (priority <= 4) return { class: 'post-type-vip-2' };
      if (priority <= 5) return { class: 'post-type-vip-3' };
      return { class: 'post-type-thuong' };
    };

    const priorityInfo = getPriorityInfo(postType.priority || 5);

    return {
      displayName: postType.displayName || postType.name,
      name: postType.name,
      priority: postType.priority || 5,
      color: postType.color || '#6c757d',
      cssClass: priorityInfo.class,
      stars: postType.stars,
      _id: postType._id
    };
  };

  // Format duration display
  const formatDuration = (packageInfo) => {
    console.log('Formatting duration for packageInfo:', packageInfo);
    if (packageInfo.duration && packageInfo.durationUnit) {
      const unitLabels = {
        'day': 'ngày',
        'month': 'tháng',
        'year': 'năm'
      };
      return `${packageInfo.duration} ${unitLabels[packageInfo.durationUnit]}`;
    } else if (packageInfo.durationDays) {
      return `${packageInfo.durationDays} ngày`;
    } else {
      return '1 tháng';
    }
  };

  return (
    <div className="profile-page">
      <div className="page-header-my-properties">
        <h2>
          <i className="fa fa-list"></i>
          Quản lý tin đăng của tôi
        </h2>
        <p>Xem và quản lý các tin đăng cho thuê phòng trọ của bạn</p>
      </div>

      <div className="content-card-my-properties">
        <div className="package-plan-using">
          <button
            className="btn-current-package"
            onClick={handleViewCurrentPackage}
          >
            <i className="fa fa-star"></i>
            {userPackageInfo
              ? userPackageInfo.packageType === 'trial'
                ? 'GÓI DÙNG THỬ'
                : userPackageInfo.packageType === 'expired'
                  ? `${userPackageInfo.displayName?.toUpperCase()} (ĐÃ HẾT HẠN)`
                  : userPackageInfo.displayName?.toUpperCase() || 'GÓI ĐANG SỬ DỤNG'
              : 'GÓI ĐANG SỬ DỤNG'}

          </button>
          <button
            className="btn-upgrade-package"
            onClick={handleShowUpgradeModal}
          >
            <i className="fa fa-arrow-up"></i>
            {userPackageInfo?.packageType === 'trial' ? 'NÂNG CẤP GÓI' : 'THAY ĐỔI GÓI'}
          </button>

          <button
            className="btn-upgrade-package-history"
            onClick={handleShowPackageHistoryModal}
          >
            <i className="fa fa-history"></i>
            <span>GÓI ĐÃ SỬ DỤNG</span>
          </button>
        </div>

        {/* Upgrade Notification */}
        {userPackageInfo && (
          <div>
            {/* Package limit or expiry notification cho user */}
            {userPackageInfo && (() => {
              // Kiểm tra hết hạn
              const now = new Date();
              const isExpired = userPackageInfo.expiryDate && new Date(userPackageInfo.expiryDate) < now;

              // Kiểm tra hết lượt đăng tin
              let isOutOfLimit = false;
              let limitMessage = '';

              if (userPackageInfo.propertiesLimits && userPackageInfo.propertiesLimits.length > 0) {
                const fullLimits = userPackageInfo.propertiesLimits.filter(limit =>
                  limit.used >= limit.limit
                );

                if (fullLimits.length > 0) {
                  isOutOfLimit = true;
                  if (fullLimits.length === userPackageInfo.propertiesLimits.length) {
                    limitMessage = 'Bạn đã sử dụng hết lượt đăng tin trong gói.';
                  }
                }
              }

              // Hiển thị notification cho gói hết hạn
              if (isExpired) {
                return (
                  <div className="upgrade-notification">
                    <div className="notification-content">
                      <i className="fa fa-exclamation-triangle"></i>
                      <span>
                        {userPackageInfo.packageName === 'trial'
                          ? 'Gói dùng thử của bạn đã hết hạn.'
                          : `${userPackageInfo.displayName} đã hết hạn.`}
                        <strong> {userPackageInfo.packageName === 'trial' ? 'Nâng cấp' : 'Gia hạn'} gói để tiếp tục hiển thị tin, đăng thêm tin mới!</strong>
                      </span>
                      <button
                        className="btn-notification-upgrade"
                        onClick={() => {
                          if (userPackageInfo.packageType === 'expired' && userPackageInfo.packageName !== 'trial') {
                            // Navigate directly to renewal page for expired packages
                            const params = new URLSearchParams({
                              renewal: 'true',
                              packageType: 'expired',
                              packageName: userPackageInfo.displayName || userPackageInfo.packageName,
                              expiredPackageId: userPackageInfo.packageId || userPackageInfo._id,
                              // Thêm thông tin gói để tính giá
                              packagePrice: userPackageInfo.price || 0,
                              durationUnit: userPackageInfo.durationUnit || 'month',
                              duration: userPackageInfo.duration ? userPackageInfo.duration.toString() : '1',

                            });
                            window.location.href = `/profile/properties-package?${params.toString()}`;
                          } else {
                            // Show upgrade modal for trial packages
                            handleShowUpgradeModal();
                          }
                        }}
                      >
                        <i className="fa fa-arrow-up"></i>
                        <span>{userPackageInfo.packageName === 'trial' ? 'Nâng cấp ngay' : 'Gia hạn ngay'}</span>
                      </button>
                    </div>
                  </div>
                );
              }

              // Hiển thị notification cho hết lượt đăng tin
              if (isOutOfLimit) {
                return (
                  <div className="upgrade-notification">
                    <div className="notification-content">
                      <i className="fa fa-exclamation-triangle"></i>
                      <span>
                        {limitMessage}
                        <strong> Nâng cấp gói để mở rộng thêm số lượng tin đăng!</strong>
                      </span>
                      <button
                        className="btn-notification-upgrade"
                        onClick={() => {
                          // Always show upgrade modal for out of limit cases
                          handleShowUpgradeModal();
                        }}
                      >
                        <i className="fa fa-arrow-up"></i>
                        <span>Nâng cấp ngay</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return null;
            })()}

            {/* Paid package success notification */}
            {userPackageInfo.packageType && (
              <div className="package-success-notification">
                <div className="notification-content">
                  {userPackageInfo.packageType !== 'expired' && (
                    <>
                      <i className="fa fa-check-circle"></i>
                      <span>
                        Bạn đang sử dụng <strong>{userPackageInfo.displayName}</strong>.
                        Tận hưởng các quyền lợi đặc biệt!
                      </span>
                    </>
                  )}
                  <div className="package-stats">
                    <span className="stat-item">
                      <i className="fa fa-list"></i>
                      Đã đăng: {properties.length} tin
                    </span>
                    <span className="stat-item">
                      <i className="fa fa-calendar"></i>
                      Hết hạn: {userPackageInfo.expiryDate ? (() => {
                        const now = new Date();
                        const expiryDate = new Date(userPackageInfo.expiryDate);
                        const isExpired = now > expiryDate;
                        return isExpired ? 'Đã hết hạn' : expiryDate.toLocaleDateString('vi-VN');
                      })() : 'Vô thời hạn'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filters & Search */}
        <div className="properties-controls">
          <div className="controls-left">
            <div className="search-box">
              <i className="fa fa-search"></i>
              <input
                type="text"
                placeholder="Tìm kiếm theo tiêu đề hoặc mã tin (6 ký tự)..."
                value={filters.search}
                onChange={handleSearchInputChange}
                onKeyPress={handleSearchKeyPress}
                title="Nhập tiêu đề để tìm theo tên hoặc nhập 6 ký tự cuối của mã tin để tìm chính xác. Ấn Enter hoặc click nút tìm kiếm để thực hiện."
              />
              {filters.search && (
                <button
                  type="button"
                  className="clear-search-btn-my-properties"
                  onClick={clearSearch}
                  title="Xóa tìm kiếm"
                >
                  <i className="fa fa-times"></i>
                </button>
              )}
              <button
                type="button"
                className="search-btn-my-properties"
                onClick={executeSearch}
                title="Tìm kiếm"
              >
                <i className="fa fa-search"></i>
              </button>
              {filters.search && filters.search.length === 6 && /^[a-fA-F0-9]{6}$/i.test(filters.search) && (
                <div className="search-hint">
                  <i className="fa fa-info-circle"></i>
                  <span>Đang tìm theo mã tin</span>
                </div>
              )}
            </div>
          </div>

          <div className="controls-right">
            <div className="filter-group-my-properties">
              <label>Trạng thái:</label>
              <select
                value={filters.approvalStatus}
                onChange={(e) => handleFilterChange('approvalStatus', e.target.value)}
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group-my-properties">
              <label>Sắp xếp:</label>
              <select
                value={`${filters.sortBy}_${filters.sortOrder}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split('_');
                  setFilters(prev => ({
                    ...prev,
                    sortBy,
                    sortOrder
                  }));
                }}
              >
                <option value="createdAt_desc">Mới nhất</option>
                <option value="createdAt_asc">Cũ nhất</option>
                <option value="title_asc">Tiêu đề A-Z</option>
                <option value="title_desc">Tiêu đề Z-A</option>
                <option value="rentPrice_desc">Giá cao nhất</option>
                <option value="rentPrice_asc">Giá thấp nhất</option>
              </select>
            </div>
          </div>
        </div>

        {/* Properties List */}
        <div className="properties-content">
          {loading ? (
            <div className="loading-state">
              <i className="fa fa-spinner fa-spin"></i>
              <p>Đang tải danh sách tin đăng...</p>
            </div>
          ) : properties.length === 0 ? (
            <div className="empty-state">
              <i className="fa fa-home"></i>
              <h3>Chưa có tin đăng nào</h3>
              <p>Bạn chưa có tin đăng nào. Hãy tạo tin đăng mới để bắt đầu!</p>
            </div>
          ) : (
            <>
              <div className="properties-list">
                {properties.map(property => (
                  <div key={property._id} className="property-row">
                    {/* Image Section - Left */}
                    <div className="property-image-section">
                      {property.images && property.images.length > 0 ? (
                        <img
                          src={property.images[0]}
                          alt={property.title}
                          className="property-thumbnail"
                          onError={(e) => {
                            e.target.src = '/images/placeholder.jpg';
                          }}
                        />
                      ) : (
                        <div className="no-image-placeholder">
                          <i className="fa fa-home"></i>
                        </div>
                      )}

                      {/* Property ID Overlay */}
                      <div className="property-id-overlay">
                        <span className="id-badge">
                          <i className="fa fa-tag"></i>
                          #{property._id.slice(-6).toUpperCase()}
                        </span>
                      </div>
                      {/* Package Status */}
                      <div className="property-id-overlay-status-payment">
                        {property.packageInfo && (
                          <div className="payment-status-inline">
                            {(() => {
                              // Kiểm tra xem tin này có packageInfo không
                              if (!property.packageInfo.plan) {
                                return (
                                  <span className="status-tag unpaid">
                                    <i className="fa fa-exclamation-triangle"></i>
                                    CẦN CHỌN GÓI
                                  </span>
                                );
                              }

                              // Kiểm tra xem tin này có đang active không
                              if (property.packageInfo.isActive) {
                                return (
                                  <span className="status-tag paid">
                                    <i className="fa fa-check-circle"></i>
                                    {property.packageInfo.plan?.displayName?.toUpperCase() || 'ĐÃ THANH TOÁN'}
                                  </span>
                                );
                              }

                              // Kiểm tra xem tin này có phải từ gói trial không (dựa vào plan name hoặc packageType)
                              const isTrialPost = property.packageInfo.plan?.name === 'trial' ||
                                property.packageInfo.plan?.displayName?.toLowerCase().includes('thử') ||
                                property.packageInfo.plan?.displayName?.toLowerCase().includes('trial');

                              if (isTrialPost) {
                                return (
                                  <span className="status-tag expired">
                                    <i className="fa fa-gift"></i>
                                    GÓI DÙNG THỬ - HẾT HẠN
                                  </span>
                                );
                              }

                              // Các tin khác đã hết hạn
                              return (
                                <span className="status-tag expired">
                                  <i className="fa-solid fa-circle-exclamation"></i>
                                  {property.packageInfo.plan?.displayName?.toUpperCase() || 'GÓI'} HẾT HẠN
                                </span>
                              );
                            })()}
                          </div>
                        )}

                      </div>
                      {/* Post Type Badge */}
                      <div className="property-id-overlay-post-type">
                        {property.packageInfo && property.packageInfo.postType && (
                          <div className="post-type-inline">
                            {(() => {
                              const postType = property.packageInfo.postType;
                              console.log('Post type for property', property._id, ':', postType);
                              if (!postType) return null;

                              // Tính số sao từ priority trực tiếp từ API
                              const priority = postType.priority || 10;
                              const stars = priority <= 6 ? Math.max(0, Math.min(5, 6 - priority)) : 0;
                              const bgColor = postType.color || '#6c757d';

                              return (
                                <span
                                  className={`post-type-badge-my-properties ${stars > 0 ? 'has-stars' : ''}`}
                                  style={{
                                    backgroundColor: bgColor,
                                    color: '#fff',
                                    border: `2px solid ${bgColor}`,
                                    fontWeight: 'bold'
                                  }}
                                >
                                  {stars > 0 && (
                                    <div className="post-type-stars-my-properties">
                                      {[...Array(stars)].map((_, index) => (
                                        <i key={index} className="fa fa-star star-icon-my-properties"></i>
                                      ))}
                                    </div>
                                  )}
                                  {postType.displayName}

                                </span>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Content Section - Center */}
                    <div className="property-content-section">
                      <div className="property-header-row">
                        <h3 className="property-title-row">{property.title}</h3>
                        <div className="status-group-row">
                          <div className="property-status-row">
                            {getStatusBadge(property.approvalStatus)}
                          </div>

                        </div>
                      </div>

                      <div className="property-details-row">
                        <div className="price-area-group">
                          <div className="price-info-my-properties">
                            <i className="fa fa-money"></i>
                            {property.promotionPrice && property.promotionPrice > 0 ? (
                              <div className="price-with-promotion">
                                <span className="original-price-my-properties">{formatPrice(property.rentPrice)}</span>
                                <span className="promotion-price">{formatPrice(property.promotionPrice)} VNĐ/tháng</span>
                              </div>
                            ) : (
                              <span className="price-text">{formatPrice(property.rentPrice)} VNĐ/tháng</span>
                            )}
                          </div>
                          <div className="area-info">
                            <i className="fa fa-expand"></i>
                            <span>{property.area}m²</span>
                          </div>
                        </div>

                        <div className="location-row">
                          <i className="fa fa-map-marker"></i>
                          <span className="location-text">
                            {property.detailAddress && `${property.detailAddress}, `}{property.ward}, {property.province}
                          </span>
                        </div>
                      </div>

                      <div className="property-meta-row">
                        <div className="meta-left">
                          <div className="date-info">
                            <i className="fa fa-calendar"></i>
                            <span>Đăng: {formatDate(property.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="property-meta-row">
                        <div className="property-stats-row">
                          <div className="stat-item-row">
                            <i className="fa fa-eye"></i>
                            <span>{formatNumber(property.views || 0)}</span>
                          </div>
                          <div className="stat-item-row">
                            <i className="fa fa-comment"></i>
                            <span>{formatNumber(property.comments || 0)}</span>
                          </div>
                          <div className="stat-item-row">
                            <i className="fa fa-heart"></i>
                            <span>{formatNumber(property.favorites || 0)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions Section - Right */}
                    <div className="property-actions-section">
                      <div className="actions-top">
                        {/* Dropdown Menu */}
                        {(property.approvalStatus === 'pending' || property.approvalStatus === 'approved' || property.approvalStatus === 'rejected') && (
                          <div className="property-dropdown-row">
                            <button
                              className="dropdown-toggle-row"
                              onClick={() => handleDropdownToggle(property._id)}
                            >
                              <FaEllipsisV />
                            </button>

                            {activeDropdown === property._id && (
                              <div className="dropdown-menu-row">
                                {property.approvalStatus === 'approved' && (() => {
                                  const packageCheck = canPropertyPerformActions(property);
                                  return (
                                    <>
                                      {packageCheck.canPromote ? (
                                        <button
                                          className="dropdown-item-row"
                                          onClick={() => handlePromoteProperty(property)}
                                          title={packageCheck.message}
                                        >
                                          <i className="fa fa-arrow-up"></i>
                                          Đẩy tin
                                        </button>
                                      ) : (
                                        <button
                                          className="dropdown-item-row disabled"
                                          disabled
                                          title={packageCheck.message}
                                          style={{
                                            opacity: 0.5,
                                            cursor: 'not-allowed',
                                            color: '#999'
                                          }}
                                        >
                                          <i className="fa fa-arrow-up"></i>
                                          Đẩy tin ({packageCheck.packageName ? `${packageCheck.packageName} hết hạn` : 'Gói hết hạn'})
                                        </button>
                                      )}
                                      <button
                                        className="dropdown-item-row"
                                        onClick={() => handleToggleStatusConfirm(property)}
                                      >
                                        <i className={`fa ${property.status === 'available' ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                        {property.status === 'available' ? 'Ẩn tin' : 'Hiện tin'}
                                      </button>
                                    </>
                                  );
                                })()}

                                <button
                                  className="dropdown-item-row delete-item"
                                  onClick={() => handleDeleteConfirm(property)}
                                >
                                  <i className="fa fa-trash"></i>
                                  Xóa tin đăng
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="actions-main">

                        {/* Edit Button */}
                        {(() => {
                          const packageCheck = canPropertyPerformActions(property);

                          // Nếu bài đăng bị từ chối, luôn cho phép sửa
                          if (property.approvalStatus === 'rejected') {
                            return (
                              <button
                                className="btn-row btn-edit-row"
                                onClick={() => handleEdit(property)}
                                title="Sửa bài đăng bị từ chối để gửi lại duyệt"
                              >
                                <i className="fa fa-edit"></i>
                                Sửa
                              </button>
                            );
                          }

                          // Với các trạng thái khác, kiểm tra gói như cũ
                          return packageCheck.canEdit ? (
                            <button
                              className="btn-row btn-edit-row"
                              onClick={() => handleEdit(property)}
                              title={packageCheck.message}
                            >
                              <i className="fa fa-edit"></i>
                              Sửa
                            </button>
                          ) : (
                            <button
                              className="btn-row btn-edit-row disabled"
                              disabled
                              title={packageCheck.message}
                              style={{
                                opacity: 0.5,
                                cursor: 'not-allowed',
                                backgroundColor: '#f5f5f5',
                                color: '#999',
                                border: '1px solid #000000ff'
                              }}
                            >
                              <i className="fa fa-edit"></i>
                              Sửa ({packageCheck.packageName ? `${packageCheck.packageName} hết hạn` : 'Gói hết hạn'})
                            </button>
                          );
                        })()}

                        {/* Rejected Status - Nút phụ để xem lý do */}
                        {property.approvalStatus === 'rejected' && (
                          <button
                            className="btn-row btn-reason-row secondary"
                            onClick={() => handleViewDetail(property)}
                            title="Xem chi tiết lý do từ chối"
                          >
                            <i className="fa fa-info-circle"></i>
                            Lý do từ chối
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="pagination-container-my-properties">
                  <div className="pagination-my-properties">
                    <button
                      className="pagination-btn-my-properties"
                      disabled={pagination.page === 1}
                      onClick={() => handlePageChange(pagination.page - 1)}
                    >
                      <i className="fa fa-chevron-left"></i>
                      Trước
                    </button>

                    {/* Page Numbers */}
                    <div className="pagination-numbers">
                      {(() => {
                        const totalPages = pagination.totalPages;
                        const currentPage = pagination.page;
                        const pages = [];

                        // Logic để hiển thị các trang
                        if (totalPages <= 7) {
                          // Nếu tổng số trang <= 7, hiển thị tất cả
                          for (let i = 1; i <= totalPages; i++) {
                            pages.push(i);
                          }
                        } else {
                          // Nếu > 7 trang, hiển thị thông minh
                          if (currentPage <= 4) {
                            // Trang hiện tại ở đầu: 1 2 3 4 5 ... last
                            for (let i = 1; i <= 5; i++) {
                              pages.push(i);
                            }
                            pages.push('...');
                            pages.push(totalPages);
                          } else if (currentPage >= totalPages - 3) {
                            // Trang hiện tại ở cuối: 1 ... n-4 n-3 n-2 n-1 n
                            pages.push(1);
                            pages.push('...');
                            for (let i = totalPages - 4; i <= totalPages; i++) {
                              pages.push(i);
                            }
                          } else {
                            // Trang hiện tại ở giữa: 1 ... current-1 current current+1 ... last
                            pages.push(1);
                            pages.push('...');
                            for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                              pages.push(i);
                            }
                            pages.push('...');
                            pages.push(totalPages);
                          }
                        }

                        return pages.map((page, index) => {
                          if (page === '...') {
                            return (
                              <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                                ...
                              </span>
                            );
                          }

                          return (
                            <button
                              key={page}
                              className={`pagination-number-btn ${page === currentPage ? 'active' : ''}`}
                              onClick={() => handlePageChange(page)}
                              disabled={page === currentPage}
                            >
                              {page}
                            </button>
                          );
                        });
                      })()}
                    </div>
                    <button
                      className="pagination-btn-my-properties"
                      disabled={pagination.page === pagination.totalPages}
                      onClick={() => handlePageChange(pagination.page + 1)}
                    >
                      Sau
                      <i className="fa fa-chevron-right"></i>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Current Package Info Modal có thông tin gói tin hiện tại */}
      {showCurrentPackageModal && currentPackageInfo && (
        <div className="modal-overlay-current-package" onClick={() => setShowCurrentPackageModal(false)}>
          <div className="current-package-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-current-package">
              <h2>
                <i className="fa fa-star"></i>
                Gói tin đang sử dụng
              </h2>
              <button
                className="close-btn-current-package"
                onClick={() => setShowCurrentPackageModal(false)}
              >
                <i className="fa fa-times"></i>
              </button>
            </div>

            <div className="modal-content-current-package">
              <div className="current-package-info">


                <div className="paid-package-info">
                  <div className="package-header-paid">
                    <div className="package-badge-paid" style={{ backgroundColor: 'black' }}>
                      <i className="fa fa-star"></i>
                      {currentPackageInfo.packageType === 'expired'
                        ? `${currentPackageInfo.displayName} (ĐÃ HẾT HẠN)`
                        : currentPackageInfo.displayName}
                    </div>
                    <div className="package-price">
                      <span className="price-amount-my-properties">{formatPriceWithCurrency(currentPackageInfo.price)}</span>
                      <span className="price-period-my-properties">/{formatDuration(currentPackageInfo)}</span>
                    </div>
                  </div>

                  <div className="package-timeline-current">
                    <div className="timeline-item-current">
                      <i className="fa fa-play-circle text-success"></i>
                      <div className="timeline-content">
                        <strong>Ngày bắt đầu</strong>
                        <span>{formatDate(currentPackageInfo.startDate)}</span>
                      </div>
                    </div>
                    <div className="timeline-item-current">
                      <i className="fa fa-stop-circle text-danger"></i>
                      <div className="timeline-content">
                        <strong>Ngày hết hạn</strong>
                        <span>{formatDate(currentPackageInfo.expiryDate)}</span>
                      </div>
                    </div>
                    <div className="timeline-item-current">
                      <i className={`fa fa-clock ${getDaysRemainingClass(currentPackageInfo.expiryDate)}`}></i>
                      <div className="timeline-content">
                        <strong>Thời gian còn lại</strong>
                        <span className={`remaining-text ${getDaysRemainingClass(currentPackageInfo.expiryDate)}`}>
                          {getDaysRemaining(currentPackageInfo.expiryDate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="package-usage-stats">
                    <h4>
                      <i className="fa fa-chart-bar"></i>
                      Thống kê sử dụng
                    </h4>
                    <div className="usage-grid">
                      {currentPackageInfo.propertiesLimits && currentPackageInfo.propertiesLimits.map((limit, index) => (
                        <div key={index} className="usage-item">
                          <div className="usage-header">
                            <div className="post-type-info">
                              <span
                                className="post-type-badge"
                                style={{
                                  backgroundColor: limit.packageType.color || '#007bff',
                                  color: '#fff'
                                }}
                              >
                                {limit.packageType.displayName}
                              </span>
                              {limit.packageType.priority && limit.packageType.priority <= 6 && (
                                <div className="post-type-stars">
                                  {[...Array(Math.min(5 - limit.packageType.priority + 1, 5))].map((_, starIndex) => (
                                    <i key={starIndex} className="fa fa-star star-icon"></i>
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className="usage-numbers">{limit.used || 0} tin đăng</span>
                          </div>
                          <div className="usage-bar">
                            <div
                              className="usage-progress"
                              style={{
                                width: `${Math.min(((limit.used || 0) / limit.limit) * 100, 100)}%`,
                                backgroundColor: limit.packageType.color || '#007bff'
                              }}
                            ></div>
                          </div>
                        </div>
                      ))}
                      <div className="push-count-section">
                        <h4>
                          <i className="fa fa-arrow-up"></i>
                          Lượt đẩy tin
                        </h4>
                        <div className="push-count-stats">
                          <div className="push-count-info">
                            <div className="push-count-header">
                              <span className="push-count-label">Đã sử dụng</span>
                              <span className="push-count-numbers">
                                {currentPackageInfo.usedPushCount || 0}/{currentPackageInfo.freePushCount || 0}
                              </span>
                            </div>
                            <div className="push-count-bar">
                              <div
                                className="push-count-progress"
                                style={{
                                  width: `${Math.min(((currentPackageInfo.usedPushCount || 0) / (currentPackageInfo.freePushCount || 1)) * 100, 100)}%`
                                }}
                              ></div>
                            </div>
                            <div className="push-count-remaining">
                              <i className="fa fa-gift"></i>
                              <span>Còn lại: {Math.max((currentPackageInfo.freePushCount || 0) - (currentPackageInfo.usedPushCount || 0), 0)} lượt</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="package-features-current">
                    <h4>
                      <i className="fa fa-star"></i>
                      Quyền lợi gói
                    </h4>
                    <ul className="features-list-my-properties">
                      <li><i className="fa fa-check"></i> Hỗ trợ khách hàng ưu tiên</li>
                    </ul>


                  </div>
                </div>

              </div>
            </div>

            <div className="modal-footer-current-package">
              {currentPackageInfo.packageType === 'trial' ||
                (currentPackageInfo.expiryDate && getDaysRemaining(currentPackageInfo.expiryDate).includes('hết hạn')) ? (
                <button
                  className="btn-upgrade-my-properties btn-upgrade-primary"
                  onClick={() => {
                    setShowCurrentPackageModal(false);
                    handleShowUpgradeModal();
                  }}
                >
                  <i className="fa fa-arrow-up"></i>
                  Nâng cấp gói ngay
                </button>
              ) : userPackageInfo?.packageType === 'expired' && userPackageInfo?.packageName !== 'trial' ? (
                <button
                  className="btn btn-renewal-primary"
                  onClick={() => {
                    setShowCurrentPackageModal(false);
                    // Navigate to properties-package page for renewal
                    const params = new URLSearchParams({
                      renewal: 'true',
                      packageType: 'expired',
                      packageName: currentPackageInfo.displayName || currentPackageInfo.packageName,
                      expiredPackageId: currentPackageInfo.packageId || currentPackageInfo._id
                    });
                    window.location.href = `/profile/properties-package?${params.toString()}`;
                  }}
                >
                  <i className="fa fa-refresh"></i>
                  Gia hạn ngay
                </button>
              ) : (
                <button
                  className="btn-package btn-secondary"
                  onClick={() => setShowCurrentPackageModal(false)}
                >
                  <i className="fa fa-check"></i>
                  Đã hiểu
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Package Info Modal */}
      {showPackageModal && selectedPackage && (
        <div className="modal-overlay-package" onClick={() => setShowPackageModal(false)}>
          <div className="package-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-package">
              <h2>
                <i className="fa fa-star"></i>
                Thông tin gói tin
              </h2>
              <button
                className="close-btn-package"
                onClick={() => setShowPackageModal(false)}
              >
                <i className="fa fa-times"></i>
              </button>
            </div>

            <div className="modal-content-package">
              <div className="package-detail-content">


                <div className="package-info-detail">
                  <div className="package-name-detail">
                    <span className={`package-badge-large priority-${selectedPackage.packageInfo.priority}`}>
                      {selectedPackage.packageInfo.displayName}
                    </span>
                    {selectedPackage.packageInfo.stars > 0 && (
                      <div className="package-stars-large">
                        {[...Array(selectedPackage.packageInfo.stars)].map((_, i) => (
                          <i key={i} className="fa fa-star star-icon-large"></i>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="package-features">
                    <h5>
                      <i className="fa fa-list"></i>
                      Đặc quyền gói tin
                    </h5>
                    <div className="features-grid">
                      <div className="feature-item">
                        <i className="fa fa-arrow-up text-success"></i>
                        <span>Tin được ưu tiên hiển thị</span>
                      </div>
                      <div className="feature-item">
                        <i className="fa fa-arrow-up text-success"></i>
                        <span>Độ ưu tiên: {selectedPackage.packageInfo.priority}</span>
                      </div>
                      {selectedPackage.packageInfo.stars > 0 && (
                        <div className="feature-item">
                          <i className="fa fa-star text-warning"></i>
                          <span>Đánh giá: {selectedPackage.packageInfo.stars} sao</span>
                        </div>
                      )}
                      {selectedPackage.packageInfo.color && (
                        <div className="feature-item">
                          <i className="fa fa-palette text-info"></i>
                          <span>
                            Màu nổi bật:
                            <span
                              className="color-swatch"
                              style={{ backgroundColor: selectedPackage.packageInfo.color }}
                              title={selectedPackage.packageInfo.color}
                            ></span>
                          </span>
                        </div>
                      )}
                      <div className="feature-item">
                        <i className="fa fa-check-circle text-success"></i>
                        <span>Tin được duyệt nhanh hơn</span>
                      </div>
                    </div>
                  </div>

                  <div className="package-timeline">
                    <h5>
                      <i className="fa fa-calendar"></i>
                      Thời gian sử dụng
                    </h5>
                    <div className="timeline-items">
                      <div className="timeline-item">
                        <div className="timeline-icon start">
                          <i className="fa fa-play-circle"></i>
                        </div>
                        <div className="timeline-content">
                          <strong>Ngày bắt đầu</strong>
                          <span>{formatDate(selectedPackage.packageInfo.startDate)}</span>
                        </div>
                      </div>
                      <div className="timeline-item">
                        <div className="timeline-icon end">
                          <i className="fa fa-stop-circle"></i>
                        </div>
                        <div className="timeline-content">
                          <strong>Ngày hết hạn</strong>
                          <span>{formatDate(selectedPackage.packageInfo.expiryDate)}</span>
                        </div>
                      </div>
                      <div className="timeline-item">
                        <div className={`timeline-icon remaining ${getDaysRemainingClass(selectedPackage.packageInfo.expiryDate)}`}>
                          <i className="fa fa-clock"></i>
                        </div>
                        <div className="timeline-content">
                          <strong>Thời gian còn lại</strong>
                          <span className={`remaining-text ${getDaysRemainingClass(selectedPackage.packageInfo.expiryDate)}`}>
                            {getDaysRemaining(selectedPackage.packageInfo.expiryDate)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="package-stats">
                    <h5>
                      <i className="fa fa-chart-bar"></i>
                      Hiệu quả tin đăng
                    </h5>
                    <div className="stats-grid">
                      <div className="stat-card">
                        <div className="stat-icon">
                          <i className="fa fa-eye"></i>
                        </div>
                        <div className="stat-content">
                          <strong>{formatNumber(selectedPackage.views || 0)}</strong>
                          <span>Lượt xem</span>
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-icon">
                          <i className="fa fa-comment"></i>
                        </div>
                        <div className="stat-content">
                          <strong>{formatNumber(selectedPackage.comments || 0)}</strong>
                          <span>Bình luận</span>
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-icon">
                          <i className="fa fa-heart"></i>
                        </div>
                        <div className="stat-content">
                          <strong>{formatNumber(selectedPackage.favorites || 0)}</strong>
                          <span>Yêu thích</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer-package">
              <button
                className="btn btn-cancel-package"
                onClick={() => handleCancelPackageConfirm(selectedPackage)}
              >
                <i className="fa fa-times-circle"></i>
                Hủy gói
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Package Modal */}
      {showUpgradeModal && (
        <div className="modal-overlay-upgrade" onClick={() => setShowUpgradeModal(false)}>
          <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-upgrade">
              <h2>
                <i className="fa fa-arrow-up"></i>
                Chọn gói tin phù hợp
              </h2>
              <button
                className="close-btn-upgrade"
                onClick={() => setShowUpgradeModal(false)}
              >
                <i className="fa fa-times"></i>
              </button>
            </div>

            <div className="modal-content-upgrade">
              <div className="upgrade-notice-header">
                <div className="notice-content">
                  <i className="fa fa-info-circle"></i>
                  <span>Chọn gói tin phù hợp để tận dụng tối đa hiệu quả đăng tin của bạn</span>
                </div>
              </div>

              <div className="packages-grid">


                {/* Available Packages */}
                {availablePackages.map((packagePlan) => {
                  const isCurrentPackage = userPackageInfo?.packageId === packagePlan._id ||
                    userPackageInfo?.packageName === packagePlan.name;

                  // Check if this is trial package and user is using a different package
                  const isTrialPackageButUserHasOther = packagePlan.name === 'trial' &&
                    userPackageInfo?.packageName &&
                    userPackageInfo.packageName !== 'trial';

                  // Check if this is the expired package
                  const isExpiredPackage = userPackageInfo?.packageType === 'expired' &&
                    (userPackageInfo?.packageId === packagePlan._id || userPackageInfo?.packageName === packagePlan.name);

                  // Debug log
                  if (packagePlan.name === 'trial') {
                    console.log('Trial package check:', {
                      packagePlan: packagePlan.name,
                      userPackageName: userPackageInfo?.packageName,
                      isTrialPackageButUserHasOther
                    });
                  }

                  return (
                    <div key={packagePlan._id} className={`package-card ${packagePlan.name} ${isCurrentPackage ? 'package-current' : ''} ${isTrialPackageButUserHasOther ? 'package-used' : ''} ${isExpiredPackage ? 'package-expired' : ''}`}>

                      <div className="package-header-properties-plan">
                        <div className="package-badge" style={{ backgroundColor: isExpiredPackage ? '#dc3545' : 'black' }}>
                          <i className="fa fa-star"></i>
                          {isExpiredPackage ? `${packagePlan.displayName}` : packagePlan.displayName}
                        </div>
                        <div className="package-price-plan">
                          <span className="price-amount-my-properties">{formatPriceWithCurrency(packagePlan.price)}</span>
                          <span className="price-period-my-properties">/{formatDuration(packagePlan)}</span>
                        </div>
                      </div>

                      <div className="package-features">
                        <h5>
                          <i className="fa fa-list"></i>
                          Quyền lợi gói
                        </h5>
                        <ul>
                          {packagePlan.propertiesLimits && packagePlan.propertiesLimits.map((limit, index) => (
                            <li key={index}>
                              <i className="fa fa-check" style={{ color: limit.packageType.color }}></i>
                              {limit.limit} tin {limit.packageType.displayName}
                            </li>
                          ))}


                          {(packagePlan.name !== 'trial' &&
                            !(packagePlan.type === 'custom' && packagePlan.packageFor === 'landlord' && packagePlan.category === 'management')) && (
                              <>
                                <li>
                                  <i className="fa fa-arrow-up"></i>
                                  {packagePlan.freePushCount} lượt đẩy tin miễn phí
                                </li>
                                <li>
                                  <i className="fa fa-star"></i>
                                  Tin được ưu tiên hiển thị
                                </li>
                              </>
                            )}
                          {(
                            (packagePlan.packageFor === 'both' && packagePlan.category === 'mixed') ||
                            (packagePlan.packageFor === 'landlord' && packagePlan.category === 'management')
                          ) && (
                              <li>
                                <i className="fa-building"></i>
                                Quản lý phòng trọ thông minh

                              </li>
                            )}



                        </ul>
                      </div>

                      <div className="package-action">
                        {isCurrentPackage && userPackageInfo?.packageType !== 'expired' ? (
                          <>
                            <button className="btn-package active" disabled>
                              <i className="fa fa-check"></i>
                              Gói hiện tại
                            </button>
                          </>
                        ) : isCurrentPackage &&
                          userPackageInfo?.packageType === 'expired' &&
                          userPackageInfo?.packageName === 'trial' ? (
                          <button className="btn-package expired" disabled>
                            <i className="fa fa-exclamation-circle"></i>
                            ĐÃ HẾT HẠN
                          </button>
                        ) : isExpiredPackage && userPackageInfo?.packageName !== 'trial' ? (
                          <button
                            className="btn-notification-renewal"
                            onClick={() => {
                              // Navigate directly to renewal page for expired packages
                              const params = new URLSearchParams({
                                renewal: 'true',
                                packageType: 'expired',
                                packageName: userPackageInfo.displayName || userPackageInfo.packageName,
                                expiredPackageId: userPackageInfo.packageId || userPackageInfo._id,
                                // Thêm thông tin gói để tính giá
                                packagePrice: userPackageInfo.price || 0,
                                durationUnit: userPackageInfo.durationUnit || 'month',
                                duration: userPackageInfo.duration ? userPackageInfo.duration.toString() : '1',

                              });
                              window.location.href = `/profile/properties-package?${params.toString()}`;
                            }}
                          >
                            <i className="fa fa-refresh"></i>
                            GIA HẠN NGAY
                          </button>
                        ) : isTrialPackageButUserHasOther ? (
                          <button
                            className="btn-package used"
                            disabled
                            title="Bạn đã sử dụng gói dùng thử và hiện đang sử dụng gói trả phí"
                          >
                            <i className="fa fa-check"></i>
                            Đã sử dụng
                          </button>
                        ) : (
                          <button
                            className="btn-package upgrade"
                            onClick={() => handleUpgradePackage(packagePlan)}
                          >
                            <i className="fa fa-arrow-up"></i>
                            Nâng cấp ngay
                          </button>
                        )}
                      </div>

                      {packagePlan.name === 'premium' && (
                        <div className="package-popular">
                          <span>
                            <i className="fa fa-fire"></i>
                            Phổ biến nhất
                          </span>
                        </div>
                      )}
                      {(
                        (packagePlan.packageFor === 'both' && packagePlan.category === 'mixed') ||
                        (packagePlan.packageFor === 'landlord' && packagePlan.category === 'management')
                      ) && (
                          <div className="package-popular-manager">
                            <span>
                              <i className="fa fa-headset"></i>
                              Hỗ trợ quản lý phòng trọ
                            </span>
                          </div>
                        )}

                    </div>
                  );
                })}
              </div>

              <div className="upgrade-benefits">
                <h4>
                  <i className="fa fa-gift"></i>
                  Tại sao nên nâng cấp?
                </h4>
                <div className="benefits-grid">
                  <div className="benefit-item">
                    <i className="fa fa-eye text-primary"></i>
                    <span>Tin của bạn được nhiều người xem hơn</span>
                  </div>
                  <div className="benefit-item">
                    <i className="fa fa-arrow-up text-success"></i>
                    <span>Ưu tiên hiển thị trên trang chủ</span>
                  </div>
                  <div className="benefit-item">
                    <i className="fa fa-star text-warning"></i>
                    <span>Đánh dấu tin VIP nổi bật</span>
                  </div>
                  <div className="benefit-item">
                    <i className="fa fa-chart-line text-info"></i>
                    <span>Tăng khả năng cho thuê nhanh hơn</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Package Confirmation Modal */}
      {showCancelPackageModal && cancelingPackage && (
        <div className="modal-overlay-cancel-package">
          <div className="cancel-package-modal">
            <div className="modal-header-cancel-package">
              <h3>
                <i className="fa fa-exclamation-triangle text-warning"></i>
                Xác nhận hủy gói tin
              </h3>
              <button
                className="close-btn-cancel-package"
                onClick={() => {
                  setShowCancelPackageModal(false);
                  setCancelingPackage(null);
                }}
              >
                <i className="fa fa-times"></i>
              </button>
            </div>

            <div className="modal-content-cancel-package">
              <div className="cancel-package-info">
                <div className="property-info-cancel">
                  <h4>Tin đăng: "{cancelingPackage.title}"</h4>
                  <div className="package-info-cancel">
                    <span className={`package-badge priority-${cancelingPackage.packageInfo.priority}`}>
                      {cancelingPackage.packageInfo.displayName}
                    </span>
                    <div className="package-time-remaining">
                      <i className="fa fa-clock"></i>
                      <span className={`remaining-text ${getDaysRemainingClass(cancelingPackage.packageInfo.expiryDate)}`}>
                        {getDaysRemaining(cancelingPackage.packageInfo.expiryDate)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="warning-content">
                  <div className="warning-item">
                    <i className="fa fa-info-circle text-info"></i>
                    <span>Sau khi hủy gói, tin đăng sẽ trở về trạng thái thường và mất các đặc quyền của gói tin.</span>
                  </div>
                  <div className="warning-item">
                    <i className="fa fa-exclamation-triangle text-warning"></i>
                    <span>Thời gian sử dụng còn lại sẽ không được hoàn lại.</span>
                  </div>
                  <div className="warning-item">
                    <i className="fa fa-ban text-danger"></i>
                    <span>Hành động này không thể hoàn tác!</span>
                  </div>
                </div>

                <div className="confirmation-question">
                  <strong>Bạn có chắc chắn muốn hủy gói tin này không?</strong>
                </div>
              </div>
            </div>

            <div className="modal-actions-cancel-package">
              <button
                className="btn btn-secondary-cancel"
                onClick={() => {
                  setShowCancelPackageModal(false);
                  setCancelingPackage(null);
                }}
              >
                <i className="fa fa-arrow-left"></i>
                Quay lại
              </button>
              <button
                className="btn btn-danger-cancel"
                onClick={handleCancelPackage}
              >
                <i className="fa fa-times-circle"></i>
                Xác nhận hủy gói
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Property Detail Modal */}
      {showDetailModal && selectedProperty && (
        <div className="modal-overlay-reason-my-properties" onClick={() => setShowDetailModal(false)}>
          <div className="property-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-management">
              <h2>Chi tiết bài đăng</h2>
              <button
                className="close-btn-management"
                onClick={() => setShowDetailModal(false)}
              >
                <i className="fa fa-times"></i>
              </button>
            </div>

            <div className="modal-content-management">
              <div className="property-detail-content-management">
                <div className="detail-header">
                  <h4>{selectedProperty.title}</h4>
                  {getStatusBadge(selectedProperty.approvalStatus)}
                </div>

                {selectedProperty.images && selectedProperty.images.length > 0 && (
                  <div className="property-images">
                    <img
                      src={selectedProperty.images[0]}
                      alt={selectedProperty.title}
                      className="detail-main-image"
                      onError={(e) => {
                        e.target.src = '/images/placeholder.jpg';
                      }}
                    />
                  </div>
                )}

                <div className="property-info-detail">
                  <div className="detail-item">
                    <strong>Giá thuê:</strong>
                    <span>{formatPrice(selectedProperty.rentPrice)} VNĐ/tháng</span>
                  </div>
                  <div className="detail-item">
                    <strong>Diện tích:</strong>
                    <span>{selectedProperty.area}m²</span>
                  </div>
                  <div className="detail-item">
                    <strong>Địa chỉ:</strong>
                    <span>
                      {selectedProperty.detailAddress && `${selectedProperty.detailAddress}, `}{selectedProperty.ward}, {selectedProperty.province}
                    </span>
                  </div>
                  <div className="detail-item">
                    <strong>Ngày đăng:</strong>
                    <span>{formatDate(selectedProperty.createdAt)}</span>
                  </div>

                  {selectedProperty.approvalStatus === 'rejected' && selectedProperty.rejectionReason && (
                    <div className="detail-item reject-reason">
                      <strong>Lý do từ chối:</strong>
                      <span className="rejection-text">{selectedProperty.rejectionReason}</span>
                    </div>
                  )}
                </div>

                {selectedProperty.description && (
                  <div className="description">
                    <strong>Mô tả:</strong>
                    <p>{selectedProperty.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Property Modal */}
      {showEditModal && editingProperty && (
        <EditPropertyModal
          property={editingProperty}
          onClose={() => {
            setShowEditModal(false);
            setEditingProperty(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setEditingProperty(null);
            loadProperties();
          }}
        />
      )}

      {/* Toggle Status Confirmation Modal */}
      {showToggleModal && togglingProperty && (
        <div className="modal-overlay-hidden">
          <div className="delete-modal">
            <div className="modal-header">
              <h3>Xác nhận {togglingProperty.status === 'available' ? 'ẩn' : 'hiện'} tin đăng</h3>
            </div>
            <div className="modal-content-delete-my-properties">
              <p>Bạn có chắc chắn muốn {togglingProperty.status === 'available' ? 'ẩn' : 'hiện'} tin đăng:</p>
              <p className="property-title-delete">"{togglingProperty.title}"</p>
              {togglingProperty.status === 'available' && (
                <p className="warning-text">
                  <i className="fa fa-info-circle"></i>
                  Tin đăng sẽ không hiển thị trên trang chủ khi bị ẩn!
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button
                className="btn-hidden btn-secondary-hidden"
                onClick={() => {
                  setShowToggleModal(false);
                  setTogglingProperty(null);
                }}
              >
                Hủy
              </button>
              <button
                className={`btn ${togglingProperty.status === 'available' ? 'btn-warning' : 'btn-success'}`}
                onClick={handleToggleStatus}
                style={{
                  backgroundColor: togglingProperty.status === 'available' ? '#6c757d' : '#fd7e14',
                  borderColor: togglingProperty.status === 'available' ? '#6c757d' : '#fd7e14'
                }}
              >
                <i className={`fa ${togglingProperty.status === 'available' ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                {togglingProperty.status === 'available' ? 'Ẩn tin đăng' : 'Hiện tin đăng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingProperty && (
        <div className="modal-overlay-management">
          <div className="delete-modal">
            <div className="modal-header-management">
              <h3>Xác nhận xóa tin đăng</h3>
              <button
                className="close-btn-management"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingProperty(null);
                }}
              >
                <i className="fa fa-times"></i>
              </button>
            </div>
            <div className="modal-content-delete-my-properties">
              <p>Bạn có chắc chắn muốn xóa tin đăng:</p>
              <p className="property-title-delete">"{deletingProperty.title}"</p>
              <p className="warning-text">
                <i className="fa fa-warning"></i>
                Hành động này không thể hoàn tác!
              </p>
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingProperty(null);
                }}
              >
                Hủy
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
              >
                <i className="fa fa-trash"></i>
                Xóa tin đăng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Package History Modal */}
      {showPackageHistoryModal && (
        <div className="modal-overlay-upgrade" onClick={handleClosePackageHistoryModal}>
          <div className="upgrade-modal-used" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-upgrade">
              <h2>
                <i className="fa fa-history"></i>
                Lịch sử gói đã sử dụng
              </h2>
              <button
                className="close-btn-upgrade"
                onClick={handleClosePackageHistoryModal}
              >
                <i className="fa fa-times"></i>
              </button>
            </div>

            <div className="modal-content-upgrade">
              {loadingPackageHistory ? (
                <div className="loading-state">
                  <i className="fa fa-spinner fa-spin"></i>
                  <p>Đang tải lịch sử gói...</p>
                </div>
              ) : packageHistory.length === 0 ? (
                <div className="empty-state">
                  <i className="fa fa-history"></i>
                  <h3>Chưa có lịch sử gói</h3>
                  <p>Bạn chưa có lịch sử sử dụng gói nào trước đây.</p>
                </div>
              ) : (
                <div className="package-history-content">
                  <div className="package-history-header">
                    <div className="history-info">
                      <i className="fa fa-info-circle"></i>
                      <span>Hiển thị tất cả các gói bạn đã sử dụng</span>
                    </div>
                  </div>

                  <div className="package-history-list">
                    {packageHistory.map((historyItem, index) => (
                      <div key={index} className={`package-history-item ${historyItem.status} ${expandedHistoryItems[index] ? 'expanded' : ''}`}>
                        <div className="history-item-header">
                          <div className="package-info">
                            <div className="package-badge-history">

                              <span className='package-history-name'>
                                <i className="fa fa-star"></i>
                                {historyItem.displayName}</span>
                            </div>

                            {/* Tag hiển thị tổng số tin đăng đã chuyển gói */}
                            {historyItem.transferredProperties && historyItem.transferredProperties.length > 0 && (
                              <div className="transferred-properties-summary-tag">
                                <i className="fa fa-exchange-alt"></i>
                                <span>
                                  {historyItem.transferredProperties.length} tin đã chuyển gói
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="package-timeline-history">
                            <div className="timeline-item-history">
                              <i className="fa fa-play-circle text-success"></i>
                              <div className="timeline-content-history">
                                <strong>Ngày bắt đầu</strong>
                                <span>{formatDate(historyItem.purchaseDate)}</span>
                              </div>
                            </div>
                            <div className="timeline-item-history">
                              <i className="fa fa-stop-circle text-danger"></i>
                              <div className="timeline-content-history">
                                <strong>Ngày hết hạn</strong>
                                <span>{formatDate(historyItem.expiryDate)}</span>
                              </div>
                            </div>
                            <div className="timeline-item-history">
                              <i className={`fa fa-clock ${historyItem.status === 'expired' ? 'text-danger' : historyItem.status === 'active' ? 'text-warning' : historyItem.status === 'renewed' ? 'text-success' : 'text-info'}`}></i>
                              <div className="timeline-content-history">
                                <strong>Trạng thái</strong>
                                <span className={`status-text ${historyItem.status === 'expired' ? 'text-danger' : historyItem.status === 'active' ? 'text-warning' : historyItem.status === 'renewed' ? 'text-success' : 'text-info'}`}>
                                  {historyItem.status === 'upgraded'
                                    ? 'Đã nâng cấp'
                                    : historyItem.status === 'renewed'
                                      ? 'Đã gia hạn'
                                      : historyItem.status === 'expired'
                                        ? 'Đã hết hạn'
                                        : historyItem.status === 'cancelled'
                                          ? 'Đã hủy'
                                          : 'Đang hoạt động'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Toggle button cho từng item */}
                        <div className="package-history-item-toggle">
                          <button
                            className={`btn-toggle-history-item ${expandedHistoryItems[index] ? 'expanded' : ''}`}
                            onClick={() => handleToggleHistoryItemExpansion(index)}
                          >
                            <span>{expandedHistoryItems[index] ? 'Thu gọn chi tiết' : 'Xem chi tiết'}</span>
                            <i className="fa fa-chevron-down"></i>
                          </button>
                        </div>

                        {expandedHistoryItems[index] && (
                          <div className="history-item-details">
                            <div className="package-limits-package-history">
                              <h5>
                                <i className="fa fa-list"></i>
                                Giới hạn gói
                              </h5>
                              <div className="usage-grid">
                                {historyItem.packagePlanId?.propertiesLimits?.map((limit, limitIndex) => {
                                  // Tìm tin đăng đã được chuyển gói cho loại gói này
                                  const transferredPropsForThisType = historyItem.transferredProperties?.filter(
                                    transferredProp =>
                                      transferredProp.postType._id?.toString() === limit.packageType._id?.toString() &&
                                      transferredProp.transferredFromPackage?.packagePlanId?.toString() === historyItem.packagePlanId?._id?.toString()
                                  ) || [];

                                  console.log('historyItem:', historyItem);

                                  return (
                                    <div key={limitIndex} className="usage-item">
                                      <div className="usage-header">
                                        <div className="post-type-info">
                                          {limit.packageType?.stars > 0 && (
                                            <div className="post-type-stars">
                                              {[...Array(limit.packageType.stars)].map((_, starIndex) => (
                                                <i key={starIndex} className="fa fa-star star-icon"></i>
                                              ))}
                                            </div>
                                          )}
                                          <span
                                            className="post-type-badge"
                                            style={{
                                              backgroundColor: limit.packageType?.color || '#007bff',
                                              color: '#fff'
                                            }}
                                          >
                                            {limit.packageType?.displayName || 'Unknown'}
                                          </span>
                                          {/* Hiển thị tag tin đăng đã chuyển gói ngay trong post-type-info */}
                                          {transferredPropsForThisType.length > 0 && (
                                            <div className="transferred-inline-tag">
                                              <i className="fa fa-tag"></i>
                                              <span>{transferredPropsForThisType.length} tin chuyển sang <strong>{transferredPropsForThisType[0].transferredToPackage?.displayName}</strong></span>
                                            </div>
                                          )}
                                        </div>

                                        <span className="usage-numbers">
                                          {limit.used || 0}/{limit.limit}
                                        </span>
                                      </div>

                                      <div className="usage-bar">
                                        <div
                                          className="usage-progress"
                                          style={{
                                            width: `${Math.min(((limit.used || 0) / limit.limit) * 100, 100)}%`,
                                            backgroundColor: limit.packageType?.color || '#007bff'
                                          }}
                                        ></div>
                                      </div>
                                    </div>
                                  );
                                })}

                              </div>
                            </div>

                            <div className="package-features-history">
                              <div className="push-count-section">
                                <h5>
                                  <i className="fa fa-arrow-up"></i>
                                  Lượt đẩy tin
                                </h5>
                                <div className="push-count-stats">
                                  <div className="push-count-info">
                                    <div className="push-count-header">
                                      <span className="push-count-label">Đã sử dụng</span>
                                      <span className="push-count-numbers">
                                        {historyItem.usedPushCount || 0}/{historyItem.packagePlanId?.freePushCount || 0}
                                      </span>
                                    </div>
                                    <div className="push-count-bar">
                                      <div
                                        className="push-count-progress"
                                        style={{
                                          width: `${Math.min(((historyItem.usedPushCount || 0) / (historyItem.packagePlanId?.freePushCount || 1)) * 100, 100)}%`
                                        }}
                                      ></div>
                                    </div>
                                    <div className="push-count-remaining">
                                      <i className="fa fa-gift"></i>
                                      <span>Còn lại: {Math.max((historyItem.packagePlanId?.freePushCount || 0) - (historyItem.usedPushCount || 0), 0)} lượt</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="feature-row">
                                <i className="fa fa-calendar"></i>
                                <span>
                                  Sử dụng từ {formatDate(historyItem.purchaseDate)}
                                  {historyItem.upgradedAt && ` (nâng cấp ${formatDate(historyItem.upgradedAt)})`}
                                  {historyItem.renewedAt && ` (gia hạn ${formatDate(historyItem.renewedAt)})`}
                                  {historyItem.expiredAt && ` (hết hạn ${formatDate(historyItem.expiredAt)})`}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="package-history-summary">
                    <h4>
                      <i className="fa fa-chart-bar"></i>
                      Tổng kết
                    </h4>
                    <div className="summary-stats-package-history">
                      <div className="stat-item-package-history">
                        <strong>{packageHistory.length}</strong>
                        <span>Gói đã sử dụng</span>
                      </div>
                      <div className="stat-item-package-history">
                        <strong>
                          {packageHistory.filter(item => item.status === 'upgraded').length}
                        </strong>
                        <span>Lần nâng cấp</span>
                      </div>
                      <div className="stat-item-package-history">
                        <strong>
                          {packageHistory.filter(item => item.status === 'renewed').length}
                        </strong>
                        <span>Lần gia hạn</span>
                      </div>

                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="modal-footer-current-package">
                    <button
                      className="btn-modal-package-my-properties btn-secondary-package-history"
                      onClick={handleClosePackageHistoryModal}
                    >
                      <i className="fa fa-times"></i>
                      Đóng
                    </button>

                  </div>
                </div>
              )}

            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default MyProperties;