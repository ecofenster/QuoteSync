export function createSupplierImportDiagnostics(input = {}) {
  const counts = {
    sourcePositions: Number(input.sourcePositions || 0),
    rawBlocks: Number(input.rawBlocks || 0),
    candidatePositionBlocks: Number(input.candidatePositionBlocks ?? input.sourcePositions ?? 0),
    parsedPositions: Number(input.parsedPositions || 0),
    selectedPositions: Number(input.selectedPositions ?? input.parsedPositions ?? 0),
    validCanonicalPositions: Number(input.validCanonicalPositions || 0),
    reviewRequiredPositions: Number(input.reviewRequiredPositions ?? Math.max(Number(input.parsedPositions || 0) - Number(input.validCanonicalPositions || 0), 0)),
    persistedPositions: Number(input.persistedPositions || 0),
    productsSupplyRows: Number(input.productsSupplyRows || 0),
    projectCostingRows: Number(input.projectCostingRows || 0),
    includedRows: Number(input.includedRows || 0),
    alternativeRows: Number(input.alternativeRows || 0),
    excludedRows: Number(input.excludedRows || 0),
    visualEvidence: Number(input.visualEvidence || 0),
    ambiguousVisualEvidence: Number(input.ambiguousVisualEvidence || 0),
  };
  let status = 'quotation_extracted_successfully'; let message = 'Quotation extracted successfully.';
  if (input.textAvailable === false) { status = 'ocr_required'; message = 'No machine-readable text layer — bounded OCR fallback required.'; }
  else if (!counts.parsedPositions) { status = 'no_positions_recognised'; message = 'Document loaded — no positions recognised.'; }
  else if (!counts.validCanonicalPositions) { status = 'position_mapping_incomplete'; message = 'Text extracted — position mapping incomplete.'; }
  else if (input.confirmationAttempted === false && input.canonicalSupplierStatus === 'ambiguous') { status = 'canonical_supplier_review_required'; message = 'Extracted — canonical supplier selection is ambiguous.'; }
  else if (input.confirmationAttempted === false && input.canonicalSupplierStatus !== 'resolved') { status = 'canonical_supplier_required'; message = 'Extracted — supplier confirmation required.'; }
  else if (input.confirmationAttempted === false && counts.reviewRequiredPositions) { status = 'extracted_with_position_review'; message = 'Positions extracted — some require mapping review before Products / Supply.'; }
  else if (input.confirmationAttempted === false) { status = 'ready_to_confirm'; message = 'Extracted — ready to confirm.'; }
  else if (counts.persistedPositions < counts.validCanonicalPositions) { status = 'persistence_incomplete'; message = 'Positions extracted — persistence incomplete.'; }
  else if (counts.productsSupplyRows < counts.persistedPositions) { status = 'products_projection_incomplete'; message = 'Positions persisted — Products / Supply projection incomplete.'; }
  else if (counts.projectCostingRows < counts.productsSupplyRows) { status = 'costing_projection_incomplete'; message = 'Products / Supply populated — Project Costing projection incomplete.'; }
  else if (counts.reviewRequiredPositions) { status = 'extracted_with_position_review'; message = 'Positions extracted — some require mapping review before Products / Supply.'; }
  else if (counts.ambiguousVisualEvidence) { status = 'extracted_with_visual_review'; message = 'Quotation extracted — visual evidence mapping requires review.'; }
  return { status, message, counts };
}
