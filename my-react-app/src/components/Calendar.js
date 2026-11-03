import React, { useCallback, useEffect, useMemo, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "./Calendar.css";
import api, { errorMessage } from "../api";
import Modal from "./Modal";
import {
    allDayTimes,
    appointmentDate,
    dayHours,
    dayTimes,
    durationOf,
    employeeLabel,
    endTimeOf,
    formatDisplayDate,
    formatFriendlyDate,
    formatLocalDate,
    freeTimes,
    getEmployees,
    getServices,
    isActive,
    minutesToTime,
    salon,
    serviceColor,
    serviceGroups,
    slotProblem,
    statusLabels,
    toMinutes
} from "../salon";

const sameDay = (a, b) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

const addDays = (date, n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
};

const StatusChip = ({ status }) => (
    <span className={`status-chip status-${status}`}>{statusLabels[status] || status}</span>
);

const CalendarComponent = ({ role, syncTick, showToast }) => {
    const [appointments, setAppointments] = useState([]);
    const [myAppointments, setMyAppointments] = useState([]);
    const [loaded, setLoaded] = useState(false);

    const fetchAppointments = useCallback(async () => {
        try {
            if (role === "admin") {
                const { data } = await api.get("/appointments");
                setAppointments(data);
            } else {
                const [availability, mine] = await Promise.all([
                    api.get("/appointments/availability"),
                    api.get("/appointments/user")
                ]);
                setAppointments(availability.data);
                setMyAppointments(mine.data);
            }
        } catch (err) {
            console.error("Error fetching appointments:", err);
        } finally {
            setLoaded(true);
        }
    }, [role]);

    // syncTick changes whenever the server pushes an appointment change over the socket
    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments, syncTick]);

    if (!loaded) return <p className="calendar-loading">Се вчитува…</p>;

    return role === "admin" ? (
        <AdminView appointments={appointments} refresh={fetchAppointments} showToast={showToast} />
    ) : (
        <ClientView
            appointments={appointments}
            myAppointments={myAppointments}
            refresh={fetchAppointments}
            showToast={showToast}
        />
    );
};

/* =====================================================
   CLIENT
===================================================== */

const dayParts = [
    { label: "Претпладне", test: (m) => m < 12 * 60 },
    { label: "Попладне", test: (m) => m >= 12 * 60 && m < 17 * 60 },
    { label: "Вечер", test: (m) => m >= 17 * 60 }
];

const firstOpenDay = () => {
    let d = new Date();
    for (let i = 0; i < 14 && !dayHours(formatLocalDate(d)); i++) d = addDays(d, 1);
    return d;
};

