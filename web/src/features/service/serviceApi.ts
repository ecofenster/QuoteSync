import { apiFetch } from "../../services/api/apiClient";

export type ServiceTimer = { id:string;cycle:number;targetKey:"first_response"|"customer_update"|"assessment_plan"|"resolution";targetMinutes:number;startedAt:string;dueAt:string;pausedAt:string|null;accumulatedPauseMinutes:number;completedAt:string|null;state:"running"|"paused"|"completed"|"breached" };
export type ServiceEvent = { id:string;eventType:string;visibility:"customer"|"internal";body:string;metadata:Record<string,unknown>;actorType:"staff"|"customer"|"system";actorId:string;occurredAt:string };
export type ServiceAttachment = { id:string;eventId:string|null;visibility:"customer"|"internal";fileName:string;mediaType:string;sizeBytes:number;sha256:string;uploadedByType:"staff"|"customer";uploadedById:string;createdAt:string;downloadUrl:string };
export type ServiceCase = {
  id:string;reference:string;clientId:string;clientReference:string|null;clientName:string|null;projectId:string|null;projectName:string|null;orderId:string|null;orderReference:string|null;positionIds:string[];caseType:string;issueSummary:string;description:string;reportedAt:string;firstNoticedAt:string|null;
  status:"new"|"under_review"|"awaiting"|"resolved"|"closed";priority:"low"|"normal"|"high"|"urgent";waitingOn:"none"|"customer"|"supplier"|"internal";teamId:string|null;teamName:string|null;assigneeId:string|null;assigneeName:string|null;nextAction:string;nextActionDueAt:string|null;
  warrantyState:"not_assessed"|"potentially_covered"|"evidence_required"|"outside_supplier_terms"|"staff_confirmed";warrantyAssessment:Record<string,unknown>;resolution:string;policy:null|{id:string;version:number;name:string;publicationState:string;timezone:string;targets:Record<string,number>};customerExpectation:string|null;timers:ServiceTimer[];events:ServiceEvent[];attachments:ServiceAttachment[];createdAt:string;updatedAt:string;
};
export type ResponsibilityConfiguration = {areas:string[];teams:Array<{id:string;name:string;active:boolean;members:Array<{userId:string;userName:string;active:boolean}>}>;rules:Array<{id:string;responsibilityArea:string;caseType:string;teamId:string;teamName:string;defaultAssigneeId:string|null;defaultAssigneeName:string|null;valid:boolean}>;unassigned:Array<{recordKind:string;recordId:string;responsibilityArea:string;updatedAt:string}>;currentUser:{id:string;name:string;role:string}};
export type ServicePolicy = {id:string;version:number;name:string;publicationState:"proposal"|"active_internal"|"approved_customer";priority:string;caseType:string;teamId:string;timezone:string;businessHours:Record<string,Array<[string,string]>>;holidays:string[];targets:Record<string,number>;pauseRules:Record<string,string[]>;escalationTeamId:string|null;escalationOwnerId:string|null;createdAt:string};

const json = (method:string, body:unknown) => ({ method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
export const serviceApi = {
  list: (filters:Record<string,string>={}) => apiFetch(`/api/service/cases?${new URLSearchParams(filters)}`) as Promise<ServiceCase[]>,
  get: (id:string) => apiFetch(`/api/service/cases/${encodeURIComponent(id)}`) as Promise<ServiceCase>,
  create: (body:unknown) => apiFetch("/api/service/cases",json("POST",body)) as Promise<ServiceCase>,
  update: (id:string,body:unknown) => apiFetch(`/api/service/cases/${encodeURIComponent(id)}`,json("PUT",body)) as Promise<ServiceCase>,
  reopen: (id:string,body:unknown) => apiFetch(`/api/service/cases/${encodeURIComponent(id)}/reopen`,json("POST",body)) as Promise<ServiceCase>,
  addUpdate: (id:string,body:unknown) => apiFetch(`/api/service/cases/${encodeURIComponent(id)}/updates`,json("POST",body)) as Promise<ServiceCase>,
  addAttachment: (id:string,body:unknown) => apiFetch(`/api/service/cases/${encodeURIComponent(id)}/attachments`,json("POST",body)) as Promise<{reused:boolean;attachment:ServiceAttachment}>,
  configuration: () => apiFetch("/api/service/configuration") as Promise<{teams:ResponsibilityConfiguration;policies:ServicePolicy[]}>,
  saveTeam: (body:unknown) => apiFetch("/api/service/configuration/teams",json("POST",body)) as Promise<ResponsibilityConfiguration>,
  saveRouting: (body:unknown) => apiFetch("/api/service/configuration/routing",json("POST",body)) as Promise<ResponsibilityConfiguration>,
  savePolicy: (body:unknown) => apiFetch("/api/service/configuration/policies",json("POST",body)) as Promise<ServicePolicy[]>
};
