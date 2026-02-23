import React, { useState, useEffect } from "react";

import logo from "./logopic.png";

const Header = ({ onNavClick, role, token, onLogin, onLogout }) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [formData, setFormData] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const [userEmail, setUserEmail] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [notifOpen, setNotifOpen] = useState(false);
// 🟢 ADDED – count only unread
    const unreadCount = notifications.filter(n => !n.isRead).length;

    // 🟢 ADDED
    const [showTooltip, setShowTooltip] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const fetchNotifications = async () => {
        if (!token) return;

        try {
            const res = await fetch("/notifications", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setNotifications(data);
        } catch (e) {
            console.error("Notification fetch error", e);
        }
    };
    // 🟢 ADDED – mark all as read
    const markNotificationsAsRead = async () => {
        try {
            await fetch("/notifications/read", {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            // локално ги маркираме како прочитани
            setNotifications(prev =>
                prev.map(n => ({ ...n, isRead: true }))
            );
        } catch (e) {
            console.error("Mark as read error", e);
        }
    };


    const validate = () => {
        if (!formData.email || !formData.password) {
            setError("Please enter email and password.");
            return false;
        }
        setError("");
        return true;
    };

    const register = async () => {
        if (!validate()) return;

        try {
            const response = await fetch("/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const err = await response.json();
                setError(err.message || "Registration failed");
                return;
            }

            alert("Registration successful! You can now login.");
            setIsRegistering(false);
            setFormData({ email: "", password: "" });
        } catch {
            setError("Network error");
        }
    };

    const login = async () => {
        if (!validate()) return;

        try {
            const response = await fetch("/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const err = await response.json();
                setError(err.message || "Login failed");
                return;
            }

            const data = await response.json();

            setUserEmail(data.email);

            if (onLogin) {
                onLogin(data.token, { email: data.email, role: data.role });
            }

            setFormData({ email: "", password: "" });
            setModalOpen(false);
        } catch {
            setError("Network error");
        }
    };

    const logout = () => {
        setUserEmail(null);
        setError("");
        if (onLogout) {
            onLogout();
        }
    };

    const navItems = [
        { text: "Услуги", id: "услуги" },
        { text: "Закажи термин", id: "termin" },
        { text: "Повеќе за тимот", id: "tim" },
        ...(role === "admin" ? [{ text: "", id: "adminpanel" }] : []),
    ];

    const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Poiret+One&display=swap');

    nav a {
      color: palevioletred;
      font-family: 'Poiret One', sans-serif;
      text-decoration: none;
      cursor: pointer;
      padding: 6px 12px;
      border-radius: 8px;
      transition: all 0.3s ease;
    }

    nav a:hover {
      background-color: palevioletred;
      color: white;
    }

    button,
    input,
    span,
    h2 {
      font-family: 'Poiret One', sans-serif;
    }
  `;

    const isLoggedIn = Boolean(token);
    useEffect(() => {
        if (token) {
            fetchNotifications();
        }
    }, [token]);

    return (
        <>
            <style>{styles}</style>

            <header
                style={{
                    backgroundColor: "pink",
                    color: "palevioletred",
                    padding: "10px 40px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    height: "80px",
                    boxSizing: "border-box",
                }}
            >
                <div style={{display: "flex", alignItems: "center", gap: "40px"}}>
                    <img
                        src={logo}
                        alt="Beauty Queen Logo"
                        style={{height: "160px", width: "auto", cursor: "pointer", marginTop: "90px"}}
                        onClick={() => onNavClick && onNavClick("home")}
                    />
                    <nav style={{display: "flex", gap: "30px", fontSize: "23px", fontWeight: "bold"}}>
                        {navItems.map(({text, id}) => (
                            <a
                                key={id}
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (onNavClick) onNavClick(id);
                                }}
                            >
                                {text}
                            </a>
                        ))}
                    </nav>
                </div>

                <div>
                    {isLoggedIn ? (
                        <div style={{display: "flex", alignItems: "center", gap: "15px"}}>
                            <div
                                style={{position: "relative", cursor: "pointer"}}
                                onMouseEnter={() => setShowTooltip(true)}   // 🟢 ADDED
                                onMouseLeave={() => setShowTooltip(false)}  // 🟢 ADDED
                                onClick={() => {
                                    markNotificationsAsRead();     // 🟢 ADDED
                                    onNavClick("notifications");
                                }}
                                // 🟢 ADDED
                            >
                                🔔
                                {unreadCount > 0 && (   // 🔁 CHANGED

                                    <span style={{
                                        position: "absolute",
                                        top: "-6px",
                                        right: "-6px",
                                        background: "red",
                                        color: "white",
                                        borderRadius: "50%",
                                        fontSize: "12px",
                                        padding: "2px 6px"
                                    }}>
                                        {unreadCount}
                                    </span>
                                )}

                                {showTooltip && (
                                    <div style={{
                                        position: "absolute",
                                        top: "28px",
                                        right: "-40px",
                                        background: "white",
                                        padding: "6px 10px",
                                        borderRadius: "8px",
                                        fontSize: "12px",
                                        boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                                        whiteSpace: "nowrap",
                                        zIndex: 3000
                                    }}>
                                        {unreadCount > 0
                                            ? `Имате ${unreadCount} нови известувања`
                                            : "Немате нови известувања"}

                                    </div>
                                )}
                            </div>

                            <span>Welcome, {userEmail}</span>
                            <button
                                onClick={logout}
                                style={{
                                    backgroundColor: "palevioletred",
                                    color: "white",
                                    fontSize: "16px",
                                    padding: "8px 16px",
                                    border: "none",
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                }}
                            >
                                Logout
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setModalOpen(true)}
                            style={{
                                backgroundColor: "palevioletred",
                                color: "white",
                                fontSize: "16px",
                                padding: "8px 20px",
                                border: "none",
                                borderRadius: "8px",
                                cursor: "pointer",
                            }}
                        >
                            Account
                        </button>
                    )}
                </div>
            </header>

            {/* ⛔️ СÈ ОД ТУКА НАДОЛУ Е ИСТО – НЕ Е МЕНУВАНО */}
            {/* modal / register / login / backdrop */}

            {notifOpen && (
                <div style={{
                    position: "absolute",
                    top: "80px",
                    right: "40px",
                    width: "300px",
                    background: "white",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                    padding: "12px",
                    zIndex: 2000
                }}>
                    <h4>Notifications</h4>

                    {notifications.length === 0 ? (
                        <p>Нема известувања</p>
                    ) : (
                        notifications.map(n => (
                            <div key={n.id} style={{
                                padding: "8px",
                                borderBottom: "1px solid #eee"
                            }}>
                                {n.message}
                            </div>
                        ))
                    )}
                </div>
            )}


            {modalOpen && (
                <div
                    onClick={() => {
                        setModalOpen(false);
                        setError("");
                        setFormData({ email: "", password: "" });
                        setIsRegistering(false);
                    }}
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100vw",
                        height: "100vh",
                        backgroundColor: "rgba(0,0,0,0.5)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 1000,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: "white",
                            padding: "30px",
                            borderRadius: "12px",
                            width: "320px",
                            boxSizing: "border-box",
                            boxShadow: "0 0 10px rgba(0,0,0,0.25)",
                        }}
                    >
                        <h2 style={{ marginTop: 0, color: "palevioletred", textAlign: "center" }}>
                            {isRegistering ? "Sign Up" : "Login"}
                        </h2>

                        <input
                            type="email"
                            name="email"
                            placeholder="Email"
                            value={formData.email}
                            onChange={handleChange}
                            style={{
                                width: "100%",
                                padding: "10px",
                                marginBottom: "15px",
                                fontSize: "16px",
                                boxSizing: "border-box",
                            }}
                        />
                        <input
                            type="password"
                            name="password"
                            placeholder="Password"
                            value={formData.password}
                            onChange={handleChange}
                            style={{
                                width: "100%",
                                padding: "10px",
                                marginBottom: "15px",
                                fontSize: "16px",
                                boxSizing: "border-box",
                            }}
                        />

                        {error && (
                            <div style={{ color: "red", marginBottom: "15px", textAlign: "center" }}>
                                {error}
                            </div>
                        )}

                        <button
                            onClick={isRegistering ? register : login}
                            style={{
                                width: "100%",
                                backgroundColor: "palevioletred",
                                color: "white",
                                fontSize: "16px",
                                padding: "10px",
                                border: "none",
                                borderRadius: "8px",
                                cursor: "pointer",
                                marginBottom: "15px",
                            }}
                        >
                            {isRegistering ? "Sign Up" : "Login"}
                        </button>

                        <div style={{ textAlign: "center" }}>
                            <button
                                onClick={() => {
                                    setIsRegistering(!isRegistering);
                                    setError("");
                                }}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "palevioletred",
                                    cursor: "pointer",
                                    fontSize: "14px",
                                    textDecoration: "underline",
                                }}
                            >
                                {isRegistering ? "Already have an account? Login" : "Don't have an account? Sign Up"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Header;
