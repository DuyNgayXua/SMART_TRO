import React, { useState } from "react"
import "./auth.css"

const ForgotPassword = () => {
    const [sent, setSent] = useState(false)

    return (
        <section className="auth">
            <div className="container">
                <div className="form-box">
                    <h2>Khôi phục mật khẩu</h2>
                    <form>
                        {!sent ? (
                            <>
                                <input type="email" placeholder="Email của bạn" required />
                                <button type="button" className="btn-primary" onClick={() => setSent(true)}>
                                    Gửi mã OTP
                                </button>
                            </>
                        ) : (
                            <>
                                <input type="text" placeholder="Nhập mã OTP" required />
                                <input type="password" placeholder="Mật khẩu mới" required />
                                <button type="submit" className="btn-primary">Đặt lại mật khẩu</button>
                            </>
                        )}
                    </form>
                </div>
            </div>
        </section>
    )
}

export default ForgotPassword
