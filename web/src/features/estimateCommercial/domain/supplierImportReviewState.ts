import type { ManufacturerImportReview } from "../../supplierQuotes/domain/manufacturerImportReview";

export function updateDocumentSelection(current: ReadonlySet<string>, itemId: string, checked: boolean) {
  const next = new Set(current);
  if (checked) next.add(itemId);
  else next.delete(itemId);
  return next;
}

export function deriveSupplierImportReviewState(
  review: ManufacturerImportReview,
  supplierCode: string,
  manufacturerId: string,
) {
  const rows = review.documents.flatMap((document) => document.rows);
  const commercialSupplier = review.commercialSuppliers.find((item) => item.supplierCode === supplierCode) ?? null;
  const canonicalManufacturer = review.canonicalManufacturers.find((item) => item.manufacturerId === manufacturerId) ?? null;
  const legacyDirect = review.metadata.manufacturerResolutionMethod === "legacy_direct_supplier_compatibility";
  const pricingPolicyAvailable = commercialSupplier?.pricingPolicyAvailable !== false;
  return {
    rows,
    commercialSupplier,
    canonicalManufacturer,
    legacyDirect,
    pricingPolicyAvailable,
    confirmationBlocked: !commercialSupplier || !pricingPolicyAvailable || (!canonicalManufacturer && !legacyDirect),
    sameSupplierAndManufacturer: review.metadata.recognizedDealerName.localeCompare(
      review.metadata.recognizedManufacturerName,
      undefined,
      { sensitivity: "base" },
    ) === 0,
  };
}
