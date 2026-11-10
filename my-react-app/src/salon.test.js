import {
    applyConfig,
    candidateTimes,
    dayHours,
    dayTimes,
    endTimeOf,
    formatDisplayDate,
    formatFriendlyDate,
    formatLocalDate,
    freeTimes,
    getEmployees,
    serviceGroups,
    slotProblem,
    timeAgo
} from "./salon";

// a Monday far in the future so "past"/"lead" checks never interfere
const MONDAY = "2030-01-07";
const SUNDAY = "2030-01-13";
const booked = (time, service, extra = {}) => ({ id: Math.random(), date: MONDAY, time, service, status: "accepted", ...extra });

test("opening hours and day grid", () => {
    expect(dayHours(MONDAY)).toEqual({ open: "11:00", close: "20:00" });
    expect(dayHours(SUNDAY)).toBeNull();
    const grid = dayTimes(MONDAY);
    expect(grid[0]).toBe("11:00");
    expect(grid[grid.length - 1]).toBe("19:45");
    expect(dayTimes(SUNDAY)).toEqual([]);
});

test("candidate times end before closing", () => {
    const times = candidateTimes(MONDAY, "Маникир (наливни)");
    expect(times[times.length - 1]).toBe("18:15");
});

test("the 14:45 case: grid keeps every time, only overlapping ones get a reason", () => {
    const appts = [booked("14:45", "Педикир (целосен+gel лак)")];
    const svc = "Педикир (гел лак на нозе)";
    const problem = (t) => slotProblem(appts, { date: MONDAY, time: t, service: svc });
    expect(problem("14:00")).toBeNull();
    // 14:15 itself is free – the 45 min service just can't finish before the 14:45 booking
    expect(problem("14:15").code).toBe("fit");
    expect(problem("14:15").message).toContain("од 14:45");
    expect(problem("14:30").code).toBe("fit");
    expect(problem("14:45").code).toBe("resource");
    expect(problem("14:45").message).toContain("14:45–16:00");
    expect(problem("15:45").code).toBe("resource");
    expect(problem("16:00")).toBeNull();
    expect(problem("19:30").code).toBe("hours");
    expect(freeTimes(appts, MONDAY, svc)).not.toContain("14:15");
    expect(freeTimes(appts, MONDAY, svc)).toContain("14:00");
});

test("the 18:45 case: times before a booking are 'too short', not 'booked'", () => {
    const appts = [booked("18:45", "Депилација (раце+нозе)")];
    const svc = "Депилација (раце+нозе)";
    const problem = (t) => slotProblem(appts, { date: MONDAY, time: t, service: svc });
    expect(problem("18:00")).toBeNull(); // 18:00–18:45, back to back
    expect(problem("18:15").code).toBe("fit");
    expect(problem("18:30").code).toBe("fit");
    expect(problem("18:45").code).toBe("resource");
    expect(problem("19:00").code).toBe("resource");
});

test("a client's own appointments block overlapping times on other stations", () => {
    const mine = [booked("18:00", "Депилација (раце+нозе)", { id: "m1" })];
    const opts = { mine };
    expect(slotProblem(mine, { date: MONDAY, time: "18:15", service: "Lash Lift" }, opts).code).toBe("mine");
    expect(slotProblem(mine, { date: MONDAY, time: "18:15", service: "Lash Lift" }, opts).message).toContain("18:00–18:45");
    expect(slotProblem(mine, { date: MONDAY, time: "18:45", service: "Lash Lift" }, opts)).toBeNull();
    expect(slotProblem(mine, { date: MONDAY, time: "17:00", service: "Lash Lift" }, opts)).toBeNull();
    // cancelled appointments don't count
    expect(slotProblem([], { date: MONDAY, time: "18:15", service: "Lash Lift" }, { mine: [{ ...mine[0], status: "cancelled" }] })).toBeNull();
});

test("staff limit and past/lead checks", () => {
    const three = [
        booked("12:00", "Lash Lift"),
        booked("12:00", "Чупање веѓи"),
        booked("12:00", "Депилација (интима)", { status: "pending" })
    ];
    expect(slotProblem(three, { date: MONDAY, time: "12:00", service: "Маникир (наливни)" }).code).toBe("staff");
    expect(slotProblem([], { date: "2020-01-06", time: "12:00", service: "Lash Lift" }).code).toBe("past");
});

test("minimum notice: a slot 10 minutes from now is not bookable by clients", () => {
    const soon = new Date(Date.now() + 10 * 60000);
    const time = `${String(soon.getHours()).padStart(2, "0")}:${String(soon.getMinutes()).padStart(2, "0")}`;
    expect(slotProblem([], { date: formatLocalDate(soon), time, service: "Lash Lift" }).code).toBe("lead");
});

test("admin mode skips minimum notice but still reports capacity", () => {
    const appts = [booked("12:00", "Lash Lift")];
    expect(slotProblem(appts, { date: MONDAY, time: "12:30", service: "Lash Lift" }, { admin: true }).code).toBe("resource");
    expect(slotProblem(appts, { date: MONDAY, time: "12:00", service: "Lash Lift" }, { admin: true, ignoreId: appts[0].id })).toBeNull();
});

test("formatting helpers", () => {
    expect(formatDisplayDate("2030-01-07")).toBe("07.01.2030");
    expect(formatLocalDate(new Date(2030, 0, 7))).toBe("2030-01-07");
    expect(formatFriendlyDate(formatLocalDate(new Date()))).toMatch(/^Денес/);
    expect(formatFriendlyDate(MONDAY)).toBe("Пон, 07.01");
    expect(endTimeOf({ time: "14:45", service: "Педикир (целосен+gel лак)" })).toBe("16:00");
    expect(timeAgo(new Date().toISOString())).toBe("сега");
    expect(timeAgo(new Date(Date.now() - 5 * 60000).toISOString())).toBe("пред 5 мин");
});

test("applyConfig overrides defaults and ignores invalid payloads", () => {
    const groups = serviceGroups();
    expect(Object.keys(groups)).toContain("Маникир");
    applyConfig({ nope: true });
    expect(getEmployees()).toHaveLength(3);
    applyConfig({ services: [{ name: "Test", category: "X", duration: 30, resource: "brow" }], employees: [{ id: "A", label: "А" }] });
    expect(serviceGroups()).toEqual({ X: ["Test"] });
    expect(getEmployees()).toEqual([{ id: "A", label: "А" }]);
});
