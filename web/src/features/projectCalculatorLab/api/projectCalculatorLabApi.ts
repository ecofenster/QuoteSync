import { apiFetch } from "../../../services/api/apiClient";
import type { CalculatorAdminConfiguration, CalculatorScenario, ImportSource, ProductClass } from "../domain/projectCalculatorLab.types";
import type { ScenarioCreationInput } from "../domain/scenarioCreation";
const base="/api/admin/project-calculator-lab";
export const projectCalculatorLabApi={
  listImportSources:(estimateId?:string)=>apiFetch(`${base}/import-sources${estimateId?`?estimate_id=${encodeURIComponent(estimateId)}`:""}`) as Promise<ImportSource[]>,
  getAdminConfiguration:()=>apiFetch(`${base}/admin-configuration`) as Promise<CalculatorAdminConfiguration>,
  updateCatalogueItem:(id:string,input:Record<string,unknown>)=>apiFetch(`${base}/admin-configuration/catalogue/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<CalculatorAdminConfiguration>,
  listScenarios:(estimateId?:string)=>apiFetch(`${base}/scenarios${estimateId?`?estimate_id=${encodeURIComponent(estimateId)}`:""}`) as Promise<CalculatorScenario[]>,
  getScenario:(id:string,estimateId?:string)=>apiFetch(`${base}/scenarios/${encodeURIComponent(id)}${estimateId?`?estimate_id=${encodeURIComponent(estimateId)}`:""}`) as Promise<CalculatorScenario>,
  createScenario:(input:ScenarioCreationInput)=>apiFetch(`${base}/scenarios`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<CalculatorScenario>,
  updateScenario:(id:string,input:Partial<Pick<CalculatorScenario,"name"|"packageCode"|"installationOpeningCount">>)=>apiFetch(`${base}/scenarios/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<CalculatorScenario>,
  updateProductClass:(scenarioId:string,rowId:string,productClass:ProductClass)=>apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/products/${encodeURIComponent(rowId)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({productClass})}) as Promise<CalculatorScenario>,
  updateProduct:(scenarioId:string,rowId:string,input:Record<string,unknown>)=>apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/products/${encodeURIComponent(rowId)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<CalculatorScenario>,
  addManualProduct:(scenarioId:string,input:Record<string,unknown>)=>apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/manual-products`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<CalculatorScenario>,
  addManualCost:(scenarioId:string,input:Record<string,unknown>)=>apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/manual-costs`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<CalculatorScenario>,
  refreshExchangeRate:(scenarioId:string)=>apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/exchange-rate/refresh`,{method:"POST"}) as Promise<CalculatorScenario>,
  updateExchangeRate:(scenarioId:string,input:{adjustmentEnabled:boolean;adjustedRate?:string;overrideReason?:string})=>apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/exchange-rate`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<CalculatorScenario>,
  updateMarkups:(scenarioId:string,input:CalculatorScenario["markups"]&{productOverrides?:Array<{rowId:string;markupOverridePercent:string|null}>})=>apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/markups`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<CalculatorScenario>,
  createRevision:(scenarioId:string)=>apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/revisions`,{method:"POST"}) as Promise<CalculatorScenario>,
  updateOptions:(scenarioId:string,input:Record<string,unknown>)=>apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/options`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<CalculatorScenario>,
  updatePackageItem:(scenarioId:string,itemId:string,input:{included:boolean;unitCost:string})=>apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/package-items/${encodeURIComponent(itemId)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<CalculatorScenario>,
  addRouteSnapshot:(scenarioId:string,input:Record<string,unknown>)=>apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/route-snapshots`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<CalculatorScenario>,
};
