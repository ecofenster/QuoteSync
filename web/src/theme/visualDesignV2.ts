import {
  applyQuoteSyncTheme,
  readStoredQuoteSyncTheme,
  saveQuoteSyncTheme,
  type ResolvedQuoteSyncThemeId,
} from "./themes";

export const QUOTESYNC_VISUAL_LAB_STORAGE_KEY = "quotesync:visualDesignV2Lab";

export type QuoteSuiteBrandId = "quotesuite" | "ecofenster" | "zyle-fenster" | "glassworx";
export type QuoteSuiteAppearance = "dark" | "light";
export type QuoteSuiteVisualThemeId =
  | "current-dark"
  | "current-light"
  | "quotesuite-v2-dark"
  | "quotesuite-v2-light"
  | "ecofenster-v2-dark"
  | "ecofenster-v2-light"
  | "zyle-v2-dark"
  | "zyle-v2-light"
  | "glassworx-v2-dark"
  | "glassworx-v2-light";

export type QuoteSuiteVisualTheme = {
  id: QuoteSuiteVisualThemeId;
  name: string;
  group: "Approved V2" | "Legacy fallback";
  design: "v2" | "legacy";
  brand: QuoteSuiteBrandId;
  appearance: QuoteSuiteAppearance;
};

export const QUOTESUITE_V2_BRANDS: readonly { id: QuoteSuiteBrandId; name: string }[] = [
  { id: "quotesuite", name: "QuoteSuite" },
  { id: "ecofenster", name: "Ecofenster" },
  { id: "zyle-fenster", name: "Zyle Fenster" },
  { id: "glassworx", name: "GlassWorx" },
] as const;

export const QUOTESUITE_VISUAL_THEMES: readonly QuoteSuiteVisualTheme[] = [
  { id: "quotesuite-v2-light", name: "QuoteSuite V2 Light", group: "Approved V2", design: "v2", brand: "quotesuite", appearance: "light" },
  { id: "quotesuite-v2-dark", name: "QuoteSuite V2 Dark", group: "Approved V2", design: "v2", brand: "quotesuite", appearance: "dark" },
  { id: "ecofenster-v2-light", name: "Ecofenster V2 Light", group: "Approved V2", design: "v2", brand: "ecofenster", appearance: "light" },
  { id: "ecofenster-v2-dark", name: "Ecofenster V2 Dark", group: "Approved V2", design: "v2", brand: "ecofenster", appearance: "dark" },
  { id: "zyle-v2-light", name: "Zyle Fenster V2 Light", group: "Approved V2", design: "v2", brand: "zyle-fenster", appearance: "light" },
  { id: "zyle-v2-dark", name: "Zyle Fenster V2 Dark", group: "Approved V2", design: "v2", brand: "zyle-fenster", appearance: "dark" },
  { id: "glassworx-v2-light", name: "GlassWorx V2 Light", group: "Approved V2", design: "v2", brand: "glassworx", appearance: "light" },
  { id: "glassworx-v2-dark", name: "GlassWorx V2 Dark", group: "Approved V2", design: "v2", brand: "glassworx", appearance: "dark" },
  { id: "current-light", name: "Legacy QuoteSuite Light", group: "Legacy fallback", design: "legacy", brand: "ecofenster", appearance: "light" },
  { id: "current-dark", name: "Legacy QuoteSuite Dark", group: "Legacy fallback", design: "legacy", brand: "ecofenster", appearance: "dark" },
] as const;

export function isQuoteSuiteVisualThemeId(value: unknown): value is QuoteSuiteVisualThemeId {
  return typeof value === "string" && QUOTESUITE_VISUAL_THEMES.some((theme) => theme.id === value);
}

export function getQuoteSuiteVisualTheme(id: QuoteSuiteVisualThemeId) {
  return QUOTESUITE_VISUAL_THEMES.find((theme) => theme.id === id)!;
}

export function quoteSuiteV2ThemeIdFor(brand: QuoteSuiteBrandId, appearance: QuoteSuiteAppearance): QuoteSuiteVisualThemeId {
  return `${brand === "zyle-fenster" ? "zyle" : brand}-v2-${appearance}` as QuoteSuiteVisualThemeId;
}

function removeV2Scope(root: HTMLElement) {
  delete root.dataset.qsDesign;
  delete root.dataset.qsV2Brand;
  delete root.dataset.qsV2Appearance;
  delete root.dataset.qsV2Theme;
}

export function readStoredQuoteSuiteVisualTheme(): QuoteSuiteVisualThemeId {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(QUOTESYNC_VISUAL_LAB_STORAGE_KEY);
      if (isQuoteSuiteVisualThemeId(stored)) return stored;
    } catch {
      // The approved theme selector remains usable without local storage.
    }
  }
  const appearance = readStoredQuoteSyncTheme() === "dark" ? "dark" : "light";
  return quoteSuiteV2ThemeIdFor("quotesuite", appearance);
}

export function applyQuoteSuiteVisualTheme(id: QuoteSuiteVisualThemeId, persist = true) {
  if (typeof document === "undefined") return;
  const theme = getQuoteSuiteVisualTheme(id);
  const mode: ResolvedQuoteSyncThemeId = theme.appearance;
  applyQuoteSyncTheme(mode);
  const root = document.documentElement;
  if (theme.design === "v2") {
    root.dataset.qsDesign = "v2";
    root.dataset.qsV2Brand = theme.brand;
    root.dataset.qsV2Appearance = theme.appearance;
    root.dataset.qsV2Theme = theme.id;
  } else {
    removeV2Scope(root);
  }
  saveQuoteSyncTheme(mode);
  if (persist && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(QUOTESYNC_VISUAL_LAB_STORAGE_KEY, id);
    } catch {
      // Theme selection is non-critical if storage is unavailable.
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("quotesync-visual-theme-change", { detail: { id, theme } }));
  }
}

export function clearQuoteSuiteVisualTheme(mode: ResolvedQuoteSyncThemeId) {
  applyQuoteSuiteVisualTheme(mode === "dark" ? "current-dark" : "current-light");
}

export function initialiseQuoteSuiteVisualTheme() {
  applyQuoteSuiteVisualTheme(readStoredQuoteSuiteVisualTheme(), false);
}
