const prefix = "bye-pro-finance:";

export function readLocal<T>(key: string): T | null {
  try { const value = localStorage.getItem(prefix + key); return value ? JSON.parse(value) as T : null; } catch { return null; }
}

export function writeLocal<T>(key: string, value: T): void {
  localStorage.setItem(prefix + key, JSON.stringify(value));
}
