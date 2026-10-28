import { createClient } from "npm:@supabase/supabase-js@2.76.1";

const json = (body: unknown, status = 200, origin = "https://bye-pro-finance-psi.vercel.app") =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });

function getAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  try {
    const url = new URL(origin);
    if (
      url.protocol === "https:" &&
      (url.hostname === "bye-pro-finance.vercel.app" ||
        url.hostname === "bye-pro-finance-psi.vercel.app" ||
        (url.hostname.startsWith("bye-pro-finance-") && url.hostname.endsWith(".vercel.app")))
    ) return origin;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return origin;
  } catch { /* use the production origin for non-browser requests */ }
  return "https://bye-pro-finance-psi.vercel.app";
}

async function collectFiles(client: ReturnType<typeof createClient>, bucket: string, prefix: string): Promise<string[]> {
  const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(`Could not inspect stored files in ${bucket}.`);
  const paths: string[] = [];
  for (const item of data ?? []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) paths.push(path);
    else paths.push(...await collectFiles(client, bucket, path));
  }
  return paths;
}

Deno.serve(async (request: Request) => {
  const origin = getAllowedOrigin(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers: {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  }});
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: "Account deletion is not configured on the server." }, 500, origin);
    }

    const authorization = request.headers.get("Authorization") ?? "";
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return json({ error: "Please sign in again." }, 401, origin);

    const payload = await request.json().catch(() => null) as { password?: unknown; confirmation?: unknown } | null;
    if (!payload || payload.confirmation !== "DELETE" || typeof payload.password !== "string" || payload.password.length < 1) {
      return json({ error: "Re-enter your password and confirm deletion." }, 400, origin);
    }

    const caller = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: callerData, error: callerError } = await caller.auth.getUser(token);
    const user = callerData.user;
    if (callerError || !user?.id || !user.email) return json({ error: "Your session is invalid. Please sign in again." }, 401, origin);

    const { data: reauthenticated, error: passwordError } = await caller.auth.signInWithPassword({
      email: user.email,
      password: payload.password,
    });
    if (passwordError || reauthenticated.user?.id !== user.id) {
      return json({ error: "The password is incorrect. Your account has not been deleted." }, 403, origin);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // Preserve role assignments made by this user while removing the restrictive FK.
    const { error: grantsError } = await admin.from("admin_roles").update({ granted_by: null }).eq("granted_by", user.id);
    if (grantsError) return json({ error: "Could not safely prepare account data for deletion. No account deletion was performed." }, 409, origin);

    // Remove only files under this user's UUID folder in the two account-owned buckets.
    for (const bucket of ["finance-documents", "profile-avatars"]) {
      const files = await collectFiles(admin, bucket, user.id);
      for (let i = 0; i < files.length; i += 100) {
        const { error } = await admin.storage.from(bucket).remove(files.slice(i, i + 100));
        if (error) throw new Error(`Could not remove the account's stored files from ${bucket}.`);
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, false);
    if (deleteError) {
      return json({ error: "The account could not be deleted from authentication. Contact support before retrying if some stored files were already removed." }, 409, origin);
    }

    return json({ success: true, message: "Account and associated data deleted." }, 200, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected account deletion error.";
    return json({ error: message }, 500, origin);
  }
});
