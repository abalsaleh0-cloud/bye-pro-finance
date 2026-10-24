import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { json } from "./security/response.js";
import { readBearerToken } from "./security/auth.js";
import { createSupabaseUserLookup, verifyAccessToken } from "./auth/session.js";
import { createUserScopedClient } from "./database/user-client.js";

const port = Number(process.env.PORT ?? 3001);
const lookupUser = createSupabaseUserLookup();

export async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    json(response, 200, { ok: true, service: "bye-pro-finance-api", timestamp: new Date().toISOString() });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/session") {
    const token = readBearerToken(request.headers);
    if (!token) {
      json(response, 401, { error: "AUTH_REQUIRED" });
      return;
    }
    if (!lookupUser) {
      json(response, 503, { error: "AUTH_PROVIDER_NOT_CONFIGURED" });
      return;
    }
    const identity = await verifyAccessToken(token, lookupUser);
    if (!identity) {
      json(response, 401, { error: "INVALID_SESSION" });
      return;
    }
    json(response, 200, { authenticated: true, user: identity });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/accounts") {
    const token = readBearerToken(request.headers);
    if (!token) {
      json(response, 401, { error: "AUTH_REQUIRED" });
      return;
    }
    if (!lookupUser) {
      json(response, 503, { error: "AUTH_PROVIDER_NOT_CONFIGURED" });
      return;
    }
    const identity = await verifyAccessToken(token, lookupUser);
    if (!identity) {
      json(response, 401, { error: "INVALID_SESSION" });
      return;
    }
    const client = createUserScopedClient(token);
    if (!client) {
      json(response, 503, { error: "DATABASE_NOT_CONFIGURED" });
      return;
    }
    const { data, error } = await client
      .from("accounts")
      .select("id,name,type,currency_code,opening_balance,current_balance,institution_name,last_four,is_active,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (error) {
      json(response, 502, { error: "ACCOUNTS_UNAVAILABLE" });
      return;
    }
    json(response, 200, { data: data ?? [] });
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
server.listen(port, "0.0.0.0", () => {
  console.log(`BYE PRO FINANCE API listening on ${port}`);
});
