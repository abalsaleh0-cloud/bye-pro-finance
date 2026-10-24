import type { IncomingHttpHeaders } from "node:http";

export function readBearerToken(headers: IncomingHttpHeaders): string | null {
  const value = headers.authorization;
  // HTTP authentication scheme names are case-insensitive (RFC 9110).
  if (!value || value.slice(0, 7).toLowerCase() !== "bearer ") return null;
  const token = value.slice(7).trim();
  return token || null;
}

export function requireBearerToken(headers: IncomingHttpHeaders): string {
  const token = readBearerToken(headers);
  if (!token) throw new Error("AUTH_REQUIRED");
  return token;
}
