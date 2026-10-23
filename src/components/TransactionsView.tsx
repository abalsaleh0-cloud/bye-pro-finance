import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { summarizeLedger, isValidPositiveAmount } from "../lib/finance";
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
    if (!isValidPositiveAmount(numericAmount)) {
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
  const totals = summarizeLedger(visibleItems);
