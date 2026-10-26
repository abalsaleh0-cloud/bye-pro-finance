export type WorkerEnvironment = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export async function processNotificationsBatch(
  env: WorkerEnvironment = process.env,
  fetcher: FetchLike = fetch,
): Promise<number> {
  const baseUrl = env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!baseUrl || !serviceKey) {
    throw new Error("Notification worker requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }

  let endpoint: URL;
  try {
    endpoint = new URL("/rest/v1/rpc/process_finance_notifications_batch", baseUrl);
  } catch {
    throw new Error("Notification worker SUPABASE_URL is invalid");
  }
  if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost") {
    throw new Error("Notification worker requires an HTTPS Supabase URL");
  }

  const response = await fetcher(endpoint, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    // Do not echo response bodies: PostgREST errors may contain implementation details.
    throw new Error(`Notification batch RPC failed with HTTP ${response.status}`);
  }

  const result: unknown = await response.json();
  if (typeof result !== "number" || !Number.isSafeInteger(result) || result < 0) {
    throw new Error("Notification batch RPC returned an invalid processed count");
  }
  return result;
}
