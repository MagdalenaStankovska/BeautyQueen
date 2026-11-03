require("dotenv").config();
// Salon time zone — appointment date/time strings are interpreted as local salon time.
process.env.TZ = process.env.TZ || "Europe/Skopje";

const express = require("express");
const http = require("http");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const multer = require("multer");
const webpush = require("web-push");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "beautyqueen_dev_secret_change_me";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "marija.stankovska@yahoo.com")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";
const DATA_DIR = __dirname;
const UPLOADS_DIR = path.join(__dirname, "uploads");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT_ORIGIN } });

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: "1mb" }));

/* ================== STORAGE HELPERS ================== */

function loadData(filename, fallback = []) {
    const fullPath = path.join(DATA_DIR, filename);
    try {
        if (!fs.existsSync(fullPath)) {
            fs.writeFileSync(fullPath, JSON.stringify(fallback, null, 2));
            return fallback;
        }
        const raw = fs.readFileSync(fullPath, "utf8").trim();
        return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
        console.error(`Could not read ${filename}, using empty data`, err);
        return fallback;
    }
}

// Write to a temp file and rename so a crash mid-write never corrupts the data file.
function saveData(filename, data) {
    const fullPath = path.join(DATA_DIR, filename);
    const tmpPath = `${fullPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    fs.renameSync(tmpPath, fullPath);
}

let lastId = 0;
function generateId() {
    const id = Math.max(Date.now(), lastId + 1);
    lastId = id;
    return id;
}

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

/* ================== SALON CONFIG ================== */

const { SALON, toMinutes, getService, isActive, slotProblem } = require("./salon-config");

const EMPLOYEES = SALON.employees.map(e => e.id);

const GALLERY_CATEGORIES = ["Маникир", "Педикир", "Lash Lift", "Депилација"];

const appointmentStart = (appt) => new Date(`${appt.date}T${appt.time}:00`);

// 2026-11-07 -> 07.11.2026 for user-facing messages
const fmtDate = (date) => String(date).split("-").reverse().join(".");

/* ================== DATA ================== */

let users = loadData("users.json");
let appointments = loadData("appointments.json");
let notifications = loadData("notifications.json");
let pushSubscriptions = loadData("push-subscriptions.json");
let galleries = loadData("galleries.json", {});
GALLERY_CATEGORIES.forEach(c => { if (!Array.isArray(galleries[c])) galleries[c] = []; });
saveData("galleries.json", galleries);

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

// Promote configured admin emails that already have accounts.
users.forEach(u => {
    if (u.email && ADMIN_EMAILS.includes(normalizeEmail(u.email))) u.role = "admin";
});

/* ================== WEB PUSH ================== */

function loadVapidKeys() {
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    }
    const file = path.join(DATA_DIR, "vapid.json");
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
    const keys = webpush.generateVAPIDKeys();
    fs.writeFileSync(file, JSON.stringify(keys, null, 2));
    return keys;
}

const vapidKeys = loadVapidKeys();
webpush.setVapidDetails(
    `mailto:${ADMIN_EMAILS[0] || "admin@beautyqueen.mk"}`,
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

function sendPush(userEmail, payload) {
    const subs = pushSubscriptions.filter(s => s.email === userEmail);
    subs.forEach(s => {
        webpush.sendNotification(s.subscription, JSON.stringify(payload)).catch(err => {
            // 404/410 means the browser revoked the subscription
            if (err.statusCode === 404 || err.statusCode === 410) {
                pushSubscriptions = pushSubscriptions.filter(p => p.subscription.endpoint !== s.subscription.endpoint);
                saveData("push-subscriptions.json", pushSubscriptions);
            } else {
                console.error("Push error", err.statusCode, err.body);
            }
        });
    });
}

/* ================== NOTIFICATIONS ================== */

const adminEmails = () => users.filter(u => u.role === "admin").map(u => u.email);

function createNotification({ userEmail, message, type, appointmentId = null, title = "Beauty Queen" }) {
    if (!userEmail) return null;
    const notification = {
        id: generateId(),
        userEmail,
        title,
        message,
        type, // request | accepted | rejected | cancelled | reminder
        appointmentId,
        isRead: false,
        createdAt: new Date().toISOString()
    };

    notifications.push(notification);
    saveData("notifications.json", notifications);

    io.to(`user:${userEmail}`).emit("notification:new", notification);
    sendPush(userEmail, { title, body: message, tag: `bq-${notification.id}`, url: "/?section=notifications" });
    return notification;
}

function notifyAdmins(payload) {
    adminEmails().forEach(email => createNotification({ ...payload, userEmail: email }));
}

// Tell every connected client that slots changed, and the owner + admins the full record.
function broadcastAppointment(appt, action) {
    io.to("admins").emit("appointment:changed", { action, appointment: appt });
    if (appt.userEmail) io.to(`user:${appt.userEmail}`).emit("appointment:changed", { action, appointment: appt });
    io.emit("availability:changed");
}

/* ================== AUTH ================== */

const publicUser = (u) => ({ email: u.email, role: u.role, name: u.name || "", phone: u.phone || "" });

function signToken(user) {
    return jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "30d" });
}

function authenticateToken(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Не сте најавени" });

    jwt.verify(token, JWT_SECRET, (err, payload) => {
        if (err) return res.status(401).json({ message: "Сесијата истече, најавете се повторно" });
        const user = users.find(u => u.email === payload.email);
        if (!user) return res.status(401).json({ message: "Корисникот не постои" });
        req.user = { email: user.email, role: user.role };
        next();
    });
}

function authorizeAdmin(req, res, next) {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Само за администратор" });
    next();
}

app.post("/register", async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    const name = String(req.body.name || "").trim();
    const phone = String(req.body.phone || "").trim();

    if (!email || !password)
        return res.status(400).json({ message: "Внесете е-пошта и лозинка" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return res.status(400).json({ message: "Невалидна е-пошта" });
    if (String(password).length < 6)
        return res.status(400).json({ message: "Лозинката мора да има најмалку 6 карактери" });
    if (users.some(u => normalizeEmail(u.email) === email))
        return res.status(400).json({ message: "Корисник со оваа е-пошта веќе постои" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = ADMIN_EMAILS.includes(email) ? "admin" : "user";

    users.push({ email, password: hashedPassword, role, name, phone, createdAt: new Date().toISOString() });
    saveData("users.json", users);

    res.status(201).json({ message: "Успешна регистрација" });
});

app.post("/login", async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    const user = users.find(u => normalizeEmail(u.email) === email);
    if (!user || !password || !(await bcrypt.compare(password, user.password)))
        return res.status(401).json({ message: "Погрешна е-пошта или лозинка" });

    res.json({ token: signToken(user), ...publicUser(user) });
});

app.get("/me", authenticateToken, (req, res) => {
    const user = users.find(u => u.email === req.user.email);
    res.json(publicUser(user));
});

app.patch("/me", authenticateToken, (req, res) => {
    const user = users.find(u => u.email === req.user.email);
    if (req.body.name !== undefined) user.name = String(req.body.name).trim().slice(0, 80);
    if (req.body.phone !== undefined) user.phone = String(req.body.phone).trim().slice(0, 30);
    saveData("users.json", users);
    res.json(publicUser(user));
});

app.patch("/me/password", authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = users.find(u => u.email === req.user.email);
    if (!(await bcrypt.compare(currentPassword || "", user.password)))
        return res.status(400).json({ message: "Тековната лозинка не е точна" });
    if (String(newPassword || "").length < 6)
        return res.status(400).json({ message: "Новата лозинка мора да има најмалку 6 карактери" });
    user.password = await bcrypt.hash(newPassword, 10);
    saveData("users.json", users);
    res.json({ message: "Лозинката е променета" });
});

/* ================== AVAILABILITY ================== */

app.get("/config", (_, res) => res.json(SALON));

// Format/time checks shared by client and admin bookings. Admins may book outside opening hours.
function validateBooking({ date, time, service }, { admin = false } = {}) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Невалиден датум";
    if (!time || !/^\d{2}:\d{2}$/.test(time) || toMinutes(time) % SALON.slotStep !== 0) return "Невалидно време";
    if (!getService(service)) return "Изберете услуга";

    const minutesAhead = (appointmentStart({ date, time }) - new Date()) / 60000;
    if (minutesAhead <= 0) return "Не може да закажете термин во минатото";
    if (!admin) {
        if (minutesAhead < SALON.minLeadMinutes)
            return `Термин може да се закаже најмалку ${SALON.minLeadMinutes} минути однапред`;
        if (minutesAhead > SALON.maxDaysAhead * 1440)
            return `Термин може да се закаже најмногу ${SALON.maxDaysAhead} дена однапред`;
    }
    return null;
}

/* ================== APPOINTMENTS ================== */

// USER request appointment
app.post("/appointments", authenticateToken, (req, res) => {
    const { date, time, service } = req.body;
    const note = String(req.body.note || "").trim().slice(0, 300);

    const invalid = validateBooking({ date, time, service });
    if (invalid) return res.status(400).json({ message: invalid });

    const problem = slotProblem(appointments, { date, time, service });
    if (problem) {
        const status = problem.code === "closed" || problem.code === "hours" ? 400 : 409;
        return res.status(status).json({ message: `${problem.message}. Изберете друго време.` });
    }

    const user = users.find(u => u.email === req.user.email);
    const appointment = {
        id: generateId(),
        userEmail: user.email,
        clientName: user.name || "",
        clientPhone: user.phone || "",
        date,
        time,
        service,
        note,
        status: "pending",
        employee: null,
        cancelReason: null,
        rejectReason: null,
        createdAt: new Date().toISOString(),
        reminders: { day: false, hour: false }
    };

    appointments.push(appointment);
    saveData("appointments.json", appointments);

    notifyAdmins({
        type: "request",
        appointmentId: appointment.id,
        title: "Ново барање за термин",
        message: `📅 ${user.name || user.email} бара термин: ${service}, ${fmtDate(date)} во ${time}`
    });
    broadcastAppointment(appointment, "created");

    res.status(201).json(appointment);
});

// ADMIN create appointment directly (phone / walk-in clients) — accepted immediately
app.post("/appointments/manual", authenticateToken, authorizeAdmin, (req, res) => {
    const { date, time, service, employee } = req.body;
    const clientName = String(req.body.clientName || "").trim();
    const clientPhone = String(req.body.clientPhone || "").trim();
    const clientEmail = normalizeEmail(req.body.clientEmail);

    if (!clientName) return res.status(400).json({ message: "Внесете име на клиент" });
    // admins can override hours/capacity (the UI warns them); only format and past-time are enforced
    const invalid = validateBooking({ date, time, service }, { admin: true });
    if (invalid) return res.status(400).json({ message: invalid });
    if (employee && !EMPLOYEES.includes(employee)) return res.status(400).json({ message: "Непознат вработен" });

    const registered = clientEmail && users.find(u => normalizeEmail(u.email) === clientEmail);
    const appointment = {
        id: generateId(),
        userEmail: registered ? registered.email : null,
        clientName,
        clientPhone,
        date,
        time,
        service,
        note: String(req.body.note || "").trim().slice(0, 300),
        status: "accepted",
        employee: employee || null,
        cancelReason: null,
        rejectReason: null,
        createdAt: new Date().toISOString(),
        createdByAdmin: true,
        reminders: { day: false, hour: false }
    };

    appointments.push(appointment);
    saveData("appointments.json", appointments);

    if (appointment.userEmail) {
        createNotification({
            userEmail: appointment.userEmail,
            type: "accepted",
            appointmentId: appointment.id,
            title: "Термин закажан",
            message: `✅ Закажан ви е термин: ${service}, ${fmtDate(date)} во ${time}`
        });
    }
    broadcastAppointment(appointment, "created");
    res.status(201).json(appointment);
});

// USER get own appointments
app.get("/appointments/user", authenticateToken, (req, res) => {
    res.json(appointments.filter(a => a.userEmail === req.user.email));
});

// AUTHENTICATED users get anonymised slot data for the booking UI
app.get("/appointments/availability", authenticateToken, (_, res) => {
    res.json(
        appointments.filter(isActive).map(a => ({
            id: a.id,
            date: a.date,
            time: a.time,
            service: a.service,
            status: a.status,
            employee: a.employee
        }))
    );
});

// ADMIN get all
app.get("/appointments", authenticateToken, authorizeAdmin, (_, res) => {
    res.json(appointments);
});

// ADMIN accept / reject / cancel / assign employee
app.patch("/appointments/:id", authenticateToken, authorizeAdmin, (req, res) => {
    const { status, employee, reason } = req.body;
    const appt = appointments.find(a => String(a.id) === req.params.id);
    if (!appt) return res.status(404).json({ message: "Терминот не постои" });

    if (employee !== undefined) {
        if (employee !== null && !EMPLOYEES.includes(employee))
            return res.status(400).json({ message: "Непознат вработен" });
        appt.employee = employee;
    }

    if (status && status !== appt.status) {
        if (!["accepted", "rejected", "cancelled"].includes(status))
            return res.status(400).json({ message: "Невалиден статус" });

        appt.status = status;
        const when = `${appt.service}, ${fmtDate(appt.date)} во ${appt.time}`;

        if (status === "accepted") {
            appt.reminders = { day: false, hour: false };
            createNotification({
                userEmail: appt.userEmail,
                type: "accepted",
                appointmentId: appt.id,
                title: "Терминот е потврден",
                message: `✅ Вашиот термин е потврден: ${when}`
            });
        } else if (status === "rejected") {
            appt.rejectReason = String(reason || "").trim() || null;
            createNotification({
                userEmail: appt.userEmail,
                type: "rejected",
                appointmentId: appt.id,
                title: "Терминот е одбиен",
                message: `❌ За жал, терминот (${when}) не може да се прифати.${appt.rejectReason ? ` Причина: ${appt.rejectReason.replace(/[.!]?$/, ".")}` : ""} Ве молиме изберете друг термин.`
            });
        } else if (status === "cancelled") {
            appt.cancelReason = String(reason || "").trim() || "Откажан од салонот";
            appt.cancelledBy = "admin";
            createNotification({
                userEmail: appt.userEmail,
                type: "cancelled",
                appointmentId: appt.id,
                title: "Терминот е откажан",
                message: `⚠️ Салонот го откажа терминот (${when}). Причина: ${appt.cancelReason}`
            });
        }
    }

    saveData("appointments.json", appointments);
    broadcastAppointment(appt, "updated");
    res.json(appt);
});

// USER cancel own appointment (with reason)
app.patch("/appointments/:id/cancel", authenticateToken, (req, res) => {
    const appt = appointments.find(a => String(a.id) === req.params.id);
    if (!appt) return res.status(404).json({ message: "Терминот не постои" });
    if (appt.userEmail !== req.user.email) return res.status(403).json({ message: "Немате пристап" });
    if (!isActive(appt)) return res.status(400).json({ message: "Терминот не може да се откаже" });
    if (appointmentStart(appt) <= new Date()) return res.status(400).json({ message: "Терминот веќе помина" });

    appt.status = "cancelled";
    appt.cancelReason = String(req.body.reason || "").trim() || "Без наведена причина";
    appt.cancelledBy = "client";
    saveData("appointments.json", appointments);

    const user = users.find(u => u.email === appt.userEmail);
    notifyAdmins({
        type: "cancelled",
        appointmentId: appt.id,
        title: "Откажан термин",
        message: `❌ ${user?.name || appt.userEmail} го откажа терминот: ${appt.service}, ${fmtDate(appt.date)} во ${appt.time}`
    });
    broadcastAppointment(appt, "updated");

    res.json(appt);
});

// ADMIN delete
app.delete("/appointments/:id", authenticateToken, authorizeAdmin, (req, res) => {
    const index = appointments.findIndex(a => String(a.id) === req.params.id);
    if (index === -1) return res.status(404).json({ message: "Терминот не постои" });

    const [removed] = appointments.splice(index, 1);
    saveData("appointments.json", appointments);
    broadcastAppointment(removed, "deleted");

    res.json({ message: "Терминот е избришан" });
});

/* ================== NOTIFICATIONS API ================== */

app.get("/notifications", authenticateToken, (req, res) => {
    res.json(
        notifications
            .filter(n => n.userEmail === req.user.email)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 200)
    );
});

app.patch("/notifications/read-all", authenticateToken, (req, res) => {
    notifications.forEach(n => {
        if (n.userEmail === req.user.email) n.isRead = true;
    });
    saveData("notifications.json", notifications);
    res.json({ success: true });
});

app.patch("/notifications/:id/read", authenticateToken, (req, res) => {
    const n = notifications.find(n => String(n.id) === req.params.id && n.userEmail === req.user.email);
    if (!n) return res.status(404).json({ message: "Известувањето не постои" });

    n.isRead = true;
    saveData("notifications.json", notifications);
    res.json({ success: true });
});

app.delete("/notifications", authenticateToken, (req, res) => {
    notifications = notifications.filter(n => n.userEmail !== req.user.email);
    saveData("notifications.json", notifications);
    res.json({ success: true });
});

/* ================== PUSH API ================== */

app.get("/push/public-key", (_, res) => res.json({ publicKey: vapidKeys.publicKey }));

app.post("/push/subscribe", authenticateToken, (req, res) => {
    const { subscription } = req.body;
    if (!subscription?.endpoint) return res.status(400).json({ message: "Невалидна претплата" });

    pushSubscriptions = pushSubscriptions.filter(s => s.subscription.endpoint !== subscription.endpoint);
    pushSubscriptions.push({ email: req.user.email, subscription, createdAt: new Date().toISOString() });
    saveData("push-subscriptions.json", pushSubscriptions);
    res.status(201).json({ success: true });
});

app.post("/push/unsubscribe", authenticateToken, (req, res) => {
    const endpoint = req.body.endpoint;
    pushSubscriptions = pushSubscriptions.filter(s => s.subscription.endpoint !== endpoint);
    saveData("push-subscriptions.json", pushSubscriptions);
    res.json({ success: true });
});

/* ================== GALLERY ================== */

const upload = multer({
    storage: multer.diskStorage({
        destination: (_, __, cb) => cb(null, UPLOADS_DIR),
        filename: (_, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "");
            cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_, file, cb) => cb(null, file.mimetype.startsWith("image/"))
});

app.use("/uploads", express.static(UPLOADS_DIR, { maxAge: "7d" }));

app.get("/gallery", (_, res) => res.json(galleries));

app.post("/upload", authenticateToken, authorizeAdmin, upload.single("image"), (req, res) => {
    const { category } = req.body;
    if (!req.file) return res.status(400).json({ message: "Изберете слика (до 10MB)" });
    if (!GALLERY_CATEGORIES.includes(category)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: "Непозната категорија" });
    }

    const imagePath = `/uploads/${req.file.filename}`;
    galleries[category].push(imagePath);
    saveData("galleries.json", galleries);
    io.emit("gallery:changed");

    res.status(201).json({ imagePath, category });
});

app.delete("/delete-image", authenticateToken, authorizeAdmin, (req, res) => {
    const { imagePath } = req.body;
    const filename = path.basename(String(imagePath || ""));
    if (!filename) return res.status(400).json({ message: "Нема слика" });

    GALLERY_CATEGORIES.forEach(c => {
        galleries[c] = galleries[c].filter(p => path.basename(p) !== filename);
    });
    saveData("galleries.json", galleries);
    fs.unlink(path.join(UPLOADS_DIR, filename), () => {});
    io.emit("gallery:changed");

    res.json({ message: "Сликата е избришана" });
});

/* ================== REMINDERS (CRON) ================== */

function runReminders() {
    const now = new Date();
    let changed = false;

    appointments
        .filter(a => a.status === "accepted")
        .forEach(appt => {
            const minutesLeft = (appointmentStart(appt) - now) / 60000;
            if (minutesLeft <= 0) return;
            appt.reminders = appt.reminders || { day: false, hour: false };

            if (minutesLeft <= 60 && !appt.reminders.hour) {
                appt.reminders.hour = true;
                appt.reminders.day = true;
                changed = true;
                createNotification({
                    userEmail: appt.userEmail,
                    type: "reminder",
                    appointmentId: appt.id,
                    title: "Терминот е за 1 час",
                    message: `⏰ Потсетник: терминот за ${appt.service} е денес во ${appt.time}. Ве очекуваме!`
                });
                notifyAdmins({
                    type: "reminder",
                    appointmentId: appt.id,
                    title: "Следен термин за 1 час",
                    message: `⏰ ${appt.clientName || appt.userEmail} – ${appt.service} во ${appt.time}${appt.employee ? ` (${appt.employee})` : ""}`
                });
            } else if (minutesLeft <= 24 * 60 && minutesLeft > 60 && !appt.reminders.day) {
                appt.reminders.day = true;
                changed = true;
                const isToday = appt.date === now.toLocaleDateString("sv-SE");
                createNotification({
                    userEmail: appt.userEmail,
                    type: "reminder",
                    appointmentId: appt.id,
                    title: "Потсетник за термин",
                    message: `⏰ Потсетник: имате термин ${isToday ? "денес" : "утре"} во ${appt.time} – ${appt.service}.`
                });
            }
        });

    if (changed) saveData("appointments.json", appointments);
}

cron.schedule("* * * * *", runReminders);

/* ================== SOCKETS ================== */

io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("unauthorized"));
    jwt.verify(token, JWT_SECRET, (err, payload) => {
        const user = !err && users.find(u => u.email === payload.email);
        if (!user) return next(new Error("unauthorized"));
        socket.user = { email: user.email, role: user.role };
        next();
    });
});

io.on("connection", (socket) => {
    socket.join(`user:${socket.user.email}`);
    if (socket.user.role === "admin") socket.join("admins");
});

/* ================== START ================== */

app.get("/", (_, res) => res.send("✅ Beauty Queen backend running"));

app.use((err, req, res, next) => {
    console.error(err);
    if (err instanceof multer.MulterError)
        return res.status(400).json({ message: "Сликата е преголема (макс. 10MB)" });
    res.status(500).json({ message: "Грешка на серверот" });
});

server.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    runReminders();
});
