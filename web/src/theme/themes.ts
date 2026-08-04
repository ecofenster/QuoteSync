export const QUOTESYNC_THEME_STORAGE_KEY = "quotesync:selectedTheme";

export const QUOTESYNC_THEMES = [
  { id: "light", name: "Light" },
  { id: "dark", name: "Dark" },
] as const;

export type QuoteSyncThemeId = (typeof QUOTESYNC_THEMES)[number]["id"];

export const DEFAULT_QUOTESYNC_THEME: QuoteSyncThemeId = "light";

const LEGACY_THEME_MIGRATIONS: Record<string, QuoteSyncThemeId> = {
  "eco-clean-enterprise": "light",
  "eco-glass-dashboard": "light",
  "eco-matchday-dark": "dark",
  "eco-neon-analytics": "dark",
};

export function isQuoteSyncThemeId(value: unknown): value is QuoteSyncThemeId {
  return typeof value === "string" && QUOTESYNC_THEMES.some((theme) => theme.id === value);
}

export function normaliseQuoteSyncThemeId(value: unknown): QuoteSyncThemeId {
  if (isQuoteSyncThemeId(value)) return value;
  if (typeof value === "string" && LEGACY_THEME_MIGRATIONS[value]) return LEGACY_THEME_MIGRATIONS[value];
  return DEFAULT_QUOTESYNC_THEME;
}

export function readStoredQuoteSyncTheme(): QuoteSyncThemeId {
  if (typeof window === "undefined") return DEFAULT_QUOTESYNC_THEME;

  try {
    return normaliseQuoteSyncThemeId(window.localStorage.getItem(QUOTESYNC_THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_QUOTESYNC_THEME;
  }
}

export function applyQuoteSyncTheme(themeId: QuoteSyncThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.qsTheme = themeId;
}

export function saveQuoteSyncTheme(themeId: QuoteSyncThemeId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUOTESYNC_THEME_STORAGE_KEY, themeId);
  } catch {
    // Theme selection is non-critical if storage is unavailable.
  }
}

export function initialiseQuoteSyncTheme() {
  const themeId = readStoredQuoteSyncTheme();
  applyQuoteSyncTheme(themeId);
  saveQuoteSyncTheme(themeId);
}
