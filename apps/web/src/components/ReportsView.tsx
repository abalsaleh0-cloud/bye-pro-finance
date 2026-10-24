import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Row = Record<string, any> & { id: string };

type CurrencyTotals = Record<string, number>;

const money = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat(typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "ar", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0);
  } catch {
    return `${Number(value || 0).toLocaleString(typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "ar")} ${currency}`;
  }
};

const dateLabel = (value: unknown) => value ? new Intl.DateTimeFormat(typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "ar", { dateStyle: "medium" }).format(new Date(String(value))) : "—";
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
  const en = typeof document !== "undefined" && document.documentElement.lang === "en";
  const tr = (ar: string, english: string) => en ? english : ar;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [debts, setDebts] = useState<Row[]>([]);
  const [savings, setSavings] = useState<Row[]>([]);
  const [assets, setAssets] = useState<Row[]>([]);

  const load = useCallback(async () => {
    if (!supabase) { setError(tr("إعداد اتصال Supabase غير مكتمل.","Supabase connection is not configured.")); setLoading(false); return; }
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

  if (loading) return <div className="empty-state">{tr("جارٍ تجهيز التقرير المالي…","Preparing financial report…")}</div>;

  return <section className="data-view">
    <div className="data-view-heading"><div><p className="eyebrow">{tr("التحليل المالي","Financial analysis")}</p><h2>{tr("التقارير","Reports")}</h2><p className="muted-copy">{tr("الأرقام مفصولة حسب العملة حتى لا يتم جمع عملات مختلفة في رقم واحد.","Amounts are separated by currency to avoid combining unlike currencies.")}</p></div><button type="button" className="primary-button compact-button" onClick={() => void load()}>{tr("تحديث", "Refresh")}</button></div>
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="stats-grid">
      <article className="stat-card"><span>{tr("الأرصدة الحالية","Current balances")}</span><CurrencyList values={summary.balances}/><small>{accounts.length} {tr("حساب","accounts")}</small></article>
      <article className="stat-card"><span>{tr("الدخل","Income")}</span><CurrencyList values={summary.income}/><small>{tr("المعاملات المكتملة فقط","Completed transactions only")}</small></article>
      <article className="stat-card"><span>{tr("المصروفات","Expenses")}</span><CurrencyList values={summary.expense}/><small>{tr("المعاملات المكتملة فقط","Completed transactions only")}</small></article>
      <article className="stat-card"><span>{tr("لك / عليك","Receivables / Payables")}</span><div className="report-dual"><span>{tr("لك:","Owed to you:")} <CurrencyList values={summary.receivable}/></span><span>{tr("عليك:","You owe:")} <CurrencyList values={summary.payable}/></span></div></article>
    </div>
    <div className="dashboard-grid">
      <article className="panel-card"><div className="panel-head"><div><p className="eyebrow">{tr("التدفق","Cash flow")}</p><h3>{tr("الدخل والمصروفات حسب العملة","Income and expenses by currency")}</h3></div></div><div className="report-lines"><div><span>{tr("إجمالي الدخل","Total income")}</span><CurrencyList values={summary.income}/></div><div><span>{tr("إجمالي المصروفات","Total expenses")}</span><CurrencyList values={summary.expense}/></div></div></article>
      <article className="panel-card"><div className="panel-head"><div><p className="eyebrow">{tr("صافي الملكية","Net worth")}</p><h3>{tr("الأصول والادخار حسب العملة","Assets and savings by currency")}</h3></div></div><div className="report-lines"><div><span>{tr("قيمة الأصول","Asset value")}</span><CurrencyList values={summary.assetsValue}/></div><div><span>{tr("المدخر حاليًا","Current savings")}</span><CurrencyList values={summary.saved}/></div><div><span>{tr("أهداف الادخار","Savings goals")}</span><CurrencyList values={summary.target}/></div></div></article>
    </div>
    <article className="panel-card"><div className="panel-head"><div><p className="eyebrow">{tr("المصروفات","Expenses")}</p><h3>{tr("أعلى البنود","Top categories")}</h3></div></div>{topExpenses.length ? <div className="report-list">{topExpenses.map(([name, values]) => <div className="report-row" key={name}><span>{name}</span><CurrencyList values={values}/></div>)}</div> : <div className="empty-state">{tr("لا توجد مصروفات مسجلة بعد.","No expenses recorded yet.")}</div>}</article>
    <article className="panel-card"><div className="panel-head"><div><p className="eyebrow">{tr("آخر النشاط","Recent activity")}</p><h3>{tr("آخر المعاملات","Recent transactions")}</h3></div></div>{transactions.slice(0, 10).length ? <div className="report-list">{transactions.slice(0, 10).map(t => <div className="report-row" key={t.id}><span>{t.description || tr("معاملة","Transaction")}<small>{dateLabel(t.transaction_date)} · {(en ? ({income:"Income",expense:"Expense",transfer:"Transfer",adjustment:"Adjustment"} as Record<string,string>)[t.type] : typeLabel[t.type]) || t.type}</small></span><strong dir="ltr">{money(Number(t.amount || 0), String(t.currency_code || "LYD"))}</strong></div>)}</div> : <div className="empty-state">{tr("لا توجد معاملات بعد.","No transactions yet.")}</div>}</article>
  </section>;
}
