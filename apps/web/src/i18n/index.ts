export const locales = { ar: "العربية", en: "English" } as const;
export type Locale = keyof typeof locales;
export type Theme = "dark" | "light";

export const messages = {
  ar: { direction: "rtl", dashboard: "لوحة التحكم", accounts: "الحسابات", transactions: "المعاملات", transfers: "التحويلات", budgets: "الميزانيات", debts: "الديون", bills: "الفواتير", savings: "الادخار", assets: "الأصول", reports: "التقارير", household: "المنزل", documents: "المستندات", smartScan: "المسح الذكي", assistant: "المساعد المالي", notifications: "الإشعارات", importExport: "استيراد وتصدير", settings: "الإعدادات", admin: "الإدارة", workspace: "مساحة العمل", signIn: "تسجيل الدخول", signUp: "إنشاء حساب", resetPassword: "استعادة كلمة المرور", language: "اللغة", theme: "المظهر", dark: "ليلي", light: "نهاري", logout: "تسجيل الخروج" },
  en: { direction: "ltr", dashboard: "Dashboard", accounts: "Accounts", transactions: "Transactions", transfers: "Transfers", budgets: "Budgets", debts: "Debts", bills: "Bills", savings: "Savings", assets: "Assets", reports: "Reports", household: "Household", documents: "Documents", smartScan: "Smart Scan", assistant: "Financial Assistant", notifications: "Notifications", importExport: "Import & Export", settings: "Settings", admin: "Administration", workspace: "Workspace", signIn: "Sign in", signUp: "Create account", resetPassword: "Reset password", language: "Language", theme: "Theme", dark: "Dark", light: "Light", logout: "Sign out" },
} as const;

export function applyLocale(locale: Locale): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = messages[locale].direction;
  localStorage.setItem("bye-pro-finance.locale", locale);
}

export function getStoredLocale(): Locale {
  return localStorage.getItem("bye-pro-finance.locale") === "en" ? "en" : "ar";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("bye-pro-finance.theme", theme);
}

export function getStoredTheme(): Theme {
  return localStorage.getItem("bye-pro-finance.theme") === "light" ? "light" : "dark";
}
