import { describe, expect, it, vi } from "vitest";
import { processNotificationsBatch } from "./notifications.js";

const env = {
  SUPABASE_URL: "https://example.supabase.co/",
  SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key",
};

describe("notification worker RPC client", () => {
  it("fails closed when server credentials are missing", async () => {
    await expect(processNotificationsBatch({ SUPABASE_URL: env.SUPABASE_URL }, vi.fn()))
      .rejects.toThrow("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  });

  it("calls only the service RPC and returns its count", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("3", { status: 200 }));
    await expect(processNotificationsBatch(env, fetcher)).resolves.toBe(3);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe("https://example.supabase.co/rest/v1/rpc/process_finance_notifications_batch");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer server-only-test-key");
    expect(init.body).toBe("{}");
  });

  it("does not expose response bodies when the RPC fails", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("sensitive database detail", { status: 500 }));
    await expect(processNotificationsBatch(env, fetcher)).rejects.toThrow("HTTP 500");
    await expect(processNotificationsBatch(env, fetcher)).rejects.not.toThrow("sensitive database detail");
  });

  it("rejects malformed success responses", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('"3"', { status: 200 }));
    await expect(processNotificationsBatch(env, fetcher)).rejects.toThrow("invalid processed count");
  });
});
