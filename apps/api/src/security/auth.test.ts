import { describe, expect, it, vi } from "vitest";
import { readBearerToken, requireBearerToken } from "./auth.js";
import { verifyAccessToken } from "../auth/session.js";

describe("bearer authentication", () => {
  it("reads a bearer token and trims whitespace", () => {
    expect(readBearerToken({ authorization: "Bearer  token-123  " })).toBe("token-123");
  });

  it.each(["bearer token-123", "BEARER token-123", "bEaReR token-123"])(
    "accepts case-insensitive authentication scheme: %s", (authorization) => {
      expect(readBearerToken({ authorization })).toBe("token-123");
    },
  );

  it("rejects missing, empty and non-bearer authorization headers", () => {
    expect(readBearerToken({})).toBeNull();
    expect(readBearerToken({ authorization: "Basic abc" })).toBeNull();
    expect(readBearerToken({ authorization: "Bearer   " })).toBeNull();
    expect(readBearerToken({ authorization: "BearerX token-123" })).toBeNull();
  });

  it("throws a stable error when authentication is required", () => {
    expect(() => requireBearerToken({})).toThrow("AUTH_REQUIRED");
  });

  it("does not treat a token as valid when the verifier is unconfigured", async () => {
    expect(await verifyAccessToken("token", null)).toBeNull();
  });

  it("returns the identity only when the provider verifies the token", async () => {
    const lookup = vi.fn(async (token: string) => token === "valid"
      ? { id: "user-1", email: "user@example.com" }
      : null);
    expect(await verifyAccessToken("valid", lookup)).toEqual({ id: "user-1", email: "user@example.com" });
    expect(await verifyAccessToken("forged", lookup)).toBeNull();
  });

  it("fails closed if the identity provider throws", async () => {
    expect(await verifyAccessToken("token", async () => { throw new Error("network"); })).toBeNull();
  });
});
