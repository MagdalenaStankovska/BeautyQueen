import React, { useEffect, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import api, { errorMessage } from "../api";
import { salon } from "../salon";
import "./LoginRegister.css";
import logo from "./logopic.png";

// Screens: login | register | verify (code after registering) | forgot | reset (code + new password)
const TITLES = {
    login: "Најава",
    register: "Регистрација",
    verify: "Потврдете ја сметката",
    forgot: "Заборавена лозинка",
    reset: "Нова лозинка"
};

const PasswordInput = ({ value, onChange, placeholder, autoComplete, minLength }) => {
    const [show, setShow] = useState(false);
    return (
        <div className="password-wrapper">
            <input
                type={show ? "text" : "password"}
                placeholder={placeholder}
                value={value}
                required
                minLength={minLength}
                autoComplete={autoComplete}
                onChange={(e) => onChange(e.target.value)}
                className="login-input"
            />
            <button
                type="button"
                onClick={() => setShow((prev) => !prev)}
                className="toggle-password"
                aria-label={show ? "Сокриј лозинка" : "Прикажи лозинка"}
            >
                {show ? <FaEyeSlash /> : <FaEye />}
            </button>
        </div>
    );
};

const LoginRegister = ({ onLogin }) => {
    const [screen, setScreen] = useState("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [channel, setChannel] = useState("email");
    const [code, setCode] = useState("");
    const [sent, setSent] = useState(null); // { channel, destination, devCode }
    const [cooldown, setCooldown] = useState(0);
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);

    const channels = salon().verification || { email: true, sms: false };
    // fall back to whatever the server actually offers
    const activeChannel = channels[channel] ? channel : channels.email ? "email" : "sms";

    useEffect(() => {
        if (cooldown <= 0) return undefined;
        const t = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const go = (next) => {
        setScreen(next);
        setMessage(null);
        setCode("");
    };

    const codeSent = (data, next) => {
        setSent(data);
        setCooldown(data.resendAfter || 60);
        go(next);
    };

    const run = async (fn) => {
        setLoading(true);
        setMessage(null);
        try {
            await fn();
        } catch (error) {
            const retry = error?.response?.data?.retryAfter;
            if (retry) setCooldown(retry);
            setMessage({ type: "error", text: errorMessage(error) });
        } finally {
            setLoading(false);
        }
    };

    const signIn = (data) => {
        const { token, ...user } = data;
        onLogin(token, user);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        run(async () => {
            if (screen === "login") {
                const { data } = await api.post("/login", { email, password });
                signIn(data);
            } else if (screen === "register") {
                const { data } = await api.post("/register", { email, password, name, phone, channel: activeChannel });
                codeSent(data, "verify");
            } else if (screen === "verify") {
                const { data } = await api.post("/register/verify", { email, code });
                signIn(data);
            } else if (screen === "forgot") {
                const { data } = await api.post("/password/forgot", { email, channel: activeChannel });
                codeSent(data, "reset");
            } else if (screen === "reset") {
                const { data } = await api.post("/password/reset", { email, code, newPassword: password });
                signIn(data);
            }
        });
    };

    const resend = () => run(async () => {
        const { data } = screen === "verify"
            ? await api.post("/register/resend", { email })
            : await api.post("/password/forgot", { email, channel: activeChannel });
        setSent(data);
        setCooldown(data.resendAfter || 60);
        setMessage({ type: "success", text: "Испратен е нов код." });
    });

    const channelPicker = channels.sms && channels.email && (
        <fieldset className="channel-picker">
            <legend>Потврда преку</legend>
            <label className={channel === "email" ? "active" : ""}>
                <input type="radio" name="channel" value="email" checked={channel === "email"} onChange={() => setChannel("email")} />
                ✉️ Е-пошта
            </label>
            <label className={channel === "sms" ? "active" : ""}>
                <input type="radio" name="channel" value="sms" checked={channel === "sms"} onChange={() => setChannel("sms")} />
                📱 SMS
            </label>
        </fieldset>
    );

    const isCodeScreen = screen === "verify" || screen === "reset";

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-title-wrapper">
                    <img src={logo} alt="BeautyQueen Logo" className="login-logo" />
                </div>

                <h2 className="login-title">{TITLES[screen]}</h2>

                {isCodeScreen && sent && (
                    <p className="code-info">
                        Испративме 6-цифрен код {sent.channel === "sms" ? "во SMS на" : "на"} <strong>{sent.destination}</strong>.
                        {sent.channel === "email" && " Проверете го и Spam/Promotions фолдерот."}
                    </p>
                )}
                {isCodeScreen && sent?.devCode && (
                    <p className="dev-code" role="note">Развоен режим (нема SMTP): кодот е <strong>{sent.devCode}</strong></p>
                )}

                <form onSubmit={handleSubmit}>
                    {screen === "register" && (
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
                                placeholder="Телефон (пр. 070 123 456)"
                                value={phone}
                                required
                                autoComplete="tel"
                                onChange={(e) => setPhone(e.target.value)}
                                className="login-input"
                            />
                        </>
                    )}

                    {!isCodeScreen && (
                        <input
                            type="email"
                            placeholder="Е-пошта"
                            value={email}
                            required
                            autoComplete="email"
                            onChange={(e) => setEmail(e.target.value)}
                            className="login-input"
                        />
                    )}

                    {isCodeScreen && (
                        <input
                            className="login-input code-input"
                            placeholder="••••••"
                            aria-label="Код за потврда"
                            value={code}
                            required
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            pattern="\d{6}"
                            maxLength={6}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                            autoFocus
                        />
                    )}

                    {(screen === "login" || screen === "register" || screen === "reset") && (
                        <PasswordInput
                            value={password}
                            onChange={setPassword}
                            placeholder={screen === "login" ? "Лозинка" : screen === "reset" ? "Нова лозинка (мин. 6 карактери)" : "Лозинка (мин. 6 карактери)"}
                            autoComplete={screen === "login" ? "current-password" : "new-password"}
                            minLength={screen === "login" ? undefined : 6}
                        />
                    )}

                    {(screen === "register" || screen === "forgot") && channelPicker}

                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? "Се обработува…" : {
                            login: "Најави се",
                            register: "Регистрирај се",
                            verify: "Потврди",
                            forgot: "Испрати код",
                            reset: "Зачувај нова лозинка"
                        }[screen]}
                    </button>
                </form>

                {isCodeScreen && (
                    <p className="toggle-text">
                        Не добивте код?{" "}
                        <button type="button" className="toggle-link" onClick={resend} disabled={cooldown > 0 || loading}>
                            {cooldown > 0 ? `Испрати повторно за ${cooldown}s` : "Испрати повторно"}
                        </button>
                    </p>
                )}

                {screen === "login" && (
                    <p className="toggle-text">
                        <button type="button" onClick={() => go("forgot")} className="toggle-link">Заборавена лозинка?</button>
                    </p>
                )}

                <p className="toggle-text">
                    {screen === "login" ? "Немате корисничка сметка?" : screen === "register" ? "Веќе имате сметка?" : ""}{" "}
                    <button
                        type="button"
                        onClick={() => go(screen === "login" ? "register" : screen === "verify" ? "register" : "login")}
                        className="toggle-link"
                    >
                        {screen === "login" ? "Регистрирај се" : screen === "verify" ? "Назад (промени податоци)" : screen === "register" ? "Најави се" : "Назад кон најава"}
                    </button>
                </p>

                {message && <p className={`message ${message.type}`}>{message.text}</p>}
            </div>
        </div>
    );
};

export default LoginRegister;
