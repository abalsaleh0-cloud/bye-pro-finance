import { describe, expect, it } from "vitest";
import { isValidPositiveAmount, progressRatio, summarizeLedger } from "./finance";

describe("summarizeLedger", () => {
  it("sums completed income, expenses and adjustments per currency", () => {
    expect(summarizeLedger([
      { amount: 100, currency_code: "LYD", status: "completed", type: "income" },
      { amount: 25, currency_code: "LYD", status: "completed", type: "expense" },
      { amount: 5, currency_code: "LYD", status: "completed", type: "adjustment" },
    ])).toEqual({ LYD: { income: 100, expense: 25, adjustment: 5, net: 80 } });
  });

  it("does not include pending, cancelled or transfer entries", () => {
    expect(summarizeLedger([
      { amount: 100, currency_code: "LYD", status: "pending", type: "income" },
      { amount: 100, currency_code: "LYD", status: "cancelled", type: "income" },
      { amount: 100, currency_code: "LYD", status: "completed", type: "transfer" },
    ])).toEqual({});
  });

  it("never combines different currencies", () => {
    const result = summarizeLedger([
      { amount: 10, currency_code: "LYD", status: "completed", type: "income" },
      { amount: 10, currency_code: "USD", status: "completed", type: "expense" },
    ]);
    expect(result.LYD.net).toBe(10);
    expect(result.USD.net).toBe(-10);
  });
});

describe("isValidPositiveAmount", () => {
  it("accepts positive finite amounts only", () => {
    expect(isValidPositiveAmount(0.01)).toBe(true);
    expect(isValidPositiveAmount(0)).toBe(false);
    expect(isValidPositiveAmount(-1)).toBe(false);
    expect(isValidPositiveAmount(Number.NaN)).toBe(false);
    expect(isValidPositiveAmount(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("progressRatio", () => {
  it("clamps progress and handles invalid targets", () => {
    expect(progressRatio(25, 100)).toBe(0.25);
    expect(progressRatio(120, 100)).toBe(1);
    expect(progressRatio(-10, 100)).toBe(0);
    expect(progressRatio(10, 0)).toBe(0);
  });
});
