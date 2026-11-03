const fs = require("fs");
const path = require("path");
const request = require("supertest");
const { buildApp, cleanupDataDirs, readJson, nextDate, registerAndLogin } = require("./helpers");

afterAll(cleanupDataDirs);

const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
);

async function setup() {
    const ctx = buildApp();
    ctx.adminToken = await registerAndLogin(ctx.api, { email: "admin@test.mk", name: "Марија" });
    ctx.clientToken = await registerAndLogin(ctx.api, { email: "ana@test.mk", name: "Ана", phone: "070111222" });
    ctx.otherToken = await registerAndLogin(ctx.api, { email: "eva@test.mk", name: "Ева" });
    ctx.auth = (token) => ({ Authorization: `Bearer ${token}` });
    return ctx;
}

describe("health & basics", () => {
    let ctx;
    beforeAll(async () => { ctx = await setup(); });
    afterAll(() => ctx.close());

    test("GET /health", async () => {
        const res = await ctx.api.get("/health");
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("ok");
        expect(res.body.counts.users).toBe(3);
    });

    test("GET /config exposes salon rules", async () => {
        const res = await ctx.api.get("/config");
        expect(res.body.employees.map(e => e.id)).toEqual(["Sara", "Izabela", "Marija"]);
        expect(res.body.services.length).toBeGreaterThan(5);
    });

    test("security headers present, x-powered-by hidden", async () => {
        const res = await ctx.api.get("/health");
        expect(res.headers["x-powered-by"]).toBeUndefined();
        expect(res.headers["x-content-type-options"]).toBe("nosniff");
    });

    test("unknown route -> 404 JSON", async () => {
        const res = await ctx.api.get("/nope");
        expect(res.status).toBe(404);
        expect(res.body.message).toBeDefined();
    });

    test("malformed JSON -> 400, oversized body -> 413", async () => {
        const bad = await ctx.api.post("/login").set("Content-Type", "application/json").send("{bad json");
        expect(bad.status).toBe(400);
        const big = await ctx.api.post("/login").send({ email: "a@b.mk", password: "x".repeat(200 * 1024) });
        expect(big.status).toBe(413);
    });

    test("requests without a body don't crash", async () => {
        expect((await ctx.api.post("/login")).status).toBe(400);
        expect((await ctx.api.post("/register")).status).toBe(400);
        expect((await ctx.api.post("/appointments").set(ctx.auth(ctx.clientToken))).status).toBe(400);
    });
});

