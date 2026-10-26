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

async function assertControlGeometry(page: Page, screenLabel: string) {
  const mismatches = await page.locator(
    'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]), select'
  ).evaluateAll(elements => elements
    .filter(element => {
      const el = element as HTMLElement;
      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && el.getClientRects().length > 0;
    })
    .map(element => {
      const el = element as HTMLElement;
      const height = el.getBoundingClientRect().height;
      return { tag: el.tagName.toLowerCase(), type: (el as HTMLInputElement).type || "", height: Math.round(height * 10) / 10 };
    })
    .filter(item => Math.abs(item.height - 44) > 1)
  );
  expect(mismatches, `${screenLabel}: fields should share the 44px control height`).toEqual([]);

  const shortButtons = await page.locator('button:visible, [role="button"]:visible, label.file-picker:visible, input[type="button"]:visible, input[type="submit"]:visible, input[type="reset"]:visible').evaluateAll(elements => elements
    .map(element => {
      const el = element as HTMLElement;
      const style = getComputedStyle(el);
      return { tag: el.tagName, className: el.className.toString(), text: (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 60), height: Math.round(el.getBoundingClientRect().height), minHeight: style.minHeight, transform: style.transform };
    })
    .filter(item => item.height < 43)
  );
  expect(shortButtons, `${screenLabel}: visible action buttons should have at least a 44px touch target`).toEqual([]);

  const shortTextareas = await page.locator("textarea").evaluateAll(elements => elements
    .filter(element => {
      const el = element as HTMLElement;
      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && el.getClientRects().length > 0;
    })
    .map(element => Math.round((element as HTMLElement).getBoundingClientRect().height))
    .filter(height => height < 119)
  );
  expect(shortTextareas, `${screenLabel}: visible textareas should remain multiline-sized`).toEqual([]);

  const brokenCompoundFields = await page.locator(".username-field:visible").evaluateAll(elements => elements
    .map(element => {
      const container = element as HTMLElement;
      const icon = container.querySelector("span");
      const input = container.querySelector("input");
      if (!icon || !input) return { reason: "missing icon/input" };
      const iconRect = icon.getBoundingClientRect();
      const inputRect = input.getBoundingClientRect();
      const style = getComputedStyle(input);
      const containerStyle = getComputedStyle(container);
      const overlaps = iconRect.left < inputRect.right && iconRect.right > inputRect.left;
      return {
        overlaps,
        borderWidth: Number.parseFloat(style.borderTopWidth),
        radius: Number.parseFloat(style.borderTopLeftRadius),
        paddingLeft: Number.parseFloat(style.paddingLeft),
        paddingRight: Number.parseFloat(style.paddingRight),
        background: style.backgroundColor,
        parentBackground: containerStyle.backgroundColor,
      };
    })
    .filter(item => "reason" in item || item.overlaps || item.borderWidth > 0 || item.radius > 0 || item.paddingLeft > 1 || item.paddingRight > 1 || (item.background !== "rgba(0, 0, 0, 0)" && item.background !== item.parentBackground)));
  expect(brokenCompoundFields, `${screenLabel}: username compound field must keep its internal icon and text separated`).toEqual([]);

  const overflowing = await page.locator("body").evaluate(el => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(overflowing.scrollWidth, `${screenLabel}: page must not overflow horizontally`).toBeLessThanOrEqual(overflowing.clientWidth + 1);
}

async function assertLongTextWrapping(page: Page, locale: "ar" | "en") {
  const result = await page.evaluate((language) => {
    const fixture = document.createElement("div");
    fixture.style.cssText = "position:fixed;left:8px;bottom:8px;width:min(220px,calc(100vw - 16px));z-index:99999;display:grid;gap:8px;pointer-events:none;";
    const button = document.createElement("button");
    button.className = "text-button";
    button.style.width = "100%";
    button.textContent = language === "ar"
      ? "حفظ التغييرات المالية المهمة دون قص النص أو إخفاء أي كلمة طويلة في الواجهة"
      : "Save important financial changes without clipping or hiding any long action label";
    const notice = document.createElement("p");
    notice.className = "notice error";
    notice.style.margin = "0";
    notice.textContent = language === "ar"
      ? "تعذر حفظ التغييرات بسبب رسالة خطأ طويلة يجب أن تلتف داخل مساحة التنبيه دون تجاوز حدود الشاشة."
      : "The changes could not be saved because of a long error message that must wrap inside the notice without overflowing the screen.";
    fixture.append(button, notice);
    document.body.append(fixture);
    const buttonStyle = getComputedStyle(button);
    const measured = {
      buttonHeight: button.getBoundingClientRect().height,
      buttonClips: button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1,
      noticeClips: notice.scrollWidth > notice.clientWidth + 1 || notice.scrollHeight > notice.clientHeight + 1,
      buttonWhiteSpace: buttonStyle.whiteSpace,
      buttonOverflowWrap: buttonStyle.overflowWrap,
    };
    fixture.remove();
    return measured;
  }, locale);
  expect(result.buttonHeight, `${locale}: long action label should grow naturally`).toBeGreaterThanOrEqual(44);
  expect(result.buttonClips, `${locale}: long action label must not be clipped`).toBe(false);
  expect(result.noticeClips, `${locale}: long error message must not be clipped`).toBe(false);
  expect(result.buttonWhiteSpace).toBe("normal");
  expect(result.buttonOverflowWrap).toBe("anywhere");
}

for (const locale of ["ar", "en"] as const) {
  test(`${locale}: 18 screens on mobile tablet desktop, states and accessibility`, async ({ page }) => {
    test.setTimeout(300_000);
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
    await assertLongTextWrapping(page, locale);

    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    expect(await page.locator("html").getAttribute("lang")).toBe(locale);

    for (const [ar, en] of screens) {
      const label = locale === "ar" ? ar : en;
      await clickScreen(page, label);
      await expect(page.locator("body")).toContainText(label);
      await expect(page.locator("body")).not.toContainText("Cannot read properties");
      await expect(page.locator("body")).not.toContainText("NaN");
      await assertControlGeometry(page, label);

      // Verify the same field/button geometry in both themes without changing layout direction.
      for (const theme of ["light", "dark"] as const) {
        await page.evaluate((value) => {
          document.documentElement.dataset.theme = value;
          document.body.dataset.theme = value;
        }, theme);
        await assertControlGeometry(page, `${label} (${theme})`);
      }

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
