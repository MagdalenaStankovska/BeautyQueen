import React, { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import api, { errorMessage } from "../api";
import "./LoginRegister.css";
import logo from "./logopic.png";

const LoginRegister = ({ onLogin }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);

    const login = async (loginEmail, loginPassword) => {
        const { data } = await api.post("/login", { email: loginEmail, password: loginPassword });
        const { token, ...user } = data;
        onLogin(token, user);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (isLogin) {
                await login(email, password);
            } else {
                await api.post("/register", { email, password, name, phone });
                // sign the new client straight in
                await login(email, password);
            }
        } catch (error) {
            setMessage({ type: "error", text: errorMessage(error) });
        } finally {
            setLoading(false);
        }
    };

    const switchMode = () => {
        setIsLogin(!isLogin);
        setMessage(null);
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-title-wrapper">
                    <img src={logo} alt="BeautyQueen Logo" className="login-logo" />
                </div>

                <h2 className="login-title">{isLogin ? "Најава" : "Регистрација"}</h2>

                <form onSubmit={handleSubmit}>
                    {!isLogin && (
                        <>
                            <input
                                type="text"
                                placeholder="Име и презиме"
                                value={name}
                                required
                                autoComplete="name"
                                onChange={(e) => setName(e.target.value)}
                                className="login-input"
                            />
                            <input
                                type="tel"
                                placeholder="Телефон"
                                value={phone}
                                required
                                autoComplete="tel"
                                onChange={(e) => setPhone(e.target.value)}
                                className="login-input"
                            />
                        </>
                    )}

                    <input
                        type="email"
                        placeholder="Е-пошта"
                        value={email}
                        required
                        autoComplete="email"
                        onChange={(e) => setEmail(e.target.value)}
                        className="login-input"
                    />

                    <div className="password-wrapper">
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder={isLogin ? "Лозинка" : "Лозинка (мин. 6 карактери)"}
                            value={password}
                            required
                            minLength={isLogin ? undefined : 6}
                            autoComplete={isLogin ? "current-password" : "new-password"}
                            onChange={(e) => setPassword(e.target.value)}
                            className="login-input"
                        />

                        <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="toggle-password"
                            aria-label={showPassword ? "Сокриј лозинка" : "Прикажи лозинка"}
                        >
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>

                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? "Се обработува…" : isLogin ? "Најави се" : "Регистрирај се"}
                    </button>
                </form>

                <p className="toggle-text">
                    {isLogin ? "Немате корисничка сметка?" : "Веќе имате сметка?"}{" "}
                    <button type="button" onClick={switchMode} className="toggle-link">
                        {isLogin ? "Регистрирај се" : "Најави се"}
                    </button>
                </p>

                {message && <p className={`message ${message.type}`}>{message.text}</p>}
            </div>
        </div>
    );
};

export default LoginRegister;
