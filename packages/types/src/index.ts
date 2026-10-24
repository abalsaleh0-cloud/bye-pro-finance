export type CurrencyCode = string;

export type FinanceModule =
  | "dashboard"
  | "accounts"
  | "transactions"
  | "transfers"
  | "budgets"
  | "debts"
  | "bills"
  | "savings"
  | "assets"
  | "reports"
  | "household"
  | "documents"
  | "smart-scan"
  | "assistant"
  | "notifications"
  | "import-export"
  | "settings"
  | "admin";

export interface UserPreferences {
  language: "ar" | "en";
  direction: "rtl" | "ltr";
  theme: "light" | "dark" | "system";
  defaultCurrency: CurrencyCode;
}
