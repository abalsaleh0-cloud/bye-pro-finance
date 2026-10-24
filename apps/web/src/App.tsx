import "./advanced-finance.css";
import { useEffect, useState, type FormEvent } from "react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import AccountsView from "./components/AccountsView";
import TransactionsView from "./components/TransactionsView";
import DashboardView from "./components/DashboardView";
import { CollectionView } from "./components/FinanceViews";
import ReportsView from "./components/ReportsView";
import { DocumentsView, NotificationsView } from "./components/AdvancedFinanceViews";
import { AdminView, AssistantView, HouseholdView, ImportExportView, SettingsView, SmartScanView, TransfersView } from "./components/PlatformViews";
import PreferencesBar from "./components/PreferencesBar";
import { applyLocale, getStoredLocale, messages, type Locale } from "./i18n";

type ActiveModule = "لوحة التحكم" | "الحسابات" | "المعاملات" | "التحويلات" | "الميزانيات" | "الديون" | "الفواتير" | "الادخار" | "الأصول" | "التقارير" | "المنزل" | "المستندات" | "المسح الذكي" | "المساعد المالي" | "الإشعارات" | "استيراد وتصدير" | "الإعدادات" | "الإدارة";
const modules: { title: ActiveModule; description: string; number: string; icon: string }[] = [
  { title: "لوحة التحكم", description: "نظرة عامة على وضعك المالي", number: "00", icon: "◈" },
  { title: "الحسابات", description: "الحسابات والأرصدة", number: "01", icon: "▤" },
  { title: "المعاملات", description: "الدخل والمصروفات", number: "02", icon: "⇄" },
  { title: "التحويلات", description: "نقل الأموال بين الحسابات", number: "03", icon: "↔" },
  { title: "الميزانيات", description: "خطط الإنفاق", number: "04", icon: "▥" },
  { title: "الديون", description: "المستحقات والالتزامات", number: "05", icon: "↗" },
  { title: "الفواتير", description: "المدفوعات والاستحقاقات", number: "06", icon: "□" },
  { title: "الادخار", description: "الأهداف والتقدم", number: "07", icon: "◇" },
  { title: "الأصول", description: "الأصول وصافي الثروة", number: "08", icon: "◆" },
  { title: "التقارير", description: "التحليلات المالية", number: "09", icon: "▥" },
  { title: "المنزل", description: "مصروفات الأسرة", number: "10", icon: "⌂" },
  { title: "المستندات", description: "الأرشيف المالي", number: "11", icon: "▧" },
  { title: "المسح الذكي", description: "OCR واستخراج البيانات", number: "12", icon: "⌕" },
  { title: "المساعد المالي", description: "التحليل والمساعدة الذكية", number: "13", icon: "✦" },
  { title: "الإشعارات", description: "التنبيهات المالية", number: "14", icon: "◉" },
  { title: "استيراد وتصدير", description: "نقل بياناتك", number: "15", icon: "⇵" },
  { title: "الإعدادات", description: "تفضيلات الحساب", number: "16", icon: "⚙" },
  { title: "الإدارة", description: "مراقبة وإدارة النظام", number: "17", icon: "▣" },
];

const englishTitles: Record<ActiveModule, string> = {
  "لوحة التحكم": "Dashboard", "الحسابات": "Accounts", "المعاملات": "Transactions", "التحويلات": "Transfers", "الميزانيات": "Budgets", "الديون": "Debts", "الفواتير": "Bills", "الادخار": "Savings", "الأصول": "Assets", "التقارير": "Reports", "المنزل": "Household", "المستندات": "Documents", "المسح الذكي": "Smart Scan", "المساعد المالي": "Financial Assistant", "الإشعارات": "Notifications", "استيراد وتصدير": "Import & Export", "الإعدادات": "Settings", "الإدارة": "Administration",
};

