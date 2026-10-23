import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import type { Tables, Enums } from "../types/database.types";

type Transaction = Tables<"transactions">;
type Account = Pick<Tables<"accounts">, "id" | "name" | "currency_code" | "is_active">;
type Category = Pick<Tables<"categories">, "id" | "name" | "kind">;
type TransactionType = Exclude<Enums<"transaction_type">, "transfer">;

const typeLabels: Record<TransactionType, string> = {
  income: "دخل",
  expense: "مصروف",
  adjustment: "تسوية",
};
const statusLabels: Record<Enums<"transaction_status">, string> = {
  pending: "معلّقة",
  completed: "مكتملة",
  cancelled: "ملغاة",
};
const money = (value: number, currency: string) =>
  new Intl.NumberFormat("ar", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

export default function TransactionsView() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [type, setType] = useState<TransactionType>("expense");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [filter, setFilter] = useState<"all" | TransactionType>("all");
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    if (!supabase) {
      setError("إعداد اتصال Supabase غير مكتمل.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const [transactionResult, accountResult, categoryResult] = await Promise.all([
      supabase.from("transactions").select("*").order("transaction_date", { ascending: false }).order("created_at", { ascending: false }).limit(200),
      supabase.from("accounts").select("id,name,currency_code,is_active").eq("is_active", true).order("name"),
      supabase.from("categories").select("id,name,kind").order("name"),
    ]);
    if (transactionResult.error) setError(transactionResult.error.message);
    else setItems(transactionResult.data ?? []);
    if (accountResult.error) setError((current) => current || accountResult.error.message);
    else {
      setAccounts(accountResult.data ?? []);
      if (!accountId && accountResult.data?.[0]) setAccountId(accountResult.data[0].id);
    }
    if (categoryResult.error) setError((current) => current || categoryResult.error.message);
    else setCategories(categoryResult.data ?? []);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { void loadData(); }, [loadData]);

  async function createTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("أدخل مبلغًا أكبر من الصفر.");
      return;
    }
    if (!accountId) {
      setError("أضف حسابًا نشطًا أولًا من قسم الحسابات.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setError("انتهت جلسة الدخول. سجّل الدخول مجددًا.");
      setSaving(false);
      return;
    }
    const account = accounts.find((item) => item.id === accountId);
    const { error: insertError } = await supabase.from("transactions").insert({
      user_id: userData.user.id,
      account_id: accountId,
      category_id: categoryId || null,
      type,
      amount: numericAmount,
      currency_code: account?.currency_code ?? "LYD",
      description: description.trim() || null,
      transaction_date: date,
      status: "completed",
    });
    if (insertError) setError(insertError.message);
    else {
      setAmount("");
      setDescription("");
      setCategoryId("");
      setShowForm(false);
      setNotice("تم تسجيل المعاملة. إذا كان تحديث الرصيد آليًا مفعّلًا في قاعدة البيانات فسيُحدّث وفق قواعدها.");
      await loadData();
    }
    setSaving(false);
  }

  async function setStatus(transaction: Transaction, status: Enums<"transaction_status">) {
    if (!supabase) return;
    setError("");
    setNotice("");
    const { error: updateError } = await supabase.from("transactions").update({ status }).eq("id", transaction.id);
    if (updateError) setError(updateError.message);
    else {
      setNotice("تم تحديث حالة المعاملة.");
      await loadData();
    }
  }

  const visibleItems = items.filter((item) => {
    const matchesType = filter === "all" || item.type === filter;
    const matchesSearch = !search.trim() || (item.description ?? "").toLocaleLowerCase("ar").includes(search.trim().toLocaleLowerCase("ar")) ||
      (accounts.find((account) => account.id === item.account_id)?.name ?? "").toLocaleLowerCase("ar").includes(search.trim().toLocaleLowerCase("ar"));
    return matchesType && matchesSearch;
  });
  const totals = visibleItems.reduce((result, item) => {
    if (item.status !== "completed" || item.type === "transfer") return result;
    const key = item.currency_code;
    if (!result[key]) result[key] = { income: 0, expense: 0, adjustment: 0 };
    result[key][item.type] += Number(item.amount);
    return result;
  }, {} as Record<string, Record<TransactionType, number>>);

  return <section className="data-view">
    <div className="data-view-heading">
      <div><p className="eyebrow">السجل المالي</p><h2>المعاملات</h2><p className="muted-copy">سجّل الدخل والمصروفات وراجع آخر 200 معاملة.</p></div>
      <button type="button" className="primary-button compact-button" onClick={() => { setShowForm((value) => !value); setError(""); setNotice(""); }}>{showForm ? "إلغاء" : "+ معاملة جديدة"}</button>
    </div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {notice && <p className="notice success" role="status">{notice}</p>}
    {showForm && <form className="account-form" onSubmit={createTransaction}>
      <div className="form-field"><label htmlFor="transaction-type">نوع المعاملة</label><select id="transaction-type" value={type} onChange={(event) => { setType(event.target.value as TransactionType); setCategoryId(""); }}><option value="expense">مصروف</option><option value="income">دخل</option><option value="adjustment">تسوية</option></select></div>
      <div className="form-field"><label htmlFor="transaction-account">الحساب *</label><select id="transaction-account" required value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">اختر حسابًا</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency_code}</option>)}</select></div>
      <div className="form-field"><label htmlFor="transaction-amount">المبلغ *</label><input id="transaction-amount" type="number" min="0.01" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} dir="ltr" /></div>
      <div className="form-field"><label htmlFor="transaction-date">التاريخ *</label><input id="transaction-date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} dir="ltr" /></div>
      <div className="form-field"><label htmlFor="transaction-category">التصنيف (اختياري)</label><select id="transaction-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">بدون تصنيف</option>{categories.filter((category) => category.kind === type).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
      <div className="form-field"><label htmlFor="transaction-description">الوصف (اختياري)</label><input id="transaction-description" maxLength={200} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="مثلاً: مشتريات المنزل" /></div>
      <button type="submit" className="primary-button form-submit" disabled={saving || accounts.length === 0}>{saving ? "جارٍ الحفظ…" : "حفظ المعاملة"}</button>
      {accounts.length === 0 && <p className="notice warning form-submit">لا يوجد حساب نشط. أنشئ حسابًا أولًا.</p>}
    </form>}
    <div className="transaction-toolbar">
      <input aria-label="بحث في المعاملات" placeholder="ابحث بالوصف أو الحساب…" value={search} onChange={(event) => setSearch(event.target.value)} />
      <select aria-label="تصفية حسب النوع" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">كل الأنواع</option><option value="income">الدخل</option><option value="expense">المصروفات</option><option value="adjustment">التسويات</option></select>
    </div>
    <div className="balance-summary">
      {Object.entries(totals).map(([currency, values]) => <div key={currency}><span>ملخص مكتمل · {currency}</span><strong dir="ltr">{money(values.income - values.expense + values.adjustment, currency)}</strong><small>دخل {money(values.income, currency)} · مصروف {money(values.expense, currency)}</small></div>)}
      {Object.keys(totals).length === 0 && <div><span>ملخص المعاملات</span><strong>—</strong><small>لا توجد معاملات مكتملة ضمن النتائج الحالية.</small></div>}
    </div>
    {loading ? <div className="empty-state">جارٍ تحميل المعاملات…</div> : visibleItems.length === 0 ? <div className="empty-state"><span className="empty-icon">⇄</span><h3>لا توجد معاملات مطابقة</h3><p>أضف معاملة أو غيّر خيارات البحث.</p></div> : <div className="transaction-list">
      {visibleItems.map((item) => <article className="transaction-row" key={item.id}>
        <span className={item.type === "income" ? "transaction-type-icon positive" : item.type === "expense" ? "transaction-type-icon negative" : "transaction-type-icon"}>{item.type === "income" ? "↓" : item.type === "expense" ? "↑" : "↔"}</span>
        <div className="transaction-details"><h3>{item.description || typeLabels[item.type as TransactionType] || "معاملة"}</h3><p>{accounts.find((account) => account.id === item.account_id)?.name ?? "حساب"} · {item.transaction_date}</p><span className="account-status">{typeLabels[item.type as TransactionType] ?? item.type} · {statusLabels[item.status]}</span></div>
        <div className="account-balance"><strong className={item.type === "income" ? "amount-positive" : item.type === "expense" ? "amount-negative" : ""} dir="ltr">{item.type === "expense" ? "−" : item.type === "income" ? "+" : ""}{money(Number(item.amount), item.currency_code)}</strong>{item.status !== "cancelled" && <button type="button" className="text-button" onClick={() => void setStatus(item, item.status === "completed" ? "pending" : "completed")}>{item.status === "completed" ? "وضع كمعلّقة" : "وضع كمكتملة"}</button>}</div>
      </article>)}
    </div>}
  </section>;
}
