const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

const app = express();
const PORT = 4000;
const JWT_SECRET = "your_jwt_secret_key_here";
const ADMIN_EMAIL = "marija.stankovska@yahoo.com";
const multer = require("multer");

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage });
app.use(cors());
app.use(bodyParser.json());

/* ================== HELPERS ================== */

function loadData(filename) {
    const fullPath = path.resolve(filename);
    if (!fs.existsSync(fullPath)) fs.writeFileSync(fullPath, "[]");
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function saveData(filename, data) {
    fs.writeFileSync(path.resolve(filename), JSON.stringify(data, null, 2));
}

function generateId() {
    return Date.now() + Math.floor(Math.random() * 1000);
}

function createNotification({ userEmail, message, type, appointmentId }) {
    const notification = {
        id: generateId(),
        userEmail,
        message,
        type, // accepted | cancelled | reminder
        appointmentId,
        isRead: false,
        createdAt: new Date().toISOString()
    };

    notifications.push(notification);
    saveData("notifications.json", notifications);
}

/* ================== DATA ================== */

let users = loadData("users.json");
let appointments = loadData("appointments.json");
let notifications = loadData("notifications.json");

/* ================== AUTH ================== */

app.post("/register", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password)
        return res.status(400).json({ message: "Email and password required" });

    if (users.some(u => u.email === email))
        return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 8);
    const role = email === ADMIN_EMAIL ? "admin" : "user";

    users.push({ email, password: hashedPassword, role });
    saveData("users.json", users);

    res.status(201).json({ message: "User registered" });
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const user = users.find(u => u.email === email);
    if (!user || !(await bcrypt.compare(password, user.password)))
        return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
        { email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "2h" }
    );

    res.json({ token, email: user.email, role: user.role });
});

function authenticateToken(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}
function loadGallery() {
    return JSON.parse(fs.readFileSync("galleries.json", "utf8"));
}

function saveGallery(data) {
    fs.writeFileSync("galleries.json", JSON.stringify(data, null, 2));
}
function authorizeAdmin(req, res, next) {
    if (req.user.role !== "admin")
        return res.status(403).json({ message: "Admin only" });
    next();
}

/* ================== APPOINTMENTS ================== */

const allowedServices = [
    "Маникир (само гел лак)",
    "Маникир (наливни)",
    "Педикир (гел лак на нозе)",
    "Педикир (целосен+gel лак)",
    "Lash Lift",
    "Депилација (интима)",
    "Депилација (целосна)",
    "Депилација (раце+нозе)",
    "Чупање веѓи",
    "Brow Lam"
];
app.post("/upload", authenticateToken, authorizeAdmin, upload.single("image"), (req, res) => {

    const { category } = req.body;   // 👈 ќе праќаме од frontend

    const imageUrl = `http://localhost:4000/uploads/${req.file.filename}`;

    let galleries = loadGallery();

    galleries[category].push(imageUrl);

    saveGallery(galleries);

    res.json({ imageUrl });
});
app.get("/gallery", (req, res) => {
    const galleries = loadGallery();
    res.json(galleries);
});
app.use("/uploads", express.static("uploads"));
// USER create appointment
app.post("/appointments", authenticateToken, (req, res) => {
    const { date, time, service } = req.body;

    if (!date || !time || !allowedServices.includes(service))
        return res.status(400).json({ message: "Invalid data" });

    const appointment = {
        id: generateId(),
        userEmail: req.user.email,
        date,
        time,
        service,
        status: "pending",
        employee: null,
        cancelReason: null
    };

    appointments.push(appointment);
    saveData("appointments.json", appointments);

    res.status(201).json(appointment);
});

// USER get own appointments
app.get("/appointments/user", authenticateToken, (req, res) => {
    res.json(appointments.filter(a => a.userEmail === req.user.email));
});

// ADMIN get all
app.get("/appointments", authenticateToken, authorizeAdmin, (req, res) => {
    res.json(appointments);
});