describe("auth", () => {
    let ctx;
    beforeAll(async () => { ctx = await setup(); });
    afterAll(() => ctx.close());

    test("register validation", async () => {
        const cases = [
            [{ email: "bad", password: "secret1" }, /е-пошта/],
            [{ email: "x@y.mk", password: "123" }, /6/],
            [{ email: "x@y.mk", password: "x".repeat(129) }, /128/],
            [{ email: "x@y.mk", password: 123456 }, /лозинка/],
            [{ email: ["x@y.mk"], password: "secret1" }, /лозинка/],
            [{ email: "ANA@test.mk", password: "secret1" }, /постои/]
        ];
        for (const [body, msg] of cases) {
            const res = await ctx.api.post("/register").send(body);
            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(msg);
        }
    });

    test("register trims and limits profile fields", async () => {
        await ctx.api.post("/register").send({ email: "long@test.mk", password: "secret1", name: "N".repeat(500), phone: { x: 1 } });
        const login = await ctx.api.post("/login").send({ email: "long@test.mk", password: "secret1" });
        expect(login.body.name).toHaveLength(80);
        expect(login.body.phone).toBe("");
    });

    test("login is case-insensitive and returns profile; wrong password 401", async () => {
        const ok = await ctx.api.post("/login").send({ email: " Ana@Test.mk ", password: "secret1" });
        expect(ok.status).toBe(200);
        expect(ok.body).toMatchObject({ email: "ana@test.mk", role: "user", name: "Ана", phone: "070111222" });
        expect(ok.body.password).toBeUndefined();
        expect((await ctx.api.post("/login").send({ email: "ana@test.mk", password: "wrong1" })).status).toBe(401);
        expect((await ctx.api.post("/login").send({ email: "ghost@test.mk", password: "secret1" })).status).toBe(401);
    });

    test("configured admin email gets admin role", async () => {
        const res = await ctx.api.get("/me").set(ctx.auth(ctx.adminToken));
        expect(res.body.role).toBe("admin");
    });

    test("token checks", async () => {
        expect((await ctx.api.get("/me")).status).toBe(401);
        expect((await ctx.api.get("/me").set("Authorization", "Bearer garbage")).status).toBe(401);
        expect((await ctx.api.get("/me").set("Authorization", ctx.clientToken)).status).toBe(401); // missing scheme
        const forged = require("jsonwebtoken").sign({ email: "admin@test.mk", role: "admin" }, "wrong-secret");
        expect((await ctx.api.get("/appointments").set(ctx.auth(forged))).status).toBe(401);
    });

    test("role comes from the server, not the token", async () => {
        const fake = ctx.signToken({ email: "ana@test.mk", role: "admin" });
        expect((await ctx.api.get("/appointments").set(ctx.auth(fake))).status).toBe(403);
    });

    test("profile update and password change", async () => {
        const upd = await ctx.api.patch("/me").set(ctx.auth(ctx.otherToken)).send({ name: "  Ева Е  ", phone: "071" });
        expect(upd.body).toMatchObject({ name: "Ева Е", phone: "071" });
        expect((await ctx.api.patch("/me/password").set(ctx.auth(ctx.otherToken)).send({ currentPassword: "nope", newPassword: "newpass1" })).status).toBe(400);
        expect((await ctx.api.patch("/me/password").set(ctx.auth(ctx.otherToken)).send({ currentPassword: "secret1", newPassword: "12" })).status).toBe(400);
        expect((await ctx.api.patch("/me/password").set(ctx.auth(ctx.otherToken)).send({ currentPassword: "secret1", newPassword: "newpass1" })).status).toBe(200);
        expect((await ctx.api.post("/login").send({ email: "eva@test.mk", password: "newpass1" })).status).toBe(200);
        const stored = readJson(ctx.dataDir, "users.json").find(u => u.email === "eva@test.mk");
        expect(stored.password).not.toBe("newpass1");
        expect(stored.password).toMatch(/^\$2[aby]\$/);
    });

    test("rate limiting on login", async () => {
        const limited = buildApp({ options: { rateLimitMax: 3 } });
        for (let i = 0; i < 3; i++) await limited.api.post("/login").send({ email: "a@b.mk", password: "xxxxxx" });
        const res = await limited.api.post("/login").send({ email: "a@b.mk", password: "xxxxxx" });
        expect(res.status).toBe(429);
        await limited.close();
    });
});

