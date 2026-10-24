const MAX_MONEY = 1_000_000_000_000;
const MAX_SCALE = 4;

/** Validate a JavaScript number before writing to PostgreSQL numeric(20,4). */
export function isValidMoneyAmount(value: unknown, options?: { allowZero?: boolean }): boolean {
  const allowZero = options?.allowZero ?? true;
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  if (!allowZero && value <= 0) return false;
  if (value < 0 || value > MAX_MONEY) return false;

  const normalized = value.toString().toLowerCase();
  if (normalized.includes("e")) return false;
  const decimal = normalized.split(".")[1];
  if (decimal && decimal.length > MAX_SCALE) return false;

  return Number.isSafeInteger(Math.round(value * 10 ** MAX_SCALE));
}

export const MONEY_MAX = MAX_MONEY;
export const MONEY_SCALE = MAX_SCALE;
