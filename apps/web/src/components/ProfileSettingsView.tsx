import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { setStoredLocale, setStoredTheme, applyLocale, type Locale, type Theme } from "../i18n";
import "./ProfileSettingsView.css";

type Profile = { id: string; public_id: number | null; full_name: string; username: string | null; avatar_url: string | null };
type UserSettings = { theme: Theme; locale: Locale; timezone: string; currency_code: string; date_format: string; number_format: string; email_notifications: boolean; transaction_alerts: boolean; bill_reminders: boolean; budget_alerts: boolean };
const defaults: UserSettings = { theme: "dark", locale: "ar", timezone: "Africa/Tripoli", currency_code: "LYD", date_format: "YYYY-MM-DD", number_format: "1,234.56", email_notifications: true, transaction_alerts: true, bill_reminders: true, budget_alerts: true };
const currencies = ["LYD", "USD", "EUR", "GBP", "SAR", "AED", "EGP"];
const timezones = ["Africa/Tripoli", "Asia/Damascus", "Asia/Amman", "Europe/Istanbul", "Europe/London", "UTC"];

function fallbackPublicId(uuid: string) {
  let hash = 0;
  for (const char of uuid) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return 100000 + (hash % 900000);
}

export default function ProfileSettingsView() {
  const en = typeof document !== "undefined" && document.documentElement.lang === "en";
  const tr = (ar: string, english: string) => en ? english : ar;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [settings, setSettings] = useState(defaults);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [zoom, setZoom] = useState(1);

  const load = async () => {
    if (!supabase) { setError(tr("الاتصال بقاعدة البيانات غير مُعد.", "Database connection is not configured.")); setBusy(false); return; }
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) { setError(tr("يرجى تسجيل الدخول مجددًا.", "Please sign in again.")); setBusy(false); return; }
    setEmail(auth.user.email ?? "");
    const [{ data: p, error: pe }, { data: s, error: se }] = await Promise.all([
      supabase.from("profiles").select("id,public_id,full_name,username,avatar_url").eq("id", auth.user.id).maybeSingle(),
      supabase.from("user_settings").select("theme,locale,timezone,currency_code,date_format,number_format,email_notifications,transaction_alerts,bill_reminders,budget_alerts").eq("user_id", auth.user.id).maybeSingle()
    ]);
    if (pe || se) { setError(pe?.message || se?.message || tr("تعذر تحميل الإعدادات.", "Could not load settings.")); setBusy(false); return; }
    const row = p as unknown as Profile | null;
    setProfile(row ?? { id: auth.user.id, public_id: null, full_name: String(auth.user.user_metadata?.full_name ?? ""), username: String(auth.user.user_metadata?.username ?? "") || null, avatar_url: null });
    const next = { ...defaults, ...(s ?? {}) } as UserSettings;
    setSettings(next);
    setStoredTheme(next.theme); setStoredLocale(next.locale); applyLocale(next.locale, next.theme);
    setBusy(false);
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!avatarFile) { setAvatarPreview(""); return; }
    const url = URL.createObjectURL(avatarFile); setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const resetAvatarEditor = () => setZoom(1);

  async function uploadAvatar() {
    if (!supabase || !profile || !avatarFile) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(avatarFile.type) || avatarFile.size > 5 * 1024 * 1024) {
      setError(tr("اختر JPG/PNG/WEBP بحجم لا يتجاوز 5MB.", "Choose JPG/PNG/WEBP up to 5MB.")); return;
    }
    setUploading(true); setError(""); setMessage("");
    try {
      const image = await createImageBitmap(avatarFile);
      const side = Math.min(image.width, image.height) / zoom;
      const sx = (image.width - side) / 2;
      const sy = (image.height - side) / 2;
      const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 512;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Canvas unavailable");
      ctx.imageSmoothingQuality = "high"; ctx.drawImage(image, sx, sy, side, side, 0, 0, 512, 512); image.close();
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Crop failed")), "image/jpeg", 0.92));
      const path = `${profile.id}/avatar.jpg`;
      const upload = await supabase.storage.from("profile-avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
      if (upload.error) throw upload.error;
      const publicUrl = `${supabase.storage.from("profile-avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
      const update = await supabase.from("profiles").update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq("id", profile.id);
      if (update.error) throw update.error;
      setProfile({ ...profile, avatar_url: publicUrl }); setAvatarFile(null); resetAvatarEditor();
      setMessage(tr("تم اعتماد صورة البروفايل بالقص الدائري التلقائي.", "Profile photo saved with automatic circular crop."));
      window.dispatchEvent(new CustomEvent("bye-profile-updated"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr("تعذر حفظ الصورة.", "Could not save photo.")); }
    finally { setUploading(false); }
  }

  async function saveProfile() {
    if (!supabase || !profile) return;
    const name = profile.full_name.trim();
    const username = (profile.username ?? "").trim().replace(/^@/, "").toLowerCase();
    if (name.length < 2 || name.length > 100) { setError(tr("الاسم الكامل يجب أن يكون بين حرفين و100 حرف.", "Full name must be 2–100 characters.")); return; }
    if (!/^[a-z0-9_]{3,24}$/.test(username)) { setError(tr("اسم المستخدم يجب أن يكون من 3–24 حرفًا إنجليزيًا أو رقمًا أو _.", "Username must be 3–24 letters, numbers, or underscores.")); return; }
    setSaving(true); setError(""); setMessage("");
    const { error: saveError } = await supabase.from("profiles").update({ full_name: name, username, updated_at: new Date().toISOString() }).eq("id", profile.id);
    if (saveError) setError(saveError.message);
    else { setProfile({ ...profile, full_name: name, username }); setMessage(tr("تم حفظ الملف الشخصي.", "Profile saved.")); window.dispatchEvent(new CustomEvent("bye-profile-updated")); }
    setSaving(false);
  }

  async function saveSettings() {
    if (!supabase || !profile) return;
    setSaving(true); setError(""); setMessage("");
    const { error: saveError } = await supabase.from("user_settings").upsert({ user_id: profile.id, ...settings, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (saveError) setError(saveError.message);
    else { setStoredTheme(settings.theme); setStoredLocale(settings.locale); applyLocale(settings.locale, settings.theme); setMessage(tr("تم حفظ إعدادات المستخدم الخاصة بك.", "Your personal user settings were saved.")); }
    setSaving(false);
  }

  async function resetPassword() {
    if (!supabase || !email) return;
    setSaving(true); const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
    if (resetError) setError(resetError.message); else setMessage(tr("تم إرسال رابط تغيير كلمة المرور.", "Password reset link sent.")); setSaving(false);
  }

  if (busy) return <section className="panel"><p>{tr("جارٍ تحميل ملفك الشخصي…", "Loading your profile…")}</p></section>;
  const publicId = String(profile?.public_id ?? fallbackPublicId(profile?.id ?? "")).padStart(6, "0");
  const patch = (value: Partial<UserSettings>) => setSettings(current => ({ ...current, ...value }));
  const application = [
    [tr("اسم التطبيق", "Application"), "BYE PRO FINANCE"],
    [tr("البيئة", "Environment"), "Production"],
    [tr("الواجهة", "Frontend"), "React + Vite + TypeScript"],
    [tr("قاعدة البيانات", "Database"), "Supabase PostgreSQL"],
    [tr("المصادقة", "Authentication"), "Supabase Auth"],
    [tr("عزل البيانات", "Data isolation"), "RLS · per user"],
    [tr("التخزين", "Storage"), "Finance documents + profile avatars"],
    [tr("Smart Scan", "Smart Scan"), "Local browser OCR"],
    [tr("اللغات", "Languages"), "العربية · English"],
    [tr("العملة الأساسية", "Base currency"), "LYD"],
    [tr("API", "API"), "Session · Accounts · Budgets · Transactions"],
    [tr("النشر", "Deployment"), "Vercel · Production"],
    [tr("Service Worker", "Service Worker"), "Enabled · cache-safe navigation"],
    [tr("الخصوصية", "Privacy"), tr("لا توجد صلاحية خاصة على أموال مستخدم آخر", "No special access to another user's money")]
  ];

  return <section className="panel profile-settings-page">
    <div className="section-heading"><div><p className="eyebrow">BYE PRO FINANCE · ACCOUNT</p><h2>{tr("الملف الشخصي", "My profile")}</h2><p>{tr("بيانات المستخدم وإعداداته الشخصية منفصلة تمامًا عن خصائص التطبيق.", "Your identity and personal settings are completely separate from application properties.")}</p></div></div>
    {error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice success" role="status">{message}</p>}

    <div className="settings-card profile-card">
      <div className="settings-card-head"><div><span className="eyebrow">01 · PROFILE</span><h3>{tr("الملف الشخصي", "Profile")}</h3><p>{tr("هذه البيانات تخص حسابك أنت فقط.", "These details belong only to your account.")}</p></div></div>
      <div className="profile-identity-row">
        <div className="profile-avatar-large">{avatarPreview || profile?.avatar_url ? <img src={avatarPreview || profile?.avatar_url || ""} alt={tr("الصورة الشخصية", "Profile photo")} /> : <span>{(profile?.full_name || profile?.username || email || "U").slice(0, 1).toUpperCase()}</span>}</div>
        <div className="profile-identity-copy"><strong>{profile?.full_name || tr("أضف اسمك الكامل", "Add your full name")}</strong><span dir="ltr">@{profile?.username || "username"}</span><small>{email}</small></div>
        <label className="secondary-button file-picker">{tr("اختيار صورة", "Choose photo")}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { setAvatarFile(event.target.files?.[0] ?? null); resetAvatarEditor(); setError(""); setMessage(""); }} /></label>
      </div>
      {avatarFile && <div className="avatar-editor">
        <div className="avatar-crop-preview" aria-label={tr("معاينة صورة البروفايل", "Profile photo preview")}><img src={avatarPreview} alt="" draggable={false} style={{ transform: `scale(${zoom})` }} /></div>
        <div className="avatar-editor-controls"><label className="avatar-zoom-control"><span>{tr("تكبير الصورة", "Zoom")}</span><input type="range" min="1" max="3" step="0.05" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label><div className="avatar-editor-actions"><button type="button" className="secondary-button" onClick={resetAvatarEditor}>{tr("إعادة الضبط", "Reset")}</button><button type="button" className="primary-button" disabled={uploading} onClick={() => void uploadAvatar()}>{uploading ? tr("جارٍ الحفظ…", "Saving…") : tr("اعتماد الصورة", "Apply photo")}</button></div></div>
      </div>}
      <div className="profile-grid">
        <label className="profile-field"><span>{tr("الاسم الكامل", "Full name")}</span><input value={profile?.full_name ?? ""} maxLength={100} onChange={event => setProfile(current => current ? { ...current, full_name: event.target.value } : current)} autoComplete="name" /></label>
        <label className="profile-field"><span>{tr("اسم المستخدم", "Username")}</span><div className="username-field"><span>@</span><input value={profile?.username ?? ""} maxLength={24} onChange={event => setProfile(current => current ? { ...current, username: event.target.value.replace(/^@/, "") } : current)} autoComplete="username" dir="ltr" /></div></label>
        <label className="profile-field"><span>{tr("البريد الإلكتروني", "Email address")}</span><input value={email} readOnly dir="ltr" /></label>
        <label className="profile-field"><span>{tr("معرّف المستخدم", "User ID")}</span><input value={publicId} readOnly dir="ltr" className="readonly-id public-user-id" /><small>{tr("معرّف عام من 6 أرقام، ثابت لهذا الحساب.", "A stable 6-digit public ID for this account.")}</small></label>
      </div>
      <div className="settings-actions"><button className="primary-button" type="button" disabled={saving} onClick={() => void saveProfile()}>{saving ? tr("جارٍ الحفظ…", "Saving…") : tr("حفظ الملف الشخصي", "Save profile")}</button></div>
    </div>

    <div className="settings-card">
      <div className="settings-card-head"><div><span className="eyebrow">02 · PERSONAL SETTINGS</span><h3>{tr("إعدادات المستخدم", "User settings")}</h3><p>{tr("هذه الإعدادات شخصية لهذا المستخدم فقط ولا تمثل إعدادات التطبيق.", "These settings belong only to this user and are not application settings.")}</p></div></div>
      <div className="settings-grid">
        <label><span>{tr("المظهر", "Appearance")}</span><select value={settings.theme} onChange={event => patch({ theme: event.target.value as Theme })}><option value="dark">{tr("داكن", "Dark")}</option><option value="light">{tr("فاتح", "Light")}</option></select></label>
        <label><span>{tr("لغة الحساب", "Account language")}</span><select value={settings.locale} onChange={event => patch({ locale: event.target.value as Locale })}><option value="ar">{tr("العربية", "Arabic")}</option><option value="en">English</option></select></label>
        <label><span>{tr("العملة الافتراضية", "Default currency")}</span><select value={settings.currency_code} onChange={event => patch({ currency_code: event.target.value })}>{currencies.map(currency => <option key={currency}>{currency}</option>)}</select></label>
        <label><span>{tr("المنطقة الزمنية", "Time zone")}</span><select value={settings.timezone} onChange={event => patch({ timezone: event.target.value })}>{timezones.map(timezone => <option key={timezone}>{timezone}</option>)}</select></label>
        <label><span>{tr("تنسيق التاريخ", "Date format")}</span><select value={settings.date_format} onChange={event => patch({ date_format: event.target.value })}><option>YYYY-MM-DD</option><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option></select></label>
        <label><span>{tr("تنسيق الأرقام", "Number format")}</span><select value={settings.number_format} onChange={event => patch({ number_format: event.target.value })}><option>1,234.56</option><option>1.234,56</option><option>1 234,56</option></select></label>
      </div>
      <div className="settings-toggles">{([["email_notifications", "إشعارات البريد", "Email notifications"], ["transaction_alerts", "تنبيهات المعاملات", "Transaction alerts"], ["bill_reminders", "تذكيرات الفواتير", "Bill reminders"], ["budget_alerts", "تنبيهات الميزانيات", "Budget alerts"]] as const).map(([key, ar, english]) => <label key={key}><input type="checkbox" checked={settings[key]} onChange={event => patch({ [key]: event.target.checked })} /><span>{tr(ar, english)}</span></label>)}</div>
      <div className="settings-actions"><button className="primary-button" type="button" disabled={saving} onClick={() => void saveSettings()}>{saving ? tr("جارٍ الحفظ…", "Saving…") : tr("حفظ إعداداتي", "Save my settings")}</button></div>
    </div>

    <div className="settings-card">
      <div className="settings-card-head"><div><span className="eyebrow">03 · SECURITY</span><h3>{tr("أمان الحساب", "Account security")}</h3><p>{tr("إجراءات تخص حسابك فقط.", "Actions for your account only.")}</p></div></div>
      <div className="security-row"><div><strong>{tr("كلمة المرور", "Password")}</strong><p>{tr("إرسال رابط آمن لتغيير كلمة المرور.", "Send a secure password-change link.")}</p></div><button className="secondary-button" type="button" disabled={saving} onClick={() => void resetPassword()}>{tr("تغيير كلمة المرور", "Change password")}</button></div>
    </div>

    <div className="settings-card application-card">
      <div className="settings-card-head"><div><span className="eyebrow">04 · APPLICATION</span><h3>{tr("إعدادات التطبيق وخصائص المشروع", "Application settings & project properties")}</h3><p>{tr("هذا القسم يخص التطبيق نفسه: البنية، البيانات، الأمان، الخدمات والخصائص العامة. لا يتم حفظه ضمن إعدادات المستخدم.", "This section belongs to the application itself: architecture, data, security, services, and general capabilities. It is not stored as user settings.")}</p></div></div>
      <div className="application-grid">{application.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <div className="application-note">{tr("ملاحظة: معرف المستخدم الداخلي في Supabase يبقى UUID لأغراض الملكية والعزل الأمني، بينما الرقم الظاهر للمستخدم هو المعرف العام المختصر من 6 أرقام.", "Note: the internal Supabase user identifier remains a UUID for ownership and security, while the user-facing ID is the short 6-digit public identifier.")}</div>
    </div>
  </section>;
}
