import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { setStoredLocale, setStoredTheme, applyLocale, type Locale, type Theme } from "../i18n";
import "./ProfileSettingsView.css";

type Profile = {
  id: string;
  public_id: number;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  full_name_changed_at: string | null;
  username_changed_at: string | null;
};
type UserSettings = {
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
type Section = "profile" | "preferences" | "security" | "about";

const defaults: UserSettings = {
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

export default function ProfileSettingsView() {
  const en = typeof document !== "undefined" && document.documentElement.lang === "en";
  const tr = (ar: string, english: string) => (en ? english : ar);
  const [section, setSection] = useState<Section>("profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [settings, setSettings] = useState<UserSettings>(defaults);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [zoom, setZoom] = useState(1);

  const friendlyError = (cause: unknown, context: "profile" | "settings" | "avatar" | "password") => {
    const raw = typeof cause === "object" && cause !== null && "message" in cause
      ? String((cause as { message?: unknown }).message ?? "")
      : cause instanceof Error ? cause.message : String(cause ?? "");
    const code = typeof cause === "object" && cause !== null && "code" in cause
      ? String((cause as { code?: unknown }).code ?? "") : "";
    if (/Full name can only be changed every 30 days/i.test(raw)) {
      const next = profile?.full_name_changed_at ? new Date(new Date(profile.full_name_changed_at).getTime() + 30 * 86400000) : null;
      const date = next && Number.isFinite(next.getTime()) ? next.toLocaleDateString(en ? "en-GB" : "ar-LY") : "";
      return tr(`يمكن تغيير الاسم الكامل مرة كل 30 يومًا.${date ? ` يمكنك تغييره مجددًا بتاريخ ${date}.` : ""}`, `Full name can only be changed every 30 days.${date ? ` You can change it again on ${date}.` : ""}`);
    }
    if (/Username can only be changed every 60 days/i.test(raw)) {
      const next = profile?.username_changed_at ? new Date(new Date(profile.username_changed_at).getTime() + 60 * 86400000) : null;
      const date = next && Number.isFinite(next.getTime()) ? next.toLocaleDateString(en ? "en-GB" : "ar-LY") : "";
      return tr(`يمكن تغيير اسم المستخدم مرة كل 60 يومًا.${date ? ` يمكنك تغييره مجددًا بتاريخ ${date}.` : ""}`, `Username can only be changed every 60 days.${date ? ` You can change it again on ${date}.` : ""}`);
    }
    if (code === "23505" || /duplicate key value|profiles_username_key/i.test(raw)) return tr("اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر.", "That username is already taken. Choose another one.");
    if (context === "avatar") return tr("تعذر حفظ الصورة. تحقق من اتصالك وصلاحية الرفع ثم حاول مجددًا.", "Could not save the photo. Check your connection and upload permissions, then try again.");
    if (context === "settings") return tr("تعذر حفظ الإعدادات. تحقق من القيم وحاول مجددًا.", "Could not save your settings. Check the values and try again.");
    if (context === "password") return tr("تعذر إرسال رابط تغيير كلمة المرور. حاول مجددًا لاحقًا.", "Could not send the password reset link. Please try again later.");
    if (/row-level security|permission denied|not allowed/i.test(raw)) return tr("لم تسمح صلاحيات الحساب بإتمام العملية.", "Your account permissions did not allow this operation.");
    return tr("تعذر حفظ الملف الشخصي. تحقق من البيانات وحاول مجددًا.", "Could not save the profile. Check the details and try again.");
  };

  const load = async () => {
    if (!supabase) {
      setError(tr("الاتصال بقاعدة البيانات غير مُعد.", "Database connection is not configured."));
      setBusy(false);
      return;
    }
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      setError(tr("يرجى تسجيل الدخول مجددًا.", "Please sign in again."));
      setBusy(false);
      return;
    }
    setEmail(auth.user.email ?? "");
    const [{ data: p, error: pe }, { data: s, error: se }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle(),
      supabase.from("user_settings").select("theme,locale,timezone,currency_code,date_format,number_format,email_notifications,transaction_alerts,bill_reminders,budget_alerts").eq("user_id", auth.user.id).maybeSingle(),
    ]);
    if (pe || se) {
      setError(pe?.message || se?.message || tr("تعذر تحميل الإعدادات.", "Could not load settings."));
      setBusy(false);
      return;
    }
    const loadedProfile = p as unknown as Profile | null;
    if (!loadedProfile || loadedProfile.public_id == null) {
      setError(tr("تعذر تحميل معرّف المستخدم العام.", "Could not load the public user ID."));
      setBusy(false);
      return;
    }
    setProfile(loadedProfile);
    const next = { ...defaults, ...(s ?? {}) } as UserSettings;
    setSettings(next);
    setStoredTheme(next.theme);
    setStoredLocale(next.locale);
    applyLocale(next.locale, next.theme);
    setBusy(false);
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!avatarFile) { setAvatarPreview(""); return; }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  async function uploadAvatar() {
    if (!supabase || !profile || !avatarFile) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(avatarFile.type) || avatarFile.size > 5 * 1024 * 1024) {
      setError(tr("اختر JPG/PNG/WEBP بحجم لا يتجاوز 5MB.", "Choose JPG/PNG/WEBP up to 5MB."));
      return;
    }
    setUploading(true); setError(""); setMessage("");
    try {
      const image = await createImageBitmap(avatarFile);
      const side = Math.min(image.width, image.height) / zoom;
      const sx = (image.width - side) / 2;
      const sy = (image.height - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = 512; canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, sx, sy, side, side, 0, 0, 512, 512);
      image.close();
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Crop failed")), "image/jpeg", 0.92));
      const path = `${profile.id}/avatar.jpg`;
      const upload = await supabase.storage.from("profile-avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
      if (upload.error) throw upload.error;
      const publicUrl = `${supabase.storage.from("profile-avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
      const update = await supabase.from("profiles").update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq("id", profile.id);
      if (update.error) throw update.error;
      setProfile({ ...profile, avatar_url: publicUrl });
      setAvatarFile(null); setZoom(1);
      setMessage(tr("تم حفظ صورة الملف الشخصي.", "Profile photo saved."));
      window.dispatchEvent(new CustomEvent("bye-profile-updated"));
    } catch (cause) {
      setError(friendlyError(cause, "avatar"));
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile() {
    if (!supabase || !profile) return;
    const name = profile.full_name.trim();
    const username = (profile.username ?? "").trim().replace(/^@/, "").toLowerCase();
    if (name.length < 2 || name.length > 100) { setError(tr("الاسم الكامل يجب أن يكون بين حرفين و100 حرف.", "Full name must be 2–100 characters.")); return; }
    if (!/^[a-z0-9_]{3,24}$/.test(username)) { setError(tr("اسم المستخدم يجب أن يكون من 3–24 حرفًا إنجليزيًا أو رقمًا أو _.", "Username must be 3–24 letters, numbers, or underscores.")); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const { data, error: saveError } = await supabase.from("profiles").update({ full_name: name, username, updated_at: new Date().toISOString() }).eq("id", profile.id).select("*").single();
      if (saveError) { setError(friendlyError(saveError, "profile")); return; }
      if (!data) { setError(tr("لم يتم إرجاع بيانات الملف الشخصي بعد الحفظ.", "No profile data was returned after saving.")); return; }
      setProfile(data as unknown as Profile);
      setMessage(tr("تم حفظ الملف الشخصي.", "Profile saved."));
      window.dispatchEvent(new CustomEvent("bye-profile-updated"));
    } catch (cause) { setError(friendlyError(cause, "profile")); }
    finally { setSaving(false); }
  }

  async function saveSettings() {
    if (!supabase || !profile) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const { error: saveError } = await supabase.from("user_settings").upsert({ user_id: profile.id, ...settings, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (saveError) { setError(friendlyError(saveError, "settings")); return; }
      setStoredTheme(settings.theme); setStoredLocale(settings.locale); applyLocale(settings.locale, settings.theme);
      setMessage(tr("تم حفظ إعدادات المستخدم.", "Your user settings were saved."));
    } catch (cause) { setError(friendlyError(cause, "settings")); }
    finally { setSaving(false); }
  }

  async function resetPassword() {
    if (!supabase || !email) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
      if (resetError) setError(friendlyError(resetError, "password"));
      else setMessage(tr("تم إرسال رابط تغيير كلمة المرور.", "Password reset link sent."));
    } catch (cause) { setError(friendlyError(cause, "password")); }
    finally { setSaving(false); }
  }

  if (busy) return <section className="panel profile-settings-page"><p>{tr("جارٍ تحميل إعداداتك…", "Loading your settings…")}</p></section>;

  const publicId = String(profile?.public_id ?? "").padStart(6, "0");
  const patch = (value: Partial<UserSettings>) => setSettings(current => ({ ...current, ...value }));
  const tabs: { id: Section; ar: string; en: string }[] = [
    { id: "profile", ar: "الملف الشخصي", en: "Profile" },
    { id: "preferences", ar: "التفضيلات", en: "Preferences" },
    { id: "security", ar: "الأمان", en: "Security" },
    { id: "about", ar: "حول التطبيق", en: "About" },
  ];

  return <section className="panel profile-settings-page">
    <header className="settings-page-header">
      <div>
        <p className="eyebrow">BYE PRO FINANCE · SETTINGS</p>
        <h2>{tr("الإعدادات", "Settings")}</h2>
        <p>{tr("إدارة ملفك الشخصي وتفضيلاتك وأمان حسابك بشكل منفصل وواضح.", "Manage your profile, preferences, and account security in clearly separated sections.")}</p>
      </div>
    </header>

    <nav className="settings-tabs" aria-label={tr("أقسام الإعدادات", "Settings sections")}>
      {tabs.map(tab => <button key={tab.id} type="button" className={section === tab.id ? "active" : ""} onClick={() => { setSection(tab.id); setError(""); setMessage(""); }} aria-current={section === tab.id ? "page" : undefined}>{tr(tab.ar, tab.en)}</button>)}
    </nav>

    {error && <div className="settings-feedback error" role="alert">{error}</div>}
    {message && <div className="settings-feedback success" role="status">{message}</div>}

    {section === "profile" && profile && <div className="settings-section">
      <div className="settings-card">
        <div className="settings-card-head"><div><p className="eyebrow">01 · PROFILE</p><h3>{tr("بيانات الملف الشخصي", "Profile information")}</h3><p>{tr("هذه البيانات تخص حسابك أنت فقط.", "These details belong to your account only.")}</p></div></div>
        <div className="profile-identity-row">
          <div className="profile-avatar-large">{profile.avatar_url ? <img src={profile.avatar_url} alt={tr("صورة الملف الشخصي", "Profile avatar")} /> : "B"}</div>
          <div className="profile-identity-copy"><strong>{profile.full_name}</strong><span>@{profile.username ?? "—"}</span><small>{email}</small></div>
          <label className="secondary-button file-picker"><span>{tr("اختيار صورة", "Choose photo")}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setAvatarFile(e.target.files?.[0] ?? null)} /></label>
        </div>
        {avatarFile && <div className="avatar-editor"><div className="avatar-crop-preview"><img src={avatarPreview} alt={tr("معاينة الصورة", "Avatar preview")} style={{ transform: `scale(${zoom})` }} /></div><div className="avatar-editor-controls"><label className="avatar-zoom-control"><span>{tr("التكبير", "Zoom")}</span><input type="range" min="1" max="3" step="0.05" value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label><div className="avatar-editor-actions"><button className="primary-button" type="button" onClick={() => void uploadAvatar()} disabled={uploading}>{uploading ? tr("جارٍ الحفظ…", "Saving…") : tr("اعتماد الصورة", "Save photo")}</button><button className="secondary-button" type="button" onClick={() => { setAvatarFile(null); setZoom(1); }}>{tr("إلغاء", "Cancel")}</button></div></div></div>}
        <div className="profile-grid">
          <label className="profile-field"><span>{tr("الاسم الكامل", "Full name")}</span><input value={profile.full_name} maxLength={100} onChange={e => setProfile({ ...profile, full_name: e.target.value })} /></label>
          <label className="profile-field"><span>{tr("اسم المستخدم", "Username")}</span><div className="username-field"><span>@</span><input value={profile.username ?? ""} maxLength={24} onChange={e => setProfile({ ...profile, username: e.target.value.replace(/^@/, "").toLowerCase() })} dir="ltr" /></div></label>
          <label className="profile-field"><span>{tr("البريد الإلكتروني", "Email")}</span><input value={email} readOnly dir="ltr" /></label>
          <label className="profile-field"><span>{tr("معرّف المستخدم", "User ID")}</span><input className="readonly-id" value={publicId} readOnly dir="ltr" /></label>
        </div>
        <div className="settings-actions"><button className="primary-button" type="button" onClick={() => void saveProfile()} disabled={saving}>{saving ? tr("جارٍ الحفظ…", "Saving…") : tr("حفظ الملف الشخصي", "Save profile")}</button></div>
      </div>
    </div>}

    {section === "preferences" && <div className="settings-section">
      <div className="settings-card">
        <div className="settings-card-head"><div><p className="eyebrow">02 · PREFERENCES</p><h3>{tr("تفضيلات المستخدم", "User preferences")}</h3><p>{tr("إعدادات العرض واللغة والمنطقة الزمنية والعملات والتنبيهات.", "Display, language, timezone, currency, and notification preferences.")}</p></div></div>
        <div className="settings-grid">
          <label><span>{tr("المظهر", "Theme")}</span><select value={settings.theme} onChange={e => patch({ theme: e.target.value as Theme })}><option value="dark">{tr("داكن", "Dark")}</option><option value="light">{tr("فاتح", "Light")}</option></select></label>
          <label><span>{tr("لغة الحساب", "Account language")}</span><select value={settings.locale} onChange={e => patch({ locale: e.target.value as Locale })}><option value="ar">العربية</option><option value="en">English</option></select></label>
          <label><span>{tr("المنطقة الزمنية", "Timezone")}</span><select value={settings.timezone} onChange={e => patch({ timezone: e.target.value })}>{timezones.map(value => <option key={value}>{value}</option>)}</select></label>
          <label><span>{tr("العملة الافتراضية", "Default currency")}</span><select value={settings.currency_code} onChange={e => patch({ currency_code: e.target.value })}>{currencies.map(value => <option key={value}>{value}</option>)}</select></label>
          <label><span>{tr("تنسيق التاريخ", "Date format")}</span><select value={settings.date_format} onChange={e => patch({ date_format: e.target.value })}><option>YYYY-MM-DD</option><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option></select></label>
          <label><span>{tr("تنسيق الأرقام", "Number format")}</span><select value={settings.number_format} onChange={e => patch({ number_format: e.target.value })}><option>1,234.56</option><option>1.234,56</option><option>1 234,56</option></select></label>
        </div>
        <div className="settings-toggles">
          <label><input type="checkbox" checked={settings.email_notifications} onChange={e => patch({ email_notifications: e.target.checked })} />{tr("إشعارات البريد", "Email notifications")}</label>
          <label><input type="checkbox" checked={settings.transaction_alerts} onChange={e => patch({ transaction_alerts: e.target.checked })} />{tr("تنبيهات المعاملات", "Transaction alerts")}</label>
          <label><input type="checkbox" checked={settings.bill_reminders} onChange={e => patch({ bill_reminders: e.target.checked })} />{tr("تذكيرات الفواتير", "Bill reminders")}</label>
          <label><input type="checkbox" checked={settings.budget_alerts} onChange={e => patch({ budget_alerts: e.target.checked })} />{tr("تنبيهات الميزانيات", "Budget alerts")}</label>
        </div>
        <div className="settings-actions"><button className="primary-button" type="button" onClick={() => void saveSettings()} disabled={saving}>{saving ? tr("جارٍ الحفظ…", "Saving…") : tr("حفظ التفضيلات", "Save preferences")}</button></div>
      </div>
    </div>}

    {section === "security" && <div className="settings-section">
      <div className="settings-card">
        <div className="settings-card-head"><div><p className="eyebrow">03 · SECURITY</p><h3>{tr("أمان الحساب", "Account security")}</h3><p>{tr("إجراءات الأمان الخاصة بحسابك فقط.", "Security actions for your account only.")}</p></div></div>
        <div className="security-row"><div><strong>{tr("كلمة المرور", "Password")}</strong><p>{tr("إرسال رابط آمن إلى بريدك لتغيير كلمة المرور.", "Send a secure link to your email to change your password.")}</p><small dir="ltr">{email}</small></div><button className="secondary-button" type="button" onClick={() => void resetPassword()} disabled={saving}>{tr("إرسال رابط تغيير كلمة المرور", "Send password reset link")}</button></div>
      </div>
    </div>}

    {section === "about" && <div className="settings-section">
      <div className="settings-card">
        <div className="settings-card-head"><div><p className="eyebrow">04 · ABOUT</p><h3>{tr("حول BYE PRO FINANCE", "About BYE PRO FINANCE")}</h3><p>{tr("معلومات تقنية عن التطبيق. لا علاقة لها ببيانات ملفك الشخصي.", "Technical application information. This is separate from your profile data.")}</p></div></div>
        <div className="application-grid">
          {[tr("اسم التطبيق|BYE PRO FINANCE", "Application|BYE PRO FINANCE"), tr("البيئة|Production", "Environment|Production"), tr("الواجهة|React + Vite + TypeScript", "Frontend|React + Vite + TypeScript"), tr("قاعدة البيانات|Supabase PostgreSQL", "Database|Supabase PostgreSQL"), tr("المصادقة|Supabase Auth", "Authentication|Supabase Auth"), tr("عزل البيانات|RLS · per user", "Data isolation|RLS · per user"), tr("التخزين|Finance documents + profile avatars", "Storage|Finance documents + profile avatars"), tr("Smart Scan|Local browser OCR", "Smart Scan|Local browser OCR"), tr("النشر|Vercel · Production", "Deployment|Vercel · Production"), tr("Service Worker|Enabled · cache-safe navigation", "Service Worker|Enabled · cache-safe navigation")].map(item => { const [label, value] = item.split("|"); return <div key={label}><span>{label}</span><strong>{value}</strong></div>; })}
        </div>
      </div>
    </div>}
  </section>;
}
