import blackLogoUrl from "../Logos/Logo_Black.png";
import whiteLogoUrl from "../Logos/Logo_White.png";

type Props = {
  alt?: string;
  className?: string;
};

export default function QuoteSyncLogo({ alt = "QuoteSync", className }: Props) {
  const classes = ["quotesync-logo", className].filter(Boolean).join(" ");

  return (
    <span className={classes}>
      <img className="quotesync-logo__image quotesync-logo__image--light" src={blackLogoUrl} alt={alt} />
      <img className="quotesync-logo__image quotesync-logo__image--dark" src={whiteLogoUrl} alt="" aria-hidden="true" />
    </span>
  );
}
