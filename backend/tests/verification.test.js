const { buildApp, cleanupDataDirs, readJson, nextDate, registerAndLogin } = require("./helpers");
const { createApp } = require("../app");
const { normalizePhone, maskEmail, maskPhone } = require("../verification");

afterAll(cleanupDataDirs);

// App with a fake provider that records every code it "sends".
function withOutbox(extra = {}) {
    const outbox = [];
    const ctx = buildApp({ options: { codeSender: async (msg) => { outbox.push(msg); }, ...extra } });
    ctx.outbox = outbox;
    ctx.lastCode = () => outbox[outbox.length - 1].code;
    return ctx;
}

describe("phone helpers", () => {
    test("normalizePhone", () => {
        expect(normalizePhone("070 283 453")).toBe("+38970283453");
        expect(normalizePhone("+389 70-283-453")).toBe("+38970283453");
        expect(normalizePhone("0038970283453")).toBe("+38970283453");
        expect(normalizePhone("38970283453")).toBe("+38970283453");
        expect(normalizePhone("+49 151 2345 6789")).toBe("+4915123456789");
        expect(normalizePhone("071")).toBe("");
        expect(normalizePhone("abc")).toBe("");
        expect(normalizePhone({})).toBe("");
    });

    test("masking hides most of the destination", () => {
        expect(maskEmail("magdalena@gmail.com")).toBe("ma•••••••@gmail.com");
        expect(maskPhone("+38970283453")).toBe("+389•••••453");
    });
});

describe("registration with e-mail code", () => {
    let ctx;
    beforeAll(() => { ctx = withOutbox(); });
    afterAll(() => ctx.close());

    test("register sends a code and does NOT create the account yet", async () => {
        const res = await ctx.api.post("/register").send({ email: "Ana@Test.mk", password: "secret1", name: "Ана", phone: "070111222" });
        expect(res.status).toBe(202);
        expect(res.body).toMatchObject({ channel: "email", destination: "an•@test.mk" });
        expect(res.body.devCode).toBeUndefined(); // real provider configured -> code never leaves the server
        expect(ctx.outbox[0]).toMatchObject({ channel: "email", to: "ana@test.mk", purpose: "register" });
        expect(ctx.outbox[0].html).toContain(ctx.lastCode());
        expect(readJson(ctx.dataDir, "users.json")).toHaveLength(0);
        expect((await ctx.api.post("/login").send({ email: "ana@test.mk", password: "secret1" })).status).toBe(401);
    });

    test("resend is rate limited", async () => {
        const res = await ctx.api.post("/register/resend").send({ email: "ana@test.mk" });
        expect(res.status).toBe(429);
        expect(res.body.retryAfter).toBeGreaterThan(0);
        expect((await ctx.api.post("/register/resend").send({ email: "nobody@test.mk" })).status).toBe(400);
    });

    test("wrong codes are counted, right code creates the account and signs in", async () => {
        const wrong = await ctx.api.post("/register/verify").send({ email: "ana@test.mk", code: "000000" === ctx.lastCode() ? "111111" : "000000" });
        expect(wrong.status).toBe(400);
        expect(wrong.body.message).toMatch(/4 обиди/);

        const ok = await ctx.api.post("/register/verify").send({ email: "ana@test.mk", code: ` ${ctx.lastCode()} ` });
        expect(ok.status).toBe(201);
        expect(ok.body).toMatchObject({ email: "ana@test.mk", name: "Ана", phone: "+38970111222", emailVerified: true, phoneVerified: false });
        expect((await ctx.api.get("/me").set("Authorization", `Bearer ${ok.body.token}`)).status).toBe(200);

        // code is single use
        expect((await ctx.api.post("/register/verify").send({ email: "ana@test.mk", code: ctx.lastCode() })).status).toBe(400);
        expect((await ctx.api.post("/register").send({ email: "ana@test.mk", password: "secret1" })).status).toBe(400);
    });

    test("five wrong guesses invalidate the code", async () => {
        await ctx.api.post("/register").send({ email: "brute@test.mk", password: "secret1" });
        const real = ctx.lastCode();
        const guess = real === "999999" ? "999998" : "999999";
        for (let i = 0; i < 5; i++) await ctx.api.post("/register/verify").send({ email: "brute@test.mk", code: guess });
        const res = await ctx.api.post("/register/verify").send({ email: "brute@test.mk", code: real });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/истече/);
    });

    test("invalid phone and sms channel validation", async () => {
        expect((await ctx.api.post("/register").send({ email: "p@test.mk", password: "secret1", phone: "071" })).status).toBe(400);
        expect((await ctx.api.post("/register").send({ email: "p@test.mk", password: "secret1", channel: "sms" })).status).toBe(400);
        expect((await ctx.api.post("/register").send({ email: "p@test", password: "secret1" })).status).toBe(400);
    });

    test("/config advertises available channels", async () => {
        expect((await ctx.api.get("/config")).body.verification).toEqual({ email: true, sms: true });
    });
});

