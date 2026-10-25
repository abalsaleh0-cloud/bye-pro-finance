import type { IncomingMessage, ServerResponse } from "node:http";
import { json } from "../security/response.js";
import { readBearerToken } from "../security/auth.js";
import { createSupabaseUserLookup, verifyAccessToken } from "../auth/session.js";
import { createUserScopedClient } from "../database/user-client.js";
import { grantAdminRole, listAdminRoles, listAuditLogs, revokeAdminRole } from "../audit/index.js";

const lookupUser = createSupabaseUserLookup();

async function authenticate(request: IncomingMessage, response: ServerResponse) {
  const token = readBearerToken(request.headers);
  if (!token) { json(response, 401, { error: "AUTH_REQUIRED" }); return null; }
  if (!lookupUser) { json(response, 503, { error: "AUTH_PROVIDER_NOT_CONFIGURED" }); return null; }
  const identity = await verifyAccessToken(token, lookupUser);
  if (!identity) { json(response, 401, { error: "INVALID_SESSION" }); return null; }
  const client = createUserScopedClient(token);
  if (!client) { json(response, 503, { error: "DATABASE_NOT_CONFIGURED" }); return null; }
  return { identity, client };
}

function positiveInt(value: string | null, fallback: number, max: number) {
  const n = Number(value ?? fallback);
  return Number.isInteger(n) ? Math.max(1, Math.min(n, max)) : fallback;
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 16 * 1024) throw new Error("BODY_TOO_LARGE");
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) as unknown : {};
}

export async function handleAdmin(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (!url.pathname.startsWith("/api/v1/admin/")) return false;

  const auth = await authenticate(request, response);
  if (!auth) return true;

  if (request.method === "GET" && url.pathname === "/api/v1/admin/audit") {
    const limit = positiveInt(url.searchParams.get("limit"), 50, 100);
    const page = positiveInt(url.searchParams.get("page"), 1, 100000);
    const offset = (page - 1) * limit;
    const { data, error, count } = await listAuditLogs(auth.client, limit, offset);
    if (error) { json(response, 403, { error: "ADMIN_AUDIT_UNAVAILABLE" }); return true; }
    json(response, 200, { data: data ?? [], page, limit, total: count ?? 0 });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/admin/roles") {
    const { data, error } = await listAdminRoles(auth.client);
    if (error) { json(response, 403, { error: "ADMIN_ROLES_UNAVAILABLE" }); return true; }
    json(response, 200, { data: data ?? [] });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/admin/roles") {
    let body: any;
    try { body = await readBody(request); } catch (error) {
      json(response, 400, { error: error instanceof Error ? error.message : "INVALID_JSON" });
      return true;
    }
    const userId = typeof body.user_id === "string" ? body.user_id : "";
    const role = body.role;
    if (!/^[0-9a-f-]{36}$/i.test(userId) || !["owner", "admin", "auditor"].includes(role)) {
      json(response, 400, { error: "INVALID_ROLE_REQUEST" });
      return true;
    }
    const { data, error } = await grantAdminRole(auth.client, userId, role, auth.identity.id);
    if (error) { json(response, 403, { error: "ROLE_GRANT_FORBIDDEN" }); return true; }
    json(response, 200, { data });
    return true;
  }

  if (request.method === "DELETE" && url.pathname === "/api/v1/admin/roles") {
    const userId = url.searchParams.get("user_id") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(userId)) { json(response, 400, { error: "INVALID_USER_ID" }); return true; }
    const { error } = await revokeAdminRole(auth.client, userId);
    if (error) { json(response, 403, { error: "ROLE_REVOKE_FORBIDDEN" }); return true; }
    json(response, 204, null);
    return true;
  }

  json(response, 404, { error: "ADMIN_ROUTE_NOT_FOUND" });
  return true;
}
