import { afterEach, describe, expect, it, vi } from "vitest";
import { consumeAiRateLimit, runAiAssistant, validateAiRequest } from "./index.js";

describe("AI request validation", () => {
  it("accepts a supported assistant request", () => {
    expect(validateAiRequest({ task: "assistant", input: "حلل مصروفاتي" })).toEqual({ ok: true, value: { task: "assistant", input: "حلل مصروفاتي" } });
  });
  it("defaults task and trims whitespace", () => {
    expect(validateAiRequest({ input: "  Hello  " })).toEqual({ ok: true, value: { task: "assistant", input: "Hello" } });
  });
  it("rejects unsupported task and oversized input", () => {
    expect(validateAiRequest({ task: "admin", input: "hello" })).toEqual({ ok: false, error: "INVALID_AI_TASK" });
    expect(validateAiRequest({ input: "x".repeat(2001) })).toEqual({ ok: false, error: "AI_INPUT_TOO_LONG" });
  });
  it("rejects empty or malformed input", () => {
    expect(validateAiRequest({ input: "  " })).toEqual({ ok: false, error: "AI_INPUT_REQUIRED" });
    expect(validateAiRequest(null)).toEqual({ ok: false, error: "INVALID_BODY" });
  });
});

describe("AI per-user request limit", () => {
  it("allows twelve requests in a minute and rejects the thirteenth", () => {
    const user = "rate-test-" + Math.random().toString(36).slice(2);
    for (let i = 0; i < 12; i++) expect(consumeAiRateLimit(user, 100_000 + i)).toBe(true);
    expect(consumeAiRateLimit(user, 100_100)).toBe(false);
    expect(consumeAiRateLimit(user, 161_000)).toBe(true);
  });
});

describe("free local financial assistant", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const rows: Record<string, unknown[]> = {
    transactions: [
      { type: "income", status: "completed", amount: 1000, currency_code: "LYD", description: "Salary", transaction_date: "2026-10-01", category_id: "income" },
      { type: "expense", status: "completed", amount: 300, currency_code: "LYD", description: "Food", transaction_date: "2026-10-02", category_id: "food" },
      { type: "expense", status: "completed", amount: 50, currency_code: "USD", description: "Travel", transaction_date: "2026-10-03", category_id: "travel" },
    ],
    accounts: [{ name: "Main", currency_code: "LYD", is_active: true }],
    budgets: [{ name: "Food budget", amount: 200, currency_code: "LYD", period: "monthly", category_id: "food", start_date: "2026-10-01", end_date: null, is_active: true }],
    categories: [{ id: "income", name: "Income" }, { id: "food", name: "Food" }, { id: "travel", name: "Travel" }],
  };
  const client = { from: (table: string) => {
    const query: any = { select: () => query, order: () => query, limit: async () => ({ data: rows[table] ?? [], error: null }) };
    return query;
  }};

  it("calculates totals separately by currency without provider credentials", async () => {
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await runAiAssistant(client, { task: "financial-insights", input: "Show my income and spending" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model).toBe("bye-pro-local-finance-v1");
      expect(result.answer).toContain("income 1,000 LYD");
      expect(result.answer).toContain("expenses 300 LYD");
      expect(result.answer).toContain("50 USD");
      expect(result.answer).toContain("Food budget");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("routes spending questions to category-level analysis", async () => {
    const result = await runAiAssistant(client, { task: "assistant", input: "Show my top spending categories" });
    expect(result.ok).toBe(true);
    if (result.ok) { expect(result.answer).toContain("Food"); expect(result.answer).toContain("expenses by category"); }
  });

  it("gives saving guidance tied to recorded categories", async () => {
    const result = await runAiAssistant(client, { task: "assistant", input: "How can I save money?" });
    expect(result.ok).toBe(true);
    if (result.ok) { expect(result.answer).toContain("Practical saving steps"); expect(result.answer).toContain("Food"); }
  });
  it("answers in Arabic when the user writes in Arabic", async () => {
    const result = await runAiAssistant(client, { task: "assistant", input: "حلل مصروفاتي" });
    expect(result.ok).toBe(true);
    if (result.ok) { expect(result.answer).toContain("مساعد BYE PRO FINANCE"); expect(result.answer).toContain("LYD"); }
  });

  it("returns a safe error when financial data cannot be read", async () => {
    const brokenClient = { from: () => {
      const query: any = { select: () => query, order: () => query, limit: async () => ({ data: null, error: { message: "failed" } }) };
      return query;
    }};
    await expect(runAiAssistant(brokenClient, { task: "assistant", input: "help" })).resolves.toEqual({ ok: false, status: 502, error: "FINANCIAL_DATA_UNAVAILABLE" });
  });
});
