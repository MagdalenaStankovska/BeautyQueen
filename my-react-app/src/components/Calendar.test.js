import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import CalendarComponent from "./Calendar";
import { formatLocalDate } from "../salon";
import api from "../api";

jest.mock("../api", () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
    errorMessage: (err, fallback) => err?.response?.data?.message || fallback || "error"
}));

// first open weekday (Mon–Fri) at least 2 days ahead
const bookingDay = () => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1);
    return d;
};

function mockData(availability, mine = []) {
    api.get.mockImplementation((url) =>
        Promise.resolve({ data: url === "/appointments/availability" ? availability : mine }));
}

async function openDay(day) {
    render(<CalendarComponent role="user" syncTick={0} showToast={jest.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Педикир \(гел лак на нозе\)/ }));
    // navigate the month view if needed, then pick the day
    if (day.getMonth() !== new Date().getMonth()) fireEvent.click(document.querySelector(".react-calendar__navigation__next-button"));
    const tile = [...document.querySelectorAll(".react-calendar__month-view__days__day:not(.react-calendar__month-view__days__day--neighboringMonth)")]
        .find(t => t.textContent.trim() === String(day.getDate()));
    fireEvent.click(tile);
}

afterEach(() => jest.clearAllMocks());

test("unavailable slots stay visible, are disabled, and explain why when tapped", async () => {
    const day = bookingDay();
    mockData([{ id: 1, date: formatLocalDate(day), time: "14:45", service: "Педикир (целосен+gel лак)", status: "accepted" }]);
    await openDay(day);

    // 14:45 is the real booking and stays visible; 14:15/14:30 (45 min wouldn't fit before it) aren't offered at all
    const blocked = await screen.findByRole("button", { name: /^14:45 – недостапно/ });
    expect(blocked).toHaveAttribute("aria-disabled", "true");
    expect(blocked).toHaveClass("slot-unavailable", "slot-resource");
    expect(screen.queryByRole("button", { name: /^14:15/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^14:30/ })).not.toBeInTheDocument();
    // nor are times that would end after closing (20:00)
    expect(screen.getByRole("button", { name: "19:15 – слободно" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^19:30/ })).not.toBeInTheDocument();

    const free = screen.getByRole("button", { name: "14:00 – слободно" });
    expect(free).toHaveAttribute("aria-disabled", "false");

    // tapping the blocked slot explains, and does not select it
    fireEvent.click(blocked);
    const reason = screen.getByRole("status");
    expect(within(reason).getByText(/14:45 не е достапно/)).toBeInTheDocument();
    expect(reason).toHaveTextContent("столот за педикир");
    expect(screen.queryByText("Вашиот термин")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Испрати барање" })).toBeDisabled();

    // a free slot can be selected and submitted
    fireEvent.click(free);
    expect(screen.getByText("Вашиот термин")).toBeInTheDocument();
    api.post.mockResolvedValue({ data: {} });
    fireEvent.click(screen.getByRole("button", { name: "Испрати барање" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/appointments", expect.objectContaining({
        date: formatLocalDate(day), time: "14:00", service: "Педикир (гел лак на нозе)"
    })));
    expect(await screen.findByText(/Барањето е испратено/)).toBeInTheDocument();
});

test("booked times stay visible even when the whole day is full", async () => {
    const day = bookingDay();
    const dateStr = formatLocalDate(day);
    // pedicure chair booked back-to-back 11:00–20:00
    const allDay = [];
    for (let m = 11 * 60; m + 45 <= 20 * 60; m += 45) {
        allDay.push({ id: m, date: dateStr, time: `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`, service: "Педикир (гел лак на нозе)", status: "accepted" });
    }
    mockData(allDay);
    await openDay(day);

    await screen.findByText(/Нема слободни термини/);
    const slots = document.querySelectorAll(".slot");
    expect(slots.length).toBe(34); // 11:00–19:15 (a 45 min service started later would end after 20:00)
    expect([...slots].every(s => s.getAttribute("aria-disabled") === "true")).toBe(true);
});

test("times overlapping the client's own appointment are blocked", async () => {
    const day = bookingDay();
    const dateStr = formatLocalDate(day);
    const own = { id: 7, userEmail: "me@x.mk", date: dateStr, time: "12:00", service: "Lash Lift", status: "pending" };
    mockData([own], [own]);
    await openDay(day);
    const slot = await screen.findByRole("button", { name: /^12:30 – недостапно: Веќе имате термин/ });
    expect(slot).toHaveClass("slot-mine");
    expect(screen.getByRole("button", { name: "13:00 – слободно" })).toBeInTheDocument();
});

test("server error on submit is shown to the user", async () => {
    const day = bookingDay();
    mockData([]);
    await openDay(day);
    fireEvent.click(await screen.findByRole("button", { name: "12:00 – слободно" }));
    api.post.mockRejectedValue({ response: { data: { message: "Терминот е зафатен" } } });
    fireEvent.click(screen.getByRole("button", { name: "Испрати барање" }));
    expect(await screen.findByText("Терминот е зафатен")).toBeInTheDocument();
});
