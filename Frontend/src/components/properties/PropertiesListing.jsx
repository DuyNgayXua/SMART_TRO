import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { myPropertiesAPI } from '../../services/myPropertiesAPI';
import { propertyDetailAPI } from '../../services/propertyDetailAPI';
import searchPropertiesAPI from '../../services/searchPropertiesAPI';
import { locationAPI } from '../../services/locationAPI';
import amenitiesAPI from '../../services/amenitiesAPI';
import { useAuth } from '../../contexts/AuthContext';
import { useFavorites } from '../../contexts/FavoritesContext';
import { viewTrackingUtils } from '../../utils/viewTrackingUtils';
import PropertyCard from './PropertyCard';
import ChatBot from '../chatbot/ChatBot';
import {
  FaMapMarkerAlt,
  FaSync,
  FaCalendarAlt,
  FaNewspaper,
  FaHeart,
  FaMoneyBillWave,
  FaExpand,
  FaClock,
  FaArrowUp
} from 'react-icons/fa';
import './PropertiesListing.css';

/**
 * Component PropertiesListing - Trang danh sách bất động sản
 * 
 * Chức năng chính:
 * - properties-listing: Container chính chứa toàn bộ giao diện danh sách tin đăng
 * - hero search: Form tìm kiếm lớn cho phép lọc theo địa điểm, loại hình, giá, diện tích, tiện ích
 * - Hiển thị danh sách tin đăng với phân trang 12 tin/trang
 * - Sidebar với các bộ lọc nhanh và thông tin bổ sung
 * - Tự động hiển thị hero search khi không có kết quả tìm kiếm từ bên ngoài
 */
