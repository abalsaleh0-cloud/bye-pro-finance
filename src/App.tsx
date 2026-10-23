import { useEffect, useState, type FormEvent } from "react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import AccountsView from "./components/AccountsView";

const modules = [
  { title: "لوحة التحكم", description: "نظرة عامة على وضعك المالي", number: "00", icon: "◈" },
  { title: "الحسابات", description: "الحسابات والأرصدة", number: "01", icon: "▤" },
  { title: "المعاملات", description: "الدخل والمصروفات والتحويلات", number: "02", icon: "⇄" },
  { title: "الميزانيات", description: "خطط الإنفاق ومتابعتها", number: "03", icon: "▥" },
  { title: "الديون", description: "المبالغ المستحقة والمدفوعة", number: "04", icon: "↗" },
  { title: "الادخار", description: "الأهداف والتقدم المالي", number: "05", icon: "◇" },
  { title: "التقارير", description: "ملخصات وتحليلات مالية", number: "06", icon: "▥" },
] as const;

type AuthMode = "signin" | "signup" | "reset";

function AuthPanel() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!supabase) {
      setError("الاتصال بقاعدة البيانات غير مُعدّ بعد. أضف متغيرات Supabase في إعدادات الاستضافة.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
      } else if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password });
        if (authError) throw authError;
        if (!data.session) setNotice("تم إرسال رسالة تأكيد إلى بريدك الإلكتروني إذا كان التسجيل متاحًا.");
      } else {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (authError) throw authError;
        setNotice("إذا كان البريد مسجّلًا، ستصلك تعليمات إعادة تعيين كلمة المرور.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذّر إكمال الطلب. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "signin" ? "تسجيل الدخول" : mode === "signup" ? "إنشاء حساب خاص" : "استعادة كلمة المرور";
  return (
    <section className="auth-layout">
      <div className="auth-intro">
        <p className="eyebrow">خصوصيتك أساس التصميم</p>
        <h1>أموالك، <span>بصورة أوضح.</span></h1>
        <p className="hero-copy">نظام مالي شخصي لتنظيم الحسابات والمعاملات والميزانيات والأهداف، ضمن مساحة محمية بحسابك.</p>
        <div className="trust-list">
          <span><i>✓</i> جلسات دخول آمنة عبر Supabase Auth</span>
          <span><i>✓</i> بيانات منفصلة لكل مستخدم وفق سياسات RLS</span>
          <span><i>✓</i> لا نعرض بيانات مالية تجريبية على أنها حقيقية</span>
        </div>
      </div>
      <div className="auth-card">
        <div className="auth-card-head">
          <span className="brand-mark">B</span>
          <div><h2>{title}</h2><p>{mode === "signin" ? "أدخل بيانات حسابك للمتابعة." : mode === "signup" ? "أنشئ حسابك للوصول إلى مساحتك الخاصة." : "أدخل بريدك لنرسل تعليمات الاستعادة."}</p></div>
        </div>
        {!isSupabaseConfigured && (
          <div className="notice warning" role="status">
            إعداد الاتصال غير مكتمل. يجب ضبط <code>VITE_SUPABASE_URL</code> و<code>VITE_SUPABASE_PUBLISHABLE_KEY</code> في بيئة Vercel.
          </div>
        )}
        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="auth-email">البريد الإلكتروني</label>
          <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" dir="ltr" />
          {mode !== "reset" && <>
            <label htmlFor="auth-password">كلمة المرور</label>
            <input id="auth-password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8 أحرف على الأقل" dir="ltr" />
          </>}
          {error && <p className="notice error" role="alert">{error}</p>}
          {notice && <p className="notice success" role="status">{notice}</p>}
          <button className="primary-button" type="submit" disabled={busy || !isSupabaseConfigured}>{busy ? "جارٍ التنفيذ…" : title}</button>
        </form>
        <div className="auth-links">
          {mode === "signin" ? <>
            <button type="button" onClick={() => { setMode("reset"); setError(""); setNotice(""); }}>نسيت كلمة المرور؟</button>
            <button type="button" onClick={() => { setMode("signup"); setError(""); setNotice(""); }}>إنشاء حساب جديد</button>
          </> : <button type="button" onClick={() => { setMode("signin"); setError(""); setNotice(""); }}>العودة إلى تسجيل الدخول</button>}
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [sessionReady, setSessionReady] = useState(!isSupabaseConfigured);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [activeModule, setActiveModule] = useState("لوحة التحكم");

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSignedIn(Boolean(data.session));
      setEmail(data.session?.user.email ?? "");
      setSessionReady(true);
    }).catch(() => {
      if (alive) setSessionReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      setEmail(session?.user.email ?? "");
      setSessionReady(true);
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setActiveModule("لوحة التحكم");
  }

  if (!sessionReady) return <main className="loading-screen"><span className="brand-mark">B</span><p>جارٍ تجهيز مساحتك الآمنة…</p></main>;
  if (!signedIn) {
    return <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="BYE PRO FINANCE الصفحة الرئيسية"><span className="brand-mark">B</span><span><strong>BYE PRO</strong><small>FINANCE</small></span></a>
        <span className="private-label"><span className="status-dot" /> مساحة مالية خاصة</span>
      </header>
      <AuthPanel />
      <footer className="footer"><span>BYE PRO FINANCE</span><span>الخصوصية أولاً · لا تُدخل بيانات مالية قبل التحقق من إعدادات حسابك</span></footer>
    </main>;
  }

  const active = modules.find((item) => item.title === activeModule) ?? modules[0];
  return <main className="workspace">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="BYE PRO FINANCE"><span className="brand-mark">B</span><span><strong>BYE PRO</strong><small>FINANCE</small></span></a>
      <p className="nav-caption">مساحة العمل</p>
      <nav className="main-nav" aria-label="الأقسام الرئيسية">
        {modules.map((item) => <button type="button" key={item.number} className={activeModule === item.title ? "nav-item active" : "nav-item"} onClick={() => setActiveModule(item.title)}><span className="nav-icon">{item.icon}</span><span>{item.title}</span><small>{item.number}</small></button>)}
      </nav>
      <div className="sidebar-bottom"><span className="status-dot" /><span>جلسة دخول نشطة</span><button type="button" className="text-button" onClick={signOut}>تسجيل الخروج</button></div>
    </aside>
    <section className="workspace-main">
      <header className="workspace-topbar"><div><p className="eyebrow">مساحتك المالية</p><h1>{active.title}</h1></div><div className="user-chip"><span className="avatar">{email.slice(0, 1).toUpperCase() || "U"}</span><span dir="ltr">{email}</span></div></header>
      {activeModule === "الحسابات" ? <AccountsView /> : <>
      <div className="welcome-panel"><div><p className="eyebrow">BYE PRO FINANCE · {active.number}</p><h2>{active.title === "لوحة التحكم" ? "مرحبًا بعودتك" : active.title}</h2><p>{active.description}. يجري تجهيز ربط هذا القسم ببياناتك المحفوظة.</p></div><span className="welcome-mark">{active.icon}</span></div>
      <div className="notice warning wide-notice"><strong>مرحلة التطوير:</strong> تم تجهيز تسجيل الدخول والتنقل الأساسي. لا تُعرض أرقام مالية وهمية؛ ستظهر بياناتك هنا بعد ربط عمليات القراءة والكتابة واختبارها.</div>
      <section className="section-heading"><div><p className="eyebrow">التنقل</p><h2>الأقسام الرئيسية</h2></div><span className="module-count">07 أقسام</span></section>
      <section className="module-grid" aria-label="الأقسام الرئيسية">
        {modules.filter((item) => item.title !== "لوحة التحكم").map((item) => <button type="button" className={activeModule === item.title ? "module-card selected" : "module-card"} key={item.number} onClick={() => setActiveModule(item.title)}><span className="module-number">{item.number} / {item.icon}</span><div><h3>{item.title}</h3><p>{item.description}</p></div><span className="card-arrow" aria-hidden="true">↙</span></button>)}
      </section>
      <footer className="footer"><span>BYE PRO FINANCE</span><span>بياناتك المالية خاصة بك</span></footer>
      </>}
    </section>
  </main>;
}
