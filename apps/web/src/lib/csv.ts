/**
 * Escape a CSV cell for spreadsheet consumers.
 * Prefix formula-like values (including values with leading control/space characters)
 * so untrusted descriptions cannot be interpreted as spreadsheet formulas.
 */
export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[\u0000-\u0020]*[=+@-]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function csvRows(rows: readonly (readonly unknown[])[]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
