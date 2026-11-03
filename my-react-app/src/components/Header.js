import React from "react";
import { FaHome, FaCalendarAlt, FaSpa, FaUsers, FaBell, FaUserCircle } from "react-icons/fa";
import logo from "./logopic.png";
import "./Header.css";

const Header = ({ activeSection, onNavClick, role, user, unreadCount, onLogout }) => {
    const navItems = [
        { text: "Почетна", id: "home", icon: <FaHome /> },
        { text: "Услуги", id: "услуги", icon: <FaSpa /> },
        { text: role === "admin" ? "Термини" : "Закажи термин", shortText: role === "admin" ? "Термини" : "Закажи", id: "termin", icon: <FaCalendarAlt /> },
        { text: "Повеќе за тимот", shortText: "Тим", id: "tim", icon: <FaUsers /> }
    ];

    const displayName = user?.name || user?.email || "";

    return (
        <>
            <header className="bq-header">
                <div className="bq-header-left">
                    <button className="bq-logo-btn" onClick={() => onNavClick("home")} aria-label="Beauty Queen – почетна">
                        <img src={logo} alt="" className="bq-logo" />
                    </button>
                    <nav className="bq-nav">
                        {navItems.map(({ text, id }) => (
                            <a
                                key={id}
                                href={`#${id}`}
                                className={activeSection === id ? "active" : ""}
                                onClick={(e) => {
                                    e.preventDefault();
                                    onNavClick(id);
                                }}
                            >
                                {text}
                            </a>
                        ))}
                    </nav>
                </div>

                <div className="bq-header-right">
                    <button
                        className={`bq-bell ${activeSection === "notifications" ? "active" : ""}`}
                        onClick={() => onNavClick("notifications")}
                        aria-label={unreadCount > 0 ? `Имате ${unreadCount} нови известувања` : "Известувања"}
                        title={unreadCount > 0 ? `Имате ${unreadCount} нови известувања` : "Немате нови известувања"}
                    >
                        <FaBell />
                        {unreadCount > 0 && <span className="bq-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                    </button>

                    <button className="bq-user" onClick={() => onNavClick("profile")} title="Мој профил">
                        <FaUserCircle />
                        <span className="bq-user-name">
                            {displayName}
                            {role === "admin" && <small className="bq-role">Админ</small>}
                        </span>
                    </button>

                    <button className="bq-logout" onClick={onLogout}>Одјава</button>
                </div>
            </header>

            {/* Mobile bottom tab bar */}
            <nav className="bq-tabbar">
                {[...navItems.filter(i => i.id !== "tim"), { text: "Известувања", shortText: "Известувања", id: "notifications", icon: <FaBell /> }, { text: "Профил", id: "profile", icon: <FaUserCircle /> }].map(item => (
                    <button
                        key={item.id}
                        className={activeSection === item.id ? "active" : ""}
                        onClick={() => onNavClick(item.id)}
                    >
                        <span className="bq-tab-icon">
                            {item.icon}
                            {item.id === "notifications" && unreadCount > 0 && (
                                <span className="bq-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
                            )}
                        </span>
                        <span className="bq-tab-label">{item.shortText || item.text}</span>
                    </button>
                ))}
            </nav>
        </>
    );
};

export default Header;
