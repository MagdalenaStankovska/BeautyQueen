import React, { useCallback, useEffect, useState } from "react";
import api, { errorMessage } from "../api";
import Modal from "./Modal";
import { appointmentDate, employeeLabel, formatDisplayDate, formatFriendlyDate, statusLabels, timeAgo } from "../salon";
import "./Notifications.css";

const typeIcons = {
    request: "📅",
    accepted: "✅",
    rejected: "❌",
    cancelled: "⚠️",
    reminder: "⏰"
};

// messages carry an emoji for push notifications; the card already shows the type icon
const stripLeadingEmoji = (text = "") => text.replace(/^\p{Extended_Pictographic}️?\s*/u, "");

const minutesUntil = (appt) => (appointmentDate(appt) - new Date()) / 60000;

const Notifications = ({ role, notifications, syncTick, onMarkRead, onMarkAllRead, onClear, onNavigate, showToast }) => {
    const [appointments, setAppointments] = useState([]);
    const [cancelModal, setCancelModal] = useState(null);
    const [cancelReason, setCancelReason] = useState("");
    const [infoModal, setInfoModal] = useState(null);
    const [rejectModal, setRejectModal] = useState(null);
    const [rejectReason, setRejectReason] = useState("");
    const [, setNowTick] = useState(0);

    const isAdmin = role === "admin";

    const fetchAppointments = useCallback(async () => {
        try {
            const { data } = await api.get(isAdmin ? "/appointments" : "/appointments/user");
            setAppointments(data);
        } catch (err) {
            console.error("Appointments fetch error", err);
        }
    }, [isAdmin]);

    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments, syncTick]);

    // re-render every minute so "in 1 hour" banners stay current
    useEffect(() => {
        const id = setInterval(() => setNowTick(t => t + 1), 60000);
        return () => clearInterval(id);
    }, []);

    const findAppt = (id) => appointments.find(a => a.id === id);

    const decide = async (appt, status, reason) => {
        try {
            await api.patch(`/appointments/${appt.id}`, { status, reason });
            showToast({ type: status, title: status === "accepted" ? "Терминот е прифатен" : "Барањето е одбиено", message: `${appt.clientName || appt.userEmail} · ${appt.service}` });
            fetchAppointments();
        } catch (err) {
            showToast({ type: "error", title: "Грешка", message: errorMessage(err) });
        }
    };

    const confirmCancel = async () => {
        try {
            await api.patch(`/appointments/${cancelModal.id}/cancel`, { reason: cancelReason });
            setCancelModal(null);
            setCancelReason("");
            fetchAppointments();
        } catch (err) {
            showToast({ type: "error", title: "Грешка", message: errorMessage(err) });
        }
    };

    const upcomingAccepted = appointments
        .filter(a => a.status === "accepted" && minutesUntil(a) > 0)
        .sort((a, b) => appointmentDate(a) - appointmentDate(b));
    const pendingCount = appointments.filter(a => a.status === "pending").length;
    const unread = notifications.filter(n => !n.isRead).length;

    return (
        <div className="notifications-page">
            <div className="notifications-shell">
                <div className="notifications-header">
                    <h2 className="notifications-title">🔔 Известувања</h2>
                    <div className="notifications-tools">
                        {unread > 0 && (
                            <button className="link-btn" onClick={onMarkAllRead}>Означи ги сите како прочитани</button>
                        )}
                        {notifications.length > 0 && (
                            <button
                                className="link-btn"
                                onClick={() => window.confirm("Да се избришат сите известувања?") && onClear()}
                            >
                                Избриши ги сите
                            </button>
                        )}
                    </div>
                </div>

                {isAdmin && pendingCount > 0 && (
                    <div className="admin-pending-banner" onClick={() => onNavigate("termin")}>
                        Имате <strong>{pendingCount}</strong> {pendingCount === 1 ? "барање кое чека" : "барања кои чекаат"} одговор → Отвори распоред
                    </div>
                )}

                {/* Upcoming confirmed appointments with reminder banners (clients) */}
                {!isAdmin && upcomingAccepted.length > 0 && (
                    <>
                        <h3 className="section-title">✅ Претстојни термини</h3>
                        <div className="accepted-list">
                            {upcomingAccepted.map((a) => {
                                const mins = minutesUntil(a);
                                const isUrgent = mins <= 60;
                                const isSoon = mins <= 1440 && !isUrgent;
                                return (
                                    <div key={a.id} className={`accepted-card ${isUrgent ? "urgent" : ""}`}>
                                        <p className="accepted-main">
                                            {formatDisplayDate(a.date)} • {a.time} • {a.service}
                                        </p>
                                        {a.employee && <p className="accepted-sub">Вработена: {employeeLabel(a.employee)}</p>}
                                        {isSoon && (
                                            <p className="reminder reminder-soft">⏰ Потсетник: терминот е во следните 24 часа</p>
                                        )}
                                        {isUrgent && (
                                            <p className="reminder reminder-urgent">
                                                🚨 Терминот е за помалку од 1 час. Ве молиме дојдете на време.
                                            </p>
                                        )}
                                        <button className="cancel-button" onClick={() => setCancelModal(a)}>Откажи</button>
                                    </div>
                                );
                            })}
                        </div>
                        <h3 className="section-title">Сите известувања</h3>
                    </>
                )}

                {notifications.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🔕</div>
                        <p>Немате известувања.</p>
                        {!isAdmin && (
                            <button className="bq-btn bq-btn-primary" onClick={() => onNavigate("termin")}>Закажи термин</button>
                        )}
                    </div>
                ) : (
                    notifications.map((n) => {
                        const appt = n.appointmentId ? findAppt(n.appointmentId) : null;
                        return (
                            <div
                                key={n.id}
                                onClick={() => !n.isRead && onMarkRead(n.id)}
                                className={`notification-card type-${n.type} ${n.isRead ? "is-read" : "is-unread"}`}
                            >
                                <div className="notification-icon">{typeIcons[n.type] || "🔔"}</div>
                                <div className="notification-content">
                                    {n.title && <p className="notification-title">{n.title}</p>}
                                    <p className="notification-message">{stripLeadingEmoji(n.message)}</p>
                                    <div className="notification-meta">
                                        <span>{timeAgo(n.createdAt)}</span>
                                        {appt && <span className={`mini-status status-${appt.status}`}>{statusLabels[appt.status]}</span>}
                                    </div>

                                    {isAdmin && n.type === "request" && appt?.status === "pending" && (
                                        <div className="notification-actions">
                                            <button
                                                className="bq-btn bq-btn-success"
                                                onClick={(e) => { e.stopPropagation(); onMarkRead(n.id); decide(appt, "accepted"); }}
                                            >
                                                Прифати
                                            </button>
                                            <button
                                                className="bq-btn bq-btn-danger"
                                                onClick={(e) => { e.stopPropagation(); onMarkRead(n.id); setRejectModal(appt); }}
                                            >
                                                Одбиј
                                            </button>
                                        </div>
                                    )}

                                    {isAdmin && n.type === "cancelled" && appt && (
                                        <button
                                            className="notification-button"
                                            onClick={(e) => { e.stopPropagation(); setInfoModal(appt); }}
                                        >
                                            👁 Види причина
                                        </button>
                                    )}
                                </div>
                                {!n.isRead && <span className="unread-dot" aria-label="Непрочитано" />}
                            </div>
                        );
                    })
                )}
            </div>

            {cancelModal && (
                <Modal
                    title="Откажи термин"
                    onClose={() => setCancelModal(null)}
                    actions={
                        <>
                            <button className="bq-btn bq-btn-ghost" onClick={() => setCancelModal(null)}>Назад</button>
                            <button className="bq-btn bq-btn-danger" onClick={confirmCancel}>Откажи термин</button>
                        </>
                    }
                >
                    <div className="bq-info-row"><span className="bq-info-label">Услуга</span>{cancelModal.service}</div>
                    <div className="bq-info-row"><span className="bq-info-label">Термин</span>{formatFriendlyDate(cancelModal.date)} во {cancelModal.time}</div>
                    <label style={{ marginTop: 12 }}>Причина (опционално)</label>
                    <textarea
                        placeholder="Причина за откажување (опционално)"
                        value={cancelReason}
                        onChange={e => setCancelReason(e.target.value)}
                    />
                </Modal>
            )}

            {rejectModal && (
                <Modal
                    title="Одбиј барање"
                    onClose={() => setRejectModal(null)}
                    actions={
                        <>
                            <button className="bq-btn bq-btn-ghost" onClick={() => setRejectModal(null)}>Назад</button>
                            <button
                                className="bq-btn bq-btn-danger"
                                onClick={async () => {
                                    await decide(rejectModal, "rejected", rejectReason);
                                    setRejectModal(null);
                                    setRejectReason("");
                                }}
                            >
                                Одбиј
                            </button>
                        </>
                    }
                >
                    <div className="bq-info-row"><span className="bq-info-label">Клиент</span>{rejectModal.clientName || rejectModal.userEmail}</div>
                    <div className="bq-info-row"><span className="bq-info-label">Услуга</span>{rejectModal.service}</div>
                    <div className="bq-info-row"><span className="bq-info-label">Термин</span>{formatFriendlyDate(rejectModal.date)} во {rejectModal.time}</div>
                    <label style={{ marginTop: 12 }}>Причина (клиентот ќе ја види)</label>
                    <textarea
                        placeholder="Причина (клиентот ќе ја види)"
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                    />
                </Modal>
            )}

            {infoModal && (
                <Modal
                    title="Откажан термин"
                    onClose={() => setInfoModal(null)}
                    actions={<button className="bq-btn bq-btn-ghost" onClick={() => setInfoModal(null)}>Затвори</button>}
                >
                    <div className="bq-info-row"><span className="bq-info-label">Клиент</span>{infoModal.clientName || infoModal.userEmail}</div>
                    {infoModal.clientPhone && (
                        <div className="bq-info-row">
                            <span className="bq-info-label">Телефон</span>
                            <a href={`tel:${infoModal.clientPhone}`}>{infoModal.clientPhone}</a>
                        </div>
                    )}
                    <div className="bq-info-row"><span className="bq-info-label">Услуга</span>{infoModal.service}</div>
                    <div className="bq-info-row"><span className="bq-info-label">Термин</span>{formatFriendlyDate(infoModal.date)} во {infoModal.time}</div>
                    <label style={{ marginTop: 14 }}>Причина</label>
                    <p className="bq-info-quote">{infoModal.cancelReason || "Не е наведена причина."}</p>
                </Modal>
            )}
        </div>
    );
};

export default Notifications;
