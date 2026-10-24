import { afterEach, describe, expect, it } from "vitest";
import { applyLocale, getStoredLocale, getStoredTheme, setStoredLocale, setStoredTheme } from "./i18n";

afterEach(() => {
  document.documentElement.removeAttribute("lang");
  document.documentElement.removeAttribute("dir");
  delete document.documentElement.dataset.locale;
  delete document.documentElement.dataset.theme;
  delete document.body.dataset.locale;
  delete document.body.dataset.theme;
  localStorage.clear();
});

describe("locale and theme preferences", () => {
  it("defaults to Arabic and dark mode", () => {
    localStorage.clear();
    expect(getStoredLocale()).toBe("ar");
    expect(getStoredTheme()).toBe("dark");
  });

  it("persists the selected language and theme", () => {
    setStoredLocale("en");
    setStoredTheme("light");
    expect(getStoredLocale()).toBe("en");
    expect(getStoredTheme()).toBe("light");
  });

  it("applies correct language, direction, and theme to the document", () => {
    applyLocale("en", "light");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.body.dataset.locale).toBe("en");
    expect(document.body.dataset.theme).toBe("light");
  });

  it("restores RTL for Arabic", () => {
    applyLocale("ar", "dark");
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.body.dataset.theme).toBe("dark");
  });
});
