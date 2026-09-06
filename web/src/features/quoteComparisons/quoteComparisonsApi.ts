import { apiFetch } from "../../services/api/apiClient";
import type { ComparisonDifferenceStatus, QuoteComparison } from "./quoteComparison.types";

export const quoteComparisonsApi = {
  list: (clientId:string) => apiFetch(`/api/quote-comparisons?client_id=${encodeURIComponent(clientId)}`) as Promise<QuoteComparison[]>,
  create: (input:unknown) => apiFetch("/api/quote-comparisons", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<QuoteComparison>,
  correctMapping: (comparisonId:string,mappingId:string,input:{canonicalEstimatePositionId:string|null;relationshipKind:string;differenceStatus:ComparisonDifferenceStatus;differences?:unknown[]}) => apiFetch(`/api/quote-comparisons/${encodeURIComponent(comparisonId)}/mappings/${encodeURIComponent(mappingId)}`, {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<QuoteComparison>,
  approve: (comparisonId:string) => apiFetch(`/api/quote-comparisons/${encodeURIComponent(comparisonId)}/approve`, {method:"POST"}) as Promise<QuoteComparison>,
};
