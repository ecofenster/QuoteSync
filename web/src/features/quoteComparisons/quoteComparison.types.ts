export type ComparisonDifferenceStatus =
  | "exact_match" | "close_acceptable_alternative" | "minor_difference" | "material_mismatch"
  | "dimension_mismatch" | "quantity_mismatch" | "configuration_mismatch" | "product_system_substitution"
  | "missing" | "additional" | "alternative" | "unmapped" | "information_not_supplied"
  | "review_required" | "not_applicable";

export type ComparisonPositionMapping = {
  id:string;proposalId:string;supplierItemReference:string;supplierItemSnapshot:Record<string,unknown>;
  canonicalEstimatePositionId:string|null;relationshipKind:"exact"|"grouped"|"split"|"missing"|"additional"|"alternative"|"unmapped";
  differenceStatus:ComparisonDifferenceStatus;differences:Array<{field?:string;baseline?:unknown;supplier?:unknown;note?:string}>;
  provenance:Record<string,unknown>;correctedBy:string|null;correctedAt:string|null;
};

export type ComparisonProposal = {
  id:string;supplierId:string|null;supplierName:string;manufacturerName:string|null;quotationNumber:string|null;
  quotationRevision:string|null;quotationDate:string|null;scopeKind:"supply_only"|"supply_and_install"|"supply_install_support"|"unresolved";
  currency:string|null;originalTotalAmount:string|null;comparableScopeAmount:string|null;normalizedProjectAmount:string|null;
  status:"review_required"|"reviewed"|"excluded";provenance:Record<string,unknown>;
  documents:Array<{canonicalDocumentId:string|null;supplierAttachmentId?:string;sourceKind?:"supplier_quote_attachment";supplierQuoteId?:string;supplierRevisionId?:string;documentRole:string;fileName:string;documentType?:string;mimeType?:string;openUrl?:string|null}>;
  positionMappings:ComparisonPositionMapping[];
};

export type CustomerCommercialSource =
  | {kind:"issued_customer_quotation";issuedQuotationId:string;documentId:string;fileName:string;quotationRevision:number;commercialSnapshot:{subtotalExVatGbp?:string;vatGbp?:string;totalIncVatGbp?:string};capturedAt:string}
  | {kind:"current_project_costing";scenarioId:string;scenarioRevision:number;capturedAt:string};
type TechnicalSourceEvidence = {attachmentId:string;fileName:string;supplierName:string;revisionId:string;quotationNumber?:string|null;quotationRevision?:string|null;quotationDate?:string|null};
export type AutomaticComparisonBaseline = {status:"canonical_baseline_detected"|"baseline_upload_required";clientId:string;projectId:string|null;baseline:null|{estimateId:string;estimateRef:string;baseEstimateRef:string;revisionNo:number;status:string;outcome:string;positionCount:number;positions:Array<Record<string,unknown>>;customerCommercialSources:CustomerCommercialSource[];technicalSourceEvidence:TechnicalSourceEvidence[];preferredCustomerCommercialSource:"issued_customer_quotation"|"current_project_costing"|"customer_baseline_required"}};

export type QuoteComparison = {
  id:string;clientId:string;projectId:string|null;projectName:string|null;baselineEstimateId:string;baselineEstimateRevision:number;
  name:string|null;description:string|null;archivedAt:string|null;archivedBy:string|null;
  baselineSnapshot:{estimateId:string;estimateRef:string;baseEstimateRef:string;revisionNo:number;status:string;capturedAt:string;customerCommercial?:Record<string,unknown>;technicalEvidenceRole?:string;technicalSourceEvidence?:TechnicalSourceEvidence[];positions:Array<{id:string;positionRef?:string;roomName?:string;qty?:number;widthMm?:number;heightMm?:number}>};
  status:"draft_review_required"|"approved"|"superseded";recordRevision:number;createdBy:string;approvedBy:string|null;approvedAt:string|null;updatedAt:string;
  proposals:ComparisonProposal[];
};

export const comparisonStatusLabels:Record<ComparisonDifferenceStatus,string> = {
  exact_match:"Exact match", close_acceptable_alternative:"Close / acceptable alternative", minor_difference:"Minor difference",
  material_mismatch:"Material mismatch", dimension_mismatch:"Dimension mismatch", quantity_mismatch:"Quantity mismatch",
  configuration_mismatch:"Configuration mismatch", product_system_substitution:"Product-system substitution", missing:"Missing",
  additional:"Additional", alternative:"Alternative", unmapped:"Unmapped", information_not_supplied:"Information not supplied",
  review_required:"Review required", not_applicable:"Not applicable",
};
