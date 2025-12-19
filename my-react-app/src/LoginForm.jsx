import React, { useState } from "react";
import { auth } from "./firebase";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
} from "firebase/auth";
import "./components/LoginRegister.css";

const LoginForm = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLogin, setIsLogin] = useState(true);

    const handleAuth = async () => {
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
                alert("Успешна најава!");
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
                alert("Успешна регистрација!");
            }
        } catch (error) {
            alert("Грешка: " + error.message);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h2 className="login-title">{isLogin ? "Најава" : "Регистрација"}</h2>

                <input
                    type="email"
                    placeholder="Е-пошта"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="login-input"
                />

                <input
                    type="password"
                    placeholder="Лозинка"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="login-input"
                />

                <button onClick={handleAuth} className="login-button">
                    {isLogin ? "Најави се" : "Регистрирај се"}
                </button>

                <p className="toggle-text" onClick={() => setIsLogin(!isLogin)}>
                    {isLogin
                        ? "Немате корисничка сметка? Регистрирај се"
                        : "Веќе имате сметка? Најави се"}
                </p>
            </div>
        </div>
    );
};

export default LoginForm;
