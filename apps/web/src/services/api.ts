const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init.headers },
    credentials: "include",
  });
  if (!response.ok) throw new Error(`API request failed: ${response.status}`);
  return (await response.json()) as T;
}

export async function apiHealth(): Promise<{ ok: boolean; service: string }> {
  return apiRequest("/health");
}
