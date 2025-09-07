import React, { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import "./auth.css"
import { authAPI } from "../../services/api"
import { toast } from 'react-toastify'
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai'
import 'react-toastify/dist/ReactToastify.css'

const ForgotPassword = () => {
    const navigate = useNavigate()
    const [step, setStep] = useState(1) // 1: nhập email, 2: nhập OTP và mật khẩu mới
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    
    // Form data
    const [formData, setFormData] = useState({
        email: '',
        otp: '',
        newPassword: ''
    })

    const handleInputChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))
    }

    // Gửi OTP
    const handleSendOTP = async (e) => {
        e.preventDefault()
        
        if (!formData.email) {
            toast.error('Vui lòng nhập email')
            return
        }

        setLoading(true)
        try {
            const response = await authAPI.sendOTP(formData.email)
            
            if (response.data && response.data.success) {
                toast.success('Mã OTP đã được gửi đến email của bạn!')
                setStep(2)
            } else {
                toast.error(response.data?.message || 'Gửi OTP thất bại')
            }
        } catch (error) {
            console.error('Send OTP error:', error)
            if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
                error.response.data.errors.forEach(err => {
                    toast.error(err)
                })
            } else {
                toast.error(error.response?.data?.message || 'Gửi OTP thất bại')
            }
        } finally {
            setLoading(false)
        }
    }

    // Đặt lại mật khẩu
    const handleResetPassword = async (e) => {
        e.preventDefault()
        
        if (!formData.otp || !formData.newPassword) {
            toast.error('Vui lòng nhập đầy đủ thông tin')
            return
        }

        setLoading(true)
        try {
            const response = await authAPI.resetPasswordWithOTP(formData.email, formData.otp, formData.newPassword)
            
            if (response.data && response.data.success) {
                toast.success('Đặt lại mật khẩu thành công! Chuyển sang đăng nhập...')
                setTimeout(() => {
                    navigate('/login')
                }, 2000)
            } else {
                if (response.data?.errors && Array.isArray(response.data.errors)) {
                    response.data.errors.forEach(error => {
                        toast.error(error)
                    })
                } else {
                    toast.error(response.data?.message || 'Đặt lại mật khẩu thất bại')
                }
            }
        } catch (error) {
            console.error('Reset password error:', error)
            if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
                error.response.data.errors.forEach(err => {
                    toast.error(err)
                })
            } else {
                toast.error(error.response?.data?.message || 'Đặt lại mật khẩu thất bại')
            }
        } finally {
            setLoading(false)
        }
    }

    const handleBackToStep1 = () => {
        setStep(1)
        setFormData(prev => ({
            ...prev,
            otp: '',
            newPassword: ''
        }))
    }

    return (
        <section className="auth">
            <div className="container">
                <div className="form-box modern-card">
                    <h2>Khôi phục mật khẩu</h2>
                    
                    {step === 1 ? (
                        <form onSubmit={handleSendOTP}>
                            <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
                                Nhập email của bạn để nhận mã OTP khôi phục mật khẩu
                            </p>
                            <input 
                                type="email" 
                                name="email"
                                placeholder="Email của bạn" 
                                value={formData.email}
                                onChange={handleInputChange}
                                required 
                            />
                            <button 
                                type="submit" 
                                className="btn-primary-otp" 
                                disabled={loading}
                            >
                                {loading ? 'Đang gửi...' : 'Gửi mã OTP'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleResetPassword}>
                            <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
                                Mã OTP đã được gửi đến: <strong>{formData.email}</strong>
                            </p>
                            
                            <input 
                                type="text" 
                                name="otp"
                                placeholder="Nhập mã OTP (6 chữ số)" 
                                value={formData.otp}
                                onChange={handleInputChange}
                                maxLength="6"
                                pattern="\d{6}"
                                required 
                            />
                            
                            <div className="password-input-container">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="newPassword"
                                    placeholder="Mật khẩu mới"
                                    value={formData.newPassword}
                                    onChange={handleInputChange}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                                </button>
                            </div>
                            
                            <button 
                                type="submit" 
                                className="btn-primary-otp" 
                                disabled={loading}
                            >
                                {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
                            </button>
                            
                            <button 
                                type="button" 
                                onClick={handleBackToStep1}
                                style={{ 
                                    marginTop: '10px', 
                                    backgroundColor: '#6c757d', 
                                    border: 'none' 
                                }}
                                className="btn-primary-otp"
                            >
                                Quay lại
                            </button>
                        </form>
                    )}
                    
                    <div className="form-links">
                        <p>Đã nhớ mật khẩu? <Link to="/login">Đăng nhập</Link></p>
                        <p>Chưa có tài khoản? <Link to="/register">Đăng ký</Link></p>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default ForgotPassword
