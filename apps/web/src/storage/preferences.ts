const key = "bye-pro-finance.preferences";

export interface LocalPreferences {
  locale: "ar" | "en";
  theme: "light" | "dark" | "system";
}

const defaults: LocalPreferences = { locale: "ar", theme: "system" };

export function loadPreferences(): LocalPreferences {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<LocalPreferences>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function savePreferences(preferences: LocalPreferences): void {
  localStorage.setItem(key, JSON.stringify(preferences));
}
