import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import SideBar from "../../common/adminSidebar";
import adminAnalyticsAPI from "../../../services/adminAnalyticsAPI";
import "../admin-global.css";
import "./admin-dashboard.css";

const AdminDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalLandlords: 0,
    totalTenants: 0,
    newUsersThisMonth: 0,
    totalProperties: 0,
    totalPackagePlans: 0,
    totalPackagePayments: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    topPosters: [],
    recentActivities: [],
    packageStats: [],
    revenueByMonth: []
  });

  // State cho chọn tháng/năm
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // Chỉ cho phép admin truy cập
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    fetchAdminDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear]);

  const fetchAdminDashboardData = async () => {
    try {
      setLoading(true);

      const response = await adminAnalyticsAPI.getDashboardStats(selectedMonth, selectedYear);
      
      if (response.success) {
        setStats({
          totalUsers: response.data.totalUsers || 0,
          totalLandlords: response.data.totalLandlords || 0,
          totalTenants: response.data.totalTenants || 0,
          newUsersThisMonth: response.data.newUsersThisMonth || 0,
          totalProperties: response.data.totalProperties || 0,
          activeProperties: response.data.activeProperties || 0,
          totalPackagePlans: response.data.totalPackagePlans || 0,
          totalPackagePayments: response.data.totalPackagePayments || 0,
          totalRevenue: response.data.totalRevenue || 0,
          monthlyRevenue: response.data.monthlyRevenue || 0,
          topPosters: response.data.topPosters || [],
          recentActivities: response.data.recentActivities || [],
          packageStats: response.data.packageStats || [],
          revenueByMonth: response.data.revenueByMonth || []
        });
      }
    } catch (error) {
      console.error('Error fetching admin dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}Tr`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return `${amount}đ`;
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case "user":
        return "fa-user-plus";
      case "payment":
        return "fa-credit-card";
      case "property":
        return "fa-home";
      case "package":
        return "fa-box";
      default:
        return "fa-circle";
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case "user":
        return "blue";
      case "payment":
        return "green";
      case "property":
        return "orange";
      case "package":
        return "purple";
      default:
        return "gray";
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <SideBar />
        <div className="dashboard-content">
          <div className="dashboard-header">
            <h1 className="dashboard-title">Bảng điều khiển Admin</h1>
            <p className="dashboard-subtitle">Đang tải dữ liệu...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <SideBar />
      <div className="dashboard-content">
        {/* Header */}
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Bảng điều khiển Admin</h1>
            <p className="dashboard-subtitle">Tổng quan hệ thống và thống kê người dùng</p>
          </div>
          
          {/* Month/Year Selector */}
          <div className="date-selector-container">
            <div className="date-selector-group">
              <label className="date-selector-label">
                <i className="fas fa-calendar-alt"></i> Chọn tháng/năm
              </label>
              <div className="date-selector-inputs">
                <select 
                  className="date-selector-select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>Tháng {month}</option>
                  ))}
                </select>
                <select 
                  className="date-selector-select"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Main Stats Cards */}
        <div className="stats-grid-modern">
          <div className="modern-card blue-card">
            <div className="card-icon-bg blue">
              <i className="fas fa-users"></i>
            </div>
            <div className="card-content">
              <h3 className="card-title">Tổng người dùng</h3>
              <div className="card-number">{stats.totalUsers}</div>
              <div className="card-footer">
                <span className="badge badge-info">
                  <i className="fas fa-user-tie"></i> {stats.totalLandlords} chủ trọ
                </span>
                <span className="badge badge-light">
                  <i className="fas fa-user"></i> {stats.totalTenants} người thuê
                </span>
              </div>
            </div>
          </div>

          <div className="modern-card green-card">
            <div className="card-icon-bg green">
              <i className="fas fa-user-plus"></i>
            </div>
            <div className="card-content">
              <h3 className="card-title">Người dùng mới</h3>
              <div className="card-number">{stats.newUsersThisMonth}</div>
              <div className="card-footer">
                <span className="badge badge-success">
                  <i className="fas fa-calendar-check"></i> Tháng này
                </span>
              </div>
            </div>
          </div>

          <div className="modern-card orange-card">
            <div className="card-icon-bg orange">
              <i className="fas fa-building"></i>
            </div>
            <div className="card-content">
              <h3 className="card-title">Tin đăng</h3>
              <div className="card-number">{stats.totalProperties}</div>
              <div className="card-footer">
                <span className="badge badge-warning">
                  <i className="fas fa-arrow-up"></i> Đang hoạt động
                </span>
              </div>
            </div>
          </div>

          <div className="modern-card purple-card">
            <div className="card-icon-bg purple">
              <i className="fas fa-box"></i>
            </div>
            <div className="card-content">
              <h3 className="card-title">Gói tin đã bán</h3>
              <div className="card-number">{stats.totalPackagePayments}</div>
              <div className="card-footer">
                <span className="badge badge-success">
                  <i className="fas fa-shopping-cart"></i> Tổng cộng
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section - New Design */}
        <div className="charts-wrapper">
          <div className="chart-container revenue-chart-card">
            <div className="chart-card-header">
              <div className="chart-title-group">
                <div className="chart-icon-wrapper">
                  <i className="fas fa-chart-line"></i>
                </div>
                <div>
                  <h3 className="chart-main-title">Doanh thu theo tháng</h3>
                  <p className="chart-subtitle">6 tháng gần nhất</p>
                </div>
              </div>
            </div>
            <div className="chart-body">
              <div className="revenue-bar-chart">
                {stats.revenueByMonth.map((item, index) => {
                  const maxRevenue = Math.max(...stats.revenueByMonth.map(m => m.revenue));
                  const heightPercent = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
                  
                  return (
                    <div key={index} className="bar-item">
                      <div className="bar-wrapper">
                        <div 
                          className="bar-fill" 
                          style={{ height: `${heightPercent}%` }}
                          title={formatCurrency(item.revenue)}
                        >
                          <span className="bar-tooltip">{formatCurrency(item.revenue)}</span>
                        </div>
                      </div>
                      <div className="bar-month">{item.month}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="chart-container room-chart-card">
            <div className="chart-card-header">
              <div className="chart-title-group">
                <div className="chart-icon-wrapper">
                  <i className="fas fa-chart-pie"></i>
                </div>
                <div>
                  <h3 className="chart-main-title">Thống kê gói tin</h3>
                  <p className="chart-subtitle">Tình trạng hiện tại</p>
                </div>
              </div>
            </div>
            <div className="chart-body">
              <div className="package-stats-list">
                {stats.packageStats && stats.packageStats.length > 0 ? (
                  stats.packageStats.map((pkg, index) => (
                    <div key={index} className="package-stat-item">
                      <div className="package-stat-info">
                        <div className="package-stat-name">✨ {pkg.name}</div>
                        <div className="package-stat-count">{pkg.count} gói đã bán</div>
                      </div>
                      <div className="package-stat-revenue">
                        {formatCurrency(pkg.revenue)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <i className="fas fa-inbox"></i>
                    <p>Chưa có gói tin nào được bán</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Alerts & Summary - New Design */}
        <div className="bottom-section">
          <div className="alerts-box">
            <div className="alerts-box-header">
              <div className="header-icon warning">
                <i className="fas fa-trophy"></i>
              </div>
              <h3 className="alerts-box-title">Top người đăng tin</h3>
            </div>
            <div className="alerts-list">
              {stats.topPosters && stats.topPosters.length > 0 ? (
                stats.topPosters.map((poster, index) => (
                  <div key={index} className="alert-notification info">
                    <div className="alert-icon-circle">
                      <span className="poster-rank-badge">{index + 1}</span>
                    </div>
                    <div className="alert-text">
                      <h4 className="alert-heading">
                        {index === 0 && '🏆 '}
                        {index === 1 && '🥈 '}
                        {index === 2 && '🥉 '}
                        {poster.name || poster.email}
                      </h4>
                      <p className="alert-description">{poster.posts} tin đăng</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <i className="fas fa-user-slash"></i>
                  <p>Chưa có người dùng nào đăng tin</p>
                </div>
              )}
            </div>
          </div>

          <div className="summary-box">
            <div className="summary-box-header">
              <div className="header-icon info">
                <i className="fas fa-history"></i>
              </div>
              <h3 className="summary-box-title">Hoạt động gần đây</h3>
            </div>
            <div className="activities-list-compact">
              {stats.recentActivities && stats.recentActivities.length > 0 ? (
                stats.recentActivities.map((activity, index) => (
                  <div key={index} className="summary-stat">
                    <div className={`summary-stat-icon ${getActivityColor(activity.type)}`}>
                      <i className={`fas ${getActivityIcon(activity.type)}`}></i>
                    </div>
                    <div className="summary-stat-text">
                      <div className="summary-stat-value">{activity.action}</div>
                      <div className="summary-stat-label">
                        {activity.userName || activity.user}
                        {activity.propertyTitle && ` - ${activity.propertyTitle}`}
                      </div>
                    </div>
                    <div className="activity-time-badge">⏱️ {activity.time}</div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <i className="fas fa-clock"></i>
                  <p>Chưa có hoạt động nào</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
