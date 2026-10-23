export type LedgerKind = "income" | "expense" | "adjustment";

export interface LedgerEntry {
  amount: number;
  currency_code: string;
  status: "pending" | "completed" | "cancelled";
  type: LedgerKind | "transfer";
}

/** Computes a net total only from completed entries and never mixes currencies. */
export function summarizeLedger(entries: LedgerEntry[]): Record<string, { income: number; expense: number; adjustment: number; net: number }> {
  return entries.reduce<Record<string, { income: number; expense: number; adjustment: number; net: number }>>((summary, entry) => {
    if (entry.status !== "completed" || entry.type === "transfer") return summary;
    if (!Number.isFinite(entry.amount)) return summary;
    const currency = entry.currency_code;
    const totals = summary[currency] ??= { income: 0, expense: 0, adjustment: 0, net: 0 };
    totals[entry.type] += entry.amount;
    totals.net += entry.type === "expense" ? -entry.amount : entry.amount;
    return summary;
  }, {});
}

/** Rejects zero, negative, NaN and infinite transaction amounts. */
export function isValidPositiveAmount(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** Clamps a progress ratio to [0, 1], with invalid targets returning zero. */
export function progressRatio(current: number, target: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.min(1, Math.max(0, current / target));
}
