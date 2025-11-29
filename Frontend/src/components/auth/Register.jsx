import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./auth.css";
import { authAPI } from "../../services/api";
import { toast } from 'react-toastify';
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';
import 'react-toastify/dist/ReactToastify.css';

const Register = () => {
    const navigate = useNavigate();
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [avatar, setAvatar] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);
        
        // Hiển thị thông báo upload nếu có avatar
        if (avatar) {
            setUploadingAvatar(true);
            toast.info("Đang upload ảnh đại diện, vui lòng chờ...");
        }
        
        try {
            const formData = new FormData();
            formData.append("fullName", fullName);
            formData.append("email", email);
            formData.append("phone", phone);
            formData.append("password", password);
            if (avatar) formData.append("avatar", avatar);
            
            const res = await authAPI.register(formData);
            if (res.data && res.data.success) {
                setUploadingAvatar(false);
                toast.success("Đăng ký thành công! Chuyển sang đăng nhập...");
                setTimeout(() => navigate('/login'), 1500);
            } else {
                // Hiển thị từng lỗi dưới dạng toast
                if (res.data?.errors && Array.isArray(res.data.errors)) {
                    res.data.errors.forEach(error => {
                        toast.error(error);
                    });
                } else {
                    toast.error(res.data?.message || "Đăng ký thất bại");
                }
            }
        } catch (err) {
            // Xử lý lỗi từ backend
            if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
                err.response.data.errors.forEach(error => {
                    toast.error(error);
                });
            } else {
                toast.error(err.response?.data?.message || "Đăng ký thất bại");
            }
        } finally {
            setLoading(false);
            setUploadingAvatar(false);
        }
    };

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Kích thước ảnh không được vượt quá 5MB');
                e.target.value = ''; // Clear the input
                return;
            }
            
            // Validate file type
            if (!file.type.startsWith('image/')) {
                toast.error('Vui lòng chọn file hình ảnh');
                e.target.value = ''; // Clear the input
                return;
            }
            
            setAvatar(file);
            setAvatarPreview(URL.createObjectURL(file));
        } else {
            setAvatar(null);
            setAvatarPreview(null);
        }
    };

    return (
        <section className="auth">
            <div className="container">
                <div className="form-box">
                    <h2>Đăng ký</h2>
                    <form onSubmit={handleSubmit} encType="multipart/form-data">
                        <input type="text" placeholder="Họ và tên" value={fullName} onChange={e=>setFullName(e.target.value)} required />
                        <input type="email" placeholder="Email của bạn" value={email} onChange={e=>setEmail(e.target.value)} required />
                        <input type="tel" placeholder="Số điện thoại" value={phone} onChange={e=>setPhone(e.target.value)} required />
                        
                        <div className="password-input-container">
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Mật khẩu"
                                value={password}
                                onChange={e=>setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                            </button>
                        </div>

                        <div className="avatar-upload-box">
                            <input
                                id="avatar-upload"
                                type="file"
                                accept="image/*"
                                onChange={handleAvatarChange}
                                className="avatar-input"
                            />
                            <label htmlFor="avatar-upload" className="avatar-upload-label">
                                Chọn ảnh đại diện
                            </label>
                            {avatarPreview && (
                                <img
                                    src={avatarPreview}
                                    alt="avatar preview"
                                    className="avatar-preview"
                                />
                            )}
                        </div>
                        {error && <div style={{color:'#dc2626',fontSize:'14px',marginBottom:'8px'}}>{error}</div>}
                        {success && <div style={{color:'#16a34a',fontSize:'14px',marginBottom:'8px'}}>{success}</div>}
                        <button type="submit" className="btn-primary-register" disabled={loading}>
                            {uploadingAvatar ? (
                                <>
                                    <i className="fa fa-cloud-upload" style={{marginRight: '8px'}}></i>
                                    Đang upload ảnh...
                                </>
                            ) : loading ? (
                                <>
                                    <i className="fa fa-spinner fa-spin" style={{marginRight: '8px'}}></i>
                                    Đang xử lý...
                                </>
                            ) : 'Tạo tài khoản'}
                        </button>
                    </form>
                    <div className="form-links">
                        <p>Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Register;
