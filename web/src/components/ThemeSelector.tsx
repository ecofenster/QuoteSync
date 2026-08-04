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
  const nextTheme: QuoteSyncThemeId = selectedTheme === "dark" ? "light" : "dark";

  useEffect(() => {
    applyQuoteSyncTheme(selectedTheme);
    saveQuoteSyncTheme(selectedTheme);
  }, [selectedTheme]);

  const classes = ["theme-selector", className].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={classes}
      onClick={() => setSelectedTheme(nextTheme)}
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={selectedTheme === "dark"}
    >
      <span className="theme-selector__label">Theme</span>
      <span className="theme-selector__toggle">{selectedTheme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}
