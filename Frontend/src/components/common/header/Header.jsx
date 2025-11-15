import React, { useState, useEffect } from "react"
import "./header.css"
import { nav } from "../../data/Data"
import { Link, useNavigate } from "react-router-dom"
import { useTranslation } from 'react-i18next'
import { useAuth } from "../../../contexts/AuthContext"
import { useFavorites } from "../../../contexts/FavoritesContext"
import { useNotifications } from "../../../contexts/NotificationContext"
import { toast } from 'react-toastify'
import { FaHeart, FaRegHeart } from "react-icons/fa";
import NotificationDropdown from "../../notifications/NotificationDropdown/NotificationDropdown"


const Header = () => {
  const [navList, setNavList] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false)
  const { t, i18n } = useTranslation()
  const { user, logout, loading } = useAuth()
  const { favoritesCount } = useFavorites()
  const { unreadCount, reconnectWebSocket, refreshNotifications, wsConnection, testNotification, notifications } = useNotifications()
  const navigate = useNavigate()
  const [bellAnimating, setBellAnimating] = useState(false)

  // Debug: Track unreadCount changes
  useEffect(() => {
    console.log('🔔 Header: unreadCount changed to:', unreadCount, 'Current page:', window.location.pathname);
    console.log('🔔 Header: Full context value:', { unreadCount, wsConnection, notificationsLength: notifications?.length });
  }, [unreadCount, wsConnection, notifications]);

  // Debug: Track WebSocket connection changes
  useEffect(() => {
    console.log('🔌 Header: WebSocket connection status:', wsConnection, 'Current page:', window.location.pathname);
  }, [wsConnection]);

  // Animate bell when unreadCount increases
  useEffect(() => {
    if (unreadCount > 0) {
      console.log('🔔 Header: triggering bell animation for new notification');
      setBellAnimating(true);
      const t = setTimeout(() => setBellAnimating(false), 1400); // match CSS animation duration
      return () => clearTimeout(t);
    }
  }, [unreadCount]);

  // Force component re-render when notifications change (debugging)
  const [, forceUpdate] = useState({});
  useEffect(() => {
    console.log('Header: Force updating component due to notification changes');
    forceUpdate({});
  }, [notifications, unreadCount]);


  // Helper function để xử lý URL avatar Google
  const getAvatarUrl = (avatar) => {
    if (avatar && avatar.includes('googleusercontent.com')) {
      // Cải thiện chất lượng ảnh Google
      const baseUrl = avatar.split('=')[0];
      const newUrl = `${baseUrl}=s200-c`;
      console.log('Header: Converting Google avatar URL from', avatar, 'to', newUrl);
      return newUrl;
    }
    return avatar || 'https://res.cloudinary.com/dapvuniyx/image/upload/v1755712519/avatar_gj5yhw.jpg';
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng)
  }

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuOpen && !event.target.closest('.user-profile')) {
        setUserMenuOpen(false)
      }
      if (notificationDropdownOpen && !event.target.closest('.notification-bell')) {
        setNotificationDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [userMenuOpen, notificationDropdownOpen])

  const handleLogout = () => {
    // Hiển thị modal xác nhận
    setShowLogoutModal(true);
    setUserMenuOpen(false);
  }

  const confirmLogout = () => {
    // Hiển thị toast đăng xuất thành công
    toast.success('Đăng xuất thành công!');

    // Đóng modal
    setShowLogoutModal(false);

    // Delay logout và chuyển trang
    setTimeout(() => {
      logout();
      navigate("/");
    }, 1500);
  }

  const cancelLogout = () => {
    setShowLogoutModal(false);
  }

  return (
    <>
      <header>
        <div className='container flex'>
          <div className='logo'>
            <img src='https://res.cloudinary.com/dapvuniyx/image/upload/v1755767647/logotro_jtjowi.png' alt='' />
          </div>
          <div className='nav'>
            <ul className={navList ? "small" : "flex"}>
              {nav.map((list, index) => (
                <li key={index}>
                  <Link to={list.path}>{t(`header.nav.${list.text.toLowerCase()}`, list.text)}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className='button flex'>
            <Link to="/profile/favorites" className="favorites-link">
              <h4>
                {favoritesCount > 0 ? <FaHeart className="heart-icon-header filled" /> : <FaRegHeart className="heart-icon-header empty" />}
                {t('header.myList')}
              </h4>
            </Link>
            <div className="language-switcher">
              <button
                className={`lang-btn ${i18n.language === 'vi' ? 'active' : ''}`}
                onClick={() => changeLanguage('vi')}
              >
                VI
              </button>
              <button
                className={`lang-btn ${i18n.language === 'en' ? 'active' : ''}`}
                onClick={() => changeLanguage('en')}
              >
                EN
              </button>
            </div>
            <div className="auth-buttons">
              {loading ? (
                // Hiển thị loading khi đang kiểm tra auth
                <div className="loading-auth">...</div>
              ) : user ? (
                // Hiển thị thông tin user khi đã đăng nhập
                <div className="user-section">
                  {/* Notification Bell */}
                  <div className="notification-bell" onClick={() => setNotificationDropdownOpen(!notificationDropdownOpen)}>
                    <button className="notification-btn">
                      <i className={`fa fa-bell ${bellAnimating ? 'bell-animate' : ''}`}></i>
                      {unreadCount > 0 && (
                        <span className="notification-badge">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                
                   
                    </button>
                    <NotificationDropdown
                      isOpen={notificationDropdownOpen}
                      onClose={() => setNotificationDropdownOpen(false)}
                    />
                  </div>

                  <div className="user-profile" onClick={() => setUserMenuOpen(!userMenuOpen)}>
                    <div className="user-info">
                      <img
                        src={getAvatarUrl(user.avatar)}
                        alt="Avatar"
                        className="user-avatar"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          console.log('Header avatar load error:', e.target.src);
                          e.target.src = 'https://res.cloudinary.com/dapvuniyx/image/upload/v1755712519/avatar_gj5yhw.jpg';
                        }}
                      />
                      <span className="user-name">{user.fullName}</span>
                      <i className={`fa fa-chevron-${userMenuOpen ? 'up' : 'down'}`}></i>
                    </div>
                    {userMenuOpen && (
                      <div className="user-dropdown">
                        <div className="user-dropdown-header">
                          <img
                            src={getAvatarUrl(user.avatar)}
                            alt="Avatar"
                            className="dropdown-avatar"
                            crossOrigin="anonymous"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              console.log('Dropdown avatar load error:', e.target.src);
                              e.target.src = 'https://res.cloudinary.com/dapvuniyx/image/upload/v1755712519/avatar_gj5yhw.jpg';
                            }}
                          />
                          <div className="dropdown-user-info">
                            <p className="dropdown-name">{user.fullName}</p>
                            <p className="dropdown-email">{user.email}</p>
                            {user.phone ? (
                              <p className="dropdown-phone">SĐT: {user.phone}</p>
                            ) : user.googleId ? (
                              <p className="dropdown-phone">Tài khoản Google</p>
                            ) : (
                              <p className="dropdown-phone">Chưa có SĐT</p>
                            )}
                            <span className="dropdown-role">{t(`roles.${user.role}`)}</span>
                          </div>
                        </div>
                        <hr />
                        <Link to="/profile/new-post" onClick={() => setUserMenuOpen(false)}>
                          <i className="fa fa-plus-circle"></i> {t('header.properties')}
                        </Link>

                        <Link to="/profile/favorites" onClick={() => setUserMenuOpen(false)}>
                          <i className="fa fa-heart"></i> {t('header.myList')} ({favoritesCount || 0})
                        </Link>

                        <Link to="/profile/account" onClick={() => setUserMenuOpen(false)}>
                          <i className="fa fa-user"></i> {t('header.profile')}
                        </Link>
                        <Link to="/profile/pricing-analytics" onClick={() => setUserMenuOpen(false)}>
                          <i className="fa fa-chart-line"></i> {t('header.pricingAnalytics')}
                        </Link>
                        {user.role === 'admin' && (
                          <a href="/admin/dashboard" target="_blank" rel="noopener noreferrer" onClick={() => setUserMenuOpen(false)}>
                            <i className="fa fa-dashboard"></i> {t('header.admin')}
                          </a>
                        )}
                         {user.role === 'landlord' && (
                          <a href="/landlord/dashboard" target="_blank" rel="noopener noreferrer" onClick={() => setUserMenuOpen(false)}>
                            <i className="fa fa-briefcase"></i> {t('header.landlord')}
                          </a>
                        )}
                        <hr />
                        <button className="logout-btn" onClick={handleLogout}>
                          <i className="fa fa-sign-out"></i> {t('header.logout')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // Hiển thị nút đăng ký/đăng nhập khi chưa đăng nhập
                <>
                  <Link to='/register'>
                    <button className='btn2'>
                      <i className='fa fa-user-plus'></i> {t('header.register')}
                    </button>
                  </Link>
                  <Link to='/login'>
                    <button className='btn1'>
                      <i className='fa fa-sign-in'></i> {t('header.signIn')}
                    </button>
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className='toggle'>
            <button onClick={() => setNavList(!navList)}>{navList ? <i className='fa fa-times'></i> : <i className='fa fa-bars'></i>}</button>
          </div>
        </div>
      </header>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="modal-overlay" onClick={cancelLogout}>
          <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Xác nhận đăng xuất</h3>
            </div>
            <div className="modal-body">
              <p>Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?</p>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={cancelLogout}>
                Không
              </button>
              <button className="btn-confirm" onClick={confirmLogout}>
                Có
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Header