describe("booking flow", () => {
    let ctx;
    const date = nextDate([1, 2, 3, 4, 5], 3);
    beforeAll(async () => { ctx = await setup(); });
    afterAll(() => ctx.close());

    test("client books -> pending, admin notified", async () => {
        const res = await ctx.api.post("/appointments").set(ctx.auth(ctx.clientToken))
            .send({ date, time: "14:45", service: "Педикир (целосен+gel лак)", note: "  црвена  " });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ status: "pending", clientName: "Ана", clientPhone: "070111222", note: "црвена" });
        ctx.pedicureId = res.body.id;

        const notes = await ctx.api.get("/notifications").set(ctx.auth(ctx.adminToken));
        expect(notes.body[0]).toMatchObject({ type: "request", appointmentId: ctx.pedicureId });
        expect(notes.body[0].message).toContain("Ана");
    });

    test("overlapping booking on the same station -> 409 with explanation", async () => {
        const res = await ctx.api.post("/appointments").set(ctx.auth(ctx.otherToken))
            .send({ date, time: "14:15", service: "Педикир (гел лак на нозе)" });
        expect(res.status).toBe(409);
        expect(res.body.message).toContain("столот за педикир");
    });

    test("adjacent booking is allowed", async () => {
        const res = await ctx.api.post("/appointments").set(ctx.auth(ctx.otherToken))
            .send({ date, time: "14:00", service: "Педикир (гел лак на нозе)" });
        expect(res.status).toBe(201);
    });

    test("invalid bookings rejected", async () => {
        const bad = [
            { date: "2020-01-01", time: "12:00", service: "Lash Lift" },
            { date, time: "09:00", service: "Lash Lift" },
            { date, time: "19:30", service: "Маникир (наливни)" },
            { date, time: "12:07", service: "Lash Lift" },
            { date: "2030-02-31", time: "12:00", service: "Lash Lift" },
            { date: nextDate([0]), time: "12:00", service: "Lash Lift" },
            { date, time: "12:00", service: "----" },
            { date, time: "12:00" }
        ];
        for (const body of bad) {
            const res = await ctx.api.post("/appointments").set(ctx.auth(ctx.clientToken)).send(body);
            expect([400, 409]).toContain(res.status);
        }
    });

    test("availability is anonymised", async () => {
        const res = await ctx.api.get("/appointments/availability").set(ctx.auth(ctx.otherToken));
        expect(res.body.length).toBeGreaterThan(0);
        res.body.forEach(a => {
            expect(a.userEmail).toBeUndefined();
            expect(a.clientPhone).toBeUndefined();
            expect(a.note).toBeUndefined();
        });
    });

    test("clients only see their own appointments and can't use admin routes", async () => {
        const mine = await ctx.api.get("/appointments/user").set(ctx.auth(ctx.clientToken));
        expect(mine.body.every(a => a.userEmail === "ana@test.mk")).toBe(true);
        expect((await ctx.api.get("/appointments").set(ctx.auth(ctx.clientToken))).status).toBe(403);
        expect((await ctx.api.patch(`/appointments/${ctx.pedicureId}`).set(ctx.auth(ctx.clientToken)).send({ status: "accepted" })).status).toBe(403);
        expect((await ctx.api.delete(`/appointments/${ctx.pedicureId}`).set(ctx.auth(ctx.clientToken))).status).toBe(403);
        expect((await ctx.api.post("/appointments/manual").set(ctx.auth(ctx.clientToken)).send({})).status).toBe(403);
    });

    test("another client cannot cancel someone else's appointment", async () => {
        const res = await ctx.api.patch(`/appointments/${ctx.pedicureId}/cancel`).set(ctx.auth(ctx.otherToken)).send({});
        expect(res.status).toBe(403);
    });

    test("admin accepts with employee -> client notified + push sent", async () => {
        const res = await ctx.api.patch(`/appointments/${ctx.pedicureId}`).set(ctx.auth(ctx.adminToken))
            .send({ status: "accepted", employee: "Izabela" });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ status: "accepted", employee: "Izabela" });
        const notes = await ctx.api.get("/notifications").set(ctx.auth(ctx.clientToken));
        expect(notes.body[0].type).toBe("accepted");
    });

    test("admin input validation", async () => {
        const api = (body) => ctx.api.patch(`/appointments/${ctx.pedicureId}`).set(ctx.auth(ctx.adminToken)).send(body);
        expect((await api({ employee: "Martina" })).status).toBe(400);
        expect((await api({ status: "done" })).status).toBe(400);
        expect((await ctx.api.patch("/appointments/999").set(ctx.auth(ctx.adminToken)).send({ status: "accepted" })).status).toBe(404);
        // a rejected status must not partially apply an employee change
        const before = (await ctx.api.get("/appointments").set(ctx.auth(ctx.adminToken))).body.find(a => a.id === ctx.pedicureId);
        await api({ status: "bogus", employee: "Sara" });
        const after = (await ctx.api.get("/appointments").set(ctx.auth(ctx.adminToken))).body.find(a => a.id === ctx.pedicureId);
        expect(after.employee).toBe(before.employee);
    });

    test("admin reject with reason reaches client", async () => {
        const b = await ctx.api.post("/appointments").set(ctx.auth(ctx.clientToken)).send({ date, time: "12:00", service: "Lash Lift" });
        await ctx.api.patch(`/appointments/${b.body.id}`).set(ctx.auth(ctx.adminToken)).send({ status: "rejected", reason: "Нема материјал" });
        const notes = await ctx.api.get("/notifications").set(ctx.auth(ctx.clientToken));
        expect(notes.body[0]).toMatchObject({ type: "rejected" });
        expect(notes.body[0].message).toContain("Нема материјал.");
    });

    test("client cancels with reason -> admin notified; cannot cancel twice", async () => {
        const res = await ctx.api.patch(`/appointments/${ctx.pedicureId}/cancel`).set(ctx.auth(ctx.clientToken)).send({ reason: "болна" });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ status: "cancelled", cancelReason: "болна", cancelledBy: "client" });
        const notes = await ctx.api.get("/notifications").set(ctx.auth(ctx.adminToken));
        expect(notes.body[0].type).toBe("cancelled");
        expect((await ctx.api.patch(`/appointments/${ctx.pedicureId}/cancel`).set(ctx.auth(ctx.clientToken))).status).toBe(400);
    });

    test("cancelled slot becomes free again", async () => {
        const res = await ctx.api.post("/appointments").set(ctx.auth(ctx.otherToken))
            .send({ date, time: "15:00", service: "Педикир (гел лак на нозе)" });
        expect(res.status).toBe(201);
    });

    test("manual booking by admin, linked to registered client", async () => {
        const res = await ctx.api.post("/appointments/manual").set(ctx.auth(ctx.adminToken))
            .send({ clientName: "Ана", clientEmail: "ANA@test.mk", date: nextDate([0]), time: "12:00", service: "Lash Lift", employee: "Marija" });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ status: "accepted", userEmail: "ana@test.mk", createdByAdmin: true });
        expect((await ctx.api.post("/appointments/manual").set(ctx.auth(ctx.adminToken)).send({ date, time: "12:00", service: "Lash Lift" })).status).toBe(400);
        expect((await ctx.api.post("/appointments/manual").set(ctx.auth(ctx.adminToken))
            .send({ clientName: "X", date, time: "12:00", service: "Lash Lift", employee: "Nobody" })).status).toBe(400);
    });

    test("admin delete", async () => {
        const b = await ctx.api.post("/appointments").set(ctx.auth(ctx.clientToken)).send({ date, time: "17:00", service: "Чупање веѓи" });
        expect((await ctx.api.delete(`/appointments/${b.body.id}`).set(ctx.auth(ctx.adminToken))).status).toBe(200);
        expect((await ctx.api.delete(`/appointments/${b.body.id}`).set(ctx.auth(ctx.adminToken))).status).toBe(404);
    });

    test("data is persisted to disk", () => {
        const stored = readJson(ctx.dataDir, "appointments.json");
        expect(stored.find(a => a.id === ctx.pedicureId).status).toBe("cancelled");
    });
});

