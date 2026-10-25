import { useCallback, useEffect, useState } from "react";
import { Icon } from "../../../../packages/ui/src";
import { supabase } from "../lib/supabase";

type Category = { id: string; user_id: string | null; name: string; kind: "income" | "expense" | "adjustment" | "transfer"; icon: string | null; color: string | null; is_system: boolean };

export default function CategoryManager() {
  const en = typeof document !== "undefined" && document.documentElement.lang === "en";
  const tr = (ar: string, english: string) => en ? english : ar;
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Category["kind"]>("expense");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const result = await supabase.from("categories").select("id,user_id,name,kind,icon,color,is_system").order("is_system", { ascending: false }).order("name");
    if (result.error) setError(result.error.message); else setRows((result.data ?? []) as Category[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openNew() {
    setEditing(null); setName(""); setKind("expense"); setError(""); setNotice(""); setShowForm(true);
  }
  function openEdit(row: Category) {
    if (row.is_system) return;
    setEditing(row); setName(row.name); setKind(row.kind); setError(""); setNotice(""); setShowForm(true);
  }
  async function save() {
    if (!supabase) return;
    const clean = name.trim();
    if (clean.length < 2 || clean.length > 60) { setError(tr("اسم التصنيف يجب أن يكون بين حرفين و60 حرفًا.", "Category name must be between 2 and 60 characters.")); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError(tr("انتهت جلسة الدخول.", "Your session has expired.")); return; }
    setSaving(true); setError(""); setNotice("");
    const result = editing
      ? await supabase.from("categories").update({ name: clean, kind }).eq("id", editing.id).eq("user_id", auth.user.id)
      : await supabase.from("categories").insert({ user_id: auth.user.id, name: clean, kind, icon: null, color: null, is_system: false });
    if (result.error) setError(result.error.message);
    else { setNotice(tr("تم حفظ التصنيف.", "Category saved.")); setShowForm(false); setEditing(null); setName(""); await load(); }
    setSaving(false);
  }
  async function remove(row: Category) {
    if (!supabase || row.is_system) return;
    const result = await supabase.from("categories").delete().eq("id", row.id);
    if (result.error) setError(result.error.message); else { setNotice(tr("تم حذف التصنيف.", "Category deleted.")); await load(); }
  }

  const income = rows.filter(row => row.kind === "income");
  const expense = rows.filter(row => row.kind === "expense");
  const render = (items: Category[]) => items.map(row => (
    <article className="data-row" key={row.id}>
      <span className="account-type-icon"><Icon name={row.icon as any || (row.kind === "income" ? "trending-up" : "tag")} size={18} /></span>
      <div><strong>{row.name}</strong><small>{row.is_system ? tr("تصنيف نظامي", "System category") : tr("تصنيفك", "Your category")}</small></div>
      {!row.is_system && <div className="category-actions"><button type="button" className="text-button" onClick={() => openEdit(row)}>{tr("تعديل", "Edit")}</button><button type="button" className="text-button danger-text" onClick={() => void remove(row)}>{tr("حذف", "Delete")}</button></div>}
    </article>
  ));

  return <section className="category-manager dashboard-panel" aria-labelledby="category-manager-title">
    <header><div><p className="eyebrow">{tr("إدارة البيانات الأساسية", "Reference data")}</p><h3 id="category-manager-title">{tr("التصنيفات", "Categories")}</h3><p className="muted-copy">{tr("التصنيفات النظامية جاهزة، ويمكنك إنشاء تصنيفاتك الخاصة دون تعديل بيانات النظام.", "System categories are ready; you can create your own without changing system data.")}</p></div><button type="button" className="secondary-button compact-button" onClick={() => showForm ? setShowForm(false) : openNew()}>{showForm ? tr("إلغاء", "Cancel") : "+ " + tr("إضافة تصنيف", "Add category")}</button></header>
    {error && <p className="notice error" role="alert">{error}</p>}{notice && <p className="notice success" role="status">{notice}</p>}
    {showForm && <div className="account-form"><div className="form-field"><label>{tr("اسم التصنيف", "Category name")}</label><input maxLength={60} value={name} onChange={e => setName(e.target.value)} /></div><div className="form-field"><label>{tr("النوع", "Kind")}</label><select value={kind} onChange={e => setKind(e.target.value as Category["kind"])}><option value="expense">{tr("مصروف", "Expense")}</option><option value="income">{tr("دخل", "Income")}</option></select></div><button type="button" className="primary-button form-submit" disabled={saving} onClick={() => void save()}>{saving ? tr("جارٍ الحفظ…", "Saving…") : tr("حفظ التصنيف", "Save category")}</button></div>}
    {loading ? <p className="empty-copy">{tr("جارٍ تحميل التصنيفات…", "Loading categories…")}</p> : <div className="category-columns"><div><h4>{tr("الدخل", "Income")}</h4>{render(income)}</div><div><h4>{tr("المصروفات", "Expenses")}</h4>{render(expense)}</div></div>}
  </section>;
}
