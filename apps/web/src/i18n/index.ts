export const locales = { ar: "العربية", en: "English" } as const;
export type Locale = keyof typeof locales;

export const messages = {
  ar: { dashboard: "لوحة التحكم", accounts: "الحسابات", transactions: "المعاملات", settings: "الإعدادات" },
  en: { dashboard: "Dashboard", accounts: "Accounts", transactions: "Transactions", settings: "Settings" },
} as const;

export function applyLocale(locale: Locale): void {
  document.documentElement.lang = locale;
  // Keep the application's Arabic visual direction in every language.
  document.documentElement.dir = "rtl";
  localStorage.setItem("bye-pro-finance.locale", locale);
}

export function getStoredLocale(): Locale {
  return localStorage.getItem("bye-pro-finance.locale") === "en" ? "en" : "ar";
}
