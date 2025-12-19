import React, { useState } from "react";
import axios from "axios";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "./LoginRegister.css";
import logo from "./logopic.png";

const LoginRegister = ({ onLogin }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [message, setMessage] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        const endpoint = isLogin ? "/login" : "/register";

        try {
            const response = await axios.post(`http://localhost:4000${endpoint}`, {
                email,
                password,
            });

            if (isLogin) {
                const { token, role, email: userEmail } = response.data;
                localStorage.setItem("token", token);
                localStorage.setItem("role", role);
                onLogin(token, { email: userEmail, role });
                setMessage("Успешна најава");
            } else {
                setMessage("Успешна регистрација");
            }

            setEmail("");
            setPassword("");
        } catch (error) {
            setMessage(error.response?.data?.message || "Настана грешка");
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-title-wrapper">
                        <img src={logo} alt="BeautyQueen Logo" className="login-logo"/>
                </div>
                    <div>
                        <h2 className="login-title">{isLogin ? "Најава" : "Регистрација"}</h2>
                    </div>


                <form onSubmit={handleSubmit}>
                <input
                        type="email"
                        placeholder="Е-пошта"
                        value={email}
                        required
                        onChange={(e) => setEmail(e.target.value)}
                        className="login-input"
                    />

                    <div className="password-wrapper">
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Лозинка"
                            value={password}
                            required
                            onChange={(e) => setPassword(e.target.value)}
                            className="login-input"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="toggle-password"
                        >
                            {showPassword ? <FaEyeSlash/> : <FaEye/>}
                        </button>
                    </div>

                    <button type="submit" className="login-button">
                        {isLogin ? "Најави се" : "Регистрирај се"}
                    </button>
                </form>

                <p className="toggle-text">
                    {isLogin ? "Немате корисничка сметка?" : "Веќе имате сметка?"}{" "}
                    <span onClick={() => setIsLogin(!isLogin)} className="toggle-link">
            {isLogin ? "Регистрирај се" : "Најави се"}
          </span>
                </p>

                {message && (
                    <p
                        className={`message ${
                            message.toLowerCase().includes("успешна") ? "success" : "error"
                        }`}
                    >
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
};

export default LoginRegister;
