import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { json } from "./security/response.js";
import { readBearerToken } from "./security/auth.js";
import { createSupabaseUserLookup, verifyAccessToken } from "./auth/session.js";
import { createUserScopedClient } from "./database/user-client.js";
import { readJsonBody } from "./finance/transactions.js";
import { validateTransferInput } from "./finance/transfers.js";
import { buildIdempotentTransferId, normalizeIdempotencyKey } from "./finance/idempotency.js";
import { consumeAiRateLimit, runAiAssistant, validateAiRequest, type AiFailure } from "./ai/index.js";

const port = Number(process.env.PORT ?? 3001);
const lookupUser = createSupabaseUserLookup();

async function authenticate(request: IncomingMessage, response: ServerResponse) {
  const token = readBearerToken(request.headers);
  if (!token) {
    json(response, 401, { error: "AUTH_REQUIRED" });
    return null;
  }
  if (!lookupUser) {
    json(response, 503, { error: "AUTH_PROVIDER_NOT_CONFIGURED" });
    return null;
  }
  const identity = await verifyAccessToken(token, lookupUser);
  if (!identity) {
    json(response, 401, { error: "INVALID_SESSION" });
    return null;
  }
  const client = createUserScopedClient(token);
  if (!client) {
    json(response, 503, { error: "DATABASE_NOT_CONFIGURED" });
    return null;
  }
  return { identity, client };
}

/**
 * API ownership rule:
 * - Auth/session, AI, admin, and idempotent financial operations belong here.
 * - Ordinary CRUD for accounts, transactions, and budgets stays in the web app's
 *   user-scoped Supabase client and is intentionally not duplicated as REST routes.
 */
