import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { json } from "./security/response.js";
import { readBearerToken } from "./security/auth.js";
import { createSupabaseUserLookup, verifyAccessToken } from "./auth/session.js";
import { createUserScopedClient } from "./database/user-client.js";
import { readJsonBody, validateTransactionInput } from "./finance/transactions.js";
import { validateBudgetInput } from "./finance/budgets.js";

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

  if (request.method === "GET" && url.pathname === "/api/v1/accounts") {
    const auth = await authenticate(request, response);
    if (!auth) return;
    const { data, error } = await auth.client.from("accounts")
      .select("id,name,type,currency_code,opening_balance,current_balance,institution_name,last_four,is_active,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (error) { json(response, 502, { error: "ACCOUNTS_UNAVAILABLE" }); return; }
    json(response, 200, { data: data ?? [] });
    return;
  }


  if (url.pathname === "/api/v1/budgets" && request.method === "GET") {
    const auth = await authenticate(request, response);
    if (!auth) return;
    const { data, error } = await auth.client.from("budgets")
      .select("id,category_id,name,amount,currency_code,period,start_date,end_date,is_active,created_at,updated_at")
      .order("start_date", { ascending: false })
      .limit(100);
    if (error) { json(response, 502, { error: "BUDGETS_UNAVAILABLE" }); return; }
    json(response, 200, { data: data ?? [] });
    return;
  }

  if (url.pathname === "/api/v1/budgets" && request.method === "POST") {
    const auth = await authenticate(request, response);
    if (!auth) return;
    let body: unknown;
    try { body = await readJsonBody(request); }
    catch (error) {
      const code = error instanceof Error ? error.message : "INVALID_JSON";
      json(response, code === "BODY_TOO_LARGE" ? 413 : 400, { error: code });
      return;
    }
    const validated = validateBudgetInput(body);
    if (validated.ok === false) { json(response, 400, { error: validated.error }); return; }
    const { data, error } = await auth.client.from("budgets")
      .insert({ ...validated.value, user_id: auth.identity.id })
      .select("id,category_id,name,amount,currency_code,period,start_date,end_date,is_active,created_at,updated_at")
      .single();
    if (error) { json(response, 400, { error: "BUDGET_CREATE_FAILED" }); return; }
    json(response, 201, { data });
    return;
  }

  if (url.pathname === "/api/v1/transactions" && request.method === "GET") {
    const auth = await authenticate(request, response);
    if (!auth) return;
    const parsedLimit = Number(url.searchParams.get("limit") ?? 50);
    const limit = Number.isInteger(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 100)) : 50;
    let query = auth.client.from("transactions")
      .select("id,account_id,category_id,type,status,amount,currency_code,description,transaction_date,reference,metadata,created_at,updated_at")
      .order("transaction_date", { ascending: false })
      .limit(limit);
    const type = url.searchParams.get("type");
    const allowedTypes = ["income", "expense", "transfer", "adjustment"] as const;
    if (type !== null && !allowedTypes.includes(type as (typeof allowedTypes)[number])) {
      json(response, 400, { error: "INVALID_TRANSACTION_TYPE" });
      return;
    }
    if (type !== null) query = query.eq("type", type);
    const { data, error } = await query;
    if (error) { json(response, 502, { error: "TRANSACTIONS_UNAVAILABLE" }); return; }
    json(response, 200, { data: data ?? [] });
    return;
  }

  if (url.pathname === "/api/v1/transactions" && request.method === "POST") {
    const auth = await authenticate(request, response);
    if (!auth) return;
    let body: unknown;
    try { body = await readJsonBody(request); }
    catch (error) {
      const code = error instanceof Error ? error.message : "INVALID_JSON";
      json(response, code === "BODY_TOO_LARGE" ? 413 : 400, { error: code });
      return;
    }
    const validated = validateTransactionInput(body);
    if (validated.ok === false) { json(response, 400, { error: validated.error }); return; }
    const { data, error } = await auth.client.from("transactions")
      .insert({ ...validated.value, user_id: auth.identity.id })
      .select("id,account_id,category_id,type,status,amount,currency_code,description,transaction_date,reference,metadata,created_at,updated_at")
      .single();
    if (error) { json(response, 400, { error: "TRANSACTION_CREATE_FAILED" }); return; }
    json(response, 201, { data });
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
