const API = "http://localhost:4100";

// First Mon–Fri date at least `minDays` ahead.
function bookingDate(minDays = 3) {
    const d = new Date();
    d.setDate(d.getDate() + minDays);
    while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1);
    return d;
}

async function apiRegister(request, { email, password = "secret1", name = "", phone = "" }) {
    await request.post(`${API}/register`, { data: { email, password, name, phone } });
    const res = await request.post(`${API}/login`, { data: { email, password } });
    return res.json(); // { token, email, role, name, phone }
}

// Logs a page in by seeding localStorage before the app boots (faster than the UI form).
async function loginPage(page, session, hash = "home") {
    const { token, ...user } = session;
    await page.addInitScript(([t, u]) => {
        localStorage.setItem("token", t);
        localStorage.setItem("user", u);
        localStorage.setItem("pushPromptDismissed", "1");
    }, [token, JSON.stringify(user)]);
    await page.goto(`/#${hash}`);
}

// Picks a date in a react-calendar inside `scope`.
async function pickDate(scope, date) {
    const now = new Date();
    const monthsAhead = (date.getFullYear() - now.getFullYear()) * 12 + date.getMonth() - now.getMonth();
    for (let i = 0; i < monthsAhead; i++) await scope.locator(".react-calendar__navigation__next-button").first().click();
    await scope
        .locator(".react-calendar__month-view__days__day:not(.react-calendar__month-view__days__day--neighboringMonth)")
        .filter({ has: scope.page().locator("abbr", { hasText: new RegExp(`^${date.getDate()}$`) }) })
        .first()
        .click();
}

module.exports = { API, bookingDate, apiRegister, loginPage, pickDate };
