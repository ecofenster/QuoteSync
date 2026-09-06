import ecofensterBlackLogoUrl from "../Logos/Logo_Black.png";
import ecofensterWhiteLogoUrl from "../Logos/Logo_White.png";
import glassworxLogoUrl from "../assets/brands/glassworx-logo.png";
import quoteSuiteIconBlackUrl from "../assets/brands/quotesuite/quotesuite-icon-circle-black.png";
import quoteSuiteIconWhiteUrl from "../assets/brands/quotesuite/quotesuite-icon-circle-white.png";
import quoteSuiteBlackLogoUrl from "../assets/brands/quotesuite/quotesuite-titlecase-black.png";
import quoteSuiteWhiteLogoUrl from "../assets/brands/quotesuite/quotesuite-titlecase-white.png";
import zyleFensterLogoUrl from "../assets/brands/zyle-fenster-logo.svg";

type Props = { alt?: string; className?: string };

export default function QuoteSyncLogo({ alt = "QuoteSuite", className }: Props) {
  const classes = ["quotesync-logo", className].filter(Boolean).join(" ");
  return <span className={classes} role="img" aria-label={alt} data-testid="brand-lockup">
    <span className="quotesync-logo__platform" data-logo-role="platform" aria-hidden="true">
      <img className="quotesync-logo__asset quotesync-logo__asset--appearance-light quotesync-logo__platform-wordmark" src={quoteSuiteWhiteLogoUrl} alt="" />
      <img className="quotesync-logo__asset quotesync-logo__asset--appearance-dark quotesync-logo__platform-wordmark" src={quoteSuiteBlackLogoUrl} alt="" />
      <img className="quotesync-logo__asset quotesync-logo__asset--appearance-light quotesync-logo__platform-icon" src={quoteSuiteIconWhiteUrl} alt="" />
      <img className="quotesync-logo__asset quotesync-logo__asset--appearance-dark quotesync-logo__platform-icon" src={quoteSuiteIconBlackUrl} alt="" />
    </span>
    <span className="quotesync-logo__divider" aria-hidden="true" />
    <span className="quotesync-logo__company" data-logo-role="company" aria-hidden="true">
      <img className="quotesync-logo__asset quotesync-logo__asset--ecofenster quotesync-logo__asset--appearance-light" src={ecofensterBlackLogoUrl} alt="" />
      <img className="quotesync-logo__asset quotesync-logo__asset--ecofenster quotesync-logo__asset--appearance-dark" src={ecofensterWhiteLogoUrl} alt="" />
      <img className="quotesync-logo__asset quotesync-logo__asset--zyle" src={zyleFensterLogoUrl} alt="" />
      <img className="quotesync-logo__asset quotesync-logo__asset--glassworx" src={glassworxLogoUrl} alt="" />
    </span>
    <span className="quotesync-logo__legacy" aria-hidden="true">
      <img className="quotesync-logo__asset quotesync-logo__asset--appearance-light" src={ecofensterBlackLogoUrl} alt="" />
      <img className="quotesync-logo__asset quotesync-logo__asset--appearance-dark" src={ecofensterWhiteLogoUrl} alt="" />
    </span>
  </span>;
}
