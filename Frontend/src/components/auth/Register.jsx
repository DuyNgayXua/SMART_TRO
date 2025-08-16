import React from "react"
import { Link } from "react-router-dom"
import "./auth.css"

const Register = () => {
    return (
        <section className="auth">
            <div className="container">
                <div className="form-box">
                    <h2>Đăng ký</h2>
                    <form>
                        <input type="text" placeholder="Họ và tên" required />
                        <input type="email" placeholder="Email của bạn" required />
                        <input type="password" placeholder="Mật khẩu" required />
                        <button type="submit" className="btn-primary">Tạo tài khoản</button>
                    </form>
                    <div className="form-links">
                        <p>Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default Register
