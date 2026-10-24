export type TransactionInput = {
  account_id: string;
  category_id?: string | null;
  type: "income" | "expense" | "adjustment";
  status?: "pending" | "completed" | "cancelled";
  amount: number;
  currency_code?: string;
  description?: string | null;
  transaction_date?: string;
  reference?: string | null;
  metadata?: Record<string, unknown>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Set(["income", "expense", "adjustment"]);
const STATUSES = new Set(["pending", "completed", "cancelled"]);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isValidDate(value: string): boolean {
  const datePrefix = ISO_DATE_PREFIX.exec(value);
  if (datePrefix && !isValidCalendarDate(Number(datePrefix[1]), Number(datePrefix[2]), Number(datePrefix[3]))) {
    return false;
  }
  if (!Number.isFinite(Date.parse(value))) return false;
  if (DATE_ONLY.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return isValidCalendarDate(year, month, day);
  }
  return true;
}

export function validateTransactionInput(value: unknown):
  | { ok: true; value: TransactionInput }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "INVALID_BODY" };
  const body = value as Record<string, unknown>;
  if (typeof body.account_id !== "string" || !UUID.test(body.account_id)) return { ok: false, error: "INVALID_ACCOUNT_ID" };
  if (body.category_id != null && (typeof body.category_id !== "string" || !UUID.test(body.category_id))) return { ok: false, error: "INVALID_CATEGORY_ID" };
  if (typeof body.type !== "string" || !TYPES.has(body.type)) return { ok: false, error: "INVALID_TRANSACTION_TYPE" };
  if (body.status != null && (typeof body.status !== "string" || !STATUSES.has(body.status))) return { ok: false, error: "INVALID_TRANSACTION_STATUS" };
  if (typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount < 0) return { ok: false, error: "INVALID_AMOUNT" };
  if (body.currency_code != null && (typeof body.currency_code !== "string" || !/^[A-Z]{3,5}$/.test(body.currency_code))) return { ok: false, error: "INVALID_CURRENCY" };
  if (body.description != null && (typeof body.description !== "string" || body.description.length > 2000)) return { ok: false, error: "INVALID_DESCRIPTION" };
  if (body.reference != null && (typeof body.reference !== "string" || body.reference.length > 200)) return { ok: false, error: "INVALID_REFERENCE" };
  if (body.transaction_date != null && (typeof body.transaction_date !== "string" || !isValidDate(body.transaction_date))) return { ok: false, error: "INVALID_TRANSACTION_DATE" };
  if (body.metadata != null && (typeof body.metadata !== "object" || Array.isArray(body.metadata))) return { ok: false, error: "INVALID_METADATA" };
  return {
    ok: true,
    value: {
      account_id: body.account_id,
      category_id: (body.category_id as string | null | undefined) ?? null,
      type: body.type as TransactionInput["type"],
      status: (body.status as TransactionInput["status"]) ?? "completed",
      amount: body.amount,
      currency_code: (body.currency_code as string | undefined) ?? "LYD",
      description: (body.description as string | null | undefined) ?? null,
      transaction_date: (body.transaction_date as string | undefined) ?? new Date().toISOString(),
      reference: (body.reference as string | null | undefined) ?? null,
      metadata: (body.metadata as Record<string, unknown> | undefined) ?? {},
    },
  };
}

export async function readJsonBody(request: AsyncIterable<Uint8Array>, maxBytes = 64 * 1024): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.byteLength;
    if (size > maxBytes) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Error("INVALID_JSON");
  }
}
