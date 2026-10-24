import type { IncomingHttpHeaders } from "node:http";

export function readBearerToken(headers: IncomingHttpHeaders): string | null {
  const value = headers.authorization;
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice(7).trim();
  return token || null;
}

export function requireBearerToken(headers: IncomingHttpHeaders): string {
  const token = readBearerToken(headers);
  if (!token) throw new Error("AUTH_REQUIRED");
  return token;
}
