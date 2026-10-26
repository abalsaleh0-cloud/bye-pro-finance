import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { authenticate, type AuthenticatedRequest } from "./auth/middleware.js";
import { createSupabaseUserClient } from "./database/user-client.js";
import { buildIdempotentTransferId, normalizeIdempotencyKey } from "./finance/idempotency.js";
import { consumeAiRateLimit, runAiAssistant, validateAiRequest } from "./ai/index.js";

const port = Number(process.env.PORT ?? 3001);

type JsonRecord = Record<string, unknown>;

function json(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage, maxBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new Error("BODY_TOO_LARGE");
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function getBearerToken(request: IncomingMessage): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/api/health") {
    json(response, 200, { ok: true });
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
      json(response, result.status, { error: result.error });
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
