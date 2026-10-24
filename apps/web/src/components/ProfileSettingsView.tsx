import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { supabase } from "../lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  currency_code: string;
  locale: string;
  timezone: string;
  full_name_changed_at: string | null;
  username_changed_at: string | null;
};

const currencies = ["LYD", "USD", "EUR", "GBP", "SAR", "AED", "EGP"];
const timezones = ["Africa/Tripoli", "Asia/Damascus", "Asia/Amman", "Europe/Istanbul", "Europe/London", "UTC"];

export default function ProfileSettingsView() {
  const en = typeof document !== "undefined" && document.documentElement.lang === "en";
  const tr = (ar: string, english: string) => en ? english : ar;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [currency, setCurrency] = useState("LYD");
  const [locale, setLocale] = useState(en ? "en" : "ar");
  const [timezone, setTimezone] = useState("Africa/Tripoli");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);

  const fullNameAllowed = useMemo(() => !profile?.full_name_changed_at || Date.now() - new Date(profile.full_name_changed_at).getTime() >= 30 * 86400000, [profile]);
  const usernameAllowed = useMemo(() => !profile?.username_changed_at || Date.now() - new Date(profile.username_changed_at).getTime() >= 60 * 86400000, [profile]);
  const remainingDays = (stamp: string | null | undefined, days: number) => {
    if (!stamp) return 0;
    return Math.max(0, Math.ceil((new Date(stamp).getTime() + days * 86400000 - Date.now()) / 86400000));
  };
  const load = async () => {
    if (!supabase) { setError(tr("الاتصال بقاعدة البيانات غير مُعد.", "Database connection is not configured.")); setBusy(false); return; }
    setBusy(true); setError("");
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) { setError(tr("يرجى تسجيل الدخول مجددًا.", "Please sign in again.")); setBusy(false); return; }
    setEmail(auth.user.email ?? "");
    const { data, error: profileError } = await supabase.from("profiles").select("id,full_name,username,avatar_url,currency_code,locale,timezone,full_name_changed_at,username_changed_at").eq("id", auth.user.id).maybeSingle();
    if (profileError) { setError(profileError.message); setBusy(false); return; }
    const next: Profile = data ?? { id: auth.user.id, full_name: String(auth.user.user_metadata?.full_name ?? ""), username: String(auth.user.user_metadata?.username ?? "") || null, avatar_url: null, currency_code: "LYD", locale: "ar", timezone: "Africa/Tripoli", full_name_changed_at: null, username_changed_at: null };
    setProfile(next); setFullName(next.full_name ?? ""); setUsername(next.username ?? ""); setAvatarUrl(next.avatar_url ?? ""); setCurrency(next.currency_code ?? "LYD"); setLocale(next.locale ?? "ar"); setTimezone(next.timezone ?? "Africa/Tripoli"); setBusy(false);
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!avatarFile) { setAvatarPreviewUrl(""); return; } const url = URL.createObjectURL(avatarFile); setAvatarPreviewUrl(url); return () => URL.revokeObjectURL(url); }, [avatarFile]);

  async function uploadAvatar() {
    if (!supabase || !profile || !avatarFile) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(avatarFile.type)) { setError(tr("اختر صورة JPG أو PNG أو WEBP.", "Choose a JPG, PNG, or WEBP image.")); return; }
    if (avatarFile.size > 5 * 1024 * 1024) { setError(tr("حجم الصورة يجب ألا يتجاوز 5 ميغابايت.", "Image must be 5 MB or smaller.")); return; }
    setUploading(true); setError(""); setMessage("");
    try {
      const image = await createImageBitmap(avatarFile);
      const side = Math.min(image.width, image.height) / cropZoom;
      const maxX = Math.max(0, image.width - side);
      const maxY = Math.max(0, image.height - side);
      const sx = maxX * cropX / 100;
      const sy = maxY * cropY / 100;
      const canvas = document.createElement("canvas");
      canvas.width = 512; canvas.height = 512;
      const context = canvas.getContext("2d");
      if (!context) throw new Error(tr("تعذر تجهيز الصورة.", "Could not prepare the image."));
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
      context.drawImage(image, sx, sy, side, side, 0, 0, 512, 512);
      image.close();
      const cropped = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(tr("تعذر قص الصورة.", "Could not crop the image."))), "image/jpeg", 0.92));
      const path = profile.id + "/avatar.jpg";
      const { error: uploadError } = await supabase.storage.from("profile-avatars").upload(path, cropped, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("profile-avatars").getPublicUrl(path);
      const publicUrl = data.publicUrl + "?v=" + Date.now();
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq("id", profile.id);
      if (updateError) throw updateError;
      setAvatarUrl(publicUrl); setMessage(tr("تم قص الصورة وحفظها بنجاح.", "Photo cropped and saved successfully.")); window.dispatchEvent(new CustomEvent("bye-profile-updated"));
      setAvatarFile(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr("تعذر رفع الصورة.", "Could not upload the photo.")); }
    finally { setUploading(false); }
  }

  async function save() {
    if (!supabase || !profile) return;
    const cleanName = fullName.trim();
    const cleanUsername = username.trim().replace(/^@/, "").toLowerCase();
    if (cleanName.length < 2 || cleanName.length > 100) { setError(tr("الاسم الكامل يجب أن يكون بين حرفين و100 حرف.", "Full name must be 2–100 characters.")); return; }
    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) { setError(tr("اسم المستخدم يجب أن يتكون من 3–24 حرفًا إنجليزيًا أو رقمًا أو _.", "Username must be 3–24 letters, numbers, or underscores.")); return; }
    if (!fullNameAllowed && cleanName !== profile.full_name) { setError(tr("لا يمكنك تغيير الاسم الكامل قبل انتهاء مدة 30 يومًا.", "Full name can only be changed every 30 days.")); return; }
    if (!usernameAllowed && cleanUsername !== (profile.username ?? "")) { setError(tr("لا يمكنك تغيير اسم المستخدم قبل انتهاء مدة 60 يومًا.", "Username can only be changed every 60 days.")); return; }
    setSaving(true); setError(""); setMessage("");
    const { error: saveError } = await supabase.from("profiles").update({ full_name: cleanName, username: cleanUsername, currency_code: currency, locale, timezone, updated_at: new Date().toISOString() }).eq("id", profile.id);
    if (saveError) setError(saveError.message);
    else { setMessage(tr("تم حفظ بيانات الملف الشخصي والإعدادات.", "Profile and account settings saved.")); await load(); window.dispatchEvent(new CustomEvent("bye-profile-updated")); window.dispatchEvent(new CustomEvent("bye-locale-updated", { detail: { locale } })); }
    setSaving(false);
  }

  async function onAvatarChange(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0] ?? null; setAvatarFile(file); setCropZoom(1); setCropX(50); setCropY(50); setMessage(""); setError(""); event.target.value = ""; }
  if (busy) return <section className="panel"><p>{tr("جارٍ تحميل ملفك الشخصي…", "Loading your profile…")}</p></section>;

  return <section className="panel profile-settings">
    <div className="section-heading"><div><p className="eyebrow">BYE PRO FINANCE · ACCOUNT</p><h2>{tr("ملفي الشخصي", "My profile")}</h2><p>{tr("بيانات حسابك الشخصية وتفضيلات مساحتك المالية.", "Your personal account details and finance workspace preferences.")}</p></div></div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {message && <p className="notice success" role="status">{message}</p>}
    <div className="profile-identity-card">
      <div className="profile-avatar-large">{avatarUrl ? <img src={avatarUrl} alt={tr("الصورة الشخصية", "Profile photo")} /> : <span>{(fullName.trim()[0] || username[0] || "B").toUpperCase()}</span>}</div>
      <div className="profile-identity-copy"><strong>{fullName || tr("أضف اسمك الكامل", "Add your full name")}</strong><span>@{username || tr("اسم المستخدم", "username")}</span><small>{email}</small></div>
      <div className="profile-avatar-actions"><label className="secondary-button file-picker">{tr("اختيار صورة", "Choose photo")}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={onAvatarChange} /></label></div>
    </div>
    {avatarFile && <div className="avatar-editor">
      <div className="avatar-editor-heading"><div><strong>{tr("تعديل الصورة الشخصية", "Adjust profile photo")}</strong><p>{tr("حرّك الصورة وكبّرها حتى تحصل على القصّة التي تريدها.", "Move and zoom the image until the crop looks right.")}</p></div><div className="avatar-crop-preview"><img src={avatarPreviewUrl} alt={tr("معاينة القص", "Crop preview")} style={{ objectPosition: cropX + "% " + cropY + "%", transform: "scale(" + cropZoom + ")" }} /></div></div>
      <div className="avatar-adjustments">
        <label>{tr("التكبير", "Zoom")}<input type="range" min="1" max="3" step="0.05" value={cropZoom} onChange={e=>setCropZoom(Number(e.target.value))}/><small>{cropZoom.toFixed(2)}×</small></label>
        <label>{tr("الموضع الأفقي", "Horizontal position")}<input type="range" min="0" max="100" value={cropX} onChange={e=>setCropX(Number(e.target.value))}/></label>
        <label>{tr("الموضع العمودي", "Vertical position")}<input type="range" min="0" max="100" value={cropY} onChange={e=>setCropY(Number(e.target.value))}/></label>
      </div>
      <div className="avatar-editor-actions"><button className="secondary-button" type="button" onClick={()=>{setCropZoom(1);setCropX(50);setCropY(50);}}>{tr("إعادة ضبط القص", "Reset crop")}</button><button className="primary-button" type="button" disabled={uploading} onClick={() => void uploadAvatar()}>{uploading ? tr("جارٍ تجهيز الصورة…", "Preparing photo…") : tr("اعتماد الصورة وحفظها", "Apply crop and save")}</button></div>
    </div>}
    <div className="profile-settings-grid">
      <label className="profile-field"><span>{tr("الاسم الكامل", "Full name")} <small>{tr("التغيير كل 30 يومًا", "Change every 30 days")}</small></span><input value={fullName} minLength={2} maxLength={100} onChange={e=>setFullName(e.target.value)} disabled={!fullNameAllowed} autoComplete="name" />{!fullNameAllowed && <small>{tr("متاح بعد", "Available in")} {remainingDays(profile?.full_name_changed_at,30)} {tr("يومًا", "days")}</small>}</label>
      <label className="profile-field"><span>{tr("اسم المستخدم", "Username")} <small>{tr("التغيير كل 60 يومًا", "Change every 60 days")}</small></span><div className="username-field"><span>@</span><input value={username} minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" onChange={e=>setUsername(e.target.value.replace(/^@/,""))} disabled={!usernameAllowed} autoComplete="username" dir="ltr" /></div>{!usernameAllowed && <small>{tr("متاح بعد", "Available in")} {remainingDays(profile?.username_changed_at,60)} {tr("يومًا", "days")}</small>}</label>
      <label className="profile-field"><span>{tr("البريد الإلكتروني", "Email address")}</span><input value={email} readOnly dir="ltr" /><small>{tr("لتغيير البريد استخدم إجراءات أمان الحساب.", "Use account security options to change your email.")}</small></label>
      <label className="profile-field"><span>{tr("العملة الافتراضية", "Default currency")}</span><select value={currency} onChange={e=>setCurrency(e.target.value)}>{currencies.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
      <label className="profile-field"><span>{tr("لغة الحساب", "Account language")}</span><select value={locale} onChange={e=>setLocale(e.target.value)}><option value="ar">{tr("العربية", "Arabic")}</option><option value="en">English</option></select></label>
      <label className="profile-field"><span>{tr("المنطقة الزمنية", "Time zone")}</span><select value={timezone} onChange={e=>setTimezone(e.target.value)}>{timezones.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
    </div>
    <div className="profile-settings-footer"><span>{tr("بياناتك المالية خاصة بك، ولا تُعرض للمستخدمين الآخرين.", "Your financial data is private and is not shown to other users.")}</span><button className="primary-button" type="button" onClick={() => void save()} disabled={saving}>{saving ? tr("جارٍ الحفظ…", "Saving…") : tr("حفظ التغييرات", "Save changes")}</button></div>
  </section>;
}
