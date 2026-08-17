import { apiFetch } from "../../../services/api/apiClient";
import type { CalculatorAdminConfiguration, CalculatorScenario, ImportSource, ProductClass } from "../domain/projectCalculatorLab.types";
import type { ScenarioCreationInput } from "../domain/scenarioCreation";
import { normalizeCalculatorScenario } from "../domain/normalizeCalculatorScenario";
const base="/api/admin/project-calculator-lab";
const scenarioResponse=(request:Promise<unknown>)=>request.then(value=>normalizeCalculatorScenario(value as CalculatorScenario));
export const projectCalculatorLabApi={
  listImportSources:(estimateId?:string)=>apiFetch(`${base}/import-sources${estimateId?`?estimate_id=${encodeURIComponent(estimateId)}`:""}`) as Promise<ImportSource[]>,
  getAdminConfiguration:()=>apiFetch(`${base}/admin-configuration`) as Promise<CalculatorAdminConfiguration>,
  updateCatalogueItem:(id:string,input:Record<string,unknown>)=>apiFetch(`${base}/admin-configuration/catalogue/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<CalculatorAdminConfiguration>,
  listScenarios:(estimateId?:string)=>apiFetch(`${base}/scenarios${estimateId?`?estimate_id=${encodeURIComponent(estimateId)}`:""}`) as Promise<CalculatorScenario[]>,
  getScenario:(id:string,estimateId?:string)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(id)}${estimateId?`?estimate_id=${encodeURIComponent(estimateId)}`:""}`)),
  syncEstimatePositions:(id:string)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(id)}/sync-estimate-positions`,{method:"POST"})),
  createScenario:(input:ScenarioCreationInput)=>scenarioResponse(apiFetch(`${base}/scenarios`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
  updateScenario:(id:string,input:Partial<Pick<CalculatorScenario,"name"|"packageCode"|"installationOpeningCount">>)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
  updateProductClass:(scenarioId:string,rowId:string,productClass:ProductClass)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/products/${encodeURIComponent(rowId)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({productClass})})),
  updateProduct:(scenarioId:string,rowId:string,input:Record<string,unknown>)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/products/${encodeURIComponent(rowId)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
  updateSupplierCost:(scenarioId:string,rowId:string,input:Record<string,unknown>)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/supplier-costs/${encodeURIComponent(rowId)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
  updateManualCost:(scenarioId:string,rowId:string,input:Record<string,unknown>)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/manual-costs/${encodeURIComponent(rowId)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
  updateSupplierCommercialPolicy:(scenarioId:string,revisionId:string,input:Record<string,unknown>)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/supplier-commercial/${encodeURIComponent(revisionId)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
  updateCustomerPricing:(scenarioId:string,input:Record<string,unknown>)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/customer-pricing`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
  addManualProduct:(scenarioId:string,input:Record<string,unknown>)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/manual-products`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
  addManualCost:(scenarioId:string,input:Record<string,unknown>)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/manual-costs`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
  refreshExchangeRate:(scenarioId:string)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/exchange-rate/refresh`,{method:"POST"})),
  updateExchangeRate:(scenarioId:string,input:{adjustmentEnabled:boolean;adjustedRate?:string;overrideReason?:string})=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/exchange-rate`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
  updateMarkups:(scenarioId:string,input:CalculatorScenario["markups"]&{productOverrides?:Array<{rowId:string;markupOverridePercent:string|null}>;targetGrossMarginPercent?:string})=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/markups`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
  createRevision:(scenarioId:string)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/revisions`,{method:"POST"})),
  updateOptions:(scenarioId:string,input:Record<string,unknown>)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/options`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
  updatePackageItem:(scenarioId:string,itemId:string,input:{included:boolean;unitCost:string})=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/package-items/${encodeURIComponent(itemId)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
  addRouteSnapshot:(scenarioId:string,input:Record<string,unknown>)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/route-snapshots`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
};