const ClientView = ({ appointments, myAppointments, refresh, showToast }) => {
    const [service, setService] = useState(() => {
        const pre = sessionStorage.getItem("bq:preselectService");
        sessionStorage.removeItem("bq:preselectService");
        return getServices().some(s => s.name === pre) ? pre : "";
    });
    const [date, setDate] = useState(firstOpenDay);
    const [time, setTime] = useState("");
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [cancelTarget, setCancelTarget] = useState(null);
    const [cancelReason, setCancelReason] = useState("");
    const [showHistory, setShowHistory] = useState(false);

    const cfg = salon();
    const dateStr = formatLocalDate(date);
    const hours = dayHours(dateStr);
    const duration = durationOf(service);
    const maxDate = addDays(new Date(), cfg.maxDaysAhead);

    // Full day grid: every start time in opening hours, each with the reason it can't be booked (or null).
    const slots = useMemo(
        () => (service
            ? dayTimes(dateStr).map(t => ({ time: t, problem: slotProblem(appointments, { date: dateStr, time: t, service }) }))
            : []),
        [appointments, dateStr, service]
    );
    const times = useMemo(() => slots.filter(s => !s.problem).map(s => s.time), [slots]);
    const [blockedInfo, setBlockedInfo] = useState(null); // { time, message } for a tapped unavailable slot

    useEffect(() => setBlockedInfo(null), [dateStr, service]);

    // per-day "has any free time" cache for the calendar tiles
    const dayHasFree = useMemo(() => {
        const cache = {};
        return (dStr) => {
            if (!service) return true;
            if (!(dStr in cache)) cache[dStr] = freeTimes(appointments, dStr, service).length > 0;
            return cache[dStr];
        };
    }, [appointments, service]);

    const nextFreeDay = useMemo(() => {
        if (!service || times.length) return null;
        for (let i = 1; i <= 60; i++) {
            const d = addDays(date, i);
            if (d > maxDate) break;
            if (dayHasFree(formatLocalDate(d))) return d;
        }
        return null;
    }, [service, times.length, date, dayHasFree, maxDate]);

    // If someone else just took the selected slot (realtime update), clear the selection.
    useEffect(() => {
        if (time && !times.includes(time)) setTime("");
    }, [times, time]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!service) return setMessage({ type: "error", text: "Изберете услуга." });
        if (!time) return setMessage({ type: "error", text: "Изберете време." });

        setLoading(true);
        setMessage(null);
        try {
            await api.post("/appointments", { date: dateStr, time, service, note });
            setMessage({
                type: "success",
                text: `Барањето е испратено за ${formatFriendlyDate(dateStr)} во ${time}. Ќе добиете известување штом салонот го потврди.`
            });
            setTime("");
            setNote("");
            refresh();
        } catch (err) {
            setMessage({ type: "error", text: errorMessage(err, "Настана грешка при закажување.") });
            refresh();
        } finally {
            setLoading(false);
        }
    };

    const confirmCancel = async () => {
        try {
            await api.patch(`/appointments/${cancelTarget.id}/cancel`, { reason: cancelReason });
            showToast({ type: "cancelled", title: "Терминот е откажан", message: `${cancelTarget.service}, ${formatDisplayDate(cancelTarget.date)} во ${cancelTarget.time}` });
            setCancelTarget(null);
            setCancelReason("");
            refresh();
        } catch (err) {
            showToast({ type: "error", title: "Грешка", message: errorMessage(err) });
        }
    };

    const now = new Date();
    const sortByDate = (a, b) => appointmentDate(a) - appointmentDate(b);
    const upcoming = myAppointments.filter(a => isActive(a) && appointmentDate(a) > now).sort(sortByDate);
    const history = myAppointments.filter(a => !upcoming.includes(a)).sort((a, b) => sortByDate(b, a));

    return (
        <div className="calendar-wrapper calendar-client-view">
            <div className="calendar-client-layout">
                <div className="calendar-client-left">
                    <div className="calendar-client-header">
                        <p className="calendar-client-kicker">Онлајн закажување</p>
                        <h2>Закажи термин</h2>
                        <p className="calendar-client-subtitle">
                            Изберете услуга, датум и време. Терминот е потврден штом салонот го прифати.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="calendar-client-form">
                        {/* STEP 1 */}
                        <div className="calendar-field">
                            <span className="calendar-field-title"><span className="step-num">1</span> Услуга</span>
                            <div className="service-picker">
                                {Object.entries(serviceGroups()).map(([category, names]) => (
                                    <div key={category} className="service-group">
                                        <div className="service-group-title">{category}</div>
                                        <div className="service-options">
                                            {names.map(name => (
                                                <button
                                                    type="button"
                                                    key={name}
                                                    className={`service-option ${service === name ? "selected" : ""}`}
                                                    onClick={() => { setService(name); setTime(""); setMessage(null); }}
                                                >
                                                    <span className="service-option-name">{name}</span>
                                                    <span className="service-option-meta">{durationOf(name)} мин</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* STEP 2 */}
                        <div className="calendar-field">
                            <span className="calendar-field-title"><span className="step-num">2</span> Датум</span>
                            <Calendar
                                value={date}
                                onChange={(d) => { setDate(d); setTime(""); setMessage(null); }}
                                minDate={new Date()}
                                maxDate={maxDate}
                                minDetail="month"
                                tileDisabled={({ date: d, view }) => view === "month" && !dayHours(formatLocalDate(d))}
                                tileClassName={({ date: d, view }) => {
                                    if (view !== "month") return null;
                                    const classes = [];
                                    if (sameDay(d, new Date())) classes.push("today-highlight");
                                    const dStr = formatLocalDate(d);
                                    if (service && d >= addDays(new Date(), -1) && d <= maxDate && dayHours(dStr) && !dayHasFree(dStr))
                                        classes.push("day-full");
                                    return classes.join(" ") || null;
                                }}
                                locale="mk-MK"
                            />
                            <div className="calendar-legend">
                                <span><i className="legend-swatch swatch-selected" /> Избран</span>
                                {service && <span><i className="legend-swatch swatch-full" /> Нема слободни</span>}
                                <span><i className="legend-swatch swatch-closed" /> Не работиме</span>
                            </div>
                        </div>

                        {/* STEP 3 */}
                        <div className="calendar-field">
                            <span className="calendar-field-title">
                                <span className="step-num">3</span> Време · {formatFriendlyDate(dateStr)}
                                {hours && <small> (работно време {hours.open}–{hours.close})</small>}
                            </span>

                            {!service ? (
                                <p className="calendar-hint">Прво изберете услуга за да ги видите слободните термини.</p>
                            ) : (
                                <>
                                    <p className="calendar-hint">
                                        Услугата трае <strong>{duration} мин</strong>. Сивите термини не се достапни –
                                        допрете на нив за да видите зошто.
                                    </p>
                                    {times.length === 0 && (
                                        <div className="no-slots">
                                            <p>Нема слободни термини за <strong>{service}</strong> на овој ден.</p>
                                            {nextFreeDay && (
                                                <button type="button" className="bq-btn bq-btn-primary" onClick={() => setDate(nextFreeDay)}>
                                                    Прв слободен ден: {formatFriendlyDate(formatLocalDate(nextFreeDay))}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    {dayParts.map(part => {
                                        const partSlots = slots.filter(s => part.test(toMinutes(s.time)));
                                        if (!partSlots.length) return null;
                                        return (
                                            <div key={part.label} className="slot-section">
                                                <div className="slot-section-title">{part.label}</div>
                                                <div className="slot-grid">
                                                    {partSlots.map(({ time: t, problem }) => (
                                                        // aria-disabled (not `disabled`) so a tap can still explain why it's unavailable
                                                        <button
                                                            type="button"
                                                            key={t}
                                                            aria-disabled={Boolean(problem)}
                                                            aria-label={problem ? `${t} – недостапно: ${problem.message}` : `${t} – слободно`}
                                                            aria-pressed={time === t}
                                                            className={`slot ${problem ? `slot-unavailable slot-${problem.code}` : ""} ${time === t ? "slot-selected" : ""} ${blockedInfo?.time === t ? "slot-explained" : ""}`}
                                                            onClick={() => {
                                                                if (problem) {
                                                                    setBlockedInfo({ time: t, message: problem.message });
                                                                } else {
                                                                    setBlockedInfo(null);
                                                                    setTime(t);
                                                                }
                                                            }}
                                                        >
                                                            {t}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {blockedInfo && (
                                        <p className="slot-reason" role="status">
                                            <strong>{blockedInfo.time} не е достапно:</strong> {blockedInfo.message}.
                                        </p>
                                    )}
                                    <div className="slot-legend">
                                        <span><i className="legend-swatch swatch-free" /> Слободно</span>
                                        <span><i className="legend-swatch swatch-busy" /> Зафатено</span>
                                        <span><i className="legend-swatch swatch-out" /> Поминато / надвор од работно време</span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* STEP 4 */}
                        <div className="calendar-field">
                            <span className="calendar-field-title"><span className="step-num">4</span> Забелешка <small>(опционално)</small></span>
                            <textarea
                                className="calendar-input"
                                rows={2}
                                maxLength={300}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="На пр. боја, дизајн, посебни барања…"
                            />
                        </div>

                        {service && time && (
                            <div className="booking-summary">
                                <span className="booking-summary-label">Вашиот термин</span>
                                <strong>{service}</strong>
                                <span>{formatFriendlyDate(dateStr)} · {time} – {minutesToTime(toMinutes(time) + duration)}</span>
                            </div>
                        )}

                        <button type="submit" disabled={loading || !service || !time} className="calendar-submit-button">
                            {loading ? "Испраќање..." : "Испрати барање"}
                        </button>

                        {message && (
                            <p className={`calendar-message ${message.type === "error" ? "calendar-message-error" : "calendar-message-success"}`}>
                                {message.text}
                            </p>
                        )}
                    </form>
                </div>

                <div className="calendar-client-right">
                    <div className="client-notification-panel">
                        <h3>Мои термини</h3>
                        {upcoming.length === 0 ? (
                            <p className="calendar-hint">Немате претстојни термини.</p>
                        ) : (
                            <div className="client-notification-list">
                                {upcoming.map(a => (
                                    <div key={a.id} className={`client-notification-item item-${a.status}`}>
                                        <div className="item-top">
                                            <strong>{formatFriendlyDate(a.date)} · {a.time}</strong>
                                            <StatusChip status={a.status} />
                                        </div>
                                        <div>{a.service}</div>
                                        {a.employee && <small>Вработена: {employeeLabel(a.employee)}</small>}
                                        {a.status === "pending" && <small className="muted">Чека потврда од салонот</small>}
                                        <button className="bq-btn bq-btn-ghost small-btn" onClick={() => setCancelTarget(a)}>
                                            Откажи
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {history.length > 0 && (
                            <>
                                <button className="history-toggle" onClick={() => setShowHistory(s => !s)}>
                                    {showHistory ? "Сокриј историја" : `Историја (${history.length})`}
                                </button>
                                {showHistory && (
                                    <div className="client-notification-list">
                                        {history.map(a => (
                                            <div key={a.id} className="client-notification-item item-history">
                                                <div className="item-top">
                                                    <strong>{formatDisplayDate(a.date)} · {a.time}</strong>
                                                    <StatusChip status={a.status} />
                                                </div>
                                                <div>{a.service}</div>
                                                {a.rejectReason && <small>Причина: {a.rejectReason}</small>}
                                                {a.status === "cancelled" && a.cancelReason && <small>Причина: {a.cancelReason}</small>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {cancelTarget && (
                <Modal
                    title="Откажи термин"
                    onClose={() => setCancelTarget(null)}
                    actions={
                        <>
                            <button className="bq-btn bq-btn-ghost" onClick={() => setCancelTarget(null)}>Назад</button>
                            <button className="bq-btn bq-btn-danger" onClick={confirmCancel}>Откажи термин</button>
                        </>
                    }
                >
                    <div className="bq-info-row"><span className="bq-info-label">Услуга</span>{cancelTarget.service}</div>
                    <div className="bq-info-row"><span className="bq-info-label">Термин</span>{formatFriendlyDate(cancelTarget.date)} во {cancelTarget.time}</div>
                    <label style={{ marginTop: 12 }}>Причина (опционално)</label>
                    <textarea
                        placeholder="На пр. спреченост, болест…"
                        value={cancelReason}
                        onChange={e => setCancelReason(e.target.value)}
                    />
                </Modal>
            )}
        </div>
    );
};

/* =====================================================
   ADMIN
===================================================== */

const emptyManual = { clientName: "", clientPhone: "", clientEmail: "", service: "", time: "", employee: "", note: "" };

// For admins, "past"/"lead" are shown separately, everything else is a capacity warning.
const adminWarning = (appointments, appt) => {
    const p = slotProblem(appointments, appt, { ignoreId: appt.id, admin: true });
    return p && p.code !== "past" ? p.message : null;
};

const AdminView = ({ appointments, refresh, showToast }) => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [filterService, setFilterService] = useState("");
    const [draggedAppt, setDraggedAppt] = useState(null);
    const [acceptEmployee, setAcceptEmployee] = useState({});
    const [reasonModal, setReasonModal] = useState(null); // { appt, action: "rejected" | "cancelled" }
    const [reason, setReason] = useState("");
    const [manualOpen, setManualOpen] = useState(false);
    const [manual, setManual] = useState(emptyManual);
    const [busyId, setBusyId] = useState(null);

    const employees = getEmployees();
    const selectedDateStr = formatLocalDate(selectedDate);
    const todayStr = formatLocalDate(new Date());

    const pending = appointments
        .filter(a => a.status === "pending")
        .sort((a, b) => appointmentDate(a) - appointmentDate(b));
    const accepted = appointments.filter(a => a.status === "accepted");

    const dayAppointments = accepted
        .filter(a => a.date === selectedDateStr)
        .filter(a => !filterService || a.service === filterService)
        .sort((a, b) => a.time.localeCompare(b.time));

    const weekEnd = addDays(new Date(), 7);
    const stats = {
        pending: pending.length,
        today: accepted.filter(a => a.date === todayStr).length,
        week: accepted.filter(a => appointmentDate(a) >= new Date() && appointmentDate(a) <= weekEnd).length
    };

    const update = async (appt, body, successMsg) => {
        setBusyId(appt.id);
        try {
            await api.patch(`/appointments/${appt.id}`, body);
            if (successMsg) showToast({ type: body.status || "accepted", title: successMsg, message: `${appt.clientName || appt.userEmail} · ${appt.service}` });
            await refresh();
        } catch (err) {
            showToast({ type: "error", title: "Грешка", message: errorMessage(err) });
        } finally {
            setBusyId(null);
        }
    };

    const accept = (appt) => {
        const employee = acceptEmployee[appt.id];
        update(appt, { status: "accepted", ...(employee ? { employee } : {}) }, "Терминот е прифатен");
    };

    const confirmReason = async () => {
        const { appt, action } = reasonModal;
        await update(appt, { status: action, reason }, action === "rejected" ? "Барањето е одбиено" : "Терминот е откажан");
        setReasonModal(null);
        setReason("");
    };

    const deleteAppointment = async (appt) => {
        if (!window.confirm("Дали сте сигурни дека сакате трајно да го избришете терминот?")) return;
        try {
            await api.delete(`/appointments/${appt.id}`);
            await refresh();
        } catch (err) {
            showToast({ type: "error", title: "Грешка", message: errorMessage(err) });
        }
    };

    const handleDrop = (e, employeeId) => {
        e.preventDefault();
        if (draggedAppt && draggedAppt.employee !== employeeId) update(draggedAppt, { employee: employeeId });
        setDraggedAppt(null);
    };

    const submitManual = async (e) => {
        e.preventDefault();
        try {
            await api.post("/appointments/manual", {
                ...manual,
                date: selectedDateStr,
                employee: manual.employee || null
            });
            showToast({ type: "accepted", title: "Терминот е додаден", message: `${manual.clientName} · ${manual.service} · ${manual.time}` });
            setManual(emptyManual);
            setManualOpen(false);
            refresh();
        } catch (err) {
            showToast({ type: "error", title: "Грешка", message: errorMessage(err) });
        }
    };

    const clientLabel = (a) => a.clientName || a.userEmail || "Клиент";

    const employeeOptions = (current) => (
        <>
            <option value="">— Без вработена —</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
            {current && !employees.some(e => e.id === current) && (
                <option value={current}>{current} (поранешна)</option>
            )}
        </>
    );

    const manualWarning = manual.service && manual.time
        ? slotProblem(appointments, { date: selectedDateStr, time: manual.time, service: manual.service }, { admin: true })
        : null;

    return (
        <div className="calendar-wrapper admin-view">
            <div className="admin-stats">
                <div className="stat-card"><span>{stats.pending}</span>Нови барања</div>
                <div className="stat-card"><span>{stats.today}</span>Термини денес</div>
                <div className="stat-card"><span>{stats.week}</span>Следни 7 дена</div>
                <button className="bq-btn bq-btn-primary add-btn" onClick={() => setManualOpen(true)}>+ Нов термин</button>
            </div>

            <div className="admin-layout">
                {/* LEFT – pending requests */}
                <section className="admin-pending">
                    <h2>Нови барања</h2>
                    {pending.length === 0 ? (
                        <p className="calendar-hint">Нема нови барања во моментов.</p>
                    ) : (
                        <ul className="pending-list">
                            {pending.map(appt => {
                                const warning = adminWarning(appointments, appt);
                                return (
                                    <li key={appt.id} className="pending-appointment">
                                        <div className="item-top">
                                            <strong>{clientLabel(appt)}</strong>
                                            <span className="service-badge" style={{ background: serviceColor(appt.service) }}>
                                                {appt.service}
                                            </span>
                                        </div>
                                        <p>📅 {formatFriendlyDate(appt.date)} · {appt.time} – {endTimeOf(appt)}</p>
                                        {appt.clientPhone && <p>📞 <a href={`tel:${appt.clientPhone}`}>{appt.clientPhone}</a></p>}
                                        {appt.userEmail && <p className="muted">✉️ {appt.userEmail}</p>}
                                        {appt.note && <p className="appt-note">💬 {appt.note}</p>}
                                        {appointmentDate(appt) < new Date() && <p className="warn">⚠️ Времето на терминот помина</p>}
                                        {warning && <p className="warn">⚠️ {warning}</p>}
                                        <div className="pending-actions">
                                            <select
                                                value={acceptEmployee[appt.id] || ""}
                                                onChange={(e) => setAcceptEmployee(prev => ({ ...prev, [appt.id]: e.target.value }))}
                                                aria-label="Вработена"
                                            >
                                                {employeeOptions()}
                                            </select>
                                            <button className="bq-btn bq-btn-success" disabled={busyId === appt.id} onClick={() => accept(appt)}>
                                                Прифати
                                            </button>
                                            <button
                                                className="bq-btn bq-btn-danger"
                                                disabled={busyId === appt.id}
                                                onClick={() => setReasonModal({ appt, action: "rejected" })}
                                            >
                                                Одбиј
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>

                {/* RIGHT – calendar + day schedule */}
                <section className="admin-schedule">
                    <h2>Распоред</h2>

                    <Calendar
                        value={selectedDate}
                        onChange={setSelectedDate}
                        locale="mk-MK"
                        tileContent={({ date, view }) => {
                            if (view !== "month") return null;
                            const dayStr = formatLocalDate(date);
                            const count = accepted.filter(a => a.date === dayStr).length;
                            const hasPending = pending.some(a => a.date === dayStr);
                            return (count > 0 || hasPending) ? (
                                <span className="tile-dots">
                                    {count > 0 && <span className="tile-count">{count}</span>}
                                    {hasPending && <span className="tile-pending">●</span>}
                                </span>
                            ) : null;
                        }}
                        tileClassName={({ date, view }) => {
                            if (view !== "month") return null;
                            if (sameDay(date, new Date())) return "today-highlight";
                            return dayHours(formatLocalDate(date)) ? null : "day-closed";
                        }}
                    />

                    <div className="day-header">
                        <h3>{formatFriendlyDate(selectedDateStr)} ({dayAppointments.length})</h3>
                        <select value={filterService} onChange={(e) => setFilterService(e.target.value)} aria-label="Филтрирај по услуга">
                            <option value="">Сите услуги</option>
                            {getServices().map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                        </select>
                    </div>

                    <div className="appointments-list">
                        {dayAppointments.length === 0 ? (
                            <p className="calendar-hint">Нема потврдени термини за овој ден.</p>
                        ) : dayAppointments.map(appt => (
                            <div
                                key={appt.id}
                                draggable
                                onDragStart={() => setDraggedAppt(appt)}
                                className="appointment-item"
                                style={{ borderLeft: `6px solid ${serviceColor(appt.service)}` }}
                            >
                                <div className="item-top">
                                    <strong>{appt.time} – {endTimeOf(appt)}</strong>
                                    <span className="service-badge" style={{ background: serviceColor(appt.service) }}>
                                        {appt.service}
                                    </span>
                                </div>
                                <div>
                                    {clientLabel(appt)}
                                    {appt.clientPhone && <> · <a href={`tel:${appt.clientPhone}`}>{appt.clientPhone}</a></>}
                                    {appt.createdByAdmin && <small className="muted"> (додаден од салон)</small>}
                                </div>
                                {appt.note && <div className="appt-note">💬 {appt.note}</div>}
                                <div className="appt-actions">
                                    <select
                                        value={appt.employee || ""}
                                        onChange={(e) => update(appt, { employee: e.target.value || null })}
                                        aria-label="Вработена"
                                    >
                                        {employeeOptions(appt.employee)}
                                    </select>
                                    <button className="bq-btn bq-btn-ghost small-btn" onClick={() => setReasonModal({ appt, action: "cancelled" })}>
                                        Откажи
                                    </button>
                                    <button className="icon-btn" onClick={() => deleteAppointment(appt)} title="Избриши термин">🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <h3 className="employees-title">Вработени</h3>
                    <p className="calendar-hint desktop-only">Повлечете термин врз вработена за да го доделите.</p>
                    <div className="employee-columns">
                        {employees.map(emp => {
                            const list = accepted
                                .filter(a => a.date === selectedDateStr && a.employee === emp.id)
                                .sort((a, b) => a.time.localeCompare(b.time));
                            return (
                                <div
                                    key={emp.id}
                                    className={`employee-column ${draggedAppt ? "drop-ready" : ""}`}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleDrop(e, emp.id)}
                                >
                                    <h4>{emp.label} <small>({list.length})</small></h4>
                                    {list.map(appt => (
                                        <div
                                            key={appt.id}
                                            draggable
                                            onDragStart={() => setDraggedAppt(appt)}
                                            className="appointment-item compact"
                                            style={{ background: serviceColor(appt.service) }}
                                        >
                                            <strong>{appt.time} – {endTimeOf(appt)}</strong>
                                            <br />
                                            {clientLabel(appt)}
                                            <br />
                                            <small>{appt.service}</small>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>

            {reasonModal && (
                <Modal
                    title={reasonModal.action === "rejected" ? "Одбиј барање" : "Откажи термин"}
                    onClose={() => setReasonModal(null)}
                    actions={
                        <>
                            <button className="bq-btn bq-btn-ghost" onClick={() => setReasonModal(null)}>Назад</button>
                            <button className="bq-btn bq-btn-danger" onClick={confirmReason}>
                                {reasonModal.action === "rejected" ? "Одбиј" : "Откажи термин"}
                            </button>
                        </>
                    }
                >
                    <div className="bq-info-row"><span className="bq-info-label">Клиент</span>{clientLabel(reasonModal.appt)}</div>
                    <div className="bq-info-row"><span className="bq-info-label">Услуга</span>{reasonModal.appt.service}</div>
                    <div className="bq-info-row"><span className="bq-info-label">Термин</span>{formatFriendlyDate(reasonModal.appt.date)} во {reasonModal.appt.time}</div>
                    <label style={{ marginTop: 12 }}>Причина (клиентот ќе ја види)</label>
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
                </Modal>
            )}

            {manualOpen && (
                <Modal title={`Нов термин · ${formatFriendlyDate(selectedDateStr)}`} onClose={() => setManualOpen(false)} wide>
                    <form onSubmit={submitManual}>
                        <label>Име на клиент *</label>
                        <input required value={manual.clientName} onChange={e => setManual({ ...manual, clientName: e.target.value })} />
                        <label>Телефон</label>
                        <input type="tel" value={manual.clientPhone} onChange={e => setManual({ ...manual, clientPhone: e.target.value })} />
                        <label>Е-пошта (ако има профил – ќе добие известувања)</label>
                        <input type="email" value={manual.clientEmail} onChange={e => setManual({ ...manual, clientEmail: e.target.value })} />
                        <label>Услуга *</label>
                        <select required value={manual.service} onChange={e => setManual({ ...manual, service: e.target.value })}>
                            <option value="" disabled>Изберете услуга…</option>
                            {getServices().map(s => <option key={s.name} value={s.name}>{s.name} · {s.duration} мин</option>)}
                        </select>
                        <label>Време *</label>
                        <select required value={manual.time} onChange={e => setManual({ ...manual, time: e.target.value })}>
                            <option value="" disabled>Изберете време…</option>
                            {allDayTimes().map(t => {
                                const p = manual.service
                                    ? slotProblem(appointments, { date: selectedDateStr, time: t, service: manual.service }, { admin: true })
                                    : null;
                                return (
                                    <option key={t} value={t} disabled={p?.code === "past"}>
                                        {t}{p && p.code !== "past" ? " ⚠" : ""}
                                    </option>
                                );
                            })}
                        </select>
                        {manualWarning && manualWarning.code !== "past" && (
                            <p className="warn">⚠️ {manualWarning.message}. Може да зачувате, но проверете го распоредот.</p>
                        )}
                        <label>Вработена</label>
                        <select value={manual.employee} onChange={e => setManual({ ...manual, employee: e.target.value })}>
                            {employeeOptions()}
                        </select>
                        <label>Забелешка</label>
                        <textarea value={manual.note} onChange={e => setManual({ ...manual, note: e.target.value })} />
                        <div className="bq-modal-actions">
                            <button type="button" className="bq-btn bq-btn-ghost" onClick={() => setManualOpen(false)}>Назад</button>
                            <button type="submit" className="bq-btn bq-btn-primary">Зачувај</button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default CalendarComponent;