describe("registration with SMS code", () => {
    test("code goes to the phone, phone is marked verified and can't be reused", async () => {
        const ctx = withOutbox();
        const res = await ctx.api.post("/register").send({ email: "mila@test.mk", password: "secret1", phone: "070 999 888", channel: "sms" });
        expect(res.status).toBe(202);
        expect(res.body).toMatchObject({ channel: "sms", destination: "+389•••••888" });
        expect(ctx.outbox[0]).toMatchObject({ channel: "sms", to: "+38970999888" });

        const ok = await ctx.api.post("/register/verify").send({ email: "mila@test.mk", code: ctx.lastCode() });
        expect(ok.body).toMatchObject({ phoneVerified: true, emailVerified: false });

        const again = await ctx.api.post("/register").send({ email: "other@test.mk", password: "secret1", phone: "+38970999888", channel: "sms" });
        expect(again.status).toBe(400);
        expect(again.body.message).toMatch(/телефонски број/);
        await ctx.close();
    });

    test("SMS isn't offered when Twilio isn't configured", async () => {
        const ctx = buildApp(); // dev mode: e-mail only
        expect((await ctx.api.get("/config")).body.verification).toEqual({ email: true, sms: false });
        const res = await ctx.api.post("/register").send({ email: "x@test.mk", password: "secret1", phone: "070999888", channel: "sms" });
        expect(res.status).toBe(400);
        await ctx.close();
    });
});

describe("delivery problems", () => {
    test("provider failure -> 502 and no code is stored", async () => {
        const ctx = buildApp({ options: { codeSender: async () => { throw new Error("SMTP down"); } } });
        const res = await ctx.api.post("/register").send({ email: "x@test.mk", password: "secret1" });
        expect(res.status).toBe(502);
        expect((await ctx.api.post("/register/resend").send({ email: "x@test.mk" })).status).toBe(400);
        await ctx.close();
    });

    test("production refuses to start without a mail/SMS provider", () => {
        expect(() => createApp({
            nodeEnv: "production",
            jwtSecret: "x".repeat(40),
            clientOrigin: "https://beautyqueen.mk",
            env: {},
            dataDir: require("./helpers").makeDataDir(),
            logger: { log() {}, error() {} }
        })).toThrow(/SMTP_HOST/);
    });
});

describe("forgotten password", () => {
    test("reset by e-mail code, old sessions are logged out", async () => {
        const ctx = withOutbox();
        await ctx.api.post("/register").send({ email: "ana@test.mk", password: "secret1" });
        const { body: session } = await ctx.api.post("/register/verify").send({ email: "ana@test.mk", code: ctx.lastCode() });

        expect((await ctx.api.post("/password/forgot").send({ email: "ghost@test.mk" })).status).toBe(404);
        expect((await ctx.api.post("/password/forgot").send({ email: "ana@test.mk", channel: "sms" })).status).toBe(400);
        const forgot = await ctx.api.post("/password/forgot").send({ email: "ANA@test.mk" });
        expect(forgot.status).toBe(200);
        expect(ctx.outbox.at(-1)).toMatchObject({ purpose: "reset", to: "ana@test.mk" });

        // a too-short password doesn't burn the code
        expect((await ctx.api.post("/password/reset").send({ email: "ana@test.mk", code: ctx.lastCode(), newPassword: "1" })).status).toBe(400);
        expect((await ctx.api.post("/password/reset").send({ email: "ana@test.mk", code: "abc", newPassword: "newpass1" })).status).toBe(400);

        // the old token was issued in an earlier second than the reset
        await new Promise(r => setTimeout(r, 1100));
        const reset = await ctx.api.post("/password/reset").send({ email: "ana@test.mk", code: ctx.lastCode(), newPassword: "newpass1" });
        expect(reset.status).toBe(200);
        expect(reset.body.token).toBeTruthy();

        expect((await ctx.api.get("/me").set("Authorization", `Bearer ${session.token}`)).status).toBe(401);
        expect((await ctx.api.get("/me").set("Authorization", `Bearer ${reset.body.token}`)).status).toBe(200);
        expect((await ctx.api.post("/login").send({ email: "ana@test.mk", password: "newpass1" })).status).toBe(200);
        expect((await ctx.api.post("/login").send({ email: "ana@test.mk", password: "secret1" })).status).toBe(401);
        await ctx.close();
    });
});

describe("a client can't double-book themselves", () => {
    test("overlap with own appointment on another station -> 409, back-to-back is fine", async () => {
        const ctx = buildApp();
        const token = await registerAndLogin(ctx.api, { email: "ana@test.mk" });
        const auth = { Authorization: `Bearer ${token}` };
        const date = nextDate([1, 2, 3, 4, 5], 3);

        expect((await ctx.api.post("/appointments").set(auth).send({ date, time: "18:45", service: "Депилација (раце+нозе)" })).status).toBe(201);
        // different station (lash) but the same person at 18:30-19:30
        const clash = await ctx.api.post("/appointments").set(auth).send({ date, time: "18:30", service: "Lash Lift" });
        expect(clash.status).toBe(409);
        expect(clash.body.message).toContain("18:45–19:30");
        expect((await ctx.api.post("/appointments").set(auth).send({ date, time: "17:45", service: "Lash Lift" })).status).toBe(201);
        await ctx.close();
    });
});
