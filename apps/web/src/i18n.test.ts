import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyLocale, getStoredLocale, getStoredTheme, setStoredLocale, setStoredTheme } from "./i18n";

const source = readFileSync("apps/web/src/i18n.ts", "utf8");
const styles = readFileSync("apps/web/src/styles.css", "utf8");
const app = readFileSync("apps/web/src/App.tsx", "utf8");
const accounts = readFileSync("apps/web/src/components/AccountsView.tsx", "utf8");
const transactions = readFileSync("apps/web/src/components/TransactionsView.tsx", "utf8");
const dashboard = readFileSync("apps/web/src/components/DashboardView.tsx", "utf8");
const reports = readFileSync("apps/web/src/components/ReportsView.tsx", "utf8");
const collections = readFileSync("apps/web/src/components/FinanceViews.tsx", "utf8");
const platform = readFileSync("apps/web/src/components/PlatformViews.tsx", "utf8");
const advanced = readFileSync("apps/web/src/components/AdvancedFinanceViews.tsx", "utf8");

describe("locale and theme preference contract", () => {
  it("defaults safely to Arabic and dark mode", () => {
    expect(getStoredLocale()).toBe("ar");
    expect(getStoredTheme()).toBe("dark");
  });
  it("includes persistent locale and theme storage", () => {
    expect(source).toContain("bye-pro-finance.locale");
    expect(source).toContain("bye-pro-finance.theme");
    expect(source).toContain("localStorage.setItem(LOCALE_KEY, locale)");
    expect(source).toContain("localStorage.setItem(THEME_KEY, theme)");
    expect(() => { setStoredLocale("en"); setStoredTheme("light"); }).not.toThrow();
  });
  it("applies locale direction and theme safely in non-browser test environments", () => {
    expect(source).toContain('root.dir = locale === "ar" ? "rtl" : "ltr"');
    expect(source).toContain("root.dataset.theme = theme");
    expect(() => { applyLocale("ar", "dark"); applyLocale("en", "light"); }).not.toThrow();
  });
  it("shows locale and theme controls in both app shells", () => {
    expect(app.match(/className="appearance-button"/g)?.length).toBeGreaterThanOrEqual(4);
    expect(app).toContain("const changeLocale = () =>");
    expect(app).toContain("const changeTheme = () =>");
    expect(app).toContain("moduleTitles[locale][item.title]");
    expect(app).toContain("A personal finance workspace to organize accounts");
    expect(app).toContain("Forgot password?");
  });
  it("localizes the main finance screens when English is selected", () => {
    for (const component of [accounts, transactions, dashboard, reports, collections, platform, advanced]) {
      expect(component).toMatch(/document\.documentElement\.lang\s*===\s*"en"/);
    }
    expect(accounts).toContain('"Your accounts"');
    expect(transactions).toContain('"Transactions"');
    expect(dashboard).toContain('"Financial overview"');
    expect(reports).toContain('"Financial analysis"');
    expect(collections).toContain('"Financial planning"');
    expect(platform).toContain('"Transfers"');
    expect(advanced).toContain('"Financial archive"');
  });
  it("defines light theme and English direction styles", () => {
    expect(styles).toContain(':root[data-theme="light"],body[data-theme="light"]');
    expect(styles).toContain('html[data-locale="en"] .sidebar');
    expect(styles).toContain('html[data-locale="en"] .nav-item');
  });
});
