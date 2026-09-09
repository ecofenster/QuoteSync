import { apiFetch } from "../../services/api/apiClient";

export type PortalAccessSummary = {
  tenantId:string;
  clientId:string;
  externalAccessEnabled:boolean;
  contacts:Array<{id:string;displayName:string;email:string;status:string;activeProjectGrants:number;lastActivityAt:string|null}>;
  invitations:Array<{id:string;contactId:string;projectId:string;status:string;createdAt:string;expiresAt:string;acceptedAt:string|null;revokedAt:string|null}>;
  releases:Array<{releaseId:string;projectId:string;estimateId:string;revisionNo:number;releasedAt:string}>;
  reviews:Array<{estimate_release_id:string;status:string;submitted_at:string}>;
  decisions:Array<{estimate_release_id:string;decision_type:string;decline_reason:string|null;decided_at:string}>;
};

export const clientPortalSecurityApi = {
  clientSummary:(clientId:string)=>apiFetch(`/api/client-portal/internal/clients/${encodeURIComponent(clientId)}/status`) as Promise<PortalAccessSummary>,
};
