import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import './ProfileLayout.css';

const ProfileLayout = () => {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // Helper function để xử lý URL avatar Google
  const getAvatarUrl = (avatar) => {
    if (avatar && avatar.includes('googleusercontent.com')) {
      // Cải thiện chất lượng ảnh Google
      const baseUrl = avatar.split('=')[0];
      return `${baseUrl}=s150-c`;
    }
    return avatar || 'https://res.cloudinary.com/dapvuniyx/image/upload/v1755712519/avatar_gj5yhw.jpg';
  };

  const menuItems = [
    {
      id: 'posts',
      icon: 'fa-plus-circle',
      label: t('profile.layout.sidebar.newPost'),
      path: '/profile/new-post',
      active: location.pathname === '/profile/new-post'
    },
    {
      id: 'my-posts',
      icon: 'fa-list',
      label: t('profile.layout.sidebar.myPosts'),
      path: '/profile/my-posts',
      active: location.pathname === '/profile/my-posts'
    },
    {
      id: 'pricing-analytics',
      icon: 'fa-chart-line',
      label: t('profile.layout.sidebar.pricing-analytics'),
      path: '/profile/pricing-analytics',
      active: location.pathname === '/profile/pricing-analytics'
    },
    {
      id: 'favorites',
      icon: 'fa-heart',
      label: t('header.myList'),
      path: '/profile/favorites',
      active: location.pathname === '/profile/favorites'
    },

    {
      id: 'account',
      icon: 'fa-user-cog',
      label: t('profile.layout.sidebar.account'),
      path: '/profile/account',
      active: location.pathname === '/profile/account'
    }, {
      id: 'payment-history',
      icon: 'fa-credit-card',
      label: t('profile.layout.sidebar.paymentHistory'),
      path: '/profile/payment-history',
      active: location.pathname === '/profile/payment-history'
    }
  ];

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    toast.success(t('profile.account.profileInfo.successLogout', 'Đăng xuất thành công!'));
    setShowLogoutModal(false);
    setTimeout(() => {
      logout();
      navigate('/');
    }, 1500);
  };

  const cancelLogout = () => {
    setShowLogoutModal(false);
  };

  return (
    <div className="profile-layout">
      {/* Sidebar */}
      <div className="profile-sidebar">
        <div className="sidebar-header">
          <div className="user-info">
            <img
              src={getAvatarUrl(user?.avatar)}
              alt="Avatar"
              className="sidebar-avatar"
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              onError={(e) => {
                console.log('Sidebar avatar load error:', e.target.src);
                e.target.src = 'https://res.cloudinary.com/dapvuniyx/image/upload/v1755712519/avatar_gj5yhw.jpg';
              }}
            />
            <div className="user-details">
              <h4>{user?.fullName}</h4>
              <p>
                {user?.phone ?
                  `SĐT: ${user.phone}` :
                  (user?.googleId ? 'Tài khoản Google' : 'Chưa có SĐT')
                }
              </p>
              <span className="user-role">{t(`roles.${user?.role}`)}</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${item.active ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <i className={`fa ${item.icon}`}></i>
              <span>{item.label}</span>
            </button>
          ))}

          <div className="sidebar-divider"></div>

          <button className="nav-item logout-item" onClick={handleLogout}>
            <i className="fa fa-sign-out"></i>
            <span>{t('profile.layout.sidebar.logout')}</span>
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="profile-main">
        <div className="main-content">
          <Outlet />
        </div>
      </div>

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="modal-overlay" onClick={cancelLogout}>
          <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('profile.layout.logoutModal.title')}</h3>
              <button className="modal-close" onClick={cancelLogout}>
                <i className="fa fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-icon">
                <i className="fa fa-question-circle"></i>
              </div>
              <p>{t('profile.layout.logoutModal.message')}</p>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={cancelLogout}>
                <i className="fa fa-times"></i> {t('profile.layout.logoutModal.cancel')}
              </button>
              <button className="btn-confirm" onClick={confirmLogout}>
                <i className="fa fa-check"></i> {t('profile.layout.logoutModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileLayout;
