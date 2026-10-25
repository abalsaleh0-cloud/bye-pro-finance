export type AiTask = "assistant" | "financial-insights";
export type AiRequest = { task: AiTask; input: string };
export type AiFailure = { ok: false; status: number; error: string };
export type AiSuccess = { ok: true; answer: string; model: string; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };

type QueryClient = { from: (table: string) => any };
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const MAX_INPUT_CHARS = 2_000;
const MAX_OUTPUT_TOKENS = 700;
const PROVIDER_TIMEOUT_MS = 20_000;
const requestWindows = new Map<string, number[]>();

export function validateAiRequest(value: unknown): { ok: true; value: AiRequest } | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "INVALID_BODY" };
  const body = value as Record<string, unknown>;
  const task = body.task ?? "assistant";
  if (task !== "assistant" && task !== "financial-insights") return { ok: false, error: "INVALID_AI_TASK" };
  if (typeof body.input !== "string" || !body.input.trim()) return { ok: false, error: "AI_INPUT_REQUIRED" };
  if (body.input.length > MAX_INPUT_CHARS) return { ok: false, error: "AI_INPUT_TOO_LONG" };
  return { ok: true, value: { task, input: body.input.trim() } };
}

export function consumeAiRateLimit(userId: string, now = Date.now()): boolean {
  const cutoff = now - WINDOW_MS;
  const recent = (requestWindows.get(userId) ?? []).filter((time) => time > cutoff);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    requestWindows.set(userId, recent);
    return false;
  }
  recent.push(now);
  requestWindows.set(userId, recent);
  if (requestWindows.size > 5_000) {
    for (const [key, times] of requestWindows) {
      if (times.every((time) => time <= cutoff)) requestWindows.delete(key);
    }
  }
  return true;
}

type FinancialContext = {
  currencyTotals: Array<{ currency: string; income: number; expenses: number; net: number }>;
  transactionCount: number;
  accounts: Array<{ name: string; currency_code: string; is_active: boolean }>;
  budgets: Array<{ name: string; amount: number; currency: string; period: string; category: string; start_date: string; end_date: string | null; is_active: boolean }>;
  recentTransactions: Array<{ date: string; type: string; amount: number; currency: string; category: string; description: string }>;
};

async function loadFinancialContext(client: QueryClient): Promise<FinancialContext | null> {
  const [transactionsResult, accountsResult, budgetsResult, categoriesResult] = await Promise.all([
    client.from("transactions").select("type,status,amount,currency_code,description,transaction_date,category_id").order("transaction_date", { ascending: false }).limit(200),
    client.from("accounts").select("name,currency_code,is_active").order("name").limit(100),
    client.from("budgets").select("name,amount,currency_code,period,category_id,start_date,end_date,is_active").order("start_date", { ascending: false }).limit(100),
    client.from("categories").select("id,name").limit(500),
  ]);
  if (transactionsResult.error || accountsResult.error || budgetsResult.error || categoriesResult.error) return null;
  const transactions = (transactionsResult.data ?? []) as Array<Record<string, unknown>>;
  const categoryNames = new Map<string, string>(((categoriesResult.data ?? []) as Array<Record<string, unknown>>).map((x) => [String(x.id), String(x.name ?? "Uncategorized").slice(0, 80)]));
  const totals = new Map<string, { currency: string; income: number; expenses: number; net: number }>();
  for (const row of transactions) {
    const currency = typeof row.currency_code === "string" ? row.currency_code : "UNKNOWN";
    if (!totals.has(currency)) totals.set(currency, { currency, income: 0, expenses: 0, net: 0 });
    const total = totals.get(currency)!;
    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount < 0 || row.status !== "completed") continue;
    if (row.type === "income") { total.income += amount; total.net += amount; }
    if (row.type === "expense") { total.expenses += amount; total.net -= amount; }
  }
  return {
    currencyTotals: [...totals.values()].map((x) => ({ currency: x.currency, income: roundMoney(x.income), expenses: roundMoney(x.expenses), net: roundMoney(x.net) })),
    transactionCount: transactions.length,
    accounts: ((accountsResult.data ?? []) as Array<Record<string, unknown>>).map((x) => ({ name: String(x.name ?? "Account").slice(0, 80), currency_code: String(x.currency_code ?? "UNKNOWN"), is_active: Boolean(x.is_active) })),
    budgets: ((budgetsResult.data ?? []) as Array<Record<string, unknown>>).map((x) => ({ name: String(x.name ?? "Budget").slice(0, 80), amount: Number.isFinite(Number(x.amount)) ? Number(x.amount) : 0, currency: String(x.currency_code ?? "UNKNOWN"), period: String(x.period ?? "unknown"), category: categoryNames.get(String(x.category_id)) ?? "All categories", start_date: String(x.start_date ?? ""), end_date: x.end_date == null ? null : String(x.end_date), is_active: Boolean(x.is_active) })),
    recentTransactions: transactions.slice(0, 40).map((x) => ({ date: String(x.transaction_date ?? "").slice(0, 10), type: String(x.type ?? "unknown"), amount: Number.isFinite(Number(x.amount)) ? Number(x.amount) : 0, currency: String(x.currency_code ?? "UNKNOWN"), category: categoryNames.get(String(x.category_id)) ?? "Uncategorized", description: String(x.description ?? "").slice(0, 120) })),
  };
}

