// import React, { useEffect, useState, useCallback } from "react";
// import Calendar from "react-calendar";
// import "react-calendar/dist/Calendar.css";
// import "./Calendar.css";
// import axios from "axios";
//
// // ------------------ Услуги ------------------
// const services = {
//     "": ["----"],
//     "Маникир": ["Маникир (само гел лак)", "Маникир (наливни)"],
//     "Педикир": ["Педикир (гел лак на нозе)", "Педикир (целосен+gel лак)"],
//     "Lash Lift": ["Lash Lift"],
//     "Депилација": [
//         "Депилација (интима)",
//         "Депилација (целосна)",
//         "Депилација (раце+нозе)"
//     ],
//     "Чупање веѓи": ["Чупање веѓи"],
//     "Brow": ["Brow Lam"]
// };
//
// // ------------------ Бои ------------------
// const serviceColors = {
//     "Маникир (само гел лак)": "#FFB6C1",
//     "Маникир (наливни)": "#FF69B4",
//     "Педикир (гел лак на нозе)": "#87CEFA",
//     "Педикир (целосен+gel лак)": "#4682B4",
//     "Lash Lift": "#FFDEAD",
//     "Депилација (интима)": "#98FB98",
//     "Депилација (целосна)": "#3CB371",
//     "Депилација (раце+нозе)": "#2E8B57",
//     "Чупање веѓи": "#DDA0DD",
//     "Brow Lam": "#DAA520"
// };
//
// // ------------------ Времетраење на услуги во минути ------------------
// const serviceDurations = {
//     "Маникир (само гел лак)": 75,
//     "Маникир (наливни)": 105,
//     "Педикир (гел лак на нозе)": 45,
//     "Педикир (целосен+gel лак)": 75,
//     "Lash Lift": 60,
//     "Депилација (интима)": 35,
//     "Депилација (целосна)": 75,
//     "Депилација (раце+нозе)": 45,
//     "Чупање веѓи": 30,
//     "Brow Lam": 60
// };
//
// // ------------------ Форматирање на датум ------------------
// const formatLocalDate = (date) => {
//     const y = date.getFullYear();
//     const m = String(date.getMonth() + 1).padStart(2, "0");
//     const d = String(date.getDate()).padStart(2, "0");
//     return `${y}-${m}-${d}`;
// };
//
// // ------------------ Генерирање опции за време ------------------
// const generateTimeOptions = () => {
//     const times = [];
//     for (let hour = 12; hour <= 20; hour++) {
//         for (let min = 0; min < 60; min += 15) {
//             if (hour === 20 && min > 45) continue;
//             const h = String(hour).padStart(2, "0");
//             const m = String(min).padStart(2, "0");
//             times.push(`${h}:${m}`);
//         }
//     }
//     return times;
// };
//
// const CalendarComponent = ({ token, role }) => {
//     const firstService = Object.values(services).flat()[0];
//     const [date, setDate] = useState(new Date());
//     const [time, setTime] = useState("12:00");
//     const [service, setService] = useState(firstService);
//     const [message, setMessage] = useState(null);
//     const [loading, setLoading] = useState(false);
//     const [appointments, setAppointments] = useState([]);
//     const [selectedDate, setSelectedDate] = useState(new Date());
//     const [filterService, setFilterService] = useState("");
//
//     const timeOptions = generateTimeOptions();
//
//     // ------------------ Fetch appointments ------------------
//     const fetchAppointments = useCallback(async () => {
//         try {
//             const res = await axios.get("http://localhost:4000/appointments", {
//                 headers: { Authorization: `Bearer ${token}` },
//             });
//             setAppointments(res.data);
//         } catch (err) {
//             console.error("Error fetching appointments:", err);
//         }
//     }, [token]);
//
//     useEffect(() => {
//         if (token) fetchAppointments();
//     }, [token, fetchAppointments]);
//
//     // ------------------ Auto refresh every 60s ------------------
//     useEffect(() => {
//         const interval = setInterval(() => {
//             fetchAppointments();
//         }, 60000);
//         return () => clearInterval(interval);
//     }, [fetchAppointments]);
//
//     // ------------------ Decision handler (accept/reject) ------------------
//     const handleDecision = async (id, decision) => {
//         try {
//             await axios.patch(
//                 `http://localhost:4000/appointments/${id}`,
//                 { status: decision },
//                 { headers: { Authorization: `Bearer ${token}` } }
//             );
//             await fetchAppointments();
//             setSelectedDate(new Date(selectedDate));
//         } catch (error) {
//             console.error("Failed to update appointment:", error);
//         }
//     };
//
//     // ------------------ Submit appointment ------------------
//     const handleSubmit = async (e) => {
//         e.preventDefault();
//         if (!date || !time || !service) {
//             setMessage({ type: "error", text: "Пополнете ги сите полиња." });
//             return;
//         }
//         setLoading(true);
//         setMessage(null);
//         try {
//             await axios.post(
//                 "http://localhost:4000/appointments",
//                 { date: formatLocalDate(date), time, service },
//                 {
//                     headers: {
//                         "Content-Type": "application/json",
//                         Authorization: `Bearer ${token}`,
//                     },
//                 }
//             );
//             setMessage({ type: "success", text: "Успешно закажан термин!" });
//             setDate(new Date());
//             setTime("12:00");
//             setService(firstService);
//             fetchAppointments();
//         } catch (err) {
//             setMessage({
//                 type: "error",
//                 text:
//                     err.response?.data?.message ||
//                     "Настана грешка при закажување.",
//             });
//         } finally {
//             setLoading(false);
//         }
//     };
//
//     // ------------------ Check time slot availability ------------------
//     const isTimeDisabled = (checkTime) => {
//         const selectedDateStr = formatLocalDate(date);
//         const appointmentsForDay = appointments.filter(a => a.date === selectedDateStr);
//         for (let appt of appointmentsForDay) {
//             const startHourMin = appt.time.split(":").map(Number);
//             const apptStart = startHourMin[0]*60 + startHourMin[1];
//             const apptEnd = apptStart + (serviceDurations[appt.service] || 0);
//
//             const checkHourMin = checkTime.split(":").map(Number);
//             const checkStart = checkHourMin[0]*60 + checkHourMin[1];
//             const checkEnd = checkStart + (serviceDurations[service] || 0);
//
//             if (Math.max(apptStart, checkStart) < Math.min(apptEnd, checkEnd)) {
//                 return true;
//             }
//         }
//         return false;
//     };
//
//     // ------------------ Styles ------------------
//     const styles = `
//       @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap');
//       .calendar-wrapper * { font-family: 'Open Sans', sans-serif; }
//       .today-highlight { background: #ffe6f0; border-radius: 50%; color: hotpink !important; }
//       .appointment-item { padding: 10px 14px; margin-bottom: 10px; border-radius: 12px; background: linear-gradient(120deg, #ffe6f0, #ffb6c1); transition: all 0.3s ease; font-weight: 500; }
//       .appointment-item:hover { transform: scale(1.03); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
//       .service-badge { padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; color: white; margin-left: 6px; }
//       button { transition: all 0.3s ease; }
//       button:hover { transform: scale(1.05); }
//       select, input[type="date"] { border-radius: 8px; border: 1px solid #ccc; }
//       .pending-appointment { transition: all 0.3s ease, transform 0.2s ease, background 0.3s ease; cursor: pointer; background: #fff0f5; }
//       .pending-appointment:hover { transform: translateY(-4px); box-shadow: 0 6px 16px rgba(0,0,0,0.15); background: linear-gradient(120deg, #ffe6f0, #ffd1e0); }
//     `;
//
//     // ------------------ Client view ------------------
//     if (role !== "admin") {
//         return (
//             <div className="calendar-wrapper" style={{ maxWidth: 400, margin: "auto" }}>
//                 <style>{styles}</style>
//                 <h2 style={{ marginBottom: 20 }}>Закажи термин</h2>
//                 <form onSubmit={handleSubmit}>
//                     <label>
//                         Датум:
//                         <Calendar
//                             value={date}
//                             onChange={setDate}
//                             minDate={new Date()}
//                             tileClassName={({ date: d, view }) => {
//                                 const today = new Date();
//                                 if (
//                                     d.getDate() === today.getDate() &&
//                                     d.getMonth() === today.getMonth() &&
//                                     d.getFullYear() === today.getFullYear()
//                                 ) {
//                                     return "today-highlight";
//                                 }
//                                 return null;
//                             }}
//                             style={{ margin: "8px 0" }}
//                         />
//                     </label>
//                     <label>
//                         Време:
//                         <select
//                             value={time}
//                             onChange={(e) => setTime(e.target.value)}
//                             required
//                             style={{ width: "100%", padding: "8px", margin: "8px 0" }}
//                         >
//                             {timeOptions.map((t) => (
//                                 <option
//                                     key={t}
//                                     value={t}
//                                     disabled={isTimeDisabled(t)}
//                                     style={{
//                                         backgroundColor: appointments.some(a => a.date === formatLocalDate(date) && a.time === t)
//                                             ? "#ffe6f0"
//                                             : "white"
//                                     }}
//                                 >
//                                     {t}
//                                 </option>
//                             ))}
//                         </select>
//                     </label>
//                     <label>
//                         Услуга:
//                         <select
//                             value={service}
//                             onChange={(e) => setService(e.target.value)}
//                             style={{ width: "100%", padding: "8px", margin: "8px 0" }}
//                         >
//                             {Object.entries(services).map(([category, subservices]) => (
//                                 <optgroup key={category} label={category}>
//                                     {subservices.map((srv) => (
//                                         <option key={srv} value={srv}>{srv}</option>
//                                     ))}
//                                 </optgroup>
//                             ))}
//                         </select>
//                     </label>
//                     <button
//                         type="submit"
//                         disabled={loading}
//                         style={{
//                             width: "100%",
//                             padding: 12,
//                             backgroundColor: "hotpink",
//                             color: "white",
//                             border: "none",
//                             borderRadius: 8,
//                             cursor: "pointer",
//                             fontWeight: "bold",
//                             marginTop: 10
//                         }}
//                     >
//                         {loading ? "Испраќање..." : "Испрати барање"}
//                     </button>
//                 </form>
//                 {message && (
//                     <p style={{ color: message.type === "error" ? "red" : "green", marginTop: 10 }}>
//                         {message.text}
//                     </p>
//                 )}
//             </div>
//         );
//     }
//
//     // ------------------ Admin view ------------------
//     const pendingAppointments = [...appointments.filter((a) => a.status === "pending")].reverse();
//     const acceptedAppointments = appointments.filter((a) => a.status === "accepted");
//     const selectedDateStr = formatLocalDate(selectedDate);
//     const appointmentsForDay = acceptedAppointments
//         .filter((a) => a.date === selectedDateStr)
//         .sort((a, b) => a.time.localeCompare(b.time));
//
//     const filteredAppointmentsForDay = filterService
//         ? appointmentsForDay.filter(a => a.service === filterService)
//         : appointmentsForDay;
//
//     const getAppointmentsByTime = (timeStr) => {
//         return filteredAppointmentsForDay.filter(a => {
//             const start = a.time.split(":").map(Number);
//             const end = start[0]*60 + start[1] + (serviceDurations[a.service] || 0);
//             const [h, m] = timeStr.split(":").map(Number);
//             const check = h*60 + m;
//             return check >= start[0]*60+start[1] && check < end;
//         });
//     };
//
//     return (
//         <div className="calendar-wrapper" style={{ display: "flex", justifyContent: "space-between", padding: 20 }}>
//             <style>{styles}</style>
//
//             {/* LEFT SIDE – Pending Requests */}
//             <div style={{ flex: 1, marginRight: 40 }}>
//                 <h2>🔔 Нови барања за термини</h2>
//                 {pendingAppointments.length === 0 ? (
//                     <p>Нема барања во моментов.</p>
//                 ) : (
//                     <ul style={{ listStyle: "none", padding: 0 }}>
//                         {pendingAppointments.map((appt) => (
//                             <li
//                                 key={appt.id}
//                                 className="pending-appointment"
//                                 style={{
//                                     borderRadius: 12,
//                                     padding: "14px",
//                                     marginBottom: 12,
//                                     background: "#fff0f5",
//                                     boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
//                                 }}
//                             >
//                                 <p><strong>Клиент:</strong> {appt.userEmail}</p>
//                                 <p><strong>Услуга:</strong>
//                                     <span
//                                         className="service-badge"
//                                         style={{ background: serviceColors[appt.service] || "gray" }}
//                                     >
//                                         {appt.service}
//                                     </span>
//                                 </p>
//                                 <p><strong>Датум:</strong> {appt.date}</p>
//                                 <p><strong>Време:</strong> {appt.time}</p>
//                                 <div style={{ marginTop: 10 }}>
//                                     <button
//                                         onClick={() => handleDecision(appt.id, "accepted")}
//                                         style={{ background: "green", color: "white", marginRight: 8, borderRadius: "20px", padding: "6px 14px", border: "none", cursor: "pointer" }}
//                                     >
//                                         ✅ Прифати
//                                     </button>
//                                     <button
//                                         onClick={() => handleDecision(appt.id, "rejected")}
//                                         style={{ background: "red", color: "white", borderRadius: "20px", padding: "6px 14px", border: "none", cursor: "pointer" }}
//                                     >
//                                         ❌ Одбиј
//                                     </button>
//                                 </div>
//                             </li>
//                         ))}
//                     </ul>
//                 )}
//             </div>
//
//             {/* RIGHT SIDE – Calendar */}
//             <div style={{ flex: 1 }}>
//                 <h2>📅 Прифатени термини</h2>
//
//                 {/* Filter by service */}
//                 <label>
//                     Филтрирај по услуга:
//                     <select
//                         value={filterService}
//                         onChange={(e) => setFilterService(e.target.value)}
//                         style={{ marginBottom: 10, padding: 6 }}
//                     >
//                         <option value="">Сите</option>
//                         {Object.values(services).flat().map(srv => (
//                             <option key={srv} value={srv}>{srv}</option>
//                         ))}
//                     </select>
//                 </label>
//
//                 <Calendar
//                     value={selectedDate}
//                     onChange={setSelectedDate}
//                     tileContent={({ date, view }) => {
//                         if (view === "month") {
//                             const dayStr = formatLocalDate(date);
//                             const count = acceptedAppointments.filter((a) => a.date === dayStr).length;
//                             return count > 0 ? <span style={{ color: "green" }}>●</span> : null;
//                         }
//                     }}
//                     tileClassName={({ date, view }) => {
//                         if (view === "month") {
//                             const today = new Date();
//                             if (
//                                 date.getDate() === today.getDate() &&
//                                 date.getMonth() === today.getMonth() &&
//                                 date.getFullYear() === today.getFullYear()
//                             ) {
//                                 return "today-highlight";
//                             }
//                         }
//                         return null;
//                     }}
//                 />
//
//                 <h3 style={{ marginTop: 20 }}>Термини на {selectedDateStr}</h3>
//                 <div className="appointments-list" style={{ maxHeight: 500, overflowY: "auto", borderRadius: 10, padding: 10, background: "#fff0f5", border: "1px solid #f5c6e0" }}>
//                     {Array.from({ length: 9 }, (_, i) => {
//                         const hour = 12 + i;
//                         return [0, 15, 30, 45].map((min) => {
//                             const hourStr = String(hour).padStart(2, "0");
//                             const minStr = String(min).padStart(2, "0");
//                             const timeStr = `${hourStr}:${minStr}`;
//                             const appointmentsThisSlot = getAppointmentsByTime(timeStr);
//                             return (
//                                 <div key={`${hour}-${min}`} style={{ padding: "6px 0", borderBottom: "1px solid #f5c6e0" }}>
//                                     <strong>{timeStr}</strong>
//                                     {appointmentsThisSlot.length > 0 ? (
//                                         <ul style={{ marginLeft: 20, padding: 0 }}>
//                                             {appointmentsThisSlot.map((appt) => (
//                                                 <li key={appt.id} className="appointment-item" style={{ background: serviceColors[appt.service] || "#ddd" }} title={`Email: ${appt.userEmail}\nУслуга: ${appt.service}`}>
//                                                     {appt.userEmail} ({appt.service})
//                                                 </li>
//                                             ))}
//                                         </ul>
//                                     ) : (
//                                         <div style={{ marginLeft: 20, color: "#aaa" }}>—</div>
//                                     )}
//                                 </div>
//                             );
//                         });
//                     })}
//                 </div>
//             </div>
//         </div>
//     );
// };
//
// export default CalendarComponent;
import React, { useEffect, useState, useCallback } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "./Calendar.css";
import axios from "axios";

