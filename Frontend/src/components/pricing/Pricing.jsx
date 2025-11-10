import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Heading from "../common/Heading";
import "./Pricing.css";
import { FaStar, FaArrowUp } from "react-icons/fa";
import { toast } from 'react-toastify';


const Pricing = () => {
  const navigate = useNavigate();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [trialFormData, setTrialFormData] = useState({
    fullName: '',
    email: '',
    phone: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  // Lấy thông tin user từ localStorage
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      try {
        const parsedUser = JSON.parse(user);
        setUserInfo(parsedUser);
      } catch (error) {
        console.error('Error parsing user info:', error);
      }
    }
  }, []);

  // Theo dõi scroll để hiển thị/ẩn nút scroll to top
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Hàm scroll to top
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Xử lý mở modal đăng ký dùng thử
  const handleOpenTrialModal = (planName) => {
    if (planName === 'free') {
      // Kiểm tra xem user đã đăng nhập chưa
      if (!userInfo) {
        toast.info('Vui lòng đăng nhập để đăng ký gói miễn phí');
        navigate('/dang-nhap');
        return;
      }

      // Tự động điền thông tin từ user
      setTrialFormData({
        fullName: userInfo.fullName || '',
        email: userInfo.email || '',
        phone: userInfo.phone || ''
      });
      setShowTrialModal(true);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    }
  };

  // Xử lý đóng modal
  const handleCloseTrialModal = () => {
    setShowTrialModal(false);
    document.body.style.overflow = 'auto';
    setTrialFormData({ fullName: '', email: '', phone: '' });
  };

  // Xử lý thay đổi input
  const handleTrialInputChange = (e) => {
    const { name, value } = e.target;
    setTrialFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Xử lý submit form đăng ký dùng thử
  const handleTrialSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!trialFormData.fullName.trim()) {
      toast.error('Vui lòng nhập họ tên');
      return;
    }
    if (!trialFormData.email.trim()) {
      toast.error('Vui lòng nhập email');
      return;
    }
    if (!trialFormData.phone.trim()) {
      toast.error('Vui lòng nhập số điện thoại');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trialFormData.email)) {
      toast.error('Email không hợp lệ');
      return;
    }

    // Validate phone format (10 digits)
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(trialFormData.phone)) {
      toast.error('Số điện thoại phải có 10 chữ số');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(
        `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api'}/management/trial-request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(trialFormData)
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success('Đăng ký gói dùng thử thành công! Bạn đã được nâng cấp lên quyền Chủ trọ.');
        
        // Cập nhật thông tin user trong localStorage
        const updatedUser = {
          ...userInfo,
          role: 'landlord',
          freeTrial: {
            hasRegistered: true,
            registeredAt: new Date(),
            expiryDate: data.data.trialExpiryDate
          }
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        localStorage.setItem('role', 'landlord');
        
        handleCloseTrialModal();
        
        // Redirect to admin dashboard after 2 seconds
        setTimeout(() => {
          window.location.href = '/admin/dashboard';
        }, 2000);
      } else {
        if (data.requireLogin) {
          toast.info('Vui lòng đăng nhập để đăng ký gói miễn phí');
          handleCloseTrialModal();
          navigate('/dang-nhap');
        } else {
          toast.error(data.message || 'Đăng ký thất bại. Vui lòng thử lại.');
        }
      }
    } catch (error) {
      console.error('Error submitting trial request:', error);
      toast.error('Có lỗi xảy ra. Vui lòng thử lại sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const plans = [
    {
      name: "trial",
      displayName: "Gói Dùng Thử Miễn Phí",
      description:
        "Gói dùng thử miễn phí vĩnh viễn với 2 tin thường và 1 tin VIP 1 để trải nghiệm.",
      price: 0,
      duration: "1 tháng",
      color: "#22c55e", // xanh lá nhạt
      postLimits: [
        { type: "Tin Thường", count: 2, color: "#334155" },
        { type: "Tin VIP 1", count: 1, color: "#e83e8c" },
      ],
    },
    {
      name: "basic",
      displayName: "Gói Cơ Bản",
      description: "Gói cơ bản dành cho người mới bắt đầu đăng tin.",
      price: 50000,
      duration: "1 tháng",
      color: "#3b82f6", // xanh dương
      postLimits: [
        { type: "Tin Thường", count: 5, color: "#334155" },
        { type: "Tin VIP 1", count: 5, color: "#e83e8c" },
        { type: "Tin VIP Nổi Bật", count: 1, color: "#dc3545" },
        { type: "Tin VIP Đặc Biệt", count: 1, color: "#8b0000" },
      ],
    },
    {
      name: "vip",
      displayName: "Gói VIP",
      description: "Gói VIP với nhiều tính năng nâng cao và hiển thị ưu tiên.",
      price: 200000,
      duration: "1 tháng",
      color: "#f59e0b", // vàng cam
      postLimits: [
        { type: "Tin Thường", count: 10, color: "#334155" },
        { type: "Tin VIP 1", count: 10, color: "#e83e8c" },
        { type: "Tin VIP 2", count: 5, color: "#fd7e14" },
        { type: "Tin VIP Nổi Bật", count: 5, color: "#dc3545" },
        { type: "Tin VIP Đặc Biệt", count: 5, color: "#8b0000" },
      ],
    },
    {
      name: "premium",
      displayName: "Gói Premium",
      description: "Gói cao cấp nhất, đầy đủ tính năng và ưu tiên hiển thị tối đa.",
      price: 500000,
      duration: "1 tháng",
      color: "#8b5cf6", // tím sang trọng
      postLimits: [
        { type: "Tin Thường", count: 20, color: "#334155" },
        { type: "Tin VIP 1", count: 20, color: "#e83e8c" },
        { type: "Tin VIP 2", count: 15, color: "#fd7e14" },
        { type: "Tin VIP Nổi Bật", count: 10, color: "#dc3545" },
        { type: "Tin VIP Đặc Biệt", count: 10, color: "#8b0000" },
      ],
    },
  ];


  const vipExamples = [
    {
      title: "Tin VIP Đặc Biệt",
      stars: 5,
      color: "#8b0000",
      desc: "TIÊU ĐỀ IN HOA MÀU ĐỎ ĐẬM, gắn biểu tượng 5 ngôi sao màu vàng và hiển thị to và nhiều hình hơn các tin khác. ",
      note: "Nằm trên tất cả các tin khác, được hưởng nhiều ưu tiên và hiệu quả giao dịch cao nhất. Đồng thời xuất hiện đầu tiên ở mục tin nổi bật xuyên suốt khu vực chuyên mục đó.",
      image: "https://res.cloudinary.com/dapvuniyx/image/upload/v1761474036/laptop_vip_db_czgkip.png",
    },
    {
      title: "Tin VIP Nổi Bật",
      stars: 4,
      color: "#dc3545",
      desc: "TIÊU ĐỀ IN HOA MÀU ĐỎ, gắn biểu tượng 4 ngôi sao màu vàng ở tiêu đề tin đăng. ",
      note: "Hiển thị sau tin VIP Đặc Biệt và trên các tin khác.",
      image: "https://res.cloudinary.com/dapvuniyx/image/upload/v1761474036/laptop_vip_noi_bat_aegrpj.png",
    },
    {
      title: "Tin VIP 1",
      stars: 3,
      color: "#e83e8c",
      desc: "TIÊU ĐỀ IN HOA MÀU HỒNG, gắn biểu tượng 3 ngôi sao màu vàng ở tiêu đề tin đăng. ",
      note: "Hiển thị sau tin VIP Đặc Biệt, Nổi Bật và trên các tin khác.",
      image: "https://res.cloudinary.com/dapvuniyx/image/upload/v1761474035/laptop_vip_1_shhzkc.png",
    },
    {
      title: "Tin VIP 2",
      stars: 2,
      color: "#fd7e14",
      desc: "TIÊU ĐỀ IN HOA MÀU CAM, gắn biểu tượng 2 ngôi sao màu vàng ở tiêu đề tin đăng.",
      note: "Hiển thị sau tin VIP Đặc Biệt, Nổi Bật, Tin VIP 1 và trên các tin khác.",
      image: "https://res.cloudinary.com/dapvuniyx/image/upload/v1761474036/laptop_vip_2_fbbiyl.png",
    },
    {
      title: "Tin VIP 3",
      stars: 1,
      color: "#27ae60",
      desc: "TIÊU ĐỀ IN HOA MÀU XANH LÁ, gắn biểu tượng 1 ngôi sao màu vàng ở tiêu đề tin đăng. ",
      note: "Hiển thị sau tin VIP Đặc Biệt, Nổi Bật, Tin VIP 1, VIP 2 và trên các tin khác.",
      image: "https://res.cloudinary.com/dapvuniyx/image/upload/v1761474036/laptop_vip_3_whvn8t.png",
    },
    {
      title: "Tin Thường",
      stars: 0,
      color: "#334155",
      desc: "Tiêu đề màu mặc định, viết thường. ",
      note: "Hiển thị sau các tin VIP.",
      image: "https://res.cloudinary.com/dapvuniyx/image/upload/v1761474035/laptop_thuong_fcolrk.png",
    },
  ];

  const managementPlans = [
    {
      name: "free",
      title: "Gói Miễn Phí",
      price: 0,
      duration: "1 tháng",
      color: "#22c55e",
      features: [
        "Quản lý tối đa 5 phòng trọ",
        "Quản lý khách thuê & hợp đồng cơ bản",
        "Quản lý thanh toán đơn giản",
        "Hỗ trợ qua email"
      ]
    },
    {
      name: "premium",
      title: "Gói Tốn Phí",
      price: 199000,
      duration: "tháng",
      color: "#8b5cf6",
      popular: true,
      features: [
        "Quản lý KHÔNG GIỚI HẠN phòng trọ",
        "Tính toán tiền điện, nước tự động",
        "Thông báo qua email & SMS",
        "Báo cáo thống kê thu chi",
        "Xuất báo cáo Excel, PDF",
        "Hỗ trợ ưu tiên 24/7"
      ],
      badge: "PHỔ BIẾN NHẤT"
    }
  ];

  return (
    <section className="price-section">
      <div className="container-pricing">
        {/* Phần Bảng Giá Quản Lý Trọ */}
        <Heading title="Bảng giá quản lý trọ" subtitle="Giải pháp quản lý toàn diện cho chủ trọ" />
        
        <div className="management-pricing-grid">
          {managementPlans.map((plan, i) => (
            <div
              className={`management-card ${plan.popular ? 'popular' : ''}`}
              key={i}
              style={{ borderColor: plan.color }}
            >
              {plan.popular && (
                <div className="popular-badge" style={{ backgroundColor: plan.color }}>
                  {plan.badge}
                </div>
              )}
              
              <div className="management-header">
                <h3 className="management-title" style={{ color: plan.color }}>
                  {plan.title}
                </h3>
                <div className="management-price">
                  {plan.price === 0 ? (
                    <div className="price-free-large">
                      Miễn phí <span className="free-duration">{plan.duration}</span>
                    </div>
                  ) : (
                    <>
                      <span className="price-amount">{plan.price.toLocaleString()}đ</span>
                      <span className="price-period">/{plan.duration}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="management-body">
                <h4 className="features-title">Tính năng chính:</h4>
                <ul className="features-list">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="feature-item">
                      <i className="fas fa-check-circle" style={{ color: plan.color }}></i>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.limitations && (
                  <>
                    <h4 className="limitations-title">Giới hạn:</h4>
                    <ul className="limitations-list">
                      {plan.limitations.map((limitation, idx) => (
                        <li key={idx} className="limitation-item">
                          <i className="fas fa-times-circle"></i>
                          <span>{limitation}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {/* Ẩn nút nếu user đã đăng ký gói trial */}
                {!(userInfo && userInfo.freeTrial && userInfo.freeTrial.hasRegistered && plan.price === 0) && (
                  <button
                    className="btn-choose-plan"
                    style={{
                      backgroundColor: plan.color,
                      boxShadow: `0 4px 12px ${plan.color}40`
                    }}
                    onClick={() => handleOpenTrialModal(plan.name)}
                  >
                    {plan.price === 0 ? 'Bắt Đầu Miễn Phí' : 'Đăng Ký Ngay'}
                  </button>
                )}

                {/* Hiển thị thông báo đã đăng ký */}
                {userInfo && userInfo.freeTrial && userInfo.freeTrial.hasRegistered && plan.price === 0 && (
                  <div style={{
                    padding: '12px',
                    background: '#f0fdf4',
                    border: '2px solid #22c55e',
                    borderRadius: '8px',
                    textAlign: 'center',
                    color: '#16a34a',
                    fontWeight: 'bold'
                  }}>
                    ✅ Đã đăng ký
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Modal Đăng Ký Dùng Thử */}
        {showTrialModal && (
          <div className="trial-modal-overlay" onClick={handleCloseTrialModal}>
            <div className="trial-modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="trial-modal-close" onClick={handleCloseTrialModal}>
                <i className="fas fa-times"></i>
              </button>
              
              <h2 className="trial-modal-title">Đăng Ký Dùng Thử Miễn Phí</h2>
              <p className="trial-modal-subtitle">
                Điền thông tin để bắt đầu trải nghiệm quản lý trọ chuyên nghiệp
              </p>

              <form onSubmit={handleTrialSubmit} className="trial-form">
                <div className="trial-form-group">
                  <label htmlFor="fullName">
                    <i className="fas fa-user"></i>
                    Họ và tên <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    value={trialFormData.fullName}
                    onChange={handleTrialInputChange}
                    placeholder="Nguyễn Văn A"
                    disabled={!!userInfo}
                    required
                  />
                </div>

                <div className="trial-form-group">
                  <label htmlFor="email">
                    <i className="fas fa-envelope"></i>
                    Email <span className="required">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={trialFormData.email}
                    onChange={handleTrialInputChange}
                    placeholder="example@email.com"
                    disabled={!!userInfo}
                    required
                  />
                </div>

                <div className="trial-form-group">
                  <label htmlFor="phone">
                    <i className="fas fa-phone"></i>
                    Số điện thoại <span className="required">*</span>
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={trialFormData.phone}
                    onChange={handleTrialInputChange}
                    placeholder="0123456789"
                    maxLength="10"
                    disabled={!!userInfo}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="trial-submit-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check-circle"></i>
                      Xác Nhận Đăng Ký
                    </>
                  )}
                </button>

                <p className="trial-note">
                  <i className="fas fa-info-circle"></i>
                  Chúng tôi sẽ gửi thông tin đăng ký về email của bạn trong vòng 24h
                </p>
              </form>
            </div>
          </div>
        )}

        <div className="pricing-divider"></div>

        {/* Phần Bảng Giá Gói Tin Đăng */}
        <Heading title="Bảng giá gói tin đăng" subtitle="" />
        <h2>Áp dụng từ 01/08/2025</h2>

        <div className="price-grid">
          {plans.map((plan, i) => (
            <div
              className="price-card"
              key={i}
              style={{ border: `2px solid ${plan.color}`, borderRadius: '12px', overflow: 'hidden' }}
            >
              <div
                className="plan-header"
                style={{
                  backgroundColor: plan.color,
                  color: '#fff',
                  padding: '16px',
                  textAlign: 'center'
                }}
              >
                <h3 className="plan-name">{plan.displayName}</h3>
                <p className="plan-desc">{plan.description}</p>
              </div>

              <div className="plan-body" style={{ padding: '20px' }}>
                <div className="plan-price">
                  {plan.price === 0 ? (
                    <span className="price-free">Miễn phí</span>
                  ) : (
                    <>
                      <span className="price-value-pricing">{plan.price.toLocaleString()}đ</span>
                      <span className="price-duration">/{plan.duration}</span>
                    </>
                  )}
                </div>

                <ul className="plan-limits">
                  {plan.postLimits.map((limit, idx) => (
                    <li key={idx} style={{ color: limit.color }}>
                      <strong>{limit.type}:</strong> {limit.count} tin
                    </li>
                  ))}
                </ul>

                <button
                  className="btn-register"
                  style={{
                    backgroundColor: plan.color,
                    boxShadow: `0 3px 8px ${plan.color}40`,
                  }}
                >
                  SIÊU SALE
                </button>
              </div>
            </div>

          ))}
        </div>


        <Heading title="Minh họa tin đăng" />

        <div className="vip-grid">
          {vipExamples.map((vip, idx) => (
            <div className="vip-card" key={idx}>
              <h4 className="vip-title" style={{ color: vip.color }}>
                {vip.title}{" "}
                {Array.from({ length: vip.stars }).map((_, i) => (
                  <FaStar key={i} color="#facc15" />
                ))}
              </h4>
              <div className="container-desc">
                <p className="vip-desc">{vip.desc}</p>
                <p className="vip-note">{vip.note}</p>
              </div>
              <div className="vip-image">
                <img src={vip.image} alt={vip.title} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          className="go-to-top-btn"
          onClick={scrollToTop}
          aria-label="Scroll to top"
        >
          <FaArrowUp size={20} className="text-black" />
        </button>
      )}
    </section>
  );
};

export default Pricing;
