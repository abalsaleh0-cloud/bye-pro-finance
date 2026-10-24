import "./advanced-finance.css";
import { useEffect, useState, type FormEvent } from "react";
import { applyLocale, getStoredLocale, getStoredTheme, setStoredLocale, setStoredTheme, type Locale, type Theme } from "./i18n";
import { Icon, type IconName } from "../../../packages/ui/src";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import AccountsView from "./components/AccountsView";
import TransactionsView from "./components/TransactionsView";
import DashboardView from "./components/DashboardView";
import { CollectionView } from "./components/FinanceViews";
import ReportsView from "./components/ReportsView";
import { DocumentsView, NotificationsView } from "./components/AdvancedFinanceViews";
import { AdminView, AssistantView, HouseholdView, ImportExportView, SettingsView, SmartScanView, TransfersView } from "./components/PlatformViews";

type ActiveModule = "لوحة التحكم" | "الحسابات" | "المعاملات" | "التحويلات" | "الميزانيات" | "الديون" | "الفواتير" | "الادخار" | "الأصول" | "التقارير" | "المنزل" | "المستندات" | "المسح الذكي" | "المساعد المالي" | "الإشعارات" | "استيراد وتصدير" | "الإعدادات" | "الإدارة";
const moduleTitles: Record<Locale, Record<ActiveModule, string>> = {
  ar: { "لوحة التحكم":"لوحة التحكم", "الحسابات":"الحسابات", "المعاملات":"المعاملات", "التحويلات":"التحويلات", "الميزانيات":"الميزانيات", "الديون":"الديون", "الفواتير":"الفواتير", "الادخار":"الادخار", "الأصول":"الأصول", "التقارير":"التقارير", "المنزل":"المنزل", "المستندات":"المستندات", "المسح الذكي":"المسح الذكي", "المساعد المالي":"المساعد المالي", "الإشعارات":"الإشعارات", "استيراد وتصدير":"استيراد وتصدير", "الإعدادات":"الإعدادات", "الإدارة":"الإدارة" },
  en: { "لوحة التحكم":"Dashboard", "الحسابات":"Accounts", "المعاملات":"Transactions", "التحويلات":"Transfers", "الميزانيات":"Budgets", "الديون":"Debts", "الفواتير":"Bills", "الادخار":"Savings", "الأصول":"Assets", "التقارير":"Reports", "المنزل":"Household", "المستندات":"Documents", "المسح الذكي":"Smart Scan", "المساعد المالي":"Financial Assistant", "الإشعارات":"Notifications", "استيراد وتصدير":"Import / Export", "الإعدادات":"Settings", "الإدارة":"Administration" }
};
const modules: { title: ActiveModule; description: string; number: string; icon: IconName }[] = [
  { title: "لوحة التحكم", description: "نظرة عامة على وضعك المالي", number: "00", icon: "layout-dashboard" },
  { title: "الحسابات", description: "الحسابات والأرصدة", number: "01", icon: "wallet" },
  { title: "المعاملات", description: "الدخل والمصروفات", number: "02", icon: "arrow-left-right" },
  { title: "التحويلات", description: "نقل الأموال بين الحسابات", number: "03", icon: "repeat-2" },
  { title: "الميزانيات", description: "خطط الإنفاق", number: "04", icon: "pie-chart" },
  { title: "الديون", description: "المستحقات والالتزامات", number: "05", icon: "hand-coins" },
  { title: "الفواتير", description: "المدفوعات والاستحقاقات", number: "06", icon: "calendar-days" },
  { title: "الادخار", description: "الأهداف والتقدم", number: "07", icon: "trending-up" },
  { title: "الأصول", description: "الأصول وصافي الثروة", number: "08", icon: "credit-card" },
  { title: "التقارير", description: "التحليلات المالية", number: "09", icon: "activity" },
  { title: "المنزل", description: "مصروفات الأسرة", number: "10", icon: "home" },
  { title: "المستندات", description: "الأرشيف المالي", number: "11", icon: "folder" },
  { title: "المسح الذكي", description: "OCR واستخراج البيانات", number: "12", icon: "search" },
  { title: "المساعد المالي", description: "التحليل والمساعدة الذكية", number: "13", icon: "sparkles" },
  { title: "الإشعارات", description: "التنبيهات المالية", number: "14", icon: "bell" },
  { title: "استيراد وتصدير", description: "نقل بياناتك", number: "15", icon: "refresh-cw" },
  { title: "الإعدادات", description: "تفضيلات الحساب", number: "16", icon: "settings" },
  { title: "الإدارة", description: "مراقبة وإدارة النظام", number: "17", icon: "shield-check" },
];

