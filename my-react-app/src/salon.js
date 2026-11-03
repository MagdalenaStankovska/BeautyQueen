// Salon rules. Defaults mirror backend/salon-config.js; the live values are loaded from GET /config at startup.

const DEFAULT_CONFIG = {
    name: "Beauty Queen Studio",
    address: "ул. Антон Панов бр. 20, Капиштец, Скопје",
    phone: "+389 70 283 453",
    email: "marija.stankovska@yahoo.com",
    instagram: "https://www.instagram.com/_beautyqueenstudio_/",
    hours: {
        0: null,
        1: { open: "11:00", close: "20:00" },
        2: { open: "11:00", close: "20:00" },
        3: { open: "11:00", close: "20:00" },
        4: { open: "11:00", close: "20:00" },
        5: { open: "11:00", close: "20:00" },
        6: { open: "10:00", close: "16:00" }
    },
    slotStep: 15,
    minLeadMinutes: 30,
    maxDaysAhead: 90,
    employees: [
        { id: "Sara", label: "Сара" },
        { id: "Izabela", label: "Изабела" },
        { id: "Marija", label: "Марија" }
    ],
    resources: {
        manicure: { label: "маса за маникир", count: 2 },
        pedicure: { label: "столот за педикир", count: 1 },
        bed: { label: "креветот за депилација", count: 1 },
        lash: { label: "местото за трепки", count: 1 },
        brow: { label: "местото за веѓи", count: 1 }
    },
    services: [
        { name: "Маникир (само гел лак)", category: "Маникир", duration: 75, resource: "manicure" },
        { name: "Маникир (наливни)", category: "Маникир", duration: 105, resource: "manicure" },
        { name: "Педикир (гел лак на нозе)", category: "Педикир", duration: 45, resource: "pedicure" },
        { name: "Педикир (целосен+gel лак)", category: "Педикир", duration: 75, resource: "pedicure" },
        { name: "Lash Lift", category: "Трепки и веѓи", duration: 60, resource: "lash" },
        { name: "Чупање веѓи", category: "Трепки и веѓи", duration: 30, resource: "brow" },
        { name: "Brow Lam", category: "Трепки и веѓи", duration: 60, resource: "brow" },
        { name: "Депилација (интима)", category: "Депилација", duration: 35, resource: "bed" },
        { name: "Депилација (целосна)", category: "Депилација", duration: 75, resource: "bed" },
        { name: "Депилација (раце+нозе)", category: "Депилација", duration: 45, resource: "bed" }
    ]
};

let config = DEFAULT_CONFIG;

export const applyConfig = (cfg) => {
    if (cfg && Array.isArray(cfg.services)) config = { ...DEFAULT_CONFIG, ...cfg };
};

export const salon = () => config;
export const getServices = () => config.services;
export const getService = (name) => config.services.find(s => s.name === name);
export const getEmployees = () => config.employees;
export const durationOf = (name) => getService(name)?.duration || 0;

export const serviceGroups = () =>
    config.services.reduce((groups, s) => {
        (groups[s.category] = groups[s.category] || []).push(s.name);
        return groups;
    }, {});

const categoryColors = {
    "Маникир": "#FFB6C1",
    "Педикир": "#87CEFA",
    "Трепки и веѓи": "#FFDEAD",
    "Депилација": "#98FB98"
};

