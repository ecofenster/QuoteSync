import { apiFetch } from "../../../services/api/apiClient";
import type { CalculatorPackageCode, CalculatorScenario, ImportSource, ProductClass } from "../domain/projectCalculatorLab.types";
const base="/api/admin/project-calculator-lab";
export const projectCalculatorLabApi={
  listImportSources:()=>apiFetch(`${base}/import-sources`) as Promise<ImportSource[]>,
  listScenarios:()=>apiFetch(`${base}/scenarios`) as Promise<CalculatorScenario[]>,
  getScenario:(id:string)=>apiFetch(`${base}/scenarios/${encodeURIComponent(id)}`) as Promise<CalculatorScenario>,
  createScenario:(input:{name:string;packageCode:CalculatorPackageCode;importLabSessionId:string;extractionRunId:string;sourceAttachmentId:string;installationOpeningCount:number})=>apiFetch(`${base}/scenarios`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<CalculatorScenario>,
  updateScenario:(id:string,input:Partial<Pick<CalculatorScenario,"name"|"packageCode"|"installationOpeningCount">>)=>apiFetch(`${base}/scenarios/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<CalculatorScenario>,
  updateProductClass:(scenarioId:string,rowId:string,productClass:ProductClass)=>apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/products/${encodeURIComponent(rowId)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({productClass})}) as Promise<CalculatorScenario>,
  updatePackageItem:(scenarioId:string,itemId:string,input:{included:boolean;unitCost:string})=>apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/package-items/${encodeURIComponent(itemId)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<CalculatorScenario>,
  addRouteSnapshot:(scenarioId:string,input:Record<string,unknown>)=>apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/route-snapshots`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<CalculatorScenario>,
};
