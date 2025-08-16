import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const usePageTitle = () => {
  const location = useLocation();

  useEffect(() => {
    const pageTitles = {
      '/': 'Trang chủ',
      '/about': 'Giới thiệu',
      '/services': 'Dịch vụ',
      '/blog': 'Blog',
      '/pricing': 'Bảng giá',
      '/contact': 'Liên hệ',
      '/login': 'Đăng nhập',
      '/register': 'Đăng ký',
      '/forgot-password': 'Quên mật khẩu',
      '/admin/dashboard': 'Bảng điều khiển',
      '/admin/rooms': 'Quản lý phòng trọ',
      '/admin/settings': 'Cài đặt hệ thống',
      '/admin/users': 'Quản lý người dùng',
      '/admin/orders': 'Quản lý đơn hàng',
      '/admin/report': 'Báo cáo doanh thu',
      '/admin/voucher': 'Quản lý khuyến mãi',
    };

    const currentTitle = pageTitles[location.pathname] || 'HDND Store';
    document.title = currentTitle;
  }, [location.pathname]);
};

export default usePageTitle;
