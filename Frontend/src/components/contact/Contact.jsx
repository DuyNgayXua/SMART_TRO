import React from "react";
import img from "../images/pricing.jpg";
import "./contact.css";
import { FaMapMarkerAlt, FaPhoneAlt, FaEnvelope } from "react-icons/fa";

const Contact = () => {
  return (
    <>
      <section className='contact-section mb'>
      <div className="title-contact">
        <h1>HỖ TRỢ NHANH CHÓNG VÀ THÂN THIỆN</h1>
      </div>

        <div className='container-contact contact-wrapper'>
          {/* LEFT INFO CARD */}
          <div className='contact-info-card'>
            <h2>Thông tin liên hệ</h2>

            <div className='info-item'>
              <FaMapMarkerAlt className='info-icon' />
              <p>
                <strong>Địa chỉ:</strong><br />
                566/80/43 Nguyễn Thái Sơn,<br />
                Phường An Nhơn, Quận Gò Vấp, TP.HCM
              </p>
            </div>

            <div className='info-item'>
              <FaPhoneAlt className='info-icon' />
              <p>
                <strong>SĐT / ZALO:</strong><br />
                <a href='tel:0355958399'>0355958399</a>
              </p>
            </div>

            <div className='info-item'>
              <FaEnvelope className='info-icon' />
              <p>
                <strong>Email:</strong><br />
                <a href='mailto:cskh.smarttro@gmail.com'>
                  cskh.smarttro@gmail.com
                </a>
              </p>
            </div>
          </div>

          {/* RIGHT FORM */}
          <form className='contact-form shadow'>
            <h3>Gửi yêu cầu hỗ trợ</h3>
            <p>Chúng tôi sẽ phản hồi sớm nhất có thể!</p>

            <div className='form-row'>
              <input type='text' placeholder='Họ và tên' required />
              <input type='email' placeholder='Email' required />
            </div>

            <input type='text' placeholder='Tiêu đề' required />

            <textarea placeholder='Nhập nội dung tin nhắn...' rows='6' required></textarea>

            <button type='submit' className='contact-btn-support'>Gửi yêu cầu</button>
          </form>
        </div>
      </section>
    </>
  );
};

export default Contact;
