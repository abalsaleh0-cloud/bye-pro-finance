export type Locale = "ar" | "en";
export type Theme = "dark" | "light";

const LOCALE_KEY = "bye-pro-finance.locale";
const THEME_KEY = "bye-pro-finance.theme";

export function getStoredLocale(): Locale {
  try { return localStorage.getItem(LOCALE_KEY) === "en" ? "en" : "ar"; }
  catch { return "ar"; }
}

export function getStoredTheme(): Theme {
  try { return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"; }
  catch { return "dark"; }
}

export function setStoredLocale(locale: Locale): void {
  try { localStorage.setItem(LOCALE_KEY, locale); } catch { /* storage may be unavailable */ }
}

export function setStoredTheme(theme: Theme): void {
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage may be unavailable */ }
}

export function applyLocale(locale: Locale, theme: Theme = getStoredTheme()): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.lang = locale;
  // Arabic is the application's fixed visual/layout direction. Language switching
  // changes translated strings only; it must never mirror or reorder the UI.
  root.dir = "rtl";
  root.dataset.locale = locale;
  root.dataset.theme = theme;
  document.body.dataset.locale = locale;
  document.body.dataset.theme = theme;
}