describe("concurrency", () => {
    // real listening server so parallel requests hit one process like in production
    const live = async (ctx) => request(`http://localhost:${await ctx.start(0)}`);

    test("20 simultaneous requests for one single-station slot -> exactly one succeeds", async () => {
        const ctx = await setup();
        const api = await live(ctx);
        const date = nextDate([1, 2, 3, 4, 5], 4);
        const results = await Promise.all(
            Array.from({ length: 20 }, () =>
                api.post("/appointments").set(ctx.auth(ctx.clientToken)).send({ date, time: "13:00", service: "Lash Lift" }))
        );
        expect(results.filter(r => r.status === 201)).toHaveLength(1);
        expect(results.filter(r => r.status === 409)).toHaveLength(19);
        await ctx.close();
    });

    test("simultaneous duplicate registrations create one account", async () => {
        const ctx = buildApp();
        const api = await live(ctx);
        const results = await Promise.all(
            Array.from({ length: 5 }, () => api.post("/register").send({ email: "dup@test.mk", password: "secret1" }))
        );
        expect(results.filter(r => r.status === 201)).toHaveLength(1);
        expect(readJson(ctx.dataDir, "users.json").filter(u => u.email === "dup@test.mk")).toHaveLength(1);
        await ctx.close();
    });
});

describe("notifications API", () => {
    let ctx;
    beforeAll(async () => {
        ctx = await setup();
        await ctx.api.post("/appointments").set(ctx.auth(ctx.clientToken)).send({ date: nextDate(), time: "12:00", service: "Lash Lift" });
    });
    afterAll(() => ctx.close());

    test("mark one read, ownership enforced", async () => {
        const [n] = (await ctx.api.get("/notifications").set(ctx.auth(ctx.adminToken))).body;
        expect((await ctx.api.patch(`/notifications/${n.id}/read`).set(ctx.auth(ctx.clientToken))).status).toBe(404);
        expect((await ctx.api.patch(`/notifications/${n.id}/read`).set(ctx.auth(ctx.adminToken))).status).toBe(200);
        expect((await ctx.api.get("/notifications").set(ctx.auth(ctx.adminToken))).body[0].isRead).toBe(true);
    });

    test("read-all and clear only affect own notifications", async () => {
        await ctx.api.patch("/notifications/read-all").set(ctx.auth(ctx.clientToken));
        await ctx.api.delete("/notifications").set(ctx.auth(ctx.clientToken));
        expect((await ctx.api.get("/notifications").set(ctx.auth(ctx.clientToken))).body).toHaveLength(0);
        expect((await ctx.api.get("/notifications").set(ctx.auth(ctx.adminToken))).body.length).toBeGreaterThan(0);
    });

    test("old notifications are pruned", async () => {
        const later = new Date(Date.now() + 120 * 86400000);
        ctx.pruneNotifications(later);
        expect(readJson(ctx.dataDir, "notifications.json")).toHaveLength(0);
    });
});

