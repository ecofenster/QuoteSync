import { apiFetch } from "../services/api/apiClient.ts";

export const QUOTESYNC_THEME_STORAGE_KEY = "quotesync:selectedTheme";
export const QUOTESYNC_TEXT_SIZE_STORAGE_KEY = "quotesync:textSize";
export const QUOTESYNC_THEME_CONFIGURATION_KEY = "branding.themeConfiguration";
const QUOTESYNC_THEME_CACHE_KEY = "quotesync:companyThemeCache";

export const QUOTESYNC_THEMES = [
  { id: "light", name: "Light" },
  { id: "dark", name: "Dark" },
  { id: "system", name: "System" },
] as const;

export const QUOTESYNC_FONT_OPTIONS = [
  { id: "system", name: "System Default", cssFamily: '"Segoe UI", Arial, Helvetica, sans-serif', googleFamily: undefined },
  { id: "inter", name: "Inter", cssFamily: '"Inter", "Segoe UI", Arial, sans-serif', googleFamily: "Inter" },
  { id: "roboto", name: "Roboto", cssFamily: '"Roboto", "Segoe UI", Arial, sans-serif', googleFamily: "Roboto" },
  { id: "open-sans", name: "Open Sans", cssFamily: '"Open Sans", "Segoe UI", Arial, sans-serif', googleFamily: "Open Sans" },
  { id: "lato", name: "Lato", cssFamily: '"Lato", "Segoe UI", Arial, sans-serif', googleFamily: "Lato" },
  { id: "montserrat", name: "Montserrat", cssFamily: '"Montserrat", "Segoe UI", Arial, sans-serif', googleFamily: "Montserrat" },
  { id: "poppins", name: "Poppins", cssFamily: '"Poppins", "Segoe UI", Arial, sans-serif', googleFamily: "Poppins" },
  { id: "source-sans-3", name: "Source Sans 3", cssFamily: '"Source Sans 3", "Segoe UI", Arial, sans-serif', googleFamily: "Source Sans 3" },
  { id: "nunito-sans", name: "Nunito Sans", cssFamily: '"Nunito Sans", "Segoe UI", Arial, sans-serif', googleFamily: "Nunito Sans" },
] as const;

export type QuoteSyncThemeId = (typeof QUOTESYNC_THEMES)[number]["id"];
export type ResolvedQuoteSyncThemeId = Exclude<QuoteSyncThemeId, "system">;
export type QuoteSyncFontId = (typeof QUOTESYNC_FONT_OPTIONS)[number]["id"];
export type QuoteSyncTextSize = "compact"|"standard"|"large"|"extra-large";
export const QUOTESYNC_TEXT_SIZES:ReadonlyArray<{id:QuoteSyncTextSize;name:string;description:string}>=[
  {id:"compact",name:"Compact",description:"More information with the canonical minimum readable scale."},
  {id:"standard",name:"Standard",description:"Recommended QuoteSuite application size."},
  {id:"large",name:"Large",description:"Larger controls and application text."},
  {id:"extra-large",name:"Extra Large",description:"Maximum supported application text size."},
];

export type ThemePalette = {
  background: string;
  surface: string;
  elevatedSurface: string;
  card: string;
  control: string;
  border: string;
  primaryText: string;
  secondaryText: string;
};

export type QuoteSyncThemeConfiguration = {
  defaultMode: QuoteSyncThemeId;
  fontFamily: QuoteSyncFontId;
  primary: string;
  accent: string;
  light: ThemePalette;
  dark: ThemePalette;
  semantic: {
    success: string;
    warning: string;
    error: string;
    information: string;
    sellingPrice: string;
  };
  operational: {
    quotes: string;
    installations: string;
    ordersAttention: string;
    invoices: string;
    pipelineNewLeads: string;
    pipelineQuoted: string;
    pipelineNegotiation: string;
    pipelineWon: string;
  };
  appearance: {
    density: "compact" | "standard" | "comfortable";
    corners: "square-ish" | "standard" | "rounded";
    elevation: "minimal" | "standard" | "enhanced";
    motion: "reduced" | "standard";
  };
};

