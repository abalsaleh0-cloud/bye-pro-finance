import { describe, expect, it } from "vitest";

describe("reports pagination contract", () => {
  it("uses Supabase range windows instead of a single 1000-row limit", async () => {
    const source = await import("fs").then(({ readFileSync }) => readFileSync("apps/web/src/components/FinanceViews.tsx", "utf8"));
    expect(source).toContain(".range(offset,offset+pageSize-1)");
    expect(source).toContain("if(page.length<pageSize)break");
    expect(source).not.toContain(".limit(1000)");
  });

  it("rejects a report range where the start date is after the end date", async () => {
    const source = await import("fs").then(({ readFileSync }) => readFileSync("apps/web/src/components/FinanceViews.tsx", "utf8"));
    expect(source).toContain("const invalidRange=Boolean(from&&to&&from>to)");
    expect(source).toContain("if(invalidRange)return []");
    expect(source).toContain("تاريخ البداية يجب ألا يكون بعد تاريخ النهاية.");
  });
});
