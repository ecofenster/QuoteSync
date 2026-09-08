export const QUOTE_COMPARISON_EVIDENCE_DISCLAIMER: string;

export type ComparisonThermalMetric = {raw:string|null;value:number|null;precision:number|null;basis:string|null;standard:string|null;status:string};
export type ComparisonCommercialBreakdown = {currency:string|null;grossSupply:number|null;discountPercentage:number|null;discountAmount:number|null;netSupply:number|null;extras:number|null;delivery:number|null;installation:number|null;survey:number|null;vat:number|null;vatStatus:string;headlineTotal:number|null;scopeKind:string;normalizationStatus:string;normalizationReason:string;scopeEvidence:Record<string,unknown>;sourceReconciliation:Record<string,unknown>};
export type ComparisonClarification = {category:string;message:string;positionReferences:string[];severity:string};

export type QuoteComparisonReportOffer = {
  offerKey:string;proposalId:string;supplierName:string;manufacturerName:string|null;reference:string;relationship:string;
  assessment:{label:string;tone:"positive"|"warning"|"danger"|"neutral"};assessmentCode:string;explanation:string;
  attributes:{measurements:string;internalFinish:string;externalFinish:string;productSystem:string;productFamily:string;material:string;aluminiumCladding:string;glass:string;ug:string;g:string;lt:string;uw:string;hardware:string;configuration:string;division:string;interfaces:string;thermalEvidence:{ug:ComparisonThermalMetric;uw:ComparisonThermalMetric;g:ComparisonThermalMetric;lt:ComparisonThermalMetric};security:{status:string;label:string;standards:string[];certification:string|null}};
  compliance:{status:string;label:string;compromises:string[];materialFailures:string[];reviewItems:string[]};commercial:{basis:string;grossItemCost:number|null;grossQuantityCost:number|null;discountPercentage:number|null;discountAmount:number|null;netItemCost:number|null;netQuantityCost:number|null;sourcePricesPreserved:boolean;comparabilityStatus:string;comparabilityReason:string};
  quantity:number|null;itemCost:number|null;quantityCost:number|null;currency:string|null;scopeKind:string;isAlternative:boolean;evidenceCompleteness:number;mappingIds:string[];isBaselineReference?:boolean;positionReference:string;
};
export type QuoteComparisonReport = {
  version:string;generatedFromRecordRevision:number;disclaimer:string;commonScope:string|null;
  positions:Array<{id:string;reference:string;roomName:string;quantity:number;measurements:string;configuration:string;widthMm:number|null;heightMm:number|null;offers:QuoteComparisonReportOffer[];report:string;findings:{bestUw:{supplierName:string;value:string;evidence:ComparisonThermalMetric}|null;bestUg:{supplierName:string;value:string;evidence:ComparisonThermalMetric}|null;bestG:{supplierName:string;value:string;evidence:ComparisonThermalMetric}|null;bestLt:{supplierName:string;value:string;evidence:ComparisonThermalMetric}|null;lowestComparablePrice:{supplierName:string;value:number;currency:string|null}|null};recommendations:Array<{rank:number;supplierName:string;label:string;reason:string}>;recommendationStatus:"ready"|"review_required";recommendationMessage:string|null}>;
  suppliers:Array<{proposalId:string;supplierName:string;manufacturerName:string|null;currency:string|null;scopeKind:string;total:number|null;commercial:ComparisonCommercialBreakdown;matched:number;correct:number;acceptable:number;materialMismatch:number;missing:number;unresolved:number;completeness:number;clarifications:ComparisonClarification[];isBaselineReference?:boolean}>;
  recommendations:Array<{rank:number;supplierName:string;label:string;reason:string}>;
  recommendationStatus:"ready"|"review_required";recommendationMessage:string|null;
  clarifications:Array<{proposalId:string;supplierName:string;items:ComparisonClarification[]}>;
};
export function buildQuoteComparisonReport(comparison:unknown):QuoteComparisonReport;
