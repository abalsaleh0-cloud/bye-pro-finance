import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://bye-pro-finance-psi.vercel.app",
  "https://bye-pro-finance.vercel.app",
]);

function corsHeaders(origin: string | null) {
  const allowed = origin && (allowedOrigins.has(origin) || /^https:\/\/bye-pro-finance-[a-z0-9-]+\.vercel\.app$/.test(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  return {
    "Access-Control-Allow-Origin": allowed ? origin! : "https://bye-pro-finance-psi.vercel.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

const tableKeys = [
  "debt_payments", "documents", "transactions", "transfers", "budgets", "debts", "bills", "savings_goals", "assets", "accounts", "categories",
  "household_expenses", "household_budgets", "household_members", "notifications", "push_subscriptions", "push_notification_deliveries", "voice_calls",
  "voice_call_signals", "messages", "friend_requests", "conversation_participants", "audit_logs",
] as const;

async function removeUserStorageFiles(admin: ReturnType<typeof createClient>, bucket: string, userId: string) {
  const paths: string[] = [];
  const queue = [userId];
  while (queue.length) {
    const prefix = queue.shift()!;
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset: 0 });
    if (error) {
      if (/not found|does not exist|bucket/i.test(error.message)) return 0;
      throw error;
    }
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      if (item.id) paths.push(path);
      else queue.push(path);
    }
  }
  if (!paths.length) return 0;
  const { error } = await admin.storage.from(bucket).remove(paths);
  if (error) throw error;
  return paths.length;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), { status: 405, headers });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401, headers });

    const body = await req.json().catch(() => ({}));
    const password = typeof body.password === "string" ? body.password : "";
    const confirmation = typeof body.confirmation === "string" ? body.confirmation : "";
    if (!password || confirmation !== "CLEAR_ALL_DATA") return new Response(JSON.stringify({ error: "CONFIRMATION_REQUIRED" }), { status: 400, headers });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user?.id || !userData.user.email) return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401, headers });

    const { error: passwordError } = await authClient.auth.signInWithPassword({ email: userData.user.email, password });
    if (passwordError) return new Response(JSON.stringify({ error: "INVALID_PASSWORD" }), { status: 401, headers });

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const userId = userData.user.id;
    const counts: Record<string, number> = {};

    for (const table of tableKeys) {
      let query = admin.from(table).delete();
      if (table === "voice_calls") query = query.or(`caller_id.eq.${userId},callee_id.eq.${userId}`) as typeof query;
      else if (table === "friend_requests") query = query.or(`sender_id.eq.${userId},recipient_id.eq.${userId}`) as typeof query;
      else if (table === "messages" || table === "voice_call_signals") query = query.eq("sender_id", userId) as typeof query;
      else if (table === "push_notification_deliveries") query = query.eq("recipient_id", userId) as typeof query;
      else query = query.eq("user_id", userId) as typeof query;
      const { data, error } = await query.select("id");
      if (error) {
        if (/column .* does not exist|relation .* does not exist/i.test(error.message)) { counts[table] = 0; continue; }
        throw error;
      }
      counts[table] = data?.length ?? 0;
    }

    const { error: profileError } = await admin.from("profiles").update({ avatar_url: null, updated_at: new Date().toISOString() }).eq("id", userId);
    if (profileError && !/column .* does not exist/i.test(profileError.message)) throw profileError;
    const { error: settingsError } = await admin.from("user_settings").delete().eq("user_id", userId);
    if (settingsError && !/relation .* does not exist/i.test(settingsError.message)) throw settingsError;

    const storageCounts: Record<string, number> = {};
    for (const bucket of ["finance-documents", "profile-avatars"]) storageCounts[bucket] = await removeUserStorageFiles(admin, bucket, userId);

    return new Response(JSON.stringify({ success: true, user_id: userId, counts, storage: storageCounts }), { status: 200, headers });
  } catch (error) {
    console.error("clear-all-data failed", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "CLEAR_FAILED" }), { status: 500, headers });
  }
});
