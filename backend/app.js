// Beauty Queen API. createApp() builds a fully isolated instance (own data dir, sockets, timers)
// so production (server.js) and tests use exactly the same code.

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const multer = require("multer");
const webpush = require("web-push");
const { Server } = require("socket.io");
const { SALON, toMinutes, minutesToTime, getService, isActive, slotProblem } = require("./salon-config");
const { createVerifier, normalizePhone } = require("./verification");

const EMPLOYEES = SALON.employees.map(e => e.id);
const GALLERY_CATEGORIES = ["Маникир", "Педикир", "Lash Lift", "Депилација"];
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const NOTIFICATION_RETENTION_DAYS = 90;

const LIMITS = { name: 80, phone: 30, email: 254, password: 128, note: 300, reason: 300 };

/* ================== PURE HELPERS ================== */

const normalizeEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");
const cleanText = (value, max) => (typeof value === "string" || typeof value === "number" ? String(value).trim().slice(0, max) : "");
const appointmentStart = (appt) => new Date(`${appt.date}T${appt.time}:00`);
// 2026-11-07 -> 07.11.2026 for user-facing messages
const fmtDate = (date) => String(date).split("-").reverse().join(".");

const isValidDate = (date) => {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const d = new Date(`${date}T12:00:00`);
    // round-trip rejects impossible dates such as 2026-02-31
    return !Number.isNaN(d.getTime()) && d.toLocaleDateString("sv-SE") === date;
};

const isValidTime = (time) => {
    if (typeof time !== "string" || !/^\d{2}:\d{2}$/.test(time)) return false;
    const [h, m] = time.split(":").map(Number);
    return h < 24 && m < 60 && toMinutes(time) % SALON.slotStep === 0;
};

// Format/time checks shared by client and admin bookings. Admins may book outside opening hours.
function validateBooking({ date, time, service }, { admin = false, now = new Date() } = {}) {
    if (!isValidDate(date)) return "Невалиден датум";
    if (!isValidTime(time)) return "Невалидно време";
    if (typeof service !== "string" || !getService(service)) return "Изберете услуга";

    const minutesAhead = (appointmentStart({ date, time }) - now) / 60000;
    if (minutesAhead <= 0) return "Не може да закажете термин во минатото";
    if (!admin) {
        if (minutesAhead < SALON.minLeadMinutes)
            return `Термин може да се закаже најмалку ${SALON.minLeadMinutes} минути однапред`;
        if (minutesAhead > SALON.maxDaysAhead * 1440)
            return `Термин може да се закаже најмногу ${SALON.maxDaysAhead} дена однапред`;
    }
    return null;
}

/* ================== APP FACTORY ================== */