export async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    json(response, 200, { ok: true, service: "bye-pro-finance-api", timestamp: new Date().toISOString() });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/session") {
    const token = readBearerToken(request.headers);
    if (!token) { json(response, 401, { error: "AUTH_REQUIRED" }); return; }
    if (!lookupUser) { json(response, 503, { error: "AUTH_PROVIDER_NOT_CONFIGURED" }); return; }
    const identity = await verifyAccessToken(token, lookupUser);
    if (!identity) { json(response, 401, { error: "INVALID_SESSION" }); return; }
    json(response, 200, { authenticated: true, user: identity });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/transfers") {
    const auth = await authenticate(request, response);
    if (!auth) return;
    let body: unknown;
    try { body = await readJsonBody(request); }
    catch (error) {
      const code = error instanceof Error ? error.message : "INVALID_JSON";
      json(response, code === "BODY_TOO_LARGE" ? 413 : 400, { error: code });
      return;
    }
    const validated = validateTransferInput(body);
    if (validated.ok === false) { json(response, 400, { error: validated.error }); return; }

    const rawIdempotencyKey = request.headers["idempotency-key"];
    const idempotencyKey = Array.isArray(rawIdempotencyKey)
      ? null
      : normalizeIdempotencyKey(rawIdempotencyKey);
    if (rawIdempotencyKey !== undefined && !idempotencyKey) {
      json(response, 400, { error: "INVALID_IDEMPOTENCY_KEY" });
      return;
    }

    const accountIds = [validated.value.from_account_id, validated.value.to_account_id];
    const { data: accounts, error: accountsError } = await auth.client.from("accounts")
      .select("id,currency_code,is_active")
      .in("id", accountIds);
    if (accountsError) { json(response, 502, { error: "ACCOUNTS_UNAVAILABLE" }); return; }
    if (!accounts || accounts.length !== 2) { json(response, 400, { error: "ACCOUNT_NOT_FOUND" }); return; }
    if (accounts.some((account) => !account.is_active)) { json(response, 400, { error: "ACCOUNT_INACTIVE" }); return; }
    const fromAccount = accounts.find((account) => account.id === validated.value.from_account_id);
    const toAccount = accounts.find((account) => account.id === validated.value.to_account_id);
    if (!fromAccount || !toAccount || fromAccount.currency_code !== toAccount.currency_code) {
      json(response, 400, { error: "ACCOUNT_CURRENCY_MISMATCH" });
      return;
    }
    if (fromAccount.currency_code !== validated.value.currency_code) {
      json(response, 400, { error: "INVALID_CURRENCY" });
      return;
    }

    const transferId = idempotencyKey
      ? buildIdempotentTransferId(auth.identity.id, idempotencyKey)
      : undefined;
    const selectColumns = "id,from_account_id,to_account_id,amount,fee,currency_code,description,transfer_date,status,created_at";

    const matchesRequest = (row: Record<string, unknown>) =>
      row.from_account_id === validated.value.from_account_id &&
      row.to_account_id === validated.value.to_account_id &&
      Number(row.amount) === validated.value.amount &&
      Number(row.fee) === validated.value.fee &&
      row.currency_code === validated.value.currency_code &&
      row.description === validated.value.description &&
      row.transfer_date === validated.value.transfer_date &&
      row.status === validated.value.status;

    if (transferId) {
      const { data: existing, error: existingError } = await auth.client.from("transfers")
        .select(selectColumns)
        .eq("id", transferId)
        .maybeSingle();
      if (existingError) { json(response, 502, { error: "TRANSFER_LOOKUP_FAILED" }); return; }
      if (existing) {
        if (!matchesRequest(existing as Record<string, unknown>)) {
          json(response, 409, { error: "IDEMPOTENCY_KEY_REUSED" });
          return;
        }
        json(response, 200, { data: existing });
        return;
      }
    }

    const { data, error } = await auth.client.from("transfers")
      .insert({
        ...validated.value,
        user_id: auth.identity.id,
        ...(transferId ? { id: transferId } : {}),
      })
      .select(selectColumns)
      .single();

    if (!error) {
      json(response, 201, { data });
      return;
    }

    if (transferId && error.code === "23505") {
      const { data: existing, error: existingError } = await auth.client.from("transfers")
        .select(selectColumns)
        .eq("id", transferId)
        .maybeSingle();
      if (existingError || !existing) {
        json(response, 409, { error: "TRANSFER_IDEMPOTENCY_CONFLICT" });
        return;
      }
      if (!matchesRequest(existing as Record<string, unknown>)) {
        json(response, 409, { error: "IDEMPOTENCY_KEY_REUSED" });
        return;
      }
      json(response, 200, { data: existing });
      return;
    }

    json(response, 400, { error: "TRANSFER_CREATE_FAILED" });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/ai") {
    const auth = await authenticate(request, response);
    if (!auth) return;
    let body: unknown;
    try { body = await readJsonBody(request, 8 * 1024); }
    catch (error) {
      const code = error instanceof Error ? error.message : "INVALID_JSON";
      json(response, code === "BODY_TOO_LARGE" ? 413 : 400, { error: code });
      return;
    }
    const validated = validateAiRequest(body);
    if (validated.ok === false) {
      json(response, 400, { error: validated.error });
      return;
    }
    if (!consumeAiRateLimit(auth.identity.id)) {
      json(response, 429, { error: "AI_RATE_LIMIT_EXCEEDED", retry_after_seconds: 60 });
      return;
    }
    const result = await runAiAssistant(auth.client, validated.value);
    if (result.ok === false) {
      const failure: AiFailure = result;
      json(response, failure.status, { error: failure.error });
      return;
    }
    json(response, 200, { data: result });
    return;
  }

  json(response, 404, { error: "NOT_FOUND" });
}

const server = createServer((request, response) => {
  void handle(request, response).catch(() => {
    if (!response.headersSent) json(response, 500, { error: "INTERNAL_ERROR" });
    else response.destroy();
  });
});
if (process.env.VERCEL !== "1") {
  server.listen(port, "0.0.0.0", () => {
    console.log(`BYE PRO FINANCE API listening on ${port}`);
  });
}
