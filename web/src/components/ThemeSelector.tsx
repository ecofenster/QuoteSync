import { useEffect, useState } from "react";
import {
  applyQuoteSuiteVisualTheme,
  getQuoteSuiteVisualTheme,
  isQuoteSuiteVisualThemeId,
  quoteSuiteV2ThemeIdFor,
  readStoredQuoteSuiteVisualTheme,
  type QuoteSuiteVisualThemeId,
} from "../theme/visualDesignV2";

type Props = { className?: string };

export default function ThemeSelector({ className }: Props) {
  const [selectedTheme, setSelectedTheme] = useState<QuoteSuiteVisualThemeId>(readStoredQuoteSuiteVisualTheme);
  const current = getQuoteSuiteVisualTheme(selectedTheme);
  const nextAppearance = current.appearance === "dark" ? "light" : "dark";
  useEffect(() => {
    const sync = (event: Event) => {
      const id = (event as CustomEvent<{ id?: unknown }>).detail?.id;
      if (isQuoteSuiteVisualThemeId(id)) setSelectedTheme(id);
    };
    window.addEventListener("quotesync-visual-theme-change", sync);
    return () => window.removeEventListener("quotesync-visual-theme-change", sync);
  }, []);
  const classes = ["theme-selector", className].filter(Boolean).join(" ");
  return <button type="button" className={classes} onClick={() => {
    const nextId = current.design === "v2" ? quoteSuiteV2ThemeIdFor(current.brand, nextAppearance) : nextAppearance === "dark" ? "current-dark" : "current-light";
    applyQuoteSuiteVisualTheme(nextId);
    setSelectedTheme(nextId);
  }} aria-label={`Switch to ${nextAppearance === "dark" ? "Dark / Night" : "Light / Day"} appearance`} aria-pressed={current.appearance === "dark"}>
    <span className="theme-selector__label">Appearance</span>
    <span className="theme-selector__toggle">{current.appearance === "dark" ? "Dark / Night" : "Light / Day"}</span>
  </button>;
}
