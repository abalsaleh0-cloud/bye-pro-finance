import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Icon } from "../../../../packages/ui/src";
import { supabase } from "../lib/supabase";
import type { Tables } from "../types/database.types";

type Account = Tables<"accounts">;
type AccountType = Account["type"];

const accountTypes: { value: AccountType; label: string }[] = [
  { value: "cash", label: "نقدي" },
  { value: "bank", label: "حساب بنكي" },
  { value: "wallet", label: "محفظة إلكترونية" },
  { value: "credit_card", label: "بطاقة ائتمان" },
  { value: "investment", label: "استثمار" },
  { value: "other", label: "أخرى" },
];

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("ar", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

export default function AccountsView() {
  const en = typeof document !== "undefined" && document.documentElement.lang === "en";
  const tr = (ar: string, english: string) => en ? english : ar;
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("cash");
  const [currency, setCurrency] = useState("LYD");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [institution, setInstitution] = useState("");
  const [lastFour, setLastFour] = useState("");

  const loadAccounts = useCallback(async () => {
    if (!supabase) {
      setError(tr("إعداد اتصال Supabase غير مكتمل.", "Supabase connection is not configured."));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: queryError } = await supabase
      .from("accounts")
      .select("*")
      .order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setAccounts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void loadAccounts(); }, [loadAccounts]);

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const amount = Number(openingBalance);
    if (!Number.isFinite(amount)) {
      setError(tr("أدخل رصيدًا افتتاحيًا صحيحًا.", "Enter a valid opening balance."));
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setError(tr("انتهت جلسة الدخول. سجّل الدخول مجددًا.", "Your session expired. Please sign in again."));
      setSaving(false);
      return;
    }
    const { error: insertError } = await supabase.from("accounts").insert({
      user_id: userData.user.id,
      name: name.trim(),
      type,
      currency_code: currency,
      opening_balance: amount,
      current_balance: amount,
      institution_name: institution.trim() || null,
      last_four: lastFour.trim() || null,
    });
    if (insertError) {
      setError(insertError.message);
    } else {
      setName("");
      setType("cash");
      setOpeningBalance("0");
      setInstitution("");
      setLastFour("");
      setShowForm(false);
      setNotice(tr("تمت إضافة الحساب.", "Account added."));
      await loadAccounts();
    }
    setSaving(false);
  }

  async function toggleAccount(account: Account) {
    if (!supabase) return;
    setError("");
    setNotice("");
    const { error: updateError } = await supabase
      .from("accounts")
      .update({ is_active: !account.is_active })
      .eq("id", account.id);
    if (updateError) setError(updateError.message);
    else {
      setNotice(account.is_active ? "تم إيقاف الحساب." : "تم تفعيل الحساب.");
      await loadAccounts();
    }
  }

  const totalByCurrency = accounts.reduce<Record<string, number>>((totals, account) => {
    if (account.is_active) totals[account.currency_code] = (totals[account.currency_code] ?? 0) + Number(account.current_balance);
    return totals;
  }, {});

  return <section className="data-view">
    <div className="data-view-heading">
      <div><p className="eyebrow">{tr("إدارة الأرصدة","Account balances")}</p><h2>{tr("حساباتك","Your accounts")}</h2><p className="muted-copy">{tr("تُقرأ الحسابات من قاعدة بياناتك الخاصة مباشرة.","Accounts are loaded directly from your private database.")}</p></div>
      <button type="button" className="primary-button compact-button" onClick={() => { setShowForm((value) => !value); setError(""); setNotice(""); }}>{showForm ? tr("إلغاء", "Cancel") : "+ "+tr("إضافة حساب", "Add account")}</button>
    </div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {notice && <p className="notice success" role="status">{notice}</p>}
    {showForm && <form className="account-form" onSubmit={createAccount}>
      <div className="form-field"><label htmlFor="account-name">Account name *</label><input id="account-name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Daily wallet" /></div>
      <div className="form-field"><label htmlFor="account-type">{tr("نوع الحساب","Account type")}</label><select id="account-type" value={type} onChange={(event) => setType(event.target.value as AccountType)}>{accountTypes.map((item) => <option key={item.value} value={item.value}>{tr(item.label, ({ "نقدي":"Cash", "حساب بنكي":"Bank account", "محفظة إلكترونية":"E-wallet", "بطاقة ائتمان":"Credit card", "استثمار":"Investment", "أخرى":"Other" } as Record<string,string>)[item.label] || item.label)}</option>)}</select></div>
      <div className="form-field"><label htmlFor="account-currency">{tr("العملة","Currency")}</label><select id="account-currency" value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="LYD">Libyan dinar (LYD)</option><option value="USD">US dollar (USD)</option><option value="EUR">Euro (EUR)</option><option value="GBP">British pound (GBP)</option><option value="SYP">Syrian pound (SYP)</option><option value="JOD">Jordanian dinar (JOD)</option></select></div>
      <div className="form-field"><label htmlFor="account-balance">{tr("الرصيد الافتتاحي","Opening balance")}</label><input id="account-balance" type="number" step="0.01" required value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} dir="ltr" /></div>
      <div className="form-field"><label htmlFor="account-institution">{tr("البنك أو الجهة (اختياري)","Bank or institution (optional)")}</label><input id="account-institution" maxLength={100} value={institution} onChange={(event) => setInstitution(event.target.value)} /></div>
      <div className="form-field"><label htmlFor="account-last-four">{tr("آخر 4 أرقام (اختياري)","Last 4 digits (optional)")}</label><input id="account-last-four" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={lastFour} onChange={(event) => setLastFour(event.target.value)} dir="ltr" placeholder="1234" /></div>
      <button type="submit" className="primary-button form-submit" disabled={saving}>{saving ? tr("جارٍ الحفظ…", "Saving…") : tr("حفظ الحساب", "Save account")}</button>
    </form>}
    <div className="balance-summary">
      {Object.entries(totalByCurrency).length === 0 ? <div><span>{tr("إجمالي الأرصدة","Total balances")}</span><strong>—</strong><small>{tr("أضف حسابًا لعرض الرصيد حسب العملة.","Add an account to view balances by currency.")}</small></div> : Object.entries(totalByCurrency).map(([code, total]) => <div key={code}><span>{tr("إجمالي الأرصدة النشطة","Active balances total")} · {code}</span><strong dir="ltr">{money(total, code)}</strong><small>{accounts.filter((item) => item.is_active && item.currency_code === code).length} حساب نشط</small></div>)}
    </div>
    {loading ? <div className="empty-state">{tr("جارٍ تحميل الحسابات…","Loading accounts…")}</div> : accounts.length === 0 ? <div className="empty-state"><span className="empty-icon"><Icon name="wallet" size={28} /></span><h3>{tr("لا توجد حسابات بعد","No accounts yet")}</h3><p>{tr("أضف حسابك الأول لبدء تنظيم أموالك.","Add your first account to start organizing your money.")}</p><button type="button" className="secondary-button" onClick={() => setShowForm(true)}>{tr("إضافة أول حساب", "Add your first account")}</button></div> : <div className="account-list">
      {accounts.map((account) => <article className={account.is_active ? "account-row" : "account-row inactive"} key={account.id}>
        <span className="account-type-icon">{(accountTypes.find((item) => item.value === account.type)?.label.slice(0, 1) ?? "A")}</span>
        <div className="account-details"><h3>{account.name}</h3><p>{account.institution_name || accountTypes.find((item) => item.value === account.type)?.label}{account.last_four ? ` · •••• ${account.last_four}` : ""}</p><span className={account.is_active ? "account-status" : "account-status off"}>{account.is_active ? tr("نشط", "Active") : tr("متوقف", "Inactive")}</span></div>
        <div className="account-balance"><strong dir="ltr">{money(Number(account.current_balance), account.currency_code)}</strong><button type="button" className="text-button" onClick={() => void toggleAccount(account)}>{account.is_active ? tr("إيقاف الحساب", "Deactivate account") : tr("تفعيل الحساب", "Activate account")}</button></div>
      </article>)}
    </div>}
  </section>;
}