export type QuoteSyncNamedTheme = {
  id: string;
  name: string;
  builtIn: boolean;
  baseThemeId: string;
  configuration: QuoteSyncThemeConfiguration;
};

export type QuoteSyncThemeStore = {
  schemaVersion: 2;
  activeThemeId: string;
  themes: QuoteSyncNamedTheme[];
};

export const BUILT_IN_THEME_ID = "ecofenster-default";

export const DEFAULT_QUOTESYNC_THEME: QuoteSyncThemeId = "light";

export const DEFAULT_QUOTESYNC_THEME_CONFIGURATION: QuoteSyncThemeConfiguration = {
  defaultMode: "light",
  fontFamily: "system",
  primary: "#55b948",
  accent: "#b5da9c",
  light: {
    background: "#eef1ed",
    surface: "#ffffff",
    elevatedSurface: "#f5f7f4",
    card: "#f5f7f4",
    control: "#f8f9f7",
    border: "#aeb8ae",
    primaryText: "#231f20",
    secondaryText: "#6b6768",
  },
  dark: {
    background: "#181b19",
    surface: "#1e211f",
    elevatedSurface: "#292e2a",
    card: "#252a26",
    control: "#202421",
    border: "#363d38",
    primaryText: "#f4f7f4",
    secondaryText: "#aeb7b0",
  },
  semantic: {
    success: "#55b948",
    warning: "#f1b84b",
    error: "#f87171",
    information: "#60a5fa",
    sellingPrice: "#55b948",
  },
  operational: {
    quotes: "#b5da9c",
    installations: "#60a5fa",
    ordersAttention: "#f87171",
    invoices: "#a78bfa",
    pipelineNewLeads: "#b5da9c",
    pipelineQuoted: "#60a5fa",
    pipelineNegotiation: "#a78bfa",
    pipelineWon: "#55b948",
  },
  appearance: { density: "standard", corners: "standard", elevation: "standard", motion: "standard" },
};

export const BUILT_IN_QUOTESYNC_THEME: QuoteSyncNamedTheme = {
  id: BUILT_IN_THEME_ID,
  name: "Ecofenster Default",
  builtIn: true,
  baseThemeId: BUILT_IN_THEME_ID,
  configuration: structuredClone(DEFAULT_QUOTESYNC_THEME_CONFIGURATION),
};

const LEGACY_THEME_MIGRATIONS: Record<string, QuoteSyncThemeId> = {
  "eco-clean-enterprise": "light",
  "eco-glass-dashboard": "light",
  "eco-matchday-dark": "dark",
  "eco-neon-analytics": "dark",
};

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;
const FONT_LINK_ID = "quotesync-company-font";
let activeConfiguration = structuredClone(DEFAULT_QUOTESYNC_THEME_CONFIGURATION);
let activeThemeStore: QuoteSyncThemeStore = { schemaVersion: 2, activeThemeId: BUILT_IN_THEME_ID, themes: [] };
let companyThemeLoadPromise: Promise<QuoteSyncThemeStore> | null = null;
let systemMediaQuery: MediaQueryList | null = null;
let storageListenerRegistered = false;

export function isQuoteSyncThemeId(value: unknown): value is QuoteSyncThemeId {
  return typeof value === "string" && QUOTESYNC_THEMES.some((theme) => theme.id === value);
}

export function isQuoteSyncFontId(value: unknown): value is QuoteSyncFontId {
  return typeof value === "string" && QUOTESYNC_FONT_OPTIONS.some((font) => font.id === value);
}

