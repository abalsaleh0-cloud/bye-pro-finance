import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Icon } from "../../../../packages/ui/src";
import { supabase } from "../lib/supabase";
import type { Tables, Enums } from "../types/database.types";

type Transaction = Tables<"transactions">;
type Account = Pick<Tables<"accounts">, "id" | "name" | "currency_code" | "is_active">;
type Category = Pick<Tables<"categories">, "id" | "name" | "kind">;
type TransactionType = Exclude<Enums<"transaction_type">, "transfer">;

const typeLabels: Record<TransactionType | "transfer", string> = { income: "دخل", expense: "مصروف", adjustment: "تسوية", transfer: "تحويل" };
const statusLabels: Record<Enums<"transaction_status">, string> = { pending: "معلّقة", completed: "مكتملة", cancelled: "ملغاة" };
const money = (value: number, currency = "LYD") => new Intl.NumberFormat("ar", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

export default function TransactionsView() {
  const [items, setItems] = useState<Transaction[]>([]); const [accounts, setAccounts] = useState<Account[]>([]); const [categories, setCategories] = useState<Category[]>([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [showForm, setShowForm] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [type, setType] = useState<TransactionType>("expense"); const [accountId, setAccountId] = useState(""); const [categoryId, setCategoryId] = useState(""); const [amount, setAmount] = useState(""); const [description, setDescription] = useState(""); const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); const [filter, setFilter] = useState<"all" | TransactionType>("all"); const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    if (!supabase) { setError("إعداد اتصال Supabase غير مكتمل."); setLoading(false); return; }
    setLoading(true); setError("");
    const [transactionResult, accountResult, categoryResult] = await Promise.all([
      supabase.from("transactions").select("*").order("transaction_date", { ascending: false }).order("created_at", { ascending: false }).limit(200),
      supabase.from("accounts").select("id,name,currency_code,is_active").eq("is_active", true).order("name"),
      supabase.from("categories").select("id,name,kind").order("name"),
    ]);
    if (transactionResult.error) setError(transactionResult.error.message); else setItems(transactionResult.data ?? []);
    if (accountResult.error) setError((current) => current || accountResult.error.message); else { setAccounts(accountResult.data ?? []); if (!accountId && accountResult.data?.[0]) setAccountId(accountResult.data[0].id); }
    if (categoryResult.error) setError((current) => current || categoryResult.error.message); else setCategories(categoryResult.data ?? []);
    setLoading(false);
  }, [accountId]);
  useEffect(() => { void loadData(); }, [loadData]);

  async function createTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase) return; const numericAmount = Number(amount); if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError("أدخل مبلغًا أكبر من الصفر."); return; } if (!accountId) { setError("أضف حسابًا نشطًا أولًا من قسم الحسابات."); return; }
    setSaving(true); setError(""); setNotice(""); const { data: userData, error: userError } = await supabase.auth.getUser(); if (userError || !userData.user) { setError("انتهت جلسة الدخول. سجّل الدخول مجددًا."); setSaving(false); return; }
    const account = accounts.find((item) => item.id === accountId); const { error: insertError } = await supabase.from("transactions").insert({ user_id: userData.user.id, account_id: accountId, category_id: categoryId || null, type, amount: numericAmount, currency_code: account?.currency_code ?? "LYD", description: description.trim() || null, transaction_date: new Date(`${date}T12:00:00`).toISOString(), status: "completed" });
    if (insertError) setError(insertError.message); else { setAmount(""); setDescription(""); setCategoryId(""); setShowForm(false); setNotice("تم تسجيل المعاملة."); await loadData(); } setSaving(false);
  }
  async function setStatus(transaction: Transaction, status: Enums<"transaction_status">) { if (!supabase) return; setError(""); setNotice(""); const { error: updateError } = await supabase.from("transactions").update({ status }).eq("id", transaction.id); if (updateError) setError(updateError.message); else { setNotice("تم تحديث حالة المعاملة."); await loadData(); } }

  const visibleItems = items.filter((item) => { const query = search.trim().toLocaleLowerCase("ar"); const accountName = accounts.find((account) => account.id === item.account_id)?.name ?? ""; return (filter === "all" || item.type === filter) && (!query || (item.description ?? "").toLocaleLowerCase("ar").includes(query) || accountName.toLocaleLowerCase("ar").includes(query)); });
  const income = visibleItems.filter((item) => item.type === "income" && item.status !== "cancelled").reduce((sum, item) => sum + Number(item.amount), 0);
  const expense = visibleItems.filter((item) => item.type === "expense" && item.status !== "cancelled").reduce((sum, item) => sum + Number(item.amount), 0);

  return <section className="data-view">
    <div className="data-view-heading"><div><p className="eyebrow">الحركة المالية</p><h2>المعاملات</h2><p className="muted-copy">تسجيل ومراجعة الدخل والمصروفات والتسويات.</p></div><button type="button" className="primary-button compact-button" onClick={() => { setShowForm(!showForm); setError(""); }}>{showForm ? "إلغاء" : "+ إضافة معاملة"}</button></div>
    {error && <p className="notice error" role="alert">{error}</p>}{notice && <p className="notice success" role="status">{notice}</p>}
    {showForm && <form className="account-form" onSubmit={createTransaction}>
      <div className="form-field"><label>نوع المعاملة</label><select value={type} onChange={(e) => setType(e.target.value as TransactionType)}>{Object.entries(typeLabels).filter(([value]) => value !== "transfer").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div className="form-field"><label>الحساب</label><select required value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">اختر حسابًا</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency_code}</option>)}</select></div>
      <div className="form-field"><label>التصنيف</label><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">بدون تصنيف</option>{categories.filter((category) => category.kind === type).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
      <div className="form-field"><label>المبلغ</label><input type="number" min="0.01" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" /></div>
      <div className="form-field"><label>التاريخ</label><input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="form-field"><label>الوصف</label><input value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} /></div>
      <button className="primary-button form-submit" type="submit" disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ المعاملة"}</button>
    </form>}
    <div className="balance-summary"><div><span>الدخل الظاهر</span><strong dir="ltr">{money(income)}</strong><small>{visibleItems.filter((item) => item.type === "income").length} معاملة</small></div><div><span>المصروفات الظاهرة</span><strong dir="ltr">{money(expense)}</strong><small>{visibleItems.filter((item) => item.type === "expense").length} معاملة</small></div><div><span>صافي الحركة</span><strong dir="ltr">{money(income - expense)}</strong><small>حسب السجلات الظاهرة</small></div></div>
    <div className="transaction-toolbar"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالوصف أو الحساب…" /><select value={filter} onChange={(e) => setFilter(e.target.value as "all" | TransactionType)}><option value="all">كل الأنواع</option>{Object.entries(typeLabels).filter(([value]) => value !== "transfer").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    {loading ? <div className="empty-state">جارٍ تحميل المعاملات…</div> : visibleItems.length === 0 ? <div className="empty-state"><span className="empty-icon"><Icon name="arrow-left-right" size={28} /></span><h3>لا توجد معاملات مطابقة</h3><p>سجّل أول معاملة أو غيّر الفلتر.</p></div> : <div className="transaction-list">{visibleItems.map((item) => { const account = accounts.find((a) => a.id === item.account_id); return <article className="transaction-row" key={item.id}><div><strong>{item.description || typeLabels[item.type]}</strong><small>{account?.name || "حساب"} · {new Date(item.transaction_date).toLocaleDateString("ar")}</small></div><div className={item.type === "expense" ? "amount expense" : "amount income"} dir="ltr">{item.type === "expense" ? "−" : "+"}{money(Number(item.amount), item.currency_code)}</div><span className="transaction-status">{statusLabels[item.status]}</span><button type="button" className="text-button" onClick={() => void setStatus(item, item.status === "completed" ? "pending" : "completed")}>{item.status === "completed" ? "تعليق" : "إكمال"}</button></article>; })}</div>}
  </section>;
}
