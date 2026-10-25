import { describe, expect, it } from "vitest";
import { consumeAiRateLimit, validateAiRequest } from "./index.js";

describe("AI request validation", () => {
  it("accepts a supported assistant request", () => {
    expect(validateAiRequest({ task: "assistant", input: "حلل مصروفاتي" })).toEqual({ ok: true, value: { task: "assistant", input: "حلل مصروفاتي" } });
  });
  it("defaults task and trims whitespace", () => {
    expect(validateAiRequest({ input: "  Hello  " })).toEqual({ ok: true, value: { task: "assistant", input: "Hello" } });
  });
  it("rejects unsupported task and oversized input", () => {
    expect(validateAiRequest({ task: "admin", input: "hello" })).toEqual({ ok: false, error: "INVALID_AI_TASK" });
    expect(validateAiRequest({ input: "x".repeat(2001) })).toEqual({ ok: false, error: "AI_INPUT_TOO_LONG" });
  });
  it("rejects empty or malformed input", () => {
    expect(validateAiRequest({ input: "  " })).toEqual({ ok: false, error: "AI_INPUT_REQUIRED" });
    expect(validateAiRequest(null)).toEqual({ ok: false, error: "INVALID_BODY" });
  });
});

describe("AI per-user request limit", () => {
  it("allows twelve requests in a minute and rejects the thirteenth", () => {
    const user = "rate-test-" + Math.random().toString(36).slice(2);
    for (let i = 0; i < 12; i++) expect(consumeAiRateLimit(user, 100_000 + i)).toBe(true);
    expect(consumeAiRateLimit(user, 100_100)).toBe(false);
    expect(consumeAiRateLimit(user, 161_000)).toBe(true);
  });
});