function AuthPanel({ locale }: { locale: Locale }) {
  const [mode,setMode]=useState<"signin"|"signup"|"reset">("signin"),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const t=messages[locale];
  async function handleSubmit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");setNotice("");if(!supabase){setError("الاتصال بقاعدة البيانات غير مُعد بعد.");return}setBusy(true);try{if(mode==="signin"){const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)throw error}else if(mode==="signup"){const {data,error}=await supabase.auth.signUp({email:email.trim(),password});if(error)throw error;if(!data.session)setNotice("تم إرسال رسالة تأكيد إلى بريدك الإلكتروني.")}else{const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin});if(error)throw error;setNotice("إذا كان البريد مسجلًا، ستصلك تعليمات الاستعادة.")}}catch(cause){setError(cause instanceof Error?cause.message:"تعذر إكمال الطلب.")}finally{setBusy(false)}}
  const title=mode==="signin"?t.signIn:mode==="signup"?t.signUp:t.resetPassword;
  return <section className="auth-layout"><div className="auth-intro"><p className="eyebrow">{locale === "ar" ? "خصوصيتك أساس التصميم" : "Privacy is built into the design"}</p><h1>{locale === "ar" ? <>أموالك، <span>بصورة أوضح.</span></> : <>Your money, <span>made clearer.</span></>}</h1><p className="hero-copy">{locale === "ar" ? "نظام مالي شخصي لتنظيم الحسابات والمعاملات والميزانيات والأهداف ضمن مساحة محمية بحسابك." : "A personal finance workspace for accounts, transactions, budgets and goals in a private account."}</p></div><div className="auth-card"><div className="auth-card-head"><span className="brand-mark">B</span><div><h2>{title}</h2><p>{locale === "ar" ? "مساحتك المالية الخاصة." : "Your private financial workspace."}</p></div></div>{!isSupabaseConfigured&&<div className="notice warning">اضبط VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY.</div>}<form onSubmit={handleSubmit} className="auth-form"><label htmlFor="auth-email">{locale === "ar" ? "البريد الإلكتروني" : "Email"}</label><input id="auth-email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} dir="ltr"/>{mode!=="reset"&&<><label htmlFor="auth-password">{locale === "ar" ? "كلمة المرور" : "Password"}</label><input id="auth-password" type="password" autoComplete={mode==="signup"?"new-password":"current-password"} required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} dir="ltr"/> </>}{error&&<p className="notice error">{error}</p>}{notice&&<p className="notice success">{notice}</p>}<button className="primary-button" type="submit" disabled={busy||!isSupabaseConfigured}>{busy?(locale === "ar"?"جارٍ التنفيذ…":"Working…"):title}</button></form><div className="auth-links">{mode==="signin"?<><button type="button" onClick={()=>setMode("reset")}>{locale === "ar" ? "نسيت كلمة المرور؟" : "Forgot password?"}</button><button type="button" onClick={()=>setMode("signup")}>{t.signUp}</button></>:<button type="button" onClick={()=>setMode("signin")}>{locale === "ar" ? "العودة للدخول" : "Back to sign in"}</button>}</div></div></section>;
}

function SectionContent({activeModule}:{activeModule:ActiveModule}) {
  if(activeModule==="لوحة التحكم")return <DashboardView/>; if(activeModule==="الحسابات")return <AccountsView/>; if(activeModule==="المعاملات")return <TransactionsView/>; if(activeModule==="التحويلات")return <TransfersView/>; if(activeModule==="التقارير")return <ReportsView/>; if(activeModule==="المنزل")return <HouseholdView/>; if(activeModule==="المستندات")return <DocumentsView/>; if(activeModule==="المسح الذكي")return <SmartScanView/>; if(activeModule==="المساعد المالي")return <AssistantView/>; if(activeModule==="الإشعارات")return <NotificationsView/>; if(activeModule==="استيراد وتصدير")return <ImportExportView/>; if(activeModule==="الإعدادات")return <SettingsView/>;
  if(activeModule==="الإدارة")return <AdminView/>;
  const map:Record<string,"budgets"|"debts"|"bills"|"savings_goals"|"assets">={"الميزانيات":"budgets","الديون":"debts","الفواتير":"bills","الادخار":"savings_goals","الأصول":"assets"}; return <CollectionView module={map[activeModule]}/>;
}

