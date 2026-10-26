import { describe, expect, it } from "vitest";
import { fetchAllPages } from "./backupPagination.js";

describe("backup pagination", () => {
  it("fetches every page, including the final partial page", async () => {
    const source = Array.from({ length: 7 }, (_, i) => i + 1);
    const ranges: Array<[number, number]> = [];
    const result = await fetchAllPages(async (from, to) => {
      ranges.push([from, to]);
      return { data: source.slice(from, to + 1) };
    }, 3);

    expect(result).toEqual(source);
    expect(ranges).toEqual([[0, 2], [3, 5], [6, 8]]);
  });

  it("returns an empty result for an empty source", async () => {
    await expect(fetchAllPages(async () => ({ data: null }))).resolves.toEqual([]);
  });

  it("propagates data-source errors instead of creating an incomplete backup", async () => {
    const failure = new Error("network failure");
    await expect(fetchAllPages(async () => ({ data: null, error: failure }))).rejects.toBe(failure);
  });

  it("rejects an invalid page size", async () => {
    await expect(fetchAllPages(async () => ({ data: [] }), 0)).rejects.toThrow(RangeError);
  });
});
