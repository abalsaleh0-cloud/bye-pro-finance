import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Member = { id: string; name: string; role: string; monthly_contribution: number; is_active: boolean };
type Budget = { id: string; name: string; amount: number; currency_code: string; period: string; start_date: string; end_date: string | null; is_active: boolean };
type Expense = { id: string; member_id: string | null; category: string; description: string | null; amount: number; currency_code: string; expense_date: string; is_recurring: boolean; notes: string | null };

const roles = ["owner", "partner", "child", "parent", "family", "other"];
const categories = ["طعام", "كهرباء", "ماء", "إيجار", "غاز", "إنترنت", "تعليم", "صحة", "مواصلات", "تسوق", "عام"];
const tr = (en: boolean, ar: string, enText: string) => (en ? enText : ar);
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const monthEnd = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); };

export default function HouseholdView() {
  const en = typeof document !== "undefined" && document.documentElement.lang === "en";
  const [members, setMembers] = useState<Member[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currency, setCurrency] = useState("LYD");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [memberForm, setMemberForm] = useState({ name: "", role: "family", monthly_contribution: "" });
  const [budgetForm, setBudgetForm] = useState({ name: "", amount: "", currency_code: "LYD", period: "monthly" });
  const [expenseForm, setExpenseForm] = useState({ member_id: "", category: "عام", description: "", amount: "", currency_code: "LYD", expense_date: today(), is_recurring: false, notes: "" });

  const load = async () => {
    if (!supabase) return;
    setBusy(true); setError("");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setBusy(false); return; }
    const userId = userData.user.id;
    const [m, b, e, p] = await Promise.all([
      (supabase as any).from("household_members").select("id,name,role,monthly_contribution,is_active").eq("is_active", true).order("name"),
      (supabase as any).from("household_budgets").select("id,name,amount,currency_code,period,start_date,end_date,is_active").eq("is_active", true).order("created_at", { ascending: false }),
      (supabase as any).from("household_expenses").select("id,member_id,category,description,amount,currency_code,expense_date,is_recurring,notes").gte("expense_date", monthStart()).lte("expense_date", monthEnd()).order("expense_date", { ascending: false }),
      supabase.from("profiles").select("currency_code").eq("id", userId).maybeSingle(),
    ]);
    const firstError = m.error || b.error || e.error || p.error;
    if (firstError) setError(firstError.message);
    setMembers(m.data ?? []); setBudgets(b.data ?? []); setExpenses(e.data ?? []);
    const defaultCurrency = p.data?.currency_code || "LYD";
    setCurrency(defaultCurrency);
    setBudgetForm(v => ({ ...v, currency_code: v.currency_code || defaultCurrency }));
    setExpenseForm(v => ({ ...v, currency_code: v.currency_code || defaultCurrency }));
    setBusy(false);
  };

  useEffect(() => { void load(); }, []);

  const totalMonth = useMemo(() => expenses.reduce((sum, item) => sum + Number(item.amount), 0), [expenses]);
  const monthlyBudget = useMemo(() => budgets.filter(b => b.period === "monthly" && b.currency_code === currency).reduce((sum, b) => sum + Number(b.amount), 0), [budgets, currency]);
  const remaining = Math.max(monthlyBudget - totalMonth, 0);
  const progress = monthlyBudget > 0 ? Math.min((totalMonth / monthlyBudget) * 100, 100) : 0;
  const recurring = useMemo(() => expenses.filter(e => e.is_recurring).reduce((sum, item) => sum + Number(item.amount), 0), [expenses]);
  const memberName = (id: string | null) => members.find(m => m.id === id)?.name || tr(en, "الأسرة", "Household");
  const money = (value: number, code = currency) => `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${code}`;

  const addMember = async () => {
    if (!supabase) return;
    const name = memberForm.name.trim(); const contribution = Number(memberForm.monthly_contribution || 0);
    if (!name || !Number.isFinite(contribution) || contribution < 0) { setError(tr(en, "أدخل اسم فرد الأسرة ومساهمة صحيحة.", "Enter a household member and a valid contribution.")); return; }
    const { data: user } = await supabase.auth.getUser(); if (!user.user) return;
    setSaving(true); setError("");
    const { error: insertError } = await (supabase as any).from("household_members").insert({ user_id: user.user.id, name, role: memberForm.role, monthly_contribution: contribution });
    setSaving(false); if (insertError) setError(insertError.message); else { setMemberForm({ name: "", role: "family", monthly_contribution: "" }); setNotice(tr(en, "تمت إضافة فرد الأسرة.", "Household member added.")); await load(); }
  };

  const removeMember = async (id: string) => {
    if (!supabase) return;
    const { error: deleteError } = await (supabase as any).from("household_members").delete().eq("id", id);
    if (deleteError) setError(deleteError.message); else await load();
  };

  const addBudget = async () => {
    if (!supabase) return;
    const amount = Number(budgetForm.amount);
    if (!budgetForm.name.trim() || !Number.isFinite(amount) || amount <= 0) { setError(tr(en, "أدخل اسم وميزانية صحيحة.", "Enter a budget name and a valid amount.")); return; }
    const { data: user } = await supabase.auth.getUser(); if (!user.user) return;
    setSaving(true); setError("");
    const { error: insertError } = await (supabase as any).from("household_budgets").insert({ user_id: user.user.id, name: budgetForm.name.trim(), amount, currency_code: budgetForm.currency_code, period: budgetForm.period, start_date: today() });
    setSaving(false); if (insertError) setError(insertError.message); else { setBudgetForm({ name: "", amount: "", currency_code: currency, period: "monthly" }); setNotice(tr(en, "تمت إضافة ميزانية المنزل.", "Household budget added.")); await load(); }
  };

  const removeBudget = async (id: string) => {
    if (!supabase) return;
    const { error: deleteError } = await (supabase as any).from("household_budgets").delete().eq("id", id);
    if (deleteError) setError(deleteError.message); else await load();
  };

  const addExpense = async () => {
    if (!supabase) return;
    const amount = Number(expenseForm.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !expenseForm.expense_date) { setError(tr(en, "أدخل مبلغًا وتاريخًا صحيحين.", "Enter a valid amount and date.")); return; }
    const { data: user } = await supabase.auth.getUser(); if (!user.user) return;
    setSaving(true); setError("");
    const { error: insertError } = await (supabase as any).from("household_expenses").insert({ user_id: user.user.id, member_id: expenseForm.member_id || null, category: expenseForm.category, description: expenseForm.description.trim() || null, amount, currency_code: expenseForm.currency_code, expense_date: expenseForm.expense_date, is_recurring: expenseForm.is_recurring, notes: expenseForm.notes.trim() || null });
    setSaving(false); if (insertError) setError(insertError.message); else { setExpenseForm({ member_id: "", category: "عام", description: "", amount: "", currency_code: currency, expense_date: today(), is_recurring: false, notes: "" }); setNotice(tr(en, "تم تسجيل مصروف المنزل.", "Household expense recorded.")); await load(); }
  };

  const removeExpense = async (id: string) => {
    if (!supabase) return;
    const { error: deleteError } = await (supabase as any).from("household_expenses").delete().eq("id", id);
    if (deleteError) setError(deleteError.message); else await load();
  };

  return <Panel title={tr(en, "مصروفات المنزل", "Household expenses")} description={tr(en, "إدارة فعلية لمصروفات الأسرة والالتزامات والميزانيات المشتركة.", "Manage family expenses, shared obligations, and household budgets.")}>
    {(error || notice) && <div className={`notice ${error ? "error" : "success"}`}>{error || notice}</div>}
    <div className="household-stats">
      <div className="household-stat"><span>{tr(en, "مصروف هذا الشهر", "This month")}</span><strong>{money(totalMonth)}</strong></div>
      <div className="household-stat"><span>{tr(en, "ميزانية الشهر", "Monthly budget")}</span><strong>{money(monthlyBudget)}</strong></div>
      <div className="household-stat"><span>{tr(en, "المتبقي", "Remaining")}</span><strong>{money(remaining)}</strong></div>
      <div className="household-stat"><span>{tr(en, "المتكرر", "Recurring")}</span><strong>{money(recurring)}</strong></div>
    </div>

    <div className="household-grid">
      <section className="panel-card household-card">
        <div className="panel-head"><div><p className="eyebrow">01</p><h3>{tr(en, "مصروفات الشهر", "Monthly expenses")}</h3></div><small>{busy ? tr(en, "جارٍ التحميل…", "Loading…") : `${expenses.length} ${tr(en, "مصروف", "expenses")}`}</small></div>
        {monthlyBudget > 0 && <><div className="household-progress-label"><span>{tr(en, "استهلاك الميزانية", "Budget used")}</span><b>{Math.round(progress)}%</b></div><div className="household-progress"><span style={{ width: `${progress}%` }} /></div></>}
        <div className="household-list">{expenses.length === 0 ? <p className="empty-state">{tr(en, "لا توجد مصروفات لهذا الشهر.", "No expenses for this month yet.")}</p> : expenses.map(item => <article className="household-row" key={item.id}><div><strong>{item.description || item.category}</strong><small>{item.expense_date} · {item.category} · {memberName(item.member_id)}{item.is_recurring ? ` · ${tr(en, "متكرر", "Recurring")}` : ""}</small></div><div className="household-row-end"><b>{money(Number(item.amount), item.currency_code)}</b><button className="text-button danger-text" onClick={() => void removeExpense(item.id)}>{tr(en, "حذف", "Delete")}</button></div></article>)}</div>
      </section>

      <section className="panel-card household-card">
        <div className="panel-head"><div><p className="eyebrow">02</p><h3>{tr(en, "إضافة مصروف", "Add expense")}</h3></div></div>
        <div className="form-grid household-form"><select value={expenseForm.member_id} onChange={e => setExpenseForm({ ...expenseForm, member_id: e.target.value })}><option value="">{tr(en, "من دفع؟", "Paid by")}</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select><select value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}>{categories.map(c => <option key={c}>{en ? ({ "طعام":"Food", "كهرباء":"Electricity", "ماء":"Water", "إيجار":"Rent", "غاز":"Gas", "إنترنت":"Internet", "تعليم":"Education", "صحة":"Health", "مواصلات":"Transport", "تسوق":"Shopping", "عام":"General" } as Record<string,string>)[c] : c}</option>)}</select><input inputMode="decimal" placeholder={tr(en, "المبلغ", "Amount")} value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}/><input type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}/><input className="wide" placeholder={tr(en, "وصف المصروف", "Expense description")} value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}/><input placeholder={tr(en, "العملة", "Currency")} value={expenseForm.currency_code} onChange={e => setExpenseForm({ ...expenseForm, currency_code: e.target.value.toUpperCase() })}/><label className="household-check"><input type="checkbox" checked={expenseForm.is_recurring} onChange={e => setExpenseForm({ ...expenseForm, is_recurring: e.target.checked })}/>{tr(en, "مصروف متكرر", "Recurring expense")}</label><textarea className="wide" rows={3} placeholder={tr(en, "ملاحظات", "Notes")} value={expenseForm.notes} onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })}/><button className="primary-button wide" disabled={saving} onClick={() => void addExpense()}>{saving ? tr(en, "جارٍ الحفظ…", "Saving…") : tr(en, "تسجيل المصروف", "Record expense")}</button></div>
      </section>
    </div>

    <div className="household-grid">
      <section className="panel-card household-card"><div className="panel-head"><div><p className="eyebrow">03</p><h3>{tr(en, "أفراد الأسرة", "Household members")}</h3></div></div><div className="form-grid household-form"><input placeholder={tr(en, "اسم الفرد", "Member name")} value={memberForm.name} onChange={e => setMemberForm({ ...memberForm, name: e.target.value })}/><select value={memberForm.role} onChange={e => setMemberForm({ ...memberForm, role: e.target.value })}>{roles.map(r => <option key={r}>{r}</option>)}</select><input inputMode="decimal" placeholder={tr(en, "المساهمة الشهرية", "Monthly contribution")} value={memberForm.monthly_contribution} onChange={e => setMemberForm({ ...memberForm, monthly_contribution: e.target.value })}/><button className="primary-button" disabled={saving} onClick={() => void addMember()}>{tr(en, "إضافة فرد", "Add member")}</button></div><div className="household-list">{members.map(m => <article className="household-row" key={m.id}><div><strong>{m.name}</strong><small>{m.role} · {tr(en, "مساهمة", "Contribution")}: {money(Number(m.monthly_contribution))}</small></div><button className="text-button danger-text" onClick={() => void removeMember(m.id)}>{tr(en, "حذف", "Delete")}</button></article>)}</div></section>

      <section className="panel-card household-card"><div className="panel-head"><div><p className="eyebrow">04</p><h3>{tr(en, "ميزانيات المنزل", "Household budgets")}</h3></div></div><div className="form-grid household-form"><input placeholder={tr(en, "اسم الميزانية", "Budget name")} value={budgetForm.name} onChange={e => setBudgetForm({ ...budgetForm, name: e.target.value })}/><input inputMode="decimal" placeholder={tr(en, "المبلغ", "Amount")} value={budgetForm.amount} onChange={e => setBudgetForm({ ...budgetForm, amount: e.target.value })}/><select value={budgetForm.period} onChange={e => setBudgetForm({ ...budgetForm, period: e.target.value })}><option value="monthly">{tr(en, "شهري", "Monthly")}</option><option value="weekly">{tr(en, "أسبوعي", "Weekly")}</option><option value="yearly">{tr(en, "سنوي", "Yearly")}</option></select><input placeholder={tr(en, "العملة", "Currency")} value={budgetForm.currency_code} onChange={e => setBudgetForm({ ...budgetForm, currency_code: e.target.value.toUpperCase() })}/><button className="primary-button wide" disabled={saving} onClick={() => void addBudget()}>{tr(en, "إضافة ميزانية", "Add budget")}</button></div><div className="household-list">{budgets.map(b => <article className="household-row" key={b.id}><div><strong>{b.name}</strong><small>{b.period} · {b.start_date} · {money(Number(b.amount), b.currency_code)}</small></div><button className="text-button danger-text" onClick={() => void removeBudget(b.id)}>{tr(en, "حذف", "Delete")}</button></article>)}</div></section>
    </div>
  </Panel>;
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="panel"><div className="section-heading"><div><p className="eyebrow">BYE PRO FINANCE</p><h2>{title}</h2><p>{description}</p></div></div>{children}</section>;
}
