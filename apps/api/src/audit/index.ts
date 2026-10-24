export type AuditEvent = { userId: string; action: string; resource: string; at: string };

export function createAuditEvent(userId: string, action: string, resource: string): AuditEvent {
  return { userId, action, resource, at: new Date().toISOString() };
}