export function resolveThemePreference(explicitPreference: QuoteSyncThemeId | null, companyDefault: QuoteSyncThemeId = DEFAULT_QUOTESYNC_THEME) {
  return explicitPreference ?? companyDefault ?? DEFAULT_QUOTESYNC_THEME;
}

export function normaliseQuoteSyncThemeId(value: unknown): QuoteSyncThemeId {
  if (isQuoteSyncThemeId(value)) return value;
  if (typeof value === "string" && LEGACY_THEME_MIGRATIONS[value]) return LEGACY_THEME_MIGRATIONS[value];
  return DEFAULT_QUOTESYNC_THEME;
}

function validColour(value: unknown, fallback: string) {
  return typeof value === "string" && HEX_PATTERN.test(value) ? value.toLowerCase() : fallback;
}

export function normaliseThemeConfiguration(value: unknown): QuoteSyncThemeConfiguration {
  const source = value && typeof value === "object" ? value as Partial<QuoteSyncThemeConfiguration> & { mode?: unknown } : {};
  const defaults = DEFAULT_QUOTESYNC_THEME_CONFIGURATION;
  const palette = (candidate: Partial<ThemePalette> | undefined, fallback: ThemePalette): ThemePalette => ({
    background: validColour(candidate?.background, fallback.background),
    surface: validColour(candidate?.surface, fallback.surface),
    elevatedSurface: validColour(candidate?.elevatedSurface, fallback.elevatedSurface),
    card: validColour(candidate?.card, fallback.card),
    control: validColour(candidate?.control, fallback.control),
    border: validColour(candidate?.border, fallback.border),
    primaryText: validColour(candidate?.primaryText, fallback.primaryText),
    secondaryText: validColour(candidate?.secondaryText, fallback.secondaryText),
  });
  return {
    defaultMode: isQuoteSyncThemeId(source.defaultMode)
      ? source.defaultMode
      : isQuoteSyncThemeId(source.mode) ? source.mode : defaults.defaultMode,
    fontFamily: isQuoteSyncFontId(source.fontFamily) ? source.fontFamily : defaults.fontFamily,
    primary: validColour(source.primary, defaults.primary),
    accent: validColour(source.accent, defaults.accent),
    light: palette(source.light, defaults.light),
    dark: palette(source.dark, defaults.dark),
    semantic: {
      success: validColour(source.semantic?.success, defaults.semantic.success),
      warning: validColour(source.semantic?.warning, defaults.semantic.warning),
      error: validColour(source.semantic?.error, defaults.semantic.error),
      information: validColour(source.semantic?.information, defaults.semantic.information),
      sellingPrice: validColour(source.semantic?.sellingPrice, defaults.semantic.sellingPrice),
    },
    operational: {
      quotes: validColour(source.operational?.quotes, defaults.operational.quotes),
      installations: validColour(source.operational?.installations, defaults.operational.installations),
      ordersAttention: validColour(source.operational?.ordersAttention, defaults.operational.ordersAttention),
      invoices: validColour(source.operational?.invoices, defaults.operational.invoices),
      pipelineNewLeads: validColour(source.operational?.pipelineNewLeads, defaults.operational.pipelineNewLeads),
      pipelineQuoted: validColour(source.operational?.pipelineQuoted, defaults.operational.pipelineQuoted),
      pipelineNegotiation: validColour(source.operational?.pipelineNegotiation, defaults.operational.pipelineNegotiation),
      pipelineWon: validColour(source.operational?.pipelineWon, defaults.operational.pipelineWon),
    },
    appearance: {
      density: ["compact", "standard", "comfortable"].includes(source.appearance?.density ?? "") ? source.appearance!.density! : defaults.appearance.density,
      corners: ["square-ish", "standard", "rounded"].includes(source.appearance?.corners ?? "") ? source.appearance!.corners! : defaults.appearance.corners,
      elevation: ["minimal", "standard", "enhanced"].includes(source.appearance?.elevation ?? "") ? source.appearance!.elevation! : defaults.appearance.elevation,
      motion: ["reduced", "standard"].includes(source.appearance?.motion ?? "") ? source.appearance!.motion! : defaults.appearance.motion,
    },
  };
}

