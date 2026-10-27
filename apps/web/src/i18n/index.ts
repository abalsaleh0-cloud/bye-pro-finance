import { ar } from "./ar";
import { en } from "./en";
import { formatCurrency, formatDate, formatNumber } from "./formatter";
import type { Locale, MessageKey, Theme } from "./keys";

export { ar, en, formatCurrency, formatDate, formatNumber };
export type { Locale, MessageKey, Theme };
export { locales } from "./keys";

export const messages = { ar, en } as const;

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

export function t(key: MessageKey, locale: Locale = getStoredLocale()): string {
  const [group, leaf] = key.split(".") as [keyof typeof ar, string];
  return (messages[locale][group] as Record<string, string>)[leaf]
    ?? (ar[group] as Record<string, string>)[leaf]
    ?? key;
}

export function applyLocale(locale: Locale, theme: Theme = getStoredTheme()): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const direction = locale === "ar" ? "rtl" : "ltr";
  root.lang = locale;
  root.dir = direction;
  root.dataset.locale = locale;
  root.dataset.theme = theme;
  document.body.dataset.locale = locale;
  document.body.dataset.theme = theme;
}
