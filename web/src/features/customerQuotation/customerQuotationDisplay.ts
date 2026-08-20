export type QuotationSectionDetailsMode = "show" | "hide";
export type QuotationThermalMode = "full" | "compact" | "hide";

export type CustomerQuotationDisplayOptions = {
  sectionDetails: QuotationSectionDetailsMode;
  thermalPerformance: QuotationThermalMode;
};

export const DEFAULT_CUSTOMER_QUOTATION_DISPLAY_OPTIONS: CustomerQuotationDisplayOptions = Object.freeze({
  sectionDetails: "show",
  thermalPerformance: "full",
});

export type CustomerQuotationPositionThermal = {
  ufLeft?: string;
  ufTop?: string;
  ufRight?: string;
  ufBottom?: string;
  ug?: string;
  spacerPsi?: string;
  manufacturerQuotedUw?: string;
  calculatedUw?: string;
};

export type CustomerQuotationTechnicalAvailability = {
  thermal: CustomerQuotationPositionThermal | null;
  sectionDetailIds: string[];
};

export type CustomerQuotationTechnicalLayout = {
  showThermal: boolean;
  thermalMode: QuotationThermalMode;
  showSections: boolean;
  layout: "hidden" | "thermal_only" | "sections_only" | "split";
};

const hasThermalValue = (thermal: CustomerQuotationPositionThermal | null) =>
  Boolean(thermal && Object.values(thermal).some((value) => typeof value === "string" && value.trim() !== ""));

export function resolveCustomerQuotationTechnicalLayout(
  options: CustomerQuotationDisplayOptions,
  available: CustomerQuotationTechnicalAvailability,
): CustomerQuotationTechnicalLayout {
  const showThermal = options.thermalPerformance !== "hide" && hasThermalValue(available.thermal);
  const showSections = options.sectionDetails === "show" && available.sectionDetailIds.length > 0;
  return {
    showThermal,
    thermalMode: showThermal ? options.thermalPerformance : "hide",
    showSections,
    layout: showThermal && showSections ? "split" : showThermal ? "thermal_only" : showSections ? "sections_only" : "hidden",
  };
}
