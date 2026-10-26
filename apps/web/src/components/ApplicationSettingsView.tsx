import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { applyLocale, setStoredLocale, setStoredTheme, type Locale, type Theme } from "../i18n";
import "./ApplicationSettingsView.css";

type Settings = {
  theme: Theme;
  locale: Locale;
  timezone: string;
  currency_code: string;
  date_format: string;
  number_format: string;
  email_notifications: boolean;
  transaction_alerts: boolean;
  bill_reminders: boolean;
  budget_alerts: boolean;
};

const defaults: Settings = {
  theme: "dark",
  locale: "ar",
  timezone: "Africa/Tripoli",
  currency_code: "LYD",
  date_format: "YYYY-MM-DD",
  number_format: "1,234.56",
  email_notifications: true,
  transaction_alerts: true,
  bill_reminders: true,
  budget_alerts: true,
};

const currencies = ["LYD", "USD", "EUR", "GBP", "SAR", "AED", "EGP"];
const timezones = ["Africa/Tripoli", "Asia/Damascus", "Asia/Amman", "Europe/Istanbul", "Europe/London", "UTC"];

export default function ApplicationSettingsView() {
  const en = typeof document !== "undefined" && document.documentElement.lang === "en";
  const tr = (ar: string, english: string) => en ? english : ar;
  const [settings, setSettings] = useState<Settings>(defaults);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (!supabase) { if (mounted) { setError(tr("الاتصال بقاعدة البيانات غير مُعد.", "Database connection is not configured.")); setBusy(false); } return; }
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { if (mounted) { setError(tr("يرجى تسجيل الدخول مجددًا.", "Please sign in again.")); setBusy(false); } return; }
      const { data, error: loadError } = await supabase.from("user_settings").select("theme,locale,timezone,currency_code,date_format,number_format,email_notifications,transaction_alerts,bill_reminders,budget_alerts").eq("user_id", auth.user.id).maybeSingle();
      if (!mounted) return;
      if (loadError) setError(loadError.message);
      else setSettings({ ...defaults, ...(data ?? {}) } as Settings);
      setBusy(false);
    })();
    return () => { mounted = false; };
  }, []);

  const patch = (value: Partial<Settings>) => setSettings(current => ({ ...current, ...value }));

  async function save() {
    if (!supabase) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError(tr("انتهت جلسة الدخول.", "Your session has expired.")); return; }
    setSaving(true); setError(""); setMessage("");
    const { error: saveError } = await supabase.from("user_settings").upsert({ user_id: auth.user.id, ...settings, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (saveError) setError(saveError.message);
    else {
      setStoredTheme(settings.theme);
      setStoredLocale(settings.locale);
      applyLocale(settings.locale, settings.theme);
      setMessage(tr("تم حفظ إعدادات التطبيق.", "Application settings saved."));
    }
    setSaving(false);
  }

  if (busy) return <section className="panel application-settings-page"><p>{tr("جارٍ تحميل إعدادات التطبيق…", "Loading application settings…")}</p></section>;

  return <section className="panel application-settings-page">
    <div className="section-heading"><div><p className="eyebrow">BYE PRO FINANCE · SETTINGS</p><h2>{tr("إعدادات التطبيق", "Application settings")}</h2><p>{tr("مكان مستقل لتفضيلات التطبيق وخصائص مساحة العمل. لا تُخلط هذه الصفحة مع بيانات ملفك الشخصي.", "A dedicated place for application preferences and workspace properties. This page is separate from your profile identity.")}</p></div></div>
    {error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice success" role="status">{message}</p>}
    <div className="settings-card">
      <div className="settings-card-head"><div><span className="eyebrow">01 · PREFERENCES</span><h3>{tr("التفضيلات العامة", "General preferences")}</h3><p>{tr("تتحكم هذه الخيارات بطريقة عرض التطبيق ومعالجة بياناتك داخل حسابك.", "These options control how the application displays and handles data in your account.")}</p></div></div>
      <div className="settings-grid">
        <label><span>{tr("المظهر", "Theme")}</span><select value={settings.theme} onChange={e => patch({ theme: e.target.value as Theme })}><option value="dark">{tr("داكن", "Dark")}</option><option value="light">{tr("فاتح", "Light")}</option></select></label>
        <label><span>{tr("لغة الواجهة", "Interface language")}</span><select value={settings.locale} onChange={e => patch({ locale: e.target.value as Locale })}><option value="ar">العربية</option><option value="en">English</option></select></label>
        <label><span>{tr("المنطقة الزمنية", "Timezone")}</span><select value={settings.timezone} onChange={e => patch({ timezone: e.target.value })}>{timezones.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><span>{tr("العملة الأساسية", "Base currency")}</span><select value={settings.currency_code} onChange={e => patch({ currency_code: e.target.value })}>{currencies.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><span>{tr("تنسيق التاريخ", "Date format")}</span><select value={settings.date_format} onChange={e => patch({ date_format: e.target.value })}><option>YYYY-MM-DD</option><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option></select></label>
        <label><span>{tr("تنسيق الأرقام", "Number format")}</span><select value={settings.number_format} onChange={e => patch({ number_format: e.target.value })}><option>1,234.56</option><option>1.234,56</option><option>1 234,56</option></select></label>
      </div>
      <div className="settings-toggles">
        {([["email_notifications","إشعارات البريد الإلكتروني","Email notifications"],["transaction_alerts","تنبيهات المعاملات","Transaction alerts"],["bill_reminders","تذكير الفواتير","Bill reminders"],["budget_alerts","تنبيهات الميزانية","Budget alerts"]] as const).map(([key, ar, english]) => <label key={key}><input type="checkbox" checked={settings[key]} onChange={e => patch({ [key]: e.target.checked } as Partial<Settings>)} /><span>{tr(ar, english)}</span></label>)}
      </div>
      <div className="settings-actions"><button className="primary-button" type="button" disabled={saving} onClick={() => void save()}>{saving ? tr("جارٍ الحفظ…", "Saving…") : tr("حفظ إعدادات التطبيق", "Save application settings")}</button></div>
    </div>

    <div className="settings-card application-properties-card">
      <div className="settings-card-head"><div><span className="eyebrow">02 · PROJECT</span><h3>{tr("خصائص المشروع", "Project properties")}</h3><p>{tr("معلومات تقنية ثابتة للقراءة فقط، وليست جزءًا من الملف الشخصي.", "Read-only technical information; this is not part of your profile.")}</p></div></div>
      <div className="application-grid"><div><span>{tr("اسم التطبيق","Application")}</span><strong>BYE PRO FINANCE</strong></div><div><span>{tr("الواجهة","Frontend")}</span><strong>React + Vite + TypeScript</strong></div><div><span>{tr("قاعدة البيانات","Database")}</span><strong>Supabase PostgreSQL</strong></div><div><span>{tr("المصادقة","Authentication")}</span><strong>Supabase Auth</strong></div><div><span>{tr("عزل البيانات","Data isolation")}</span><strong>RLS · per user</strong></div><div><span>{tr("النشر","Deployment")}</span><strong>Vercel</strong></div></div>
    </div>
  </section>;
}
