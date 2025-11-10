import React, { useState, useEffect } from 'react';
import { useNotifications } from '../../../contexts/NotificationContext';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import './NotificationPage.css';

const NotificationPage = () => {
  const {
    notifications,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadNotifications
  } = useNotifications();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('all');
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const NOTIFICATIONS_PER_PAGE = 12;
  
  // Modal states for delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // 'single' | 'bulk'
  const [deletingNotificationId, setDeletingNotificationId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []); // chỉ load lần đầu

  // Khi danh sách trong context thay đổi, đảm bảo đồng bộ
  useEffect(() => {
    setSelectedNotifications([]); // reset chọn khi reload
  }, [notifications]);



  const filteredNotifications = notifications.filter(notif => {
    if (activeTab === 'all') return true;
    return notif.type === activeTab;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredNotifications.length / NOTIFICATIONS_PER_PAGE);
  const startIndex = (currentPage - 1) * NOTIFICATIONS_PER_PAGE;
  const endIndex = startIndex + NOTIFICATIONS_PER_PAGE;
  const paginatedNotifications = filteredNotifications.slice(startIndex, endIndex);

  const unreadNotifications = filteredNotifications.filter(n => !n.isRead);

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await markAsRead(notification._id);
    }
  };

  const handleSelectNotification = (notificationId) => {
    setSelectedNotifications(prev => {
      if (prev.includes(notificationId)) {
        return prev.filter(id => id !== notificationId);
      } else {
        return [...prev, notificationId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedNotifications.length === paginatedNotifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(paginatedNotifications.map(n => n._id));
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSelectedNotifications([]);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    setSelectedNotifications([]);
  };

  const handleBulkDelete = () => {
    setDeleteTarget('bulk');
    setShowDeleteModal(true);
  };

  const handleSingleDelete = (notificationId) => {
    setDeleteTarget('single');
    setDeletingNotificationId(notificationId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      if (deleteTarget === 'bulk') {
        // Xóa nhiều thông báo
        const deleteCount = selectedNotifications.length;
        const deletePromises = selectedNotifications.map(id => deleteNotification(id));
        await Promise.all(deletePromises);
        setSelectedNotifications([]);
        console.log('Bulk delete completed successfully');
        toast.success(`Đã xóa thành công ${deleteCount} thông báo`);
      } else if (deleteTarget === 'single' && deletingNotificationId) {
        // Xóa một thông báo
        await deleteNotification(deletingNotificationId);
        console.log('Single delete completed successfully');
        toast.success('Đã xóa thông báo thành công');
      }
    } catch (error) {
      console.error('Error during delete operation:', error);
      toast.error('Có lỗi xảy ra khi xóa thông báo');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setDeleteTarget(null);
      setDeletingNotificationId(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteTarget(null);
    setDeletingNotificationId(null);
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

  if (loading) {
    return (
      <div className="notification-page-loading">
        <div className="spinner"></div>
        <p>Đang tải thông báo...</p>
      </div>
    );
  }

  return (
    <div className="notification-page">
      <div className="notification-page-header">
        <div className="header-left">
          <h1>
            <i className="fa fa-bell"></i>
            Thông báo
          </h1>
          <span className="notification-count">
            {filteredNotifications.length} thông báo
            {unreadNotifications.length > 0 && (
              <span className="unread-count">
                ({unreadNotifications.length} chưa đọc)
              </span>
            )}
         
          </span>
        </div>
        <div className="header-actions-page">
          {unreadNotifications.length > 0 && (
            <button
              className="mark-all-read-btn"
              onClick={markAllAsRead}
            >
              <i className="fa fa-check-double"></i>
              Đánh dấu tất cả đã đọc
            </button>
          )}
          {selectedNotifications.length > 0 && (
            <button
              className="bulk-delete-btn"
              onClick={handleBulkDelete}
            >
              <i className="fa fa-trash"></i>
              Xóa đã chọn ({selectedNotifications.length})
            </button>
          )}
        </div>
      </div>

      <div className="notification-tabs">
        <button
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => handleTabChange('all')}
        >
          Tất cả ({notifications.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'property' ? 'active' : ''}`}
          onClick={() => handleTabChange('property')}
        >
          Tin đăng ({notifications.filter(n => n.type === 'property').length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => handleTabChange('report')}
        >
          Báo cáo ({notifications.filter(n => n.type === 'report').length})
        </button>
      </div>

      <div className="notification-controls">
        <div className="select-controls">
          <label className="select-all-checkbox">
            <input
              type="checkbox"
              checked={selectedNotifications.length === paginatedNotifications.length && paginatedNotifications.length > 0}
              onChange={handleSelectAll}
            />
            <span>Chọn tất cả ({paginatedNotifications.length})</span>
          </label>
          {selectedNotifications.length > 0 && (
            <span className="selected-count">
              Đã chọn {selectedNotifications.length} thông báo
            </span>
          )}
        </div>
      </div>

      <div className="notification-list">
        {filteredNotifications.length === 0 ? (
          <div className="no-notifications-page">
            <i className="fa fa-bell-slash"></i>
            <h3>Không có thông báo</h3>
            <p>Bạn chưa có thông báo nào trong mục này.</p>
          </div>
        ) : paginatedNotifications.length > 0 ? (
          paginatedNotifications.map((notification) => (
            <div
              key={notification._id}
              className={`notification-item-page ${!notification.isRead ? 'unread' : ''}`}
            >
              <div className="notification-checkbox">
                <input
                  type="checkbox"
                  checked={selectedNotifications.includes(notification._id)}
                  onChange={() => handleSelectNotification(notification._id)}
                />
              </div>

              <Link
                to={getNotificationLink(notification)}
                onClick={() => handleNotificationClick(notification)}
                className="notification-content-page"
              >
                <div className="notification-icon-page">
                  <i className={`fa ${getNotificationIcon(notification.type)}`}></i>
                  {!notification.isRead && <span className="unread-dot-page"></span>}
                </div>

                <div className="notification-body-page">
                  <div className="notification-header-page">
                    <h3 className="notification-title-page">{notification.title}</h3>
                    <span className="notification-time-page">
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                  </div>
                  <p className="notification-message-page">{notification.content}</p>
                  <div className="notification-meta-page">
                    <span className={`notification-type-page type-${notification.type}`}>
                      {notification.type === 'property' ? 'Tin đăng' : 'Báo cáo'}
                    </span>
                    
                    {/* Hiển thị trạng thái xử lý báo cáo */}
                    {notification.type === 'report' && notification.metadata?.reportStatus && (
                      <span className={`report-status-badge status-notification-${notification.metadata.reportStatus}`}>
                        {notification.metadata.reportStatus === 'dismissed' && 'Không vi phạm'}
                        {notification.metadata.reportStatus === 'warning' && 'Đã gửi cảnh báo'}
                        {notification.metadata.reportStatus === 'hidden' && 'Đã gỡ bài'}
                      </span>
                    )}
                    
                    {!notification.isRead && (
                      <span className="unread-badge-page">Chưa đọc</span>
                    )}
                  </div>
                  
                  {/* Nút xem tin đăng cho báo cáo đã xử lý (trừ trường hợp đã gỡ bài) */}
                  {notification.type === 'report' && 
                   notification.metadata?.reportStatus && 
                   notification.metadata?.reportStatus !== 'hidden' &&
                   notification.relatedId && (
                    <div className="notification-actions-page">
                      <Link 
                        to={`/properties/${notification.relatedId}`}
                        className="view-property-btn"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <i className="fa fa-eye"></i>
                        Xem tin đăng
                      </Link>
                    </div>
                  )}
                </div>
              </Link>

              <button
                className="notification-delete-page"
                onClick={(e) => {
                  e.preventDefault();
                  handleSingleDelete(notification._id);
                }}
                title="Xóa thông báo"
              >
                <i className="fa fa-times"></i>
              </button>
            </div>
          ))
        ) : null}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="pagination-container-notification-page">
          <div className="pagination-notification-page">


            <div className="pagination-controls-notification-page">
              <button
                className="pagination-btn-notification-page"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                title="Trang trước"
              >
                <i className="fa fa-chevron-left"></i>
                Trước
              </button>

              {/* Page Numbers */}
              <div className="pagination-numbers-notification-page">
                {(() => {
                  const pages = [];
                  const maxVisible = 5; // Hiển thị tối đa 5 số trang

                  if (totalPages <= maxVisible) {
                    // Hiển thị tất cả nếu ít hơn hoặc bằng maxVisible
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(
                        <button
                          key={i}
                          className={`page-btn-notification-page ${currentPage === i ? 'active' : ''}`}
                          onClick={() => handlePageChange(i)}
                        >
                          {i}
                        </button>
                      );
                    }
                  } else {
                    // Logic cho nhiều trang
                    if (currentPage <= 3) {
                      // Hiển thị 1, 2, 3, 4... nếu ở đầu
                      for (let i = 1; i <= 4; i++) {
                        pages.push(
                          <button
                            key={i}
                            className={`page-btn-notification-page ${currentPage === i ? 'active' : ''}`}
                            onClick={() => handlePageChange(i)}
                          >
                            {i}
                          </button>
                        );
                      }
                      if (totalPages > 4) {
                        pages.push(<span key="ellipsis" className="ellipsis-notification-page">...</span>);
                        pages.push(
                          <button
                            key={totalPages}
                            className="page-btn-notification-page"
                            onClick={() => handlePageChange(totalPages)}
                          >
                            {totalPages}
                          </button>
                        );
                      }
                    } else if (currentPage >= totalPages - 2) {
                      // Hiển thị 1...n-3, n-2, n-1, n nếu ở cuối
                      pages.push(
                        <button
                          key={1}
                          className="page-btn-notification-page"
                          onClick={() => handlePageChange(1)}
                        >
                          1
                        </button>
                      );
                      pages.push(<span key="ellipsis" className="ellipsis-notification-page">...</span>);
                      for (let i = totalPages - 3; i <= totalPages; i++) {
                        pages.push(
                          <button
                            key={i}
                            className={`page-btn-notification-page ${currentPage === i ? 'active' : ''}`}
                            onClick={() => handlePageChange(i)}
                          >
                            {i}
                          </button>
                        );
                      }
                    } else {
                      // Hiển thị 1...current-1, current, current+1...n nếu ở giữa
                      pages.push(
                        <button
                          key={1}
                          className="page-btn-notification-page"
                          onClick={() => handlePageChange(1)}
                        >
                          1
                        </button>
                      );
                      pages.push(<span key="ellipsis1" className="ellipsis-notification-page">...</span>);
                      for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                        pages.push(
                          <button
                            key={i}
                            className={`page-btn-notification-page ${currentPage === i ? 'active' : ''}`}
                            onClick={() => handlePageChange(i)}
                          >
                            {i}
                          </button>
                        );
                      }
                      pages.push(<span key="ellipsis2" className="ellipsis-notification-page">...</span>);
                      pages.push(
                        <button
                          key={totalPages}
                          className="page-btn-notification-page"
                          onClick={() => handlePageChange(totalPages)}
                        >
                          {totalPages}
                        </button>
                      );
                    }
                  }

                  return pages;
                })()}
              </div>

              <button
                className="pagination-btn-notification-page"
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                title="Trang sau"
              >
                Sau
                <i className="fa fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay-delete-notification" onClick={cancelDelete}>
          <div className="delete-notification-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-delete-notification">
              <h3>
                <i className="fa fa-exclamation-triangle text-warning"></i>
                Xác nhận xóa thông báo
              </h3>
              <button
                className="close-btn-delete-notification"
                onClick={cancelDelete}
                disabled={isDeleting}
              >
                <i className="fa fa-times"></i>
              </button>
            </div>

            <div className="modal-content-delete-notification">
              <div className="delete-info">
                {deleteTarget === 'bulk' ? (
                  <div className="bulk-delete-info">
                    <p>
                      Bạn có chắc chắn muốn xóa <strong>{selectedNotifications.length}</strong> thông báo đã chọn?
                    </p>
                    <div className="selected-notifications-preview">
                      {selectedNotifications.slice(0, 3).map(id => {
                        const notification = notifications.find(n => n._id === id);
                        return notification ? (
                          <div key={id} className="notification-preview">
                            <i className={`fa ${getNotificationIcon(notification.type)}`}></i>
                            <span className="notification-title-preview">{notification.title}</span>
                          </div>
                        ) : null;
                      })}
                      {selectedNotifications.length > 3 && (
                        <div className="notification-preview more">
                          <i className="fa fa-ellipsis-h"></i>
                          <span>và {selectedNotifications.length - 3} thông báo khác...</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="single-delete-info">
                    {(() => {
                      const notification = notifications.find(n => n._id === deletingNotificationId);
                      return notification ? (
                        <>
                          <p>Bạn có chắc chắn muốn xóa thông báo này?</p>
                          <div className="notification-preview-single">
                            <div className="notification-icon-preview">
                              <i className={`fa ${getNotificationIcon(notification.type)}`}></i>
                            </div>
                            <div className="notification-content-preview">
                              <h4>{notification.title}</h4>
                              <p>{notification.content}</p>
                              <span className="notification-type-preview">
                                {notification.type === 'property' ? 'Tin đăng' : 'Báo cáo'}
                              </span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p>Bạn có chắc chắn muốn xóa thông báo này?</p>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="warning-content">
                <div className="warning-item">
                  <i className="fa fa-info-circle text-info"></i>
                  <span>Thông báo đã xóa sẽ không thể khôi phục.</span>
                </div>
          
              </div>
            </div>

            <div className="modal-actions-delete-notification">
              <button
                className="btn btn-secondary-delete"
                onClick={cancelDelete}
                disabled={isDeleting}
              >
                <i className="fa fa-times"></i>
                Hủy
              </button>
              <button
                className="btn btn-danger-delete"
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
                    {deleteTarget === 'bulk' ? `Xóa ${selectedNotifications.length} thông báo` : 'Xóa thông báo'}
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

export default NotificationPage;
