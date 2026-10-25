import { createHash } from "node:crypto";

const HEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Derive a stable UUID from the authenticated user and an Idempotency-Key.
 * Including the user id prevents the same client key from colliding across users.
 */
export function buildIdempotentTransferId(userId: string, idempotencyKey: string): string {
  const digest = createHash("sha256").update(`${userId}\n${idempotencyKey}`).digest("hex");
  const bytes = digest.slice(0, 32).split("");
  bytes[12] = "4";
  const variant = Number.parseInt(bytes[16], 16);
  bytes[16] = ((variant & 0x3) | 0x8).toString(16);
  const uuid = [
    bytes.slice(0, 8).join(""),
    bytes.slice(8, 12).join(""),
    bytes.slice(12, 16).join(""),
    bytes.slice(16, 20).join(""),
    bytes.slice(20, 32).join(""),
  ].join("-");

  if (!HEX_UUID.test(uuid)) throw new Error("FAILED_TO_BUILD_IDEMPOTENCY_ID");
  return uuid;
}

export function normalizeIdempotencyKey(value: string | undefined): string | null {
  if (value === undefined) return null;
  const key = value.trim();
  if (!key || key.length > 255) return null;
  return key;
}
