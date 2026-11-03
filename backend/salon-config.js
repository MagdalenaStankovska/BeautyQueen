// Single source of truth for the salon's business rules. The frontend loads this via GET /config.

const SALON = {
    name: "Beauty Queen Studio",
    address: "ул. Антон Панов бр. 20, Капиштец, Скопје",
    phone: "+389 70 283 453",
    email: "marija.stankovska@yahoo.com",
    instagram: "https://www.instagram.com/_beautyqueenstudio_/",

    // Opening hours per weekday (0 = Sunday). null = closed. A service must FINISH by closing time.
    hours: {
        0: null,
        1: { open: "11:00", close: "20:00" },
        2: { open: "11:00", close: "20:00" },
        3: { open: "11:00", close: "20:00" },
        4: { open: "11:00", close: "20:00" },
        5: { open: "11:00", close: "20:00" },
        6: { open: "10:00", close: "16:00" }
    },

    slotStep: 15, // minutes between possible start times
    minLeadMinutes: 30, // clients can't book closer than this to "now"
    maxDaysAhead: 90,

    employees: [
        { id: "Sara", label: "Сара" },
        { id: "Izabela", label: "Изабела" },
        { id: "Marija", label: "Марија" }
    ],

    // Physical stations — how many clients can use each at the same time
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

const toMinutes = (time) => {
    const [h, m] = String(time).split(":").map(Number);
    return h * 60 + m;
};

const minutesToTime = (mins) =>
    `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

const getService = (name) => SALON.services.find(s => s.name === name);

const dayHours = (dateStr) => SALON.hours[new Date(`${dateStr}T12:00:00`).getDay()] || null;

const isActive = (a) => a.status === "pending" || a.status === "accepted";

// Why `time` can't be booked for `service` on `dateStr`, or null if it's free.
// Returns { code, message } where code is one of: closed, hours, resource, staff
function slotProblem(appointments, { date, time, service }, { ignoreId = null, ignoreHours = false } = {}) {
    const svc = getService(service);
    if (!svc) return { code: "service", message: "Изберете услуга" };

    const start = toMinutes(time);
    const end = start + svc.duration;

    if (!ignoreHours) {
        const hours = dayHours(date);
        if (!hours) return { code: "closed", message: "Салонот не работи овој ден" };
        if (start < toMinutes(hours.open) || end > toMinutes(hours.close))
            return { code: "hours", message: `Услугата трае ${svc.duration} мин и мора да заврши до ${hours.close}` };
    }

    const overlapping = appointments.filter(a => {
        if (a.date !== date || !isActive(a) || a.id === ignoreId) return false;
        const other = getService(a.service);
        if (!other) return false;
        const s = toMinutes(a.time);
        return Math.max(start, s) < Math.min(end, s + other.duration);
    });

    const resource = SALON.resources[svc.resource];
    const sameStation = overlapping.filter(a => getService(a.service).resource === svc.resource);
    if (sameStation.length >= resource.count) {
        const busy = sameStation
            .map(a => `${a.time}–${minutesToTime(toMinutes(a.time) + getService(a.service).duration)}`)
            .join(", ");
        return { code: "resource", message: `Зафатен е ${resource.label} (${busy})` };
    }

    // Every overlapping appointment needs one staff member
    if (overlapping.length >= SALON.employees.length)
        return { code: "staff", message: "Сите вработени се зафатени во ова време" };

    return null;
}

// All start times on a day for a service (ignores availability — use slotProblem to filter).
function candidateTimes(dateStr, service) {
    const svc = getService(service);
    const hours = dayHours(dateStr);
    if (!svc || !hours) return [];
    const times = [];
    for (let m = toMinutes(hours.open); m + svc.duration <= toMinutes(hours.close); m += SALON.slotStep) {
        times.push(minutesToTime(m));
    }
    return times;
}

module.exports = { SALON, toMinutes, minutesToTime, getService, dayHours, isActive, slotProblem, candidateTimes };
