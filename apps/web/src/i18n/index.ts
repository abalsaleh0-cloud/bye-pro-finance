export const locales = { ar: "العربية", en: "English" } as const;
export type Locale = keyof typeof locales;

export const messages = {
  ar: { direction: "rtl", dashboard: "لوحة التحكم", accounts: "الحسابات", transactions: "المعاملات", settings: "الإعدادات" },
  en: { direction: "ltr", dashboard: "Dashboard", accounts: "Accounts", transactions: "Transactions", settings: "Settings" },
} as const;

export function applyLocale(locale: Locale): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = messages[locale].direction;
  localStorage.setItem("bye-pro-finance.locale", locale);
}

export function getStoredLocale(): Locale {
  return localStorage.getItem("bye-pro-finance.locale") === "en" ? "en" : "ar";
}
