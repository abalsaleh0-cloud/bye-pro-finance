import { describe, expect, it } from "vitest";
import { validateBudgetInput } from "./budgets.js";
const valid = { name: "Monthly essentials", amount: 500, currency_code: "LYD", period: "monthly", start_date: "2026-10-01", end_date: "2026-10-31" };
describe("validateBudgetInput", () => {
  it("accepts valid budgets and trims names", () => {
    const result = validateBudgetInput({ ...valid, name: "  Food  " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toMatchObject({ name: "Food", category_id: null, currency_code: "LYD" });
  });
  it("rejects negative and non-finite amounts", () => {
    for (const amount of [-1, Number.NaN, Number.POSITIVE_INFINITY]) expect(validateBudgetInput({ ...valid, amount }).ok).toBe(false);
  });
  it("rejects unsupported periods and malformed categories", () => {
    expect(validateBudgetInput({ ...valid, period: "daily" }).ok).toBe(false);
    expect(validateBudgetInput({ ...valid, category_id: "not-a-uuid" }).ok).toBe(false);
  });
  it.each(["2026-02-29", "2026-04-31", "2026-13-01"])("rejects invalid calendar date %s", (date) => {
    expect(validateBudgetInput({ ...valid, start_date: date })).toMatchObject({ ok: false, error: "INVALID_START_DATE" });
    expect(validateBudgetInput({ ...valid, end_date: date })).toMatchObject({ ok: false, error: "INVALID_END_DATE" });
  });
  it("accepts leap day in a leap year", () => {
    expect(validateBudgetInput({ ...valid, start_date: "2024-02-29" }).ok).toBe(true);
  });
  it("rejects reversed dates and invalid currencies", () => {
    expect(validateBudgetInput({ ...valid, start_date: "2026-11-01", end_date: "2026-10-01" }).ok).toBe(false);
    expect(validateBudgetInput({ ...valid, currency_code: "lyd" }).ok).toBe(false);
  });
});
