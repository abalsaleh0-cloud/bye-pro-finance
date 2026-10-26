import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "./ProfileSettingsView.css";

type Profile = {
  id: string;
  public_id: number | null;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
};

function fallbackPublicId(uuid: string) {
  let hash = 0;
  for (const char of uuid) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return 100000 + (hash % 900000);
}

export default function ProfileSettingsView() {
  const en = typeof document !== "undefined" && document.documentElement.lang === "en";
  const tr = (ar: string, english: string) => (en ? english : ar);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [zoom, setZoom] = useState(1);

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
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("id,public_id,full_name,username,avatar_url")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profileError) {
      setError(profileError.message || tr("تعذر تحميل الملف الشخصي.", "Could not load your profile."));
      setBusy(false);
      return;
    }
    setProfile(
      (data as Profile | null) ?? {
        id: auth.user.id,
        public_id: null,
        full_name: String(auth.user.user_metadata?.full_name ?? ""),
        username: String(auth.user.user_metadata?.username ?? "") || null,
        avatar_url: null,
      },
    );
    setBusy(false);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview("");
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const resetAvatarEditor = () => setZoom(1);

  async function uploadAvatar() {
    if (!supabase || !profile || !avatarFile) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(avatarFile.type) || avatarFile.size > 5 * 1024 * 1024) {
      setError(tr("اختر JPG أو PNG أو WEBP بحجم لا يتجاوز 5MB.", "Choose JPG, PNG, or WEBP up to 5MB."));
      return;
    }
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const image = await createImageBitmap(avatarFile);
      const side = Math.min(image.width, image.height) / zoom;
      const sx = (image.width - side) / 2;
      const sy = (image.height - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error(tr("تعذر تجهيز الصورة.", "Could not prepare the image."));
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, sx, sy, side, side, 0, 0, 512, 512);
      image.close();
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("Crop failed"))), "image/jpeg", 0.92),
      );
      const path = `${profile.id}/avatar.jpg`;
      const upload = await supabase.storage.from("profile-avatars").upload(path, blob, {
        upsert: true,
        contentType: "image/jpeg",
        cacheControl: "3600",
      });
      if (upload.error) throw upload.error;
      const publicUrl = `${supabase.storage.from("profile-avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
      const update = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq("id", profile.id);
      if (update.error) throw update.error;
      setProfile({ ...profile, avatar_url: publicUrl });
      setAvatarFile(null);
      resetAvatarEditor();
      setMessage(tr("تم حفظ الصورة الشخصية بنجاح.", "Profile photo saved successfully."));
      window.dispatchEvent(new CustomEvent("bye-profile-updated"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr("تعذر حفظ الصورة.", "Could not save photo."));
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile() {
    if (!supabase || !profile) return;
    const name = profile.full_name.trim();
    const username = (profile.username ?? "").trim().replace(/^@/, "").toLowerCase();
    if (name.length < 2 || name.length > 100) {
      setError(tr("الاسم الكامل يجب أن يكون بين حرفين و100 حرف.", "Full name must be 2–100 characters."));
      return;
    }
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      setError(tr("اسم المستخدم يجب أن يكون من 3–24 حرفًا إنجليزيًا أو رقمًا أو _.", "Username must be 3–24 letters, numbers, or underscores."));
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    const { error: saveError } = await supabase
      .from("profiles")
      .update({ full_name: name, username, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (saveError) {
      setError(saveError.message);
    } else {
      setProfile({ ...profile, full_name: name, username });
      setMessage(tr("تم حفظ الملف الشخصي.", "Profile saved."));
      window.dispatchEvent(new CustomEvent("bye-profile-updated"));
    }
    setSaving(false);
  }

  if (busy) return <section className="panel"><p>{tr("جارٍ تحميل ملفك الشخصي…", "Loading your profile…")}</p></section>;

  const publicId = String(profile?.public_id ?? fallbackPublicId(profile?.id ?? "")).padStart(6, "0");
  const currentAvatar = avatarPreview || profile?.avatar_url || "";
  const initial = (profile?.full_name || profile?.username || email || "U").slice(0, 1).toUpperCase();

  return (
    <section className="panel profile-settings-page">
      <div className="section-heading profile-page-heading">
        <div>
          <p className="eyebrow">BYE PRO FINANCE · ACCOUNT</p>
          <h2>{tr("الملف الشخصي", "My profile")}</h2>
          <p>{tr("كل ما يخص هويتك وحسابك الشخصي موجود هنا فقط.", "Everything about your identity and personal account is kept here.")}</p>
        </div>
      </div>

      {error && <p className="notice error" role="alert">{error}</p>}
      {message && <p className="notice success" role="status">{message}</p>}

      <div className="settings-card profile-card">
        <div className="settings-card-head">
          <div>
            <span className="eyebrow">01 · IDENTITY</span>
            <h3>{tr("هويتي", "My identity")}</h3>
            <p>{tr("الصورة والاسم واسم المستخدم ومعرّف الحساب.", "Your photo, name, username, and account identifier.")}</p>
          </div>
        </div>

        <div className="profile-identity-row">
          <div className="profile-avatar-large" aria-label={tr("الصورة الشخصية", "Profile photo")}>
            {currentAvatar ? <img src={currentAvatar} alt={tr("الصورة الشخصية", "Profile photo")} /> : <span>{initial}</span>}
          </div>
          <div className="profile-identity-copy">
            <strong>{profile?.full_name || tr("أضف اسمك الكامل", "Add your full name")}</strong>
            <span dir="ltr">@{profile?.username || "username"}</span>
            <small dir="ltr">{email || tr("لا يوجد بريد إلكتروني", "No email address")}</small>
          </div>
          <label className="secondary-button file-picker">
            {tr("اختيار صورة", "Choose photo")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                setAvatarFile(event.target.files?.[0] ?? null);
                resetAvatarEditor();
                setError("");
                setMessage("");
              }}
            />
          </label>
        </div>

        {avatarFile && (
          <div className="avatar-editor">
            <div className="avatar-crop-preview" aria-label={tr("معاينة صورة البروفايل", "Profile photo preview")}>
              <img src={avatarPreview} alt="" draggable={false} style={{ transform: `scale(${zoom})` }} />
            </div>
            <div className="avatar-editor-controls">
              <label className="avatar-zoom-control">
                <span>{tr("تكبير الصورة", "Zoom")}</span>
                <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
              </label>
              <div className="avatar-editor-actions">
                <button type="button" className="secondary-button" onClick={resetAvatarEditor}>{tr("إعادة الضبط", "Reset")}</button>
                <button type="button" className="primary-button" disabled={uploading} onClick={() => void uploadAvatar()}>{uploading ? tr("جارٍ الحفظ…", "Saving…") : tr("اعتماد الصورة", "Apply photo")}</button>
              </div>
            </div>
          </div>
        )}

        <div className="profile-grid">
          <label className="profile-field">
            <span>{tr("الاسم الكامل", "Full name")}</span>
            <input value={profile?.full_name ?? ""} maxLength={100} onChange={(event) => setProfile((current) => current ? { ...current, full_name: event.target.value } : current)} autoComplete="name" />
          </label>
          <label className="profile-field">
            <span>{tr("اسم المستخدم", "Username")}</span>
            <div className="username-field">
              <span>@</span>
              <input value={profile?.username ?? ""} maxLength={24} onChange={(event) => setProfile((current) => current ? { ...current, username: event.target.value.replace(/^@/, "") } : current)} autoComplete="username" dir="ltr" />
            </div>
          </label>
          <label className="profile-field">
            <span>{tr("البريد الإلكتروني", "Email address")}</span>
            <input value={email} readOnly dir="ltr" />
          </label>
          <label className="profile-field">
            <span>{tr("معرّف المستخدم", "User ID")}</span>
            <input value={publicId} readOnly dir="ltr" className="readonly-id public-user-id" />
            <small>{tr("معرّف عام مختصر لهذا الحساب.", "A short public identifier for this account.")}</small>
          </label>
        </div>

        <div className="settings-actions">
          <button className="primary-button" type="button" disabled={saving} onClick={() => void saveProfile()}>
            {saving ? tr("جارٍ الحفظ…", "Saving…") : tr("حفظ الملف الشخصي", "Save profile")}
          </button>
        </div>
      </div>

      <div className="settings-card profile-account-note">
        <div className="settings-card-head">
          <div>
            <span className="eyebrow">02 · ACCOUNT</span>
            <h3>{tr("بيانات الحساب", "Account details")}</h3>
            <p>{tr("بيانات الحساب الأساسية للعرض فقط. إعدادات التطبيق وخصائص المشروع موجودة في قسم مستقل.", "Basic account information is shown here only. Application settings and project properties live in a separate section.")}</p>
          </div>
        </div>
        <div className="account-summary-grid">
          <div><span>{tr("الحساب", "Account")}</span><strong>{email || "—"}</strong></div>
          <div><span>{tr("المعرّف العام", "Public ID")}</span><strong dir="ltr">{publicId}</strong></div>
          <div><span>{tr("اسم المستخدم", "Username")}</span><strong dir="ltr">@{profile?.username || "—"}</strong></div>
        </div>
      </div>
    </section>
  );
}