const PropertiesListing = ({ searchResults = null, searchParams: externalSearchParams = null }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { toggleFavorite, isFavorited } = useFavorites();

  // States
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');

  // Location data
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);

  // Hero search states
  const [amenities, setAmenities] = useState([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [showAmenitiesModal, setShowAmenitiesModal] = useState(false);
  const [tempSelectedAmenities, setTempSelectedAmenities] = useState([]);
  
  // Go to top button state
  const [showGoToTop, setShowGoToTop] = useState(false);
  const [selectedPriceIndex, setSelectedPriceIndex] = useState(0);
  const [selectedAreaIndex, setSelectedAreaIndex] = useState(0);
  const [searching, setSearching] = useState(false);

  // Search data for Hero form
  const [searchData, setSearchData] = useState({
    search: '',
    provinceId: '',
    districtId: '',
    category: '',
    minPrice: '',
    maxPrice: '',
    minArea: '',
    maxArea: '',
    amenities: []
  });

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  // Spinner component để thống nhất loading indicator
const LoadingSpinner = ({ size = 'medium', className = '' }) => {
  const sizeClasses = {
    small: 'spinner-small',
    medium: 'spinner-medium', 
    large: 'spinner-large'
  };
  
  return (
    <i 
      className={`fa fa-spinner smooth-spinner ${sizeClasses[size]} ${className}`}
    ></i>
  );
};

  // Filters state
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    provinceId: searchParams.get('province') || '',
    districtId: searchParams.get('district') || '',
    wardId: searchParams.get('ward') || '',
    category: searchParams.get('category') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    minArea: searchParams.get('minArea') || '',
    maxArea: searchParams.get('maxArea') || '',
    amenities: searchParams.get('amenities') ? searchParams.get('amenities').split(',') : [],
    sortBy: searchParams.get('sortBy') || 'createdAt',
    sortOrder: searchParams.get('sortOrder') || 'desc'
  });

  // Price ranges
  const priceRanges = [
    { label: 'Dưới 1 triệu', min: 0, max: 1000000 },
    { label: '1 - 2 triệu', min: 1000000, max: 2000000 },
    { label: '2 - 3 triệu', min: 2000000, max: 3000000 },
    { label: '3 - 5 triệu', min: 3000000, max: 5000000 },
    { label: '5 - 7 triệu', min: 5000000, max: 7000000 },
    { label: '7 - 10 triệu', min: 7000000, max: 10000000 },
    { label: 'Trên 10 triệu', min: 10000000, max: null }
  ];

  // Area ranges - Updated
  const areaRanges = [
    { label: 'Dưới 20m²', min: 0, max: 20 },
    { label: '20 - 30m²', min: 20, max: 30 },
    { label: '30 - 50m²', min: 30, max: 50 },
    { label: '50 - 70m²', min: 50, max: 70 },
    { label: '70 - 90m²', min: 70, max: 90 },
    { label: 'Trên 90m²', min: 90, max: null }
  ];

  // Right sidebar price ranges (sync with Hero price ranges)
  const rightSidebarPriceRanges = [
    { label: 'Dưới 1 triệu', min: 0, max: 1000000 },
    { label: '1 - 2 triệu', min: 1000000, max: 2000000 },
    { label: '2 - 3 triệu', min: 2000000, max: 3000000 },
    { label: '3 - 5 triệu', min: 3000000, max: 5000000 },
    { label: '5 - 7 triệu', min: 5000000, max: 7000000 },
    { label: '7 - 10 triệu', min: 7000000, max: 10000000 },
    { label: 'Trên 10 triệu', min: 10000000, max: null }
  ];

  // Right sidebar area ranges (sync with Hero area ranges)
  const rightSidebarAreaRanges = [
    { label: 'Dưới 20m²', min: 0, max: 20 },
    { label: '20 - 30m²', min: 20, max: 30 },
    { label: '30 - 50m²', min: 30, max: 50 },
    { label: '50 - 70m²', min: 50, max: 70 },
    { label: '70 - 100m²', min: 70, max: 100 },
    { label: 'Trên 100m²', min: 100, max: null }
  ];

  // Hero search categories
  const heroCategories = [
    { value: '', label: 'Tất cả loại hình' },
    { value: 'phong_tro', label: 'Phòng trọ' },
    { value: 'can_ho', label: 'Căn hộ' },
    { value: 'nha_nguyen_can', label: 'Nhà nguyên căn' },
    { value: 'chung_cu_mini', label: 'Chung cư mini' },
    { value: 'homestay', label: 'Homestay' }
  ];

  // Hero search price ranges
  const heroPriceRanges = [
    { label: 'Chọn mức giá', min: '', max: '' },
    { label: 'Dưới 1 triệu', min: 0, max: 1000000 },
    { label: '1 - 2 triệu', min: 1000000, max: 2000000 },
    { label: '2 - 3 triệu', min: 2000000, max: 3000000 },
    { label: '3 - 5 triệu', min: 3000000, max: 5000000 },
    { label: '5 - 7 triệu', min: 5000000, max: 7000000 },
    { label: '7 - 10 triệu', min: 7000000, max: 10000000 },
    { label: 'Trên 10 triệu', min: 10000000, max: '' }
  ];

  // Hero search area ranges
  const heroAreaRanges = [
    { label: 'Chọn diện tích', min: '', max: '' },
    { label: 'Dưới 20m²', min: 0, max: 20 },
    { label: '20 - 30m²', min: 20, max: 30 },
    { label: '30 - 50m²', min: 30, max: 50 },
    { label: '50 - 70m²', min: 50, max: 70 },
    { label: '70 - 100m²', min: 70, max: 100 },
    { label: 'Trên 100m²', min: 100, max: '' }
  ];

  // Sort options
  const sortOptions = [
    { value: 'createdAt_desc', label: 'Tin mới nhất' },
    { value: 'createdAt_asc', label: 'Tin cũ nhất' },
    { value: 'rentPrice_asc', label: 'Giá thấp nhất' },
    { value: 'rentPrice_desc', label: 'Giá cao nhất' },
    { value: 'area_desc', label: 'Diện tích lớn nhất' },
    { value: 'area_asc', label: 'Diện tích nhỏ nhất' },
    { value: 'views_desc', label: 'Xem nhiều nhất' }
  ];

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load properties when filters change
  useEffect(() => {
    if (provinces.length > 0 && !searchResults) { // Only load when initial data is ready and no external search results
      loadProperties(true);
      // Don't auto-update URL here to avoid conflicts with manual URL updates
    }
  }, [filters, provinces, searchResults]);

  // Page changes are now handled by handlePageChange function

  // Go to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowGoToTop(window.pageYOffset > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);



  // Xử lý kết quả tìm kiếm từ bên ngoài (từ Hero search hoặc các component khác)
  useEffect(() => {
    if (searchResults) {
      // Cập nhật danh sách tin đăng từ kết quả tìm kiếm bên ngoài
      setProperties(searchResults.properties || []);
      setPagination(prev => ({
        ...prev,
        total: searchResults.pagination?.total || 0,
        totalPages: searchResults.pagination?.totalPages || 0,
        hasNext: searchResults.pagination?.hasNext || false,
        page: 1
      }));
    } else if (searchResults === null) {
      // Đặt lại để tải tất cả tin đăng khi xóa tìm kiếm
      if (provinces.length > 0) {
        loadProperties(true);
      }
    }
  }, [searchResults, provinces.length]);

  // Load initial data (provinces and amenities)
  const loadInitialData = async () => {
    try {
      const [provincesRes, amenitiesRes] = await Promise.all([
        locationAPI.getProvinces(),
        amenitiesAPI.getAllAmenities()
      ]);

      if (provincesRes.success) {
        setProvinces(provincesRes.data);
      }

      if (amenitiesRes.success) {
        setAmenities(amenitiesRes.data.amenities || []);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  // Load properties
  const loadProperties = async (reset = false, customFilters = null, targetPage = null) => {
    try {
      setLoading(true);
      
      const currentPage = targetPage || (reset ? 1 : pagination.page);
      if (reset || targetPage) {
        setPagination(prev => ({ 
          ...prev, 
          page: currentPage,
          hasPrev: currentPage > 1
        }));
      }

      const searchFilters = customFilters || filters;
      const params = {
        ...searchFilters,
        page: currentPage,
        limit: pagination.limit
      };
      // console.log('Loading properties with params:', params);

      // Clean empty params
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key];
        }
      });

      let response;
      // Kiểm tra xem có bộ lọc nào được áp dụng không
      const hasFilters = searchFilters.search || searchFilters.provinceId || searchFilters.districtId || 
                        searchFilters.wardId || searchFilters.category || searchFilters.minPrice || 
                        searchFilters.maxPrice || searchFilters.minArea || searchFilters.maxArea || 
                        (searchFilters.amenities && searchFilters.amenities.length > 0);

      if (hasFilters) {
        // Sử dụng search API khi có bộ lọc được áp dụng
        response = await searchPropertiesAPI.searchProperties(params);
      } else {
        // Sử dụng API tổng quát khi không có bộ lọc nào
        response = await myPropertiesAPI.getMyApprovedProperties(params);
      }

      if (response.success) {
        const newProperties = response.data?.properties || [];
        
        // Luôn thay thế toàn bộ danh sách properties cho phân trang
        setProperties(newProperties);

        setPagination(prev => ({
          ...prev,
          total: response.data?.pagination?.total || 0,
          totalPages: response.data?.pagination?.totalPages || 0,
          hasNext: response.data?.pagination?.hasNext || false,
          hasPrev: (targetPage || prev.page) > 1
        }));
      } else {
        setProperties([]);
        toast.error('Không thể tải danh sách tin đăng');
      }
    } catch (error) {
      console.error('Error loading properties:', error);
      toast.error('Lỗi khi tải danh sách tin đăng');
      setProperties([]);
    } finally {
      setLoading(false);
    }
  };

  // Load districts when province changes in Hero
  const loadDistrictsHero = async (provinceId) => {
    
    try {
      setLoadingDistricts(true);
      const districtsRes = await locationAPI.getDistricts(provinceId);
    
      
      if (districtsRes.success) {
        setDistricts(districtsRes.data || []);
      } else {
        setDistricts([]);
      }
    } catch (error) {
      console.error('Error loading districts:', error);
      setDistricts([]);
    } finally {
      setLoadingDistricts(false);
    }
  };

  // Load districts when province changes (for filters)
  const loadDistricts = async (provinceId) => {
    if (!provinceId) {
      setDistricts([]);
      return;
    }
    
    try {
      const districtsRes = await locationAPI.getDistricts(provinceId);
      if (districtsRes.success) {
        setDistricts(districtsRes.data || []);
      } else {
        setDistricts([]);
      }
    } catch (error) {
      console.error('Error loading districts:', error);
      setDistricts([]);
    }
  };

  // Load wards when district changes (for filters)
  const loadWards = async (districtId) => {
    if (!districtId) {
      setWards([]);
      return;
    }
    
    try {
      const wardsRes = await locationAPI.getWards(districtId);
      if (wardsRes.success) {
        setWards(wardsRes.data || []);
      } else {
        setWards([]);
      }
    } catch (error) {
      console.error('Error loading wards:', error);
      setWards([]);
    }
  };

  // Hero search handlers
  const handleHeroInputChange = (field, value) => {
    setSearchData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleHeroPriceRangeChange = (e) => {
    const selectedIndex = parseInt(e.target.value);
    const selectedRange = heroPriceRanges[selectedIndex];
    setSelectedPriceIndex(selectedIndex);
    setSearchData(prev => ({
      ...prev,
      minPrice: selectedRange.min,
      maxPrice: selectedRange.max
    }));
    
    // Also update filters to sync with sidebar
    // Convert '' to null for consistency with sidebar ranges
    const maxPriceValue = selectedRange.max === '' ? null : selectedRange.max;
    setFilters(prev => ({
      ...prev,
      minPrice: selectedRange.min || '',
      maxPrice: maxPriceValue || ''
    }));
  };

  const handleHeroAreaRangeChange = (e) => {
    const selectedIndex = parseInt(e.target.value);
    const selectedRange = heroAreaRanges[selectedIndex];
    setSelectedAreaIndex(selectedIndex);
    setSearchData(prev => ({
      ...prev,
      minArea: selectedRange.min,
      maxArea: selectedRange.max
    }));
    
    // Also update filters to sync with sidebar
    // Convert '' to null for consistency with sidebar ranges
    const maxAreaValue = selectedRange.max === '' ? null : selectedRange.max;
    setFilters(prev => ({
      ...prev,
      minArea: selectedRange.min || '',
      maxArea: maxAreaValue || ''
    }));
  };

  // Hero amenities modal handlers
  const handleOpenAmenitiesModal = () => {
    setTempSelectedAmenities([...searchData.amenities]);
    setShowAmenitiesModal(true);
  };

  const handleAmenityModalToggle = (amenityId) => {
    setTempSelectedAmenities(prev => 
      prev.includes(amenityId) 
        ? prev.filter(id => id !== amenityId)
        : [...prev, amenityId]
    );
  };

  const handleApplyAmenities = () => {
    setSearchData(prev => ({ ...prev, amenities: tempSelectedAmenities }));
    setShowAmenitiesModal(false);
  };

  const handleCloseAmenitiesModal = () => {
    setSearchData(prev => ({ ...prev, amenities: tempSelectedAmenities }));
    setShowAmenitiesModal(false);
  };

  const handleCancelAmenities = () => {
    setTempSelectedAmenities([]);
    setShowAmenitiesModal(false);
  };

  const handleResetFilters = async () => {
    // Reset search input
    setSearchInput('');
    
    // Reset searchData (Hero form)
    const resetSearchData = {
      search: '',
      provinceId: '',
      districtId: '',
      category: '',
      minPrice: '',
      maxPrice: '',
      minArea: '',
      maxArea: '',
      amenities: []
    };
    
    setSearchData(resetSearchData);
    
    // Reset Hero select indices
    setSelectedPriceIndex(0);
    setSelectedAreaIndex(0);
    setDistricts([]);
    
    // Reset filters (for sidebar and general filtering)
    const resetFilters = {
      search: '',
      provinceId: '',
      districtId: '',
      wardId: '',
      category: '',
      minPrice: '',
      maxPrice: '',
      minArea: '',
      maxArea: '',
      amenities: [],
      sortBy: 'createdAt',
      sortOrder: 'desc'
    };
    
    setPagination(prev => ({ ...prev, page: 1 }));
    
    // Clear URL params immediately
    setSearchParams(new URLSearchParams());
    
    // Call search API with reset filters immediately
    await searchWithFilters(resetFilters);
  };

  // Handle Hero search submit
  const handleHeroSearch = async (e) => {
    e.preventDefault();
    
    const searchParams = {
      search: searchData.search || '',
      provinceId: searchData.provinceId || '',
      districtId: searchData.districtId || '',
      category: searchData.category || '',
      minPrice: searchData.minPrice || '',
      maxPrice: searchData.maxPrice || '',
      minArea: searchData.minArea || '',
      maxArea: searchData.maxArea || '',
      amenities: searchData.amenities || [],
      page: 1,
      limit: 12,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    };
    
    try {
      setSearching(true);
      const response = await searchPropertiesAPI.searchProperties(searchParams);
      if (response.success) {
        setProperties(response.data?.properties || []);
        setPagination({
          page: 1,
          limit: pagination.limit,
          total: response.data?.pagination?.total || 0,
          totalPages: response.data?.pagination?.totalPages || 0,
          hasNext: response.data?.pagination?.hasNext || false
        });
        
        // Update filters state to match search data
        const newFilters = {
          search: searchData.search || '',
          provinceId: searchData.provinceId || '',
          districtId: searchData.districtId || '',
          wardId: '',
          category: searchData.category || '',
          minPrice: searchData.minPrice || '',
          maxPrice: searchData.maxPrice || '',
          minArea: searchData.minArea || '',
          maxArea: searchData.maxArea || '',
          amenities: searchData.amenities || [],
          sortBy: 'createdAt',
          sortOrder: 'desc'
        };
        
        setFilters(newFilters);
        
        // Update URL immediately after successful search
        const params = new URLSearchParams();
        Object.entries(newFilters).forEach(([key, value]) => {
          if (value && value !== '') {
            if (key === 'amenities' && Array.isArray(value) && value.length > 0) {
              params.set(key, value.join(','));
            } else if (key !== 'amenities') {
              params.set(key, value);
            }
          }
        });
        setSearchParams(params);
        
      } else {
        console.error('Search failed:', response.message);
        setProperties([]);
        setPagination(prev => ({ ...prev, total: 0 }));
      }
    } catch (error) {
      console.error('Error searching properties:', error);
      setProperties([]);
      setPagination(prev => ({ ...prev, total: 0 }));
    } finally {
      setSearching(false);
    }
  };

  // Handle filter change (without immediate API call)
  const handleFilterChange = (key, value) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value };

      // Reset dependent filters
      if (key === 'provinceId') {
        newFilters.districtId = '';
        newFilters.wardId = '';
        loadDistricts(value);
      } else if (key === 'districtId') {
        newFilters.wardId = '';
        loadWards(value);
      }

      // Update URL immediately for some key filters
      if (key !== 'search') { // Search is handled by debounced effect
        setTimeout(() => {
          const params = new URLSearchParams();
          Object.entries(newFilters).forEach(([key, value]) => {
            if (value && value !== '') {
              if (key === 'amenities' && Array.isArray(value) && value.length > 0) {
                params.set(key, value.join(','));
              } else if (key !== 'amenities') {
                params.set(key, value);
              }
            }
          });
          setSearchParams(params);
        }, 100);
      }

      return newFilters;
    });

    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Search with current filters
  const searchWithFilters = async (newFilters = null) => {
    if (!searchResults) { 
      const searchFilters = newFilters || filters;
      // Temporarily update filters state if newFilters provided
      if (newFilters) {
        setFilters(newFilters);
      }
      
      await loadProperties(true, searchFilters);
     
    }
  };


  useEffect(() => {
    if (searchData.provinceId) {
      loadDistrictsHero(searchData.provinceId);
    } else {
      setDistricts([]);
      setSearchData(prev => ({ ...prev, districtId: '' }));
    }
  }, [searchData.provinceId]);

  // Handle search input key press
  const handleSearchInputKeyPress = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await handleSearchSubmit();
    }
  };

  // Handle search submit
  const handleSearchSubmit = async () => {
    const newFilters = { ...filters, search: searchInput };
    
    // Also update Hero search data
    setSearchData(prev => ({ ...prev, search: searchInput }));
    
    setPagination(prev => ({ ...prev, page: 1 }));
    
    // Update URL immediately
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && value !== '') {
        if (key === 'amenities' && Array.isArray(value) && value.length > 0) {
          params.set(key, value.join(','));
        } else if (key !== 'amenities') {
          params.set(key, value);
        }
      }
    });
    setSearchParams(params);
    
    // Search immediately with new filters
    await searchWithFilters(newFilters);
  };

  const handlePriceRangeSelect = async (range) => {
    // Update both filters and searchData to sync Hero and sidebar
    setFilters(prev => ({
      ...prev,
      minPrice: range.min || '',
      maxPrice: range.max || ''
    }));
    
    setSearchData(prev => ({
      ...prev,
      minPrice: range.min || '',
      maxPrice: range.max === null ? '' : range.max || ''
    }));
    
    // Update selectedPriceIndex to sync Hero select
    // Handle the conversion between null (sidebar) and '' (Hero) for max values
    const heroPriceIndex = heroPriceRanges.findIndex(heroRange => {
      const rangeMaxValue = range.max === null ? '' : range.max;
      const heroRangeMaxValue = heroRange.max === null ? '' : heroRange.max;
      return heroRange.min === range.min && heroRangeMaxValue === rangeMaxValue;
    });
    
    if (heroPriceIndex !== -1) {
      setSelectedPriceIndex(heroPriceIndex);
    }
    
    setPagination(prev => ({ ...prev, page: 1 }));
    
    // Call search API immediately with updated params
    const searchParams = {
      search: filters.search || '',
      provinceId: filters.provinceId || '',
      districtId: filters.districtId || '',
      wardId: filters.wardId || '',
      category: filters.category || '',
      minPrice: range.min || '',
      maxPrice: range.max || '',
      minArea: filters.minArea || '',
      maxArea: filters.maxArea || '',
      amenities: filters.amenities || [],
      page: 1,
      limit: pagination.limit,
      sortBy: filters.sortBy || 'createdAt',
      sortOrder: filters.sortOrder || 'desc'
    };
    
    try {
      setLoading(true);
      console.log('Price range search params:', searchParams);

      const response = await searchPropertiesAPI.searchProperties(searchParams);
      
      if (response.success) {
        setProperties(response.data?.properties || []);
        setPagination(prev => ({
          ...prev,
          page: 1,
          total: response.data?.pagination?.total || 0,
          totalPages: response.data?.pagination?.totalPages || 0,
          hasNext: response.data?.pagination?.hasNext || false
        }));
        
        // Update URL immediately after successful search
        const urlParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value && value !== '') {
            if (key === 'amenities' && Array.isArray(value) && value.length > 0) {
              urlParams.set(key, value.join(','));
            } else if (key !== 'amenities') {
              urlParams.set(key, value);
            }
          }
        });
        // Make sure to include the new price values
        if (range.min) urlParams.set('minPrice', range.min);
        if (range.max) urlParams.set('maxPrice', range.max);
        
        setSearchParams(urlParams);
        
      } else {
        console.error('Search failed:', response.message);
        setProperties([]);
        setPagination(prev => ({ ...prev, total: 0 }));
      }
    } catch (error) {
      console.error('Error searching properties:', error);
      setProperties([]);
      setPagination(prev => ({ ...prev, total: 0 }));
    } finally {
      setLoading(false);
    }
  };

  // Handle area range selection (sync with Hero and call API)
  const handleAreaRangeSelect = async (range) => {
    // Update both filters and searchData to sync Hero and sidebar
    setFilters(prev => ({
      ...prev,
      minArea: range.min || '',
      maxArea: range.max || ''
    }));
    
    setSearchData(prev => ({
      ...prev,
      minArea: range.min || '',
      maxArea: range.max || ''
    }));
    
    // Update selectedAreaIndex to sync Hero select
    // Need to handle the difference between null and '' for max values
    const heroAreaIndex = heroAreaRanges.findIndex(heroRange => {
      const rangeMaxValue = range.max === null ? '' : range.max;
      const heroRangeMaxValue = heroRange.max === null ? '' : heroRange.max;
      return heroRange.min === range.min && heroRangeMaxValue === rangeMaxValue;
    });
    
    if (heroAreaIndex !== -1) {
      setSelectedAreaIndex(heroAreaIndex);
    }
    
    setPagination(prev => ({ ...prev, page: 1 }));
    
    // Call search API immediately with updated params
    const searchParams = {
      search: filters.search || '',
      provinceId: filters.provinceId || '',
      districtId: filters.districtId || '',
      wardId: filters.wardId || '',
      category: filters.category || '',
      minPrice: filters.minPrice || '',
      maxPrice: filters.maxPrice || '',
      minArea: range.min || '',
      maxArea: range.max || '',
      amenities: filters.amenities || [],
      page: 1,
      limit: pagination.limit,
      sortBy: filters.sortBy || 'createdAt',
      sortOrder: filters.sortOrder || 'desc'
    };
    
    try {
      setLoading(true);
      console.log('Area range search params:', searchParams);

      const response = await searchPropertiesAPI.searchProperties(searchParams);
      
      if (response.success) {
        setProperties(response.data?.properties || []);
        setPagination(prev => ({
          ...prev,
          page: 1,
          total: response.data?.pagination?.total || 0,
          totalPages: response.data?.pagination?.totalPages || 0,
          hasNext: response.data?.pagination?.hasNext || false
        }));
        
        // Update URL immediately after successful search
        const urlParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value && value !== '') {
            if (key === 'amenities' && Array.isArray(value) && value.length > 0) {
              urlParams.set(key, value.join(','));
            } else if (key !== 'amenities') {
              urlParams.set(key, value);
            }
          }
        });
        // Make sure to include the new area values
        if (range.min) urlParams.set('minArea', range.min);
        if (range.max) urlParams.set('maxArea', range.max);
        
        setSearchParams(urlParams);
        
      } else {
        console.error('Search failed:', response.message);
        setProperties([]);
        setPagination(prev => ({ ...prev, total: 0 }));
      }
    } catch (error) {
      console.error('Error searching properties:', error);
      setProperties([]);
      setPagination(prev => ({ ...prev, total: 0 }));
    } finally {
      setLoading(false);
    }
  };

  // Remove specific filter
  const removeFilter = async (filterType) => {
    let resetSearchData = { ...searchData };
    let resetSelectedPriceIndex = selectedPriceIndex;
    let resetSelectedAreaIndex = selectedAreaIndex;
    
    const newFilters = { ...filters };
    
    switch (filterType) {
      case 'search':
        newFilters.search = '';
        resetSearchData.search = '';
        setSearchInput(''); // Reset search input state
        break;
      case 'location':
        newFilters.provinceId = '';
        newFilters.districtId = '';
        newFilters.wardId = '';
        resetSearchData.provinceId = '';
        resetSearchData.districtId = '';
        setDistricts([]);
        break;
      case 'category':
        newFilters.category = '';
        resetSearchData.category = '';
        break;
      case 'price':
        newFilters.minPrice = '';
        newFilters.maxPrice = '';
        resetSearchData.minPrice = '';
        resetSearchData.maxPrice = '';
        resetSelectedPriceIndex = 0;
        break;
      case 'area':
        newFilters.minArea = '';
        newFilters.maxArea = '';
        resetSearchData.minArea = '';
        resetSearchData.maxArea = '';
        resetSelectedAreaIndex = 0;
        break;
      case 'amenities':
        newFilters.amenities = [];
        resetSearchData.amenities = [];
        break;
      default:
        break;
    }
    
    // Update filters state
    setFilters(newFilters);
    
    // Update Hero search data to sync
    setSearchData(resetSearchData);
    setSelectedPriceIndex(resetSelectedPriceIndex);
    setSelectedAreaIndex(resetSelectedAreaIndex);
    
    setPagination(prev => ({ ...prev, page: 1 }));
    
    // Update URL immediately
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && value !== '') {
        if (key === 'amenities' && Array.isArray(value) && value.length > 0) {
          params.set(key, value.join(','));
        } else if (key !== 'amenities') {
          params.set(key, value);
        }
      }
    });
    setSearchParams(params);
    
    // Search immediately with new filters
    await searchWithFilters(newFilters);
  };

  // Get active filters for display
  const getActiveFilters = () => {
    const activeFilters = [];

    if (filters.search) {
      activeFilters.push({
        type: 'search',
        label: `Từ khóa: "${filters.search}"`,
        value: filters.search
      });
     
    }

    if (filters.provinceId || filters.districtId || filters.wardId) {
      const locationParts = [];
      if (filters.wardId) {
        const ward = wards.find(w => w._id === filters.wardId);
        if (ward) locationParts.push(ward.name);
      }
      if (filters.districtId) {
        const district = districts.find(d => d._id === filters.districtId);
        if (district) locationParts.push(district.name);
      }
      if (filters.provinceId) {
        const province = provinces.find(p => p._id === filters.provinceId);
        if (province) locationParts.push(province.name);
      }
      
      if (locationParts.length > 0) {
        activeFilters.push({
          type: 'location',
          label: `Khu vực: ${locationParts.join(', ')}`,
          value: locationParts.join(', ')
        });
      }
    }

    if (filters.category) {
      const category = heroCategories.find(c => c.value === filters.category);
      if (category) {
        activeFilters.push({
          type: 'category',
          label: `Loại: ${category.label}`,
          value: category.label
        });
      }
    }

    if (filters.minPrice || filters.maxPrice) {
      let priceLabel = 'Giá: ';
      if (filters.minPrice && filters.maxPrice) {
        priceLabel += `${formatPrice(filters.minPrice)} - ${formatPrice(filters.maxPrice)}`;
      } else if (filters.minPrice) {
        priceLabel += `Từ ${formatPrice(filters.minPrice)}`;
      } else if (filters.maxPrice) {
        priceLabel += `Đến ${formatPrice(filters.maxPrice)}`;
      }
      
      activeFilters.push({
        type: 'price',
        label: priceLabel,
        value: `${filters.minPrice}-${filters.maxPrice}`
      });
    }

    if (filters.minArea || filters.maxArea) {
      let areaLabel = 'Diện tích: ';
      if (filters.minArea && filters.maxArea) {
        areaLabel += `${filters.minArea}m² - ${filters.maxArea}m²`;
      } else if (filters.minArea) {
        areaLabel += `Từ ${filters.minArea}m²`;
      } else if (filters.maxArea) {
        areaLabel += `Đến ${filters.maxArea}m²`;
      }
      
      activeFilters.push({
        type: 'area',
        label: areaLabel,
        value: `${filters.minArea}-${filters.maxArea}`
      });
    }

    if (filters.amenities && filters.amenities.length > 0) {
      activeFilters.push({
        type: 'amenities',
        label: `Tiện ích: ${filters.amenities.length} mục`,
        value: filters.amenities.join(',')
      });
    }

    return activeFilters;
  };

 


  // Handle favorite toggle
  const handleFavoriteToggle = async (propertyId, currentFavoriteStatus) => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để sử dụng tính năng này');
      navigate('/login');
      return;
    }

    try {
      const success = await toggleFavorite(propertyId);
      if (success) {
        // Update the property in state
        setProperties(prevProperties =>
          prevProperties.map(property =>
            property._id === propertyId
              ? { ...property, isFavorited: !currentFavoriteStatus }
              : property
          )
        );
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  // Handle property click
  const handlePropertyClick = async (propertyId) => {
    // View tracking is now handled by PropertyCard component
    // No need to track view here to avoid double counting
    navigate(`/properties/${propertyId}`);
  };

  // Handle page change for pagination
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages && !loading) {
      setPagination(prev => ({
        ...prev,
        page: newPage,
        hasPrev: newPage > 1,
        hasNext: newPage < pagination.totalPages
      }));
      
      // Load properties for the new page
      loadProperties(true, null, newPage);
      
      // Scroll to top when changing page
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };



  // Format price
  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN').format(price);
  };

  return (
    <div className={`properties-listing ${!searchResults ? 'home-mode' : ''}`}>
      {/* Phần Hero Search - Form tìm kiếm chính */}
      {!searchResults && (
        <section className='hero'>
            {/* Left Decorative Image */}
      <div className="left-decoration-listing">
        <img 
          src="https://res.cloudinary.com/dapvuniyx/image/upload/v1757584703/Screenshot_2025-09-11_165739_feoml8.png" 
          alt="Decoration" 
          className="decoration-image-listing"
        />
      </div>

      {/* Right Decorative Image */}
      <div className="right-decoration-listing">
        <img 
          src="https://res.cloudinary.com/dapvuniyx/image/upload/v1757584703/Screenshot_2025-09-11_165739_feoml8.png" 
          alt="Decoration" 
          className="decoration-image-listing"
        />

      </div>
          <div className='container'>
            {/* Form tìm kiếm Hero - Cho phép tìm kiếm theo địa điểm, loại hình, giá, diện tích */}
            <form className='hero-search-form' onSubmit={handleHeroSearch}>
              <div className='search-grid'>
                {/* Chọn tỉnh/thành phố */}
                <div className='search-box-hero'>
                  <label>Tỉnh/Thành phố</label>
                  <select
                    value={searchData.provinceId}
                    onChange={(e) => handleHeroInputChange('provinceId', e.target.value)}
                  >
                    <option key="default-province" value="">Chọn tỉnh/thành phố</option>
                    {provinces.map((province, index) => (
                      <option key={`province-${province._id || province.code || index}`} value={province.code || province._id}>
                        {province.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chọn quận/huyện */}
                <div className='search-box-hero'>
                  <label>Quận/Huyện</label>
                  <select
                    value={searchData.districtId}
                    onChange={(e) => handleHeroInputChange('districtId', e.target.value)}
                    disabled={!searchData.provinceId || loadingDistricts}
                  >
                    <option key="default-district" value="">
                      {!searchData.provinceId 
                        ? "Chọn tỉnh/thành phố trước" 
                        : loadingDistricts 
                        ? "Đang tải..." 
                        : "Chọn quận/huyện"
                      }
                    </option>
                    {districts.map((district, index) => (
                      <option key={`district-${district._id || district.code || index}`} value={district.code || district._id}>
                        {district.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chọn loại hình bất động sản */}
                <div className='search-box-hero'>
                  <label>Loại hình</label>
                  <select
                    value={searchData.category}
                    onChange={(e) => handleHeroInputChange('category', e.target.value)}
                  >
                    {heroCategories.map((category, index) => (
                      <option key={`category-${category.value || index}`} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chọn khoảng giá thuê */}
                <div className='search-box-hero'>
                  <label>Mức giá</label>
                  <select value={selectedPriceIndex} onChange={handleHeroPriceRangeChange}>
                    {heroPriceRanges.map((range, index) => (
                      <option key={`price-range-${index}`} value={index}>
                        {range.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chọn khoảng diện tích */}
                <div className='search-box-hero'>
                  <label>Diện tích</label>
                  <select value={selectedAreaIndex} onChange={handleHeroAreaRangeChange}>
                    {heroAreaRanges.map((range, index) => (
                      <option key={`area-range-${index}`} value={index}>
                        {range.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Nút mở modal chọn tiện ích */}
                <div className='search-box-hero'>
                  <label>Tiện ích</label>
                  <button 
                    type="button"
                    className="amenities-modal-btn-hero"
                    onClick={handleOpenAmenitiesModal}
                  >
                    <i className="fa fa-sliders"></i>
                    {searchData.amenities.length > 0 
                      ? `Đã chọn ${searchData.amenities.length} tiện ích`
                      : 'Chọn tiện ích'
                    }
                  </button>
                </div>
              </div>

              {/* Các nút thao tác tìm kiếm và đặt lại, container */}
              <div className='search-buttons-row'>
                <button type='submit' className='btn-search' disabled={searching}>
                  {searching ? (
                    <>
                      <LoadingSpinner size="small" />
                      Đang tìm kiếm...
                    </>
                  ) : (
                    <>
                      <i className='fa fa-search'></i>
                      Tìm kiếm
                    </>
                  )}
                </button>
                <button type='button' className='btn-reset-hero' onClick={handleResetFilters} disabled={searching}>
                  <i className='fa fa-refresh'></i>
                  Đặt lại
                </button>
              </div>
            </form>
            <div className='hero-heading'>
              <h2>Khám phá hàng nghìn căn phòng trọ chất lượng tại các khu vực hot nhất</h2>
            </div>
          </div>
        </section>
      )}

      <div className="container properties-listing-container">
        <div className="properties-wrapper">
          <div className="quick-search-listing">
            <div className="search-input-group-listing">
              <i className="fa fa-search"></i>
              <input
                type="text"
                placeholder="Tìm kiếm theo tiêu đề, mô tả, hẻm, tên đường..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={handleSearchInputKeyPress}
              />
              
              
              {searchInput && (
                <button
                  className="clear-search"
                  onClick={async () => {
                    setSearchInput('');
                    const newFilters = { ...filters, search: '' };
                    
                    // Also reset Hero search data
                    setSearchData(prev => ({ ...prev, search: '' }));
                    
                    setPagination(prev => ({ ...prev, page: 1 }));
                    
                    // Update URL immediately
                    const params = new URLSearchParams();
                    Object.entries(newFilters).forEach(([key, value]) => {
                      if (value && value !== '') {
                        if (key === 'amenities' && Array.isArray(value) && value.length > 0) {
                          params.set(key, value.join(','));
                        } else if (key !== 'amenities') {
                          params.set(key, value);
                        }
                      }
                    });
                    setSearchParams(params);
                    
                    // Search immediately with new filters
                    await searchWithFilters(newFilters);
                  }}
                >
                  <i className="fa fa-times"></i>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={`listing-content ${!searchResults ? 'home-layout' : ''}`}>
          {/* Nội dung chính - Chứa danh sách tin đăng và các bộ lọc */}
          <div className="main-content">
            {/* Results Header */}
            <div className="results-header">
              <div className="results-info">
                <h3>
                  <FaMapMarkerAlt className="results-icon" />
                  {loading ? (
                    'Đang tìm kiếm...'
                  ) : (
                    `Tìm thấy ${pagination.total} tin đăng`
                  )}
                </h3>
              </div>

              <div className="sort-controls">
                <label>
                  <FaSync className="sort-icon" />
                  Sắp xếp:
                </label>
                <select
                  value={`${filters.sortBy}_${filters.sortOrder}`}
                  onChange={(e) => {
                    const [sortBy, sortOrder] = e.target.value.split('_');
                    setFilters(prev => ({ ...prev, sortBy, sortOrder }));
                  }}
                >
                  {sortOptions.map((option, index) => (
                    <option key={`sort-${option.value || index}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active Filters */}
            {getActiveFilters().length > 0 && (
              <div style={{
                background: '#ffffff',
                border: '1px solid #e9ecef',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '30px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '15px',
                  paddingBottom: '10px',
                  borderBottom: '1px solid #e9ecef'
                }}>
                  <span style={{
                    fontWeight: '600',
                    color: '#495057',
                    fontSize: '14px'
                  }}>
                    <i className="fa fa-filter" style={{ marginRight: '8px', color: '#00b095ff' }}></i>
                    Đang lọc theo:
                  </span>
                  <button 
                    style={{
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onClick={async () => {
                      // Reset filters
                      const resetFilters = {
                        search: '',
                        provinceId: '',
                        districtId: '',
                        wardId: '',
                        category: '',
                        minPrice: '',
                        maxPrice: '',
                        minArea: '',
                        maxArea: '',
                        amenities: [],
                        sortBy: 'createdAt',
                        sortOrder: 'desc'
                      };
                      
                      // Reset Hero search data
                      setSearchData({
                        search: '',
                        provinceId: '',
                        districtId: '',
                        category: '',
                        minPrice: '',
                        maxPrice: '',
                        minArea: '',
                        maxArea: '',
                        amenities: []
                      });
                      
                      // Reset Hero select indices
                      setSelectedPriceIndex(0);
                      setSelectedAreaIndex(0);
                      setDistricts([]);
                      
                      setPagination(prev => ({ ...prev, page: 1 }));
                      
                      // Clear URL params immediately
                      setSearchParams(new URLSearchParams());
                      
                      // Search immediately with reset filters
                      await searchWithFilters(resetFilters);
                    }}
                  >
                    <i className="fa fa-refresh"></i>
                    Xóa tất cả
                  </button>
                </div>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  {getActiveFilters().map((filter, index) => (
                    <div key={index} style={{
                      background: 'linear-gradient(135deg, #00b095ff, #1cb9a1ff)',
                      color: 'white',
                      borderRadius: '20px',
                      padding: '8px 15px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      boxShadow: '0 2px 8px rgba(0,123,255,0.2)'
                    }}>
                      <span style={{ fontWeight: '500' }}>{filter.label}</span>
                      <button 
                        style={{
                          background: 'rgba(255,255,255,0.2)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '10px'
                        }}
                        onClick={() => removeFilter(filter.type)}
                        title="Xóa bộ lọc này"
                      >
                        <i className="fa fa-times"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Properties Grid */}
            <div className="properties-results">
              {loading ? (
                <div className="loading-state">
                  <LoadingSpinner size="large" />
                  <p>Đang tìm kiếm tin đăng...</p>
                </div>
              ) : properties.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <i className="fa fa-search"></i>
                  </div>
                  <h3>Không tìm thấy tin đăng nào</h3>
                  <p>Hãy thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm</p>
                </div>
              ) : (
                <>
                  <div className="properties-grid-list">
                    {properties.map((property) => (
                      <PropertyCard
                        key={property._id}
                        property={property}
                        onPropertyClick={handlePropertyClick}
                        onFavoriteToggle={handleFavoriteToggle}
                        isLoggedIn={true}
                      />
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  {pagination.totalPages > 1 && (
                    <div className="pagination-container">
                      <div className="pagination-info">
                        <span>Trang {pagination.page} của {pagination.totalPages} ({pagination.total} tin đăng)</span>
                      </div>
                      <div className="pagination-controls">
                        {/* Previous Button */}
                        <button
                          className="pagination-btn prev-btn"
                          onClick={() => handlePageChange(pagination.page - 1)}
                          disabled={!pagination.hasPrev || loading}
                          title="Trang trước"
                        >
                          <i className="fa fa-chevron-left"></i>
                          Trước
                        </button>

                        {/* Page Numbers */}
                        <div className="page-numbers">
                          {/* First page */}
                          {pagination.page > 3 && (
                            <>
                              <button
                                className="page-number-btn"
                                onClick={() => handlePageChange(1)}
                                disabled={loading}
                              >
                                1
                              </button>
                              {pagination.page > 4 && <span className="page-dots">...</span>}
                            </>
                          )}

                          {/* Previous pages */}
                          {pagination.page > 1 && (
                            <button
                              className="page-number-btn"
                              onClick={() => handlePageChange(pagination.page - 1)}
                              disabled={loading}
                            >
                              {pagination.page - 1}
                            </button>
                          )}

                          {/* Current page */}
                          <button className="page-number-btn active" disabled>
                            {pagination.page}
                          </button>

                          {/* Next pages */}
                          {pagination.page < pagination.totalPages && (
                            <button
                              className="page-number-btn"
                              onClick={() => handlePageChange(pagination.page + 1)}
                              disabled={loading}
                            >
                              {pagination.page + 1}
                            </button>
                          )}

                          {/* Last page */}
                          {pagination.page < pagination.totalPages - 2 && (
                            <>
                              {pagination.page < pagination.totalPages - 3 && <span className="page-dots">...</span>}
                              <button
                                className="page-number-btn"
                                onClick={() => handlePageChange(pagination.totalPages)}
                                disabled={loading}
                              >
                                {pagination.totalPages}
                              </button>
                            </>
                          )}
                        </div>

                        {/* Next Button */}
                        <button
                          className="pagination-btn next-btn"
                          onClick={() => handlePageChange(pagination.page + 1)}
                          disabled={!pagination.hasNext || loading}
                          title="Trang sau"
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

          {/* Thanh bên phải - Chứa các bộ lọc nhanh và thông tin bổ sung */}
          <div className="right-sidebar">
            {/* Bộ lọc nhanh theo khoảng giá */}
            <div className="sidebar-widget">
              <h4 className="widget-title">
                <FaMoneyBillWave />
                Xem theo khoảng giá
              </h4>
              <div className="price-quick-links">
                {rightSidebarPriceRanges.map((range, index) => {
                  // Check if this range is active (matches either filters or searchData)
                  // Handle null vs '' difference for max values
                  const normalizeMaxValue = (val) => val === null || val === '' ? null : Number(val);
                  
                  const isActiveFromFilters = Number(filters.minPrice) === range.min && 
                    normalizeMaxValue(filters.maxPrice) === normalizeMaxValue(range.max);
                  
                  const isActiveFromSearchData = Number(searchData.minPrice) === range.min && 
                    normalizeMaxValue(searchData.maxPrice) === normalizeMaxValue(range.max);
                  
                  const isActive = isActiveFromFilters || isActiveFromSearchData;
                  
                  return (
                    <button
                      key={`sidebar-price-${index}`}
                      className={`price-quick-btn ${isActive ? 'active' : ''}`}
                      onClick={() => handlePriceRangeSelect(range)}
                    >
                      {range.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Area Quick Filter */}
            <div className="sidebar-widget">
              <h4 className="widget-title">
                <FaExpand />
                Xem theo diện tích
              </h4>
              <div className="area-quick-links">
                {rightSidebarAreaRanges.map((range, index) => {
                  // Check if this range is active (matches either filters or searchData)
                  // Handle null vs '' difference for max values
                  const normalizeMaxValue = (val) => val === null || val === '' ? null : Number(val);
                  
                  const isActiveFromFilters = Number(filters.minArea) === range.min && 
                    normalizeMaxValue(filters.maxArea) === normalizeMaxValue(range.max);
                  
                  const isActiveFromSearchData = Number(searchData.minArea) === range.min && 
                    normalizeMaxValue(searchData.maxArea) === normalizeMaxValue(range.max);
                  
                  const isActive = isActiveFromFilters || isActiveFromSearchData;
                  
                  return (
                    <button
                      key={`sidebar-area-${index}`}
                      className={`area-quick-btn ${isActive ? 'active' : ''}`}
                      onClick={() => handleAreaRangeSelect(range)}
                    >
                      {range.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recent Posts */}
            <div className="sidebar-widget">
              <h4 className="widget-title">
                <FaClock />
                Tin mới đăng
              </h4>
              <div className="recent-posts">
                {properties.slice(0, 5).map((property) => (
                  <div key={property._id} className="recent-post-item" onClick={async () => {
                    // Record view when clicking on recent post
                    try {
                      if (!viewTrackingUtils.hasBeenViewed(property._id)) {
                        await propertyDetailAPI.recordPropertyView(property._id);
                        viewTrackingUtils.markAsViewedWithTimestamp(property._id);
                      }
                    } catch (error) {
                      console.error('Error recording view:', error);
                    }
                    navigate(`/properties/${property._id}`);
                  }}>
                    <div className="recent-post-image">
                      {property.images && property.images.length > 0 ? (
                        <img src={property.images[0]} alt={property.title} />
                      ) : (
                        <div className="no-image-placeholder">
                          <i className="fa fa-home"></i>
                        </div>
                      )}
                    </div>
                    <div className="recent-post-info">
                      <h5 className="recent-post-title">{property.title}</h5>
                      <p className="recent-post-price">{formatPrice(property.rentPrice)} VNĐ/tháng</p>
                      <p className="recent-post-location">
                        <i className="fa fa-map-marker"></i>
                        {property.location?.districtName}, {property.location?.provinceName}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Blog Posts Widget */}
            <div className="sidebar-widget">
              <h4 className="widget-title">
                <FaNewspaper />
                Bài viết mới
              </h4>
              <div className="blog-posts">
                <div className="blog-post-item">
                  <h5>5 Tips để tìm phòng trọ giá rẻ</h5>
                  <p className="blog-post-date">
                    <FaCalendarAlt />
                    2 ngày trước
                  </p>
                </div>
                <div className="blog-post-item">
                  <h5>Hướng dẫn thuê phòng trọ an toàn</h5>
                  <p className="blog-post-date">
                    <FaCalendarAlt />
                    1 tuần trước
                  </p>
                </div>
                <div className="blog-post-item">
                  <h5>Quyền lợi của người thuê trọ</h5>
                  <p className="blog-post-date">
                    <FaCalendarAlt />
                    2 tuần trước
                  </p>
                </div>
              </div>
            </div>

            {/* Recommended Properties */}
            <div className="sidebar-widget">
              <h4 className="widget-title">
                <FaHeart />
                Có thể bạn quan tâm
              </h4>
              <div className="recommended-properties">
                {properties.slice(0, 4).map((property) => (
                  <div key={property._id} className="recommended-item" onClick={async () => {
                    // Record view when clicking on recommended property
                    try {
                      if (!viewTrackingUtils.hasBeenViewed(property._id)) {
                        await propertyDetailAPI.recordPropertyView(property._id);
                        viewTrackingUtils.markAsViewedWithTimestamp(property._id);
                      }
                    } catch (error) {
                      console.error('Error recording view:', error);
                    }
                    navigate(`/properties/${property._id}`);
                  }}>
                    <div className="recommended-image">
                      {property.images && property.images.length > 0 ? (
                        <img src={property.images[0]} alt={property.title} />
                      ) : (
                        <div className="no-image-placeholder">
                          <i className="fa fa-home"></i>
                        </div>
                      )}
                    </div>
                    <div className="recommended-info">
                      <h5 className="recommended-title">{property.title}</h5>
                      <p className="recommended-price">{formatPrice(property.rentPrice)} VNĐ/tháng</p>
                      <div className="recommended-meta">
                        <span><i className="fa fa-expand"></i> {property.area}m²</span>
                        <span><i className="fa fa-users"></i> {property.maxOccupants} người</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Amenities Modal */}
      {showAmenitiesModal && (
        <div 
          className="modal-overlay-hero" 
          onClick={handleCloseAmenitiesModal}
        >
          <div 
            className="amenities-modal-hero" 
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header-hero">
              <h3>
                <i className="fa fa-star"></i>
                Chọn tiện ích
              </h3>
              <button 
                className="close-btn-hero"
                onClick={handleCancelAmenities}
                title="Đóng mà không lưu thay đổi"
              >
                <i className="fa fa-times"></i>
              </button>
            </div>
            
            <div className="modal-body-hero">
              <div className="amenities-grid-hero">
                {amenities.map(amenity => {
                  const isSelected = tempSelectedAmenities.includes(amenity._id);
                  return (
                    <label 
                      key={amenity._id} 
                      className={`amenity-checkbox-hero ${isSelected ? 'checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleAmenityModalToggle(amenity._id)}
                        style={{ display: 'none' }}
                      />
                      <div className={`amenity-card-hero ${isSelected ? 'selected' : ''}`}>
                        <i className={`fa ${amenity.icon}`}></i>
                        <span>{amenity.name}</span>
                        <div className="checkmark-hero">
                          <i className="fa fa-check"></i>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
            
            <div className="modal-footer-hero">
              <button 
                className="btn btn-outline-hero"
                onClick={handleCancelAmenities}
              >
                <i className="fa fa-times"></i>
                Hủy
              </button>
              <button 
                className="btn btn-primary-hero"
                onClick={handleApplyAmenities}
              >
                <i className="fa fa-check"></i>
                Áp dụng ({tempSelectedAmenities.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ChatBot Component */}
      <ChatBot 
        onPropertySearch={(properties) => {
          // Handle property search results from chatbot
          console.log('Properties from chatbot:', properties);
        }}
        formatPrice={formatPrice}
      />

      {/* Go to Top Button */}
      {showGoToTop && (
        <button 
          className="go-to-top-btn"
          onClick={scrollToTop}
          aria-label="Go to top"
        >
         <FaArrowUp  size={20} className="text-black" />
        </button>
      )}

      

    </div>
  );
};

export default PropertiesListing;
export { PropertiesListing };