function safeThemeId(value: unknown, fallback = "custom-theme") {
  const normalized = String(value ?? "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  return normalized || fallback;
}

export function normaliseThemeStore(value: unknown): QuoteSyncThemeStore {
  const source = value && typeof value === "object" ? value as Partial<QuoteSyncThemeStore> : {};
  if (source.schemaVersion === 2 && Array.isArray(source.themes)) {
    const seen = new Set<string>();
    const themes = source.themes.flatMap((theme) => {
      if (!theme || typeof theme !== "object") return [];
      let id = safeThemeId(theme.id);
      if (id === BUILT_IN_THEME_ID || seen.has(id)) id = `${id}-${seen.size + 1}`;
      seen.add(id);
      return [{ id, name: String(theme.name || "Custom Theme").trim() || "Custom Theme", builtIn: false, baseThemeId: BUILT_IN_THEME_ID, configuration: normaliseThemeConfiguration(theme.configuration) }];
    });
    const activeThemeId = source.activeThemeId === BUILT_IN_THEME_ID || themes.some((theme) => theme.id === source.activeThemeId)
      ? String(source.activeThemeId)
      : BUILT_IN_THEME_ID;
    return { schemaVersion: 2, activeThemeId, themes };
  }
  const legacy = normaliseThemeConfiguration(value);
  if (JSON.stringify(legacy) === JSON.stringify(DEFAULT_QUOTESYNC_THEME_CONFIGURATION)) {
    return { schemaVersion: 2, activeThemeId: BUILT_IN_THEME_ID, themes: [] };
  }
  return { schemaVersion: 2, activeThemeId: "migrated-company-theme", themes: [{ id: "migrated-company-theme", name: "Migrated Company Theme", builtIn: false, baseThemeId: BUILT_IN_THEME_ID, configuration: legacy }] };
}

export function listThemes(store: QuoteSyncThemeStore) {
  return [structuredClone(BUILT_IN_QUOTESYNC_THEME), ...store.themes.map((theme) => structuredClone(theme))];
}

export function getSelectedTheme(store: QuoteSyncThemeStore) {
  return listThemes(store).find((theme) => theme.id === store.activeThemeId) ?? structuredClone(BUILT_IN_QUOTESYNC_THEME);
}

export function readStoredThemePreference(): QuoteSyncThemeId | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(QUOTESYNC_THEME_STORAGE_KEY);
    if (!stored) return null;
    return isQuoteSyncThemeId(stored) || LEGACY_THEME_MIGRATIONS[stored]
      ? normaliseQuoteSyncThemeId(stored)
      : null;
  } catch {
    return null;
  }
}

export function readStoredQuoteSyncTheme(): QuoteSyncThemeId {
  return resolveThemePreference(readStoredThemePreference(), activeConfiguration.defaultMode);
}

export function normaliseQuoteSyncTextSize(value:unknown):QuoteSyncTextSize{return QUOTESYNC_TEXT_SIZES.some(option=>option.id===value)?value as QuoteSyncTextSize:"standard"}
export function readStoredQuoteSyncTextSize():QuoteSyncTextSize{if(typeof window==="undefined")return "standard";try{return normaliseQuoteSyncTextSize(window.localStorage.getItem(QUOTESYNC_TEXT_SIZE_STORAGE_KEY))}catch{return "standard"}}
export function applyQuoteSyncTextSize(value:QuoteSyncTextSize){if(typeof document==="undefined")return;const normalized=normaliseQuoteSyncTextSize(value);document.documentElement.dataset.qsTextSize=normalized;if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("quotesync-text-size-change",{detail:{textSize:normalized}}))}
export function saveQuoteSyncTextSize(value:QuoteSyncTextSize){const normalized=normaliseQuoteSyncTextSize(value);if(typeof window!=="undefined")try{window.localStorage.setItem(QUOTESYNC_TEXT_SIZE_STORAGE_KEY,normalized)}catch{/* Device preference remains non-critical when storage is unavailable. */}applyQuoteSyncTextSize(normalized)}

