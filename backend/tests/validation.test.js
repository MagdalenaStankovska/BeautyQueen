const { validateBooking, isValidDate, isValidTime, normalizeEmail, cleanText, fmtDate, createApp } = require("../app");
const { makeDataDir, cleanupDataDirs } = require("./helpers");

afterAll(cleanupDataDirs);

describe("isValidDate", () => {
    test.each([
        ["2030-01-07", true],
        ["2030-02-28", true],
        ["2028-02-29", true],
        ["2030-02-29", false],
        ["2030-02-31", false],
        ["2030-13-01", false],
        ["2030-1-7", false],
        ["07.01.2030", false],
        ["", false],
        [null, false],
        [20300107, false]
    ])("%p -> %p", (input, expected) => expect(isValidDate(input)).toBe(expected));
});

describe("isValidTime", () => {
    test.each([
        ["12:00", true],
        ["12:15", true],
        ["00:00", true],
        ["12:10", false],
        ["24:00", false],
        ["12:60", false],
        ["9:00", false],
        ["", false],
        [undefined, false],
        [1200, false]
    ])("%p -> %p", (input, expected) => expect(isValidTime(input)).toBe(expected));
});

describe("validateBooking", () => {
    const now = new Date("2030-01-07T12:00:00");
    const ok = { date: "2030-01-08", time: "12:00", service: "Lash Lift" };

    test("valid booking", () => expect(validateBooking(ok, { now })).toBeNull());
    test("bad date/time/service", () => {
        expect(validateBooking({ ...ok, date: "2030-02-31" }, { now })).toMatch(/датум/);
        expect(validateBooking({ ...ok, time: "12:07" }, { now })).toMatch(/време/);
        expect(validateBooking({ ...ok, service: "x" }, { now })).toMatch(/услуга/);
        expect(validateBooking({ ...ok, service: { $ne: 1 } }, { now })).toMatch(/услуга/);
    });
    test("past is rejected for everyone", () => {
        const past = { ...ok, date: "2030-01-07", time: "11:00" };
        expect(validateBooking(past, { now })).toMatch(/минатото/);
        expect(validateBooking(past, { now, admin: true })).toMatch(/минатото/);
    });
    test("minimum notice applies to clients only", () => {
        const soon = { ...ok, date: "2030-01-07", time: "12:15" };
        expect(validateBooking(soon, { now })).toMatch(/однапред/);
        expect(validateBooking(soon, { now, admin: true })).toBeNull();
    });
    test("max days ahead applies to clients only", () => {
        const far = { ...ok, date: "2030-06-01" };
        expect(validateBooking(far, { now })).toMatch(/90 дена/);
        expect(validateBooking(far, { now, admin: true })).toBeNull();
    });
});

describe("small helpers", () => {
    test("normalizeEmail", () => {
        expect(normalizeEmail("  Ana@Test.MK ")).toBe("ana@test.mk");
        expect(normalizeEmail(undefined)).toBe("");
        expect(normalizeEmail({ a: 1 })).toBe("");
    });
    test("cleanText trims, limits and rejects objects", () => {
        expect(cleanText("  hi  ", 10)).toBe("hi");
        expect(cleanText("x".repeat(500), 300)).toHaveLength(300);
        expect(cleanText(42, 10)).toBe("42");
        expect(cleanText({ evil: true }, 10)).toBe("");
        expect(cleanText(null, 10)).toBe("");
    });
    test("fmtDate", () => expect(fmtDate("2030-01-07")).toBe("07.01.2030"));
});

describe("createApp configuration guards", () => {
    test("production requires a strong JWT secret and explicit origin", () => {
        const dataDir = makeDataDir();
        expect(() => createApp({ dataDir, nodeEnv: "production", quiet: true, clientOrigin: "https://x.mk" }))
            .toThrow(/JWT_SECRET/);
        expect(() => createApp({ dataDir, nodeEnv: "production", quiet: true, jwtSecret: "x".repeat(40) }))
            .toThrow(/CLIENT_ORIGIN/);
    });

    test("refuses to start on a corrupt data file instead of wiping it", () => {
        const dataDir = makeDataDir({ "appointments.json": "{ not json" });
        expect(() => createApp({ dataDir, quiet: true })).toThrow(/not valid JSON/);
    });
});
