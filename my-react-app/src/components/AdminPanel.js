import React, { useEffect, useState } from "react";
import axios from "axios";

const AdminPanel = () => {
    const [appointments, setAppointments] = useState([]);

    useEffect(() => {
        fetchAppointments();
    }, []);

    const fetchAppointments = async () => {
        try {
            const res = await axios.get("http://localhost:5000/appointments");
            setAppointments(res.data.filter((appt) => appt.status === "pending"));
        } catch (err) {
            console.error("Error fetching appointments:", err);
        }
    };

    const handleDecision = async (id, decision) => {
        try {
            await axios.patch(`http://localhost:5000/appointments/${id}`, {
                status: decision,
            });
            fetchAppointments();
        } catch (err) {
            console.error("Error updating appointment:", err);
        }
    };

    return (
        <div style={{ padding: 20 }}>
            <h2>Нови барања за термини</h2>
            {appointments.length === 0 ? (
                <p>Нема нови барања.</p>
            ) : (
                <ul style={{ listStyle: "none", padding: 0 }}>
                    {appointments.map((appt) => (
                        <li
                            key={appt.id}
                            style={{
                                border: "1px solid #ccc",
                                padding: 10,
                                marginBottom: 10,
                                borderRadius: "40%",
                                backgroundColor: "#fff0f5",
                                transition: "all 0.3s ease",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "scale(1.03)";
                                e.currentTarget.style.boxShadow =
                                    "0 4px 12px rgba(0,0,0,0.2)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "scale(1)";
                                e.currentTarget.style.boxShadow = "none";
                            }}
                        >
                            <p>
                                <strong>Име:</strong> {appt.name}
                            </p>
                            <p>
                                <strong>Услуга:</strong> {appt.service}
                            </p>
                            <p>
                                <strong>Датум:</strong> {appt.date}
                            </p>
                            <p>
                                <strong>Час:</strong> {appt.time}
                            </p>
                            <button
                                onClick={() => handleDecision(appt.id, "accepted")}
                                style={{
                                    background: "green",
                                    color: "white",
                                    marginRight: 10,
                                    borderRadius: "40%",
                                    padding: "8px 16px",
                                    transition: "all 0.3s ease",
                                    cursor: "pointer",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = "scale(1.1)";
                                    e.currentTarget.style.opacity = "0.9";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = "scale(1)";
                                    e.currentTarget.style.opacity = "1";
                                }}
                            >
                                ✅ Прифати
                            </button>
                            <button
                                onClick={() => handleDecision(appt.id, "rejected")}
                                style={{
                                    background: "red",
                                    color: "white",
                                    borderRadius: "40%",
                                    padding: "8px 16px",
                                    transition: "all 0.3s ease",
                                    cursor: "pointer",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = "scale(1.1)";
                                    e.currentTarget.style.opacity = "0.9";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = "scale(1)";
                                    e.currentTarget.style.opacity = "1";
                                }}
                            >
                                ❌ Одбиј
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default AdminPanel;
