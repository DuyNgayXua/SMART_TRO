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
import RentalAnalyticsAPI from '../../../services/RentalAnalyticsAPI';
import '../ProfilePages.css';
import './RentalPriceAnalytics.css';

const RentalPriceAnalytics = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  // Removed selectedRegion state - using direct province selection
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [propertyCategory, setPropertyCategory] = useState('');
  const [areaRange, setAreaRange] = useState('');
  const [newsKeyword, setNewsKeyword] = useState('Giá thuê trọ hôm nay ở quận Gò Vấp');
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

  // Location data states
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  // Load provinces on component mount
  useEffect(() => {
    loadProvinces();
  }, []);

  // Load districts when province changes
  useEffect(() => {
    if (selectedProvince) {
      loadDistricts(selectedProvince);
    } else {
      setDistricts([]);
      setSelectedDistrict('');
    }
  }, [selectedProvince]);

  // Load analytics data when filters change (excluding newsKeyword)
  useEffect(() => {
    loadAnalyticsData();
  }, [selectedProvince, selectedDistrict, propertyCategory, areaRange]);

  // Load provinces on component mount
  useEffect(() => {
    loadProvinces();
  }, []);



  // Load provinces from API
  const loadProvinces = async () => {
    try {
      setLoadingLocations(true);
      const response = await axios.get('https://provinces.open-api.vn/api/p/');

      if (response.data) {
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
        { code: 79, name: 'TP. Hồ Chí Minh' },
        { code: 1, name: 'Hà Nội' },
        { code: 48, name: 'Đà Nẵng' }
      ]);
    } finally {
      setLoadingLocations(false);
    }
  };

  // Load districts from API
  const loadDistricts = async (provinceCode) => {
    try {
      setLoadingLocations(true);
      const response = await axios.get(`https://provinces.open-api.vn/api/p/${provinceCode}?depth=2`);

      if (response.data && response.data.districts) {
        // Sort districts alphabetically
        const sortedDistricts = response.data.districts.sort((a, b) =>
          a.name.localeCompare(b.name, 'vi', { numeric: true })
        );
        setDistricts(sortedDistricts);
      }
    } catch (error) {
      console.error('Error loading districts:', error);
      setDistricts([]);
    } finally {
      setLoadingLocations(false);
    }
  };

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      // Build location parameter based on province/district selection
      let locationParam = null;
      if (selectedProvince) {
        const province = provinces.find(p => p.code.toString() === selectedProvince);
        if (province) {
          locationParam = {
            // Gửi code thay vì name vì backend mong đợi code
            province: province.code.toString(),  // Gửi "79" thay vì "Thành phố Hồ Chí Minh"
            district: selectedDistrict ? selectedDistrict.toString() : null,  // Gửi code district
            category: propertyCategory,
            areaRange: areaRange
          };
        }
      } else if (propertyCategory || areaRange) {
        // If only category or area range is selected without province
        locationParam = {
          category: propertyCategory,
          areaRange: areaRange
        };
      }

      // Load analytics data with location filtering (exclude news analysis)
      await Promise.all([
        loadPriceTrends(locationParam),
        loadPriceRanges(locationParam),
        loadPriceSummary(locationParam)
      ]);
    } catch (error) {
      console.error('Error loading analytics data:', error);
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
      // Use mock data as fallback
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

  // Removed handleRegionChange - using direct province selection

  // Handle province selection change
  const handleProvinceChange = (value) => {
    setSelectedProvince(value);
    setSelectedDistrict(''); // Reset district when province changes
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
    setSelectedDistrict('');
    setAreaRange('');
    setDistricts([]); // Clear districts list when province is reset
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
                <option key={province.code} value={province.code}>
                  {province.name}
                </option>
              ))}
            </select>
            {loadingLocations && <span className="loading-text">Đang tải...</span>}
          </div>

          {selectedProvince && districts.length > 0 && (
            <div className="control-group">
              <label>Quận/Huyện:</label>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="control-select"
                disabled={loadingLocations}
              >
                <option value="">Tất cả quận/huyện</option>
                {districts.map(district => (
                  <option key={district.code} value={district.code}>
                    {district.name}
                  </option>
                ))}
              </select>
              {loadingLocations && <span className="loading-text">Đang tải...</span>}
            </div>
          )}

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
        <div className="dashboard-input">
          <div className="control-group">
            <label>Chủ đề bạn quan tâm:</label>
            <div className="input-with-button">
              <input
                type="text"
                value={newsKeyword}
                onChange={(e) => setNewsKeyword(e.target.value)}
                className="control-input"
                placeholder="Nhập từ khóa để tìm tin tức..."
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
          <div className="chart-container">
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
              Xu hướng giá thuê theo thời gian
            </h3>
          </div>
          <div className="chart-container">
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
    </div>
  );
};

export default RentalPriceAnalytics;
