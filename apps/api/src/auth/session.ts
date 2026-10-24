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

  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return async (accessToken) => {
    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
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
