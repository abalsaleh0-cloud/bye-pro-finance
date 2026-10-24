import { expect, test } from "@playwright/test";

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
  user_metadata: {},
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

async function mockAuth(page: Parameters<typeof test>[0] extends never ? never : any) {
  await page.route("**/auth/v1/session**", async (route: any) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });

  await page.route("**/auth/v1/token?grant_type=password", async (route: any) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
  });

  await page.route("**/auth/v1/signup", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { ...testUser, email: "new@example.com" }, session: null }),
    });
  });

  await page.route("**/auth/v1/recover", async (route: any) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });
}

test.describe("authentication", () => {
  test("sign-in succeeds and opens the protected workspace", async ({ page }) => {
    await mockAuth(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "تسجيل الدخول" })).toBeVisible();
    await page.getByLabel("البريد الإلكتروني").fill(testUser.email);
    await page.getByLabel("كلمة المرور").fill("StrongPassword123!");
    await page.getByRole("button", { name: "تسجيل الدخول" }).click();

    await expect(page.getByText("لوحة التحكم").first()).toBeVisible();
    await expect(page.getByText(testUser.email)).toBeVisible();
  });

  test("signup shows confirmation state", async ({ page }) => {
    await mockAuth(page);
    await page.goto("/");
    await page.getByRole("button", { name: "إنشاء حساب" }).click();
    await page.getByLabel("البريد الإلكتروني").fill("new@example.com");
    await page.getByLabel("كلمة المرور").fill("StrongPassword123!");
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
});
