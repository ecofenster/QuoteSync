import { apiFetch } from "../../../services/api/apiClient";
import type { CalculatorAdminConfiguration, CalculatorCatalogueRemoval, CalculatorScenario, ImportSource, InstallationQualificationCheck, InstallationRecommendations, InstallationWorkforce, LiveExchangeRateResult, ProductClass } from "../domain/projectCalculatorLab.types";
import type { ScenarioCreationInput } from "../domain/scenarioCreation";
import { normalizeCalculatorScenario } from "../domain/normalizeCalculatorScenario";
import { createRouteSnapshotSaver } from "../../../../shared/routeSnapshotClient.js";
const base="/api/admin/project-calculator-lab";
const scenarioResponse=(request:Promise<unknown>)=>request.then(value=>normalizeCalculatorScenario(value as CalculatorScenario));
const saveRouteSnapshot=createRouteSnapshotSaver((scenarioId:string,input:Record<string,unknown>)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/route-snapshots`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})));
const supplierCostResponse=async(scenarioId:string,rowId:string,input:Record<string,unknown>)=>{
  const expected=Object.hasOwn(input,"includedInCurrentEstimate")?Boolean(input.includedInCurrentEstimate):null;
  const scenario=await scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/supplier-costs/${encodeURIComponent(rowId)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}));
  if(expected!==null){
    const persisted=scenario.supplierCosts.find(row=>row.id===rowId);
    if(!persisted||persisted.includedInCurrentEstimate!==expected){
      throw new Error("The active QuoteSuite API did not persist the supplier commercial choice. Restart the API to load the current Project Costing contract, then try again.");
    }
  }
  return scenario;
};
const installationProfileResponse=async(scenarioId:string,input:Record<string,unknown>)=>{
  const scenario=await scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/installation-profile`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}));
  if(input.componentInclusions&&typeof input.componentInclusions==="object"){
    const persisted=((scenario.options?.installationProfile as Record<string,unknown>|undefined)?.componentInclusions??{}) as Record<string,unknown>;
    for(const [key,value] of Object.entries(input.componentInclusions as Record<string,unknown>))if(persisted[key]!==value)throw new Error("The active QuoteSuite API did not persist the Installation component choice. Restart the API to load the current Project Costing contract, then try again.");
  }
  return scenario;
};
export const projectCalculatorLabApi={
  listImportSources:(estimateId?:string)=>apiFetch(`${base}/import-sources${estimateId?`?estimate_id=${encodeURIComponent(estimateId)}`:""}`) as Promise<ImportSource[]>,
  getAdminConfiguration:()=>apiFetch(`${base}/admin-configuration`) as Promise<CalculatorAdminConfiguration>,
  createCatalogueItem:(input:Record<string,unknown>)=>apiFetch(`${base}/admin-configuration/catalogue`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<CalculatorAdminConfiguration>,
  updateCatalogueItem:(id:string,input:Record<string,unknown>)=>apiFetch(`${base}/admin-configuration/catalogue/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<CalculatorAdminConfiguration>,
  removeCatalogueItem:(id:string)=>apiFetch(`${base}/admin-configuration/catalogue/${encodeURIComponent(id)}`,{method:"DELETE"}) as Promise<CalculatorCatalogueRemoval>,
  updateRule:(key:string,value:unknown)=>apiFetch(`${base}/admin-configuration/rules/${encodeURIComponent(key)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({value})}) as Promise<CalculatorAdminConfiguration>,
  getInstallationWorkforce:()=>apiFetch(`${base}/installation-workforce`) as Promise<InstallationWorkforce>,
  saveInstallationCompany:(id:string|undefined,input:Record<string,unknown>)=>apiFetch(`${base}/installation-workforce/companies/${encodeURIComponent(id??"new")}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<InstallationWorkforce>,
  saveInstallationInstaller:(id:string|undefined,input:Record<string,unknown>)=>apiFetch(`${base}/installation-workforce/installers/${encodeURIComponent(id??"new")}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<InstallationWorkforce>,
  saveInstallationTeam:(id:string|undefined,input:Record<string,unknown>)=>apiFetch(`${base}/installation-workforce/teams/${encodeURIComponent(id??"new")}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<InstallationWorkforce>,
  saveInstallationQualificationType:(code:string|undefined,input:Record<string,unknown>)=>apiFetch(`${base}/installation-workforce/qualification-types/${encodeURIComponent(code??"new")}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<InstallationWorkforce>,
  saveInstallationQualification:(id:string|undefined,input:Record<string,unknown>)=>apiFetch(`${base}/installation-workforce/qualifications/${encodeURIComponent(id??"new")}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}) as Promise<InstallationWorkforce>,
  uploadInstallationQualificationEvidence:(id:string,file:File)=>{const body=new FormData();body.append("file",file);return apiFetch(`${base}/installation-workforce/qualifications/${encodeURIComponent(id)}/evidence`,{method:"POST",body}) as Promise<{documentId:string;fileName:string;openUrl:string|null;verificationStatus:"recorded_unverified";message:string}>},
  checkInstallationQualifications:(teamId:string,input:{attendanceStart:string;attendanceEnd?:string;requiredTypes?:string[]})=>apiFetch(`${base}/installation-workforce/teams/${encodeURIComponent(teamId)}/qualification-check?${new URLSearchParams({attendance_start:input.attendanceStart,attendance_end:input.attendanceEnd||input.attendanceStart,required_types:(input.requiredTypes||[]).join(",")})}`) as Promise<InstallationQualificationCheck>,
  listScenarios:(estimateId?:string)=>apiFetch(`${base}/scenarios${estimateId?`?estimate_id=${encodeURIComponent(estimateId)}`:""}`) as Promise<CalculatorScenario[]>,
  getScenario:(id:string,estimateId?:string)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(id)}${estimateId?`?estimate_id=${encodeURIComponent(estimateId)}`:""}`)),
  getLiveExchangeRate:(id:string,signal?:AbortSignal)=>apiFetch(`${base}/scenarios/${encodeURIComponent(id)}/exchange-rate/live`,{signal}) as Promise<LiveExchangeRateResult>,
  getInstallationRecommendations:(id:string,routesByTeamId:Record<string,unknown>)=>apiFetch(`${base}/scenarios/${encodeURIComponent(id)}/installation-recommendations`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({routesByTeamId})}) as Promise<InstallationRecommendations>,
  syncEstimatePositions:(id:string)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(id)}/sync-estimate-positions`,{method:"POST"})),
  createScenario:(input:ScenarioCreationInput)=>scenarioResponse(apiFetch(`${base}/scenarios`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
  updateScenario:(id:string,input:Partial<Pick<CalculatorScenario,"name"|"packageCode"|"installationOpeningCount">>)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
  updateVatTreatment:(id:string,input:Record<string,unknown>)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(id)}/vat-treatment`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
  updateProductClass:(scenarioId:string,rowId:string,productClass:ProductClass)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/products/${encodeURIComponent(rowId)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({productClass})})),
  updateProduct:(scenarioId:string,rowId:string,input:Record<string,unknown>)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/products/${encodeURIComponent(rowId)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
  updateSupplierCost:supplierCostResponse,
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
  updateImportCustoms:(scenarioId:string,input:Record<string,unknown>)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/import-customs`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
  useCurrentImportCustomsDefaults:(scenarioId:string)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/import-customs/use-current-defaults`,{method:"POST"})),
  updateInstallationProfile:installationProfileResponse,
  updateInstallationMaterials:(scenarioId:string,input:Record<string,unknown>)=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/installation-materials`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
  useCurrentInstallationCatalogue:(scenarioId:string,input:{useCurrentDefaults?:boolean}={})=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/installation-materials/use-current-catalogue`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
  updatePackageItem:(scenarioId:string,itemId:string,input:{included:boolean;unitCost:string})=>scenarioResponse(apiFetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/package-items/${encodeURIComponent(itemId)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
  addRouteSnapshot:(scenarioId:string,input:Record<string,unknown>)=>saveRouteSnapshot(scenarioId,input) as Promise<CalculatorScenario>,
};
