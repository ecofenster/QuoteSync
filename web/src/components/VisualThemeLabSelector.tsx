import { useEffect, useRef, useState } from "react";
import {
  QUOTESUITE_V2_BRANDS,
  QUOTESUITE_VISUAL_THEMES,
  applyQuoteSuiteVisualTheme,
  getQuoteSuiteVisualTheme,
  isQuoteSuiteVisualThemeId,
  quoteSuiteV2ThemeIdFor,
  readStoredQuoteSuiteVisualTheme,
  type QuoteSuiteVisualThemeId,
} from "../theme/visualDesignV2";

type Props = { className?: string };

export default function VisualThemeLabSelector({ className }: Props) {
  const [selected, setSelected] = useState<QuoteSuiteVisualThemeId>(readStoredQuoteSuiteVisualTheme);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const sync = (event: Event) => {
      const id = (event as CustomEvent<{ id?: unknown }>).detail?.id;
      if (isQuoteSuiteVisualThemeId(id)) setSelected(id);
    };
    window.addEventListener("quotesync-visual-theme-change", sync);
    return () => window.removeEventListener("quotesync-visual-theme-change", sync);
  }, []);
  const current = getQuoteSuiteVisualTheme(selected);
  const classes = ["visual-theme-lab", className].filter(Boolean).join(" ");
  const selectTheme = (id: QuoteSuiteVisualThemeId) => {
    applyQuoteSuiteVisualTheme(id);
    setSelected(id);
    detailsRef.current?.removeAttribute("open");
  };
  return (
    <details ref={detailsRef} className={classes} data-testid="visual-theme-lab">
      <summary className="visual-theme-lab__summary ui-button" aria-label={`Brand profile. ${current.name} selected`}>
        <span>Brand</span>
        <em>{current.design === "v2" ? QUOTESUITE_V2_BRANDS.find((brand) => brand.id === current.brand)?.name : "Legacy"}</em>
      </summary>
      <div className="visual-theme-lab__panel ui-card ui-card--elevated">
        <header><strong>Brand profile</strong><small>Shared QuoteSuite V2 design · appearance selected separately</small></header>
        <fieldset>
          <legend>Approved V2 brands</legend>
          {QUOTESUITE_V2_BRANDS.map((brand) => {
            const themeId = quoteSuiteV2ThemeIdFor(brand.id, current.appearance);
            const isSelected = current.design === "v2" && current.brand === brand.id;
            return <button key={brand.id} type="button" className="visual-theme-lab__option" aria-pressed={isSelected} data-theme-id={themeId} data-brand-id={brand.id} onClick={() => selectTheme(themeId)}>
              <span className="visual-theme-lab__swatch" data-brand={brand.id} data-appearance={current.appearance} aria-hidden="true" />
              <span><strong>{brand.name}</strong><small>V2 {current.appearance === "dark" ? "Night" : "Day"}</small></span>
              {isSelected ? <span aria-label="Selected">✓</span> : null}
            </button>;
          })}
        </fieldset>
        <fieldset>
          <legend>Transition fallback</legend>
          {QUOTESUITE_VISUAL_THEMES.filter((theme) => theme.design === "legacy").map((theme) => <button key={theme.id} type="button" className="visual-theme-lab__option" aria-pressed={selected === theme.id} data-theme-id={theme.id} onClick={() => selectTheme(theme.id)}>
            <span className="visual-theme-lab__swatch visual-theme-lab__swatch--legacy" data-appearance={theme.appearance} aria-hidden="true" />
            <span><strong>{theme.name}</strong><small>Preserved during V2 rollout</small></span>
            {selected === theme.id ? <span aria-label="Selected">✓</span> : null}
          </button>)}
        </fieldset>
      </div>
    </details>
  );
}
