import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateTransferInput } from "./transfers.js";
import { normalizeIdempotencyKey } from "./idempotency.js";
import { readBearerToken, requireBearerToken } from "../security/auth.js";

describe("transfer validation", () => {
  const valid = {
    from_account_id: "11111111-1111-4111-8111-111111111111",
    to_account_id: "22222222-2222-4222-8222-222222222222",
    amount: 100,
    fee: 1,
    currency_code: "LYD",
    description: "Transfer",
    transfer_date: "2026-01-15",
    status: "completed",
  };

  it("accepts a valid positive transfer", () => {
    const result = validateTransferInput(valid);
    expect(result.ok).toBe(true);
  });

  it("rejects zero and negative amounts", () => {
    expect(validateTransferInput({ ...valid, amount: 0 }).ok).toBe(false);
    expect(validateTransferInput({ ...valid, amount: -1 }).ok).toBe(false);
  });

  it("rejects the same account", () => {
    expect(validateTransferInput({ ...valid, to_account_id: valid.from_account_id }).ok).toBe(false);
  });

  it("rejects invalid fee and dates", () => {
    expect(validateTransferInput({ ...valid, fee: -1 }).ok).toBe(false);
    expect(validateTransferInput({ ...valid, transfer_date: "2026-02-30" }).ok).toBe(false);
  });

  it("rejects unsupported currencies and statuses", () => {
    expect(validateTransferInput({ ...valid, currency_code: "USD$" }).ok).toBe(false);
    expect(validateTransferInput({ ...valid, status: "unknown" }).ok).toBe(false);
  });

  it("rejects non-object bodies, malformed UUIDs, and excessive precision", () => {
    expect(validateTransferInput(null).ok).toBe(false);
    expect(validateTransferInput({ ...valid, from_account_id: "bad" }).ok).toBe(false);
    expect(validateTransferInput({ ...valid, amount: 1.234 }).ok).toBe(false);
  });

  it("accepts and normalizes a valid budget", () => {
    expect(normalizeIdempotencyKey(" transfer-123 ")).toBe("transfer-123");
  });

  it("rejects invalid idempotency keys", () => {
    expect(normalizeIdempotencyKey(" ")).toBeNull();
    expect(normalizeIdempotencyKey("x".repeat(300))).toBeNull();
  });

  it("keeps bearer authentication safe and case-insensitive", () => {
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

  it("keeps only server-owned financial operations on API routes", () => {
    const server = readFileSync("apps/api/src/server.ts", "utf8");
    expect(server).toContain("const auth = await authenticate(request, response);");
    expect(server).toContain("if (!auth) return;");
    expect(server).toContain("user_id: auth.identity.id");
    expect(server).toContain("INVALID_IDEMPOTENCY_KEY");
    expect(server).toContain("TRANSFER_IDEMPOTENCY_CONFLICT");
    expect(server).not.toContain('url.pathname === "/api/v1/accounts"');
    expect(server).not.toContain('url.pathname === "/api/v1/budgets"');
    expect(server).not.toContain('url.pathname === "/api/v1/transactions"');
  });
});
