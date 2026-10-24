import { describe, expect, it } from "vitest";
import { validateTransferInput } from "./transfers";

const from = "11111111-1111-4111-8111-111111111111";
const to = "22222222-2222-4222-8222-222222222222";

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
});
