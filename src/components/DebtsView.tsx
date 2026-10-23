import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import type { Tables, Enums } from "../types/database.types";

type Debt = Tables<"debts">;
type DebtType = Enums<"debt_type">;
const money = (value: number, currency: string) =>
  new Intl.NumberFormat("ar", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

export default function DebtsView() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [person, setPerson] = useState("");
  const [type, setType] = useState<DebtType>("i_owe");
  const [principal, setPrincipal] = useState("");
  const [remaining, setRemaining] = useState("");
  const [currency, setCurrency] = useState("LYD");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const loadDebts = useCallback(async () => {
    if (!supabase) {
      setError("إعداد اتصال Supabase غير مكتمل.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: queryError } = await supabase.from("debts").select("*").order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setDebts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void loadDebts(); }, [loadDebts]);

  async function createDebt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const principalAmount = Number(principal);
    const remainingAmount = remaining === "" ? principalAmount : Number(remaining);
    if (!Number.isFinite(principalAmount) || principalAmount <= 0 || !Number.isFinite(remainingAmount) || remainingAmount < 0 || remainingAmount > principalAmount) {
      setError("تحقق من المبلغ الأصلي والمتبقي؛ المتبقي يجب أن يكون بين صفر والمبلغ الأصلي.");
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
    const { error: insertError } = await supabase.from("debts").insert({
      user_id: userData.user.id,
      person_name: person.trim(),
      type,
      principal_amount: principalAmount,
      remaining_amount: remainingAmount,
      currency_code: currency,
      due_date: dueDate || null,
      notes: notes.trim() || null,
      is_settled: remainingAmount === 0,
    });
    if (insertError) setError(insertError.message);
    else {
      setPerson(""); setPrincipal(""); setRemaining(""); setDueDate(""); setNotes("");
      setShowForm(false); setNotice("تم تسجيل الدين.");
      await loadDebts();
    }
    setSaving(false);
  }

  async function toggleSettled(debt: Debt) {
    if (!supabase) return;
    setError(""); setNotice("");
    const settled = !debt.is_settled;
    const { error: updateError } = await supabase.from("debts").update({
      is_settled: settled,
      remaining_amount: settled ? 0 : debt.principal_amount,
    }).eq("id", debt.id);
    if (updateError) setError(updateError.message);
    else { setNotice(settled ? "تم تعليم الدين بأنه مسدّد." : "تمت إعادة فتح الدين بالمبلغ الأصلي."); await loadDebts(); }
  }

  const activeDebts = debts.filter((debt) => !debt.is_settled);
  const grouped = activeDebts.reduce<Record<string, { owedToMe: number; iOwe: number }>>((totals, debt) => {
    const item = totals[debt.currency_code] ??= { owedToMe: 0, iOwe: 0 };
    if (debt.type === "owed_to_me") item.owedToMe += Number(debt.remaining_amount);
    else item.iOwe += Number(debt.remaining_amount);
    return totals;
  }, {});

  return <section className="data-view">
    <div className="data-view-heading"><div><p className="eyebrow">الالتزامات المالية</p><h2>الديون</h2><p className="muted-copy">تابع ما لك وما عليك والمبالغ المتبقية.</p></div><button type="button" className="primary-button compact-button" onClick={() => { setShowForm((value) => !value); setError(""); setNotice(""); }}>{showForm ? "إلغاء" : "+ تسجيل دين"}</button></div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {notice && <p className="notice success" role="status">{notice}</p>}
    {showForm && <form className="account-form" onSubmit={createDebt}>
      <div className="form-field"><label htmlFor="debt-person">اسم الشخص أو الجهة *</label><input id="debt-person" required maxLength={100} value={person} onChange={(event) => setPerson(event.target.value)} /></div>
      <div className="form-field"><label htmlFor="debt-type">نوع الدين</label><select id="debt-type" value={type} onChange={(event) => setType(event.target.value as DebtType)}><option value="i_owe">عليّ للغير</option><option value="owed_to_me">لي عند الغير</option></select></div>
      <div className="form-field"><label htmlFor="debt-principal">المبلغ الأصلي *</label><input id="debt-principal" type="number" min="0.01" step="0.01" required value={principal} onChange={(event) => { setPrincipal(event.target.value); if (!remaining) setRemaining(event.target.value); }} dir="ltr" /></div>
      <div className="form-field"><label htmlFor="debt-remaining">المبلغ المتبقي</label><input id="debt-remaining" type="number" min="0" step="0.01" value={remaining} onChange={(event) => setRemaining(event.target.value)} dir="ltr" placeholder="يساوي الأصلي تلقائيًا" /></div>
      <div className="form-field"><label htmlFor="debt-currency">العملة</label><select id="debt-currency" value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="LYD">دينار ليبي (LYD)</option><option value="USD">دولار أمريكي (USD)</option><option value="EUR">يورو (EUR)</option><option value="SYP">ليرة سورية (SYP)</option><option value="JOD">دينار أردني (JOD)</option></select></div>
      <div className="form-field"><label htmlFor="debt-date">تاريخ الاستحقاق</label><input id="debt-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} dir="ltr" /></div>
      <div className="form-field"><label htmlFor="debt-notes">ملاحظات</label><input id="debt-notes" maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
      <button type="submit" className="primary-button form-submit" disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ الدين"}</button>
    </form>}
    <div className="balance-summary">{Object.entries(grouped).map(([code, value]) => <div key={code}><span>ملخص الديون · {code}</span><strong dir="ltr">{money(value.owedToMe - value.iOwe, code)}</strong><small>لك {money(value.owedToMe, code)} · عليك {money(value.iOwe, code)}</small></div>)}{Object.keys(grouped).length === 0 && <div><span>الديون النشطة</span><strong>0</strong><small>لا توجد ديون غير مسددة.</small></div>}</div>
    {loading ? <div className="empty-state">جارٍ تحميل الديون…</div> : debts.length === 0 ? <div className="empty-state"><span className="empty-icon">↗</span><h3>لا توجد ديون مسجلة</h3><p>أضف دينًا لمتابعة المبلغ الأصلي والمتبقي.</p><button type="button" className="secondary-button" onClick={() => setShowForm(true)}>تسجيل أول دين</button></div> : <div className="account-list">{debts.map((debt) => <article className={debt.is_settled ? "account-row inactive" : "account-row"} key={debt.id}><span className="account-type-icon">{debt.type === "owed_to_me" ? "↓" : "↑"}</span><div className="account-details"><h3>{debt.person_name}</h3><p>{debt.type === "owed_to_me" ? "لك عند الغير" : "عليك للغير"}{debt.due_date ? ` · الاستحقاق: ${debt.due_date}` : ""}</p><span className={debt.is_settled ? "account-status off" : "account-status"}>{debt.is_settled ? "مسدّد" : "قائم"}</span>{debt.notes && <p>{debt.notes}</p>}</div><div className="account-balance"><strong dir="ltr">{money(Number(debt.remaining_amount), debt.currency_code)}</strong><small className="muted-copy">الأصل: {money(Number(debt.principal_amount), debt.currency_code)}</small><button type="button" className="text-button" onClick={() => void toggleSettled(debt)}>{debt.is_settled ? "إعادة فتح" : "تسوية كاملة"}</button></div></article>)}</div>}
  </section>;
}
