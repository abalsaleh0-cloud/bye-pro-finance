import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const financeViewsPath = join(dirname(fileURLToPath(import.meta.url)), "FinanceViews.tsx");
const readFinanceViews = () => readFileSync(financeViewsPath, "utf8");

describe("reports pagination contract", () => {
  it("uses Supabase range windows instead of a single 1000-row limit", () => {
    const source = readFinanceViews();
    expect(source).toContain(".range(offset,offset+pageSize-1)");
    expect(source).toContain("if(page.length<pageSize)break");
    expect(source).not.toContain(".limit(1000)");
  });

  it("rejects a report range where the start date is after the end date", () => {
    const source = readFinanceViews();
    expect(source).toContain("const invalidRange=Boolean(from&&to&&from>to)");
    expect(source).toContain("if(invalidRange)return []");
    expect(source).toContain("تاريخ البداية يجب ألا يكون بعد تاريخ النهاية.");
  });
});
