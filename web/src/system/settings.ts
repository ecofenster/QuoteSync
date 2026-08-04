export type SystemSettings = {
  loadDefaults: boolean;
  loadDemoClients: boolean;
  loadDemoEstimates: boolean;
  loadDemoForecast: boolean;
  mapsProvider: "google" | "azure" | "none";
  googleMapsApiKey: string;
  azureMapsApiKey: string;
};

const STORAGE_KEY = "quotesync_system_settings";

export const DEFAULT_SETTINGS: SystemSettings = {
  loadDefaults: false,
  loadDemoClients: false,
  loadDemoEstimates: false,
  loadDemoForecast: false,
  mapsProvider: "none",
  googleMapsApiKey: "",
  azureMapsApiKey: "",
};

export function loadSettings(): SystemSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: SystemSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

