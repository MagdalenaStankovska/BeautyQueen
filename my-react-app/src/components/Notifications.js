import React, { useEffect, useState } from "react";
import axios from "axios";
import "./Notifications.css"

/* ===============================
   ⏰ REMINDER HELPERS
=============================== */
const isWithinMinutes = (appt, minutes) => {
    const now = new Date();
    const apptDate = new Date(`${appt.date}T${appt.time}:00`);
    const diff = (apptDate - now) / 60000;

    return diff > 0 && diff <= minutes;
};

const Notifications = ({ token, role }) => {
    const [notifications, setNotifications] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);

    // 🪟 USER cancel modal
    const [cancelModal, setCancelModal] = useState(null);
    const [cancelReason, setCancelReason] = useState("");

    // 🪟 ADMIN cancel info modal
    const [cancelInfoModal, setCancelInfoModal] = useState(null);

    /* ===============================
       FETCH NOTIFICATIONS
    =============================== */
    const fetchNotifications = async () => {
        try {
            const res = await axios.get(
                "http://localhost:4000/notifications",
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setNotifications(res.data);
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        }
    };

    /* ===============================
       FETCH APPOINTMENTS
    =============================== */
    const fetchAppointments = async () => {
        try {
            const url =
                role === "admin"
                    ? "http://localhost:4000/appointments"
                    : "http://localhost:4000/appointments/user";

            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setAppointments(res.data);
        } catch (err) {
            console.error("Appointments fetch error", err);
        }
    };

    /* ===============================
       MARK NOTIFICATION AS READ
    =============================== */
    const markAsRead = async (id) => {
        try {
            await axios.patch(
                `http://localhost:4000/notifications/${id}/read`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setNotifications(prev =>
                prev.map(n =>
                    n.id === id ? { ...n, isRead: true } : n
                )
            );
        } catch (err) {
            console.error("Read error", err);
        }
    };

    /* ===============================
       CANCEL APPOINTMENT (USER)
    =============================== */
    const confirmCancel = async () => {
        try {
            await axios.patch(
                `http://localhost:4000/appointments/${cancelModal.id}/cancel`,
                { reason: cancelReason },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setCancelModal(null);
            setCancelReason("");
            fetchNotifications();
            fetchAppointments();
        } catch (err) {
            console.error("Cancel error", err);
        }
    };

    /* ===============================
       INITIAL LOAD
    =============================== */
    useEffect(() => {
        const loadAll = async () => {
            await fetchNotifications();
            await fetchAppointments();
            setLoading(false);
        };
        loadAll();
    }, []);

    /* ===============================
       FILTERS
    =============================== */
    const pendingAppointments = appointments.filter(
        a => a.status === "pending"
    );

    const rejectedAppointments = appointments.filter(
        a => a.status === "rejected"
    );

    const acceptedAppointments = appointments.filter(
        a => a.status === "accepted"
    );

    if (loading) {
        return (
            <p style={{ textAlign: "center" }}>
                Се вчитуваат известувања...
            </p>
        );
    }

    return (
        <div
            style={{
                maxWidth: 600,
                margin: "40px auto",
                padding: 20,
                background: "#fff0f5",
                borderRadius: 16
            }}
        >
            <h2 style={{ textAlign: "center", marginBottom: 20 }}>
                🔔 Известувања
            </h2>

            {/* ===============================
                SYSTEM NOTIFICATIONS
            =============================== */}
            {notifications.map(n => (
                <div
                    key={n.id}
                    onClick={() => !n.isRead && markAsRead(n.id)}
                    style={{
                        padding: 14,
                        marginBottom: 12,
                        borderRadius: 12,
                        background: n.isRead ? "#ffe6f0" : "#ffb6c1",
                        cursor: "pointer",
                        opacity: n.isRead ? 0.7 : 1
                    }}
                >
                    <p>{n.message}</p>

                    {role === "admin" && n.type === "cancelled" && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const appt = appointments.find(
                                    a => a.id === n.appointmentId
                                );
                                if (appt) setCancelInfoModal(appt);
                            }}
                        >
                            👁 Види причина
                        </button>
                    )}
                </div>
            ))}

            {/* ===============================
                ACCEPTED APPOINTMENTS (USER)
            =============================== */}
            {role !== "admin" && acceptedAppointments.length > 0 && (
                <>
                    <h3 style={{ marginTop: 30 }}>
                        ✅ Прифатени термини
                    </h3>

                    {acceptedAppointments.map(a => (
                        <div
                            key={a.id}
                            style={{
                                padding: 14,
                                marginBottom: 12,
                                borderRadius: 12,
                                background: "#e6fffa"
                            }}
                        >
                            <p>
                                {a.date} • {a.time} • {a.service}
                            </p>

                            {isWithinMinutes(a, 1440) && (
                                <p style={{ color: "orange" }}>
                                    ⏰ Потсетник: утре имате термин
                                </p>
                            )}

                            {isWithinMinutes(a, 60) && (
                                <p style={{ color: "red", fontWeight: "bold" }}>
                                    ⏰ Потсетник: за 1 час
                                </p>
                            )}

                            <button
                                onClick={() => setCancelModal(a)}
                                style={{
                                    background: "red",
                                    color: "white"
                                }}
                            >
                                ❌ Откажи
                            </button>
                        </div>
                    ))}
                </>
            )}

            {/* ===============================
                PENDING APPOINTMENTS
            =============================== */}
            {pendingAppointments.length > 0 && (
                <>
                    <h3>⏳ Термини во чекање</h3>
                    {pendingAppointments.map(a => (
                        <div key={a.id}>
                            {a.date} • {a.time} • {a.service}
                        </div>
                    ))}
                </>
            )}

            {/* ===============================
                REJECTED APPOINTMENTS
            =============================== */}
            {rejectedAppointments.length > 0 && (
                <>
                    <h3>❌ Одбиени термини</h3>
                    {rejectedAppointments.map(a => (
                        <div key={a.id}>
                            {a.date} • {a.time} • {a.service}
                        </div>
                    ))}
                </>
            )}

            {/* ===============================
                CANCEL MODAL (USER)
            =============================== */}
            {cancelModal && (
                <div className="modal-overlay">
                    <div
                        className="modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3>Откажи термин</h3>
                        <textarea
                            placeholder="Причина за откажување"
                            value={cancelReason}
                            onChange={e => setCancelReason(e.target.value)}
                        />
                        <button onClick={confirmCancel}>
                            Откажи
                        </button>
                        <button onClick={() => setCancelModal(null)}>
                            Затвори
                        </button>
                    </div>
                </div>
            )}

            {/* ===============================
                CANCEL INFO MODAL (ADMIN)
            =============================== */}
            {cancelInfoModal && (
                <div className="modal-overlay">
                    <div
                        className="modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3>Откажан термин</h3>
                        <p>
                            <strong>Клиент:</strong>{" "}
                            {cancelInfoModal.userEmail}
                        </p>
                        <p><strong>Причина:</strong></p>
                        <p>{cancelInfoModal.cancelReason}</p>
                        <button
                            onClick={() => setCancelInfoModal(null)}
                        >
                            Затвори
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Notifications;
