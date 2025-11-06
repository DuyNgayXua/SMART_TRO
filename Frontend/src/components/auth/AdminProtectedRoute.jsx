import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiUtils } from '../../services/api';
import { toast } from 'react-toastify';

const AdminProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  // Kiểm tra authentication và role
  const isAuthenticated = user || apiUtils.isAuthenticated();
  const userRole = user?.role || apiUtils.getUserRole();
  const isAdmin = userRole === 'admin';

  // Luôn gọi hooks trước khi có bất kỳ điều kiện return nào
  useEffect(() => {
    // Chỉ hiển thị toast khi đã authenticated nhưng không phải admin
    if (isAuthenticated && !isAdmin) {
      toast.error('Bạn không có quyền truy cập trang này. Chỉ quản trị viên mới được phép truy cập!', {
        position: "top-center",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  }, [isAuthenticated, isAdmin]);
  
  // Kiểm tra authentication
  if (!isAuthenticated) {
    // Redirect về login với thông tin trang hiện tại để sau khi login có thể quay lại
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // Kiểm tra role admin
  if (!isAdmin) {
    // Redirect về trang chủ tìm trọ
    return <Navigate to="/" replace />;
  }
  
  // Nếu đã đăng nhập và là admin, render children
  return children;
};

export default AdminProtectedRoute;
