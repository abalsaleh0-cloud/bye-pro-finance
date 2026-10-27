import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import "./communication-center.css";

type Profile = { id: string; public_id: number | null; username: string | null; full_name: string; avatar_url: string | null };
type Conversation = { id: string; other: Profile; lastMessage?: string; lastAt?: string };
type Message = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };
type Call = { id: string; conversation_id: string; caller_id: string; callee_id: string; status: string };

const rtcConfig: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export default function CommunicationCenter() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chats" | "add">("chats");
  const [me, setMe] = useState<Profile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [publicId, setPublicId] = useState("");
  const [found, setFound] = useState<Profile | null>(null);
  const [searchError, setSearchError] = useState("");
  const [busy, setBusy] = useState(false);
  const [call, setCall] = useState<Call | null>(null);
  const [callPeer, setCallPeer] = useState<Profile | null>(null);
  const [callState, setCallState] = useState<"idle" | "calling" | "incoming" | "connected">("idle");
  const [muted, setMuted] = useState(false);
  const pc = useRef<RTCPeerConnection | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
  const signalChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const locale = typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "ar";
  const t = (ar: string, en: string) => locale === "en" ? en : ar;

  useEffect(() => {
    let mounted = true;
    if (!supabase) return;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted || !data.user) return;
      const { data: profile } = await supabase.from("profiles").select("id,public_id,username,full_name,avatar_url").eq("id", data.user.id).maybeSingle();
      if (mounted && profile) setMe(profile as Profile);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!me || !supabase) return;
    let cancelled = false;
    void loadConversations().then(() => { if (cancelled) return; });
    const channel = supabase.channel(`communication:${me.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, payload => {
        const m = payload.new as Message;
        if (active?.id === m.conversation_id) setMessages(current => current.some(x => x.id === m.id) ? current : [...current, m]);
        void loadConversations();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "voice_calls", filter: `callee_id=eq.${me.id}` }, payload => {
        const incoming = payload.new as Call;
        void handleIncomingCall(incoming);
      })
      .subscribe();
    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, [me, active?.id]);

  async function loadConversations() {
    if (!supabase || !me) return;
    const { data: memberships } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", me.id);
    const ids = (memberships ?? []).map(x => x.conversation_id);
    if (!ids.length) { setConversations([]); return; }
    const { data: peers } = await supabase.from("conversation_participants").select("conversation_id,user_id").in("conversation_id", ids).neq("user_id", me.id);
    const peerIds = [...new Set((peers ?? []).map(x => x.user_id))];
    if (!peerIds.length) { setConversations([]); return; }
    const { data: profiles } = await supabase.from("profiles").select("id,public_id,username,full_name,avatar_url").in("id", peerIds);
    const byUser = new Map((profiles ?? []).map(p => [p.id, p as Profile]));
    setConversations((peers ?? []).map(p => ({ id: p.conversation_id, other: byUser.get(p.user_id)! })).filter(x => x.other));
  }

  async function openConversation(c: Conversation) {
    if (!supabase) return;
    setActive(c); setTab("chats");
    const { data } = await supabase.from("messages").select("id,conversation_id,sender_id,body,created_at").eq("conversation_id", c.id).order("created_at", { ascending: true }).limit(100);
    setMessages((data ?? []) as Message[]);
  }

  async function searchUser() {
    if (!supabase) return;
    setSearchError(""); setFound(null);
    const id = Number(publicId.trim());
    if (!Number.isInteger(id) || id < 100000 || id > 999999) { setSearchError(t("أدخل ID مكوّنًا من 6 أرقام.", "Enter a 6-digit ID.")); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("find_profile_by_public_id", { target_public_id: id });
    setBusy(false);
    if (error || !data?.[0]) { setSearchError(t("لم يتم العثور على مستخدم بهذا ID.", "No user found with this ID.")); return; }
    if (data[0].id === me?.id) { setSearchError(t("لا يمكنك إضافة نفسك.", "You cannot add yourself.")); return; }
    setFound(data[0] as Profile);
  }

  async function startChat(profile: Profile) {
    if (!supabase || !me) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("get_or_create_direct_conversation", { target_user: profile.id });
    setBusy(false);
    if (error || !data) { setSearchError(error?.message ?? t("تعذر إنشاء المحادثة.", "Unable to create the conversation.")); return; }
    const c = { id: data as string, other: profile };
    setConversations(current => current.some(x => x.id === c.id) ? current : [c, ...current]);
    await openConversation(c);
  }

  async function sendMessage() {
    if (!supabase || !me || !active || !text.trim()) return;
    const body = text.trim(); setText("");
    const { data, error } = await supabase.from("messages").insert({ conversation_id: active.id, sender_id: me.id, body }).select("id,conversation_id,sender_id,body,created_at").single();
    if (!error && data) setMessages(current => current.some(x => x.id === data.id) ? current : [...current, data as Message]);
  }

  async function preparePeer() {
    if (pc.current) pc.current.close();
    const connection = new RTCPeerConnection(rtcConfig); pc.current = connection;
    connection.ontrack = event => { if (remoteAudio.current) { remoteAudio.current.srcObject = event.streams[0]; void remoteAudio.current.play().catch(() => undefined); } };
    connection.onicecandidate = event => { if (event.candidate && call?.id && me && supabase) void supabase.from("voice_call_signals").insert({ call_id: call.id, sender_id: me.id, kind: "ice", payload: event.candidate.toJSON() }); };
    return connection;
  }

  async function startCall() {
    if (!supabase || !me || !active || !active.other) return;
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { data: newCall, error } = await supabase.from("voice_calls").insert({ conversation_id: active.id, caller_id: me.id, callee_id: active.other.id, status: "ringing" }).select("id,conversation_id,caller_id,callee_id,status").single();
      if (error || !newCall) throw error ?? new Error("call");
      setCall(newCall as Call); setCallPeer(active.other); setCallState("calling");
      const connection = await preparePeer(); stream.current.getTracks().forEach(track => connection.addTrack(track, stream.current!));
      const offer = await connection.createOffer(); await connection.setLocalDescription(offer);
      await supabase.from("voice_call_signals").insert({ call_id: newCall.id, sender_id: me.id, kind: "offer", payload: offer });
      subscribeSignals(newCall.id, active.other.id);
    } catch { cleanupCall(); }
  }

  function subscribeSignals(callId: string, peerId: string) {
    if (!supabase || !me) return;
    if (signalChannel.current) void supabase.removeChannel(signalChannel.current);
    const ch = supabase.channel(`call:${callId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "voice_call_signals", filter: `call_id=eq.${callId}` }, payload => { void handleSignal(payload.new as any, peerId); }).subscribe();
    signalChannel.current = ch;
  }

  async function handleSignal(signal: { sender_id: string; kind: string; payload: any }, peerId: string) {
    if (!me || signal.sender_id === me.id || !pc.current) return;
    const connection = pc.current;
    if (signal.kind === "offer") {
      await connection.setRemoteDescription(signal.payload); const answer = await connection.createAnswer(); await connection.setLocalDescription(answer);
      if (supabase && call?.id) await supabase.from("voice_call_signals").insert({ call_id: call.id, sender_id: me.id, kind: "answer", payload: answer });
      setCallState("connected");
    } else if (signal.kind === "answer") { await connection.setRemoteDescription(signal.payload); setCallState("connected"); }
    else if (signal.kind === "ice") { try { await connection.addIceCandidate(signal.payload); } catch { /* stale candidate */ } }
    else if (signal.kind === "hangup") cleanupCall();
    void peerId;
  }

  async function handleIncomingCall(incoming: Call) {
    if (!supabase || !me || call) return;
    const { data: profile } = await supabase.from("profiles").select("id,public_id,username,full_name,avatar_url").eq("id", incoming.caller_id).maybeSingle();
    setCall(incoming); setCallPeer(profile as Profile); setCallState("incoming");
    subscribeSignals(incoming.id, incoming.caller_id);
  }

  async function acceptCall() {
    if (!supabase || !me || !call) return;
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const connection = await preparePeer(); stream.current.getTracks().forEach(track => connection.addTrack(track, stream.current!));
      await supabase.from("voice_calls").update({ status: "accepted", answered_at: new Date().toISOString() }).eq("id", call.id);
      setCallState("connected");
    } catch { cleanupCall(); }
  }

  async function endCall() {
    if (supabase && call && me) {
      await supabase.from("voice_call_signals").insert({ call_id: call.id, sender_id: me.id, kind: "hangup", payload: {} });
      await supabase.from("voice_calls").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", call.id);
    }
    cleanupCall();
  }

  function cleanupCall() {
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; pc.current?.close(); pc.current = null;
    if (signalChannel.current && supabase) void supabase.removeChannel(signalChannel.current); signalChannel.current = null;
    setCall(null); setCallPeer(null); setCallState("idle"); setMuted(false);
  }

  function toggleMute() { stream.current?.getAudioTracks().forEach(track => { track.enabled = !track.enabled; setMuted(!track.enabled); }); }

  const title = useMemo(() => t("التواصل", "Communication"), [locale]);
  if (!me) return null;
  return <>
    <button className="communication-fab" onClick={() => setOpen(v => !v)} aria-label={title}>💬</button>
    {open && <section className="communication-panel" dir={locale === "ar" ? "rtl" : "ltr"}>
      <header className="communication-head"><div><strong>{title}</strong><small>{t("دردشة واتصال صوتي", "Chat & voice calls")}</small></div><button onClick={() => setOpen(false)}>×</button></header>
      {!active ? <>
        <nav className="communication-tabs"><button className={tab === "chats" ? "active" : ""} onClick={() => setTab("chats")}>{t("المحادثات", "Chats")}</button><button className={tab === "add" ? "active" : ""} onClick={() => setTab("add")}>{t("إضافة ID", "Add ID")}</button></nav>
        {tab === "chats" ? <div className="conversation-list">{conversations.length ? conversations.map(c => <button key={c.id} className="conversation-item" onClick={() => void openConversation(c)}><Avatar profile={c.other}/><span><b>{c.other.full_name || c.other.username || c.other.public_id}</b><small>ID: {c.other.public_id ?? "—"}</small></span></button>) : <p className="communication-empty">{t("لا توجد محادثات بعد. أضف مستخدمًا بواسطة ID.", "No chats yet. Add a user by ID.")}</p>}</div> : <div className="add-user"><label>{t("رقم ID للمستخدم", "User ID")}</label><div className="id-row"><input inputMode="numeric" maxLength={6} value={publicId} onChange={e => setPublicId(e.target.value.replace(/\D/g, ""))} placeholder="123456"/><button onClick={() => void searchUser()} disabled={busy}>{t("بحث", "Search")}</button></div>{searchError && <p className="communication-error">{searchError}</p>}{found && <div className="found-user"><Avatar profile={found}/><div><b>{found.full_name || found.username}</b><small>ID: {found.public_id}</small></div><button onClick={() => void startChat(found)} disabled={busy}>{t("بدء المحادثة", "Start chat")}</button></div>}</div>}
      </> : <>
        <header className="chat-head"><button onClick={() => setActive(null)}>‹</button><Avatar profile={active.other}/><div><b>{active.other.full_name || active.other.username}</b><small>ID: {active.other.public_id}</small></div><button className="call-button" onClick={() => void startCall()}>☎</button></header>
        <div className="messages">{messages.map(m => <div key={m.id} className={`message ${m.sender_id === me.id ? "mine" : "theirs"}`}><span>{m.body}</span><time>{new Date(m.created_at).toLocaleTimeString(locale === "ar" ? "ar" : "en", { hour: "2-digit", minute: "2-digit" })}</time></div>)}</div>
        <form className="composer" onSubmit={e => { e.preventDefault(); void sendMessage(); }}><input value={text} onChange={e => setText(e.target.value)} placeholder={t("اكتب رسالة…", "Write a message…")} /><button type="submit" disabled={!text.trim()}>➤</button></form>
      </>}
    </section>}
    {callState !== "idle" && <section className="call-overlay" dir={locale === "ar" ? "rtl" : "ltr"}><div className="call-card"><Avatar profile={callPeer}/><h3>{callPeer?.full_name || callPeer?.username || t("مستخدم", "User")}</h3><p>{callState === "incoming" ? t("اتصال وارد", "Incoming call") : callState === "calling" ? t("جارٍ الاتصال…", "Calling…") : t("متصل", "Connected")}</p>{callState === "incoming" ? <div className="call-actions"><button className="accept" onClick={() => void acceptCall()}>✓</button><button className="reject" onClick={() => void endCall()}>×</button></div> : <div className="call-actions"><button onClick={toggleMute}>{muted ? "🔇" : "🎙️"}</button><button className="reject" onClick={() => void endCall()}>☎</button></div>}<audio ref={remoteAudio} autoPlay playsInline /></div></section>}
  </>;
}

function Avatar({ profile }: { profile: Profile | null }) { return profile?.avatar_url ? <img className="communication-avatar" src={profile.avatar_url} alt=""/> : <span className="communication-avatar avatar-fallback">{(profile?.full_name || profile?.username || "B").charAt(0).toUpperCase()}</span>; }
