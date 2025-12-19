const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 4000;
const JWT_SECRET = "your_jwt_secret_key_here"; // change in production

app.use(cors());
app.use(bodyParser.json());

/* ------------------ HELPERS ------------------ */

function loadData(filename) {
    try {
        const fullPath = path.resolve(filename);
        if (!fs.existsSync(fullPath)) fs.writeFileSync(fullPath, "[]");
        const data = fs.readFileSync(fullPath, "utf8");
        return JSON.parse(data || "[]");
    } catch (err) {
        console.error(`Failed to load ${filename}:`, err);
        return [];
    }
}

function saveData(filename, data) {
    fs.writeFileSync(
        path.resolve(filename),
        JSON.stringify(data, null, 2)
    );
}

function generateId() {
    return Date.now() + Math.floor(Math.random() * 1000);
}

/* ------------------ DATA ------------------ */

let users = loadData("users.json");
let appointments = loadData("appointments.json");

/* ------------------ ROOT ------------------ */

app.get("/", (req, res) => {
    res.send("✅ Backend is running");
});

/* ------------------ AUTH ------------------ */

app.post("/register", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password)
        return res.status(400).json({ message: "Email and password required" });

    if (users.some(u => u.email === email))
        return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 8);
    const role =
        email === "marija.stankovska@yahoo.com" ? "admin" : "user";

    users.push({ email, password: hashedPassword, role });
    saveData("users.json", users);

    res.status(201).json({ message: "User registered" });
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password)
        return res.status(400).json({ message: "Email and password required" });

    const user = users.find(u => u.email === email);
    if (!user)
        return res.status(401).json({ message: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
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
    if (!token)
        return res.status(401).json({ message: "Token missing" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err)
            return res.status(403).json({ message: "Token invalid or expired" });
        req.user = user;
        next();
    });
}

function authorizeAdmin(req, res, next) {
    if (req.user.role !== "admin")
        return res.status(403).json({ message: "Admin access required" });
    next();
}

/* ------------------ APPOINTMENTS ------------------ */

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

// USER create appointment
app.post("/appointments", authenticateToken, (req, res) => {
    const { date, time, service } = req.body;

    if (!date || !time || !service)
        return res.status(400).json({ message: "Missing fields" });

    if (!allowedServices.includes(service))
        return res.status(400).json({ message: "Invalid service" });

    const appointment = {
        id: generateId(),
        userEmail: req.user.email,
        date,
        time,
        service,
        status: "pending",
        employee: null
    };

    appointments.push(appointment);
    saveData("appointments.json", appointments);

    res.status(201).json({ message: "Appointment created", appointment });
});

// USER get own appointments
app.get("/appointments/user", authenticateToken, (req, res) => {
    res.json(
        appointments.filter(a => a.userEmail === req.user.email)
    );
});

// ADMIN get all appointments
app.get("/appointments", authenticateToken, authorizeAdmin, (req, res) => {
    res.json(appointments);
});

// ADMIN update appointment (accept / reject / drag & drop)
app.patch(
    "/appointments/:id",
    authenticateToken,
    authorizeAdmin,
    (req, res) => {
        const { status, employee } = req.body;

        const appointment = appointments.find(
            a => a.id == req.params.id
        );

        if (!appointment)
            return res.status(404).json({ message: "Appointment not found" });

        // partial updates (IMPORTANT for drag & drop)
        if (status !== undefined) {
            if (!["accepted", "rejected"].includes(status))
                return res.status(400).json({ message: "Invalid status" });
            appointment.status = status;
        }

        if (employee !== undefined) {
            appointment.employee = employee;
        }

        saveData("appointments.json", appointments);

        res.json({
            message: "Appointment updated",
            appointment
        });
    }
);

/* ------------------ START SERVER ------------------ */

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
