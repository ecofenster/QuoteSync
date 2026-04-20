export function getPreference<T>(
  key: string,
  defaultValue: T,
  isValid?: (value: unknown) => value is T
): T {
  try {
    if (typeof window === "undefined" || !window.localStorage) return defaultValue;

    const raw = window.localStorage.getItem(key);
    if (raw === null) return defaultValue;

    const parsed: unknown = JSON.parse(raw);
    if (isValid && !isValid(parsed)) return defaultValue;

    return (parsed as T) ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setPreference<T>(key: string, value: T) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Swallow storage failures so UI state changes never break interaction.
  }
}