function resolveTheme(themeId: QuoteSyncThemeId): ResolvedQuoteSyncThemeId {
  if (themeId !== "system") return themeId;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyToken(name: string, value: string) {
  document.documentElement.style.setProperty(name, value);
}

function applyFontFamily(fontId: QuoteSyncFontId) {
  const font = QUOTESYNC_FONT_OPTIONS.find((option) => option.id === fontId) ?? QUOTESYNC_FONT_OPTIONS[0];
  applyToken("--qs-font-family", font.cssFamily);
  document.documentElement.dataset.qsFont = font.id;
  const current = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
  if (!font.googleFamily) {
    current?.remove();
    return;
  }
  const family = encodeURIComponent(font.googleFamily).replace(/%20/g, "+");
  const href = `https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600;700;800;900&display=swap`;
  if (current?.href === href) return;
  current?.remove();
  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = href;
  link.addEventListener("error", () => link.remove(), { once: true });
  document.head.appendChild(link);
}

export function applyThemeConfiguration(configuration: QuoteSyncThemeConfiguration, requestedMode = configuration.defaultMode) {
  if (typeof document === "undefined") return;
  activeConfiguration = normaliseThemeConfiguration(configuration);
  const resolved = resolveTheme(requestedMode);
  const palette = activeConfiguration[resolved];
  const interactiveHover = resolved === "dark"
    ? `color-mix(in srgb, ${activeConfiguration.primary} 20%, ${palette.surface})`
    : `color-mix(in srgb, var(--qs-theme-action-primary) 14%, ${palette.elevatedSurface})`;
  const isDefaultBrand = activeConfiguration.primary.toLowerCase() === DEFAULT_QUOTESYNC_THEME_CONFIGURATION.primary;
  const actionPrimary = resolved === "dark"
    ? (isDefaultBrand ? "#275c32" : `color-mix(in srgb, ${activeConfiguration.primary} 58%, #102519)`)
    : `color-mix(in srgb, ${activeConfiguration.primary} 78%, #173c22)`;
  const selected = resolved === "dark" ? actionPrimary : `color-mix(in srgb, ${actionPrimary} 90%, #000)`;
  const accentText = resolved === "dark"
    ? activeConfiguration.primary
    : `color-mix(in srgb, ${activeConfiguration.primary} 66%, #173c22)`;
  const actionPrimaryHover = `color-mix(in srgb, ${actionPrimary} 82%, #000)`;
  applyFontFamily(activeConfiguration.fontFamily);
  document.documentElement.dataset.qsTheme = resolved;
  document.documentElement.dataset.qsThemePreference = requestedMode;
  const tokens: Record<string, string> = {
    "--qs-theme-page": palette.background,
    "--qs-theme-surface": palette.surface,
    "--qs-theme-elevated": palette.elevatedSurface,
    "--qs-theme-card": palette.card,
    "--qs-theme-sidebar": resolved === "dark" ? palette.surface : "#e7ece6",
    "--qs-theme-row": resolved === "dark" ? "transparent" : palette.control,
    "--qs-theme-border": palette.border,
    "--qs-theme-border-strong": accentText,
    "--qs-theme-text": palette.primaryText,
    "--qs-theme-text-secondary": palette.secondaryText,
    "--qs-theme-text-muted": palette.secondaryText,
    "--qs-theme-input": palette.control,
    "--qs-theme-button": palette.elevatedSurface,
    "--qs-theme-button-hover": interactiveHover,
    "--qs-theme-row-hover": resolved === "dark" ? "#2e3638" : "#dde4df",
    "--qs-theme-selected": selected,
    "--qs-theme-selected-text": "#ffffff",
    "--qs-theme-control-border": resolved === "dark" ? "#2e3638" : palette.border,
    "--qs-theme-action-primary": actionPrimary,
    "--qs-theme-action-primary-hover": actionPrimaryHover,
    "--qs-theme-action-primary-text": "#ffffff",
    "--qs-theme-primary-hover": actionPrimaryHover,
    "--qs-theme-primary": activeConfiguration.primary,
    "--qs-theme-accent": activeConfiguration.accent,
    "--qs-theme-accent-text": accentText,
    "--qs-theme-selling": activeConfiguration.semantic.sellingPrice,
    "--qs-semantic-success": activeConfiguration.semantic.success,
    "--qs-semantic-warning": activeConfiguration.semantic.warning,
    "--qs-semantic-error": activeConfiguration.semantic.error,
    "--qs-semantic-attention": activeConfiguration.semantic.error,
    "--qs-semantic-info": activeConfiguration.semantic.information,
    "--qs-operational-quotes": activeConfiguration.operational.quotes,
    "--qs-operational-installations": activeConfiguration.operational.installations,
    "--qs-operational-orders": activeConfiguration.operational.ordersAttention,
    "--qs-operational-invoices": activeConfiguration.operational.invoices,
    "--qs-pipeline-leads": activeConfiguration.operational.pipelineNewLeads,
    "--qs-pipeline-quoted": activeConfiguration.operational.pipelineQuoted,
    "--qs-pipeline-negotiation": activeConfiguration.operational.pipelineNegotiation,
    "--qs-pipeline-won": activeConfiguration.operational.pipelineWon,
  };
  Object.entries(tokens).forEach(([name, tokenValue]) => applyToken(name, tokenValue));
  document.documentElement.dataset.qsDensity = activeConfiguration.appearance.density;
  document.documentElement.dataset.qsCorners = activeConfiguration.appearance.corners;
  document.documentElement.dataset.qsElevation = activeConfiguration.appearance.elevation;
  document.documentElement.dataset.qsMotion = activeConfiguration.appearance.motion;
  applyQuoteSyncTextSize(readStoredQuoteSyncTextSize());
  window.dispatchEvent(new CustomEvent("quotesync-theme-change", { detail: { requestedMode, resolved } }));
}

export function applyQuoteSyncTheme(themeId: QuoteSyncThemeId) {
  applyThemeConfiguration(activeConfiguration, themeId);
}

export function saveQuoteSyncTheme(themeId: QuoteSyncThemeId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUOTESYNC_THEME_STORAGE_KEY, themeId);
  } catch {
    // Theme selection is non-critical if storage is unavailable.
  }
}

