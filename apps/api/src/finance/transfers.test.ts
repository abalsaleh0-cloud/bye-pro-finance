import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readBearerToken, requireBearerToken } from "../security/auth.js";
import { validateBudgetInput } from "./budgets.js";
import { validateTransferInput } from "./transfers.js";
import { readJsonBody, validateTransactionInput } from "./transactions.js";

const from = "11111111-1111-4111-8111-111111111111";
const to = "22222222-2222-4222-8222-222222222222";
const category = "33333333-3333-4333-8333-333333333333";

const valid = () => validateTransferInput({
  from_account_id: from,
  to_account_id: to,
  amount: 100.25,
  fee: 1.5,
  currency_code: "LYD",
});

describe("transfer validation", () => {
  it("accepts a valid positive transfer", () => {
    const result = valid();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe("completed");
  });

  it("rejects zero and negative amounts", () => {
    expect(validateTransferInput({ from_account_id: from, to_account_id: to, amount: 0, currency_code: "LYD" })).toEqual({ ok: false, error: "INVALID_AMOUNT" });
    expect(validateTransferInput({ from_account_id: from, to_account_id: to, amount: -1, currency_code: "LYD" })).toEqual({ ok: false, error: "INVALID_AMOUNT" });
  });

  it("rejects the same account", () => {
    expect(validateTransferInput({ from_account_id: from, to_account_id: from, amount: 10, currency_code: "LYD" })).toEqual({ ok: false, error: "SAME_ACCOUNT_TRANSFER" });
  });

  it("rejects invalid fee and dates", () => {
    expect(validateTransferInput({ from_account_id: from, to_account_id: to, amount: 10, fee: -0.01, currency_code: "LYD" })).toEqual({ ok: false, error: "INVALID_FEE" });
    expect(validateTransferInput({ from_account_id: from, to_account_id: to, amount: 10, currency_code: "LYD", transfer_date: "2026-02-31T12:00:00.000Z" })).toEqual({ ok: false, error: "INVALID_TRANSFER_DATE" });
  });

  it("rejects unsupported currencies and statuses", () => {
    expect(validateTransferInput({ from_account_id: from, to_account_id: to, amount: 10, currency_code: "usd" })).toEqual({ ok: false, error: "INVALID_CURRENCY" });
    expect(validateTransferInput({ from_account_id: from, to_account_id: to, amount: 10, currency_code: "LYD", status: "done" })).toEqual({ ok: false, error: "INVALID_TRANSFER_STATUS" });
  });

  it("rejects non-object bodies, malformed UUIDs, and excessive precision", () => {
    expect(validateTransferInput(null)).toEqual({ ok: false, error: "INVALID_BODY" });
    expect(validateTransferInput({ from_account_id: "bad", to_account_id: to, amount: 1, currency_code: "LYD" })).toEqual({ ok: false, error: "INVALID_FROM_ACCOUNT_ID" });
    expect(validateTransferInput({ from_account_id: from, to_account_id: to, amount: 1.23456, currency_code: "LYD" })).toEqual({ ok: false, error: "INVALID_AMOUNT" });
  });
});

describe("budget validation", () => {
  const base = { name: "Monthly plan", amount: 1000, currency_code: "LYD", period: "monthly", start_date: "2026-10-01" };

  it("accepts and normalizes a valid budget", () => {
    const result = validateBudgetInput({ ...base, name: "  Monthly plan  ", category_id: category });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("Monthly plan");
      expect(result.value.end_date).toBeNull();
      expect(result.value.category_id).toBe(category);
    }
  });

  it("rejects invalid budget periods and calendar dates", () => {
    expect(validateBudgetInput({ ...base, period: "daily" })).toEqual({ ok: false, error: "INVALID_PERIOD" });
    expect(validateBudgetInput({ ...base, start_date: "2026-02-30" })).toEqual({ ok: false, error: "INVALID_START_DATE" });
    expect(validateBudgetInput({ ...base, end_date: "2026-09-30" })).toEqual({ ok: false, error: "END_DATE_BEFORE_START" });
  });

  it("rejects invalid identifiers, money, and names", () => {
    expect(validateBudgetInput({ ...base, category_id: "bad" })).toEqual({ ok: false, error: "INVALID_CATEGORY_ID" });
    expect(validateBudgetInput({ ...base, amount: 0 })).toEqual({ ok: false, error: "INVALID_AMOUNT" });
    expect(validateBudgetInput({ ...base, name: "   " })).toEqual({ ok: false, error: "INVALID_NAME" });
  });
});

