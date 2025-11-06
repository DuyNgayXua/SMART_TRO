import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';

const LandlordProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const userData = localStorage.getItem('user');
  const location = useLocation();

  // Luôn gọi hooks trước khi có bất kỳ điều kiện return nào
  useEffect(() => {
    // Chỉ hiển thị toast khi có user nhưng không phải landlord
    if (token && userData) {
      const user = JSON.parse(userData);
      if (user.role !== 'landlord') {
        toast.error('Bạn không có quyền truy cập trang này. Chỉ chủ trọ mới được phép truy cập!', {
          position: "top-center",
          autoClose: 3000,
        });
      }
    }
  }, [token, userData]);

  // Kiểm tra authentication
  if (!token || !userData) {
    return <Navigate to="/" state={{ from: location.pathname }} replace />;
  }

  const user = JSON.parse(userData);

  // Kiểm tra role - chỉ landlord mới được truy cập
  if (user.role !== 'landlord') {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default LandlordProtectedRoute;
