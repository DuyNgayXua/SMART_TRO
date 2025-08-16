import React from "react"
import { Link } from "react-router-dom"
import "./auth.css"

const Login = () => {
    return (
        <section className="auth">
            <div className="container">
                <div className="form-box">
                    <h2>Đăng nhập</h2>
                    <form>
                        <input type="email" placeholder="Email của bạn" required />
                        <input type="password" placeholder="Mật khẩu" required />
                        <button type="submit" className="btn-primary">Đăng nhập</button>
                    </form>
                    <div className="form-links">
                        <p>Bạn chưa có tài khoản? <Link to="/register">Đăng ký</Link></p>
                        <p><Link to="/forgot-password">Quên mật khẩu?</Link></p>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default Login
