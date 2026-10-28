import { createClient } from "npm:@supabase/supabase-js@2.76.1";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

function trustedPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "fcm.googleapis.com"
      || host === "updates.push.services.mozilla.com"
      || host.endsWith(".push.services.mozilla.com")
      || host === "web.push.apple.com"
      || host.endsWith(".push.apple.com")
      || host.endsWith(".notify.windows.com");
  } catch {
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "PUSH_SERVICE_NOT_CONFIGURED" }, 503);

  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "INVALID_SESSION" }, 401);
  const userId = authData.user.id;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid");
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const { data: config, error: configError } = await admin
    .from("push_vapid_config")
    .select("public_key,private_key,subject")
    .eq("id", 1)
    .maybeSingle();
  if (configError || !config?.public_key || !config?.private_key || !config?.subject) {
    return json({ error: "PUSH_KEYS_NOT_CONFIGURED" }, 503);
  }

  if (body.action === "publicKey") {
    return json({ publicKey: config.public_key });
  }

  if (body.action === "subscribe") {
    const subscription = body.subscription as {
      endpoint?: unknown;
      keys?: { p256dh?: unknown; auth?: unknown };
    } | undefined;
    if (!subscription || !trustedPushEndpoint(subscription.endpoint)
      || typeof subscription.keys?.p256dh !== "string"
      || typeof subscription.keys?.auth !== "string"
      || subscription.keys.p256dh.length > 256
      || subscription.keys.auth.length > 256) {
      return json({ error: "INVALID_PUSH_SUBSCRIPTION" }, 400);
    }
    const { error } = await admin.from("push_subscriptions").upsert({
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      updated_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });
    if (error) return json({ error: "SUBSCRIPTION_SAVE_FAILED" }, 500);
    return json({ ok: true });
  }

  if (body.action === "unsubscribe") {
    const endpoint = body.endpoint;
    if (!trustedPushEndpoint(endpoint)) return json({ error: "INVALID_PUSH_SUBSCRIPTION" }, 400);
    const { error } = await admin.from("push_subscriptions").delete()
      .eq("user_id", userId).eq("endpoint", endpoint);
    if (error) return json({ error: "SUBSCRIPTION_DELETE_FAILED" }, 500);
    return json({ ok: true });
  }

  if (body.action !== "notify") return json({ error: "UNKNOWN_ACTION" }, 400);
  const eventType = body.eventType;
  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  if (!eventId || !["message", "friend_request", "call"].includes(String(eventType))) {
    return json({ error: "INVALID_EVENT" }, 400);
  }

  let recipientIds: string[] = [];
  let title = "BYE PRO";
  let message = "لديك إشعار جديد";
  let url = "/";
  let senderId = userId;

  if (eventType === "message") {
    const { data: row, error } = await admin.from("messages")
      .select("id,conversation_id,sender_id").eq("id", eventId).maybeSingle();
    if (error || !row || row.sender_id !== userId) return json({ error: "EVENT_NOT_FOUND" }, 404);
    const { data: participants, error: participantError } = await admin.from("conversation_participants")
      .select("user_id").eq("conversation_id", row.conversation_id);
    if (participantError) return json({ error: "RECIPIENT_LOOKUP_FAILED" }, 500);
    recipientIds = [...new Set((participants ?? []).map((p: { user_id: string }) => p.user_id).filter((id: string) => id !== userId))];
    const { data: profile } = await admin.from("profiles").select("full_name,username").eq("id", userId).maybeSingle();
    const name = profile?.full_name || profile?.username || "مستخدم";
    title = "BYE PRO · رسالة جديدة";
    message = `وصلتك رسالة جديدة من ${name}`;
    url = "/?open=communication";
  } else if (eventType === "friend_request") {
    const { data: row, error } = await admin.from("friend_requests")
      .select("id,sender_id,recipient_id,status").eq("id", eventId).maybeSingle();
    if (error || !row || row.sender_id !== userId || row.status !== "pending") return json({ error: "EVENT_NOT_FOUND" }, 404);
    recipientIds = [row.recipient_id];
    const { data: profile } = await admin.from("profiles").select("full_name,username").eq("id", userId).maybeSingle();
    const name = profile?.full_name || profile?.username || "مستخدم";
    title = "BYE PRO · طلب إضافة";
    message = `أرسل لك ${name} طلب إضافة`;
    url = "/?open=communication";
  } else {
    const { data: row, error } = await admin.from("voice_calls")
      .select("id,caller_id,callee_id,status").eq("id", eventId).maybeSingle();
    if (error || !row || row.caller_id !== userId || row.status !== "ringing") return json({ error: "EVENT_NOT_FOUND" }, 404);
    recipientIds = [row.callee_id];
    const { data: profile } = await admin.from("profiles").select("full_name,username").eq("id", userId).maybeSingle();
    const name = profile?.full_name || profile?.username || "مستخدم";
    title = "BYE PRO · مكالمة واردة";
    message = `يتصل بك ${name}`;
    url = "/?open=communication";
  }

  recipientIds = [...new Set(recipientIds)].filter((id) => id && id !== senderId);
  if (!recipientIds.length) return json({ ok: true, sent: 0, failed: 0 });

  const { data: subscriptions, error: subscriptionsError } = await admin.from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth").in("user_id", recipientIds);
  if (subscriptionsError) return json({ error: "SUBSCRIPTIONS_LOOKUP_FAILED" }, 500);
  if (!subscriptions?.length) return json({ ok: true, sent: 0, failed: 0 });

  webpush.setVapidDetails(config.subject, config.public_key, config.private_key);
  let sent = 0;
  let failed = 0;
  const payload = JSON.stringify({
    title,
    body: message,
    url,
    tag: `bye-pro-${eventType}-${eventId}`,
    eventType,
    eventId,
  });

  for (const recipientId of recipientIds) {
    const recipientSubscriptions = subscriptions.filter((s: { user_id: string }) => s.user_id === recipientId);
    if (!recipientSubscriptions.length) continue;
    const { error: deliveryError } = await admin.from("push_notification_deliveries")
      .insert({ event_type: eventType, event_id: eventId, recipient_id: recipientId });
    if (deliveryError?.code === "23505") continue;
    if (deliveryError) { failed += recipientSubscriptions.length; continue; }

    for (const subscription of recipientSubscriptions) {
      if (!trustedPushEndpoint(subscription.endpoint)) {
        await admin.from("push_subscriptions").delete().eq("id", subscription.id);
        failed++;
        continue;
      }
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, payload, { TTL: 60 });
        sent++;
      } catch (error) {
        const statusCode = Number((error as { statusCode?: number })?.statusCode ?? 0);
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", subscription.id);
        }
        failed++;
      }
    }
  }

  return json({ ok: true, sent, failed, recipients: recipientIds.length });
});
