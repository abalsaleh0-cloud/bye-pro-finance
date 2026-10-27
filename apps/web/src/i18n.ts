export type Locale = "ar" | "en";
export type Theme = "dark" | "light";

const LOCALE_KEY = "bye-pro-finance.locale";
const THEME_KEY = "bye-pro-finance.theme";

export const messages = {
  ar: {
    common: { save: "حفظ", cancel: "إلغاء", close: "إغلاق", delete: "حذف", edit: "تعديل", add: "إضافة", search: "بحث", filter: "تصفية", loading: "جارٍ التحميل…", retry: "إعادة المحاولة", confirm: "تأكيد", required: "مطلوب", back: "رجوع", next: "التالي", previous: "السابق", noResults: "لا توجد نتائج" },
    nav: { dashboard: "لوحة التحكم", accounts: "الحسابات", transactions: "المعاملات", transfers: "التحويلات", budgets: "الميزانيات", debts: "الديون", bills: "الفواتير", savings: "الادخار", assets: "الأصول", reports: "التقارير", household: "المنزل", documents: "المستندات", smartScan: "المسح الذكي", assistant: "المساعد المالي", notifications: "الإشعارات", importExport: "استيراد وتصدير", settings: "الإعدادات", administration: "الإدارة" },
    forms: { name: "الاسم", email: "البريد الإلكتروني", currency: "العملة", amount: "المبلغ", date: "التاريخ", description: "الوصف", status: "الحالة" },
    profile: { title: "الملف الشخصي", identity: "الهوية", avatar: "الصورة الشخصية", fullName: "الاسم الكامل", username: "اسم المستخدم", publicId: "المعرف العام", preferences: "التفضيلات", notifications: "الإشعارات", security: "الأمان" },
    settings: { title: "الإعدادات", appearance: "المظهر", languageRegion: "اللغة والمنطقة", currency: "العملة", privacy: "الخصوصية", data: "البيانات", ai: "الذكاء الاصطناعي", accessibility: "إمكانية الوصول", pwa: "تطبيق الويب التقدمي", about: "حول التطبيق" }
  },
  en: {
    common: { save: "Save", cancel: "Cancel", close: "Close", delete: "Delete", edit: "Edit", add: "Add", search: "Search", filter: "Filter", loading: "Loading…", retry: "Retry", confirm: "Confirm", required: "Required", back: "Back", next: "Next", previous: "Previous", noResults: "No results" },
    nav: { dashboard: "Dashboard", accounts: "Accounts", transactions: "Transactions", transfers: "Transfers", budgets: "Budgets", debts: "Debts", bills: "Bills", savings: "Savings", assets: "Assets", reports: "Reports", household: "Household", documents: "Documents", smartScan: "Smart Scan", assistant: "Financial Assistant", notifications: "Notifications", importExport: "Import / Export", settings: "Settings", administration: "Administration" },
    forms: { name: "Name", email: "Email", currency: "Currency", amount: "Amount", date: "Date", description: "Description", status: "Status" },
    profile: { title: "Profile", identity: "Identity", avatar: "Avatar", fullName: "Full name", username: "Username", publicId: "Public ID", preferences: "Preferences", notifications: "Notifications", security: "Security" },
    settings: { title: "Settings", appearance: "Appearance", languageRegion: "Language & Region", currency: "Currency", privacy: "Privacy", data: "Data", ai: "AI", accessibility: "Accessibility", pwa: "Progressive Web App", about: "About" }
  }
} as const;

export type MessageKey =
  | `common.${keyof typeof messages.ar.common}`
  | `nav.${keyof typeof messages.ar.nav}`
  | `forms.${keyof typeof messages.ar.forms}`
  | `profile.${keyof typeof messages.ar.profile}`
  | `settings.${keyof typeof messages.ar.settings}`;

export function t(key: MessageKey, locale: Locale = getStoredLocale()): string {
  const [group, leaf] = key.split(".") as [keyof typeof messages.ar, string];
  return (messages[locale][group] as Record<string, string>)[leaf] ?? (messages.ar[group] as Record<string, string>)[leaf] ?? key;
}

export const locales = { ar: "العربية", en: "English" } as const;
export function getStoredLocale(): Locale { try { return localStorage.getItem(LOCALE_KEY) === "en" ? "en" : "ar"; } catch { return "ar"; } }
export function getStoredTheme(): Theme { try { return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"; } catch { return "dark"; } }
export function setStoredLocale(locale: Locale): void { try { localStorage.setItem(LOCALE_KEY, locale); } catch { /* storage may be unavailable */ } }
export function setStoredTheme(theme: Theme): void { try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage may be unavailable */ } }
export function applyLocale(locale: Locale, theme: Theme = getStoredTheme()): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.lang = locale;
  root.dir = "rtl";
  root.dataset.locale = "ar";
  root.dataset.theme = theme;
  document.body.dataset.locale = "ar";
  document.body.dataset.theme = theme;
}

export function formatNumber(value: number, locale: Locale = getStoredLocale(), options?: Intl.NumberFormatOptions): string { return new Intl.NumberFormat(locale === "ar" ? "ar" : "en", options).format(value); }
export function formatCurrency(value: number, currency: string, locale: Locale = getStoredLocale()): string { return new Intl.NumberFormat(locale === "ar" ? "ar" : "en", { style: "currency", currency }).format(value); }
export function formatDate(value: string | number | Date, locale: Locale = getStoredLocale(), options?: Intl.DateTimeFormatOptions): string { return new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", options).format(new Date(value)); }
