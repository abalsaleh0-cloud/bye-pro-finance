import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Row = Record<string, any> & { id: string };

const money = (value: number, currency = "LYD") => {
  try { return new Intl.NumberFormat("ar", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0); }
  catch { return `${Number(value || 0).toLocaleString("ar")} ${currency}`; }
};
const dateLabel = (value: any) => value ? new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(new Date(String(value))) : "—";
const typeLabel: Record<string, string> = { income: "دخل", expense: "مصروف", transfer: "تحويل", adjustment: "تسوية" };

export function ReportsView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [budgets, setBudgets] = useState<Row[]>([]);
  const [debts, setDebts] = useState<Row[]>([]);
  const [savings, setSavings] = useState<Row[]>([]);
  const [assets, setAssets] = useState<Row[]>([]);

  const load = useCallback(async () => {
    if (!supabase) { setError("إعداد اتصال Supabase غير مكتمل."); setLoading(false); return; }
    setLoading(true); setError("");
    const db = supabase as any;
    const results = await Promise.all([
      db.from("transactions").select("*").order("transaction_date", { ascending: false }),
      db.from("accounts").select("*").order("created_at", { ascending: false }),
      db.from("budgets").select("*").eq("is_active", true),
      db.from("debts").select("*"),
      db.from("savings_goals").select("*"),
      db.from("assets").select("*")
    ]);
    const failed = results.find((r: any) => r.error);
    if (failed?.error) setError(failed.error.message);
    else {
      setTransactions(results[0].data ?? []); setAccounts(results[1].data ?? []); setBudgets(results[2].data ?? []);
      setDebts(results[3].data ?? []); setSavings(results[4].data ?? []); setAssets(results[5].data ?? []);
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => {
    const income = transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount || 0), 0);
    const expense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount || 0), 0);
    const balances = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
    const receivable = debts.filter(d => d.type === "owed_to_me" && !d.is_settled).reduce((s, d) => s + Number(d.remaining_amount || 0), 0);
    const payable = debts.filter(d => d.type === "i_owe" && !d.is_settled).reduce((s, d) => s + Number(d.remaining_amount || 0), 0);
    const saved = savings.reduce((s, g) => s + Number(g.current_amount || 0), 0);
    const target = savings.reduce((s, g) => s + Number(g.target_amount || 0), 0);
    const assetsValue = assets.reduce((s, a) => s + Number(a.estimated_value || 0), 0);
    return { income, expense, net: income - expense, balances, receivable, payable, saved, target, assetsValue };
  }, [transactions, accounts, debts, savings, assets]);

  const topExpenses = useMemo(() => {
    const map = new Map<string, number>();
    transactions.filter(t => t.type === "expense").forEach(t => map.set(String(t.description || "مصروف غير مصنف"), (map.get(String(t.description || "مصروف غير مصنف")) || 0) + Number(t.amount || 0)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [transactions]);

  if (loading) return <div className="empty-state">جارٍ تجهيز التقرير المالي…</div>;
  return <section className="data-view">
    <div className="data-view-heading"><div><p className="eyebrow">التحليل المالي</p><h2>التقارير</h2><p className="muted-copy">صورة موحدة مبنية مباشرة من بيانات حسابك في Supabase.</p></div><button type="button" className="primary-button compact-button" onClick={() => void load()}>تحديث</button></div>
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="stats-grid">
      <article className="stat-card"><span>الأرصدة الحالية</span><strong>{money(summary.balances)}</strong><small>{accounts.length} حساب</small></article>
      <article className="stat-card"><span>صافي التدفق</span><strong>{money(summary.net)}</strong><small>دخل − مصروف</small></article>
      <article className="stat-card"><span>لك عند الآخرين</span><strong>{money(summary.receivable)}</strong><small>ديون غير مسددة</small></article>
      <article className="stat-card"><span>عليك للآخرين</span><strong>{money(summary.payable)}</strong><small>التزامات غير مسددة</small></article>
    </div>
    <div className="dashboard-grid">
      <article className="panel-card"><div className="panel-head"><div><p className="eyebrow">التدفق</p><h3>الدخل والمصروفات</h3></div></div><div className="report-lines"><div><span>إجمالي الدخل</span><strong>{money(summary.income)}</strong></div><div><span>إجمالي المصروفات</span><strong>{money(summary.expense)}</strong></div><div><span>الصافي</span><strong>{money(summary.net)}</strong></div></div></article>
      <article className="panel-card"><div className="panel-head"><div><p className="eyebrow">صافي الملكية</p><h3>الأصول والادخار</h3></div></div><div className="report-lines"><div><span>قيمة الأصول</span><strong>{money(summary.assetsValue)}</strong></div><div><span>المدخر حاليًا</span><strong>{money(summary.saved)}</strong></div><div><span>أهداف الادخار</span><strong>{money(summary.target)}</strong></div></div></article>
    </div>
    <article className="panel-card"><div className="panel-head"><div><p className="eyebrow">المصروفات</p><h3>أعلى البنود</h3></div></div>{topExpenses.length ? <div className="report-list">{topExpenses.map(([name, value]) => <div className="report-row" key={name}><span>{name}</span><strong>{money(value)}</strong></div>)}</div> : <div className="empty-state">لا توجد مصروفات مسجلة بعد.</div>}</article>
    <article className="panel-card"><div className="panel-head"><div><p className="eyebrow">آخر النشاط</p><h3>آخر المعاملات</h3></div></div>{transactions.slice(0, 10).length ? <div className="report-list">{transactions.slice(0, 10).map(t => <div className="report-row" key={t.id}><span>{t.description || "معاملة"}<small>{dateLabel(t.transaction_date)} · {typeLabel[t.type] || t.type}</small></span><strong>{money(Number(t.amount || 0), t.currency_code || "LYD")}</strong></div>)}</div> : <div className="empty-state">لا توجد معاملات بعد.</div>}</article>
  </section>;
}

export function DocumentsView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const result = await (supabase as any).from("documents").select("*").order("created_at", { ascending: false });
    if (result.error) setError(result.error.message); else setRows(result.data ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function upload(file: File) {
    if (!supabase) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError("انتهت جلسة الدخول."); return; }
    setBusy(true); setError(""); setNotice("");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-\u0600-\u06FF]/g, "_");
    const path = `${auth.user.id}/${crypto.randomUUID()}-${safeName}`;
    const storage = supabase.storage.from("finance-documents");
    const uploaded = await storage.upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (uploaded.error) { setError(uploaded.error.message); setBusy(false); return; }
    const type = file.type.includes("pdf") ? "invoice" : "other";
    const result = await (supabase as any).from("documents").insert({ user_id: auth.user.id, file_name: file.name, file_size: file.size, mime_type: file.type || null, storage_path: path, document_type: type, metadata: {} });
    if (result.error) { await storage.remove([path]); setError(result.error.message); }
    else { setNotice("تم رفع المستند وحفظه بأمان."); await load(); }
    setBusy(false);
  }
  async function remove(row: Row) {
    if (!supabase || !window.confirm("حذف المستند نهائيًا؟")) return;
    const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return;
    const storage = supabase.storage.from("finance-documents");
    const removed = await storage.remove([row.storage_path]);
    if (removed.error) { setError(removed.error.message); return; }
    const result = await (supabase as any).from("documents").delete().eq("id", row.id).eq("user_id", auth.user.id);
    if (result.error) setError(result.error.message); else { setNotice("تم حذف المستند."); await load(); }
  }
  async function open(row: Row) {
    if (!supabase) return;
    const result = await supabase.storage.from("finance-documents").createSignedUrl(row.storage_path, 300);
    if (result.error) setError(result.error.message); else if (result.data?.signedUrl) window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return <section className="data-view"><div className="data-view-heading"><div><p className="eyebrow">الأرشيف المالي</p><h2>المستندات</h2><p className="muted-copy">رفع وفتح وحذف المستندات من التخزين الخاص بحسابك.</p></div><label className="primary-button compact-button" style={{ cursor: busy ? "wait" : "pointer" }}>{busy ? "جارٍ الرفع…" : "+ رفع مستند"}<input hidden type="file" disabled={busy} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv" onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); e.currentTarget.value = ""; }} /></label></div>
    {error && <p className="notice error" role="alert">{error}</p>}{notice && <p className="notice success" role="status">{notice}</p>}
    {loading ? <div className="empty-state">جارٍ تحميل الأرشيف…</div> : rows.length === 0 ? <div className="empty-state"><span className="empty-icon">▧</span><h3>لا توجد مستندات</h3><p>ارفع أول إيصال أو فاتورة أو كشف حساب.</p></div> : <div className="report-list">{rows.map(row => <div className="report-row" key={row.id}><span><strong>{row.file_name}</strong><small>{row.mime_type || "ملف"} · {dateLabel(row.created_at)}</small></span><span style={{ display: "flex", gap: "8px" }}><button type="button" className="text-button" onClick={() => void open(row)}>فتح</button><button type="button" className="text-button" onClick={() => void remove(row)}>حذف</button></span></div>)}</div>}
  </section>;
}

