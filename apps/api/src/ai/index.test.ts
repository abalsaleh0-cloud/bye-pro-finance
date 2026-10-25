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

describe("AI provider integration", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("returns an explicit setup error instead of fabricating an answer", async () => {
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    const client = { from: () => { throw new Error("DB should not be queried without provider credentials"); } };
    await expect(runAiAssistant(client, { task: "assistant", input: "How much did I spend?" })).resolves.toEqual({
      ok: false, status: 503, error: "AI_PROVIDER_NOT_CONFIGURED",
    });
  });

  it("maps provider throttling and outages to stable safe errors", async () => {
    vi.stubEnv("AI_API_KEY", "unit-test-key");
    vi.stubEnv("AI_BASE_URL", "https://provider.example/v1");
    const rows: Record<string, unknown[]> = { transactions: [], accounts: [], budgets: [], categories: [] };
    const client = { from: (table: string) => {
      const query: any = { select: () => query, order: () => query, limit: async () => ({ data: rows[table] ?? [], error: null }) };
      return query;
    }};
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));
    await expect(runAiAssistant(client, { task: "assistant", input: "help" })).resolves.toMatchObject({ ok: false, status: 429, error: "AI_PROVIDER_RATE_LIMITED" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("Timed out", "TimeoutError"); }));
    await expect(runAiAssistant(client, { task: "assistant", input: "help" })).resolves.toMatchObject({ ok: false, status: 504, error: "AI_PROVIDER_TIMEOUT" });
  });
  it("sends RLS-scoped financial context to the configured OpenAI-compatible provider", async () => {
    vi.stubEnv("AI_API_KEY", "unit-test-key");
    vi.stubEnv("AI_BASE_URL", "https://provider.example/v1");
    vi.stubEnv("AI_MODEL", "test-model");
    const rows = {
      transactions: [{ type: "income", status: "completed", amount: 100, currency_code: "LYD", description: "Salary", transaction_date: "2026-10-01", category_id: "cat-income" }, { type: "expense", status: "completed", amount: 25, currency_code: "LYD", description: "Food", transaction_date: "2026-10-02", category_id: "cat-food" }],
      accounts: [{ name: "Main", currency_code: "LYD", is_active: true }],
      budgets: [{ name: "Food budget", amount: 200, currency_code: "LYD", period: "monthly", category_id: "cat-food", start_date: "2026-10-01", end_date: null, is_active: true }],
      categories: [{ id: "cat-income", name: "Income" }, { id: "cat-food", name: "Food" }],
    } as Record<string, unknown[]>;
    const client = { from: (table: string) => {
      const query: any = { select: () => query, order: () => query, limit: async () => ({ data: rows[table] ?? [], error: null }) };
      return query;
    }};
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("test-model");
      expect(body.max_tokens).toBe(700);
      expect(JSON.stringify(body.messages)).toContain("Food budget");
      expect(JSON.stringify(body.messages)).toContain("LYD");
      return new Response(JSON.stringify({ model: "test-model", choices: [{ message: { content: "Your recorded income is 100 LYD and expenses are 25 LYD." } }], usage: { total_tokens: 25 } }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(runAiAssistant(client, { task: "financial-insights", input: "Analyze my spending" })).resolves.toMatchObject({
      ok: true, answer: "Your recorded income is 100 LYD and expenses are 25 LYD.", model: "test-model", usage: { total_tokens: 25 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
