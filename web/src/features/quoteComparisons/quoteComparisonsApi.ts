import { apiFetch } from "../../services/api/apiClient";
import type { AutomaticComparisonBaseline, ComparisonDifferenceStatus, QuoteComparison } from "./quoteComparison.types";

export const quoteComparisonsApi = {
  baseline: (clientId:string,projectId?:string|null) => apiFetch(`/api/quote-comparisons/baseline?client_id=${encodeURIComponent(clientId)}${projectId?`&project_id=${encodeURIComponent(projectId)}`:""}`) as Promise<AutomaticComparisonBaseline>,
  list: (clientId:string) => apiFetch(`/api/quote-comparisons?client_id=${encodeURIComponent(clientId)}`) as Promise<QuoteComparison[]>,
  create: (input:unknown) => apiFetch("/api/quote-comparisons", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<QuoteComparison>,
  update: (comparisonId:string,input:{name?:string;description?:string}) => apiFetch(`/api/quote-comparisons/${encodeURIComponent(comparisonId)}`, {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<QuoteComparison>,
  copy: (comparisonId:string) => apiFetch(`/api/quote-comparisons/${encodeURIComponent(comparisonId)}/copy`, {method:"POST"}) as Promise<QuoteComparison>,
  archive: (comparisonId:string) => apiFetch(`/api/quote-comparisons/${encodeURIComponent(comparisonId)}/archive`, {method:"POST"}) as Promise<QuoteComparison>,
  restore: (comparisonId:string) => apiFetch(`/api/quote-comparisons/${encodeURIComponent(comparisonId)}/restore`, {method:"POST"}) as Promise<QuoteComparison>,
  remove: (comparisonId:string) => apiFetch(`/api/quote-comparisons/${encodeURIComponent(comparisonId)}`, {method:"DELETE"}) as Promise<{id:string;deleted:true}>,
  correctMapping: (comparisonId:string,mappingId:string,input:{canonicalEstimatePositionId:string|null;relationshipKind:string;differenceStatus:ComparisonDifferenceStatus;differences?:unknown[]}) => apiFetch(`/api/quote-comparisons/${encodeURIComponent(comparisonId)}/mappings/${encodeURIComponent(mappingId)}`, {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<QuoteComparison>,
  approve: (comparisonId:string) => apiFetch(`/api/quote-comparisons/${encodeURIComponent(comparisonId)}/approve`, {method:"POST"}) as Promise<QuoteComparison>,
};
