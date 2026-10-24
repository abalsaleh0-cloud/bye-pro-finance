import { describe, expect, it } from "vitest";
import { csvCell, csvRows } from "./csv.js";

describe("CSV export safety", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "-2+3", "@SUM(A1)", "  =1+1", "\t=1+1"])(
    "neutralizes spreadsheet formula prefixes in %j",
    (value) => {
      expect(csvCell(value)).toBe('"' + "'" + value.replaceAll('"', '""') + '"' );
    },
  );

  it("quotes cells and doubles embedded quotes", () => {
    expect(csvCell('Receipt, "October"')).toBe('"Receipt, ""October""" '.trimEnd());
  });

  it("serializes rows as CSV", () => {
    expect(csvRows([["date", "description"], ["2026-10-24", "=1+1"]])).toBe('"date","description"\n"2026-10-24","\'=1+1"');
  });
});
