import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyLocale, getStoredLocale, getStoredTheme, setStoredLocale, setStoredTheme } from "./i18n";

const source = readFileSync("apps/web/src/i18n.ts", "utf8");
const styles = readFileSync("apps/web/src/styles.css", "utf8");
const app = readFileSync("apps/web/src/App.tsx", "utf8");
const screens = [
  "apps/web/src/components/AccountsView.tsx",
  "apps/web/src/components/TransactionsView.tsx",
  "apps/web/src/components/DashboardView.tsx",
  "apps/web/src/components/ReportsView.tsx",
  "apps/web/src/components/FinanceViews.tsx",
  "apps/web/src/components/PlatformViews.tsx",
  "apps/web/src/components/AdvancedFinanceViews.tsx",
].map((path) => readFileSync(path, "utf8"));

describe("locale and theme preference contract", () => {
  it("defaults safely to Arabic and dark mode", () => {
    expect(getStoredLocale()).toBe("ar");
    expect(getStoredTheme()).toBe("dark");
  });
  it("persists locale and theme preferences", () => {
    expect(source).toContain("bye-pro-finance.locale");
    expect(source).toContain("bye-pro-finance.theme");
    expect(source).toContain("localStorage.setItem(LOCALE_KEY, locale)");
    expect(source).toContain("localStorage.setItem(THEME_KEY, theme)");
    expect(() => { setStoredLocale("en"); setStoredTheme("light"); }).not.toThrow();
  });
  it("applies RTL/LTR direction and theme safely", () => {
    expect(source).toContain('root.dir = locale === "ar" ? "rtl" : "ltr"');
    expect(source).toContain("root.dataset.theme = theme");
    expect(() => { applyLocale("ar", "dark"); applyLocale("en", "light"); }).not.toThrow();
  });
  it("provides language and theme controls", () => {
    expect(app.match(/className="appearance-button"/g)?.length).toBeGreaterThanOrEqual(4);
    expect(app).toContain("const changeLocale = () =>");
    expect(app).toContain("const changeTheme = () =>");
    expect(app).toContain("moduleTitles[locale][item.title]");
    expect(app).toContain("A personal finance workspace to organize accounts");
    expect(app).toContain("Forgot password?");
  });
  it("contains English localization contracts across the finance screens", () => {
    const englishMarkers = ["Your accounts", "Transactions", "Financial overview", "Financial analysis", "Financial planning", "Transfers", "Financial archive"];
    for (const marker of englishMarkers) expect(screens.some((screen) => screen.includes(marker))).toBe(true);
  });
  it("defines light theme and English direction styles", () => {
    expect(styles).toContain(':root[data-theme="light"],body[data-theme="light"]');
    expect(styles).toContain('html[data-locale="en"] .sidebar');
    expect(styles).toContain('html[data-locale="en"] .nav-item');
  });
});
