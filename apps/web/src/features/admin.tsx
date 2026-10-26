import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type AuditRow = { id:string; user_id:string|null; action:string; entity_type:string|null; entity_id:string|null; metadata:Record<string,unknown>; created_at:string };
type RoleRow = { user_id:string; role:"owner"|"admin"|"auditor"; granted_by:string|null; created_at:string; updated_at:string };
type UserRow = { id:string; public_id:number|null; username:string|null; full_name:string|null; created_at:string };
const tr = (en:boolean, ar:string, english:string) => en ? english : ar;

async function api(path:string, init:RequestInit = {}) {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  const { data:{ session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("AUTH_REQUIRED");
  const response = await fetch(path, { ...init, headers: { "content-type":"application/json", ...(init.headers ?? {}), authorization:`Bearer ${session.access_token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload.error ?? response.status));
  return payload;
}

export function AdminView() {
  const en = typeof document !== "undefined" && document.documentElement.lang === "en";
  const [audit,setAudit] = useState<AuditRow[]>([]), [roles,setRoles] = useState<RoleRow[]>([]), [users,setUsers] = useState<UserRow[]>([]);
  const [total,setTotal] = useState(0), [page,setPage] = useState(1), [action,setAction] = useState(""), [entity,setEntity] = useState("");
  const [selectedUser,setSelectedUser] = useState(""), [selectedRole,setSelectedRole] = useState<"admin"|"auditor">("auditor");
  const [busy,setBusy] = useState(true), [message,setMessage] = useState(""), [error,setError] = useState("");

  const load = async () => {
    setBusy(true); setError("");
    try {
      const [auditPayload, rolePayload, userPayload] = await Promise.all([
        api(`/api/v1/admin/audit?page=${page}&limit=50`), api("/api/v1/admin/roles"), api("/api/v1/admin/users")
      ]);
      setAudit(auditPayload.data ?? []); setTotal(auditPayload.total ?? 0); setRoles(rolePayload.data ?? []); setUsers(userPayload.data ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ADMIN_UNAVAILABLE");
      setAudit([]); setRoles([]); setUsers([]);
    } finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, [page]);

  const filtered = useMemo(() => audit.filter(row => {
    const actionOk = !action || row.action.toLowerCase().includes(action.toLowerCase());
    const entityOk = !entity || (row.entity_type ?? "").toLowerCase().includes(entity.toLowerCase());
    return actionOk && entityOk;
  }), [audit, action, entity]);
  const ownerCount = roles.filter(r => r.role === "owner").length;
  const adminCount = roles.filter(r => r.role === "admin").length;
  const auditorCount = roles.filter(r => r.role === "auditor").length;
  const pages = Math.max(1, Math.ceil(total / 50));

  const grant = async () => {
    if (!selectedUser) return;
    setBusy(true); setError(""); setMessage("");
    try { await api("/api/v1/admin/roles", { method:"POST", body:JSON.stringify({ user_id:selectedUser, role:selectedRole }) }); setMessage(tr(en,"تم منح الصلاحية بنجاح.","Role granted successfully.")); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ROLE_GRANT_FORBIDDEN"); setBusy(false); }
  };
  const revoke = async (userId:string) => {
    setBusy(true); setError(""); setMessage("");
    try { await api(`/api/v1/admin/roles?user_id=${encodeURIComponent(userId)}`, { method:"DELETE" }); setMessage(tr(en,"تم سحب الصلاحية.","Role revoked.")); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ROLE_REVOKE_FORBIDDEN"); setBusy(false); }
  };

  const roleRows = roles.length === 0
    ? <p>{tr(en,"لا توجد أدوار إدارية مهيأة حاليًا.","No administrative roles are configured yet.")}</p>
    : roles.map(role => {
        const user = users.find(u => u.id === role.user_id);
        const label = user?.full_name || user?.username || role.user_id;
        return <article className="data-row" key={role.user_id}><div><strong>{label}</strong><small>{role.role} · {new Date(role.created_at).toLocaleString()}</small></div><button className="secondary-button" disabled={busy} onClick={() => void revoke(role.user_id)}>{tr(en,"سحب","Revoke")}</button></article>;
      });
  const auditRows = busy && audit.length === 0
    ? <p>{tr(en,"جارٍ التحميل…","Loading…")}</p>
    : filtered.length === 0
      ? <p>{tr(en,"لا توجد أحداث مطابقة.","No matching audit events.")}</p>
      : filtered.map(row => <article className="data-row" key={row.id}><div><strong>{row.action}</strong><small>{row.entity_type || "system"}{row.entity_id ? ` · ${row.entity_id}` : ""} · {new Date(row.created_at).toLocaleString()}</small></div><code>{row.user_id || "system"}</code></article>);

  return <section className="panel">
    <div className="section-heading"><div><p className="eyebrow">BYE PRO FINANCE</p><h2>{tr(en,"لوحة التدقيق والإدارة","Audit & Administration")}</h2><p>{tr(en,"سجل دائم للأحداث مع RBAC حقيقي مفروض من قاعدة البيانات، وليس من الواجهة فقط.","Persistent audit history with database-enforced RBAC, not UI-only permissions.")}</p></div><button className="secondary-button" onClick={() => void load()} disabled={busy}>{tr(en,"تحديث","Refresh")}</button></div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {message && <p className="notice success" role="status">{message}</p>}
    <div className="stats-grid"><div className="stat-card"><span>{tr(en,"أحداث التدقيق","Audit events")}</span><strong>{total}</strong></div><div className="stat-card"><span>Owners</span><strong>{ownerCount}</strong></div><div className="stat-card"><span>Admins</span><strong>{adminCount}</strong></div><div className="stat-card"><span>Auditors</span><strong>{auditorCount}</strong></div></div>
    <div className="section-heading"><div><h3>{tr(en,"إدارة الصلاحيات","Role management")}</h3><p>{tr(en,"المالك فقط يستطيع منح أو سحب الأدوار.","Only an owner can grant or revoke roles.")}</p></div></div>
    <div className="form-grid"><select aria-label={tr(en,"اختر مستخدمًا","Select user")} value={selectedUser} onChange={e => setSelectedUser(e.target.value)}><option value="">{tr(en,"اختر مستخدمًا","Select user")}</option>{users.map(user => <option key={user.id} value={user.id}>{user.full_name || user.username || user.public_id || user.id}</option>)}</select><select aria-label={tr(en,"الدور الإداري","Administrative role")} value={selectedRole} onChange={e => setSelectedRole(e.target.value as "admin"|"auditor")}><option value="auditor">Auditor</option><option value="admin">Admin</option></select><button className="primary-button" disabled={!selectedUser || busy} onClick={() => void grant()}>{tr(en,"منح الصلاحية","Grant role")}</button></div>
    <div className="data-list">{roleRows}</div>
    <div className="section-heading"><div><h3>{tr(en,"سجل التدقيق الدائم","Persistent audit log")}</h3><p>{tr(en,"الأحداث تُسجل من PostgreSQL triggers وتبقى غير قابلة للتعديل أو الحذف من التطبيق.","Events are recorded by PostgreSQL triggers and cannot be edited or deleted by the application.")}</p></div></div>
    <div className="form-grid"><input aria-label={tr(en,"تصفية حسب الحدث","Filter by action")} value={action} onChange={e => setAction(e.target.value)} placeholder={tr(en,"تصفية حسب الحدث","Filter by action")}/><input aria-label={tr(en,"تصفية حسب الكيان","Filter by entity")} value={entity} onChange={e => setEntity(e.target.value)} placeholder={tr(en,"تصفية حسب الكيان","Filter by entity")}/></div>
    <div className="data-list">{auditRows}</div>
    <div className="form-grid"><button className="secondary-button" disabled={page <= 1 || busy} onClick={() => setPage(p => p - 1)}>{tr(en,"السابق","Previous")}</button><span>{page} / {pages}</span><button className="secondary-button" disabled={page >= pages || busy} onClick={() => setPage(p => p + 1)}>{tr(en,"التالي","Next")}</button></div>
  </section>;
}
