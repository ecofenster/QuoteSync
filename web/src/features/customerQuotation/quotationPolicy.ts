export const ECOFENSTER_CUSTOMER_QUOTATION_VAT_RATE_PERCENT = "20";

export const CUSTOMER_QUOTATION_POLICY = Object.freeze({
  currency: "GBP" as const,
  vatRatePercent: ECOFENSTER_CUSTOMER_QUOTATION_VAT_RATE_PERCENT,
  priceBasis: "ex_vat" as const,
  lifecycleStatus: "preview" as const,
});
