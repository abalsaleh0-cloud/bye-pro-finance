import type { ar } from "./ar";

export type Locale = "ar" | "en";
export type Theme = "dark" | "light";
export type Messages = typeof ar;
export type MessageKey =
  | `common.${keyof Messages["common"]}`
  | `nav.${keyof Messages["nav"]}`
  | `forms.${keyof Messages["forms"]}`
  | `profile.${keyof Messages["profile"]}`
  | `settings.${keyof Messages["settings"]}`;

export const locales = { ar: "العربية", en: "English" } as const;
