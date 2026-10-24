export type BudgetInput = {
  name: string;
  amount: number;
  currency_code: string;
  period: "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
  start_date: string;
  end_date: string | null;
  category_id: string | null;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PERIODS = new Set(["weekly", "monthly", "quarterly", "yearly", "custom"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validateBudgetInput(value: unknown):
  | { ok: true; value: BudgetInput }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "INVALID_BODY" };
  const body = value as Record<string, unknown>;
  if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120) return { ok: false, error: "INVALID_NAME" };
  if (typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount < 0) return { ok: false, error: "INVALID_AMOUNT" };
  if (body.currency_code != null && (typeof body.currency_code !== "string" || !/^[A-Z]{3,5}$/.test(body.currency_code))) return { ok: false, error: "INVALID_CURRENCY" };
  if (typeof body.period !== "string" || !PERIODS.has(body.period)) return { ok: false, error: "INVALID_PERIOD" };
  if (typeof body.start_date !== "string" || !isValidCalendarDate(body.start_date)) return { ok: false, error: "INVALID_START_DATE" };
  if (body.end_date != null && (typeof body.end_date !== "string" || !isValidCalendarDate(body.end_date))) return { ok: false, error: "INVALID_END_DATE" };
  if (typeof body.end_date === "string" && body.end_date < String(body.start_date)) return { ok: false, error: "END_DATE_BEFORE_START" };
  if (body.category_id != null && (typeof body.category_id !== "string" || !UUID.test(body.category_id))) return { ok: false, error: "INVALID_CATEGORY_ID" };
  return { ok: true, value: {
    name: body.name.trim(), amount: body.amount,
    currency_code: (body.currency_code as string | undefined) ?? "LYD",
    period: body.period as BudgetInput["period"], start_date: body.start_date,
    end_date: (body.end_date as string | null | undefined) ?? null,
    category_id: (body.category_id as string | null | undefined) ?? null,
  }};
}
