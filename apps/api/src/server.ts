import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 3001);

const server = createServer((request, response) => {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");

  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200);
    response.end(JSON.stringify({ ok: true, service: "bye-pro-finance-api" }));
    return;
  }

  response.writeHead(404);
  response.end(JSON.stringify({ error: "Not Found" }));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`BYE PRO FINANCE API listening on ${port}`);
});
