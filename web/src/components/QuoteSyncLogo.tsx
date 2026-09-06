import { useEffect, useState } from "react";
import ecofensterBlackLogoUrl from "../Logos/Logo_Black.png";
import ecofensterWhiteLogoUrl from "../Logos/Logo_White.png";
import glassworxLogoUrl from "../assets/brands/glassworx-logo.png";
import quoteSuiteIconUrl from "../assets/brands/quotesuite/quotesuite-icon-circle-transparent.png";
import quoteSuiteDarkLogoUrl from "../assets/brands/quotesuite/quotesuite-titlecase-dark-transparent.png";
import quoteSuiteLightLogoUrl from "../assets/brands/quotesuite/quotesuite-titlecase-light-transparent.png";
import zyleFensterLogoUrl from "../assets/brands/zyle-fenster-logo.svg";
import {
  getQuoteSuiteVisualTheme,
  isQuoteSuiteVisualThemeId,
  readStoredQuoteSuiteVisualTheme,
  type QuoteSuiteBrandId,
  type QuoteSuiteVisualThemeId,
} from "../theme/visualDesignV2";

type Props = { alt?: string; className?: string };

const companyLogos: Partial<Record<QuoteSuiteBrandId, { name: string; source: string; darkSource?: string }>> = {
  ecofenster: { name: "Ecofenster", source: ecofensterBlackLogoUrl, darkSource: ecofensterWhiteLogoUrl },
  "zyle-fenster": { name: "Zyle Fenster", source: zyleFensterLogoUrl },
  glassworx: { name: "GlassWorx", source: glassworxLogoUrl },
};

export default function QuoteSyncLogo({ alt = "QuoteSuite", className }: Props) {
  const [themeId, setThemeId] = useState<QuoteSuiteVisualThemeId>(readStoredQuoteSuiteVisualTheme);
  useEffect(() => {
    const synchronize = (event: Event) => {
      const nextId = (event as CustomEvent<{ id?: unknown }>).detail?.id;
      if (isQuoteSuiteVisualThemeId(nextId)) setThemeId(nextId);
    };
    window.addEventListener("quotesync-visual-theme-change", synchronize);
    return () => window.removeEventListener("quotesync-visual-theme-change", synchronize);
  }, []);

  const theme = getQuoteSuiteVisualTheme(themeId);
  const classes = ["quotesync-logo", className].filter(Boolean).join(" ");
  if (theme.design === "legacy") {
    return <span className={`${classes} quotesync-logo--legacy`} role="img" aria-label={alt} data-testid="brand-lockup">
      <img className="quotesync-logo__asset quotesync-logo__legacy" src={theme.appearance === "dark" ? ecofensterWhiteLogoUrl : ecofensterBlackLogoUrl} alt="" />
    </span>;
  }

  const company = companyLogos[theme.brand];
  const companySource = theme.appearance === "dark" && company?.darkSource ? company.darkSource : company?.source;
  const platformSource = theme.appearance === "dark" ? quoteSuiteDarkLogoUrl : quoteSuiteLightLogoUrl;
  return <span className={classes} role="img" aria-label={company ? `QuoteSuite and ${company.name}` : "QuoteSuite"} data-testid="brand-lockup" data-lockup-brand={theme.brand}>
    <span className="quotesync-logo__platform" data-logo-role="platform" aria-hidden="true">
      <picture>
        <source media="(max-width: 520px)" srcSet={quoteSuiteIconUrl} />
        <img className="quotesync-logo__asset quotesync-logo__platform-asset" src={platformSource} alt="" data-logo-appearance={theme.appearance} />
      </picture>
    </span>
    {company && companySource ? <>
      <span className="quotesync-logo__divider" aria-hidden="true" />
      <span className="quotesync-logo__company" data-logo-role="company" data-company-brand={theme.brand} aria-hidden="true">
        <img className={`quotesync-logo__asset quotesync-logo__company-asset quotesync-logo__company-asset--${theme.brand}`} src={companySource} alt="" />
      </span>
    </> : null}
  </span>;
}
