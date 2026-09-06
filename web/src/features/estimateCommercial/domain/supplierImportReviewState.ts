import type { ManufacturerImportReview } from "../../supplierQuotes/domain/manufacturerImportReview";

export function updateDocumentSelection(current: ReadonlySet<string>, itemId: string, checked: boolean) {
  const next = new Set(current);
  if (checked) next.add(itemId);
  else next.delete(itemId);
  return next;
}

export function deriveSupplierImportReviewState(
  review: ManufacturerImportReview,
  commercialSupplierCode: string,
  manufacturerId: string,
) {
  const rows = review.documents.flatMap((document) => document.rows);
  const commercialSupplier = review.commercialSuppliers.find((item) => item.supplierCode === commercialSupplierCode) ?? null;
  const canonicalManufacturer = review.canonicalManufacturers.find((item) => item.manufacturerId === manufacturerId) ?? null;
  const legacyDirect = ["legacy_direct_supplier_compatibility", "document_supported_direct_identity"].includes(review.metadata.manufacturerResolutionMethod ?? "");
  const pricingPolicyAvailable = commercialSupplier?.pricingPolicyAvailable !== false;
  const finalImportBlocked = !commercialSupplier || !pricingPolicyAvailable || (!canonicalManufacturer && !legacyDirect);
  return {
    rows,
    commercialSupplier,
    canonicalManufacturer,
    legacyDirect,
    pricingPolicyAvailable,
    finalImportBlocked,
    confirmationBlocked: finalImportBlocked,
    sameSupplierAndManufacturer: Boolean(commercialSupplier?.supplierName && review.metadata.recognizedManufacturerName && commercialSupplier.supplierName.localeCompare(
      review.metadata.recognizedManufacturerName,
      undefined,
      { sensitivity: "base" },
    ) === 0),
  };
}
