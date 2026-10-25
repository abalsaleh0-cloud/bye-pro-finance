export type AuditEvent = {
  userId: string;
  action: string;
  resource: string;
  at: string;
};

export function createAuditEvent(userId: string, action: string, resource: string): AuditEvent {
  return { userId, action, resource, at: new Date().toISOString() };
}

export type AuditLogRow = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function listAuditLogs(client: any, limit: number, offset: number) {
  return client
    .from("audit_logs")
    .select("id,user_id,action,entity_type,entity_id,metadata,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
}

export async function listAdminRoles(client: any) {
  return client
    .from("admin_roles")
    .select("user_id,role,granted_by,created_at,updated_at")
    .order("created_at", { ascending: true });
}

export async function grantAdminRole(client: any, userId: string, role: "owner" | "admin" | "auditor", grantedBy: string) {
  return client
    .from("admin_roles")
    .upsert({ user_id: userId, role, granted_by: grantedBy, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select("user_id,role,granted_by,created_at,updated_at")
    .single();
}

export async function revokeAdminRole(client: any, userId: string) {
  return client.from("admin_roles").delete().eq("user_id", userId);
}