export async function loadCompanyThemeStore(force = false) {
  if (typeof window === "undefined") return activeThemeStore;
  if (companyThemeLoadPromise && !force) return companyThemeLoadPromise;
  companyThemeLoadPromise = (async () => {
    try {
      const rows = await apiFetch("/api/settings/branding") as Array<{ key?: string; value?: unknown }>;
      const stored = rows.find((row) => row.key === QUOTESYNC_THEME_CONFIGURATION_KEY)?.value;
      activeThemeStore = normaliseThemeStore(stored);
      try { window.localStorage.setItem(QUOTESYNC_THEME_CACHE_KEY, JSON.stringify(activeThemeStore)); } catch { /* Cache is optional. */ }
    } catch {
      activeThemeStore = normaliseThemeStore(undefined);
    }
    activeConfiguration = getSelectedTheme(activeThemeStore).configuration;
    const mode = resolveThemePreference(readStoredThemePreference(), activeConfiguration.defaultMode);
    applyThemeConfiguration(activeConfiguration, mode);
    return structuredClone(activeThemeStore);
  })();
  return companyThemeLoadPromise;
}

export async function loadCompanyThemeConfiguration() {
  await loadCompanyThemeStore();
  return structuredClone(activeConfiguration);
}

export async function saveCompanyThemeStore(store: QuoteSyncThemeStore) {
  const normalized = normaliseThemeStore(store);
  await apiFetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: QUOTESYNC_THEME_CONFIGURATION_KEY, group_name: "branding", value: normalized }) });
  activeThemeStore = normalized;
  try { window.localStorage.setItem(QUOTESYNC_THEME_CACHE_KEY, JSON.stringify(normalized)); } catch { /* Cache is optional. */ }
  companyThemeLoadPromise = Promise.resolve(structuredClone(normalized));
  activeConfiguration = getSelectedTheme(normalized).configuration;
  const mode = resolveThemePreference(readStoredThemePreference(), activeConfiguration.defaultMode);
  applyThemeConfiguration(activeConfiguration, mode);
  return structuredClone(normalized);
}

