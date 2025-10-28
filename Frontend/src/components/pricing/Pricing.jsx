import React, { useState, useEffect } from "react";
import Heading from "../common/Heading";
import "./Pricing.css";
import { FaStar, FaArrowUp } from "react-icons/fa";


const Pricing = () => {
  const [showScrollTop, setShowScrollTop] = useState(false);

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

  return (
    <section className="price-section">
      <div className="container-pricing">
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
