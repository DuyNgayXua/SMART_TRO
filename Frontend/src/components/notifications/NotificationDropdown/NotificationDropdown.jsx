import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../../contexts/NotificationContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import './NotificationDropdown.css';

const NotificationDropdown = ({ isOpen, onClose }) => {
  const { notifications, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'property' | 'report'
  const [currentPage, setCurrentPage] = useState(1);
  const NOTIFICATIONS_PER_PAGE = 12;
  
  // Modal states for delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingNotificationId, setDeletingNotificationId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredNotifications = notifications.filter(notif => {
    if (activeTab === 'all') return true;
    return notif.type === activeTab;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredNotifications.length / NOTIFICATIONS_PER_PAGE);
  const startIndex = (currentPage - 1) * NOTIFICATIONS_PER_PAGE;
  const endIndex = startIndex + NOTIFICATIONS_PER_PAGE;
  const paginatedNotifications = filteredNotifications.slice(startIndex, endIndex);

  // Reset to page 1 when changing tabs
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleDeleteNotification = (notificationId) => {
    setDeletingNotificationId(notificationId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingNotificationId) return;
    
    setIsDeleting(true);
    try {
      await deleteNotification(deletingNotificationId);
      console.log('Notification deleted successfully');
      toast.success('Đã xóa thông báo thành công');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Có lỗi xảy ra khi xóa thông báo');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setDeletingNotificationId(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingNotificationId(null);
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await markAsRead(notification._id);
    }
    onClose();
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'property':
        return 'fa-home';
      case 'report':
        return 'fa-flag';
      default:
        return 'fa-bell';
    }
  };

  const getNotificationLink = (notification) => {
    console.log('Notification metadata:', notification);
    switch (notification.type) {
      case 'property':
        // Nếu property bị từ chối thì về trang my-posts
        if (notification.metadata.propertyStatus === 'rejected' ) {
          return `/profile/my-posts`;
        }
        // Nếu property được duyệt thành công thì đi đến trang chi tiết property
        if (notification.metadata.propertyStatus === 'approved' ) {
          return `/properties/${notification.relatedId}`;
        }
        // Mặc định về my-posts
        return `/profile/my-posts`;
      case 'report':
        return `/profile/notifications`;
      default:
        return '#';
    }
  };

  const formatTimeAgo = (createdAt) => {
    const now = new Date();
    const notificationTime = new Date(createdAt);
    const diffInMinutes = Math.floor((now - notificationTime) / (1000 * 60));

    if (diffInMinutes < 1) return 'Vừa xong';
    if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} giờ trước`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} ngày trước`;
    
    return notificationTime.toLocaleDateString('vi-VN');
  };

  if (!isOpen) return null;

  return (
    <div className="notification-dropdown" onClick={(e) => e.stopPropagation()}>
      <div className="notification-dropdown-header">
        <h3>Thông báo</h3>
        <div className="notification-actions">
          {notifications.some(n => !n.isRead) && (
            <button 
              className="mark-all-read-btn"
              onClick={(e) => {
                e.stopPropagation();
                markAllAsRead();
              }}
              title="Đánh dấu tất cả đã đọc"
            >
              <i className="fa fa-check-double"></i>
            </button>
          )}
          <Link to="/profile/notifications" onClick={onClose}>
            <button className="view-all-btn" title="Xem tất cả">
              <i className="fa fa-external-link-alt"></i>
            </button>
          </Link>
        </div>
      </div>

      <div className="notification-tabs">
        <button 
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            handleTabChange('all');
          }}
        >
          Tất cả ({notifications.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'property' ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            handleTabChange('property');
          }}
        >
          Tin đăng ({notifications.filter(n => n.type === 'property').length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            handleTabChange('report');
          }}
        >
          Báo cáo ({notifications.filter(n => n.type === 'report').length})
        </button>
      </div>

      <div className="notification-list">
        {paginatedNotifications.length > 0 ? (
          paginatedNotifications.map((notification) => (
            <div 
              key={notification._id} 
              className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
            >
              <Link 
                to={getNotificationLink(notification)}
                onClick={() => handleNotificationClick(notification)}
                className="notification-content-dropdown"
              >
                <div className="notification-icon">
                  <i className={`fa ${getNotificationIcon(notification.type)}`}></i>
                  {!notification.isRead && <span className="unread-dot"></span>}
                </div>
                
                <div className="notification-body">
                  <h4 className="notification-title">{notification.title}</h4>
                  <p 
                    className="notification-message" 
                    title={notification.content}
                  >
                    {notification.content}
                  </p>
                  
                  {/* Hiển thị trạng thái xử lý báo cáo */}
                  {notification.type === 'report' && notification.metadata?.reportStatus && (
                    <div className="report-status-container">
                      <span className={`report-status-badge-dropdown status-notification-${notification.metadata.reportStatus}`}>
                        {notification.metadata.reportStatus === 'dismissed' && 'Không vi phạm'}
                        {notification.metadata.reportStatus === 'warning' && 'Đã gửi cảnh báo'}
                        {notification.metadata.reportStatus === 'hidden' && 'Đã gỡ bài'}
                      </span>
                    </div>
                  )}
                  
                  <div className="notification-footer-dropdown">
                    <span className="notification-time-notification-dropdown">
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                    
                    {/* Nút xem tin đăng cho báo cáo đã xử lý (trừ trường hợp đã gỡ bài) */}
                    {notification.type === 'report' && 
                     notification.metadata?.reportStatus && 
                     notification.metadata?.reportStatus !== 'hidden' &&
                     notification.relatedId && (
                      <Link 
                        to={`/properties/${notification.relatedId}`}
                        className="view-property-btn-dropdown"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                        }}
                      >
                        <i className="fa fa-eye"></i>
                        Xem tin
                      </Link>
                    )}
                  </div>
                </div>
              </Link>
              
              <button 
                className="notification-delete"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDeleteNotification(notification._id);
                }}
                title="Xóa thông báo"
              >
                <i className="fa fa-times"></i>
              </button>
            </div>
          ))
        ) : (
          <div className="no-notifications">
            <i className="fa fa-bell-slash"></i>
            <p>Không có thông báo nào</p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="notification-pagination">
         
          <div className="pagination-buttons">
            <button 
              className="pagination-btn prev"
              disabled={currentPage === 1}
              onClick={(e) => {
                e.stopPropagation();
                handlePageChange(currentPage - 1);
              }}
              title="Trang trước"
            >
              <i className="fa fa-chevron-left"></i>
            </button>
            
            {/* Page numbers */}
            <div className="page-numbers">
              {(() => {
                const pages = [];
                const maxVisible = 3; // Hiển thị tối đa 3 số trang

                if (totalPages <= maxVisible) {
                  // Hiển thị tất cả nếu ít hơn hoặc bằng maxVisible
                  for (let i = 1; i <= totalPages; i++) {
                    pages.push(
                      <button
                        key={i}
                        className={`page-btn ${currentPage === i ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePageChange(i);
                        }}
                      >
                        {i}
                      </button>
                    );
                  }
                } else {
                  // Logic cho nhiều trang
                  if (currentPage <= 2) {
                    // Hiển thị 1, 2, 3... nếu ở đầu
                    for (let i = 1; i <= 3; i++) {
                      pages.push(
                        <button
                          key={i}
                          className={`page-btn ${currentPage === i ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePageChange(i);
                          }}
                        >
                          {i}
                        </button>
                      );
                    }
                    if (totalPages > 3) {
                      pages.push(<span key="ellipsis" className="ellipsis">...</span>);
                    }
                  } else if (currentPage >= totalPages - 1) {
                    // Hiển thị ...n-2, n-1, n nếu ở cuối
                    pages.push(<span key="ellipsis" className="ellipsis">...</span>);
                    for (let i = totalPages - 2; i <= totalPages; i++) {
                      pages.push(
                        <button
                          key={i}
                          className={`page-btn ${currentPage === i ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePageChange(i);
                          }}
                        >
                          {i}
                        </button>
                      );
                    }
                  } else {
                    // Hiển thị ...current-1, current, current+1... nếu ở giữa
                    pages.push(<span key="ellipsis1" className="ellipsis">...</span>);
                    for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                      pages.push(
                        <button
                          key={i}
                          className={`page-btn ${currentPage === i ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePageChange(i);
                          }}
                        >
                          {i}
                        </button>
                      );
                    }
                    pages.push(<span key="ellipsis2" className="ellipsis">...</span>);
                  }
                }

                return pages;
              })()}
            </div>

            <button 
              className="pagination-btn next"
              disabled={currentPage === totalPages}
              onClick={(e) => {
                e.stopPropagation();
                handlePageChange(currentPage + 1);
              }}
              title="Trang sau"
            >
              <i className="fa fa-chevron-right"></i>
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay-delete-dropdown" onClick={cancelDelete}>
          <div className="delete-dropdown-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-delete-dropdown">
              <h3>
                <i className="fa fa-exclamation-triangle text-warning"></i>
                Xác nhận xóa
              </h3>
              <button
                className="close-btn-delete-dropdown"
                onClick={cancelDelete}
                disabled={isDeleting}
              >
                <i className="fa fa-times"></i>
              </button>
            </div>

            <div className="modal-content-delete-dropdown">
              {(() => {
                const notification = notifications.find(n => n._id === deletingNotificationId);
                return notification ? (
                  <div className="delete-info-dropdown">
                    <p>Bạn có chắc chắn muốn xóa thông báo này?</p>
                    <div className="notification-preview-dropdown">
                      <div className="notification-icon-preview-dropdown">
                        <i className={`fa ${getNotificationIcon(notification.type)}`}></i>
                      </div>
                      <div className="notification-content-preview-dropdown">
                        <h4>{notification.title}</h4>
                        <p>{notification.content}</p>
                      </div>
                    </div>
                    <div className="warning-dropdown">
                      <i className="fa fa-exclamation-triangle"></i>
                      <span>Hành động này không thể hoàn tác!</span>
                    </div>
                  </div>
                ) : (
                  <p>Bạn có chắc chắn muốn xóa thông báo này?</p>
                );
              })()}
            </div>

            <div className="modal-actions-delete-dropdown">
              <button
                className="btn-dropdown btn-secondary-dropdown"
                onClick={cancelDelete}
                disabled={isDeleting}
              >
                <i className="fa fa-times"></i>
                Hủy
              </button>
              <button
                className="btn-dropdown btn-danger-dropdown"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <i className="fa fa-spinner fa-spin"></i>
                    Đang xóa...
                  </>
                ) : (
                  <>
                    <i className="fa fa-trash"></i>
                    Xóa
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

export default NotificationDropdown;
