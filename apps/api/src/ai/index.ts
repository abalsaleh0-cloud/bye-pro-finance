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
  categoryExpenses: Array<{ category: string; currency: string; amount: number; count: number }>;
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
  const categoryTotals = new Map<string, { category: string; currency: string; amount: number; count: number }>();
  for (const row of transactions) {
    const currency = typeof row.currency_code === "string" ? row.currency_code : "UNKNOWN";
    if (!totals.has(currency)) totals.set(currency, { currency, income: 0, expenses: 0, net: 0 });
    const total = totals.get(currency)!;
    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount < 0 || row.status !== "completed") continue;
    if (row.type === "income") { total.income += amount; total.net += amount; }
    if (row.type === "expense") {
      total.expenses += amount; total.net -= amount;
      const category = categoryNames.get(String(row.category_id)) ?? "Uncategorized";
      const key = currency + "::" + category;
      const bucket = categoryTotals.get(key) ?? { category, currency, amount: 0, count: 0 };
      bucket.amount += amount; bucket.count += 1; categoryTotals.set(key, bucket);
    }
  }
  return {
    currencyTotals: [...totals.values()].map((x) => ({ currency: x.currency, income: roundMoney(x.income), expenses: roundMoney(x.expenses), net: roundMoney(x.net) })),
    transactionCount: transactions.length,
    categoryExpenses: [...categoryTotals.values()].map((x) => ({ ...x, amount: roundMoney(x.amount) })).sort((a, b) => b.amount - a.amount),
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
  const q = request.input.toLocaleLowerCase();
  const has = (...terms: string[]) => terms.some((term) => q.includes(term));
  const wantsSpending = has("مصروف", "انفاق", "إنفاق", "صرف", "spend", "expense", "expenses", "spending", "cost");
  const wantsIncome = has("دخل", "راتب", "income", "salary", "revenue");
  const wantsBudget = has("ميزاني", "budget", "budgets");
  const wantsSave = has("ادخار", "توفير", "وفر", "أوفر", "وفّر", "save", "saving", "savings", "reduce");
  const wantsCategory = has("فئة", "تصنيف", "أكثر شيء", "أعلى مصروف", "category", "categories", "top", "largest", "highest");
  const wantsHelp = has("ماذا تستطيع", "كيف تستخدم", "مساعدة", "help", "what can you do", "capabilities");
  const wantsOverview = has("حلل", "تحليل", "وضعي", "مالي", "مالية", "finance", "financial", "analyze", "analysis", "overview", "summary", "cash flow", "تدفق");
  const recognized = wantsSpending || wantsIncome || wantsBudget || wantsSave || wantsCategory || wantsHelp || wantsOverview;
  const lines: string[] = [];
  if (arabic) {
    lines.push("مساعد BYE PRO FINANCE المجاني — محرك تحليل مالي محلي، لا يرسل بياناتك لمزوّد خارجي ولا ينفّذ معاملات.");
    if (!recognized) { lines.push("أستطيع حاليًا مساعدتك في التحليل المالي فقط. جرّب سؤالًا عن المصروفات، الدخل، أعلى فئات الإنفاق، الميزانيات، أو طرق الادخار. لا أريد إعطاء إجابة غير موثوقة خارج هذه القدرات."); return lines.join("\n"); }
    if (wantsHelp) lines.push("أستطيع تلخيص الدخل والمصروفات لكل عملة، تحديد فئات الإنفاق الأعلى، فحص الميزانيات النشطة، واقتراح خطوات ادخار عامة من البيانات المتاحة.");
    if (wantsSpending || wantsCategory) {
      lines.push("تحليل المصروفات المكتملة حسب العملة (آخر " + context.transactionCount + " حركة متاحة):");
      if (!context.categoryExpenses.length) lines.push("لا توجد مصروفات مكتملة كافية لتحليل الفئات.");
      for (const item of context.categoryExpenses.slice(0, wantsCategory ? 10 : 5)) lines.push("• " + item.category + " — " + formatAmount(item.amount, item.currency) + "، عدد الحركات: " + item.count + ".");
    }
    if (wantsIncome || wantsOverview) {
      lines.push("ملخص التدفق المالي المسجّل لكل عملة:");
      if (!context.currencyTotals.length) lines.push("لا توجد حركات مالية كافية لعرض إجماليات بعد.");
      for (const item of context.currencyTotals) {
        lines.push("• " + item.currency + ": الدخل " + formatAmount(item.income, item.currency) + "، المصروفات " + formatAmount(item.expenses, item.currency) + "، الصافي " + formatAmount(item.net, item.currency) + ".");
        if (item.net < 0) lines.push("  تنبيه: المصروفات أعلى من الدخل المسجّل بعملة " + item.currency + ".");
        else if (item.income > 0 && item.expenses / item.income >= 0.8) lines.push("  تنبيه: المصروفات تستهلك 80% أو أكثر من الدخل المسجّل بعملة " + item.currency + ".");
      }
    }
    if (wantsBudget) {
      const active = context.budgets.filter((b) => b.is_active);
      lines.push("الميزانيات النشطة: " + active.length + ".");
      if (!active.length) lines.push("لم أجد ميزانيات نشطة ضمن البيانات المتاحة. أنشئ ميزانية للفئات المتكررة لمقارنة الصرف بالخطة.");
      for (const budget of active.slice(0, 10)) lines.push("• " + budget.name + ": " + formatAmount(budget.amount, budget.currency) + " (" + budget.period + ") — " + budget.category + ".");
    }
    if (wantsSave) {
      lines.push("خطوات ادخار عملية: حدّد سقفًا أسبوعيًا للفئات الأعلى إنفاقًا، راجع الاشتراكات والمشتريات المتكررة، وحوّل مبلغ ادخار ثابتًا بعد استلام الدخل.");
      const top = context.categoryExpenses[0];
      if (top) lines.push("ابدأ بمراجعة فئة " + top.category + " لأنها الأعلى إنفاقًا في البيانات المتاحة (" + formatAmount(top.amount, top.currency) + ").");
    }
    lines.push("حدود التحليل: يعتمد على البيانات المقروءة فقط (حتى 200 حركة و100 ميزانية)، وقد لا يعكس كل الفترة. هذه معلومات عامة وليست نصيحة مالية مهنية.");
  } else {
    lines.push("BYE PRO FINANCE free assistant — a local financial analysis engine. It sends no records to external AI providers and cannot execute transactions.");
    if (!recognized) { lines.push("I can currently help with financial analysis only. Ask about expenses, income, top spending categories, budgets, or saving strategies. I will not guess beyond these supported capabilities."); return lines.join("\n"); }
    if (wantsHelp) lines.push("I can summarize income and expenses by currency, rank spending categories, review active budgets, and suggest general saving steps based on available records.");
    if (wantsSpending || wantsCategory) {
      lines.push("Completed expenses by category (latest " + context.transactionCount + " available transactions):");
      if (!context.categoryExpenses.length) lines.push("There are not enough completed expenses to analyze categories.");
      for (const item of context.categoryExpenses.slice(0, wantsCategory ? 10 : 5)) lines.push("• " + item.category + " — " + formatAmount(item.amount, item.currency) + ", transactions: " + item.count + ".");
    }
    if (wantsIncome || wantsOverview) {
      lines.push("Recorded cash flow by currency:");
      if (!context.currencyTotals.length) lines.push("There are not enough recorded transactions to show totals yet.");
      for (const item of context.currencyTotals) {
        lines.push("• " + item.currency + ": income " + formatAmount(item.income, item.currency) + ", expenses " + formatAmount(item.expenses, item.currency) + ", net " + formatAmount(item.net, item.currency) + ".");
        if (item.net < 0) lines.push("  Alert: recorded expenses exceed income in " + item.currency + ".");
        else if (item.income > 0 && item.expenses / item.income >= 0.8) lines.push("  Alert: recorded expenses use at least 80% of recorded income in " + item.currency + ".");
      }
    }
    if (wantsBudget) {
      const active = context.budgets.filter((b) => b.is_active);
      lines.push("Active budgets: " + active.length + ".");
      if (!active.length) lines.push("No active budgets were found in the available data. Create budgets for recurring categories to compare actual spending with your plan.");
      for (const budget of active.slice(0, 10)) lines.push("• " + budget.name + ": " + formatAmount(budget.amount, budget.currency) + " (" + budget.period + ") — " + budget.category + ".");
    }
    if (wantsSave) {
      lines.push("Practical saving steps: set a weekly cap for high-spend categories, review recurring subscriptions and purchases, and move a fixed amount into savings after income arrives.");
      const top = context.categoryExpenses[0];
      if (top) lines.push("Start by reviewing " + top.category + ", the highest-spend category in the available data (" + formatAmount(top.amount, top.currency) + ").");
    }
    lines.push("Analysis limits: it uses only readable records (up to 200 transactions and 100 budgets) and may not cover the full period. General information only, not professional financial advice.");
  }
  return lines.join("\n").slice(0, 8_000);
}
export async function runAiAssistant(client: QueryClient, request: AiRequest): Promise<AiSuccess | AiFailure> {
  const context = await loadFinancialContext(client);
  if (!context) return { ok: false, status: 502, error: "FINANCIAL_DATA_UNAVAILABLE" };
  return { ok: true, answer: buildLocalAnswer(request, context), model: "bye-pro-local-finance-v1" };
}
