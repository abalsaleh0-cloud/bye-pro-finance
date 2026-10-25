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

async function enterWorkspace(page: Page) {
  await page.goto("/");
  await page.getByLabel("البريد الإلكتروني").fill(user.email);
  await page.getByLabel("كلمة المرور", { exact: true }).fill("StrongPassword123!");
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
  await expect(page.getByText("لوحة التحكم").first()).toBeVisible();
}

async function clickScreen(page: Page, label: string) {
  const target = page.getByRole("button", { name: label, exact: true }).first();
  await expect(target).toBeVisible({ timeout: 5000 });
  await target.click();
}

for (const locale of ["ar", "en"] as const) {
  test.describe(`${locale} / all 18 screens`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("bye-pro-finance.locale", value), locale);
      await mockAuth(page);
      await page.route("**/rest/v1/**", async route => {
        if (route.request().method() === "GET") {
          await route.fulfill({ status: 200, contentType: "application/json", body: "[]", headers: { "content-range": "*/0" } });
        } else {
          await route.continue();
        }
      });
      await enterWorkspace(page);
    });

    test("18 screens render at the selected locale without page errors", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      expect(await page.locator("html").getAttribute("lang")).toBe(locale);
      for (const [ar, en] of screens) {
        const label = locale === "ar" ? ar : en;
        await clickScreen(page, label);
        await expect(page.locator("body")).toContainText(label);
        await expect(page.locator("body")).not.toContainText("undefined");
        await expect(page.locator("body")).not.toContainText("Cannot read properties");
      }
      expect(errors).toEqual([]);
    });

    test("all 18 screens pass axe accessibility checks", async ({ page }) => {
      for (const [ar, en] of screens) {
        await clickScreen(page, locale === "ar" ? ar : en);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations, `${locale}: ${ar}`).toEqual([]);
      }
    });

    test("empty data state does not crash the workspace", async ({ page }) => {
      await clickScreen(page, locale === "ar" ? "الحسابات" : "Accounts");
      await expect(page.locator("body")).toContainText(locale === "ar" ? "الحسابات" : "Accounts");
      await expect(page.locator("body")).not.toContainText("undefined");
      await expect(page.locator("body")).not.toContainText("NaN");
    });

    test("API error state remains recoverable", async ({ page }) => {
      await page.route("**/rest/v1/**", async route => {
        if (route.request().method() === "GET") {
          await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "E2E forced error" }) });
        } else {
          await route.continue();
        }
      });
      await clickScreen(page, locale === "ar" ? "المعاملات" : "Transactions");
      await page.waitForTimeout(300);
      await expect(page.locator("body")).not.toContainText("Cannot read properties");
      await expect(page.locator("body")).not.toContainText("undefined");
    });
  });
}
