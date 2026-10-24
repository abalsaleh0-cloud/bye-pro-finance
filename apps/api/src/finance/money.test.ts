import { describe, expect, it } from "vitest";
import { isValidMoneyAmount } from "./money.js";

describe("money validation", () => {
  it("accepts zero and values with up to four decimals", () => {
    expect(isValidMoneyAmount(0)).toBe(true);
    expect(isValidMoneyAmount(1234.5678)).toBe(true);
  });

  it("rejects negative, non-finite, and oversized values", () => {
    expect(isValidMoneyAmount(-0.01)).toBe(false);
    expect(isValidMoneyAmount(Number.NaN)).toBe(false);
    expect(isValidMoneyAmount(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidMoneyAmount(1_000_000_000_001)).toBe(false);
  });

  it("rejects more than four decimal places and exponential notation", () => {
    expect(isValidMoneyAmount(1.23456)).toBe(false);
    expect(isValidMoneyAmount(1e-7)).toBe(false);
  });

  it("can require a strictly positive amount", () => {
    expect(isValidMoneyAmount(0, { allowZero: false })).toBe(false);
    expect(isValidMoneyAmount(0.01, { allowZero: false })).toBe(true);
  });
});
