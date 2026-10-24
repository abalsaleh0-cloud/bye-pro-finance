import { describe, expect, it } from "vitest";
import { validateTransactionInput } from "./transactions.js";

const valid = {
  account_id: "123e4567-e89b-42d3-a456-426614174000",
  type: "expense",
  amount: 12.5,
  currency_code: "LYD",
};

describe("validateTransactionInput", () => {
  it("accepts valid input and applies safe defaults", () => {
    const result = validateTransactionInput(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toMatchObject({ status: "completed", currency_code: "LYD", metadata: {}, category_id: null });
  });
  it("rejects negative, NaN and infinite amounts", () => {
    for (const amount of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(validateTransactionInput({ ...valid, amount }).ok).toBe(false);
    }
  });
  it("rejects invalid account ids and transaction types", () => {
    expect(validateTransactionInput({ ...valid, account_id: "not-a-uuid" }).ok).toBe(false);
    expect(validateTransactionInput({ ...valid, type: "wire" }).ok).toBe(false);
  });
  it("rejects invalid currency and oversized descriptions", () => {
    expect(validateTransactionInput({ ...valid, currency_code: "lyd" }).ok).toBe(false);
    expect(validateTransactionInput({ ...valid, description: "x".repeat(2001) }).ok).toBe(false);
  });
  it("rejects impossible calendar dates while accepting valid dates", () => {
    expect(validateTransactionInput({ ...valid, transaction_date: "2026-02-31" })).toMatchObject({ ok: false, error: "INVALID_TRANSACTION_DATE" });
    expect(validateTransactionInput({ ...valid, transaction_date: "2024-02-29" }).ok).toBe(true);
    expect(validateTransactionInput({ ...valid, transaction_date: "2026-10-24T12:00:00.000Z" }).ok).toBe(true);
  });
  it("never accepts user_id as a trusted output field", () => {
    const result = validateTransactionInput({ ...valid, user_id: "attacker-controlled" });
    expect(result.ok).toBe(true);
    if (result.ok) expect("user_id" in result.value).toBe(false);
  });
});