export function NotificationsView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const result = await (supabase as any).from("notifications").select("*").order("created_at", { ascending: false });
    if (result.error) setError(result.error.message); else setRows(result.data ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function mark(id: string, read = true) { if (!supabase) return; const result = await (supabase as any).from("notifications").update({ is_read: read }).eq("id", id); if (result.error) setError(result.error.message); else await load(); }
  async function markAll() { if (!supabase) return; const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return; const result = await (supabase as any).from("notifications").update({ is_read: true }).eq("user_id", auth.user.id).eq("is_read", false); if (result.error) setError(result.error.message); else await load(); }
  const unread = rows.filter(r => !r.is_read).length;
  return <section className="data-view"><div className="data-view-heading"><div><p className="eyebrow">التنبيهات</p><h2>الإشعارات <small>({unread} غير مقروء)</small></h2><p className="muted-copy">تنبيهات الحساب والفواتير والميزانيات في مكان واحد.</p></div>{unread > 0 && <button type="button" className="primary-button compact-button" onClick={() => void markAll()}>تحديد الكل كمقروء</button>}</div>
    {error && <p className="notice error" role="alert">{error}</p>}{loading ? <div className="empty-state">جارٍ تحميل الإشعارات…</div> : rows.length === 0 ? <div className="empty-state"><span className="empty-icon">◉</span><h3>لا توجد إشعارات</h3><p>ستظهر التنبيهات هنا عند توفرها.</p></div> : <div className="report-list">{rows.map(row => <div className={row.is_read ? "report-row" : "report-row notification-unread"} key={row.id}><span><strong>{row.title}</strong><small>{row.body || "بدون تفاصيل"} · {dateLabel(row.created_at)}</small></span><button type="button" className="text-button" onClick={() => void mark(row.id, !row.is_read)}>{row.is_read ? "تحديد كغير مقروء" : "تحديد كمقروء"}</button></div>)}</div>}
  </section>;
}
