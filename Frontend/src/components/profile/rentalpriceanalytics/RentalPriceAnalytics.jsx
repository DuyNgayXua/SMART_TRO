import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Area,
  AreaChart
} from 'recharts';
import axios from 'axios';
import { toast } from 'react-toastify';
import { locationAPI } from '../../../services/locationAPI';
import amenitiesAPI from '../../../services/amenitiesAPI';
import RentalAnalyticsAPI from '../../../services/RentalAnalyticsAPI';
import '../ProfilePages.css';
import './RentalPriceAnalytics.css';

const RentalPriceAnalytics = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);

  // Updated to match new schema: only province and ward (no district)
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedWard, setSelectedWard] = useState('');
  const [propertyCategory, setPropertyCategory] = useState('');
  const [areaRange, setAreaRange] = useState('');
  const [newsKeyword, setNewsKeyword] = useState('');
  const [timePeriod, setTimePeriod] = useState('3'); // Default to 3 months
  // Typing effect states
  const [currentPlaceholder, setCurrentPlaceholder] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  const [priceData, setPriceData] = useState([]);
  const [newsData, setNewsData] = useState([]);
  const [sentimentData, setSentimentData] = useState([
    { name: 'Tích cực', value: 45, color: '#10B981' },
    { name: 'Trung tính', value: 35, color: '#F59E0B' },
    { name: 'Tiêu cực', value: 20, color: '#EF4444' }
  ]);
  const [priceRangeData, setPriceRangeData] = useState([
    { range: '2-3 triệu', count: 35, percentage: 35 },
    { range: '3-4 triệu', count: 28, percentage: 28 },
    { range: '4-5 triệu', count: 20, percentage: 20 },
    { range: '5-7 triệu', count: 12, percentage: 12 },
    { range: 'Trên 7 triệu', count: 5, percentage: 5 }
  ]);
  const [regionComparison, setRegionComparison] = useState([]);
  const [priceSummary, setPriceSummary] = useState(null);

  // Location data states - updated to match new schema
  const [provinces, setProvinces] = useState([]);
  const [wards, setWards] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  // Amenities data state
  const [amenities, setAmenities] = useState([]);
  
  // Amenities modal state
  const [showAmenitiesModal, setShowAmenitiesModal] = useState(false);
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [tempSelectedAmenities, setTempSelectedAmenities] = useState([]);

  // Chart animation state
  const [isChartLoading, setIsChartLoading] = useState(false);

  // Chart animation styles function
  const getChartAnimationStyle = () => ({
    position: 'relative',
    transition: 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out',
    opacity: isChartLoading ? 0.3 : 1,
    transform: isChartLoading ? 'translateY(10px)' : 'translateY(0px)'
  });

  // Typing effect placeholders
  const placeholderTexts = [
    'Giá thuê trọ hôm nay ở quận Gò Vấp...',
  ];

  // Load initial data on component mount
  useEffect(() => {
    loadProvinces();
    loadAmenities();
  }, []);

  // Load wards when province changes
  useEffect(() => {
    if (selectedProvince) {
      console.log('Province changed to:', selectedProvince, 'Loading wards...');
      loadWards(selectedProvince);
    } else {
      console.log('Province cleared, resetting wards');
      setWards([]);
      setSelectedWard('');
    }
  }, [selectedProvince]);  // Load analytics data when filters change (including selectedAmenities)
  useEffect(() => {
    loadAnalyticsData();
  }, [selectedProvince, selectedWard, propertyCategory, areaRange, selectedAmenities, timePeriod]);

  // Typing effect for placeholder
  useEffect(() => {
    let timeout;

    const typeText = () => {
      const currentText = placeholderTexts[placeholderIndex];

      if (isTyping) {
        // Typing phase
        if (currentPlaceholder.length < currentText.length) {
          timeout = setTimeout(() => {
            setCurrentPlaceholder(currentText.slice(0, currentPlaceholder.length + 1));
          }, 100); // Typing speed
        } else {
          // Wait before erasing
          timeout = setTimeout(() => {
            setIsTyping(false);
          }, 2000); // Wait time
        }
      } else {
        // Erasing phase
        if (currentPlaceholder.length > 0) {
          timeout = setTimeout(() => {
            setCurrentPlaceholder(currentText.slice(0, currentPlaceholder.length - 1));
          }, 50); // Erasing speed
        } else {
          // Move to next placeholder
          setPlaceholderIndex((prev) => (prev + 1) % placeholderTexts.length);
          setIsTyping(true);
        }
      }
    };

    // Only run typing effect when newsKeyword is empty
    if (!newsKeyword) {
      typeText();
    } else {
      // Reset when user starts typing
      setCurrentPlaceholder('Nhập từ khóa để tìm tin tức...');
    }

    return () => clearTimeout(timeout);
  }, [currentPlaceholder, placeholderIndex, isTyping, newsKeyword, placeholderTexts]);

  // Load provinces and amenities on component mount
  useEffect(() => {
    loadProvinces();
    loadAmenities();
  }, []);



  // Load provinces using locationAPI
  const loadProvinces = async () => {
    try {
      setLoadingLocations(true);
      const response = await locationAPI.getProvinces();

      if (response.success && response.data) {
        // Sort provinces alphabetically
        const sortedProvinces = response.data.sort((a, b) =>
          a.name.localeCompare(b.name, 'vi', { numeric: true })
        );
        setProvinces(sortedProvinces);
      }
    } catch (error) {
      console.error('Error loading provinces:', error);
      // Fallback to major cities if API fails
      setProvinces([
        { code: 'TP. Hồ Chí Minh', name: 'TP. Hồ Chí Minh' },
        { code: 'Hà Nội', name: 'Hà Nội' },
        { code: 'Đà Nẵng', name: 'Đà Nẵng' }
      ]);
    } finally {
      setLoadingLocations(false);
    }
  };

  // Load amenities using amenitiesAPI
  const loadAmenities = async () => {
    try {
      const response = await amenitiesAPI.getAllAmenities();

      if (response.success && response.data) {
        // The backend returns { amenities: [...], pagination: {...} }
        const amenitiesData = response.data.amenities || [];

        if (Array.isArray(amenitiesData)) {
          // Map amenities to the format used by the dropdown and ensure unique values
          const formattedAmenities = amenitiesData.map((amenity, index) => ({
            value: amenity.name || amenity.key || `amenity_${index}`,
            label: amenity.name || amenity.key || `Tiện ích ${index + 1}`,
            icon: amenity.icon || 'fas fa-home' // fallback icon
          }));

          // Remove duplicates based on value
          const uniqueAmenities = formattedAmenities.filter((amenity, index, self) =>
            index === self.findIndex(a => a.value === amenity.value)
          );

          setAmenities(uniqueAmenities);
        } else {
          console.warn('Amenities data is not an array:', amenitiesData);
          setAmenities([]);
        }
      } else {
        console.warn('Invalid amenities response:', response);
        setAmenities([]);
      }
    } catch (error) {
      console.error('Error loading amenities:', error);
      // Fallback to common amenities if API fails
      const fallbackAmenities = [
        { value: 'wifi', label: 'WiFi miễn phí', icon: 'fas fa-wifi' },
        { value: 'parking', label: 'Chỗ đỗ xe', icon: 'fas fa-car' },
        { value: 'laundry', label: 'Máy giặt', icon: 'fas fa-tshirt' },
        { value: 'kitchen', label: 'Bếp nấu ăn', icon: 'fas fa-utensils' },
        { value: 'ac', label: 'Điều hòa', icon: 'fas fa-snowflake' },
        { value: 'fridge', label: 'Tủ lạnh', icon: 'fas fa-temperature-low' },
        { value: 'security', label: 'An ninh 24/7', icon: 'fas fa-shield-alt' },
        { value: 'elevator', label: 'Thang máy', icon: 'fas fa-elevator' }
      ];
      setAmenities(fallbackAmenities);
    }
  };

  // Load wards from locationAPI
  const loadWards = async (provinceName) => {
    if (!provinceName) {
      setWards([]);
      return;
    }

    try {
      setLoadingLocations(true);

      const response = await locationAPI.getWards(provinceName);


      if (response.success && response.data) {
        // Sort wards alphabetically
        const sortedWards = response.data.sort((a, b) =>
          a.name.localeCompare(b.name, 'vi', { numeric: true })
        );

        setWards(sortedWards);
      } else {
        console.warn('No wards data received for province:', provinceName);
        setWards([]);
      }
    } catch (error) {
      console.error('Error loading wards:', error);
      setWards([]);
    } finally {
      setLoadingLocations(false);
    }
  };

  const loadAnalyticsData = async () => {
    setLoading(true);
    setIsChartLoading(true);
    try {
      // Build location parameter based on province/ward selection
      let locationParam = null;
      if (selectedProvince) {
        locationParam = {
          province: selectedProvince, // Send province name directly
          category: propertyCategory,
          areaRange: areaRange
        };

        // Only add ward if it has a value (not empty string)
        if (selectedWard && selectedWard.trim() !== '') {
          locationParam.ward = selectedWard;
        }

        // Only add amenities if they are selected
        if (selectedAmenities && selectedAmenities.length > 0) {
          locationParam.amenities = selectedAmenities;
          console.log('Selected amenities being sent:', selectedAmenities);
        }
      } else if (propertyCategory || areaRange || (selectedAmenities && selectedAmenities.length > 0)) {
        // If only filters are selected without province
        locationParam = {
          category: propertyCategory,
          areaRange: areaRange
        };

        // Only add amenities if they are selected
        if (selectedAmenities && selectedAmenities.length > 0) {
          locationParam.amenities = selectedAmenities;
          console.log('Selected amenities being sent (without province):', selectedAmenities);
        }
      }

      // Add time period to location param
      if (locationParam) {
        locationParam.months = timePeriod;
      } else {
        locationParam = { months: timePeriod };
      }

      console.log('Final locationParam being sent to API:', locationParam);

      // Load analytics data with location filtering (exclude news analysis)
      await Promise.all([
        loadPriceTrends(locationParam),
        loadPriceRanges(locationParam),
        loadPriceSummary(locationParam)
      ]);

      // Add delay for smooth transition effect
      setTimeout(() => {
        setIsChartLoading(false);
      }, 300);
    } catch (error) {
      console.error('Error loading analytics data:', error);
      setIsChartLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const loadPriceTrends = async (locationParam = null) => {
    try {
      const response = await RentalAnalyticsAPI.getPriceTrends(locationParam);
      if (response.success && response.data) {
        // Transform backend data format to match frontend chart
        // Backend returns: [{month: "1/2025", avgPrice: 4500000, count: 15}, ...]
        // Frontend expects: [{month: "T1/2025", price: 4500000, count: 15, change: X}, ...]
        const transformedData = response.data.map((item, index) => {
          // Calculate month-over-month change
          let change = 0;
          if (index > 0 && response.data[index - 1]) {
            const currentPrice = item.avgPrice;
            const previousPrice = response.data[index - 1].avgPrice;
            change = previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice * 100) : 0;
          }

          return {
            month: `T${item.month}`, // Convert "1/2025" to "T1/2025"
            price: item.avgPrice,
            count: item.count,
            change: parseFloat(change.toFixed(1))
          };
        });
        console.log('Transformed Price Data:', transformedData);

        setPriceData(transformedData);
      } else {
        // Fallback to mock data if API fails
        const mockData = [
          { month: 'T8/2024', price: 4200000, count: 25, change: 2.5 },
          { month: 'T9/2024', price: 4350000, count: 28, change: 3.6 },
          { month: 'T10/2024', price: 4500000, count: 32, change: 3.4 },
          { month: 'T11/2024', price: 4650000, count: 30, change: 3.3 },
          { month: 'T12/2024', price: 4800000, count: 35, change: 3.2 },
          { month: 'T1/2025', price: 4950000, count: 38, change: 3.1 }
        ];
        setPriceData(mockData);
      }
    } catch (error) {
      console.error('Error loading price trends:', error);
      // Use mock data as fallback
      const mockData = [
        { month: 'T8/2024', price: 4200000, count: 25, change: 2.5 },
        { month: 'T9/2024', price: 4350000, count: 28, change: 3.6 },
        { month: 'T10/2024', price: 4500000, count: 32, change: 3.4 },
        { month: 'T11/2024', price: 4650000, count: 30, change: 3.3 },
        { month: 'T12/2024', price: 4800000, count: 35, change: 3.2 },
        { month: 'T1/2025', price: 4950000, count: 38, change: 3.1 }
      ];
      setPriceData(mockData);
    }
  };

  const loadNewsAnalysis = async (keyword) => {
    try {
      const response = await RentalAnalyticsAPI.getNewsSentiment(keyword);
      console.log('News analysis response:', response);
      if (response.success) {
        setSentimentData(response.data.sentiment);
        setNewsData(response.data.news);
        
        // Hiển thị toast thành công
        toast.success(`Tìm thấy ${response.data.totalResults || response.data.news?.length || 0} tin tức về "${keyword}"`, {
          position: "top-right",
          autoClose: 2000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true
        });
      } else {
        // Fallback to mock data
        const mockSentiment = [
          { name: 'Tích cực', value: 45, color: '#10B981' },
          { name: 'Trung tính', value: 35, color: '#F59E0B' },
          { name: 'Tiêu cực', value: 20, color: '#EF4444' }
        ];
        setSentimentData(mockSentiment);

        const mockNews = [
          {
            title: 'Giá thuê nhà trọ tại TP.HCM tăng 3.2% trong tháng 1/2025',
            sentiment: 'positive',
            date: '2025-01-25',
            source: 'VnExpress'
          },
          {
            title: 'Thị trường cho thuê phòng trọ Hà Nội ổn định',
            sentiment: 'neutral',
            date: '2025-01-24',
            source: 'Vietnamnet'
          },
          {
            title: 'Sinh viên khó tìm phòng trọ giá rẻ tại Đà Nẵng',
            sentiment: 'negative',
            date: '2025-01-23',
            source: 'Tuổi Trẻ'
          }
        ];
        setNewsData(mockNews);
      }
    } catch (error) {
      console.error('Error loading news analysis:', error);
     
      
      // Xử lý error 400 - từ khóa không hợp lệ
      if (error.response && error.response.status === 400) {
        const errorMessage = error.response.data?.message || 'Từ khóa tìm kiếm không hợp lệ cho chủ đề thuê trọ.';
        toast.error(errorMessage, {
          position: "top-right",
          autoClose: 4000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true
        });
        
        // Không hiển thị mock data khi từ khóa không hợp lệ
        setNewsData([]);
        setSentimentData([]);
        return;
      }
      
      // Hiển thị toast cho các lỗi khác
      toast.error('Có lỗi xảy ra khi tải tin tức. Đang hiển thị dữ liệu mẫu.', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true
      });
      
      // Use mock data as fallback for other errors
      const mockSentiment = [
        { name: 'Tích cực', value: 45, color: '#10B981' },
        { name: 'Trung tính', value: 35, color: '#F59E0B' },
        { name: 'Tiêu cực', value: 20, color: '#EF4444' }
      ];
      setSentimentData(mockSentiment);

      const mockNews = [
        {
          title: 'Giá thuê nhà trọ tại TP.HCM tăng 3.2% trong tháng 1/2025',
          sentiment: 'positive',
          date: '2025-01-25',
          source: 'VnExpress'
        },
        {
          title: 'Thị trường cho thuê phòng trọ Hà Nội ổn định',
          sentiment: 'neutral',
          date: '2025-01-24',
          source: 'Vietnamnet'
        },
        {
          title: 'Sinh viên khó tìm phòng trọ giá rẻ tại Đà Nẵng',
          sentiment: 'negative',
          date: '2025-01-23',
          source: 'Tuổi Trẻ'
        }
      ];
      setNewsData(mockNews);
    }
  };

  const loadPriceRanges = async (locationParam = null) => {
    try {
      const response = await RentalAnalyticsAPI.getPriceRanges(locationParam);
      console.log('Price ranges response:', response);
      if (response.success && response.data && Array.isArray(response.data)) {
        setPriceRangeData(response.data);
      } else {
        // Fallback to mock data
        const mockRanges = [
          { range: '2-3 triệu', count: 35, percentage: 35 },
          { range: '3-4 triệu', count: 28, percentage: 28 },
          { range: '4-5 triệu', count: 20, percentage: 20 },
          { range: '5-7 triệu', count: 12, percentage: 12 },
          { range: 'Trên 7 triệu', count: 5, percentage: 5 }
        ];
        setPriceRangeData(mockRanges);
      }
    } catch (error) {
      console.error('Error loading price ranges:', error);
      // Use mock data as fallback
      const mockRanges = [
        { range: '2-3 triệu', count: 35, percentage: 35 },
        { range: '3-4 triệu', count: 28, percentage: 28 },
        { range: '4-5 triệu', count: 20, percentage: 20 },
        { range: '5-7 triệu', count: 12, percentage: 12 },
        { range: 'Trên 7 triệu', count: 5, percentage: 5 }
      ];
      setPriceRangeData(mockRanges);
    }
  };


  const loadPriceSummary = async (locationParam = null) => {
    console.log('Loading price summary with location param:', locationParam);
    try {
      const response = await RentalAnalyticsAPI.getPriceSummary(locationParam);
      console.log('Price summary response:', response);
      if (response.success) {
        setPriceSummary(response.data);
      } else {
        // Fallback to mock data
        const mockSummary = {
          currentMonthAverage: 4400000,
          changeFromLastMonth: 3.2,
          changeFromTwoMonthsAgo: 7.3
        };
        setPriceSummary(mockSummary);
      }
    } catch (error) {
      console.error('Error loading price summary:', error);
      // Use mock data as fallback
      const mockSummary = {
        currentMonthAverage: 4400000,
        changeFromLastMonth: 3.2,
        changeFromTwoMonthsAgo: 7.3
      };
      setPriceSummary(mockSummary);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN').format(price) + ' VNĐ';
  };

  const formatPercent = (value) => {
    return value > 0 ? `+${value}%` : `${value}%`;
  };

  // Removed region selection - using direct province-district approach

  const propertyCategories = [
    { value: '', label: 'Tất cả loại hình' },
    { value: 'phong_tro', label: 'Phòng trọ' },
    { value: 'can_ho', label: 'Căn hộ' },
    { value: 'nha_nguyen_can', label: 'Nhà nguyên căn' },
    { value: 'chung_cu_mini', label: 'Chung cư mini' },
    { value: 'homestay', label: 'Homestay' }
  ];

  const areaRanges = [
    { value: '', label: 'Tất cả diện tích' },
    { value: '10-20', label: '10-20 m²' },
    { value: '20-30', label: '20-30 m²' },
    { value: '30-50', label: '30-50 m²' },
    { value: '50+', label: '>50 m²' }
  ];

  const timePeriods = [
    { value: '3', label: '3 tháng' },
    { value: '6', label: '6 tháng' },
    { value: '12', label: '12 tháng' },
    { value: '24', label: '24 tháng' }
  ];



  // Handle province selection change
  const handleProvinceChange = (value) => {
    console.log('Province selection changed to:', value);
    setSelectedProvince(value);
    setSelectedWard(''); // Reset ward when province changes

    // Clear wards if no province selected
    if (!value) {
      setWards([]);
    }
  };

  // Handle time period change
  const handleTimePeriodChange = (value) => {
    console.log('Time period changed to:', value);
    setTimePeriod(value);
  };

  // Handle amenities modal
  const handleOpenAmenitiesModal = () => {
    setTempSelectedAmenities([...selectedAmenities]);
    setShowAmenitiesModal(true);
  };

  const handleCloseAmenitiesModal = () => {
    setShowAmenitiesModal(false);
    setTempSelectedAmenities([]);
  };

  const handleAmenityModalToggle = (amenityId) => {
    setTempSelectedAmenities(prev => {
      if (prev.includes(amenityId)) {
        return prev.filter(id => id !== amenityId);
      } else {
        return [...prev, amenityId];
      }
    });
  };

  const handleApplyAmenities = () => {
    setSelectedAmenities([...tempSelectedAmenities]);
    setShowAmenitiesModal(false);
    setTempSelectedAmenities([]);
  };

  const handleCancelAmenities = () => {
    setTempSelectedAmenities([]);
    setShowAmenitiesModal(false);
  };

  // Handle news search - only triggered by Enter key or search button click
  const handleNewsSearch = () => {
    if (newsKeyword.trim()) {
      loadNewsAnalysis(newsKeyword.trim());
    }
  };

  // Handle clear all filters
  const handleClearFilters = () => {
    setPropertyCategory('');
    setSelectedProvince('');
    setSelectedWard('');
    setAreaRange('');
    setSelectedAmenities([]); // Clear selected amenities
    setTimePeriod('3'); // Reset to default 3 months
    setWards([]); // Clear wards list when province is reset
    setNewsKeyword('');
  };

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="spinner"></div>
        <p>Đang tải dữ liệu phân tích...</p>
      </div>
    );
  }

  return (
    <div className="rental-analytics-dashboard">
      <div className="dashboard-header">
        <div className="dashboard-item">
          <h2>
            <i className="fa fa-chart-line"></i>
            Phân tích giá thuê
          </h2>
          <p>Theo dõi xu hướng và phân tích thị trường cho thuê phòng trọ</p>
        </div>

        <div className="dashboard-controls">
          <div className="control-group">
            <label>Loại hình nhà ở:</label>
            <select
              value={propertyCategory}
              onChange={(e) => setPropertyCategory(e.target.value)}
              className="control-select"
            >
              {propertyCategories.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label>Tỉnh/Thành phố:</label>
            <select
              value={selectedProvince}
              onChange={(e) => handleProvinceChange(e.target.value)}
              className="control-select"
              disabled={loadingLocations}
            >
              <option value="">Tất cả tỉnh/thành phố</option>
              {provinces.map(province => (
                <option key={province.name} value={province.name}>
                  {province.name}
                </option>
              ))}
            </select>
            {loadingLocations && <span className="loading-text">Đang tải...</span>}
          </div>

          <div className="control-group">
            <label>Phường, xã:</label>
            <select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              className="control-select"
              disabled={!selectedProvince || loadingLocations}
            >
              <option value="">
                {!selectedProvince
                  ? 'Chọn tỉnh/thành phố trước'
                  : loadingLocations
                    ? 'Đang tải...'
                    : 'Tất cả phường/xã'
                }
              </option>
              {wards.map((ward, index) => (
                <option key={`ward-${ward._id || ward.code || index}`} value={ward.name}>
                  {ward.name}
                </option>
              ))}
            </select>
            {loadingLocations && <span className="loading-text">Đang tải...</span>}
          </div>


          <div className="control-group">
            <label>Diện tích:</label>
            <select
              value={areaRange}
              onChange={(e) => setAreaRange(e.target.value)}
              className="control-select"
            >
              {areaRanges.map(range => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label>Tiện ích:</label>
            <button
              type="button"
              className="amenities-selector-btn"
              onClick={handleOpenAmenitiesModal}
            >
              
              {selectedAmenities.length > 0 
                ? `Đã chọn ${selectedAmenities.length} tiện ích`
                : 'Chọn tiện ích'
              }
              <i className="fa fa-chevron-down"></i>
            </button>
          </div>

          <div className="control-group">
            <label>Mốc thời gian:</label>
            <select
              value={timePeriod}
              onChange={(e) => handleTimePeriodChange(e.target.value)}
              className="control-select"
            >
              {timePeriods.map(period => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </select>
          </div>



        </div>
        <div className="dashboard-input">
          <div className="control-group">
            <label>Chủ đề bạn quan tâm:</label>
            <div className="input-with-button">
              <input
                type="text"
                value={newsKeyword}
                onChange={(e) => setNewsKeyword(e.target.value)}
                className="control-input typing-placeholder"
                placeholder={newsKeyword ? "Nhập từ khóa để tìm tin tức..." : `${currentPlaceholder}|`}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleNewsSearch();
                  }
                }}
              />
              {/* Hiện icon "x" khi có text */}
              {newsKeyword && (
                <button
                  className="clear-button-rental"
                  onClick={() => setNewsKeyword('')}
                  title="Xóa nội dung"
                >
                  <i className="fa fa-times"></i>
                </button>
              )}
              <button
                onClick={handleNewsSearch}
                className="search-button-rental"
                title="Tìm kiếm tin tức"
              >
                <i className="fa fa-search"></i>
              </button>
            </div>
          </div>
          <div className="control-group-button">
            <button
              onClick={handleClearFilters}
              className="clear-filters-button"
              title="Xóa tất cả bộ lọc"
            >
              <i className="fa fa-refresh"></i>
              Xóa bộ lọc
            </button>
          </div>
        </div>


      </div>

      {/* Key Metrics Cards */}
      <div className="metrics-grid">
        {/* Metric Card 1: Giá thuê trung bình hiện tại */}
        <div className="metric-card">
          <div className="metric-header">
            <h4>Giá thuê trung bình</h4>
            <i className="fa fa-money-bill-wave"></i>
          </div>
          <div className="metric-value">
            {priceSummary
              ? formatPrice(priceSummary.currentAvg)
              : formatPrice(4400000)
            }
          </div>
          <div className="metric-subtitle">
            <span>Tháng hiện tại:
              <span className="highlighted-date-current-month">
                {new Date().toLocaleDateString('vi-VN', { month: 'numeric', year: 'numeric' })}
              </span>
            </span>
          </div>
        </div>

        {/* Metric Card 2: Thay đổi so với tháng trước */}
        <div className="metric-card">
          <div className="metric-header">
            <h4>Giá so với tháng trước</h4>
            <i className="fa fa-chart-line"></i>
          </div>
          <div className={`metric-value ${priceSummary && priceSummary.changeVsLastMonth > 0 ? 'positive' : 'negative'}`}>
            {priceSummary
              ? formatPercent(priceSummary.changeVsLastMonth)
              : formatPercent(3.2)
            }
          </div>
          <div className="metric-subtitle">
            <span>Giá so với tháng:
              <span className="highlighted-date-1-month-ago">
                {new Date(new Date().setMonth(new Date().getMonth() - 1)).toLocaleDateString('vi-VN', { month: 'numeric', year: 'numeric' })}
              </span>
            </span>
          </div>
        </div>

        {/* Metric Card 3: Thay đổi so với 2 tháng trước */}
        <div className="metric-card">
          <div className="metric-header">
            <h4>Giá so với 2 tháng trước</h4>
            <i className="fa-chart-line"></i>
          </div>
          <div className={`metric-value ${priceSummary && priceSummary.changeVsTwoMonthsAgo > 0 ? 'positive' : 'negative'}`}>
            {priceSummary
              ? formatPercent(priceSummary.changeVsTwoMonthsAgo)
              : formatPercent(7.3)
            }
          </div>
          <div className="metric-subtitle">
            <span>Giá so với:
              <span className="highlighted-date-2-months-ago">
                {new Date(new Date().setMonth(new Date().getMonth() - 2)).toLocaleDateString('vi-VN', { month: 'numeric', year: 'numeric' })}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="charts-grid-first">
        {/* Price Range Chart - Range Bar Chart */}

        <div className="chart-card">
          <div className="chart-header">
            <h3>
              <i className="fa fa-chart-bar"></i>
              Khoảng giá thuê phổ biến
            </h3>
          </div>
          <div className={`chart-container ${isChartLoading ? 'chart-loading' : 'chart-loaded'}`} style={getChartAnimationStyle()}>
            {isChartLoading && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10,
                color: '#666',
                fontSize: '14px'
              }}>
                <i className="fa fa-spinner fa-spin"></i> Đang cập nhật dữ liệu...
              </div>
            )}
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={priceRangeData}
                layout="vertical" // đổi thành vertical để thanh nằm ngang (đúng như hình bạn mong muốn)
                margin={{ top: 20, right: 40, left: 5, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

                {/* Trục X: phần trăm */}
                <XAxis
                  type="number"
                  domain={[0, 100]} // luôn từ 0 → 100% để tránh tự động co nhỏ
                  tickFormatter={(value) => `${value}%`}
                />

                {/* Trục Y: nhãn khoảng giá */}
                <YAxis
                  type="category"
                  dataKey="range"
                  width={100}
                  tick={{ fontSize: 14 }}
                />

                {/* Tooltip hiển thị chi tiết */}
                <Tooltip
                  formatter={(value, name) => {
                    if (name === 'percentage') return [`${value}`, 'Tỷ lệ'];
                    if (name === 'count') return [`${value} tin`, 'Số lượng'];
                    return [value, name];
                  }}
                  labelFormatter={(label) => `Khoảng giá: ${label}`}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    color: '#750000ff'
                  }}
                />

                {/* Cột biểu đồ */}
                <Bar
                  dataKey="percentage"
                  name="Tỷ lệ"
                  radius={[0, 4, 4, 0]}
                  barSize={18}
                  label={{
                    position: 'right',
                    formatter: (value) => `${value}%`,
                    fill: '#4B5563',
                    fontSize: 14,
                  }}
                >
                  {priceRangeData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={`hsl(${140 + index * 8}, 70%, ${55 - index * 4}%)`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Range Indicators */}
            <div className="range-indicators">
              {Array.isArray(priceRangeData) && priceRangeData.map((item, index) => (
                <div key={index} className="range-indicator">
                  <div
                    className="range-color"
                    style={{
                      backgroundColor: `hsl(${140 + index * 8}, 70%, ${55 - index * 4}%)`
                    }}
                  ></div>
                  <div className="range-info">
                    <span className="range-label">{item.range}</span>
                    <div className="range-stats">
                      <span className="range-count">{item.count || 0} tin</span>
                      <span className="range-percentage">{item.percentage || 0}%</span>
                    </div>
                  </div>
                  <div className="range-bar">
                    <div
                      className="range-fill"
                      style={{
                        width: `${item.percentage || 0}%`,
                        backgroundColor: `hsl(${140 + index * 8}, 70%, ${55 - index * 4}%)`
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Price Trend Chart */}
        <div className="chart-card large">
          <div className="chart-header">
            <h3>
              <i className="fa fa-chart-line"></i>
              Xu hướng giá thuê theo thời gian ({timePeriods.find(p => p.value === timePeriod)?.label || '3 tháng'})
            </h3>
          </div>
          <div className={`chart-container ${isChartLoading ? 'chart-loading' : 'chart-loaded'}`} style={getChartAnimationStyle()}>
            {isChartLoading && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10,
                color: '#666',
                fontSize: '14px'
              }}>
                <i className="fa fa-spinner fa-spin"></i> Đang cập nhật xu hướng...
              </div>
            )}
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={priceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value, name, props) => {
                    if (props.dataKey === 'price') return [formatPrice(value), 'Giá thuê trung bình'];
                    if (props.dataKey === 'count') return [`${value} tin`, 'Số lượng tin đăng'];
                    return [value, name];
                  }}
                  labelFormatter={(label) => `Tháng: ${label}`}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                />

                <Legend />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#16A34A"
                  fill="#16A34A"
                  fillOpacity={0.3}
                  strokeWidth={2}
                  name="Giá thuê trung bình"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

        </div>

      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
      </div>

      {/* News Section */}
      <div className="news-section">
        <div className="section-header-rental">
          <h3>
            <i className="fa fa-newspaper"></i>
            Tin tức về "{newsKeyword}"
          </h3>

        </div>
        <div className="news-grid">
          {Array.isArray(newsData) && newsData.length > 0 ? (
            newsData.map((news, index) => (
              <div key={index} className="news-card">
                <div className="news-header">
                  <div className="news-badge">
                    <i className="fa fa-newspaper"></i>
                    Tin tức
                  </div>
                  <span className="news-date">{news.date}</span>
                </div>
                <h4 className="news-title">{news.snippet}</h4>
                <div className="news-footer">
                  <a
                    className="news-source"
                    href={news.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <i className="fa fa-external-link-alt"></i>
                    {news.source}
                  </a>
                </div>
              </div>
            ))
          ) : (
            <div className="no-news">
              <i className="fa fa-newspaper"></i>
              <p>Không có tin tức</p>
            </div>
          )}
        </div>

      </div>

      {/* Amenities Modal */}
      {showAmenitiesModal && (
        <div 
          className="modal-overlay-analytics" 
          onClick={handleCloseAmenitiesModal}
        >
          <div 
            className="amenities-modal-analytics" 
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header-analytics">
              <h3>
                <i className="fa fa-star"></i>
                Chọn tiện ích
              </h3>
              <button 
                className="close-btn-analytics"
                onClick={handleCancelAmenities}
                title="Đóng"
              >
                <i className="fa fa-times"></i>
              </button>
            </div>
            
            <div className="modal-body-analytics">
              <div className="amenities-grid-analytics">
                {amenities.map(amenity => {
                  const isSelected = tempSelectedAmenities.includes(amenity.value);
                  return (
                    <label 
                      key={amenity.value} 
                      className={`amenity-checkbox-analytics ${isSelected ? 'checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleAmenityModalToggle(amenity.value)}
                        style={{ display: 'none' }}
                      />
                      <div className={`amenity-card-analytics ${isSelected ? 'selected' : ''}`}>
                        <i className={`fa ${amenity.icon}`}></i>
                        <span>{amenity.label}</span>
                        <div className="checkmark-analytics">
                          <i className="fa fa-check"></i>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
            
            <div className="modal-footer-analytics">
              <button 
                className="btn btn-outline-analytics"
                onClick={handleCancelAmenities}
              >
                <i className="fa fa-times"></i>
                Hủy
              </button>
              <button 
                className="btn btn-primary-analytics"
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

export default RentalPriceAnalytics;
