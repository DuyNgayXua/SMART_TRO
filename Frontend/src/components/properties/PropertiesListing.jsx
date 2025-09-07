import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { propertiesViewAPI } from '../../services/propertiesAPI';
import { myPropertiesAPI } from '../../services/myPropertiesAPI';
import searchPropertiesAPI from '../../services/searchPropertiesAPI';
import { locationAPI } from '../../services/locationAPI';
import amenitiesAPI from '../../services/amenitiesAPI';
import { useAuth } from '../../contexts/AuthContext';
import PropertyCard from './PropertyCard';
import Heading from "../common/Heading";
import {
  FaMapMarkerAlt,
  FaCheckCircle,
  FaSync,
  FaCalendarAlt,
  FaNewspaper,
  FaHeart,
  FaMoneyBillWave,
  FaExpand,
  FaClock
} from 'react-icons/fa';
import './PropertiesListing.css';

const PropertiesListing = ({ isHomePage = false, searchResults = null, searchParams: externalSearchParams = null }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  // States
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Location data
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);

  // Hero search states
  const [amenities, setAmenities] = useState([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [showAmenitiesModal, setShowAmenitiesModal] = useState(false);
  const [tempSelectedAmenities, setTempSelectedAmenities] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPriceIndex, setSelectedPriceIndex] = useState(0);
  const [selectedAreaIndex, setSelectedAreaIndex] = useState(0);

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
    limit: isHomePage ? 8 : 12, // Show fewer items on home page
    total: 0,
    totalPages: 0,
    hasNext: false
  });

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

  // Load more when page changes
  useEffect(() => {
    if (pagination.page > 1) {
      loadProperties(false);
    }
  }, [pagination.page]);

  // Handle external search results (from Hero component)
  useEffect(() => {
    if (searchResults && isHomePage) {
      setProperties(searchResults.properties || []);
      setPagination(prev => ({
        ...prev,
        total: searchResults.pagination?.total || 0,
        totalPages: searchResults.pagination?.totalPages || 0,
        hasNext: searchResults.pagination?.hasNext || false,
        page: 1
      }));
    } else if (searchResults === null && isHomePage) {
      // Reset to load all properties when search is cleared
      if (provinces.length > 0) {
        loadProperties(true);
      }
    }
  }, [searchResults, isHomePage, provinces.length]);

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
  const loadProperties = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPagination(prev => ({ ...prev, page: 1 }));
      } else {
        setLoadingMore(true);
      }

      const params = {
        ...filters,
        page: reset ? 1 : pagination.page,
        limit: pagination.limit
      };
      console.log('Loading properties with params:', params);

      // Clean empty params
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key];
        }
      });

      let response;
      // Always use search API when there are any filters applied or search term
      const hasFilters = filters.search || filters.provinceId || filters.districtId || 
                        filters.wardId || filters.category || filters.minPrice || 
                        filters.maxPrice || filters.minArea || filters.maxArea || 
                        (filters.amenities && filters.amenities.length > 0);

      if (hasFilters || !isHomePage) {
        // Use search API when filters are applied or not on home page
        response = await searchPropertiesAPI.searchProperties(params);
      } else {
        // Use general properties API only when no filters and on home page
        response = await myPropertiesAPI.getMyApprovedProperties(params);
      }

      console.log('Properties response:', response.data || response);

      if (response.success) {
        const newProperties = response.data?.properties || [];

        if (reset) {
          setProperties(newProperties);
        } else {
          setProperties(prev => [...prev, ...newProperties]);
        }

        setPagination(prev => ({
          ...prev,
          total: response.data?.pagination?.total || 0,
          totalPages: response.data?.pagination?.totalPages || 0,
          hasNext: response.data?.pagination?.hasNext || false
        }));
      } else {
        if (reset) {
          setProperties([]);
        }
        toast.error('Không thể tải danh sách tin đăng');
      }
    } catch (error) {
      console.error('Error loading properties:', error);
      toast.error('Lỗi khi tải danh sách tin đăng');
      if (reset) {
        setProperties([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Load districts when province changes in Hero
  const loadDistrictsHero = async (provinceId) => {
    console.log('Loading districts for provinceId:', provinceId);
    try {
      setLoadingDistricts(true);
      const districtsRes = await locationAPI.getDistricts(provinceId);
      console.log('Districts:', districtsRes);
      
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

  const handleResetFilters = () => {
    // Reset searchData (Hero form)
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
    
    // Reset filters (for sidebar and general filtering)
    setFilters({
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
    });
    
    setPagination(prev => ({ ...prev, page: 1 }));
    
    // Clear URL params immediately
    setSearchParams(new URLSearchParams());
    
    // Call search API to load all properties
    setTimeout(() => searchWithFilters(), 100);
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
      console.log('Hero search params:', searchParams);

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
  const searchWithFilters = async () => {
    if (!searchResults) { // Only search if not using external search results
      // This will search properties by title, address (detailAddress), and description via backend API
      console.log('Searching with filters:', {
        search: filters.search, // Will search in title, description, detailAddress
        ...filters
      });
      await loadProperties(true);
      // Don't call updateURL() here as it's handled by individual filter functions
    }
  };

  // Load districts when province changes in Hero
  useEffect(() => {
    if (searchData.provinceId) {
      console.log('searchData:', searchData);
      loadDistrictsHero(searchData.provinceId);
    } else {
      setDistricts([]);
      setSearchData(prev => ({ ...prev, districtId: '' }));
    }
  }, [searchData.provinceId]);

  // Debounced search for text input
  useEffect(() => {
    if (filters.search && !searchResults) {
      const timeoutId = setTimeout(() => {
        searchWithFilters();
        // Update URL after debounced search
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value && value !== '') {
            if (key === 'amenities' && Array.isArray(value) && value.length > 0) {
              params.set(key, value.join(','));
            } else if (key !== 'amenities') {
              params.set(key, value);
            }
          }
        });
        setSearchParams(params);
      }, 500); // Debounce 500ms

      return () => clearTimeout(timeoutId);
    }
  }, [filters.search, searchResults]);

  // Handle price range selection (sync with Hero and call API)
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
    
    // Search immediately after removing filter
    setTimeout(() => searchWithFilters(), 100);
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
      console.log('Active search filter:', filters.search);
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

  // Handle amenity toggle
  const handleAmenityToggle = (amenityId) => {
    setFilters(prev => {
      const amenities = prev.amenities.includes(amenityId)
        ? prev.amenities.filter(id => id !== amenityId)
        : [...prev.amenities, amenityId];
      return { ...prev, amenities };
    });
  };

  // Update URL with current filters
  const updateURL = () => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== '') {
        if (key === 'amenities' && Array.isArray(value) && value.length > 0) {
          params.set(key, value.join(','));
        } else if (key !== 'amenities') {
          params.set(key, value);
        }
      }
    });

    setSearchParams(params);
  };

  // Handle favorite toggle
  const handleFavoriteToggle = async (propertyId, isFavorited) => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để sử dụng tính năng này');
      navigate('/login');
      return;
    }

    try {
      if (isFavorited) {
        await propertiesViewAPI.removeFromFavorites(propertyId);
        toast.success('Đã xóa khỏi danh sách yêu thích');
      } else {
        await propertiesViewAPI.addToFavorites(propertyId);
        toast.success('Đã thêm vào danh sách yêu thích');
      }

      // Update the property in state
      setProperties(prevProperties =>
        prevProperties.map(property =>
          property._id === propertyId
            ? { ...property, isFavorited: !isFavorited }
            : property
        )
      );
    } catch (error) {
      toast.error('Có lỗi xảy ra, vui lòng thử lại');
    }
  };

  // Handle property click
  const handlePropertyClick = async (propertyId) => {
    // Track view
    await propertiesViewAPI.viewProperty(propertyId);
    navigate(`/properties/${propertyId}`);
  };

  // Load more properties
  const loadMore = () => {
    if (pagination.hasNext && !loadingMore) {
      setPagination(prev => ({
        ...prev,
        page: prev.page + 1
      }));
    }
  };

  // Format price
  const formatPrice = (price) => {
    if (price >= 1000000) {
      return `${(price / 1000000).toFixed(1)} triệu`;
    }
    return new Intl.NumberFormat('vi-VN').format(price);
  };

  return (
    <div className={`properties-listing ${isHomePage ? 'home-mode' : ''}`}>
      {/* Hero Section for Home Page */}
      {isHomePage && (
        <section className='hero'>
          <div className='container'>
            <form className='hero-search-form' onSubmit={handleHeroSearch}>
              <div className='search-grid'>
                {/* Location */}
                <div className='search-box-hero'>
                  <label>Tỉnh/Thành phố</label>
                  <select
                    value={searchData.provinceId}
                    onChange={(e) => handleHeroInputChange('provinceId', e.target.value)}
                  >
                    <option value="">Chọn tỉnh/thành phố</option>
                    {provinces.map(province => (
                      <option key={province._id} value={province.code || province._id}>
                        {province.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* District */}
                <div className='search-box-hero'>
                  <label>Quận/Huyện</label>
                  <select
                    value={searchData.districtId}
                    onChange={(e) => handleHeroInputChange('districtId', e.target.value)}
                    disabled={!searchData.provinceId || loadingDistricts}
                  >
                    <option value="">
                      {!searchData.provinceId 
                        ? "Chọn tỉnh/thành phố trước" 
                        : loadingDistricts 
                        ? "Đang tải..." 
                        : "Chọn quận/huyện"
                      }
                    </option>
                    {districts.map(district => (
                      <option key={district._id} value={district.code || district._id}>
                        {district.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div className='search-box-hero'>
                  <label>Loại hình</label>
                  <select
                    value={searchData.category}
                    onChange={(e) => handleHeroInputChange('category', e.target.value)}
                  >
                    {heroCategories.map(category => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price Range */}
                <div className='search-box-hero'>
                  <label>Mức giá</label>
                  <select value={selectedPriceIndex} onChange={handleHeroPriceRangeChange}>
                    {heroPriceRanges.map((range, index) => (
                      <option key={index} value={index}>
                        {range.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Area Range */}
                <div className='search-box-hero'>
                  <label>Diện tích</label>
                  <select value={selectedAreaIndex} onChange={handleHeroAreaRangeChange}>
                    {heroAreaRanges.map((range, index) => (
                      <option key={index} value={index}>
                        {range.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amenities Modal Button */}
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

              {/* Search Buttons */}
              <div className='search-buttons-row'>
                <button type='submit' className='btn-search' disabled={searching}>
                  {searching ? (
                    <>
                      <i className='fa fa-spinner fa-spin'></i>
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

      <div className="container">
        {/* Quick Search for Home Page */}
        {isHomePage && (
          <div className="quick-search">
            <div className="search-input-group">
              <i className="fa fa-search"></i>
              <input
                type="text"
                placeholder="Tìm kiếm theo tiêu đề, mô tả, hẻm, tên đường..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
              {filters.search && (
                <button
                  className="clear-search"
                  onClick={async () => {
                    const newFilters = { ...filters, search: '' };
                    setFilters(newFilters);
                    
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
                    
                    // Search immediately after clearing search
                    setTimeout(() => searchWithFilters(), 100);
                  }}
                >
                  <i className="fa fa-times"></i>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="listing-content home-layout">
          {/* Main Content */}
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
                  {sortOptions.map(option => (
                    <option key={option.value} value={option.value}>
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
                      
                      setFilters(resetFilters);
                      
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
                      
                      // Search immediately after clearing all filters
                      setTimeout(() => searchWithFilters(), 100);
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
                  <div className="loading-spinner">
                    <i className="fa fa-spinner fa-spin"></i>
                  </div>
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

                  {/* Load More Button */}
                  {pagination.hasNext && (
                    <div className="load-more-container">
                      <button
                        className="btn btn-outline load-more-btn"
                        onClick={loadMore}
                        disabled={loadingMore}
                      >
                        {loadingMore ? (
                          <>
                            <i className="fa fa-spinner fa-spin"></i>
                            Đang tải...
                          </>
                        ) : (
                          <>
                            <i className="fa fa-plus"></i>
                            Xem thêm ({pagination.total - properties.length} tin)
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="right-sidebar">
            {/* Price Quick Filter */}
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
                      key={index}
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
                      key={index}
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
                  <div key={property._id} className="recent-post-item" onClick={() => handlePropertyClick(property._id)}>
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
                {properties.slice(0, 3).map((property) => (
                  <div key={property._id} className="recommended-item" onClick={() => handlePropertyClick(property._id)}>
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
    </div>
  );
};

export default PropertiesListing;
export { PropertiesListing };
