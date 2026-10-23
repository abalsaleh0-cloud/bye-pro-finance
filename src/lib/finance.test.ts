import { describe, expect, it } from "vitest";

function sumAmounts(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

describe("finance arithmetic baseline", () => {
  it("sums empty input as zero", () => {
    expect(sumAmounts([])).toBe(0);
  });

  it("sums positive and negative ledger deltas", () => {
    expect(sumAmounts([250, -40, -10])).toBe(200);
  });
});
