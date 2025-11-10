import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiUtils } from '../../services/api';
import { toast } from 'react-toastify';

const LandlordProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  
  // Kiểm tra authentication và role
  const isAuthenticated = user || apiUtils.isAuthenticated();
  const userRole = user?.role || apiUtils.getUserRole();
  const isLandlord = userRole === 'landlord';

  // Luôn gọi hooks trước khi có bất kỳ điều kiện return nào
  useEffect(() => {
    // Chỉ hiển thị toast khi đã authenticated nhưng không phải landlord
    if (isAuthenticated && !isLandlord) {
      toast.warning('Chức năng này chỉ dành cho chủ trọ. Vui lòng nâng cấp tài khoản!', {
        position: "top-center",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  }, [isAuthenticated, isLandlord]);
  
  // Kiểm tra authentication
  if (!isAuthenticated) {
    // Redirect về login với thông tin trang hiện tại để sau khi login có thể quay lại
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // Kiểm tra role landlord
  if (!isLandlord) {
    // Redirect về trang giá dịch vụ (pricing)
    return <Navigate to="/pricing" replace />;
  }
  
  // Nếu đã đăng nhập và là landlord, render children
  return children;
};

export default LandlordProtectedRoute;