describe("transaction validation and body parsing", () => {
  it("accepts a valid transaction and applies safe defaults", () => {
    const result = validateTransactionInput({ account_id: from, type: "expense", amount: 25.5 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.currency_code).toBe("LYD");
      expect(result.value.status).toBe("completed");
      expect(result.value.metadata).toEqual({});
    }
  });

  it("rejects transfer as a generic transaction type", () => {
    expect(validateTransactionInput({ account_id: from, type: "transfer", amount: 25 })).toEqual({ ok: false, error: "INVALID_TRANSACTION_TYPE" });
  });

  it("rejects malformed metadata, references, dates, and descriptions", () => {
    expect(validateTransactionInput({ account_id: from, type: "expense", amount: 1, metadata: [] })).toEqual({ ok: false, error: "INVALID_METADATA" });
    expect(validateTransactionInput({ account_id: from, type: "expense", amount: 1, reference: "x".repeat(201) })).toEqual({ ok: false, error: "INVALID_REFERENCE" });
    expect(validateTransactionInput({ account_id: from, type: "expense", amount: 1, transaction_date: "2026-02-31" })).toEqual({ ok: false, error: "INVALID_TRANSACTION_DATE" });
    expect(validateTransactionInput({ account_id: from, type: "expense", amount: 1, description: "x".repeat(2001) })).toEqual({ ok: false, error: "INVALID_DESCRIPTION" });
  });

  it("parses valid JSON from an async byte stream", async () => {
    const stream = (async function* () {
      yield new TextEncoder().encode('{"amount":10');
      yield new TextEncoder().encode(',"currency":"LYD"}');
    })();
    await expect(readJsonBody(stream)).resolves.toEqual({ amount: 10, currency: "LYD" });
  });

  it("rejects invalid JSON and oversized request bodies", async () => {
    const invalid = (async function* () { yield new TextEncoder().encode("not-json"); })();
    await expect(readJsonBody(invalid)).rejects.toThrow("INVALID_JSON");
    const oversized = (async function* () { yield new Uint8Array(65 * 1024); })();
    await expect(readJsonBody(oversized)).rejects.toThrow("BODY_TOO_LARGE");
  });
});

describe("security and API contract regression checks", () => {
  it("parses bearer authentication safely and case-insensitively", () => {
    expect(readBearerToken({ authorization: "Bearer abc123" })).toBe("abc123");
    expect(readBearerToken({ authorization: "bEaReR   abc123  " })).toBe("abc123");
    expect(readBearerToken({ authorization: "Basic abc123" })).toBeNull();
    expect(readBearerToken({ authorization: "Bearer    " })).toBeNull();
    expect(() => requireBearerToken({})).toThrow("AUTH_REQUIRED");
  });

  it("keeps API responses non-cacheable and protected against basic browser sniffing/frame embedding", () => {
    const response = readFileSync("apps/api/src/security/response.ts", "utf8");
    expect(response).toContain('Cache-Control", "no-store"');
    expect(response).toContain('X-Content-Type-Options", "nosniff"');
    expect(response).toContain('X-Frame-Options", "DENY"');
    expect(response).toContain('Referrer-Policy", "no-referrer"');
  });

  it("uses the caller token for the Supabase user-scoped client", () => {
    const client = readFileSync("apps/api/src/database/user-client.ts", "utf8");
    expect(client).toContain("Authorization: `Bearer ${accessToken}`");
    expect(client).toContain("persistSession: false");
    expect(client).toContain("autoRefreshToken: false");
  });

  it("enforces authentication and user-scoped writes on API routes", () => {
    const server = readFileSync("apps/api/src/server.ts", "utf8");
    expect(server).toContain("const auth = await authenticate(request, response);");
    expect(server).toContain("if (!auth) return;");
    expect(server).toContain("user_id: auth.identity.id");
    expect(server).toContain('error: "INVALID_TRANSACTION_TYPE"');
    expect(server).toContain('Math.min(parsedLimit, 100)');
  });
});
