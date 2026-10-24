import type { IncomingMessage, ServerResponse } from "node:http";
import { handle } from "../../apps/api/src/server.js";

export default async function budgets(request: IncomingMessage, response: ServerResponse): Promise<void> {
  request.url = "/api/v1/budgets";
  try { await handle(request, response); }
  catch {
    if (!response.headersSent) { response.statusCode = 500; response.setHeader("content-type", "application/json; charset=utf-8"); response.end(JSON.stringify({ error: "INTERNAL_ERROR" })); }
    else response.destroy();
  }
}
