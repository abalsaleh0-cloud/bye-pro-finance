import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getStoredTheme, setStoredLocale, setStoredTheme, applyLocale, type Locale, type Theme } from "../i18n";
import "./ProfileSettingsView.css";

type Profile = { id: string; full_name: string; username: string | null; avatar_url: string | null };
type UserSettings = { theme: Theme; locale: Locale; timezone: string; currency_code: string; date_format: string; number_format: string; email_notifications: boolean; transaction_alerts: boolean; bill_reminders: boolean; budget_alerts: boolean };
const defaults: UserSettings = { theme: "dark", locale: "ar", timezone: "Africa/Tripoli", currency_code: "LYD", date_format: "YYYY-MM-DD", number_format: "1,234.56", email_notifications: true, transaction_alerts: true, bill_reminders: true, budget_alerts: true };
const currencies = ["LYD", "USD", "EUR", "GBP", "SAR", "AED", "EGP"];
const timezones = ["Africa/Tripoli", "Asia/Damascus", "Asia/Amman", "Europe/Istanbul", "Europe/London", "UTC"];

export default function ProfileSettingsView() {
  const en = typeof document !== "undefined" && document.documentElement.lang === "en";
  const tr = (ar: string, english: string) => en ? english : ar;
  const [profile, setProfile] = useState<Profile | null>(null), [email, setEmail] = useState(""), [settings, setSettings] = useState<UserSettings>(defaults), [busy, setBusy] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState(""), [avatarFile, setAvatarFile] = useState<File | null>(null), [avatarPreview, setAvatarPreview] = useState("");

  const load = async () => {
    if (!supabase) { setError(tr("الاتصال بقاعدة البيانات غير مُعد.", "Database connection is not configured.")); setBusy(false); return; }
    setBusy(true); setError("");
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) { setError(tr("يرجى تسجيل الدخول مجددًا.", "Please sign in again.")); setBusy(false); return; }
    setEmail(auth.user.email ?? "");
    const [{ data: p, error: pe }, { data: s, error: se }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,username,avatar_url").eq("id", auth.user.id).maybeSingle(),
      supabase.from("user_settings").select("theme,locale,timezone,currency_code,date_format,number_format,email_notifications,transaction_alerts,bill_reminders,budget_alerts").eq("user_id", auth.user.id).maybeSingle()
    ]);
    if (pe) { setError(pe.message); setBusy(false); return; }
    if (se) { setError(se.message); setBusy(false); return; }
    setProfile(p ?? { id: auth.user.id, full_name: String(auth.user.user_metadata?.full_name ?? ""), username: String(auth.user.user_metadata?.username ?? "") || null, avatar_url: null });
    const next = { ...defaults, ...(s ?? {}) } as UserSettings;
    setSettings(next); setStoredTheme(next.theme); setStoredLocale(next.locale); applyLocale(next.locale, next.theme); setBusy(false);
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!avatarFile) { setAvatarPreview(""); return; } const u = URL.createObjectURL(avatarFile); setAvatarPreview(u); return () => URL.revokeObjectURL(u); }, [avatarFile]);
  const patch = (value: Partial<UserSettings>) => setSettings(current => ({ ...current, ...value }));

  async function saveSettings() {
    if (!supabase || !profile) return; setSaving(true); setError(""); setMessage("");
    const { error: saveError } = await supabase.from("user_settings").upsert({ user_id: profile.id, ...settings, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (saveError) { setError(saveError.message); setSaving(false); return; }
    setStoredTheme(settings.theme); setStoredLocale(settings.locale); applyLocale(settings.locale, settings.theme); setMessage(tr("تم حفظ إعداداتك الشخصية. سيتم تطبيقها الآن.", "Your personal settings were saved and will be applied now."));
    window.setTimeout(() => window.location.reload(), 350);
  }
  async function saveProfile() {
    if (!supabase || !profile) return; const name = profile.full_name.trim(); if (name.length < 2 || name.length > 100) { setError(tr("الاسم الكامل يجب أن يكون بين حرفين و100 حرف.", "Full name must be 2–100 characters.")); return; }
    setSaving(true); setError(""); setMessage(""); const { error: e } = await supabase.from("profiles").update({ full_name: name, updated_at: new Date().toISOString() }).eq("id", profile.id);
    if (e) setError(e.message); else { setMessage(tr("تم حفظ الملف الشخصي.", "Profile saved.")); window.dispatchEvent(new CustomEvent("bye-profile-updated")); } setSaving(false);
  }
  async function requestPasswordReset() {
    if (!supabase || !email) return; setSaving(true); setError(""); setMessage(""); const { error: e } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (e) setError(e.message); else setMessage(tr("تم إرسال رابط تغيير كلمة المرور إلى بريدك الإلكتروني.", "A password reset link was sent to your email.")); setSaving(false);
  }
  if (busy) return <section className="panel"><p>{tr("جارٍ تحميل ملفك الشخصي…", "Loading your profile…")}</p></section>;

  return <section className="panel profile-settings-page">
    <div className="section-heading"><div><p className="eyebrow">BYE PRO FINANCE · ACCOUNT</p><h2>{tr("الملف الشخصي والإعدادات", "Profile & settings")}</h2><p>{tr("ملفك الشخصي وإعداداتك الشخصية منفصلة تمامًا عن خصائص التطبيق.", "Your profile and personal settings are fully separated from application properties.")}</p></div></div>
    {error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice success" role="status">{message}</p>}

    <div className="settings-card profile-card">
      <div className="settings-card-head"><div><span className="eyebrow">01 · PROFILE</span><h3>{tr("الملف الشخصي", "Profile")}</h3><p>{tr("المعلومات التي تعرّف حسابك أنت فقط.", "Information that identifies your account only.")}</p></div></div>
      <div className="profile-identity-row"><div className="profile-avatar-large">{avatarPreview || profile?.avatar_url ? <img src={avatarPreview || profile?.avatar_url || ""} alt={tr("الصورة الشخصية", "Profile photo")} /> : <span>{(profile?.full_name || email || "U").slice(0,1).toUpperCase()}</span>}</div><label className="secondary-button file-picker">{tr("اختيار صورة", "Choose photo")}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setAvatarFile(e.target.files?.[0] ?? null)} /></label></div>
      {avatarFile && <div className="profile-photo-preview"><img src={avatarPreview} alt={tr("معاينة الصورة", "Photo preview")} /><span>{tr("هذه هي الصورة التي ستظهر في الحساب. يمكنك استبدالها قبل اعتمادها.", "This is the photo that will appear on the account. You can replace it before applying it.")}</span><button type="button" className="secondary-button" onClick={() => setAvatarFile(null)}>{tr("إلغاء الاختيار", "Cancel selection")}</button></div>}
      <div className="profile-grid"><label className="profile-field"><span>{tr("الاسم الكامل", "Full name")}</span><input value={profile?.full_name ?? ""} maxLength={100} onChange={e => setProfile(p => p ? { ...p, full_name: e.target.value } : p)} autoComplete="name" /></label><label className="profile-field"><span>{tr("البريد الإلكتروني", "Email address")}</span><input value={email} readOnly dir="ltr" /><small>{tr("مرتبط بحساب الدخول.", "Linked to your sign-in account.")}</small></label><label className="profile-field"><span>{tr("معرّف المستخدم", "User ID")}</span><input value={profile?.id ?? ""} readOnly dir="ltr" className="readonly-id" /><small>{tr("معرّف UUID فريد وثابت لهذا الحساب فقط.", "A stable unique UUID belonging only to this account.")}</small></label></div>
      <div className="settings-actions"><button type="button" className="primary-button" disabled={saving} onClick={() => void saveProfile()}>{tr("حفظ الملف الشخصي", "Save profile")}</button></div>
    </div>

    <div className="settings-card">
      <div className="settings-card-head"><div><span className="eyebrow">02 · PERSONAL SETTINGS</span><h3>{tr("إعدادات المستخدم", "User settings")}</h3><p>{tr("إعدادات شخصية تُحفظ باسم معرّف المستخدم ولا تؤثر على أي مستخدم آخر.", "Personal settings stored against your user ID and never applied to another user.")}</p></div></div>
      <div className="settings-grid"><label><span>{tr("المظهر", "Appearance")}</span><select value={settings.theme} onChange={e => patch({ theme: e.target.value as Theme })}><option value="dark">{tr("داكن", "Dark")}</option><option value="light">{tr("فاتح", "Light")}</option></select></label><label><span>{tr("لغة الحساب", "Account language")}</span><select value={settings.locale} onChange={e => patch({ locale: e.target.value as Locale })}><option value="ar">{tr("العربية", "Arabic")}</option><option value="en">English</option></select></label><label><span>{tr("العملة الافتراضية", "Default currency")}</span><select value={settings.currency_code} onChange={e => patch({ currency_code: e.target.value })}>{currencies.map(c => <option key={c}>{c}</option>)}</select></label><label><span>{tr("المنطقة الزمنية", "Time zone")}</span><select value={settings.timezone} onChange={e => patch({ timezone: e.target.value })}>{timezones.map(t => <option key={t}>{t}</option>)}</select></label><label><span>{tr("تنسيق التاريخ", "Date format")}</span><select value={settings.date_format} onChange={e => patch({ date_format: e.target.value })}><option>YYYY-MM-DD</option><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option></select></label><label><span>{tr("تنسيق الأرقام", "Number format")}</span><select value={settings.number_format} onChange={e => patch({ number_format: e.target.value })}><option>1,234.56</option><option>1.234,56</option><option>1 234,56</option></select></label></div>
      <div className="settings-toggles"><label><input type="checkbox" checked={settings.email_notifications} onChange={e => patch({ email_notifications: e.target.checked })} /><span>{tr("إشعارات البريد", "Email notifications")}</span></label><label><input type="checkbox" checked={settings.transaction_alerts} onChange={e => patch({ transaction_alerts: e.target.checked })} /><span>{tr("تنبيهات المعاملات", "Transaction alerts")}</span></label><label><input type="checkbox" checked={settings.bill_reminders} onChange={e => patch({ bill_reminders: e.target.checked })} /><span>{tr("تذكيرات الفواتير", "Bill reminders")}</span></label><label><input type="checkbox" checked={settings.budget_alerts} onChange={e => patch({ budget_alerts: e.target.checked })} /><span>{tr("تنبيهات الميزانيات", "Budget alerts")}</span></label></div>
      <div className="settings-actions"><button type="button" className="primary-button" disabled={saving} onClick={() => void saveSettings()}>{saving ? tr("جارٍ الحفظ…", "Saving…") : tr("حفظ إعداداتي", "Save my settings")}</button></div>
    </div>

    <div className="settings-card">
      <div className="settings-card-head"><div><span className="eyebrow">03 · SECURITY</span><h3>{tr("أمان الحساب", "Account security")}</h3><p>{tr("إجراءات تخص حسابك فقط، ولا تمنحك صلاحية على حسابات الآخرين.", "Actions for your account only; they never grant access to other accounts.")}</p></div></div>
      <div className="security-row"><div><strong>{tr("كلمة المرور", "Password")}</strong><p>{tr("إرسال رابط آمن لتغيير كلمة مرور حسابك.", "Send a secure link to change your account password.")}</p></div><button type="button" className="secondary-button" disabled={saving} onClick={() => void requestPasswordReset()}>{tr("تغيير كلمة المرور", "Change password")}</button></div>
    </div>

    <div className="settings-card application-card">
      <div className="settings-card-head"><div><span className="eyebrow">04 · APPLICATION</span><h3>{tr("إعدادات التطبيق وخصائص المشروع", "Application settings & project properties")}</h3><p>{tr("هذه خصائص تشغيلية للمشروع وليست إعدادات شخصية. لا يتم استخدامها لتغيير بيانات أو أموال المستخدمين.", "These are project-level properties, not personal preferences. They never change users' data or money.")}</p></div></div>
      <div className="application-grid"><div><span>{tr("اسم المشروع", "Project")}</span><strong>BYE PRO FINANCE</strong></div><div><span>{tr("نطاق البيانات", "Data scope")}</span><strong>{tr("معزول لكل مستخدم", "Isolated per user")}</strong></div><div><span>{tr("المصادقة", "Authentication")}</span><strong>Supabase Auth</strong></div><div><span>{tr("حماية الصفوف", "Row security")}</span><strong>RLS · {tr("مفعّل", "Enabled")}</strong></div><div><span>{tr("المستندات", "Documents")}</span><strong>{tr("تخزين خاص", "Private storage")}</strong></div><div><span>{tr("المسح الذكي", "Smart Scan")}</span><strong>OCR · {tr("محلي في المتصفح", "Browser-local")}</strong></div><div><span>{tr("اللغات", "Languages")}</span><strong>العربية · English</strong></div><div><span>{tr("العملة الأساسية", "Base currency")}</span><strong>LYD</strong></div></div>
      <div className="application-note">{tr("المظهر واللغة والعملة والمنطقة الزمنية والتنبيهات تبقى ضمن إعدادات المستخدم لأنها تختلف من حساب لآخر. خصائص المشروع العامة تبقى مستقلة ولا تُستخدم كصلاحيات مالك.", "Theme, language, currency, timezone, and alerts remain user settings because they differ by account. Project properties stay separate and are not used as owner privileges.")}</div>
    </div>
  </section>;
}