describe("reminders", () => {
    function seeded(minutesAhead, extra = {}) {
        const t = new Date(Date.now() + minutesAhead * 60000);
        t.setSeconds(0, 0);
        return {
            id: 1000 + minutesAhead,
            userEmail: "ana@test.mk",
            clientName: "Ана",
            date: t.toLocaleDateString("sv-SE"),
            time: t.toTimeString().slice(0, 5),
            service: "Lash Lift",
            status: "accepted",
            ...extra
        };
    }

    test("1-day and 1-hour reminders are sent exactly once, with push", async () => {
        const ctx = buildApp({
            files: {
                "appointments.json": [seeded(30), seeded(300), seeded(3000), seeded(-30), seeded(40, { status: "pending" })]
            }
        });
        await registerAndLogin(ctx.api, { email: "admin@test.mk" });
        const clientToken = await registerAndLogin(ctx.api, { email: "ana@test.mk" });
        await ctx.api.post("/push/subscribe").set({ Authorization: `Bearer ${clientToken}` })
            .send({ subscription: { endpoint: "https://push.example/1", keys: { p256dh: "a", auth: "b" } } });

        ctx.runReminders();
        ctx.runReminders(); // second run must not duplicate

        const notes = (await ctx.api.get("/notifications").set({ Authorization: `Bearer ${clientToken}` })).body;
        const reminders = notes.filter(n => n.type === "reminder");
        expect(reminders).toHaveLength(2);
        expect(reminders.some(n => n.appointmentId === 1030 && n.title.includes("1 час"))).toBe(true);
        expect(reminders.some(n => n.appointmentId === 1300)).toBe(true);
        expect(reminders.some(n => n.appointmentId === 4000)).toBe(false); // > 24h away
        expect(ctx.pushed.filter(p => p.payload.title.includes("1 час"))).toHaveLength(1);

        const stored = readJson(ctx.dataDir, "appointments.json");
        expect(stored.find(a => a.id === 1030).reminders).toEqual({ day: true, hour: true });
        await ctx.close();
    });

    test("day reminder later upgrades to hour reminder", async () => {
        const ctx = buildApp({ files: { "appointments.json": [seeded(120)] } });
        const token = await registerAndLogin(ctx.api, { email: "ana@test.mk" });
        ctx.runReminders();
        ctx.runReminders(new Date(Date.now() + 70 * 60000));
        const reminders = (await ctx.api.get("/notifications").set({ Authorization: `Bearer ${token}` })).body.filter(n => n.type === "reminder");
        expect(reminders).toHaveLength(2);
        await ctx.close();
    });

    test("revoked push subscription (410) is removed", async () => {
        const ctx = buildApp({
            options: { pushSender: async () => { const e = new Error("gone"); e.statusCode = 410; throw e; } }
        });
        const token = await registerAndLogin(ctx.api, { email: "ana@test.mk" });
        await registerAndLogin(ctx.api, { email: "admin@test.mk" });
        const auth = { Authorization: `Bearer ${token}` };
        await ctx.api.post("/push/subscribe").set(auth).send({ subscription: { endpoint: "https://push.example/x", keys: { p256dh: "a", auth: "b" } } });
        const adminToken = (await ctx.api.post("/login").send({ email: "admin@test.mk", password: "secret1" })).body.token;
        await ctx.api.post("/appointments/manual").set({ Authorization: `Bearer ${adminToken}` })
            .send({ clientName: "Ана", clientEmail: "ana@test.mk", date: nextDate(), time: "12:00", service: "Lash Lift" });
        await new Promise(r => setTimeout(r, 50));
        expect(readJson(ctx.dataDir, "push-subscriptions.json")).toHaveLength(0);
        await ctx.close();
    });
});

