import { expect, test, type Page } from "@playwright/test";

const testUser = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "e2e@example.com",
  email_confirmed_at: "2026-10-24T00:00:00.000Z",
  phone: "",
  confirmed_at: "2026-10-24T00:00:00.000Z",
  last_sign_in_at: "2026-10-24T00:00:00.000Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "E2E User", username: "e2e_user" },
  identities: [],
  created_at: "2026-10-24T00:00:00.000Z",
  updated_at: "2026-10-24T00:00:00.000Z",
};

const session = {
  access_token: "e2e-access-token",
  refresh_token: "e2e-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: testUser,
};

async function mockAuth(page: Page) {
  await page.route("**/auth/v1/session**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });

  await page.route("**/auth/v1/token?grant_type=password", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
  });

  await page.route("**/auth/v1/signup", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { ...testUser, email: "new@example.com" }, session: null }),
    });
  });

  await page.route("**/auth/v1/recover**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });
}

test.describe("authentication", () => {
  test("sign-in succeeds and opens the protected workspace", async ({ page }) => {
    await mockAuth(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "تسجيل الدخول" })).toBeVisible();
    await page.getByLabel("البريد الإلكتروني").fill(testUser.email);
    await page.getByLabel("كلمة المرور", { exact: true }).fill("StrongPassword123!");
    await page.getByRole("button", { name: "تسجيل الدخول" }).click();

    await expect(page.getByText("لوحة التحكم").first()).toBeVisible();
    await expect(page.getByText("E2E User")).toBeVisible();
    await expect(page.getByText(testUser.email)).toHaveCount(0);
  });

  test("signup shows confirmation state", async ({ page }) => {
    await mockAuth(page);
    await page.goto("/");
    await page.getByRole("button", { name: "إنشاء حساب" }).click();
    await page.getByLabel("الاسم الكامل").fill("New E2E User");
    await page.getByLabel("اسم المستخدم").fill("new_e2e_user");
    await page.getByLabel("البريد الإلكتروني").fill("new@example.com");
    await page.getByLabel("كلمة المرور", { exact: true }).fill("StrongPassword123!");
    await page.getByRole("button", { name: "إنشاء حساب" }).click();
    await expect(page.getByText("تم إرسال رسالة تأكيد إلى بريدك الإلكتروني.")).toBeVisible();
  });

  test("password recovery sends a privacy-preserving confirmation", async ({ page }) => {
    await mockAuth(page);
    await page.goto("/");
    await page.getByRole("button", { name: "نسيت كلمة المرور؟" }).click();
    await page.getByLabel("البريد الإلكتروني").fill("unknown@example.com");
    await page.getByRole("button", { name: "استعادة كلمة المرور" }).click();
    await expect(page.getByText("إذا كان البريد مسجلًا، ستصلك تعليمات الاستعادة.")).toBeVisible();
  });

  test("password visibility can be toggled without submitting the form", async ({ page }) => {
    await mockAuth(page);
    await page.goto("/");

    const password = page.getByLabel("كلمة المرور", { exact: true });
    await password.fill("StrongPassword123!");
    await expect(password).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "إظهار كلمة المرور" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "إخفاء كلمة المرور" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "إخفاء كلمة المرور" }).click();
    await expect(password).toHaveAttribute("type", "password");
    await expect(page.getByRole("heading", { name: "تسجيل الدخول" })).toBeVisible();
  });
});
