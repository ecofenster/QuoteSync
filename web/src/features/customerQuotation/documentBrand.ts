const ecofensterLogoDark = new URL("../../Logos/Logo_Black.png", import.meta.url).href;
const ecofensterLogoLight = new URL("../../Logos/Logo_White.png", import.meta.url).href;

export type CustomerDocumentBrand = {
  companyName: string;
  tradingName: string;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  primaryColour: string;
  accentColour: string;
  address: string;
  telephone: string;
  email: string;
  website: string;
  legalInformation: string;
};

export const ECOFENSTER_DEVELOPMENT_DOCUMENT_BRAND: CustomerDocumentBrand = Object.freeze({
  companyName: "Ecofenster Ltd",
  tradingName: "Ecofenster",
  logoLightUrl: ecofensterLogoDark,
  logoDarkUrl: ecofensterLogoLight,
  // Customer documents own a fixed print palette and never inherit the
  // operator's current application appearance.
  primaryColour: "#2F6F2F",
  accentColour: "#77B84A",
  address: "",
  telephone: "",
  email: "",
  website: "",
  legalInformation: "",
});