export default function App(){
  const [sessionReady,setSessionReady]=useState(!isSupabaseConfigured),[signedIn,setSignedIn]=useState(false),[email,setEmail]=useState(""),[activeModule,setActiveModule]=useState<ActiveModule>("لوحة التحكم"),[locale,setLocale]=useState<Locale>(getStoredLocale());
  useEffect(()=>{applyLocale(locale);const onLocale=(event:Event)=>setLocale((event as CustomEvent<Locale>).detail);window.addEventListener("bye-pro-finance:locale",onLocale);return()=>window.removeEventListener("bye-pro-finance:locale",onLocale)},[locale]);
  useEffect(()=>{if(!supabase)return;let alive=true;supabase.auth.getSession().then(({data})=>{if(!alive)return;setSignedIn(Boolean(data.session));setEmail(data.session?.user.email??"");setSessionReady(true)}).catch(()=>{if(alive)setSessionReady(true)});const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>{setSignedIn(Boolean(session));setEmail(session?.user.email??"");setSessionReady(true)});return()=>{alive=false;listener.subscription.unsubscribe()}},[]);
  async function signOut(){if(!supabase)return;await supabase.auth.signOut();setActiveModule("لوحة التحكم")}
  const t=messages[locale];
  if(!sessionReady)return <main className="loading-screen"><span className="brand-mark">B</span><p>{locale === "ar" ? "جارٍ تجهيز مساحتك الآمنة…" : "Preparing your secure workspace…"}</p></main>;
  if(!signedIn)return <main className="app-shell"><header className="topbar"><a className="brand" href="/" aria-label="BYE PRO FINANCE"><span className="brand-mark">B</span><span><strong>BYE PRO</strong><small>FINANCE</small></span></a><div className="topbar-actions"><PreferencesBar/></div></header><AuthPanel locale={locale}/><footer className="footer"><span>BYE PRO FINANCE</span><span>{locale === "ar" ? "الخصوصية أولاً" : "Privacy first"}</span></footer></main>;
  const active=modules.find(i=>i.title===activeModule)??modules[0];
  return <main className="workspace"><aside className="sidebar"><a className="brand" href="/" aria-label="BYE PRO FINANCE"><span className="brand-mark">B</span><span><strong>BYE PRO</strong><small>FINANCE</small></span></a><p className="nav-caption">{t.workspace}</p><nav className="main-nav" aria-label={t.workspace}>{modules.map(item=><button type="button" key={item.number} className={activeModule===item.title?"nav-item active":"nav-item"} onClick={()=>setActiveModule(item.title)}><span className="nav-icon">{item.icon}</span><span>{locale === "en" ? englishTitles[item.title] : item.title}</span><small>{item.number}</small></button>)}</nav><div className="sidebar-bottom"><span className="status-dot"/><span>{locale === "ar" ? "جلسة دخول نشطة" : "Active session"}</span><button type="button" className="text-button" onClick={signOut}>{t.logout}</button></div></aside><section className="workspace-main"><header className="workspace-topbar"><div><p className="eyebrow">{locale === "ar" ? "مساحتك المالية" : "Your financial workspace"} · {active.number}</p><h1>{locale === "en" ? englishTitles[active.title] : active.title}</h1></div><div className="workspace-actions"><PreferencesBar/><div className="user-chip"><span className="avatar">{email.slice(0,1).toUpperCase()||"U"}</span><span dir="ltr">{email}</span></div></div></header><SectionContent activeModule={activeModule}/><footer className="footer"><span>BYE PRO FINANCE</span><span>{locale === "ar" ? `بياناتك المالية خاصة بك · ${modules.length} وحدات` : `Your financial data is private · ${modules.length} modules`}</span></footer></section></main>;
}