// ------------------ Услуги ------------------
const services = {
    "": ["----"],
    "Маникир": ["Маникир (само гел лак)", "Маникир (наливни)"],
    "Педикир": ["Педикир (гел лак на нозе)", "Педикир (целосен+gel лак)"],
    "Lash Lift": ["Lash Lift"],
    "Депилација": [
        "Депилација (интима)",
        "Депилација (целосна)",
        "Депилација (раце+нозе)"
    ],
    "Чупање веѓи": ["Чупање веѓи"],
    "Brow": ["Brow Lam"]
};

// ------------------ Бои ------------------
const serviceColors = {
    "Маникир (само гел лак)": "#FFB6C1",
    "Маникир (наливни)": "#FF69B4",
    "Педикир (гел лак на нозе)": "#87CEFA",
    "Педикир (целосен+gel лак)": "#4682B4",
    "Lash Lift": "#FFDEAD",
    "Депилација (интима)": "#98FB98",
    "Депилација (целосна)": "#3CB371",
    "Депилација (раце+нозе)": "#2E8B57",
    "Чупање веѓи": "#DDA0DD",
    "Brow Lam": "#DAA520"
};

// ------------------ Времетраење на услуги во минути ------------------
const serviceDurations = {
    "Маникир (само гел лак)": 75,
    "Маникир (наливни)": 105,
    "Педикир (гел лак на нозе)": 45,
    "Педикир (целосен+gel лак)": 75,
    "Lash Lift": 60,
    "Депилација (интима)": 35,
    "Депилација (целосна)": 75,
    "Депилација (раце+нозе)": 45,
    "Чупање веѓи": 30,
    "Brow Lam": 60
};