type AuthMode = "signin" | "signup" | "reset";
const localeText = (ar: string, en: string) => getStoredLocale() === "en" ? en : ar;
function AuthPanel() {
  const [mode,setMode]=useState<AuthMode>("signin"),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  async function handleSubmit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");setNotice("");if(!supabase){setError(localeText("الاتصال بقاعدة البيانات غير مُعد بعد.","Database connection is not configured yet."));return}setBusy(true);try{if(mode==="signin"){const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)throw error}else if(mode==="signup"){const {data,error}=await supabase.auth.signUp({email:email.trim(),password});if(error)throw error;if(!data.session)setNotice(localeText("تم إرسال رسالة تأكيد إلى بريدك الإلكتروني.","A confirmation email has been sent."))}else{const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin});if(error)throw error;setNotice(localeText("إذا كان البريد مسجلًا، ستصلك تعليمات الاستعادة.","If the email is registered, recovery instructions will be sent."))}}catch(cause){setError(cause instanceof Error?cause.message:localeText("تعذر إكمال الطلب.","Unable to complete the request."))}finally{setBusy(false)}}
  const title=mode==="signin"?localeText("تسجيل الدخول","Sign in"):mode==="signup"?localeText("إنشاء حساب","Create account"):localeText("استعادة كلمة المرور","Reset password");
  return <section className="auth-layout"><div className="auth-intro"><p className="eyebrow">{localeText("خصوصيتك أساس التصميم","PRIVACY BY DESIGN")}</p><h1>{localeText("أموالك،","Your money,")} <span>{localeText("بصورة أوضح.","made clearer.")}</span></h1><p className="hero-copy">{localeText("نظام مالي شخصي لتنظيم الحسابات والمعاملات والميزانيات والأهداف ضمن مساحة محمية بحسابك.","A personal finance workspace to organize accounts, transactions, budgets, and goals in a space protected by your account.")}</p></div><div className="auth-card"><div className="auth-card-head"><span className="brand-mark">B</span><div><h2>{title}</h2><p>{localeText("مساحتك المالية الخاصة.","Your private finance space.")}</p></div></div>{!isSupabaseConfigured&&<div className="notice warning">{localeText("اضبط VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY.","Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.")}</div>}<form onSubmit={handleSubmit} className="auth-form"><label htmlFor="auth-email">{localeText("البريد الإلكتروني","Email address")}</label><input id="auth-email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} dir="ltr"/>{mode!=="reset"&&<><label htmlFor="auth-password">{localeText("كلمة المرور","Password")}</label><input id="auth-password" type="password" autoComplete={mode==="signup"?"new-password":"current-password"} required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} dir="ltr"/> </>}{error&&<p className="notice error">{error}</p>}{notice&&<p className="notice success">{notice}</p>}<button className="primary-button" type="submit" disabled={busy||!isSupabaseConfigured}>{busy?localeText("جارٍ التنفيذ…","Working…"):title}</button></form><div className="auth-links">{mode==="signin"?<><button type="button" onClick={()=>setMode("reset")}>{localeText("نسيت كلمة المرور؟","Forgot password?")}</button><button type="button" onClick={()=>setMode("signup")}>{localeText("إنشاء حساب","Create account")}</button></>:<button type="button" onClick={()=>setMode("signin")}>{localeText("العودة للدخول","Back to sign in")}</button>}</div></div></section>;
}

function SectionContent({activeModule}:{activeModule:ActiveModule}) {
  if(activeModule==="لوحة التحكم")return <DashboardView/>;
  if(activeModule==="الحسابات")return <AccountsView/>;
  if(activeModule==="المعاملات")return <TransactionsView/>;
  if(activeModule==="التحويلات")return <TransfersView/>;
  if(activeModule==="التقارير")return <ReportsView/>;
  if(activeModule==="المنزل")return <HouseholdView/>;
  if(activeModule==="المستندات")return <DocumentsView/>;
  if(activeModule==="المسح الذكي")return <SmartScanView/>;
  if(activeModule==="المساعد المالي")return <AssistantView/>;
  if(activeModule==="الإشعارات")return <NotificationsView/>;
  if(activeModule==="استيراد وتصدير")return <ImportExportView/>;
  if(activeModule==="الإعدادات")return <SettingsView/>;
  if(activeModule==="الإدارة")return <AdminView/>;
  const map:Record<string,"budgets"|"debts"|"bills"|"savings_goals"|"assets">={"الميزانيات":"budgets","الديون":"debts","الفواتير":"bills","الادخار":"savings_goals","الأصول":"assets"};
  return <CollectionView module={map[activeModule]}/>;
}

