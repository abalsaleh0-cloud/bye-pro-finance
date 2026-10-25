import type { IncomingMessage, ServerResponse } from "node:http";
import { handleAdmin } from "../../../apps/api/src/admin/index.js";

export default async function api(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    await handleAdmin(request, response);
  } catch {
    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ error: "INTERNAL_ERROR" }));
    } else {
      response.destroy();
    }
  }
}
