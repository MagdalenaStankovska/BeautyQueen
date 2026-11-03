const { io: connect } = require("socket.io-client");
const { buildApp, cleanupDataDirs, nextDate, registerAndLogin } = require("./helpers");

let ctx;
let url;
const sockets = [];

const open = (token) => new Promise((resolve, reject) => {
    const s = connect(url, { auth: { token }, transports: ["websocket"], reconnection: false });
    sockets.push(s);
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
});

const next = (socket, event, ms = 2000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    socket.once(event, (data) => { clearTimeout(t); resolve(data ?? true); });
});

beforeAll(async () => {
    ctx = buildApp();
    const port = await ctx.start(0);
    url = `http://localhost:${port}`;
    ctx.adminToken = await registerAndLogin(ctx.api, { email: "admin@test.mk", name: "Марија" });
    ctx.clientToken = await registerAndLogin(ctx.api, { email: "ana@test.mk", name: "Ана" });
    ctx.otherToken = await registerAndLogin(ctx.api, { email: "eva@test.mk" });
});

afterAll(async () => {
    sockets.forEach(s => s.close());
    await ctx.close();
    cleanupDataDirs();
});

test("connection without a valid token is rejected", async () => {
    await expect(open(undefined)).rejects.toThrow("unauthorized");
    await expect(open("garbage")).rejects.toThrow("unauthorized");
});

test("new request: admin gets notification, everyone gets availability update, other clients get nothing private", async () => {
    const admin = await open(ctx.adminToken);
    const client = await open(ctx.clientToken);
    const other = await open(ctx.otherToken);

    let otherGotPrivate = false;
    other.on("notification:new", () => { otherGotPrivate = true; });
    other.on("appointment:changed", () => { otherGotPrivate = true; });

    const adminNote = next(admin, "notification:new");
    const adminChange = next(admin, "appointment:changed");
    const otherAvail = next(other, "availability:changed");

    const res = await ctx.api.post("/appointments").set({ Authorization: `Bearer ${ctx.clientToken}` })
        .send({ date: nextDate(), time: "12:00", service: "Lash Lift" });
    expect(res.status).toBe(201);

    expect((await adminNote).type).toBe("request");
    expect((await adminChange).action).toBe("created");
    expect(await otherAvail).toBe(true);

    // accept -> client notified in real time
    const clientNote = next(client, "notification:new");
    await ctx.api.patch(`/appointments/${res.body.id}`).set({ Authorization: `Bearer ${ctx.adminToken}` }).send({ status: "accepted" });
    expect((await clientNote).type).toBe("accepted");

    await new Promise(r => setTimeout(r, 100));
    expect(otherGotPrivate).toBe(false);
});

test("gallery changes are broadcast", async () => {
    const client = await open(ctx.clientToken);
    const changed = next(client, "gallery:changed");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    await ctx.api.post("/upload").set({ Authorization: `Bearer ${ctx.adminToken}` })
        .field("category", "Педикир").attach("image", png, { filename: "a.png", contentType: "image/png" });
    expect(await changed).toBe(true);
});