export default function App(){
  const [locale, setLocale] = useState<Locale>(() => getStoredLocale());
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
  const [sessionReady,setSessionReady]=useState(!isSupabaseConfigured),[signedIn,setSignedIn]=useState(false),[email,setEmail]=useState(""),[activeModule,setActiveModule]=useState<ActiveModule>("لوحة التحكم");
  useEffect(() => { applyLocale(locale); setStoredLocale(locale); }, [locale]);
  useEffect(() => { applyLocale(locale, theme); setStoredTheme(theme); }, [theme, locale]);
  useEffect(()=>{if(!supabase)return;let alive=true;supabase.auth.getSession().then(({data})=>{if(!alive)return;setSignedIn(Boolean(data.session));setEmail(data.session?.user.email??"");setSessionReady(true)}).catch(()=>{if(alive)setSessionReady(true)});const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>{setSignedIn(Boolean(session));setEmail(session?.user.email??"");setSessionReady(true)});return()=>{alive=false;listener.subscription.unsubscribe()}},[]);
  async function signOut(){if(!supabase)return;await supabase.auth.signOut();setActiveModule("لوحة التحكم")}
  if(!sessionReady)return <main className="loading-screen"><span className="brand-mark">B</span><p>{localeText("جارٍ تجهيز مساحتك الآمنة…","Preparing your secure workspace…")}</p></main>;
  if(!signedIn)return <main className="app-shell"><header className="topbar"><a className="brand" href="/" aria-label="BYE PRO FINANCE"><span className="brand-mark">B</span><span><strong>BYE PRO</strong><small>FINANCE</small></span></a><div className="appearance-controls"><button type="button" className="appearance-button" onClick={() => setLocale(locale === "ar" ? "en" : "ar")} aria-label={locale === "ar" ? "Switch to English" : "التبديل إلى العربية"}>{locale === "ar" ? "EN" : "عربي"}</button><button type="button" className="appearance-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? (locale === "ar" ? "الوضع الفاتح" : "Light mode") : (locale === "ar" ? "الوضع الداكن" : "Dark mode")}>{theme === "dark" ? "☼" : "☾"}</button><span className="private-label"><span className="status-dot"/> {locale === "ar" ? "مساحة مالية خاصة" : "Private finance space"}</span></div></header><AuthPanel/><footer className="footer"><span>BYE PRO FINANCE</span><span>{localeText("الخصوصية أولاً","Privacy first")}</span></footer></main>;
  const active=modules.find(i=>i.title===activeModule)??modules[0];
  return <main className="workspace" data-locale={locale} data-theme={theme}><aside className="sidebar"><a className="brand" href="/" aria-label="BYE PRO FINANCE"><span className="brand-mark">B</span><span><strong>BYE PRO</strong><small>FINANCE</small></span></a><p className="nav-caption">{locale === "ar" ? "مساحة العمل" : "Workspace"}</p><nav className="main-nav" aria-label="الأقسام الرئيسية">{modules.map(item=><button type="button" key={item.number} className={activeModule===item.title?"nav-item active":"nav-item"} onClick={()=>setActiveModule(item.title)}><span className="nav-icon"><Icon name={item.icon} size={18} /></span><span>{moduleTitles[locale][item.title]}</span><small>{item.number}</small></button>)}</nav><div className="sidebar-bottom"><span className="status-dot"/><span>{locale === "ar" ? "جلسة دخول نشطة" : "Active session"}</span><button type="button" className="text-button" onClick={signOut}>{locale === "ar" ? "تسجيل الخروج" : "Sign out"}</button></div></aside><section className="workspace-main"><header className="workspace-topbar"><div><p className="eyebrow">{locale === "ar" ? "مساحتك المالية" : "Your finance space"} · {active.number}</p><h1>{moduleTitles[locale][active.title]}</h1></div><div className="workspace-appearance"><button type="button" className="appearance-button" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}>{locale === "ar" ? "EN" : "عربي"}</button><button type="button" className="appearance-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "☼" : "☾"}</button><div className="user-chip"><span className="avatar">{email.slice(0,1).toUpperCase()||"U"}</span><span dir="ltr">{email}</span></div></div></header><SectionContent activeModule={activeModule}/><footer className="footer"><span>BYE PRO FINANCE</span><span>{locale === "ar" ? `بياناتك المالية خاصة بك · ${modules.length} وحدات` : `Your financial data is private · ${modules.length} modules`}</span></footer></section></main>;
}
