import React, { useEffect, useState } from "react";
import api, { errorMessage } from "../api";
import { pushSupported } from "../push";
import "./Profile.css";

const Profile = ({ user, onUserUpdate, pushEnabled, onTogglePush, onLogout, showToast }) => {
    const [name, setName] = useState(user?.name || "");
    const [phone, setPhone] = useState(user?.phone || "");
    const [saving, setSaving] = useState(false);
    const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
    // captured in index.js because the browser fires it once, usually before this page is opened
    const [installPrompt, setInstallPrompt] = useState(() => window.deferredInstallPrompt || null);

    useEffect(() => {
        setName(user?.name || "");
        setPhone(user?.phone || "");
    }, [user]);

    useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setInstallPrompt(e);
        };
        window.addEventListener("beforeinstallprompt", handler);
        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    const saveProfile = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { data } = await api.patch("/me", { name, phone });
            onUserUpdate(data);
            showToast({ type: "accepted", title: "Зачувано", message: "Профилот е ажуриран." });
        } catch (err) {
            showToast({ type: "error", title: "Грешка", message: errorMessage(err) });
        } finally {
            setSaving(false);
        }
    };

    const changePassword = async (e) => {
        e.preventDefault();
        try {
            await api.patch("/me/password", passwords);
            setPasswords({ currentPassword: "", newPassword: "" });
            showToast({ type: "accepted", title: "Лозинката е променета", message: "" });
        } catch (err) {
            showToast({ type: "error", title: "Грешка", message: errorMessage(err) });
        }
    };

    const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

    return (
        <div className="profile-page">
            <div className="profile-card">
                <h2>Мој профил</h2>
                <p className="profile-email">{user?.email} {user?.role === "admin" && <span className="profile-role">Администратор</span>}</p>

                <form onSubmit={saveProfile}>
                    <label>Име и презиме</label>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Вашето име" />
                    <label>Телефон</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+389 7x xxx xxx" />
                    <p className="profile-hint">Салонот ќе ве контактира на овој број доколку има промена во терминот.</p>
                    <button className="bq-btn bq-btn-primary" disabled={saving}>{saving ? "Зачувување…" : "Зачувај"}</button>
                </form>
            </div>

            <div className="profile-card">
                <h3>🔔 Известувања</h3>
                {pushSupported() ? (
                    <>
                        <p className="profile-hint">
                            {pushEnabled
                                ? "Вклучени се. Ќе добиете известување за секое ажурирање на терминот, како и потсетник 1 ден и 1 час пред терминот, дури и кога апликацијата е затворена."
                                : "Вклучете ги за да добивате потсетници 1 ден и 1 час пред терминот, дури и кога апликацијата е затворена."}
                        </p>
                        <button className={`bq-btn ${pushEnabled ? "bq-btn-ghost" : "bq-btn-primary"}`} onClick={onTogglePush}>
                            {pushEnabled ? "Исклучи известувања" : "Вклучи известувања"}
                        </button>
                    </>
                ) : (
                    <p className="profile-hint">
                        {isIOS
                            ? "На iPhone: отворете ја страницата во Safari, притиснете Share → „Add to Home Screen“, па отворете ја апликацијата од почетниот екран за да вклучите известувања."
                            : "Овој прелистувач не поддржува push известувања. Известувањата ќе ги гледате во апликацијата."}
                    </p>
                )}
            </div>

            {!isStandalone && (installPrompt || isIOS) && (
                <div className="profile-card">
                    <h3>📱 Инсталирај апликација</h3>
                    {installPrompt ? (
                        <>
                            <p className="profile-hint">Додајте ја Beauty Queen на почетниот екран за побрз пристап.</p>
                            <button
                                className="bq-btn bq-btn-primary"
                                onClick={async () => {
                                    installPrompt.prompt();
                                    await installPrompt.userChoice;
                                    setInstallPrompt(null);
                                }}
                            >
                                Инсталирај
                            </button>
                        </>
                    ) : (
                        <p className="profile-hint">Во Safari притиснете Share → „Add to Home Screen“.</p>
                    )}
                </div>
            )}

            <div className="profile-card">
                <h3>🔒 Промени лозинка</h3>
                <form onSubmit={changePassword}>
                    <input
                        type="password"
                        placeholder="Тековна лозинка"
                        autoComplete="current-password"
                        value={passwords.currentPassword}
                        onChange={e => setPasswords({ ...passwords, currentPassword: e.target.value })}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Нова лозинка (мин. 6 карактери)"
                        autoComplete="new-password"
                        minLength={6}
                        value={passwords.newPassword}
                        onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })}
                        required
                    />
                    <button className="bq-btn bq-btn-ghost">Промени лозинка</button>
                </form>
            </div>

            <button className="bq-btn bq-btn-danger profile-logout" onClick={onLogout}>Одјава</button>
        </div>
    );
};

export default Profile;
