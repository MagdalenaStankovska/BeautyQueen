const { test, expect } = require("@playwright/test");
const { API, bookingDate, apiRegister, loginPage, pickDate } = require("./helpers");

const DAY = bookingDate(3);
const FULL_PEDICURE = "Педикир (целосен+gel лак)";
const SHORT_PEDICURE = "Педикир (гел лак на нозе)";

test.describe.serial("main user flows", () => {
    let admin;

    test.beforeAll(async ({ request }) => {
        admin = await apiRegister(request, { email: "admin@e2e.mk", name: "Марија" });
    });

    test("new client registers through the UI and lands on a personalised home", async ({ page }) => {
        await page.goto("/");
        await page.getByRole("button", { name: "Регистрирај се" }).click();
        await page.getByPlaceholder("Име и презиме").fill("Ана Тест");
        await page.getByPlaceholder("Телефон").fill("070111222");
        await page.getByPlaceholder("Е-пошта").fill("ana@e2e.mk");
        await page.getByPlaceholder(/Лозинка/).fill("secret1");
        await page.getByRole("button", { name: "Регистрирај се" }).click();

        // the account only exists after the e-mailed code is confirmed
        await expect(page.getByRole("heading", { name: "Потврдете ја сметката" })).toBeVisible();
        await page.getByLabel("Код за потврда").fill("000000");
        await page.getByRole("button", { name: "Потврди" }).click();
        await expect(page.getByText(/Погрешен код/)).toBeVisible();
        const devCode = (await page.locator(".dev-code strong").textContent()).trim();
        await page.getByLabel("Код за потврда").fill(devCode);
        await page.getByRole("button", { name: "Потврди" }).click();
        await expect(page.getByRole("heading", { name: "Добредојдовте, Ана!" })).toBeVisible();
    });

    test("client books; admin sees it live, accepts; client is notified live", async ({ browser, request }) => {
        const client = await apiRegister(request, { email: "ana@e2e.mk", password: "secret1" });

        const adminCtx = await browser.newContext();
        const adminPage = await adminCtx.newPage();
        await loginPage(adminPage, admin, "termin");
        await expect(adminPage.getByRole("heading", { name: "Нови барања" })).toBeVisible();

        const clientCtx = await browser.newContext();
        const page = await clientCtx.newPage();
        await loginPage(page, client, "termin");

        await page.getByRole("button", { name: new RegExp(FULL_PEDICURE.replace(/[()+]/g, "\\$&")) }).click();
        await pickDate(page.locator(".calendar-client-form"), DAY);
        await page.getByRole("button", { name: "14:45 – слободно" }).click();
        await page.getByPlaceholder(/боја, дизајн/).fill("црвена");
        await page.getByRole("button", { name: "Испрати барање" }).click();
        await expect(page.getByText(/Барањето е испратено/)).toBeVisible();
        await expect(page.locator(".client-notification-panel")).toContainText("Во чекање");

        // admin: real-time toast + request card, without reloading
        await expect(adminPage.locator(".toast").filter({ hasText: "Ново барање за термин" })).toBeVisible();
        const card = adminPage.locator(".pending-appointment").filter({ hasText: "Ана Тест" });
        await expect(card).toContainText("црвена");
        await card.locator("select").selectOption("Izabela");
        await card.getByRole("button", { name: "Прифати" }).click();
        await expect(card).toHaveCount(0);

        // client: real-time confirmation
        await expect(page.locator(".toast").filter({ hasText: "Терминот е потврден" })).toBeVisible();
        await expect(page.locator(".client-notification-panel")).toContainText("Потврден");
        await expect(page.locator(".client-notification-panel")).toContainText("Изабела");

        await adminCtx.close();
        await clientCtx.close();
    });

    test("unavailable slots stay visible but disabled, and explain why", async ({ page, request }) => {
        const eva = await apiRegister(request, { email: "eva@e2e.mk", name: "Ева" });
        await loginPage(page, eva, "termin");
        await page.getByRole("button", { name: new RegExp(SHORT_PEDICURE.replace(/[()+]/g, "\\$&")) }).click();
        await pickDate(page.locator(".calendar-client-form"), DAY);

        // the real booking stays visible; 14:15/14:30 (a 45 min pedicure would run into 14:45) aren't offered
        const blocked = page.getByRole("button", { name: /^14:45 – недостапно/ });
        await expect(blocked).toBeVisible();
        await expect(blocked).toHaveAttribute("aria-disabled", "true");
        await expect(page.getByRole("button", { name: /^14:15/ })).toHaveCount(0);
        await expect(page.getByRole("button", { name: /^19:30/ })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "14:00 – слободно" })).toBeEnabled();

        // Playwright won't click aria-disabled elements, but a real tap does — that's how users get the explanation
        await blocked.dispatchEvent("click");
        await expect(page.getByRole("status").filter({ hasText: "14:45 не е достапно" })).toContainText("столот за педикир");
        await expect(page.getByRole("button", { name: "Испрати барање" })).toBeDisabled();

        // server enforces the same rule
        const res = await request.post(`${API}/appointments`, {
            headers: { Authorization: `Bearer ${eva.token}` },
            data: { date: DAY.toLocaleDateString("sv-SE"), time: "14:15", service: SHORT_PEDICURE }
        });
        expect(res.status()).toBe(409);
    });

    test("client cancels with a reason; admin's reason dialog is fully on screen", async ({ browser, request }) => {
        const client = await apiRegister(request, { email: "ana@e2e.mk", password: "secret1" });
        const clientCtx = await browser.newContext();
        const page = await clientCtx.newPage();
        await loginPage(page, client, "termin");
        await page.locator(".client-notification-item").filter({ hasText: FULL_PEDICURE }).getByRole("button", { name: "Откажи" }).click();
        const dialog = page.getByRole("dialog");
        await dialog.getByRole("textbox").fill("Болна сум");
        await dialog.getByRole("button", { name: "Откажи термин" }).click();
        await expect(page.locator(".toast").filter({ hasText: "Терминот е откажан" })).toBeVisible();
        await clientCtx.close();

        const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const adminPage = await adminCtx.newPage();
        await loginPage(adminPage, admin, "notifications");
        await adminPage.getByRole("button", { name: /Види причина/ }).first().click();
        const reason = adminPage.getByRole("dialog");
        await expect(reason).toContainText("Болна сум");
        await reason.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
        await expect(reason).toContainText("+38970111222"); // stored in international format

        const box = await reason.boundingBox();
        const vp = adminPage.viewportSize();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
        expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
        // centred horizontally (was trapped inside the page card before)
        expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThan(5);

        await adminPage.keyboard.press("Escape");
        await expect(reason).toHaveCount(0);
        await adminCtx.close();
    });

    test("gallery photo viewer covers the whole screen and navigates", async ({ page, request }) => {
        const client = await apiRegister(request, { email: "ana@e2e.mk", password: "secret1" });
        await loginPage(page, client, "услуги");
        await page.locator(".service-card").first().getByRole("button", { name: "Галерија" }).click();
        await page.locator(".gallery-thumb").first().click();

        const viewer = page.locator(".lightbox");
        await expect(viewer).toBeVisible();
        const box = await viewer.boundingBox();
        const vp = page.viewportSize();
        expect(box).toMatchObject({ x: 0, y: 0, width: vp.width, height: vp.height });
        await expect(page.locator(".lightbox-counter")).toContainText("1 /");
        await page.keyboard.press("ArrowRight");
        await expect(page.locator(".lightbox-counter")).toContainText("2 /");
        await page.keyboard.press("Escape");
        await expect(viewer).toHaveCount(0);
    });

    test("wrong password shows an error; backend outage shows a clear message", async ({ page }) => {
        await page.goto("/");
        await page.getByPlaceholder("Е-пошта").fill("ana@e2e.mk");
        await page.getByPlaceholder(/Лозинка/).fill("wrong-pass");
        await page.getByRole("button", { name: "Најави се" }).click();
        await expect(page.getByText("Погрешна е-пошта или лозинка")).toBeVisible();

        await page.route(`${API}/**`, route => route.abort("connectionrefused"));
        await page.getByRole("button", { name: "Најави се" }).click();
        await expect(page.getByText("Нема врска со серверот.")).toBeVisible();
    });

    test("expired session logs the user out instead of breaking", async ({ page }) => {
        await loginPage(page, { token: "expired.or.invalid", email: "x@e2e.mk", role: "user", name: "X" }, "termin");
        await expect(page.getByRole("heading", { name: "Најава" })).toBeVisible();
    });
});
