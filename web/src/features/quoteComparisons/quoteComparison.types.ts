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
  documents:Array<{canonicalDocumentId:string;documentRole:string;fileName:string;documentType:string;openUrl?:string|null}>;
  positionMappings:ComparisonPositionMapping[];
};

export type QuoteComparison = {
  id:string;clientId:string;projectId:string|null;baselineEstimateId:string;baselineEstimateRevision:number;
  baselineSnapshot:{estimateId:string;estimateRef:string;baseEstimateRef:string;revisionNo:number;status:string;capturedAt:string;positions:Array<{id:string;positionRef?:string;roomName?:string;qty?:number;widthMm?:number;heightMm?:number}>};
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
