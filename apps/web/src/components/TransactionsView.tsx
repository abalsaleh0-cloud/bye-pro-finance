import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Icon } from "../../../../packages/ui/src";
import { supabase } from "../lib/supabase";
import type { Tables, Enums } from "../types/database.types";
import CategoryManager from "./CategoryManager";

type Transaction = Tables<"transactions">;
type Account = Pick<Tables<"accounts">, "id" | "name" | "currency_code" | "is_active">;
type Category = Pick<Tables<"categories">, "id" | "name" | "kind">;
type TransactionType = Exclude<Enums<"transaction_type">, "transfer">;
const typeLabels: Record<TransactionType | "transfer", string> = { income: "دخل", expense: "مصروف", adjustment: "تسوية", transfer: "تحويل" };
const statusLabels: Record<Enums<"transaction_status">, string> = { pending: "معلّقة", completed: "مكتملة", cancelled: "ملغاة" };
const money = (value: number, currency = "LYD") => new Intl.NumberFormat(typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "ar", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

export default function TransactionsView() {
  const en = typeof document !== "undefined" && document.documentElement.lang === "en";
  const tr = (ar: string, english: string) => en ? english : ar;
  const [items, setItems] = useState<Transaction[]>([]); const [accounts, setAccounts] = useState<Account[]>([]); const [categories, setCategories] = useState<Category[]>([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [showForm, setShowForm] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [type, setType] = useState<TransactionType>("expense"); const [accountId, setAccountId] = useState(""); const [categoryId, setCategoryId] = useState(""); const [amount, setAmount] = useState(""); const [description, setDescription] = useState(""); const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); const [filter, setFilter] = useState<"all" | TransactionType>("all"); const [search, setSearch] = useState("");
  const loadData = useCallback(async () => {
    if (!supabase) { setError(tr("إعداد اتصال Supabase غير مكتمل.", "Supabase connection is not configured.")); setLoading(false); return; }
    setLoading(true); setError("");
    const [transactionResult, accountResult, categoryResult] = await Promise.all([
      supabase.from("transactions").select("*").order("transaction_date", { ascending: false }).order("created_at", { ascending: false }).limit(200),
      supabase.from("accounts").select("id,name,currency_code,is_active").eq("is_active", true).order("name"),
      supabase.from("categories").select("id,name,kind").order("name"),
    ]);
    if (transactionResult.error) setError(transactionResult.error.message); else setItems(transactionResult.data ?? []);
    if (accountResult.error) setError(current => current || accountResult.error.message); else { setAccounts(accountResult.data ?? []); if (!accountId && accountResult.data?.[0]) setAccountId(accountResult.data[0].id); }
    if (categoryResult.error) setError(current => current || categoryResult.error.message); else setCategories(categoryResult.data ?? []);
    setLoading(false);
  }, [accountId]);
  useEffect(() => { void loadData(); }, [loadData]);
  async function createTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase) return;
    const numericAmount = Number(amount); if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError(tr("أدخل مبلغًا أكبر من الصفر.", "Enter an amount greater than zero.")); return; }
    if (!accountId) { setError(tr("أضف حسابًا نشطًا أولًا من قسم الحسابات.", "Add an active account in Accounts first.")); return; }
    setSaving(true); setError(""); setNotice(""); const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) { setError(tr("انتهت جلسة الدخول. سجّل الدخول مجددًا.", "Your session expired. Please sign in again.")); setSaving(false); return; }
    const account = accounts.find(item => item.id === accountId);
    const { error: insertError } = await supabase.from("transactions").insert({ user_id: userData.user.id, account_id: accountId, category_id: categoryId || null, type, amount: numericAmount, currency_code: account?.currency_code ?? "LYD", description: description.trim() || null, transaction_date: new Date(`${date}T12:00:00`).toISOString(), status: "completed" });
    if (insertError) setError(insertError.message); else { setAmount(""); setDescription(""); setCategoryId(""); setShowForm(false); setNotice(tr("تم تسجيل المعاملة.", "Transaction recorded.")); await loadData(); }
    setSaving(false);
  }
  async function setStatus(transaction: Transaction, status: Enums<"transaction_status">) { if (!supabase) return; setError(""); setNotice(""); const { error: updateError } = await supabase.from("transactions").update({ status }).eq("id", transaction.id); if (updateError) setError(updateError.message); else { setNotice(tr("تم تحديث حالة المعاملة.", "Transaction status updated.")); await loadData(); } }
  const visibleItems = items.filter(item => { const query = search.trim().toLocaleLowerCase(en ? "en" : "ar"); const accountName = accounts.find(account => account.id === item.account_id)?.name ?? ""; return (filter === "all" || item.type === filter) && (!query || (item.description ?? "").toLocaleLowerCase(en ? "en" : "ar").includes(query) || accountName.toLocaleLowerCase(en ? "en" : "ar").includes(query)); });
  const currencySummary = visibleItems.reduce<Record<string,{income:number;expense:number;count:number}>>((acc,item) => { if(item.status === "cancelled") return acc; const c=item.currency_code||"LYD"; acc[c]??={income:0,expense:0,count:0}; acc[c].count++; if(item.type === "income") acc[c].income += Number(item.amount||0); if(item.type === "expense") acc[c].expense += Number(item.amount||0); return acc; },{});

  return <section className="data-view">
    <div className="data-view-heading"><div><p className="eyebrow">{tr("الحركة المالية","Financial activity")}</p><h2>{tr("المعاملات","Transactions")}</h2><p className="muted-copy">{tr("تسجيل ومراجعة الدخل والمصروفات والتسويات دون خلط العملات.","Record and review income, expenses, and adjustments without mixing currencies.")}</p></div><button type="button" className="primary-button compact-button" onClick={() => { setShowForm(!showForm); setError(""); }}>{showForm ? tr("إلغاء", "Cancel") : "+ "+tr("إضافة معاملة", "Add transaction")}</button></div>
    {error && <p className="notice error" role="alert">{error}</p>}{notice && <p className="notice success" role="status">{notice}</p>}
    {showForm && <form className="account-form" onSubmit={createTransaction}>
      <div className="form-field"><label htmlFor="transaction-type">{tr("نوع المعاملة","Transaction type")}</label><select id="transaction-type" value={type} onChange={e => setType(e.target.value as TransactionType)}>{Object.entries(typeLabels).filter(([value]) => value !== "transfer").map(([value,label]) => <option key={value} value={value}>{tr(label, ({ "دخل":"Income", "مصروف":"Expense", "تسوية":"Adjustment" } as Record<string,string>)[label] || label)}</option>)}</select></div>
      <div className="form-field"><label htmlFor="transaction-account">{tr("الحساب","Account")}</label><select id="transaction-account" required value={accountId} onChange={e => setAccountId(e.target.value)}><option value="">{tr("اختر حسابًا", "Select an account")}</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.currency_code}</option>)}</select></div>
      <div className="form-field"><label htmlFor="transaction-category">{tr("التصنيف","Category")}</label><select id="transaction-category" value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="">{tr("بدون تصنيف", "No category")}</option>{categories.filter(category => category.kind === type).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
      <div className="form-field"><label htmlFor="transaction-amount">{tr("المبلغ","Amount")}</label><input id="transaction-amount" type="number" min="0.01" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} dir="ltr" /></div>
      <div className="form-field"><label htmlFor="transaction-date">{tr("التاريخ","Date")}</label><input id="transaction-date" type="date" required value={date} onChange={e => setDate(e.target.value)} /></div>
      <div className="form-field"><label htmlFor="transaction-description">{tr("الوصف","Description")}</label><input id="transaction-description" value={description} maxLength={200} onChange={e => setDescription(e.target.value)} /></div>
      <button className="primary-button form-submit" type="submit" disabled={saving}>{saving ? tr("جارٍ الحفظ…", "Saving…") : tr("حفظ المعاملة", "Save transaction")}</button>
    </form>}
    <div className="balance-summary">{Object.entries(currencySummary).length === 0 ? <div><span>{tr("الحركة الظاهرة","Visible activity")}</span><strong>—</strong><small>{tr("لا توجد بيانات مكتملة", "No completed data")}</small></div> : Object.entries(currencySummary).map(([currency,summary]) => <div key={currency}><span>{currency}</span><strong dir="ltr">{money(summary.income-summary.expense,currency)}</strong><small>{money(summary.income,currency)} {tr("دخل", "income")} · {money(summary.expense,currency)} {tr("مصروف", "expense")} · {summary.count} {tr("معاملة", "transactions")}</small></div>)}</div>
    <div className="transaction-toolbar"><input aria-label={tr("ابحث في الوصف أو الحساب","Search description or account")} value={search} onChange={e => setSearch(e.target.value)} placeholder={tr("ابحث في الوصف أو الحساب…", "Search description or account…")} /><select aria-label={tr("تصفية نوع المعاملة","Filter transaction type")} value={filter} onChange={e => setFilter(e.target.value as "all" | TransactionType)}><option value="all">{tr("كل الأنواع", "All types")}</option>{Object.entries(typeLabels).filter(([value]) => value !== "transfer").map(([value,label]) => <option key={value} value={value}>{tr(label, ({ "دخل":"Income", "مصروف":"Expense", "تسوية":"Adjustment" } as Record<string,string>)[label] || label)}</option>)}</select></div>
    {loading ? <div className="empty-state">{tr("جارٍ تحميل المعاملات…","Loading transactions…")}</div> : visibleItems.length === 0 ? <div className="empty-state"><span className="empty-icon"><Icon name="arrow-left-right" size={28} /></span><h3>{tr("لا توجد معاملات مطابقة","No matching transactions")}</h3><p>{tr("سجّل أول معاملة أو غيّر الفلتر.","Record your first transaction or change the filter.")}</p></div> : <div className="transaction-list">{visibleItems.map(item => { const account = accounts.find(a => a.id === item.account_id); return <article className="transaction-row" key={item.id}><div><strong>{item.description || tr(typeLabels[item.type], ({ "دخل":"Income", "مصروف":"Expense", "تسوية":"Adjustment" } as Record<string,string>)[typeLabels[item.type]] || typeLabels[item.type])}</strong><small>{account?.name || tr("حساب", "Account")} · {new Date(item.transaction_date).toLocaleDateString(en ? "en" : "ar")}</small></div><div className={item.type === "expense" ? "amount expense" : "amount income"} dir="ltr">{item.type === "expense" ? "−" : "+"}{money(Number(item.amount), item.currency_code)}</div><span className="transaction-status">{tr(statusLabels[item.status], ({ "معلّقة":"Pending", "مكتملة":"Completed", "ملغاة":"Cancelled" } as Record<string,string>)[statusLabels[item.status]] || statusLabels[item.status])}</span><button type="button" className="text-button" onClick={() => void setStatus(item, item.status === "completed" ? "pending" : "completed")}>{item.status === "completed" ? tr("تعليق", "Set pending") : tr("إكمال", "Complete")}</button></article>; })}</div>}
    <CategoryManager />
  </section>;
}