function createApp(options = {}) {
    const env = process.env;
    const isProduction = (options.nodeEnv || env.NODE_ENV) === "production";
    const dataDir = options.dataDir || env.DATA_DIR || __dirname;
    const uploadsDir = path.join(dataDir, "uploads");
    const jwtSecret = options.jwtSecret || env.JWT_SECRET;
    const adminEmails = (options.adminEmails || env.ADMIN_EMAILS || "marija.stankovska@yahoo.com")
        .split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
    const originSetting = options.clientOrigin || env.CLIENT_ORIGIN || "*";
    // comma separated list, e.g. "https://beautyqueen.mk,https://www.beautyqueen.mk"
    const origins = originSetting.split(",").map(o => o.trim().replace(/\/$/, "")).filter(Boolean);
    const clientOrigin = origins.includes("*") ? "*" : origins;
    const log = options.logger || console;
    const rateLimitMax = options.rateLimitMax ?? 20;

    if (isProduction && (!jwtSecret || jwtSecret.length < 32))
        throw new Error("JWT_SECRET must be set to at least 32 characters in production");
    if (isProduction && clientOrigin === "*")
        throw new Error("CLIENT_ORIGIN must be set to the frontend URL in production");
    const secret = jwtSecret || "beautyqueen_dev_secret_change_me";

    const verifier = createVerifier({
        secret,
        salonName: SALON.name,
        env: options.env || env,
        isProduction,
        codeSender: options.codeSender,
        log
    });
    if (isProduction && !verifier.channels.email && !verifier.channels.sms)
        throw new Error("Account verification needs SMTP_HOST + MAIL_FROM (e-mail) and/or TWILIO_* (SMS) in production");
    if (verifier.devMode) log.log("⚠️  No SMTP configured: verification codes are printed here and shown in the app (development only).");

    /* ---------- storage ---------- */

    // A corrupt file must stop the server: silently starting empty would overwrite real data on the next save.
    function loadData(filename, fallback = []) {
        const fullPath = path.join(dataDir, filename);
        if (!fs.existsSync(fullPath)) {
            fs.writeFileSync(fullPath, JSON.stringify(fallback, null, 2));
            return fallback;
        }
        const raw = fs.readFileSync(fullPath, "utf8").trim(); // trim() also strips a UTF-8 BOM (Windows editors add one)
        if (!raw) return fallback;
        try {
            return JSON.parse(raw);
        } catch (err) {
            throw new Error(`Data file ${fullPath} is not valid JSON (${err.message}). Fix or restore it from backup before starting.`, { cause: err });
        }
    }

    // Write to a temp file and rename so a crash mid-write never corrupts the data file.
    function saveData(filename, data) {
        const fullPath = path.join(dataDir, filename);
        const tmpPath = `${fullPath}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
        fs.renameSync(tmpPath, fullPath);
    }

    let lastId = 0;
    const generateId = () => {
        lastId = Math.max(Date.now(), lastId + 1);
        return lastId;
    };

    fs.mkdirSync(uploadsDir, { recursive: true });

    // skip malformed rows (e.g. an empty user entry) instead of crashing on them later
    let users = loadData("users.json").filter(u => u && typeof u.email === "string" && u.email && u.password);
    let appointments = loadData("appointments.json").filter(a => a && a.id && a.date && a.time);
    let notifications = loadData("notifications.json");
    let pushSubscriptions = loadData("push-subscriptions.json");
    const galleries = loadData("galleries.json", {});
    GALLERY_CATEGORIES.forEach(c => { if (!Array.isArray(galleries[c])) galleries[c] = []; });

    users.forEach(u => { if (adminEmails.includes(normalizeEmail(u.email))) u.role = "admin"; });
    const findUser = (email) => users.find(u => u.email === email);

    /* ---------- web push ---------- */

    function loadVapidKeys() {
        if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)
            return { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
        const file = path.join(dataDir, "vapid.json");
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
        const keys = webpush.generateVAPIDKeys();
        fs.writeFileSync(file, JSON.stringify(keys, null, 2));
        return keys;
    }

    const vapidKeys = loadVapidKeys();
    webpush.setVapidDetails(`mailto:${SALON.email}`, vapidKeys.publicKey, vapidKeys.privateKey);
    const pushSender = options.pushSender || ((sub, payload) => webpush.sendNotification(sub, payload));

    function sendPush(userEmail, payload) {
        pushSubscriptions.filter(s => s.email === userEmail).forEach(s => {
            Promise.resolve(pushSender(s.subscription, JSON.stringify(payload))).catch(err => {
                // 404/410 means the browser revoked the subscription
                if (err.statusCode === 404 || err.statusCode === 410) {
                    pushSubscriptions = pushSubscriptions.filter(p => p.subscription.endpoint !== s.subscription.endpoint);
                    saveData("push-subscriptions.json", pushSubscriptions);
                } else {
                    log.error("Push error", err.statusCode, err.body || err.message);
                }
            });
        });
    }

    /* ---------- express + sockets ---------- */

    const app = express();
    const server = http.createServer(app);
    const io = new Server(server, { cors: { origin: clientOrigin } });

    app.disable("x-powered-by");
    if (options.trustProxy ?? env.TRUST_PROXY) app.set("trust proxy", 1);
    app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } })); // uploads are shown on the frontend origin
    app.use(cors({ origin: clientOrigin }));
    app.use(express.json({ limit: "100kb" }));
    app.use((req, _res, next) => { req.body = req.body || {}; next(); }); // Express 5 leaves body undefined without JSON

    if (!options.quiet) {
        app.use((req, res, next) => {
            const start = Date.now();
            res.on("finish", () => log.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`));
            next();
        });
    }

    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: rateLimitMax,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        message: { message: "Премногу обиди. Обидете се повторно за 15 минути." }
    });

    /* ---------- notifications ---------- */

    const adminList = () => users.filter(u => u.role === "admin").map(u => u.email);

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

    const notifyAdmins = (payload) => adminList().forEach(email => createNotification({ ...payload, userEmail: email }));

    // Tell every connected client that slots changed, and the owner + admins the full record.
    function broadcastAppointment(appt, action) {
        io.to("admins").emit("appointment:changed", { action, appointment: appt });
        if (appt.userEmail) io.to(`user:${appt.userEmail}`).emit("appointment:changed", { action, appointment: appt });
        io.emit("availability:changed");
    }

    /* ---------- auth ---------- */

    const publicUser = (u) => ({
        email: u.email,
        role: u.role,
        name: u.name || "",
        phone: u.phone || "",
        emailVerified: Boolean(u.emailVerified),
        phoneVerified: Boolean(u.phoneVerified)
    });
    const signToken = (user) => jwt.sign({ email: user.email, role: user.role }, secret, { expiresIn: "30d" });
    const nowSeconds = () => Math.floor(Date.now() / 1000);

    // A password reset ends every session that was opened before it.
    const userFromToken = (payload) => {
        const user = payload && findUser(payload.email);
        if (!user || (user.sessionsValidAfter && payload.iat < user.sessionsValidAfter)) return null;
        return user;
    };

    function authenticateToken(req, res, next) {
        const [scheme, token] = String(req.headers.authorization || "").split(" ");
        if (scheme !== "Bearer" || !token) return res.status(401).json({ message: "Не сте најавени" });

        jwt.verify(token, secret, (err, payload) => {
            if (err) return res.status(401).json({ message: "Сесијата истече, најавете се повторно" });
            const user = userFromToken(payload);
            if (!user) return res.status(401).json({ message: "Сесијата истече, најавете се повторно" });
            req.user = { email: user.email, role: user.role };
            next();
        });
    }

    function authorizeAdmin(req, res, next) {
        if (req.user.role !== "admin") return res.status(403).json({ message: "Само за администратор" });
        next();
    }

    /* ================== ROUTES ================== */

    app.get("/", (_, res) => res.send("Beauty Queen API"));

    app.get("/health", (_, res) => {
        res.json({
            status: "ok",
            uptimeSeconds: Math.round(process.uptime()),
            time: new Date().toISOString(),
            counts: { users: users.length, appointments: appointments.length, sockets: io.engine.clientsCount }
        });
    });

    app.get("/config", (_, res) => res.json({ ...SALON, verification: verifier.channels }));

    /* ---------- auth ---------- */

    const emailTaken = (email) => users.some(u => normalizeEmail(u.email) === email);
    const phoneTaken = (phone) => users.some(u => u.phoneVerified && normalizePhone(u.phone) === phone);
    const validPassword = (p) => typeof p === "string" && p.length >= 6 && p.length <= LIMITS.password;
    const passwordRule = `Лозинката мора да има од 6 до ${LIMITS.password} карактери`;
    const sendResult = (res, result, okStatus = 200) => {
        if (!result.ok) return res.status(result.status).json({ message: result.message, retryAfter: result.retryAfter });
        res.status(okStatus).json({ ...result, ok: undefined });
    };

    // Step 1: validate and send a code. The account is only created once the code is confirmed,
    // so nobody can register (or block) an e-mail address or phone number that isn't theirs.
    app.post("/register", authLimiter, async (req, res) => {
        const email = normalizeEmail(req.body.email);
        const password = req.body.password;
        const name = cleanText(req.body.name, LIMITS.name);
        const rawPhone = cleanText(req.body.phone, LIMITS.phone);
        const channel = req.body.channel === "sms" ? "sms" : "email";

        if (!email || typeof password !== "string" || !password)
            return res.status(400).json({ message: "Внесете е-пошта и лозинка" });
        if (email.length > LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
            return res.status(400).json({ message: "Невалидна е-пошта" });
        if (!validPassword(password)) return res.status(400).json({ message: passwordRule });

        const phone = rawPhone ? normalizePhone(rawPhone) : "";
        if (rawPhone && !phone) return res.status(400).json({ message: "Невалиден телефонски број (пр. 070 123 456)" });
        if (channel === "sms" && !phone) return res.status(400).json({ message: "Внесете телефонски број за потврда преку SMS" });
        if (emailTaken(email)) return res.status(400).json({ message: "Корисник со оваа е-пошта веќе постои" });
        if (channel === "sms" && phoneTaken(phone))
            return res.status(400).json({ message: "Овој телефонски број веќе е потврден на друга сметка" });

        const passwordHash = await bcrypt.hash(password, 10);
        const result = await verifier.send({
            purpose: "register",
            id: email,
            channel,
            to: channel === "sms" ? phone : email,
            data: { email, passwordHash, name, phone }
        });
        sendResult(res, result, 202);
    });

    app.post("/register/resend", authLimiter, async (req, res) => {
        const email = normalizeEmail(req.body.email);
        const pending = verifier.peek("register", email);
        if (!pending) return res.status(400).json({ message: "Регистрацијата истече. Пополнете ја формата повторно." });
        sendResult(res, await verifier.send({ purpose: "register", id: email, channel: pending.channel, to: pending.to, data: pending.data }));
    });

    // Step 2: confirm the code -> the account is created and the user is signed in.
    app.post("/register/verify", authLimiter, (req, res) => {
        const email = normalizeEmail(req.body.email);
        const result = verifier.check({ purpose: "register", id: email, code: req.body.code });
        if (!result.ok) return res.status(result.status).json({ message: result.message });

        const { passwordHash, name, phone } = result.data;
        if (emailTaken(email)) return res.status(400).json({ message: "Корисник со оваа е-пошта веќе постои" });
        if (result.channel === "sms" && phoneTaken(phone))
            return res.status(400).json({ message: "Овој телефонски број веќе е потврден на друга сметка" });

        const user = {
            email,
            password: passwordHash,
            role: adminEmails.includes(email) ? "admin" : "user",
            name,
            phone,
            emailVerified: result.channel === "email",
            phoneVerified: result.channel === "sms",
            createdAt: new Date().toISOString()
        };
        users.push(user);
        saveData("users.json", users);
        res.status(201).json({ token: signToken(user), ...publicUser(user) });
    });

    // Forgotten password: a code goes to the account's e-mail (or its verified phone).
    app.post("/password/forgot", authLimiter, async (req, res) => {
        const email = normalizeEmail(req.body.email);
        const user = users.find(u => normalizeEmail(u.email) === email);
        if (!user) return res.status(404).json({ message: "Нема сметка со оваа е-пошта" });
        const useSms = req.body.channel === "sms";
        const phone = normalizePhone(user.phone);
        if (useSms && (!user.phoneVerified || !phone))
            return res.status(400).json({ message: "Сметката нема потврден телефонски број. Изберете е-пошта." });
        sendResult(res, await verifier.send({
            purpose: "reset",
            id: user.email,
            channel: useSms ? "sms" : "email",
            to: useSms ? phone : user.email
        }));
    });

    app.post("/password/reset", authLimiter, async (req, res) => {
        const email = normalizeEmail(req.body.email);
        const { newPassword } = req.body;
        // validate before checking the code so a typo in the password doesn't burn the code
        if (!validPassword(newPassword)) return res.status(400).json({ message: passwordRule });
        const result = verifier.check({ purpose: "reset", id: email, code: req.body.code });
        if (!result.ok) return res.status(result.status).json({ message: result.message });

        const user = findUser(email);
        if (!user) return res.status(404).json({ message: "Нема сметка со оваа е-пошта" });
        const hashed = await bcrypt.hash(newPassword, 10);
        user.password = hashed;
        // the code proved ownership of the address it was sent to
        if (result.channel === "email") user.emailVerified = true;
        user.sessionsValidAfter = nowSeconds();
        saveData("users.json", users);
        res.json({ token: signToken(user), ...publicUser(user) });
    });

    app.post("/login", authLimiter, async (req, res) => {
        const email = normalizeEmail(req.body.email);
        const password = req.body.password;
        if (!email || typeof password !== "string" || !password || password.length > LIMITS.password)
            return res.status(400).json({ message: "Внесете е-пошта и лозинка" });

        const user = users.find(u => normalizeEmail(u.email) === email);
        if (!user || !(await bcrypt.compare(password, user.password)))
            return res.status(401).json({ message: "Погрешна е-пошта или лозинка" });

        res.json({ token: signToken(user), ...publicUser(user) });
    });

    app.get("/me", authenticateToken, (req, res) => res.json(publicUser(findUser(req.user.email))));

    app.patch("/me", authenticateToken, (req, res) => {
        const user = findUser(req.user.email);
        if (req.body.name !== undefined) user.name = cleanText(req.body.name, LIMITS.name);
        if (req.body.phone !== undefined) {
            const raw = cleanText(req.body.phone, LIMITS.phone);
            const phone = raw ? normalizePhone(raw) : "";
            if (raw && !phone) return res.status(400).json({ message: "Невалиден телефонски број (пр. 070 123 456)" });
            if (phone !== normalizePhone(user.phone)) user.phoneVerified = false;
            user.phone = phone;
        }
        saveData("users.json", users);
        res.json(publicUser(user));
    });

    app.patch("/me/password", authLimiter, authenticateToken, async (req, res) => {
        const { currentPassword, newPassword } = req.body;
        const user = findUser(req.user.email);
        if (typeof currentPassword !== "string" || !(await bcrypt.compare(currentPassword, user.password)))
            return res.status(400).json({ message: "Тековната лозинка не е точна" });
        if (typeof newPassword !== "string" || newPassword.length < 6 || newPassword.length > LIMITS.password)
            return res.status(400).json({ message: `Новата лозинка мора да има од 6 до ${LIMITS.password} карактери` });
        user.password = await bcrypt.hash(newPassword, 10);
        saveData("users.json", users);
        res.json({ message: "Лозинката е променета" });
    });

    /* ---------- appointments ---------- */

    // USER request appointment. The check + insert below is synchronous, so concurrent requests can't double-book.
    app.post("/appointments", authenticateToken, (req, res) => {
        const { date, time, service } = req.body;
        const note = cleanText(req.body.note, LIMITS.note);

        const invalid = validateBooking({ date, time, service });
        if (invalid) return res.status(400).json({ message: invalid });

        const problem = slotProblem(appointments, { date, time, service });
        if (problem) {
            const status = problem.code === "closed" || problem.code === "hours" ? 400 : 409;
            return res.status(status).json({ message: `${problem.message}. Изберете друго време.` });
        }

        // A client can't be in two chairs at once: block overlaps with their own active bookings.
        const start = toMinutes(time);
        const end = start + getService(service).duration;
        const clash = appointments.find(a => a.userEmail === req.user.email && a.date === date && isActive(a) && getService(a.service) &&
            Math.max(start, toMinutes(a.time)) < Math.min(end, toMinutes(a.time) + getService(a.service).duration));
        if (clash) {
            const range = `${clash.time}–${minutesToTime(toMinutes(clash.time) + getService(clash.service).duration)}`;
            return res.status(409).json({ message: `Веќе имате термин во ова време (${clash.service}, ${range}). Изберете друго време.` });
        }

        const user = findUser(req.user.email);
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

    // ADMIN create appointment directly (phone / walk-in clients) — accepted immediately.
    // Admins may override hours/capacity (the UI warns them); only format and past-time are enforced.
    app.post("/appointments/manual", authenticateToken, authorizeAdmin, (req, res) => {
        const { date, time, service, employee } = req.body;
        const clientName = cleanText(req.body.clientName, LIMITS.name);
        const clientPhone = cleanText(req.body.clientPhone, LIMITS.phone);
        const clientEmail = normalizeEmail(req.body.clientEmail);

        if (!clientName) return res.status(400).json({ message: "Внесете име на клиент" });
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
            note: cleanText(req.body.note, LIMITS.note),
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

        createNotification({
            userEmail: appointment.userEmail,
            type: "accepted",
            appointmentId: appointment.id,
            title: "Термин закажан",
            message: `✅ Закажан ви е термин: ${service}, ${fmtDate(date)} во ${time}`
        });
        broadcastAppointment(appointment, "created");
        res.status(201).json(appointment);
    });

    app.get("/appointments/user", authenticateToken, (req, res) => {
        res.json(appointments.filter(a => a.userEmail === req.user.email));
    });

    // Anonymised slot data for the booking UI — only today and later is relevant.
    app.get("/appointments/availability", authenticateToken, (_, res) => {
        const today = new Date().toLocaleDateString("sv-SE");
        res.json(
            appointments
                .filter(a => isActive(a) && a.date >= today)
                .map(a => ({ id: a.id, date: a.date, time: a.time, service: a.service, status: a.status, employee: a.employee }))
        );
    });

    app.get("/appointments", authenticateToken, authorizeAdmin, (_, res) => res.json(appointments));

    // ADMIN accept / reject / cancel / assign employee
    app.patch("/appointments/:id", authenticateToken, authorizeAdmin, (req, res) => {
        const { status, employee } = req.body;
        const reason = cleanText(req.body.reason, LIMITS.reason);
        const appt = appointments.find(a => String(a.id) === req.params.id);
        if (!appt) return res.status(404).json({ message: "Терминот не постои" });

        if (status !== undefined && !["accepted", "rejected", "cancelled"].includes(status))
            return res.status(400).json({ message: "Невалиден статус" });
        if (employee !== undefined && employee !== null && !EMPLOYEES.includes(employee))
            return res.status(400).json({ message: "Непознат вработен" });

        if (employee !== undefined) appt.employee = employee;

        if (status && status !== appt.status) {
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
                appt.rejectReason = reason || null;
                createNotification({
                    userEmail: appt.userEmail,
                    type: "rejected",
                    appointmentId: appt.id,
                    title: "Терминот е одбиен",
                    message: `❌ За жал, терминот (${when}) не може да се прифати.${reason ? ` Причина: ${reason.replace(/[.!]?$/, ".")}` : ""} Ве молиме изберете друг термин.`
                });
            } else {
                appt.cancelReason = reason || "Откажан од салонот";
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
        appt.cancelReason = cleanText(req.body.reason, LIMITS.reason) || "Без наведена причина";
        appt.cancelledBy = "client";
        saveData("appointments.json", appointments);

        const user = findUser(appt.userEmail);
        notifyAdmins({
            type: "cancelled",
            appointmentId: appt.id,
            title: "Откажан термин",
            message: `❌ ${user?.name || appt.userEmail} го откажа терминот: ${appt.service}, ${fmtDate(appt.date)} во ${appt.time}`
        });
        broadcastAppointment(appt, "updated");
        res.json(appt);
    });

    app.delete("/appointments/:id", authenticateToken, authorizeAdmin, (req, res) => {
        const index = appointments.findIndex(a => String(a.id) === req.params.id);
        if (index === -1) return res.status(404).json({ message: "Терминот не постои" });
        const [removed] = appointments.splice(index, 1);
        saveData("appointments.json", appointments);
        broadcastAppointment(removed, "deleted");
        res.json({ message: "Терминот е избришан" });
    });

    /* ---------- notifications ---------- */

    app.get("/notifications", authenticateToken, (req, res) => {
        res.json(
            notifications
                .filter(n => n.userEmail === req.user.email)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 200)
        );
    });

    app.patch("/notifications/read-all", authenticateToken, (req, res) => {
        notifications.forEach(n => { if (n.userEmail === req.user.email) n.isRead = true; });
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

    /* ---------- push ---------- */

    app.get("/push/public-key", (_, res) => res.json({ publicKey: vapidKeys.publicKey }));

    app.post("/push/subscribe", authenticateToken, (req, res) => {
        const { subscription } = req.body;
        if (typeof subscription?.endpoint !== "string" || !/^https:\/\//.test(subscription.endpoint) || !subscription.keys)
            return res.status(400).json({ message: "Невалидна претплата" });
        pushSubscriptions = pushSubscriptions.filter(s => s.subscription.endpoint !== subscription.endpoint);
        pushSubscriptions.push({
            email: req.user.email,
            subscription: { endpoint: subscription.endpoint, keys: subscription.keys },
            createdAt: new Date().toISOString()
        });
        saveData("push-subscriptions.json", pushSubscriptions);
        res.status(201).json({ success: true });
    });

    app.post("/push/unsubscribe", authenticateToken, (req, res) => {
        const { endpoint } = req.body;
        // only the owner can remove their subscription
        pushSubscriptions = pushSubscriptions.filter(s => !(s.subscription.endpoint === endpoint && s.email === req.user.email));
        saveData("push-subscriptions.json", pushSubscriptions);
        res.json({ success: true });
    });

    /* ---------- gallery ---------- */

    const upload = multer({
        storage: multer.diskStorage({
            destination: (_, __, cb) => cb(null, uploadsDir),
            filename: (_, file, cb) => {
                const ext = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" }[file.mimetype];
                cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
            }
        }),
        limits: { fileSize: 10 * 1024 * 1024, files: 1 },
        // no SVG: it can carry scripts
        fileFilter: (_, file, cb) => cb(null, ALLOWED_IMAGE_TYPES.includes(file.mimetype))
    });

    app.use("/uploads", express.static(uploadsDir, { maxAge: "7d", index: false, dotfiles: "deny" }));

    app.get("/gallery", (_, res) => res.json(galleries));

    app.post("/upload", authenticateToken, authorizeAdmin, upload.single("image"), (req, res) => {
        const { category } = req.body;
        if (!req.file) return res.status(400).json({ message: "Изберете слика (JPG, PNG, WEBP или GIF до 10MB)" });
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
        const filename = path.basename(typeof req.body.imagePath === "string" ? req.body.imagePath : "");
        const known = filename && GALLERY_CATEGORIES.some(c => galleries[c].some(p => path.basename(p) === filename));
        if (!known) return res.status(404).json({ message: "Сликата не постои" });

        GALLERY_CATEGORIES.forEach(c => { galleries[c] = galleries[c].filter(p => path.basename(p) !== filename); });
        saveData("galleries.json", galleries);
        fs.unlink(path.join(uploadsDir, filename), () => {});
        io.emit("gallery:changed");
        res.json({ message: "Сликата е избришана" });
    });

    /* ---------- errors ---------- */

    app.use((req, res) => res.status(404).json({ message: "Не постои" }));

    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        if (err.type === "entity.parse.failed") return res.status(400).json({ message: "Невалиден JSON" });
        if (err.type === "entity.too.large") return res.status(413).json({ message: "Барањето е преголемо" });
        if (err instanceof multer.MulterError)
            return res.status(400).json({ message: err.code === "LIMIT_FILE_SIZE" ? "Сликата е преголема (макс. 10MB)" : "Невалиден фајл" });
        log.error(err);
        res.status(500).json({ message: "Грешка на серверот" });
    });

    /* ================== REMINDERS ================== */

    function runReminders(now = new Date()) {
        let changed = false;

        appointments.filter(a => a.status === "accepted").forEach(appt => {
            const minutesLeft = (appointmentStart(appt) - now) / 60000;
            if (!(minutesLeft > 0)) return;
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

    // keeps notifications.json from growing forever
    function pruneNotifications(now = new Date()) {
        const cutoff = now.getTime() - NOTIFICATION_RETENTION_DAYS * 86400000;
        const before = notifications.length;
        notifications = notifications.filter(n => new Date(n.createdAt).getTime() >= cutoff);
        if (notifications.length !== before) saveData("notifications.json", notifications);
    }

    /* ================== SOCKETS ================== */

    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (typeof token !== "string") return next(new Error("unauthorized"));
        jwt.verify(token, secret, (err, payload) => {
            const user = !err && userFromToken(payload);
            if (!user) return next(new Error("unauthorized"));
            socket.user = { email: user.email, role: user.role };
            next();
        });
    });

    io.on("connection", (socket) => {
        socket.join(`user:${socket.user.email}`);
        if (socket.user.role === "admin") socket.join("admins");
    });

    /* ================== LIFECYCLE ================== */

    const tasks = [];

    function start(port) {
        return new Promise((resolve, reject) => {
            server.once("error", reject);
            server.listen(port, () => {
                pruneNotifications();
                runReminders();
                tasks.push(cron.schedule("* * * * *", () => runReminders()));
                tasks.push(cron.schedule("0 4 * * *", () => pruneNotifications()));
                resolve(server.address().port);
            });
        });
    }

    function close() {
        tasks.forEach(t => t.stop());
        return new Promise((resolve) => {
            io.close(); // also closes the http server
            server.closeAllConnections?.();
            setImmediate(resolve);
        });
    }

    return { app, server, io, start, close, runReminders, pruneNotifications, signToken };
}

module.exports = { createApp, validateBooking, isValidDate, isValidTime, normalizeEmail, cleanText, fmtDate };
