import React, { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";
import Header from "./components/Header";
import Services from "./components/Services";
import LoginRegister from "./components/LoginRegister";
import Calendar from "./components/Calendar";
import Home from "./components/Home";
import AboutUs from "./components/AboutUs";
import Notifications from "./components/Notifications";
import Profile from "./components/Profile";
import api, { setUnauthorizedHandler } from "./api";
import { API_URL } from "./config";
import { disablePush, enablePush, isPushEnabled, pushSupported, registerServiceWorker } from "./push";
import { applyConfig } from "./salon";

const SECTIONS = ["home", "termin", "услуги", "tim", "notifications", "profile"];

const readSection = () => {
    const hash = decodeURIComponent(window.location.hash.replace("#", ""));
    const fromQuery = new URLSearchParams(window.location.search).get("section");
    if (SECTIONS.includes(hash)) return hash;
    if (SECTIONS.includes(fromQuery)) return fromQuery;
    return "home";
};

const loadUser = () => {
    try {
        return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
        return null;
    }
};

const playTone = () => {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(920, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
        osc.start();
        osc.stop(ctx.currentTime + 0.55);
    } catch {
        // autoplay policy may block audio until the user interacts
    }
};

function App() {
    const [token, setToken] = useState(localStorage.getItem("token"));
    const [user, setUser] = useState(loadUser);
    const [activeSection, setActiveSection] = useState(readSection);
    const [notifications, setNotifications] = useState([]);
    const [toasts, setToasts] = useState([]);
    const [syncTick, setSyncTick] = useState(0);
    const [galleryTick, setGalleryTick] = useState(0);
    const [connected, setConnected] = useState(true);
    const [pushEnabled, setPushEnabled] = useState(false);
    const [pushPromptDismissed, setPushPromptDismissed] = useState(
        () => localStorage.getItem("pushPromptDismissed") === "1"
    );
    const pushEnabledRef = useRef(false);
    const [, setConfigVersion] = useState(0);

    const role = user?.role || null;

    // Salon hours/services/staff come from the backend; built-in defaults are used until it responds.
    useEffect(() => {
        api.get("/config")
            .then(({ data }) => {
                applyConfig(data);
                setConfigVersion(v => v + 1);
            })
            .catch(() => {});
    }, []);

    const navigate = useCallback((section) => {
        const next = SECTIONS.includes(section) ? section : "home";
        if (window.location.hash !== `#${next}`) window.location.hash = next;
        setActiveSection(next);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, []);

    useEffect(() => {
        const onHash = () => setActiveSection(readSection());
        window.addEventListener("hashchange", onHash);
        return () => window.removeEventListener("hashchange", onHash);
    }, []);

    const showToast = useCallback((toast) => {
        const id = `${Date.now()}-${Math.random()}`;
        setToasts(prev => [...prev.slice(-3), { id, ...toast }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), toast.duration || 6000);
    }, []);

    const handleLogin = (newToken, userData) => {
        localStorage.setItem("token", newToken);
        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.removeItem("role");
        setToken(newToken);
        setUser(userData);
        navigate("home");
    };

    const loggingOutRef = useRef(false);
    const handleLogout = useCallback(async (silent = false) => {
        if (loggingOutRef.current) return;
        loggingOutRef.current = true;
        // With an expired session the server call would fail anyway; the subscription is re-bound on next login.
        if (silent !== true) await disablePush().catch(() => {});
        loggingOutRef.current = false;
        if (!localStorage.getItem("token")) return;
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("role");
        setToken(null);
        setUser(null);
        setNotifications([]);
        setPushEnabled(false);
        window.location.hash = "";
        setActiveSection("home");
        if (silent === true) {
            showToast({ type: "error", title: "Сесијата истече", message: "Ве молиме најавете се повторно." });
        }
    }, [showToast]);

    useEffect(() => {
        setUnauthorizedHandler(() => handleLogout(true));
    }, [handleLogout]);

    // Old sessions only stored token+role — fetch the profile so the header can greet the user.
    useEffect(() => {
        if (!token) return;
        api.get("/me")
            .then(({ data }) => {
                setUser(data);
                localStorage.setItem("user", JSON.stringify(data));
            })
            .catch(() => {});
    }, [token]);

    const fetchNotifications = useCallback(async () => {
        try {
            const { data } = await api.get("/notifications");
            setNotifications(data);
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        }
    }, []);

    useEffect(() => {
        if (token) fetchNotifications();
    }, [token, fetchNotifications]);

    useEffect(() => {
        registerServiceWorker().then(() => isPushEnabled()).then((enabled) => {
            setPushEnabled(enabled);
            pushEnabledRef.current = enabled;
        });

        const onMessage = (event) => {
            if (event.data?.type === "open-section") navigate(event.data.section);
        };
        navigator.serviceWorker?.addEventListener("message", onMessage);
        return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
    }, [navigate, token]);

    // Re-subscribe on every login so this device's push subscription is tied to the current account.
    useEffect(() => {
        if (token && pushSupported() && Notification.permission === "granted") {
            enablePush()
                .then((result) => {
                    const enabled = result === "granted";
                    setPushEnabled(enabled);
                    pushEnabledRef.current = enabled;
                })
                .catch(() => {});
        }
    }, [token]);

    /* ---------- realtime ---------- */
    useEffect(() => {
        if (!token) return;

        const socket = io(API_URL, { auth: { token }, transports: ["websocket", "polling"] });

        socket.on("connect", () => {
            setConnected(true);
            // catch up on anything missed while disconnected
            fetchNotifications();
            setSyncTick(t => t + 1);
        });
        socket.on("disconnect", () => setConnected(false));
        socket.on("connect_error", (err) => {
            setConnected(false);
            if (err.message === "unauthorized") handleLogout(true);
        });

        socket.on("notification:new", (n) => {
            setNotifications(prev => [n, ...prev.filter(p => p.id !== n.id)]);
            showToast({ type: n.type, title: n.title, message: n.message });
            if (n.type === "reminder" || n.type === "request") {
                playTone();
                navigator.vibrate?.([220, 120, 220]);
            }
            // If push isn't set up, still surface a system notification when the tab is in the background.
            if (document.hidden && !pushEnabledRef.current && "Notification" in window && Notification.permission === "granted") {
                new Notification(n.title || "Beauty Queen", { body: n.message, icon: "/logo192.png" });
            }
        });

        socket.on("appointment:changed", () => setSyncTick(t => t + 1));
        socket.on("availability:changed", () => setSyncTick(t => t + 1));
        socket.on("gallery:changed", () => setGalleryTick(t => t + 1));

        return () => socket.disconnect();
    }, [token, fetchNotifications, showToast, handleLogout]);

    /* ---------- notifications actions ---------- */
    const markAsRead = async (id) => {
        setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)));
        try {
            await api.patch(`/notifications/${id}/read`);
        } catch (err) {
            console.error("Read error", err);
        }
    };

    const markAllAsRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        try {
            await api.patch("/notifications/read-all");
        } catch (err) {
            console.error("Mark all read error", err);
        }
    };

    const clearNotifications = async () => {
        setNotifications([]);
        try {
            await api.delete("/notifications");
        } catch (err) {
            console.error("Clear error", err);
        }
    };

    const togglePush = async () => {
        try {
            if (pushEnabled) {
                await disablePush();
                setPushEnabled(false);
                pushEnabledRef.current = false;
                return;
            }
            const result = await enablePush();
            const enabled = result === "granted";
            setPushEnabled(enabled);
            pushEnabledRef.current = enabled;
            if (enabled) {
                showToast({ type: "accepted", title: "Известувањата се вклучени", message: "Ќе добивате потсетници и кога апликацијата е затворена." });
            } else if (result === "denied") {
                showToast({ type: "error", title: "Известувањата се блокирани", message: "Дозволете известувања во поставките на прелистувачот." });
            } else if (result === "unsupported") {
                showToast({ type: "error", title: "Не е поддржано", message: "На iPhone, прво додадете ја апликацијата на почетниот екран (Share → Add to Home Screen)." });
            }
        } catch (err) {
            console.error(err);
            showToast({ type: "error", title: "Грешка", message: "Известувањата не може да се вклучат." });
        }
    };

    const dismissPushPrompt = () => {
        localStorage.setItem("pushPromptDismissed", "1");
        setPushPromptDismissed(true);
    };

    if (!token) {
        return (
            <>
                <LoginRegister onLogin={handleLogin} />
                <Toasts toasts={toasts} />
            </>
        );
    }

    const unreadCount = notifications.filter(n => !n.isRead).length;
    const showPushPrompt = !pushEnabled && !pushPromptDismissed && pushSupported() && Notification.permission !== "denied";

    return (
        <div className="App app-shell">
            <Header
                activeSection={activeSection}
                onNavClick={navigate}
                role={role}
                user={user}
                unreadCount={unreadCount}
                onLogout={() => handleLogout()}
            />

            {!connected && (
                <div className="connection-banner">Се поврзува со серверот… промените ќе се прикажат автоматски.</div>
            )}

            {showPushPrompt && (
                <div className="push-prompt">
                    <span>🔔 Вклучете известувања за да добиете потсетник ден и час пред вашиот термин.</span>
                    <div>
                        <button className="push-prompt-yes" onClick={togglePush}>Вклучи</button>
                        <button className="push-prompt-no" onClick={dismissPushPrompt}>Подоцна</button>
                    </div>
                </div>
            )}

            <main className="app-main">
                {activeSection === "home" && <Home role={role} user={user} syncTick={syncTick} onNavigate={navigate} />}

                {activeSection === "termin" && (
                    <Calendar role={role} syncTick={syncTick} showToast={showToast} />
                )}

                {activeSection === "услуги" && (
                    <Services role={role} galleryTick={galleryTick} showToast={showToast} onNavigate={navigate} />
                )}

                {activeSection === "tim" && <AboutUs />}

                {activeSection === "notifications" && (
                    <Notifications
                        role={role}
                        notifications={notifications}
                        syncTick={syncTick}
                        onMarkRead={markAsRead}
                        onMarkAllRead={markAllAsRead}
                        onClear={clearNotifications}
                        onNavigate={navigate}
                        showToast={showToast}
                    />
                )}

                {activeSection === "profile" && (
                    <Profile
                        user={user}
                        onUserUpdate={(u) => {
                            setUser(u);
                            localStorage.setItem("user", JSON.stringify(u));
                        }}
                        pushEnabled={pushEnabled}
                        onTogglePush={togglePush}
                        onLogout={() => handleLogout()}
                        showToast={showToast}
                    />
                )}
            </main>

            <Toasts toasts={toasts} />
        </div>
    );
}

const Toasts = ({ toasts }) => (
    <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map(t => (
            <div key={t.id} className={`toast toast-${t.type || "info"}`}>
                {t.title && <strong>{t.title}</strong>}
                <span>{t.message}</span>
            </div>
        ))}
    </div>
);

export default App;
