import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, apiUtils, setGlobalLogoutHandler } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Cache to prevent multiple auth checks
let __authCheckDone = false;
let __authCheckPromise = null;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    apiUtils.clearAuthData();
    setUser(null);
    __authCheckDone = false; // Reset auth check when logout
    __authCheckPromise = null;
  };

  // Set up global logout handler
  useEffect(() => {
    setGlobalLogoutHandler(logout);
  }, []);

  // Kiểm tra trạng thái đăng nhập khi khởi tạo - chỉ một lần
  useEffect(() => {
    // If auth check already done, use cached result
    if (__authCheckDone) {
      setLoading(false);
      return;
    }
    
    // If auth check is in progress, wait for it
    if (__authCheckPromise) {
      __authCheckPromise.then(() => setLoading(false));
      return;
    }
    
    // Start auth check
    const checkAuthStatus = async () => {
      const token = apiUtils.getToken();
      
      try {
        // Always try to get profile, even without token (for bypass mode)
        const response = await authAPI.getProfile();
        if (response.data && response.data.success) {
          setUser(response.data.data);
        }
      } catch (error) {
        // If we had a token but it's invalid, clear it
        if (token) {
          apiUtils.clearAuthData();
        }
        setUser(null);
      }
      
      __authCheckDone = true;
      setLoading(false);
    };
    
    __authCheckPromise = checkAuthStatus();
  }, []);

  const login = async (credentials, remember = false) => {
    try {
      const res = await authAPI.login(credentials);
      if (res.data && res.data.success) {
        const { token, user: userData } = res.data.data;
        apiUtils.setAuthData(token, userData._id, userData.role, remember);
        setUser(userData);
        return { success: true, user: userData };
      } else {
        return { success: false, message: res.data?.message, errors: res.data?.errors };
      }
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Đăng nhập thất bại',
        errors: error.response?.data?.errors 
      };
    }
  };

  const setUserData = (userData) => {
    setUser(userData);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    setUser,
    setUserData
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
