import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Row = Record<string, any> & { id: string };

type CurrencyTotals = Record<string, number>;

const money = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat("ar", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0);
  } catch {
    return `${Number(value || 0).toLocaleString("ar")} ${currency}`;
  }
};

const dateLabel = (value: unknown) => value ? new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(new Date(String(value))) : "—";
const typeLabel: Record<string, string> = { income: "دخل", expense: "مصروف", transfer: "تحويل", adjustment: "تسوية" };

function addByCurrency(target: CurrencyTotals, currency: unknown, value: unknown) {
  const code = String(currency || "LYD").toUpperCase();
  const amount = Number(value || 0);
  if (Number.isFinite(amount)) target[code] = (target[code] || 0) + amount;
}

function CurrencyList({ values }: { values: CurrencyTotals }) {
  const entries = Object.entries(values);
  if (!entries.length) return <span>—</span>;
  return <span className="report-currency-list">{entries.map(([currency, value]) => <strong key={currency} dir="ltr">{money(value, currency)}</strong>)}</span>;
}

export default function ReportsView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
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
      db.from("debts").select("*"),
      db.from("savings_goals").select("*"),
      db.from("assets").select("*")
    ]);
    const failed = results.find((result: any) => result.error);
    if (failed?.error) setError(failed.error.message);
    else {
      setTransactions(results[0].data ?? []);
      setAccounts(results[1].data ?? []);
      setDebts(results[2].data ?? []);
      setSavings(results[3].data ?? []);
      setAssets(results[4].data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => {
    const income: CurrencyTotals = {}, expense: CurrencyTotals = {}, balances: CurrencyTotals = {};
    const receivable: CurrencyTotals = {}, payable: CurrencyTotals = {}, saved: CurrencyTotals = {}, target: CurrencyTotals = {}, assetsValue: CurrencyTotals = {};
    transactions.filter(t => t.status !== "cancelled" && t.type === "income").forEach(t => addByCurrency(income, t.currency_code, t.amount));
    transactions.filter(t => t.status !== "cancelled" && t.type === "expense").forEach(t => addByCurrency(expense, t.currency_code, t.amount));
    accounts.filter(a => a.is_active !== false).forEach(a => addByCurrency(balances, a.currency_code, a.current_balance));
    debts.filter(d => d.type === "owed_to_me" && !d.is_settled).forEach(d => addByCurrency(receivable, d.currency_code, d.remaining_amount));
    debts.filter(d => d.type === "i_owe" && !d.is_settled).forEach(d => addByCurrency(payable, d.currency_code, d.remaining_amount));
    savings.forEach(g => { addByCurrency(saved, g.currency_code, g.current_amount); addByCurrency(target, g.currency_code, g.target_amount); });
    assets.forEach(a => addByCurrency(assetsValue, a.currency_code, a.estimated_value));
    return { income, expense, balances, receivable, payable, saved, target, assetsValue };
  }, [transactions, accounts, debts, savings, assets]);

  const topExpenses = useMemo(() => {
    const map = new Map<string, CurrencyTotals>();
    transactions.filter(t => t.status !== "cancelled" && t.type === "expense").forEach(t => {
      const name = String(t.description || "مصروف غير مصنف");
      const current = map.get(name) || {};
      addByCurrency(current, t.currency_code, t.amount);
      map.set(name, current);
    });
    return [...map.entries()].slice(0, 8);
  }, [transactions]);

  if (loading) return <div className="empty-state">جارٍ تجهيز التقرير المالي…</div>;

  return <section className="data-view">
    <div className="data-view-heading"><div><p className="eyebrow">التحليل المالي</p><h2>التقارير</h2><p className="muted-copy">الأرقام مفصولة حسب العملة حتى لا يتم جمع عملات مختلفة في رقم واحد.</p></div><button type="button" className="primary-button compact-button" onClick={() => void load()}>تحديث</button></div>
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="stats-grid">
      <article className="stat-card"><span>الأرصدة الحالية</span><CurrencyList values={summary.balances}/><small>{accounts.length} حساب</small></article>
      <article className="stat-card"><span>الدخل</span><CurrencyList values={summary.income}/><small>المعاملات المكتملة فقط</small></article>
      <article className="stat-card"><span>المصروفات</span><CurrencyList values={summary.expense}/><small>المعاملات المكتملة فقط</small></article>
      <article className="stat-card"><span>لك / عليك</span><div className="report-dual"><span>لك: <CurrencyList values={summary.receivable}/></span><span>عليك: <CurrencyList values={summary.payable}/></span></div></article>
    </div>
    <div className="dashboard-grid">
      <article className="panel-card"><div className="panel-head"><div><p className="eyebrow">التدفق</p><h3>الدخل والمصروفات حسب العملة</h3></div></div><div className="report-lines"><div><span>إجمالي الدخل</span><CurrencyList values={summary.income}/></div><div><span>إجمالي المصروفات</span><CurrencyList values={summary.expense}/></div></div></article>
      <article className="panel-card"><div className="panel-head"><div><p className="eyebrow">صافي الملكية</p><h3>الأصول والادخار حسب العملة</h3></div></div><div className="report-lines"><div><span>قيمة الأصول</span><CurrencyList values={summary.assetsValue}/></div><div><span>المدخر حاليًا</span><CurrencyList values={summary.saved}/></div><div><span>أهداف الادخار</span><CurrencyList values={summary.target}/></div></div></article>
    </div>
    <article className="panel-card"><div className="panel-head"><div><p className="eyebrow">المصروفات</p><h3>أعلى البنود</h3></div></div>{topExpenses.length ? <div className="report-list">{topExpenses.map(([name, values]) => <div className="report-row" key={name}><span>{name}</span><CurrencyList values={values}/></div>)}</div> : <div className="empty-state">لا توجد مصروفات مسجلة بعد.</div>}</article>
    <article className="panel-card"><div className="panel-head"><div><p className="eyebrow">آخر النشاط</p><h3>آخر المعاملات</h3></div></div>{transactions.slice(0, 10).length ? <div className="report-list">{transactions.slice(0, 10).map(t => <div className="report-row" key={t.id}><span>{t.description || "معاملة"}<small>{dateLabel(t.transaction_date)} · {typeLabel[t.type] || t.type}</small></span><strong dir="ltr">{money(Number(t.amount || 0), String(t.currency_code || "LYD"))}</strong></div>)}</div> : <div className="empty-state">لا توجد معاملات بعد.</div>}</article>
  </section>;
}
