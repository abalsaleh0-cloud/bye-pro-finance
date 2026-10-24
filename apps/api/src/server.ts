import { createServer, type IncomingMessage } from "node:http";
import { json } from "./security/response.js";
import { readBearerToken } from "./security/auth.js";

const port = Number(process.env.PORT ?? 3001);

function handle(request: IncomingMessage, response: import("node:http").ServerResponse): void {
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
    json(response, 200, { authenticated: true });
    return;
  }

  json(response, 404, { error: "NOT_FOUND" });
}

const server = createServer(handle);
server.listen(port, "0.0.0.0", () => {
  console.log(`BYE PRO FINANCE API listening on ${port}`);
});
