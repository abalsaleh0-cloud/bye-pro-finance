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

  const authUserUrl = `${url.replace(/\/$/, "")}/auth/v1/user`;

  return async (accessToken) => {
    const response = await fetch(authUserUrl, {
      method: "GET",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) return null;

    const user = (await response.json()) as { id?: unknown; email?: unknown };
    if (typeof user.id !== "string" || !user.id) return null;
    return { id: user.id, email: typeof user.email === "string" ? user.email : null };
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
