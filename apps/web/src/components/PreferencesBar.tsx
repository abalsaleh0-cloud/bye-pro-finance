import { useState } from "react";
import { applyLocale, applyTheme, getStoredLocale, getStoredTheme, messages, type Locale, type Theme } from "../i18n";

export default function PreferencesBar() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale());
  const [theme, setTheme] = useState<Theme>(getStoredTheme());

  const changeLocale = (next: Locale) => {
    setLocale(next);
    applyLocale(next);
    window.dispatchEvent(new CustomEvent("bye-pro-finance:locale", { detail: next }));
  };

  const changeTheme = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  const t = messages[locale];

  return (
    <div className="preferences-bar" aria-label={`${t.language} / ${t.theme}`}>
      <div className="preference-group" role="group" aria-label={t.language}>
        <button type="button" className={locale === "ar" ? "preference-button active" : "preference-button"} onClick={() => changeLocale("ar")} aria-pressed={locale === "ar"}>العربية</button>
        <button type="button" className={locale === "en" ? "preference-button active" : "preference-button"} onClick={() => changeLocale("en")} aria-pressed={locale === "en"}>English</button>
      </div>
      <div className="preference-group" role="group" aria-label={t.theme}>
        <button type="button" className={theme === "dark" ? "preference-button active" : "preference-button"} onClick={() => changeTheme("dark")} aria-pressed={theme === "dark"}>☾ {t.dark}</button>
        <button type="button" className={theme === "light" ? "preference-button active" : "preference-button"} onClick={() => changeTheme("light")} aria-pressed={theme === "light"}>☀ {t.light}</button>
      </div>
    </div>
  );
}
