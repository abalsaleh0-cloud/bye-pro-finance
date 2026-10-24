export function assertSafeText(value: unknown, maxLength = 5000): string {
  if (typeof value !== "string") throw new Error("Invalid text input");
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Error("Input exceeds maximum length");
  return normalized;
}
