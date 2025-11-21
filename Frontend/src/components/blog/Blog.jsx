import React from "react";
import Back from "../common/Back";
import "./Blog.css";
import img from "../images/about.jpg";

const blogPosts = [
  {
    category: "Tin tức thị trường",
    title: "Phòng trọ giá rẻ đang dần biến mất tại các khu trung tâm?",
    excerpt:
      "Phòng trọ giá rẻ dần biến mất khỏi trung tâm TPHCM. Nguyên nhân: tại sao phòng trọ giá rẻ 'mất tích'? Phòng trọ giá rẻ tại các quận trung tâm TP.HCM…",
    thumbnail:
      "https://pt123.cdn.static123.com/images/thumbs/450x300/fit/2025/11/06/phong-tro-gia-re-tphcm-dan-bien-mat-khoi-khu-trung-tam_1762414471.png",
  },
  {
    category: "Kinh nghiệm",
    title: "Năm 2025: Người đi làm sẽ ưa chuộng loại phòng trọ nào?",
    excerpt:
      "Mô hình phòng trọ người đi làm ưa chuộng năm 2025. Những loại hình phòng trọ được ưu tiên: phòng trọ truyền thống có nội thất…",
    thumbnail:
      "https://pt123.cdn.static123.com/images/thumbs/450x300/fit/2025/09/13/mo-hinh-phong-tro-nguoi-di-lam-ua-chuong-2025_1757754712.png",
  },
  {
    category: "Tin tức thị trường",
    title:
      "Giá phòng trọ TPHCM tháng 8/2025: Tăng hay giảm? Người thuê nên lưu ý điều gì?",
    excerpt:
      "Giá phòng trọ TPHCM T8/2025 tăng hay giảm? Diễn biến thị trường phòng trọ tháng 8/2025 ghi nhận nhiều biến động…",
    thumbnail:
      "https://pt123.cdn.static123.com/images/thumbs/450x300/fit/2025/08/13/gia-phong-tro-tphcm-t8-2025-nguoi-thue-phai-luu-y-gi_1755071790.png",
  },
  {
    category: "Tin tức thị trường",
    title:
      "Sáp nhập tỉnh thành có ảnh hưởng gì đến thị trường cho thuê phòng trọ?",
    excerpt:
      "Dự báo thị trường cho thuê phòng trọ sau thông tin sáp nhập tỉnh. Tác động của thị trường cho thuê phòng trọ khi sáp nhập…",
    thumbnail:
      "https://pt123.cdn.static123.com/images/thumbs/450x300/fit/2025/07/02/du-bao-thi-truong-phong-tro-sau-thong-tin-sap-nhap-tinh-thanh_1751449092.png",
  },
  {
    category: "Kinh nghiệm",
    title: "5 dấu hiệu cho thấy bạn đang thuê nhầm 'phòng trọ ác mộng'",
    excerpt:
      "Dấu hiệu 1: Chủ trọ can thiệp đời tư. Một trong những dấu hiệu 'đáng báo động' nhất cho thấy…",
    thumbnail:
      "https://pt123.cdn.static123.com/images/thumbs/450x300/fit/2025/05/13/5-dau-hieu-thue-nham-phong-tro-ac-mong_1747125049.png",
  },
  {
    category: "Kinh nghiệm",
    title: "Hướng dẫn cách xem và tính tiền điện nước phòng trọ chuẩn",
    excerpt:
      "Không phải ai cũng biết cách tính tiền điện nước đúng. Chủ trọ nói sao biết vậy? Đây là cách tính chuẩn…",
    thumbnail:
      "https://pt123.cdn.static123.com/images/thumbs/450x300/fit/2025/03/06/cach-tinh-tien-dien-nuoc-tai-phong-tro-_1741246658.jpg",
  },
  {
    category: "Tin tức thị trường",
    title: "Thuê phòng trọ cần những giấy tờ gì?",
    excerpt:
      "Hiện nay, thuê phòng trọ chỉ cần CMND/CCCD bản sao là đủ. Chủ yếu để đăng ký tạm trú…",
    thumbnail:
      "https://pt123.cdn.static123.com/images/thumbs/450x300/fit/2025/02/21/thue-phong-tro-can-nhung-giay-to-gi_1740122970.png",
  },
  {
    category: "Tin tức thị trường",
    title: "Vì sao tiền điện nước trong phòng trọ thường cao hơn?",
    excerpt:
      "Nhiều người thuê trọ từng thắc mắc: “Sao tiền điện nước cao vậy?”. Đâu là lý do thực sự?…",
    thumbnail:
      "https://pt123.cdn.static123.com/images/thumbs/450x300/fit/2025/02/19/vi-sao-tien-dien-nuoc-o-phong-tro-thuong-cao-hon_1739955806.png",
  },
  {
    category: "Tin tức thị trường",
    title: "Tiền cọc phòng trọ để làm gì? Có lấy lại được không?",
    excerpt:
      "Tiền cọc phòng trọ dùng để làm gì? Có lấy lại được không? Đây là những điều người thuê cần biết…",
    thumbnail:
      "https://pt123.cdn.static123.com/images/thumbs/450x300/fit/2025/02/18/tien-coc-phong-tro-de-lam-gi_1739862136.png",
  },
];

const Blog = () => {
  return (
    <>
      <section className="blog-out mb">
        <Back
          name="Tin tức thị trường & Kinh nghiệm"
          title="Tin tức – Chia sẻ kinh nghiệm phòng trọ"
          cover={img}
        />

        <div className="container blog-container">
          <div className="blog-grid">
            {blogPosts.map((post, index) => (
              <div className="blog-card" key={index}>
                <div className="blog-thumb">
                  <img src={post.thumbnail} alt={post.title} />
                  <span className="blog-category">{post.category}</span>
                </div>

                <div className="blog-content">
                  <h3 className="blog-title">{post.title}</h3>
                  <p className="blog-excerpt">{post.excerpt}</p>
                  <button className="blog-readmore">Đọc tiếp</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default Blog;