describe("push subscription validation", () => {
    let ctx;
    beforeAll(async () => { ctx = await setup(); });
    afterAll(() => ctx.close());

    test("rejects invalid subscriptions and only owner can unsubscribe", async () => {
        const post = (token, body) => ctx.api.post("/push/subscribe").set(ctx.auth(token)).send(body);
        expect((await post(ctx.clientToken, {})).status).toBe(400);
        expect((await post(ctx.clientToken, { subscription: { endpoint: "http://insecure", keys: {} } })).status).toBe(400);
        expect((await post(ctx.clientToken, { subscription: { endpoint: "https://p.example/1", keys: { a: 1 } } })).status).toBe(201);
        await ctx.api.post("/push/unsubscribe").set(ctx.auth(ctx.otherToken)).send({ endpoint: "https://p.example/1" });
        expect(readJson(ctx.dataDir, "push-subscriptions.json")).toHaveLength(1);
        await ctx.api.post("/push/unsubscribe").set(ctx.auth(ctx.clientToken)).send({ endpoint: "https://p.example/1" });
        expect(readJson(ctx.dataDir, "push-subscriptions.json")).toHaveLength(0);
        expect((await ctx.api.get("/push/public-key")).body.publicKey).toBeTruthy();
    });
});

describe("gallery", () => {
    let ctx;
    beforeAll(async () => { ctx = await setup(); });
    afterAll(() => ctx.close());

    test("admin uploads, file is served, then deleted", async () => {
        const up = await ctx.api.post("/upload").set(ctx.auth(ctx.adminToken))
            .field("category", "Маникир").attach("image", PNG, { filename: "a.png", contentType: "image/png" });
        expect(up.status).toBe(201);
        expect(up.body.imagePath).toMatch(/^\/uploads\/\d+-\d+\.png$/);

        const served = await ctx.api.get(up.body.imagePath);
        expect(served.status).toBe(200);
        expect(served.headers["cross-origin-resource-policy"]).toBe("cross-origin");

        expect((await ctx.api.get("/gallery")).body["Маникир"]).toContain(up.body.imagePath);
        expect((await ctx.api.delete("/delete-image").set(ctx.auth(ctx.adminToken)).send({ imagePath: up.body.imagePath })).status).toBe(200);
        expect((await ctx.api.get("/gallery")).body["Маникир"]).toHaveLength(0);
        expect(fs.existsSync(path.join(ctx.dataDir, up.body.imagePath))).toBe(false);
    });

    test("rejects non-admins, SVG, unknown categories, missing files and path traversal", async () => {
        expect((await ctx.api.post("/upload").set(ctx.auth(ctx.clientToken)).field("category", "Маникир")
            .attach("image", PNG, { filename: "a.png", contentType: "image/png" })).status).toBe(403);
        expect((await ctx.api.post("/upload").set(ctx.auth(ctx.adminToken)).field("category", "Маникир")
            .attach("image", Buffer.from("<svg onload=alert(1)>"), { filename: "x.svg", contentType: "image/svg+xml" })).status).toBe(400);
        expect((await ctx.api.post("/upload").set(ctx.auth(ctx.adminToken)).field("category", "Hacks")
            .attach("image", PNG, { filename: "a.png", contentType: "image/png" })).status).toBe(400);
        expect((await ctx.api.post("/upload").set(ctx.auth(ctx.adminToken)).field("category", "Маникир")).status).toBe(400);

        fs.writeFileSync(path.join(ctx.dataDir, "keep.txt"), "x");
        const traversal = await ctx.api.delete("/delete-image").set(ctx.auth(ctx.adminToken)).send({ imagePath: "/uploads/../keep.txt" });
        expect(traversal.status).toBe(404);
        expect(fs.existsSync(path.join(ctx.dataDir, "keep.txt"))).toBe(true);
        expect(fs.existsSync(path.join(ctx.dataDir, "users.json"))).toBe(true);
    });

    test("oversized upload -> 400", async () => {
        const big = Buffer.alloc(11 * 1024 * 1024);
        const res = await ctx.api.post("/upload").set(ctx.auth(ctx.adminToken)).field("category", "Маникир")
            .attach("image", big, { filename: "big.png", contentType: "image/png" });
        expect(res.status).toBe(400);
    });
});

describe("data robustness", () => {
    test("malformed user rows are ignored instead of crashing login", async () => {
        const ctx = buildApp({ files: { "users.json": [{}, { email: "", password: "" }, null] } });
        const res = await ctx.api.post("/login").send({ email: "", password: "secret1" });
        expect(res.status).toBe(400);
        expect((await ctx.api.get("/health")).body.counts.users).toBe(0);
        await ctx.close();
    });

    test("UTF-8 BOM in data files is tolerated", async () => {
        const ctx = buildApp({ files: { "galleries.json": "﻿{}" } });
        expect((await ctx.api.get("/gallery")).body["Маникир"]).toEqual([]);
        await ctx.close();
    });
});
