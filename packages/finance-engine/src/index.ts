export interface LedgerLine {
  amount: number;
  currency_code: string;
  type: "income" | "expense" | "adjustment" | "transfer";
  status?: string | null;
}

export function summarizeByCurrency(lines: LedgerLine[]) {
  const totals: Record<string, { income: number; expense: number; adjustment: number; net: number }> = {};
  for (const line of lines) {
    if (!line || line.type === "transfer" || line.status === "cancelled" || !Number.isFinite(line.amount)) continue;
    const currency = line.currency_code || "UNKNOWN";
    totals[currency] ??= { income: 0, expense: 0, adjustment: 0, net: 0 };
    if (line.type === "income") totals[currency].income += line.amount;
    if (line.type === "expense") totals[currency].expense += line.amount;
    if (line.type === "adjustment") totals[currency].adjustment += line.amount;
    totals[currency].net = totals[currency].income - totals[currency].expense + totals[currency].adjustment;
  }
  return totals;
}