export async function saveCompanyThemeConfiguration(configuration: QuoteSyncThemeConfiguration) {
  const normalized = normaliseThemeConfiguration(configuration);
  const themeId = activeThemeStore.activeThemeId === BUILT_IN_THEME_ID ? "company-custom-theme" : activeThemeStore.activeThemeId;
  const existing = activeThemeStore.themes.find((theme) => theme.id === themeId);
  await saveCompanyThemeStore({ ...activeThemeStore, activeThemeId: themeId, themes: [...activeThemeStore.themes.filter((theme) => theme.id !== themeId), { id: themeId, name: existing?.name ?? "Company Custom Theme", builtIn: false, baseThemeId: BUILT_IN_THEME_ID, configuration: normalized }] });
  return normalized;
}

export function getActiveThemeConfiguration() {
  return structuredClone(activeConfiguration);
}

export function initialiseQuoteSyncTheme() {
  if (typeof window !== "undefined") {
    try {
      const cached = window.localStorage.getItem(QUOTESYNC_THEME_CACHE_KEY);
      if (cached) {
        activeThemeStore = normaliseThemeStore(JSON.parse(cached));
        activeConfiguration = getSelectedTheme(activeThemeStore).configuration;
      }
    } catch { /* Invalid cache safely falls back to Ecofenster defaults. */ }
  }
  const themeId = readStoredQuoteSyncTheme();
  applyThemeConfiguration(activeConfiguration, themeId);
  if (typeof window !== "undefined") {
    systemMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    systemMediaQuery.addEventListener("change", () => {
      if (resolveThemePreference(readStoredThemePreference(), activeConfiguration.defaultMode) === "system") applyQuoteSyncTheme("system");
    });
    if (!storageListenerRegistered) {
      window.addEventListener("storage", (event) => {
        if (event.storageArea !== window.localStorage) return;
        if (event.key === QUOTESYNC_THEME_CACHE_KEY && event.newValue) {
          try {
            activeThemeStore = normaliseThemeStore(JSON.parse(event.newValue));
            activeConfiguration = getSelectedTheme(activeThemeStore).configuration;
            companyThemeLoadPromise = Promise.resolve(structuredClone(activeThemeStore));
            const mode = resolveThemePreference(readStoredThemePreference(), activeConfiguration.defaultMode);
            applyThemeConfiguration(activeConfiguration, mode);
          } catch {
            // Ignore malformed cross-tab cache updates and keep the last valid theme.
          }
        }
        if (event.key === QUOTESYNC_THEME_STORAGE_KEY) {
          const mode = resolveThemePreference(readStoredThemePreference(), activeConfiguration.defaultMode);
          applyThemeConfiguration(activeConfiguration, mode);
        }
        if (event.key === QUOTESYNC_TEXT_SIZE_STORAGE_KEY) applyQuoteSyncTextSize(readStoredQuoteSyncTextSize());
      });
      storageListenerRegistered = true;
    }
  }
}