function roundMoney(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }

function formatAmount(value: number, currency: string): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " " + currency;
}

function buildLocalAnswer(request: AiRequest, context: FinancialContext): string {
  const arabic = /[\u0600-\u06FF]/.test(request.input);
  const lines: string[] = [];
  if (arabic) {
    lines.push("أنا مساعد BYE PRO FINANCE المجاني المدمج داخل التطبيق. أعمل محليًا بقواعد وحسابات واضحة، ولا أستخدم خدمة ذكاء اصطناعي مدفوعة.");
    lines.push("ملخص البيانات المسجّلة (ضمن آخر 200 حركة متاحة):");
    if (!context.currencyTotals.length) lines.push("لا توجد حركات مالية كافية لعرض إجماليات بعد.");
    for (const item of context.currencyTotals) {
      lines.push("• " + item.currency + ": الدخل " + formatAmount(item.income, item.currency) + "، المصروفات " + formatAmount(item.expenses, item.currency) + "، الصافي " + formatAmount(item.net, item.currency) + ".");
      if (item.net < 0) lines.push("  ملاحظة: المصروفات المسجّلة أعلى من الدخل في " + item.currency + ". راجع المصروفات غير الضرورية قبل وضع ميزانية جديدة.");
      else if (item.income > 0 && item.expenses / item.income >= 0.8) lines.push("  ملاحظة: المصروفات تستهلك 80% أو أكثر من الدخل المسجّل بعملة " + item.currency + ". راقب المصروفات المتغيرة.");
    }
    const activeBudgets = context.budgets.filter((budget) => budget.is_active);
    lines.push("عدد الحسابات: " + context.accounts.length + "، وعدد الميزانيات النشطة: " + activeBudgets.length + ".");
    if (activeBudgets.length) {
      lines.push("الميزانيات النشطة المسجّلة:");
      for (const budget of activeBudgets.slice(0, 8)) lines.push("• " + budget.name + " — " + formatAmount(budget.amount, budget.currency) + " (" + budget.period + ")، الفئة: " + budget.category + ".");
    }
    lines.push("تنبيه: هذه حسابات وملاحظات آلية وليست نصيحة مالية مهنية، وقد لا تشمل البيانات الأقدم من الحد المعروض.");
  } else {
    lines.push("I’m the free built-in BYE PRO FINANCE assistant. I use local rules and calculations; no paid AI provider is called.");
    lines.push("Recorded financial snapshot (up to the latest 200 available transactions):");
    if (!context.currencyTotals.length) lines.push("There are not enough recorded transactions to show totals yet.");
    for (const item of context.currencyTotals) {
      lines.push("• " + item.currency + ": income " + formatAmount(item.income, item.currency) + ", expenses " + formatAmount(item.expenses, item.currency) + ", net " + formatAmount(item.net, item.currency) + ".");
      if (item.net < 0) lines.push("  Note: recorded expenses exceed income in " + item.currency + ". Review discretionary spending before setting a new budget.");
      else if (item.income > 0 && item.expenses / item.income >= 0.8) lines.push("  Note: recorded expenses use at least 80% of income in " + item.currency + ". Monitor variable spending.");
    }
    const activeBudgets = context.budgets.filter((budget) => budget.is_active);
    lines.push("Accounts: " + context.accounts.length + "; active budgets: " + activeBudgets.length + ".");
    if (activeBudgets.length) {
      lines.push("Active recorded budgets:");
      for (const budget of activeBudgets.slice(0, 8)) lines.push("• " + budget.name + " — " + formatAmount(budget.amount, budget.currency) + " (" + budget.period + "), category: " + budget.category + ".");
    }
    lines.push("Note: these are automated calculations and general information, not professional financial advice; older records may fall outside the available data window.");
  }
  return lines.join("\n").slice(0, 8_000);
}

export async function runAiAssistant(client: QueryClient, request: AiRequest): Promise<AiSuccess | AiFailure> {
  const context = await loadFinancialContext(client);
  if (!context) return { ok: false, status: 502, error: "FINANCIAL_DATA_UNAVAILABLE" };
  return { ok: true, answer: buildLocalAnswer(request, context), model: "bye-pro-local-finance-v1" };
}
