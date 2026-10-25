import { describe, expect, it } from "vitest";
import { buildIdempotentTransferId, normalizeIdempotencyKey } from "./idempotency.js";

describe("transfer idempotency", () => {
  it("derives the same UUID for the same user and key", () => {
    const first = buildIdempotentTransferId("11111111-1111-4111-8111-111111111111", "transfer-123");
    const second = buildIdempotentTransferId("11111111-1111-4111-8111-111111111111", "transfer-123");

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("isolates identical keys between users", () => {
    expect(
      buildIdempotentTransferId("11111111-1111-4111-8111-111111111111", "transfer-123"),
    ).not.toBe(
      buildIdempotentTransferId("22222222-2222-4222-8222-222222222222", "transfer-123"),
    );
  });

  it("rejects missing, blank, and oversized keys", () => {
    expect(normalizeIdempotencyKey(undefined)).toBeNull();
    expect(normalizeIdempotencyKey("   ")).toBeNull();
    expect(normalizeIdempotencyKey("x".repeat(256))).toBeNull();
    expect(normalizeIdempotencyKey("  transfer-123  ")).toBe("transfer-123");
  });
});
