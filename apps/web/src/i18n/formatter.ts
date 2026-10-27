import type { Locale } from "./keys";

const intlLocale = (locale: Locale) => (locale === "ar" ? "ar" : "en");

export function formatNumber(value: number, locale: Locale = "ar", options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

export function formatCurrency(value: number, currency: string, locale: Locale = "ar"): string {
  return new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency }).format(value);
}

export function formatDate(value: string | number | Date, locale: Locale = "ar", options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(new Date(value));
}
