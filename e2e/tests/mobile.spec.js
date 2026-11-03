const { test, expect } = require("@playwright/test");
const { bookingDate, apiRegister, loginPage, pickDate } = require("./helpers");

test("mobile: tab bar navigation, booking grid and bottom-sheet dialog", async ({ page, request }) => {
    const user = await apiRegister(request, { email: "mobile@e2e.mk", name: "Мила" });
    await loginPage(page, user);

    const tabbar = page.locator(".bq-tabbar");
    await expect(tabbar).toBeVisible();
    await expect(page.locator(".bq-nav")).toBeHidden();

    // no horizontal scrolling on a phone
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await tabbar.getByRole("button", { name: "Закажи" }).click();
    await page.getByRole("button", { name: /Lash Lift/ }).click();
    await pickDate(page.locator(".calendar-client-form"), bookingDate(3));
    await page.getByRole("button", { name: "12:00 – слободно" }).click();
    await page.getByRole("button", { name: "Испрати барање" }).click();
    await expect(page.getByText(/Барањето е испратено/)).toBeVisible();

    // cancel dialog opens as a bottom sheet fully inside the screen
    await page.locator(".client-notification-item").first().getByRole("button", { name: "Откажи" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    // measure after the slide-up animation has finished
    await sheet.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
    const box = await sheet.boundingBox();
    const vp = page.viewportSize();
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
    expect(box.width).toBeGreaterThanOrEqual(vp.width - 1);
    await sheet.getByRole("button", { name: "Назад" }).click();

    await tabbar.getByRole("button", { name: "Профил" }).click();
    await expect(page.getByRole("heading", { name: "Мој профил" })).toBeVisible();
    await tabbar.getByRole("button", { name: "Почетна" }).click();
    await expect(page.getByRole("heading", { name: "Добредојдовте, Мила!" })).toBeVisible();
});
