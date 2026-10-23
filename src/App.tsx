import { isSupabaseConfigured } from "./lib/supabase";

const modules = [
  ["الحسابات", "إدارة الحسابات والأرصدة", "01"],
  ["المعاملات", "الدخل والمصروفات والتحويلات", "02"],
  ["الميزانيات", "خطط الإنفاق ومتابعتها", "03"],
  ["الديون", "المبالغ المستحقة والمدفوعة", "04"],
  ["الادخار", "الأهداف والتقدم المالي", "05"],
  ["التقارير", "ملخصات وتحليلات مالية", "06"],
] as const;

export default function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="BYE PRO FINANCE الصفحة الرئيسية">
          <span className="brand-mark">B</span>
          <span><strong>BYE PRO</strong><small>FINANCE</small></span>
        </a>
        <span className="private-label"><span className="status-dot" /> مساحة مالية خاصة</span>
      </header>

      <section className="hero">
        <p className="eyebrow">إدارتك المالية، بوضوح أكبر</p>
        <h1>أهلاً بك في <span>BYE PRO FINANCE</span></h1>
        <p className="hero-copy">مساحة واحدة لتنظيم حساباتك، متابعة معاملاتك، وبناء قرارات مالية أوضح.</p>
        <div className={isSupabaseConfigured ? "connection connected" : "connection"}>
          <span className="status-dot" />
          {isSupabaseConfigured ? "إعداد الاتصال موجود — يلزم اختبار المصادقة والقراءة" : "بانتظار إعداد مفاتيح Supabase المحلية"}
        </div>
      </section>

      <section className="section-heading">
        <div><p className="eyebrow">مساحة العمل</p><h2>الأقسام الرئيسية</h2></div>
        <span className="module-count">06 أقسام أساسية</span>
      </section>

      <section className="module-grid" aria-label="الأقسام الرئيسية">
        {modules.map(([title, description, number]) => (
          <article className="module-card" key={number}>
            <span className="module-number">{number}</span>
            <div><h3>{title}</h3><p>{description}</p></div>
            <span className="card-arrow" aria-hidden="true">↙</span>
          </article>
        ))}
      </section>

      <footer className="footer">
        <span>BYE PRO FINANCE</span>
        <span>الخصوصية أولاً · لا تُدخل بيانات حقيقية قبل اكتمال الاختبارات</span>
      </footer>
    </main>
  );
}
