import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import SideBar from "../../common/adminSidebar";
import { roomsAPI } from "../../../services/roomsAPI";
import contractsAPI from "../../../services/contractsAPI";
import invoicesAPI from "../../../services/invoicesAPI";
import "../admin-global.css";
import "./dashboard.css";

const Dashboard = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRooms: 0,
    occupiedRooms: 0,
    availableRooms: 0,
    reservedRooms: 0,
    expiringRooms: 0,
    totalTenants: 0,
    activeContracts: 0,
    expiringContracts: 0,
    expiredContracts: 0,
    monthlyRevenue: 0,
    totalRevenue: 0,
    unpaidInvoices: 0,
    unpaidAmount: 0,
    paidInvoicesCount: 0,
    occupancyRate: 0,
    averageRentPrice: 0,
    revenueByMonth: []
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch room statistics
      const roomStatsResponse = await roomsAPI.getAllRooms({ limit: 1000 });
      const rooms = roomStatsResponse?.data?.rooms || [];
      
      const totalRooms = rooms.length;
      const occupiedRooms = rooms.filter(r => r.status === 'rented').length;
      const availableRooms = rooms.filter(r => r.status === 'available').length;
      const reservedRooms = rooms.filter(r => r.status === 'reserved').length;
      const expiringRooms = rooms.filter(r => r.status === 'expiring').length;
      const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

      // Calculate average rent price
      const totalRentPrice = rooms.reduce((sum, room) => sum + (room.price || 0), 0);
      const averageRentPrice = totalRooms > 0 ? Math.round(totalRentPrice / totalRooms) : 0;

      // Calculate total tenants from rooms (count tenants in room.tenants array)
      const totalTenants = rooms.reduce((sum, room) => {
        return sum + (room.tenants?.length || 0);
      }, 0);

      // Fetch contract statistics
      const contractsResponse = await contractsAPI.searchContracts({ limit: 1000 });
      const contracts = contractsResponse?.data?.items || [];
      const activeContracts = contracts.filter(c => c.status === 'active').length;
      const expiredContracts = contracts.filter(c => c.status === 'expired').length;
      
      // Count expiring contracts (ending within 30 days)
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const expiringContracts = contracts.filter(c => {
        if (c.status !== 'active' || !c.endDate) return false;
        const endDate = new Date(c.endDate);
        return endDate <= thirtyDaysFromNow && endDate >= now;
      }).length;

      // Calculate revenue from paid invoices
      const invoicesResponse = await invoicesAPI.getInvoices({ limit: 10000 });
      const invoices = invoicesResponse?.data?.items || invoicesResponse?.data?.invoices || [];
      
      // Get current month's revenue from paid invoices
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyRevenue = invoices
        .filter(inv => {
          const isPaid = inv.status === 'paid';
          const paidDate = inv.paidDate ? new Date(inv.paidDate) : null;
          const isCurrentMonth = paidDate && paidDate >= currentMonthStart;
          return isPaid && isCurrentMonth;
        })
        .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

      // Calculate total revenue (all paid invoices)
      const totalRevenue = invoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

      // Count unpaid invoices and amount
      const unpaidInvoices = invoices.filter(inv => 
        inv.status === 'sent' || inv.status === 'overdue'
      );
      const unpaidAmount = unpaidInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
      const paidInvoicesCount = invoices.filter(inv => inv.status === 'paid').length;

      // Calculate revenue by month (last 6 months)
      const revenueByMonth = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const nextMonthDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        
        const monthRevenue = invoices
          .filter(inv => {
            if (inv.status !== 'paid' || !inv.paidDate) return false;
            const paidDate = new Date(inv.paidDate);
            return paidDate >= monthDate && paidDate < nextMonthDate;
          })
          .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
        
        revenueByMonth.push({
          month: monthDate.toLocaleDateString('vi-VN', { month: 'short', year: 'numeric' }),
          revenue: monthRevenue
        });
      }

      setStats({
        totalRooms,
        occupiedRooms,
        availableRooms,
        reservedRooms,
        expiringRooms,
        totalTenants,
        activeContracts,
        expiringContracts,
        expiredContracts,
        monthlyRevenue,
        totalRevenue,
        unpaidInvoices: unpaidInvoices.length,
        unpaidAmount,
        paidInvoicesCount,
        occupancyRate,
        averageRentPrice,
        revenueByMonth
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (amount >= 1000000) {
      return `₫${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `₫${(amount / 1000).toFixed(1)}K`;
    }
    return `₫${amount}`;
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <SideBar />
        <div className="dashboard-content">
          <div className="dashboard-header">
            <h1 className="dashboard-title">{t('dashboard.title')}</h1>
            <p className="dashboard-subtitle">{t('dashboard.loading')}</p>
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
          <h1 className="dashboard-title">{t('dashboard.title')}</h1>
          <p className="dashboard-subtitle">{t('dashboard.subtitle')}</p>
        </div>

        {/* Main Stats Cards - New Modern Style */}
        <div className="stats-grid-modern">
          <div className="modern-card blue-card">
            <div className="card-icon-bg blue">
              <i className="fas fa-home"></i>
            </div>
            <div className="card-content">
              <h3 className="card-title">{t('dashboard.stats.totalRooms')}</h3>
              <div className="card-number">{stats.totalRooms}</div>
              <div className="card-footer">
                <span className="badge badge-success">
                  <i className="fas fa-check-circle"></i> {stats.occupiedRooms} đã thuê
                </span>
                <span className="badge badge-light">
                  <i className="fas fa-circle"></i> {stats.availableRooms} trống
                </span>
              </div>
            </div>
          </div>

          <div className="modern-card green-card">
            <div className="card-icon-bg green">
              <i className="fas fa-users"></i>
            </div>
            <div className="card-content">
              <h3 className="card-title">Tổng khách thuê</h3>
              <div className="card-number">{stats.totalTenants}</div>
              <div className="card-footer">
                <span className="badge badge-green">
                  <i className="fas fa-file-signature"></i> {stats.activeContracts} hợp đồng đang hoạt động
                </span>
              </div>
            </div>
          </div>

          <div className="modern-card purple-card">
            <div className="card-icon-bg purple">
              <i className="fas fa-dollar-sign"></i>
            </div>
            <div className="card-content">
              <h3 className="card-title">{t('dashboard.stats.monthlyRevenue')}</h3>
              <div className="card-number">{formatCurrency(stats.monthlyRevenue)}</div>
              <div className="card-footer">
                <span className="badge badge-purple">
                  <i className="fas fa-chart-line"></i> Tổng: {formatCurrency(stats.totalRevenue)}
                </span>
              </div>
            </div>
          </div>

          <div className="modern-card orange-card">
            <div className="card-icon-bg orange">
              <i className="fas fa-receipt"></i>
            </div>
            <div className="card-content">
              <h3 className="card-title">Hóa đơn chưa thanh toán</h3>
              <div className="card-number">{stats.unpaidInvoices}</div>
              <div className="card-footer">
                <span className="badge badge-orange">
                  <i className="fas fa-exclamation-circle"></i> Tổng nợ: {formatCurrency(stats.unpaidAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Row - Clean Style */}
        <div className="quick-stats-grid">
          <div className="quick-stat purple">
            <div className="quick-stat-icon purple">
              <i className="fas fa-percentage"></i>
            </div>
            <div className="quick-stat-info">
              <div className="quick-stat-value">{stats.occupancyRate}%</div>
              <div className="quick-stat-label">Tỷ lệ lấp đầy</div>
            </div>
          </div>

          <div className="quick-stat red">
            <div className="quick-stat-icon red">
              <i className="fas fa-clock"></i>
            </div>
            <div className="quick-stat-info">
              <div className="quick-stat-value">{stats.expiringContracts}</div>
              <div className="quick-stat-label">HĐ sắp hết hạn (30 ngày)</div>
            </div>
          </div>

          <div className="quick-stat teal">
            <div className="quick-stat-icon teal">
              <i className="fas fa-coins"></i>
            </div>
            <div className="quick-stat-info">
              <div className="quick-stat-value">{formatCurrency(stats.averageRentPrice)}</div>
              <div className="quick-stat-label">Giá thuê trung bình</div>
            </div>
          </div>

          <div className="quick-stat green">
            <div className="quick-stat-icon green">
              <i className="fas fa-check-double"></i>
            </div>
            <div className="quick-stat-info">
              <div className="quick-stat-value">{stats.paidInvoicesCount}</div>
              <div className="quick-stat-label">HĐ đã thanh toán</div>
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
                  <h3 className="chart-main-title">{t('dashboard.charts.monthlyRevenue')}</h3>
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
                  <h3 className="chart-main-title">Phân bố phòng</h3>
                  <p className="chart-subtitle">Tình trạng hiện tại</p>
                </div>
              </div>
            </div>
            <div className="chart-body">
              <div className="room-stats-grid">
                <div className="room-donut">
                  <svg viewBox="0 0 100 100" className="donut-svg">
                    <circle cx="50" cy="50" r="35" fill="none" stroke="#f1f5f9" strokeWidth="14"></circle>
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="35" 
                      fill="none" 
                      stroke="url(#gradient1)" 
                      strokeWidth="14"
                      strokeDasharray={`${stats.occupancyRate * 2.199} 219.9`}
                      transform="rotate(-90 50 50)"
                      strokeLinecap="round"
                    ></circle>
                    <defs>
                      <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="donut-inner">
                    <div className="donut-percent">{stats.occupancyRate}%</div>
                    <div className="donut-text">Lấp đầy</div>
                  </div>
                </div>
                <div className="room-legend-list">
                  <div className="legend-item-box">
                    <div className="legend-color-box rented"></div>
                    <div className="legend-info">
                      <div className="legend-value">{stats.occupiedRooms}</div>
                      <div className="legend-name">Đã thuê</div>
                    </div>
                  </div>
                  <div className="legend-item-box">
                    <div className="legend-color-box available"></div>
                    <div className="legend-info">
                      <div className="legend-value">{stats.availableRooms}</div>
                      <div className="legend-name">Còn trống</div>
                    </div>
                  </div>
                  <div className="legend-item-box">
                    <div className="legend-color-box reserved"></div>
                    <div className="legend-info">
                      <div className="legend-value">{stats.reservedRooms}</div>
                      <div className="legend-name">Đã đặt</div>
                    </div>
                  </div>
                  <div className="legend-item-box">
                    <div className="legend-color-box expiring"></div>
                    <div className="legend-info">
                      <div className="legend-value">{stats.expiringRooms}</div>
                      <div className="legend-name">Sắp hết hạn</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts & Summary - New Design */}
        <div className="bottom-section">
          <div className="alerts-box">
            <div className="alerts-box-header">
              <div className="header-icon warning">
                <i className="fas fa-bell"></i>
              </div>
              <h3 className="alerts-box-title">Cần chú ý</h3>
            </div>
            <div className="alerts-list">
              <div className="alert-notification warning">
                <div className="alert-icon-circle">
                  <i className="fas fa-file-contract"></i>
                </div>
                <div className="alert-text">
                  <h4 className="alert-heading">{stats.expiringContracts} hợp đồng sắp hết hạn</h4>
                  <p className="alert-description">Trong vòng 30 ngày tới</p>
                </div>
              </div>
              <div className="alert-notification info">
                <div className="alert-icon-circle">
                  <i className="fas fa-door-open"></i>
                </div>
                <div className="alert-text">
                  <h4 className="alert-heading">{stats.expiringRooms} phòng sắp hết hạn</h4>
                  <p className="alert-description">Cần liên hệ gia hạn hoặc tìm khách mới</p>
                </div>
              </div>
              {stats.unpaidInvoices > 0 && (
                <div className="alert-notification danger">
                  <div className="alert-icon-circle">
                    <i className="fas fa-exclamation-circle"></i>
                  </div>
                  <div className="alert-text">
                    <h4 className="alert-heading">{stats.unpaidInvoices} hóa đơn chưa thanh toán</h4>
                    <p className="alert-description">Tổng nợ: {formatCurrency(stats.unpaidAmount)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="summary-box">
            <div className="summary-box-header">
              <div className="header-icon info">
                <i className="fas fa-chart-line"></i>
              </div>
              <h3 className="summary-box-title">Tổng quan</h3>
            </div>
            <div className="summary-grid">
              <div className="summary-stat">
                <div className="summary-stat-icon expired">
                  <i className="fas fa-calendar-times"></i>
                </div>
                <div className="summary-stat-text">
                  <div className="summary-stat-value">{stats.expiredContracts}</div>
                  <div className="summary-stat-label">Hợp đồng hết hạn</div>
                </div>
              </div>
              <div className="summary-stat">
                <div className="summary-stat-icon success">
                  <i className="fas fa-check-circle"></i>
                </div>
                <div className="summary-stat-text">
                  <div className="summary-stat-value">{stats.paidInvoicesCount}</div>
                  <div className="summary-stat-label">HĐ đã thanh toán (tháng này)</div>
                </div>
              </div>
              <div className="summary-stat">
                <div className="summary-stat-icon teal">
                  <i className="fas fa-coins"></i>
                </div>
                <div className="summary-stat-text">
                  <div className="summary-stat-value">{formatCurrency(stats.averageRentPrice)}</div>
                  <div className="summary-stat-label">Giá thuê trung bình</div>
                </div>
              </div>
              <div className="summary-stat">
                <div className="summary-stat-icon purple">
                  <i className="fas fa-wallet"></i>
                </div>
                <div className="summary-stat-text">
                  <div className="summary-stat-value">{formatCurrency(stats.totalRevenue)}</div>
                  <div className="summary-stat-label">Tổng doanh thu</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
