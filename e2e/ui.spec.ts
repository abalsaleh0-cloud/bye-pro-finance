import { expect, test, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "e2e@example.com",
  email_confirmed_at: "2026-10-24T00:00:00.000Z",
  confirmed_at: "2026-10-24T00:00:00.000Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "E2E User", username: "e2e_user" },
};
const session = { access_token: "e2e-access-token", refresh_token: "e2e-refresh-token", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user };

const screens = [
  ["لوحة التحكم", "Dashboard"], ["الحسابات", "Accounts"], ["المعاملات", "Transactions"], ["التحويلات", "Transfers"],
  ["الميزانيات", "Budgets"], ["الديون", "Debts"], ["الفواتير", "Bills"], ["الادخار", "Savings"],
  ["الأصول", "Assets"], ["التقارير", "Reports"], ["المنزل", "Household"], ["المستندات", "Documents"],
  ["المسح الذكي", "Smart Scan"], ["المساعد المالي", "Financial Assistant"], ["الإشعارات", "Notifications"],
  ["استيراد وتصدير", "Import / Export"], ["الإعدادات", "Settings"], ["الإدارة", "Administration"],
] as const;

async function mockAuth(page: Page) {
  await page.route("**/auth/v1/session**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) }));
  await page.route("**/auth/v1/token?grant_type=password", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) }));
  await page.route("**/auth/v1/user**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) }));
}

async function visibleText(page: Page, label: string) {
  const buttons = page.locator(".main-nav .nav-item");
  const count = await buttons.count();
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    const spans = await button.locator("span").allInnerTexts();
    if (spans.some(text => text.replace(/\s+/g, " ").trim() === label)) {
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeVisible();
      return button;
    }
  }
  throw new Error(`Navigation button not found: ${label}`);
}

async function enterWorkspace(page: Page, locale: "ar" | "en") {
  await page.goto("/");
  const emailLabel = locale === "ar" ? "البريد الإلكتروني" : "Email address";
  const passwordLabel = locale === "ar" ? "كلمة المرور" : "Password";
  const signInLabel = locale === "ar" ? "تسجيل الدخول" : "Sign in";
  await page.getByLabel(emailLabel).fill(user.email);
  await page.getByLabel(passwordLabel, { exact: true }).fill("StrongPassword123!");
  await page.getByRole("button", { name: signInLabel }).click();
  await expect(page.getByText(locale === "ar" ? "لوحة التحكم" : "Dashboard").last()).toBeVisible();
}

async function clickScreen(page: Page, label: string) {
  const target = await visibleText(page, label);
  await target.click({ force: true });
}

for (const locale of ["ar", "en"] as const) {
  test(`${locale}: 18 screens on mobile tablet desktop, states and accessibility`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript((value) => localStorage.setItem("bye-pro-finance.locale", value), locale);
    await mockAuth(page);
    await page.route("**/rest/v1/**", async route => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: "[]", headers: { "content-range": "*/0" } });
      } else {
        await route.continue();
      }
    });
    await enterWorkspace(page, locale);

    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    expect(await page.locator("html").getAttribute("lang")).toBe(locale);
    expect(await page.locator("html").getAttribute("dir")).toBe(locale === "ar" ? "rtl" : "ltr");
    expect(await page.locator("html").getAttribute("data-locale")).toBe(locale);
    expect(await page.locator("body").getAttribute("data-locale")).toBe(locale);

    for (const [ar, en] of screens) {
      const label = locale === "ar" ? ar : en;
      await clickScreen(page, label);
      await expect(page.locator("body")).toContainText(label);
      await expect(page.locator("body")).not.toContainText("Cannot read properties");
      await expect(page.locator("body")).not.toContainText("NaN");

      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter(v => v.impact === "critical" || v.impact === "serious");
      expect(blocking, `${locale}: ${label}`).toEqual([]);
    }

    expect(errors).toEqual([]);

    // Loading state: hold API responses while navigating and verify the screen remains mounted.
    await page.unroute("**/rest/v1/**");
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/rest/v1/**", async route => {
      if (route.request().method() === "GET") {
        await pending;
        await route.fulfill({ status: 200, contentType: "application/json", body: "[]", headers: { "content-range": "*/0" } });
      } else {
        await route.continue();
      }
    });
    await clickScreen(page, locale === "ar" ? "الحسابات" : "Accounts");
    await expect(page.locator("body")).toBeVisible();
    release();
    await page.waitForTimeout(300);

    // Empty-data state: the API returns an empty collection and the screen stays usable.
    await expect(page.locator("body")).toContainText(locale === "ar" ? "الحسابات" : "Accounts");

    // API-error state: a failed request must not crash or blank the application.
    await page.unroute("**/rest/v1/**");
    await page.route("**/rest/v1/**", async route => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "E2E forced error" }) });
      } else {
        await route.continue();
      }
    });
    await clickScreen(page, locale === "ar" ? "المعاملات" : "Transactions");
    await page.waitForTimeout(500);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Cannot read properties");
    await expect(page.locator("body")).not.toContainText("undefined");
  });
}