// ------------------ Форматирање на датум ------------------
const formatLocalDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

// ------------------ Генерирање опции за време ------------------
const generateTimeOptions = () => {
    const times = [];
    for (let hour = 12; hour <= 20; hour++) {
        for (let min = 0; min < 60; min += 15) {
            if (hour === 20 && min > 45) continue;
            const h = String(hour).padStart(2, "0");
            const m = String(min).padStart(2, "0");
            times.push(`${h}:${m}`);
        }
    }
    return times;
};

const CalendarComponent = ({ token, role }) => {
    const firstService = Object.values(services).flat()[0];
    const [date, setDate] = useState(new Date());
    const [time, setTime] = useState("12:00");
    const [service, setService] = useState(firstService);
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [appointments, setAppointments] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [filterService, setFilterService] = useState("");

    const timeOptions = generateTimeOptions();

    // ------------------ Employee lists for drag & drop ------------------
    const employees = ["Sara", "Martina", "Marija"];
    const [employeeLists, setEmployeeLists] = useState({
        Sara: [],
        Martina: [],
        Marija: []
    });
    const [draggedAppt, setDraggedAppt] = useState(null);

    const handleDragStart = (e, appt) => {
        setDraggedAppt(appt);
    };

    const handleDrop = (e, toEmployee) => {
        if (!draggedAppt) return;
        setEmployeeLists(prev => {
            const newLists = { ...prev };
            // add to new employee list (without removing from original)
            newLists[toEmployee] = [...newLists[toEmployee], draggedAppt];
            return newLists;
        });
        setDraggedAppt(null);
    };

    // ------------------ Fetch appointments ------------------
    const fetchAppointments = useCallback(async () => {
        try {
            const res = await axios.get("http://localhost:4000/appointments", {
                headers: { Authorization: `Bearer ${token}` },
            });
            setAppointments(res.data);
        } catch (err) {
            console.error("Error fetching appointments:", err);
        }
    }, [token]);

    useEffect(() => {
        if (token) fetchAppointments();
    }, [token, fetchAppointments]);

    // ------------------ Auto refresh every 60s ------------------
    useEffect(() => {
        const interval = setInterval(() => {
            fetchAppointments();
        }, 60000);
        return () => clearInterval(interval);
    }, [fetchAppointments]);

    // ------------------ Decision handler (accept/reject) ------------------
    const handleDecision = async (id, decision) => {
        try {
            await axios.patch(
                `http://localhost:4000/appointments/${id}`,
                { status: decision },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await fetchAppointments();
            setSelectedDate(new Date(selectedDate));
        } catch (error) {
            console.error("Failed to update appointment:", error);
        }
    };

    // ------------------ Submit appointment ------------------
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!date || !time || !service) {
            setMessage({ type: "error", text: "Пополнете ги сите полиња." });
            return;
        }
        setLoading(true);
        setMessage(null);
        try {
            await axios.post(
                "http://localhost:4000/appointments",
                { date: formatLocalDate(date), time, service },
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            setMessage({ type: "success", text: "Успешно закажан термин!" });
            setDate(new Date());
            setTime("12:00");
            setService(firstService);
            fetchAppointments();
        } catch (err) {
            setMessage({
                type: "error",
                text:
                    err.response?.data?.message ||
                    "Настана грешка при закажување.",
            });
        } finally {
            setLoading(false);
        }
    };

    // ------------------ Check time slot availability ------------------
    const isTimeDisabled = (checkTime) => {
        const selectedDateStr = formatLocalDate(date);
        const appointmentsForDay = appointments.filter(a => a.date === selectedDateStr);
        for (let appt of appointmentsForDay) {
            const startHourMin = appt.time.split(":").map(Number);
            const apptStart = startHourMin[0]*60 + startHourMin[1];
            const apptEnd = apptStart + (serviceDurations[appt.service] || 0);

            const checkHourMin = checkTime.split(":").map(Number);
            const checkStart = checkHourMin[0]*60 + checkHourMin[1];
            const checkEnd = checkStart + (serviceDurations[service] || 0);

            if (Math.max(apptStart, checkStart) < Math.min(apptEnd, checkEnd)) {
                return true;
            }
        }
        return false;
    };

    // ------------------ Styles ------------------
    const styles = `
      @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap');
      .calendar-wrapper * { font-family: 'Open Sans', sans-serif; }
      .today-highlight { background: #ffe6f0; border-radius: 50%; color: hotpink !important; }
      .appointment-item { padding: 10px 14px; margin-bottom: 10px; border-radius: 12px; background: linear-gradient(120deg, #ffe6f0, #ffb6c1); transition: all 0.3s ease; font-weight: 500; }
      .appointment-item:hover { transform: scale(1.03); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
      .service-badge { padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; color: white; margin-left: 6px; }
      button { transition: all 0.3s ease; }
      button:hover { transform: scale(1.05); }
      select, input[type="date"] { border-radius: 8px; border: 1px solid #ccc; }
      .pending-appointment { transition: all 0.3s ease, transform 0.2s ease, background 0.3s ease; cursor: pointer; background: #fff0f5; }
      .pending-appointment:hover { transform: translateY(-4px); box-shadow: 0 6px 16px rgba(0,0,0,0.15); background: linear-gradient(120deg, #ffe6f0, #ffd1e0); }
    `;

    // ------------------ Client view ------------------
    if (role !== "admin") {
        return (
            <div className="calendar-wrapper" style={{ maxWidth: 400, margin: "auto" }}>
                <style>{styles}</style>
                <h2 style={{ marginBottom: 20 }}>Закажи термин</h2>
                <form onSubmit={handleSubmit}>
                    <label>
                        Датум:
                        <Calendar
                            value={date}
                            onChange={setDate}
                            minDate={new Date()}
                            tileClassName={({ date: d, view }) => {
                                const today = new Date();
                                if (
                                    d.getDate() === today.getDate() &&
                                    d.getMonth() === today.getMonth() &&
                                    d.getFullYear() === today.getFullYear()
                                ) {
                                    return "today-highlight";
                                }
                                return null;
                            }}
                            style={{ margin: "8px 0" }}
                        />
                    </label>
                    <label>
                        Време:
                        <select
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            required
                            style={{ width: "100%", padding: "8px", margin: "8px 0" }}
                        >
                            {timeOptions.map((t) => (
                                <option
                                    key={t}
                                    value={t}
                                    disabled={isTimeDisabled(t)}
                                    style={{
                                        backgroundColor: appointments.some(a => a.date === formatLocalDate(date) && a.time === t)
                                            ? "#ffe6f0"
                                            : "white"
                                    }}
                                >
                                    {t}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Услуга:
                        <select
                            value={service}
                            onChange={(e) => setService(e.target.value)}
                            style={{ width: "100%", padding: "8px", margin: "8px 0" }}
                        >
                            {Object.entries(services).map(([category, subservices]) => (
                                <optgroup key={category} label={category}>
                                    {subservices.map((srv) => (
                                        <option key={srv} value={srv}>{srv}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </label>
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: "100%",
                            padding: 12,
                            backgroundColor: "hotpink",
                            color: "white",
                            border: "none",
                            borderRadius: 8,
                            cursor: "pointer",
                            fontWeight: "bold",
                            marginTop: 10
                        }}
                    >
                        {loading ? "Испраќање..." : "Испрати барање"}
                    </button>
                </form>
                {message && (
                    <p style={{ color: message.type === "error" ? "red" : "green", marginTop: 10 }}>
                        {message.text}
                    </p>
                )}
            </div>
        );
    }

    // ------------------ Admin view ------------------
    const pendingAppointments = [...appointments.filter((a) => a.status === "pending")].reverse();
    const acceptedAppointments = appointments.filter((a) => a.status === "accepted");
    const selectedDateStr = formatLocalDate(selectedDate);
    const appointmentsForDay = acceptedAppointments
        .filter((a) => a.date === selectedDateStr)
        .sort((a, b) => a.time.localeCompare(b.time));

    const filteredAppointmentsForDay = filterService
        ? appointmentsForDay.filter(a => a.service === filterService)
        : appointmentsForDay;

    const getAppointmentsByTime = (timeStr) => {
        return filteredAppointmentsForDay.filter(a => {
            const start = a.time.split(":").map(Number);
            const end = start[0]*60 + start[1] + (serviceDurations[a.service] || 0);
            const [h, m] = timeStr.split(":").map(Number);
            const check = h*60 + m;
            return check >= start[0]*60+start[1] && check < end;
        });
    };

    return (
        <div className="calendar-wrapper" style={{ display: "flex", justifyContent: "space-between", padding: 20 }}>
            <style>{styles}</style>

            {/* LEFT SIDE – Pending Requests */}
            <div style={{ flex: 1, marginRight: 40 }}>
                <h2>🔔 Нови барања за термини</h2>
                {pendingAppointments.length === 0 ? (
                    <p>Нема барања во моментов.</p>
                ) : (
                    <ul style={{ listStyle: "none", padding: 0 }}>
                        {pendingAppointments.map((appt) => (
                            <li
                                key={appt.id}
                                className="pending-appointment"
                                style={{
                                    borderRadius: 12,
                                    padding: "14px",
                                    marginBottom: 12,
                                    background: "#fff0f5",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                                }}
                            >
                                <p><strong>Клиент:</strong> {appt.userEmail}</p>
                                <p><strong>Услуга:</strong>
                                    <span
                                        className="service-badge"
                                        style={{ background: serviceColors[appt.service] || "gray" }}
                                    >
                                        {appt.service}
                                    </span>
                                </p>
                                <p><strong>Датум:</strong> {appt.date}</p>
                                <p><strong>Време:</strong> {appt.time}</p>
                                <div style={{ marginTop: 10 }}>
                                    <button
                                        onClick={() => handleDecision(appt.id, "accepted")}
                                        style={{ background: "green", color: "white", marginRight: 8, borderRadius: "20px", padding: "6px 14px", border: "none", cursor: "pointer" }}
                                    >
                                        ✅ Прифати
                                    </button>
                                    <button
                                        onClick={() => handleDecision(appt.id, "rejected")}
                                        style={{ background: "red", color: "white", borderRadius: "20px", padding: "6px 14px", border: "none", cursor: "pointer" }}
                                    >
                                        ❌ Одбиј
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* RIGHT SIDE – Calendar + Drag & Drop Lists */}
            <div style={{ flex: 1 }}>
                <h2>📅 Прифатени термини</h2>

                {/* Filter by service */}
                <label>
                    Филтрирај по услуга:
                    <select
                        value={filterService}
                        onChange={(e) => setFilterService(e.target.value)}
                        style={{ marginBottom: 10, padding: 6 }}
                    >
                        <option value="">Сите</option>
                        {Object.values(services).flat().map(srv => (
                            <option key={srv} value={srv}>{srv}</option>
                        ))}
                    </select>
                </label>

                <Calendar
                    value={selectedDate}
                    onChange={setSelectedDate}
                    tileContent={({ date, view }) => {
                        if (view === "month") {
                            const dayStr = formatLocalDate(date);
                            const count = acceptedAppointments.filter((a) => a.date === dayStr).length;
                            return count > 0 ? <span style={{ color: "green" }}>●</span> : null;
                        }
                    }}
                    tileClassName={({ date, view }) => {
                        if (view === "month") {
                            const today = new Date();
                            if (
                                date.getDate() === today.getDate() &&
                                date.getMonth() === today.getMonth() &&
                                date.getFullYear() === today.getFullYear()
                            ) {
                                return "today-highlight";
                            }
                        }
                        return null;
                    }}
                />

                <h3 style={{ marginTop: 20 }}>Термини на {selectedDateStr}</h3>
                <div className="appointments-list" style={{ maxHeight: 500, overflowY: "auto", borderRadius: 10, padding: 10, background: "#fff0f5", border: "1px solid #f5c6e0" }}>
                    {Array.from({ length: 9 }, (_, i) => {
                        const hour = 12 + i;
                        return [0, 15, 30, 45].map((min) => {
                            const hourStr = String(hour).padStart(2, "0");
                            const minStr = String(min).padStart(2, "0");
                            const timeStr = `${hourStr}:${minStr}`;
                            const appointmentsThisSlot = getAppointmentsByTime(timeStr);
                            return (
                                <div key={`${hour}-${min}`} style={{ padding: "6px 0", borderBottom: "1px solid #f5c6e0" }}>
                                    <strong>{timeStr}</strong>
                                    {appointmentsThisSlot.length > 0 ? (
                                        <ul style={{ marginLeft: 20, padding: 0 }}>
                                            {appointmentsThisSlot.map((appt) => (
                                                <li key={appt.id} className="appointment-item" style={{ background: serviceColors[appt.service] || "#ddd" }} title={`Email: ${appt.userEmail}\nУслуга: ${appt.service}`} draggable onDragStart={(e) => handleDragStart(e, appt)}>
                                                    {appt.userEmail} ({appt.service})
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div style={{ marginLeft: 20, color: "#aaa" }}>—</div>
                                    )}
                                </div>
                            );
                        });
                    })}
                </div>

                {/* Drag & Drop Employee Lists */}
                <h3 style={{ marginTop: 20 }}>Пренеси термини на вработени</h3>
                <div style={{ display: "flex", gap: 10 }}>
                    {employees.map(emp => (
                        <div
                            key={emp}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, emp)}
                            style={{ flex: 1, minHeight: 150, padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
                        >
                            <h3>{emp}</h3>
                            {employeeLists[emp]?.map(appt => (
                                <div
                                    key={appt.id + Math.random()}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, appt)}
                                    style={{ padding: 8, margin: "4px 0", background: "#ffe6f0", borderRadius: 6, cursor: "grab" }}
                                >
                                    {appt.userEmail} ({appt.service})
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CalendarComponent;
