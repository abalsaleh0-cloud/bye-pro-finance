import { createClient } from "@supabase/supabase-js";

export type SessionIdentity = {
  id: string;
  email: string | null;
};

export type UserLookup = (accessToken: string) => Promise<SessionIdentity | null>;

export function createSupabaseUserLookup(
  url = process.env.SUPABASE_URL,
  publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY,
): UserLookup | null {
  if (!url || !publishableKey) return null;

  // Keep the SDK client for compatibility with the rest of the API package,
  // but validate the bearer token through Supabase's user endpoint.
  createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return async (accessToken) => {
    try {
      const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) return null;
      const user = (await response.json()) as { id?: unknown; email?: unknown };
      if (typeof user.id !== "string" || !user.id) return null;
      return { id: user.id, email: typeof user.email === "string" ? user.email : null };
    } catch {
      return null;
    }
  };
}

export async function verifyAccessToken(
  token: string,
  lookupUser: UserLookup | null,
): Promise<SessionIdentity | null> {
  if (!token || !lookupUser) return null;
  try {
    return await lookupUser(token);
  } catch {
    return null;
  }
}
