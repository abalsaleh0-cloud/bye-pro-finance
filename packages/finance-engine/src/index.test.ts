import { describe, expect, it } from "vitest";
import { summarizeByCurrency } from "./index";

describe("summarizeByCurrency", () => {
  it("keeps currencies separate and calculates net totals", () => {
    expect(summarizeByCurrency([
      { amount: 100, currency_code: "LYD", type: "income", status: "completed" },
      { amount: 25, currency_code: "LYD", type: "expense", status: "completed" },
      { amount: 10, currency_code: "USD", type: "income", status: "completed" },
    ])).toEqual({
      LYD: { income: 100, expense: 25, adjustment: 0, net: 75 },
      USD: { income: 10, expense: 0, adjustment: 0, net: 10 },
    });
  });

  it("ignores transfers, cancelled rows and non-finite amounts", () => {
    expect(summarizeByCurrency([
      { amount: 50, currency_code: "LYD", type: "transfer", status: "completed" },
      { amount: 20, currency_code: "LYD", type: "expense", status: "cancelled" },
      { amount: Number.NaN, currency_code: "LYD", type: "income", status: "completed" },
    ])).toEqual({});
  });

  it("includes adjustments in net totals", () => {
    expect(summarizeByCurrency([
      { amount: -3, currency_code: "LYD", type: "adjustment", status: "completed" },
    ])).toEqual({
      LYD: { income: 0, expense: 0, adjustment: -3, net: -3 },
    });
  });
});
