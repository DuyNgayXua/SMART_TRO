import React from "react";
import { useTranslation } from "react-i18next";
import SideBar from "../../common/adminSidebar";
import "../admin-global.css";
import "./dashboard.css";

const Dashboard = () => {
  const { t } = useTranslation();
  return (
    <div className="dashboard-container">
      <SideBar />
      <div className="dashboard-content">
        {/* Header */}
        <div className="dashboard-header">
          <h1 className="dashboard-title">{t('dashboard.title')}</h1>
          <p className="dashboard-subtitle">{t('dashboard.subtitle')}</p>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card primary">
            <div className="stat-header">
              <div>
                <div className="stat-number">127</div>
                <div className="stat-label">{t('dashboard.stats.totalRooms')}</div>
                <div className="stat-change positive">
                  <span>↗</span> {t('dashboard.stats.comparedToLastMonth', { value: '+5.2%' })}
                </div>
              </div>
              <div className="stat-icon primary">
                <i className="fas fa-home"></i>
              </div>
            </div>
          </div>

          <div className="stat-card success">
            <div className="stat-header">
              <div>
                <div className="stat-number">89</div>
                <div className="stat-label">{t('dashboard.stats.occupiedRooms')}</div>
                <div className="stat-change positive">
                  <span>↗</span> {t('dashboard.stats.comparedToLastMonth', { value: '+12.1%' })}
                </div>
              </div>
              <div className="stat-icon success">
                <i className="fas fa-key"></i>
              </div>
            </div>
          </div>

          <div className="stat-card warning">
            <div className="stat-header">
              <div>
                <div className="stat-number">38</div>
                <div className="stat-label">{t('dashboard.stats.availableRooms')}</div>
                <div className="stat-change negative">
                  <span>↘</span> {t('dashboard.stats.comparedToLastMonth', { value: '-3.8%' })}
                </div>
              </div>
              <div className="stat-icon warning">
                <i className="fas fa-door-open"></i>
              </div>
            </div>
          </div>

          <div className="stat-card danger">
            <div className="stat-header">
              <div>
                <div className="stat-number">₫45.2M</div>
                <div className="stat-label">{t('dashboard.stats.monthlyRevenue')}</div>
                <div className="stat-change positive">
                  <span>↗</span> {t('dashboard.stats.comparedToLastMonth', { value: '+18.7%' })}
                </div>
              </div>
              <div className="stat-icon danger">
                <i className="fas fa-chart-line"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="charts-section">
          <div className="chart-card">
            <div className="chart-header">
              <h3 className="chart-title">{t('dashboard.charts.monthlyRevenue')}</h3>
              <select className="chart-period">
                <option>{t('dashboard.charts.last6Months')}</option>
                <option>{t('dashboard.charts.1Year')}</option>
                <option>{t('dashboard.charts.all')}</option>
              </select>
            </div>
            <div className="chart-placeholder">
              📊 {t('dashboard.charts.revenueChartPlaceholder')}
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <h3 className="chart-title">{t('dashboard.charts.occupancyRate')}</h3>
            </div>
            <div className="occupancy-chart">
              <div className="occupancy-rate">70%</div>
              <div className="occupancy-label">{t('dashboard.charts.roomOccupancyRate')}</div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="recent-section">
          <div className="activity-card">
            <div className="activity-header">
              <h3 className="activity-title">{t('dashboard.activity.recentActivity')}</h3>
            </div>
            <ul className="activity-list">
              <li className="activity-item">
                <div className="activity-avatar">NT</div>
                <div className="activity-content">
                  <p className="activity-text">{t('dashboard.activity.booking', { name: 'Nguyễn Thị An', room: 'P201' })}</p>
                  <p className="activity-time">{t('dashboard.activity.timeAgo', { time: '5 phút trước' })}</p>
                </div>
                <span className="activity-status status-new">{t('dashboard.activity.status.new')}</span>
              </li>
              <li className="activity-item">
                <div className="activity-avatar">LV</div>
                <div className="activity-content">
                  <p className="activity-text">{t('dashboard.activity.payment', { name: 'Lê Văn Bình', room: 'P105' })}</p>
                  <p className="activity-time">{t('dashboard.activity.timeAgo', { time: '15 phút trước' })}</p>
                </div>
                <span className="activity-status status-completed">{t('dashboard.activity.status.completed')}</span>
              </li>
              <li className="activity-item">
                <div className="activity-avatar">TM</div>
                <div className="activity-content">
                  <p className="activity-text">{t('dashboard.activity.maintenance', { name: 'Trần Minh Châu', room: 'P303' })}</p>
                  <p className="activity-time">{t('dashboard.activity.timeAgo', { time: '1 giờ trước' })}</p>
                </div>
                <span className="activity-status status-pending">{t('dashboard.activity.status.pending')}</span>
              </li>
              <li className="activity-item">
                <div className="activity-avatar">HN</div>
                <div className="activity-content">
                  <p className="activity-text">{t('dashboard.activity.checkout', { name: 'Hoàng Nam', room: 'P207' })}</p>
                  <p className="activity-time">{t('dashboard.activity.timeAgo', { time: '2 giờ trước' })}</p>
                </div>
                <span className="activity-status status-completed">{t('dashboard.activity.status.completed')}</span>
              </li>
            </ul>
          </div>

          <div className="activity-card">
            <div className="activity-header">
              <h3 className="activity-title">{t('dashboard.activity.systemNotifications')}</h3>
            </div>
            <ul className="activity-list">
              <li className="activity-item">
                <div className="activity-avatar">💡</div>
                <div className="activity-content">
                  <p className="activity-text">{t('dashboard.activity.systemMaintenance')}</p>
                  <p className="activity-time">{t('dashboard.activity.timeAgo', { time: '1 ngày trước' })}</p>
                </div>
                <span className="activity-status status-pending">{t('dashboard.activity.status.upcoming')}</span>
              </li>
              <li className="activity-item">
                <div className="activity-avatar">🔔</div>
                <div className="activity-content">
                  <p className="activity-text">{t('dashboard.activity.contractExpiring')}</p>
                  <p className="activity-time">{t('dashboard.activity.timeAgo', { time: '2 ngày trước' })}</p>
                </div>
                <span className="activity-status status-warning">{t('dashboard.activity.status.warning')}</span>
              </li>
              <li className="activity-item">
                <div className="activity-avatar">📋</div>
                <div className="activity-content">
                  <p className="activity-text">{t('dashboard.activity.reportGenerated')}</p>
                  <p className="activity-time">{t('dashboard.activity.timeAgo', { time: '3 ngày trước' })}</p>
                </div>
                <span className="activity-status status-completed">{t('dashboard.activity.status.completed')}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <h3 className="chart-title" style={{ marginBottom: '20px' }}>{t('dashboard.quickActions.title')}</h3>
          <div className="actions-grid">
            <div className="action-btn">
              <div className="action-icon">
                <i className="fas fa-plus-circle"></i>
              </div>
              <h4 className="action-title">{t('dashboard.quickActions.addRoom.title')}</h4>
            </div>

            <div className="action-btn">
              <div className="action-icon">
                <i className="fas fa-user-plus"></i>
              </div>
              <h4 className="action-title">{t('dashboard.quickActions.addTenant.title')}</h4>
            </div>

            <div className="action-btn">
              <div className="action-icon">
                <i className="fas fa-file-invoice-dollar"></i>
              </div>
              <h4 className="action-title">{t('dashboard.quickActions.createInvoice.title')}</h4>
            </div>

            <div className="action-btn">
              <div className="action-icon">
                <i className="fas fa-chart-bar"></i>
              </div>
              <h4 className="action-title">{t('dashboard.quickActions.viewReports.title')}</h4>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
