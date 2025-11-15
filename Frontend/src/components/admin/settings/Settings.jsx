import React from "react";
import SideBar from "../../common/adminSidebar";
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../contexts/ThemeContext';
import "../admin-global.css";
import "./settings.css";
import "../../../styles/themes.css";

const Settings = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { theme, setLightTheme, setDarkTheme, isDark } = useTheme();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("role");
    localStorage.removeItem("promo_closed");

    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("promo_closed_")) {
        localStorage.removeItem(key);
      }
    });

    navigate("/");
  };

  const currentLanguage = i18n.language;

  return (
    <div className="settings-container">
      <SideBar />
      <div className="settings-content">
        {/* Header */}
        <div className="settings-header">
          <h1 className="settings-title">{t('settings.title')}</h1>
        </div>

        {/* Settings Tabs */}
        <div className="settings-tabs">
          <button className="settings-tab active">
            <i className="fas fa-cog"></i>
            {t('settings.general')}
          </button>
          <button className="settings-tab">
            <i className="fas fa-user"></i>
            {t('settings.account')}
          </button>
          <button className="settings-tab">
            <i className="fas fa-shield-alt"></i>
            {t('settings.security')}
          </button>
          <button className="settings-tab">
            <i className="fas fa-bell"></i>
            {t('settings.notifications')}
          </button>
          <button className="settings-tab">
            <i className="fas fa-palette"></i>
            {t('settings.appearance')}
          </button>
          <button className="settings-tab">
            <i className="fas fa-server"></i>
            {t('settings.system')}
          </button>
        </div>

        {/* Settings Content */}
        <div className="settings-main">
          {/* Language Settings */}
          <div className="settings-section">
            <div className="section-header">
              <h3 className="section-title">{t('settings.language')}</h3>
              <p className="section-description">{t('settings.languageDesc')}</p>
            </div>
            <div className="section-content">
              <div className="language-options">
                <div 
                  className={`language-option ${currentLanguage === 'vi' ? 'active' : ''}`}
                  onClick={() => changeLanguage('vi')}
                >
                  <div className="language-flag">🇻🇳</div>
                  <div className="language-info">
                    <div className="language-name">{t('settings.vietnamese')}</div>
                    <div className="language-code">Tiếng Việt</div>
                  </div>
                  <div className="language-radio">
                    <input 
                      type="radio" 
                      name="language" 
                      checked={currentLanguage === 'vi'}
                      onChange={() => changeLanguage('vi')}
                    />
                  </div>
                </div>

                <div 
                  className={`language-option ${currentLanguage === 'en' ? 'active' : ''}`}
                  onClick={() => changeLanguage('en')}
                >
                  <div className="language-flag">🇺🇸</div>
                  <div className="language-info">
                    <div className="language-name">{t('settings.english')}</div>
                    <div className="language-code">English</div>
                  </div>
                  <div className="language-radio">
                    <input 
                      type="radio" 
                      name="language" 
                      checked={currentLanguage === 'en'}
                      onChange={() => changeLanguage('en')}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <div className="section-header">
              <h3 className="section-title">{t('settings.security')}</h3>
              <p className="section-description">{t('settings.securityDesc')}</p>
            </div>
            <div className="section-content">
              <div className="logout-section">
                <div className="logout-info">
                  <h4>{t('settings.logout')}</h4>
                  <p>{t('settings.logoutDesc')}</p>
                </div>
                <button className="logout-button" onClick={handleLogout}>
                  <i className="fas fa-sign-out-alt"></i>
                  {t('settings.logoutButton')}
                </button>
              </div>
            </div>
          </div>

          {/* Theme Settings */}
          <div className="settings-section">
            <div className="section-header">
              <h3 className="section-title">{t('settings.appearance')}</h3>
              <p className="section-description">{t('settings.appearanceDesc')}</p>
            </div>
            <div className="section-content">
              <div className="theme-options">
                <div 
                  className={`theme-option ${!isDark ? 'active' : ''}`}
                  onClick={setLightTheme}
                >
                  <div className="theme-preview light-preview">
                    <div className="preview-header"></div>
                    <div className="preview-body">
                      <div className="preview-sidebar"></div>
                      <div className="preview-content">
                        <div className="preview-line"></div>
                        <div className="preview-line short"></div>
                      </div>
                    </div>
                  </div>
                  <div className="theme-info">
                    <div className="theme-name">{t('settings.lightTheme')}</div>
                    <div className="theme-description">{t('settings.lightThemeDesc')}</div>
                  </div>
                  <div className="theme-radio">
                    <input 
                      type="radio" 
                      name="theme" 
                      checked={!isDark}
                      onChange={setLightTheme}
                    />
                  </div>
                </div>

                <div 
                  className={`theme-option ${isDark ? 'active' : ''}`}
                  onClick={setDarkTheme}
                >
                  <div className="theme-preview dark-preview">
                    <div className="preview-header"></div>
                    <div className="preview-body">
                      <div className="preview-sidebar"></div>
                      <div className="preview-content">
                        <div className="preview-line"></div>
                        <div className="preview-line short"></div>
                      </div>
                    </div>
                  </div>
                  <div className="theme-info">
                    <div className="theme-name">{t('settings.darkTheme')}</div>
                    <div className="theme-description">{t('settings.darkThemeDesc')}</div>
                  </div>
                  <div className="theme-radio">
                    <input 
                      type="radio" 
                      name="theme" 
                      checked={isDark}
                      onChange={setDarkTheme}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <div className="section-header">
              <h3 className="section-title">Notification Preferences</h3>
              <p className="section-description">Configure how you receive notifications</p>
            </div>
            <div className="section-content">
              <div className="coming-soon">
                <i className="fas fa-clock"></i>
                <span>Coming Soon</span>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <div className="section-header">
              <h3 className="section-title">System Configuration</h3>
              <p className="section-description">Advanced system settings and maintenance</p>
            </div>
            <div className="section-content">
              <div className="coming-soon">
                <i className="fas fa-clock"></i>
                <span>Coming Soon</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
