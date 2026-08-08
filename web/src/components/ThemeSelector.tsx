import { useEffect, useState } from "react";
import {
  applyQuoteSyncTheme,
  readStoredQuoteSyncTheme,
  saveQuoteSyncTheme,
  type QuoteSyncThemeId,
} from "../theme/themes";

type Props = {
  className?: string;
};

export default function ThemeSelector({ className }: Props) {
  const [selectedTheme, setSelectedTheme] = useState<QuoteSyncThemeId>(() => readStoredQuoteSyncTheme());
  const themeOrder: QuoteSyncThemeId[] = ["light", "dark", "system"];
  const nextTheme = themeOrder[(themeOrder.indexOf(selectedTheme) + 1) % themeOrder.length];

  useEffect(() => {
    const syncTheme = (event: Event) => {
      const requestedMode = (event as CustomEvent<{ requestedMode?: QuoteSyncThemeId }>).detail?.requestedMode;
      if (requestedMode && requestedMode !== selectedTheme) setSelectedTheme(requestedMode);
    };
    window.addEventListener("quotesync-theme-change", syncTheme);
    return () => window.removeEventListener("quotesync-theme-change", syncTheme);
  }, [selectedTheme]);

  const classes = ["theme-selector", className].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={classes}
      onClick={() => {
        saveQuoteSyncTheme(nextTheme);
        setSelectedTheme(nextTheme);
        applyQuoteSyncTheme(nextTheme);
      }}
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={selectedTheme === "dark"}
    >
      <span className="theme-selector__label">Theme</span>
      <span className="theme-selector__toggle">{selectedTheme[0].toUpperCase() + selectedTheme.slice(1)}</span>
    </button>
  );
}