// ADMIN accept / reject / assign employee
app.patch("/appointments/:id", authenticateToken, authorizeAdmin, (req, res) => {
    const { status, employee } = req.body;
    const appt = appointments.find(a => a.id == req.params.id);
    if (!appt) return res.sendStatus(404);

    if (status && status !== appt.status) {
        appt.status = status;

        if (status === "accepted") {
            createNotification({
                userEmail: appt.userEmail,
                type: "accepted",
                appointmentId: appt.id,
                message: `✅ Appointment confirmed on ${appt.date} at ${appt.time}`
            });
        }
    }

    if (employee !== undefined) {
        appt.employee = employee;
    }

    saveData("appointments.json", appointments);
    res.json(appt);
});

// USER cancel appointment (WITH REASON)
app.patch("/appointments/:id/cancel", authenticateToken, (req, res) => {
    const { reason } = req.body;
    const appt = appointments.find(a => a.id == req.params.id);

    if (!appt) return res.sendStatus(404);
    if (appt.userEmail !== req.user.email) return res.sendStatus(403);

    appt.status = "cancelled";
    appt.cancelReason = reason || "No reason provided";

    saveData("appointments.json", appointments);

    // notify admin (Marija)
    createNotification({
        userEmail: ADMIN_EMAIL,
        type: "cancelled",
        appointmentId: appt.id,
        message: `❌ ${appt.userEmail} cancelled appointment on ${appt.date} at ${appt.time}`
    });

    res.json({ message: "Cancelled successfully" });
});

/* ================== NOTIFICATIONS ================== */

app.get("/notifications", authenticateToken, (req, res) => {
    res.json(
        notifications
            .filter(n => n.userEmail === req.user.email)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    );
});
app.delete("/delete-image", authenticateToken, authorizeAdmin, (req, res) => {
    const { imageUrl } = req.body;

    if (!imageUrl) {
        return res.status(400).json({ message: "No image URL provided" });
    }

    const filename = imageUrl.split("/uploads/")[1];

    const filePath = path.join(__dirname, "uploads", filename);

    fs.unlink(filePath, (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Error deleting file" });
        }

        res.json({ message: "Image deleted successfully" });
    });
});
app.patch("/notifications/:id/read", authenticateToken, (req, res) => {
    const n = notifications.find(n => n.id == req.params.id);
    if (!n) return res.sendStatus(404);

    n.isRead = true;
    saveData("notifications.json", notifications);

    res.json({ success: true });
});

/* ================== REMINDERS (CRON) ================== */

cron.schedule("*/5 * * * *", () => {
    const now = new Date();

    appointments
        .filter(a => a.status === "accepted")
        .forEach(appt => {
            const apptDate = new Date(`${appt.date}T${appt.time}:00`);
            const diff = Math.floor((apptDate - now) / 60000); // minutes

            if (diff === 60 || diff === 1440) {
                const exists = notifications.some(
                    n =>
                        n.appointmentId === appt.id &&
                        n.type === "reminder" &&
                        n.message.includes(diff === 60 ? "1 hour" : "tomorrow")
                );

                if (!exists) {
                    createNotification({
                        userEmail: appt.userEmail,
                        type: "reminder",
                        appointmentId: appt.id,
                        message:
                            diff === 60
                                ? "⏰ Reminder: You have an appointment in 1 hour"
                                : "⏰ Reminder: You have an appointment tomorrow"
                    });
                }
            }
        });
});
app.delete("/appointments/:id", authenticateToken, authorizeAdmin, (req, res) => {
    const id = Number(req.params.id);

    const index = appointments.findIndex(a => a.id === id);

    if (index === -1) {
        return res.status(404).json({ message: "Appointment not found" });
    }

    // remove from array
    appointments.splice(index, 1);

    // save in JSON file
    saveData("appointments.json", appointments);

    res.json({ message: "Appointment deleted successfully" });
});
/* ================== START ================== */

app.get("/", (_, res) => res.send("✅ Backend running"));

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
