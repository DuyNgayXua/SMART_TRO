import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { usersAPI } from '../../../services/api';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import './AccountManagement.css';

const AccountManagement = () => {
  const { user, setUserData } = useAuth();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    avatar: null
  });
  const [avatarPreview, setAvatarPreview] = useState('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    old: false,
    new: false,
    confirm: false
  });
  const [sessions, setSessions] = useState([]);
  const [showSessions, setShowSessions] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Helper function để xử lý URL avatar Google
  const getAvatarUrl = () => {
    // Ưu tiên avatar preview (khi user chọn file mới)
    if (avatarPreview && formData.avatar) return avatarPreview;
    
    // Sau đó ưu tiên avatar từ user context (đã được update)
    if (user?.avatar) {
      // Nếu là avatar Google, cải thiện URL
      if (user.avatar.includes('googleusercontent.com')) {
        // Thay đổi kích thước và loại bỏ crop để có chất lượng tốt hơn
        const baseUrl = user.avatar.split('=')[0];
        return `${baseUrl}=s200-c`;
      }
      return user.avatar;
    }
    
    // Cuối cùng mới dùng avatar mặc định
    return 'https://res.cloudinary.com/dapvuniyx/image/upload/v1755712519/avatar_gj5yhw.jpg';
  };

  // Load user data when component mounts
  useEffect(() => {
    if (user) {
      // Load user avatar if exists
      setFormData({
        fullName: user.fullName || '',
        phone: user.phone || '',
        avatar: null // Reset file input khi user data thay đổi
      });
      
      // Reset avatar preview khi user data thay đổi (sau khi upload thành công)
      setAvatarPreview('');
    }
  }, [user]); // Bỏ avatarPreview khỏi dependency để tránh loop

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error(t('profile.account.profileInfo.error', 'Vui lòng chọn file hình ảnh!'));
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('profile.account.profileInfo.error', 'Kích thước file không được vượt quá 5MB!'));
        return;
      }

      setFormData(prev => ({
        ...prev,
        avatar: file
      }));

      // Preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoadingProfile(true);

    try {
      const updateData = new FormData();
      updateData.append('fullName', formData.fullName);
      
      // Chỉ gửi phone nếu có giá trị hoặc không phải tài khoản Google
      if (formData.phone && formData.phone.trim()) {
        updateData.append('phone', formData.phone);
      } else if (!user?.googleId) {
        // Nếu không phải tài khoản Google thì phone bắt buộc
        updateData.append('phone', formData.phone);
      }
      
      if (formData.avatar) {
        updateData.append('avatar', formData.avatar);
      }

      const response = await usersAPI.updateProfile(updateData);
      
      if (response.data.success) {
        // Update user data in context
        setUserData(response.data.data);
        
        // Reset form after successful update
        setFormData(prev => ({
          ...prev,
          avatar: null // Reset file input
        }));
        setAvatarPreview(''); // Reset preview để hiển thị avatar mới từ server
        
        toast.success(t('profile.account.profileInfo.success'));
      } else {
        // Hiển thị chi tiết lỗi validation
        if (response.data.errors && Array.isArray(response.data.errors)) {
          response.data.errors.forEach(error => toast.error(error));
        } else {
          toast.error(response.data.message || t('profile.account.profileInfo.error'));
        }
      }
    } catch (error) {
      console.error('Update profile error:', error);
      // Hiển thị chi tiết lỗi validation từ backend
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        error.response.data.errors.forEach(error => toast.error(error));
      } else {
        toast.error(error.response?.data?.message || t('profile.account.profileInfo.error'));
      }
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error(t('profile.account.security.password.error'));
      return;
    }

    setIsLoadingPassword(true);

    try {
      const response = await usersAPI.changePassword({
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword
      });

      if (response.data.success) {
        toast.success(t('profile.account.security.password.success'));
        setShowChangePassword(false);
        setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        // Hiển thị chi tiết lỗi validation
        if (response.data.errors && Array.isArray(response.data.errors)) {
          response.data.errors.forEach(error => toast.error(error));
        } else {
          toast.error(response.data.message || t('profile.account.security.password.error'));
        }
      }
    } catch (error) {
      console.error('Change password error:', error);
      // Hiển thị chi tiết lỗi validation từ backend
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        error.response.data.errors.forEach(error => toast.error(error));
      } else {
        toast.error(error.response?.data?.message || t('profile.account.profileInfo.error'));
      }
    } finally {
      setIsLoadingPassword(false);
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const loadActiveSessions = async () => {
    setLoadingSessions(true);
    try {
      const response = await usersAPI.getActiveSessions();
      if (response.data.success) {
        setSessions(response.data.data);
      }
    } catch (error) {
      console.error('Load sessions error:', error);
      toast.error('Không thể tải thông tin phiên đăng nhập');
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleLogoutSession = async (sessionId) => {
    try {
      const response = await usersAPI.logoutSession(sessionId);
      if (response.data.success) {
        toast.success('Đã đăng xuất phiên thành công');
        loadActiveSessions(); // Reload sessions
      }
    } catch (error) {
      console.error('Logout session error:', error);
      toast.error('Không thể đăng xuất phiên này');
    }
  };

  const handleLogoutAllOtherSessions = async () => {
    try {
      const response = await usersAPI.logoutAllOtherSessions();
      if (response.data.success) {
        toast.success(response.data.message);
        loadActiveSessions(); // Reload sessions
      }
    } catch (error) {
      console.error('Logout all sessions error:', error);
      toast.error('Không thể đăng xuất các phiên khác');
    }
  };

  return (
    <div className="account-management">
      <div className="page-header">
        <h2>
          <i className="fa fa-user-cog"></i>
          {t('profile.account.title')}
        </h2>
        <p>{t('profile.account.subtitle')}</p>
      </div>

      <div className="content-grid">
        {/* Profile Information */}
        <div className="content-card">
          <div className="card-header">
            <h3>
              <i className="fa fa-user"></i>
              {t('profile.account.profileInfo.title')}
            </h3>
          </div>
          
          <form onSubmit={handleSubmit} className="profile-form">
            <div className="avatar-section">
              <div className="avatar-container">
                <img 
                  src={getAvatarUrl()}
                  alt="Avatar" 
                  className="avatar-preview"
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    console.log('Avatar load error:', e.target.src);
                    e.target.src = 'https://res.cloudinary.com/dapvuniyx/image/upload/v1755712519/avatar_gj5yhw.jpg';
                  }}
                />
                <label className="avatar-upload-btn">
                  <i className="fa fa-camera"></i>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleAvatarChange}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
              <div className="avatar-info">
                <h4>{t('profile.account.profileInfo.avatar.title')}</h4>
                <p>{t('profile.account.profileInfo.avatar.description')}</p>
              </div>
            </div>

            <div className="form-row-management">
              <div className="form-group-management">
                <label>{t('profile.account.profileInfo.fullName')} *</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder={t('profile.account.profileInfo.fullName')}
                  required
                />
              </div>
            </div>

            <div className="form-row-management">
              <div className="form-group-management">
                <label>{t('profile.account.profileInfo.email')}</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="disabled-input"
                />
                <small>{t('profile.account.profileInfo.emailNote')}</small>
              </div>
            </div>

            <div className="form-row-management">
              <div className="form-group-management">
                <label>
                  {t('profile.account.profileInfo.phone')} 
                  {!user?.googleId && ' *'}
                  {user?.googleId && (
                    <small className="optional-field"> (Tùy chọn cho tài khoản Google)</small>
                  )}
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder={user?.googleId ? "Tài khoản Google không yêu cầu SĐT" : t('profile.account.profileInfo.phone')}
                  required={!user?.googleId}
                />
                {user?.googleId && !formData.phone && (
                  <small style={{color: '#666', marginTop: '5px', display: 'block'}}>
                    Tài khoản Google có thể không có số điện thoại
                  </small>
                )}
              </div>
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                className="btn-save-mk"
                disabled={isLoadingProfile}
              >
                {isLoadingProfile ? (
                  <>
                    <i className="fa fa-spinner fa-spin"></i>
                    {t('profile.account.profileInfo.saving')}
                  </>
                ) : (
                  <>
                    <i className="fa fa-save"></i>
                    {t('profile.account.profileInfo.saveChanges')}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Security Settings */}
        <div className="content-card">
          <div className="card-header">
            <h3>
              <i className="fa fa-shield"></i>
              {t('profile.account.security.title')}
            </h3>
          </div>

          <div className="security-section">
            <div className="security-item">
              <div className="security-info">
                <h4>{t('profile.account.security.password.title')}</h4>
                <p>
                  {user?.googleId ? 
                    t('profile.account.security.password.googleAccountNote') : 
                    t('profile.account.security.password.description')
                  }
                </p>
              </div>
              {!user?.googleId && (
                <button 
                  className="btn-secondary-management"
                  onClick={() => setShowChangePassword(!showChangePassword)}
                >
                  <i className="fa fa-key"></i>
                  {t('profile.account.security.password.changeButton')}
                </button>
              )}
            </div>

            {showChangePassword && !user?.googleId && (
              <form onSubmit={handlePasswordSubmit} className="password-form">
                <div className="form-group-management">
                  <label>{t('profile.account.security.password.currentPassword')} *</label>
                  <div className="password-input">
                    <input
                      type={showPasswords.old ? "text" : "password"}
                      name="oldPassword"
                      value={passwordData.oldPassword}
                      onChange={handlePasswordChange}
                      placeholder={t('profile.account.security.password.currentPassword')}
                      required
                    />
                    <button 
                      type="button"
                      className="password-toggle"
                      onClick={() => togglePasswordVisibility('old')}
                    >
                      <i className={`fa ${showPasswords.old ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>

                <div className="form-group-management">
                  <label>{t('profile.account.security.password.newPassword')} *</label>
                  <div className="password-input">
                    <input
                      type={showPasswords.new ? "text" : "password"}
                      name="newPassword"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      placeholder={t('profile.account.security.password.newPassword')}
                      required
                    />
                    <button 
                      type="button"
                      className="password-toggle"
                      onClick={() => togglePasswordVisibility('new')}
                    >
                      <i className={`fa ${showPasswords.new ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                  <small>{t('profile.account.security.password.passwordRequirement')}</small>
                </div>

                <div className="form-group-management">
                  <label>{t('profile.account.security.password.confirmPassword')} *</label>
                  <div className="password-input">
                    <input
                      type={showPasswords.confirm ? "text" : "password"}
                      name="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      placeholder={t('profile.account.security.password.confirmPassword')}
                      required
                    />
                    <button 
                      type="button"
                      className="password-toggle"
                      onClick={() => togglePasswordVisibility('confirm')}
                    >
                      <i className={`fa ${showPasswords.confirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>

                <div className="form-actions">
                  <button 
                    type="button" 
                    className="btn-cancel"
                    onClick={() => {
                      setShowChangePassword(false);
                      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
                    }}
                  >
                    <i className="fa fa-times"></i>
                    {t('profile.account.security.password.cancel')}
                  </button>
                  <button 
                    type="submit" 
                    className="btn-save"
                    disabled={isLoadingPassword}
                  >
                    {isLoadingPassword ? (
                      <>
                        <i className="fa fa-spinner fa-spin"></i>
                        {t('profile.account.security.password.saving')}
                      </>
                    ) : (
                      <>
                        <i className="fa fa-check"></i>
                        {t('profile.account.security.password.save')}
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            <div className="security-item">
              <div className="security-info">
                <h4>{t('profile.account.security.loginMethod.title')}</h4>
                <p>
                  {user?.googleId ? (
                    <span className="login-method-google">
                      <i className="fab fa-google"></i>
                      {t('profile.account.security.loginMethod.google')}
                    </span>
                  ) : (
                    <span className="login-method-email">
                      <i className="fa fa-envelope"></i>
                      {t('profile.account.security.loginMethod.email')}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="security-item">
              <div className="security-info">
                <h4>{t('profile.account.security.accountStatus.title')}</h4>
                <p>
                  {user?.isActive ? (
                    <span className="status-active">
                      <i className="fa fa-check-circle"></i>
                      {t('profile.account.security.accountStatus.verified')}
                    </span>
                  ) : (
                    <span className="status-inactive">
                      <i className="fa fa-exclamation-circle"></i>
                      {t('profile.account.security.accountStatus.unverified')}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="security-item">
              <div className="security-info">
                <h4>{t('profile.account.security.activeSessions.title')}</h4>
                <p>{t('profile.account.security.activeSessions.description')}</p>
              </div>
              <button 
                className="btn-secondary-management"
                onClick={() => {
                  if (!showSessions) {
                    loadActiveSessions();
                  }
                  setShowSessions(!showSessions);
                }}
              >
                <i className="fa fa-devices"></i>
                {showSessions ? t('profile.account.security.activeSessions.hideSessions') : t('profile.account.security.activeSessions.viewSessions')}
              </button>
            </div>

            {showSessions && (
              <div className="sessions-section">
                <div className="sessions-header">
                  <h4>{t('profile.account.security.activeSessions.title')}</h4>
                  <button 
                    className="btn-logout-all"
                    onClick={handleLogoutAllOtherSessions}
                    disabled={loadingSessions}
                  >
                    <i className="fa fa-sign-out-alt"></i>
                    {t('profile.account.security.activeSessions.logoutAllOthers')}
                  </button>
                </div>
                
                {loadingSessions ? (
                  <div className="loading-sessions">
                    <i className="fa fa-spinner fa-spin"></i>
                    {t('profile.account.security.activeSessions.loading')}
                  </div>
                ) : (
                  <div className="sessions-list">
                    {sessions.map((session) => (
                      <div key={session.sessionId} className={`session-item ${session.isCurrent ? 'current' : ''}`}>
                        <div className="session-info">
                          <div className="session-device">
                            <i className={`fa ${
                              session.deviceInfo?.deviceType === 'mobile' ? 'fa-mobile-alt' : 
                              session.deviceInfo?.deviceType === 'tablet' ? 'fa-tablet-alt' : 
                              'fa-desktop'
                            }`}></i>
                            <div>
                              <h5>
                                {session.deviceString || 
                                 session.deviceInfo?.deviceString || 
                                 `${session.deviceInfo?.browser || 'Unknown Browser'} ${session.deviceInfo?.browserVersion || ''} trên ${session.deviceInfo?.os || 'Unknown OS'}`
                                }
                              </h5>
                              <p className="session-location">
                                {session.locationString || 
                                 session.location?.locationString || 
                                 `${session.location?.city || 'Unknown'}, ${session.location?.region || 'Unknown'}, ${session.location?.country || 'Unknown'}`
                                }
                              </p>
                              <p className="session-details">
                                {t('profile.account.security.activeSessions.ip')} {session.location?.ip || 'N/A'} • {session.location?.isp || 'N/A'}
                              </p>
                              <p className="session-time">
                                {t('profile.account.security.activeSessions.loginTime')} {new Date(session.loginTime).toLocaleString('vi-VN')}
                                {session.duration && ` • ${t('profile.account.security.activeSessions.duration')} ${session.duration}`}
                              </p>
                            </div>
                          </div>
                          {session.isCurrent && (
                            <span className="current-badge">{t('profile.account.security.activeSessions.currentSession')}</span>
                          )}
                        </div>
                        {!session.isCurrent && (
                          <button 
                            className="btn-logout-session"
                            onClick={() => handleLogoutSession(session.sessionId)}
                          >
                            <i className="fa fa-sign-out-alt"></i>
                            {t('profile.account.security.activeSessions.logoutSession')}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountManagement;
