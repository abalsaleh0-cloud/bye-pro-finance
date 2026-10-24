export type DatabaseHealth = { ok: boolean; checkedAt: string };

export function databaseHealth(): DatabaseHealth {
  return { ok: true, checkedAt: new Date().toISOString() };
}
