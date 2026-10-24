export type FinanceOperation = "income" | "expense" | "transfer" | "adjustment";

export function isFinanceOperation(value: unknown): value is FinanceOperation {
  return value === "income" || value === "expense" || value === "transfer" || value === "adjustment";
}
