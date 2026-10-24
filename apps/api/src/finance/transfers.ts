import { isValidMoneyAmount } from "./money.js";

export type TransferInput = {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  fee: number;
  currency_code: string;
  description: string | null;
  transfer_date: string;
  status: "pending" | "completed" | "cancelled";
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set(["pending", "completed", "cancelled"]);
const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isValidDate(value: string): boolean {
  const prefix = ISO_DATE_PREFIX.exec(value);
  if (prefix && !isValidCalendarDate(Number(prefix[1]), Number(prefix[2]), Number(prefix[3]))) return false;
  return Number.isFinite(Date.parse(value));
}

export function validateTransferInput(value: unknown):
  | { ok: true; value: TransferInput }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "INVALID_BODY" };
  const body = value as Record<string, unknown>;
  if (typeof body.from_account_id !== "string" || !UUID.test(body.from_account_id)) return { ok: false, error: "INVALID_FROM_ACCOUNT_ID" };
  if (typeof body.to_account_id !== "string" || !UUID.test(body.to_account_id)) return { ok: false, error: "INVALID_TO_ACCOUNT_ID" };
  if (body.from_account_id === body.to_account_id) return { ok: false, error: "SAME_ACCOUNT_TRANSFER" };
  if (!isValidMoneyAmount(body.amount, { allowZero: false })) return { ok: false, error: "INVALID_AMOUNT" };
  if (body.fee != null && !isValidMoneyAmount(body.fee)) return { ok: false, error: "INVALID_FEE" };
  if (typeof body.currency_code !== "string" || !/^[A-Z]{3,5}$/.test(body.currency_code)) return { ok: false, error: "INVALID_CURRENCY" };
  if (body.description != null && (typeof body.description !== "string" || body.description.length > 2000)) return { ok: false, error: "INVALID_DESCRIPTION" };
  if (body.transfer_date != null && (typeof body.transfer_date !== "string" || !isValidDate(body.transfer_date))) return { ok: false, error: "INVALID_TRANSFER_DATE" };
  if (body.status != null && (typeof body.status !== "string" || !STATUSES.has(body.status))) return { ok: false, error: "INVALID_TRANSFER_STATUS" };

  return {
    ok: true,
    value: {
      from_account_id: body.from_account_id,
      to_account_id: body.to_account_id,
      amount: body.amount,
      fee: (body.fee as number | undefined) ?? 0,
      currency_code: body.currency_code,
      description: (body.description as string | null | undefined) ?? null,
      transfer_date: (body.transfer_date as string | undefined) ?? new Date().toISOString(),
      status: (body.status as TransferInput["status"] | undefined) ?? "completed",
    },
  };
}
