const { SALON, toMinutes, minutesToTime, getService, dayHours, isActive, slotProblem, candidateTimes } = require("../salon-config");

const MONDAY = "2030-01-07";
const SATURDAY = "2030-01-12";
const SUNDAY = "2030-01-13";

const appt = (time, service, extra = {}) => ({ id: Math.random(), date: MONDAY, time, service, status: "accepted", ...extra });

describe("time helpers", () => {
    test("toMinutes / minutesToTime round-trip", () => {
        expect(toMinutes("00:00")).toBe(0);
        expect(toMinutes("14:45")).toBe(885);
        expect(minutesToTime(885)).toBe("14:45");
        expect(minutesToTime(toMinutes("09:05"))).toBe("09:05");
    });

    test("getService finds known services only", () => {
        expect(getService("Lash Lift").duration).toBe(60);
        expect(getService("----")).toBeUndefined();
    });

    test("dayHours follows the weekday schedule", () => {
        expect(dayHours(MONDAY)).toEqual({ open: "11:00", close: "20:00" });
        expect(dayHours(SATURDAY)).toEqual({ open: "10:00", close: "16:00" });
        expect(dayHours(SUNDAY)).toBeNull();
    });

    test("isActive only for pending/accepted", () => {
        expect(isActive({ status: "pending" })).toBe(true);
        expect(isActive({ status: "accepted" })).toBe(true);
        expect(isActive({ status: "rejected" })).toBe(false);
        expect(isActive({ status: "cancelled" })).toBe(false);
    });
});

describe("candidateTimes", () => {
    test("service must finish by closing time", () => {
        const times = candidateTimes(MONDAY, "Маникир (наливни)"); // 105 min, closes 20:00
        expect(times[0]).toBe("11:00");
        expect(times[times.length - 1]).toBe("18:15");
        expect(times).not.toContain("18:30");
    });

    test("uses the slot step", () => {
        const times = candidateTimes(SATURDAY, "Чупање веѓи");
        expect(times.slice(0, 3)).toEqual(["10:00", "10:15", "10:30"]);
        expect(times[times.length - 1]).toBe("15:30");
    });

    test("closed day and unknown service give no times", () => {
        expect(candidateTimes(SUNDAY, "Lash Lift")).toEqual([]);
        expect(candidateTimes(MONDAY, "nope")).toEqual([]);
    });
});

describe("slotProblem", () => {
    const req = (time, service) => ({ date: MONDAY, time, service });

    test("free slot on empty day", () => {
        expect(slotProblem([], req("14:00", "Lash Lift"))).toBeNull();
    });

    test("unknown service", () => {
        expect(slotProblem([], req("14:00", "x")).code).toBe("service");
    });

    test("closed day and outside hours", () => {
        expect(slotProblem([], { date: SUNDAY, time: "12:00", service: "Lash Lift" }).code).toBe("closed");
        expect(slotProblem([], req("10:45", "Lash Lift")).code).toBe("hours");
        expect(slotProblem([], req("19:30", "Lash Lift")).code).toBe("hours"); // would end 20:30
        expect(slotProblem([], req("19:00", "Lash Lift"))).toBeNull(); // ends exactly 20:00
    });

    test("the 14:45 pedicure case: earlier overlapping starts blocked, adjacent ones allowed", () => {
        const booked = [appt("14:45", "Педикир (целосен+gel лак)")]; // 14:45–16:00
        expect(slotProblem(booked, req("14:00", "Педикир (гел лак на нозе)"))).toBeNull(); // 14:00–14:45
        const p = slotProblem(booked, req("14:15", "Педикир (гел лак на нозе)"));
        expect(p.code).toBe("resource");
        expect(p.message).toContain("столот за педикир");
        expect(p.message).toContain("14:45–16:00");
        expect(slotProblem(booked, req("16:00", "Педикир (гел лак на нозе)"))).toBeNull();
        expect(slotProblem(booked, req("13:45", "Педикир (целосен+gel лак)")).code).toBe("resource");
    });

    test("different station is not affected", () => {
        const booked = [appt("14:45", "Педикир (целосен+gel лак)")];
        expect(slotProblem(booked, req("14:45", "Lash Lift"))).toBeNull();
    });

    test("manicure has two tables", () => {
        const one = [appt("12:00", "Маникир (само гел лак)")];
        expect(slotProblem(one, req("12:00", "Маникир (наливни)"))).toBeNull();
        const two = [...one, appt("12:30", "Маникир (наливни)")];
        expect(slotProblem(two, req("12:15", "Маникир (само гел лак)")).code).toBe("resource");
    });

    test("pending requests also hold capacity, cancelled/rejected do not", () => {
        expect(slotProblem([appt("12:00", "Lash Lift", { status: "pending" })], req("12:30", "Lash Lift")).code).toBe("resource");
        expect(slotProblem([appt("12:00", "Lash Lift", { status: "cancelled" })], req("12:30", "Lash Lift"))).toBeNull();
        expect(slotProblem([appt("12:00", "Lash Lift", { status: "rejected" })], req("12:30", "Lash Lift"))).toBeNull();
    });

    test("no more parallel clients than staff", () => {
        expect(SALON.employees).toHaveLength(3);
        const three = [
            appt("12:00", "Lash Lift"),
            appt("12:00", "Педикир (гел лак на нозе)", { status: "pending" }),
            appt("12:00", "Депилација (интима)")
        ];
        const p = slotProblem(three, req("12:00", "Чупање веѓи"));
        expect(p.code).toBe("staff");
    });

    test("ignoreId excludes the appointment itself and other days are ignored", () => {
        const a = appt("12:00", "Lash Lift");
        expect(slotProblem([a], req("12:00", "Lash Lift"), { ignoreId: a.id })).toBeNull();
        expect(slotProblem([{ ...a, date: "2030-01-08" }], req("12:00", "Lash Lift"))).toBeNull();
    });

    test("appointments with unknown legacy services are ignored safely", () => {
        expect(slotProblem([appt("12:00", "ÐŸÐµÐ´Ð¸ÐºÐ¸Ñ€")], req("12:00", "Lash Lift"))).toBeNull();
    });

    test("ignoreHours lets admins book outside opening hours", () => {
        expect(slotProblem([], { date: SUNDAY, time: "12:00", service: "Lash Lift" }, { ignoreHours: true })).toBeNull();
    });
});