const serviceColorMap = {
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

export const serviceColor = (name) =>
    serviceColorMap[name] || categoryColors[getService(name)?.category] || "#e7d3dd";

export const employeeLabel = (id) => config.employees.find(e => e.id === id)?.label || id || "—";

export const statusLabels = {
    pending: "Во чекање",
    accepted: "Потврден",
    rejected: "Одбиен",
    cancelled: "Откажан"
};

export const weekdayNames = ["Недела", "Понеделник", "Вторник", "Среда", "Четврток", "Петок", "Сабота"];
export const weekdayShort = ["Нед", "Пон", "Вто", "Сре", "Чет", "Пет", "Саб"];

/* ---------- dates & times ---------- */

export const formatLocalDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

export const formatDisplayDate = (dateStr) => {
    const [y, m, d] = dateStr.split("-");
    return `${d}.${m}.${y}`;
};

export const formatFriendlyDate = (dateStr) => {
    const d = new Date(`${dateStr}T12:00:00`);
    const today = formatLocalDate(new Date());
    const tomorrow = formatLocalDate(new Date(Date.now() + 86400000));
    if (dateStr === today) return `Денес, ${formatDisplayDate(dateStr).slice(0, 5)}`;
    if (dateStr === tomorrow) return `Утре, ${formatDisplayDate(dateStr).slice(0, 5)}`;
    return `${weekdayShort[d.getDay()]}, ${formatDisplayDate(dateStr).slice(0, 5)}`;
};

export const appointmentDate = (appt) => new Date(`${appt.date}T${appt.time || "00:00"}:00`);

export const toMinutes = (timeStr) => {
    const [h, m] = String(timeStr).split(":").map(Number);
    return h * 60 + m;
};

export const minutesToTime = (mins) =>
    `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export const endTimeOf = (appt) => minutesToTime(toMinutes(appt.time) + durationOf(appt.service));

export const dayHours = (dateStr) => config.hours[new Date(`${dateStr}T12:00:00`).getDay()] || null;

export const isActive = (a) => a.status === "pending" || a.status === "accepted";

/* ---------- availability (mirrors backend slotProblem) ---------- */

// Possible start times for a service on a day: within opening hours and finishing by closing time.
export const candidateTimes = (dateStr, service) => {
    const svc = getService(service);
    const hours = dayHours(dateStr);
    if (!svc || !hours) return [];
    const times = [];
    for (let m = toMinutes(hours.open); m + svc.duration <= toMinutes(hours.close); m += config.slotStep) {
        times.push(minutesToTime(m));
    }
    return times;
};

// Every start time inside opening hours, regardless of service length (for showing the full day grid).
export const dayTimes = (dateStr) => {
    const hours = dayHours(dateStr);
    if (!hours) return [];
    const times = [];
    for (let m = toMinutes(hours.open); m < toMinutes(hours.close); m += config.slotStep) times.push(minutesToTime(m));
    return times;
};

// Every start time across the whole day (admin manual booking may go outside hours).
export const allDayTimes = () => {
    const times = [];
    for (let m = 8 * 60; m <= 21 * 60; m += config.slotStep) times.push(minutesToTime(m));
    return times;
};

// Reason a slot can't be booked, or null. { code: past|lead|closed|hours|resource|staff, message }
export const slotProblem = (appointments, { date, time, service }, { ignoreId = null, admin = false } = {}) => {
    const svc = getService(service);
    if (!svc) return { code: "service", message: "Изберете услуга" };

    const minutesAhead = (appointmentDate({ date, time }) - new Date()) / 60000;
    if (minutesAhead <= 0) return { code: "past", message: "Времето помина" };
    if (!admin && minutesAhead < config.minLeadMinutes)
        return { code: "lead", message: `Најмалку ${config.minLeadMinutes} мин однапред` };

    const start = toMinutes(time);
    const end = start + svc.duration;

    const hours = dayHours(date);
    if (!hours) return { code: "closed", message: "Салонот не работи овој ден" };
    if (start < toMinutes(hours.open) || end > toMinutes(hours.close))
        return { code: "hours", message: `Надвор од работното време (${hours.open}–${hours.close})` };

    const overlapping = appointments.filter(a => {
        if (a.date !== date || !isActive(a) || a.id === ignoreId) return false;
        const other = getService(a.service);
        if (!other) return false;
        const s = toMinutes(a.time);
        return Math.max(start, s) < Math.min(end, s + other.duration);
    });

    const resource = config.resources[svc.resource] || { label: "местото", count: 1 };
    const sameStation = overlapping.filter(a => getService(a.service).resource === svc.resource);
    if (sameStation.length >= resource.count) {
        const busy = sameStation.map(a => `${a.time}–${endTimeOf(a)}`).join(", ");
        return { code: "resource", message: `Зафатен е ${resource.label} (${busy})` };
    }

    if (overlapping.length >= config.employees.length)
        return { code: "staff", message: "Сите вработени се зафатени" };

    return null;
};

export const freeTimes = (appointments, dateStr, service) =>
    candidateTimes(dateStr, service).filter(t => !slotProblem(appointments, { date: dateStr, time: t, service }));

/* ---------- misc ---------- */

export const timeAgo = (iso) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "сега";
    if (diff < 3600) return `пред ${Math.floor(diff / 60)} мин`;
    if (diff < 86400) return `пред ${Math.floor(diff / 3600)} ч`;
    if (diff < 7 * 86400) return `пред ${Math.floor(diff / 86400)} ден${diff >= 2 * 86400 ? "а" : ""}`;
    return new Date(iso).toLocaleDateString("mk-MK");
};
