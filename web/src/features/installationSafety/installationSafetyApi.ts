import {apiFetch} from "../../services/api/apiClient";
export type RamsHazard={hazard:string;applies:boolean|null;controls:string[];notes:string;reviewed:boolean};
export type RamsVersion={id:string;version:number;state:"draft"|"issued"|"superseded";title:string;workSummary:string;siteConditions:{description?:string};hazards:RamsHazard[];methodSteps:string[];emergencyArrangements:string;publicProtection:string;wasteArrangements:string;specialistAssessment:string;supportingDocumentIds:string[];reviewerName:string|null;reviewerRole:string|null;reviewedAt:string|null;competentPersonConfirmed:boolean;issuedAt:string|null;pdfFileName:string|null;downloadUrl:string|null};
export type RamsRecord={id:string;estimateId:string;orderId:string|null;status:"draft"|"review_required"|"issued";context:{estimateReference:string;orderReference:string|null;clientName:string;projectName:string;siteAddress:string;selectedTeamId:string|null;teamName:string|null;attendanceStart:string|null;positions:Array<{id:string;reference:string;quantity:number;product:string;opening:string}>};draft:RamsVersion|null;issued:RamsVersion|null;versions:RamsVersion[];reviewReasons:string[];briefings:Array<{id:string;version:number;personName:string;acknowledgedAt:string;acknowledgement:string}>};
const json=(method:string,body:unknown)=>({method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
export const installationSafetyApi={
  list:(estimateId:string)=>apiFetch(`/api/installation-safety/estimates/${encodeURIComponent(estimateId)}/rams`) as Promise<RamsRecord[]>,
  create:(estimateId:string)=>apiFetch(`/api/installation-safety/estimates/${encodeURIComponent(estimateId)}/rams`,json("POST",{})) as Promise<RamsRecord>,
  save:(id:string,body:unknown)=>apiFetch(`/api/installation-safety/rams/${encodeURIComponent(id)}/draft`,json("PUT",body)) as Promise<RamsRecord>,
  issue:(id:string,body:unknown)=>apiFetch(`/api/installation-safety/rams/${encodeURIComponent(id)}/issue`,json("POST",body)) as Promise<RamsRecord>,
  revise:(id:string)=>apiFetch(`/api/installation-safety/rams/${encodeURIComponent(id)}/revisions`,json("POST",{})) as Promise<RamsRecord>,
  brief:(id:string,body:unknown)=>apiFetch(`/api/installation-safety/rams/${encodeURIComponent(id)}/briefings`,json("POST",body)) as Promise<RamsRecord>,
};
