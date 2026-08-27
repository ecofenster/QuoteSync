import { apiFetch } from "../api/apiClient";
import type { GoogleWorkspaceStatus } from "../communications/communicationsApi";

const json={"Content-Type":"application/json"};
export const googleWorkspaceIntegrationService={
  status:()=>apiFetch("/api/integrations/googleWorkspace/status") as Promise<GoogleWorkspaceStatus>,
  configure:(input:{clientId:string;clientSecret?:string;redirectUri:string;enquiriesRootFolderId?:string|null;estimatesRootFolderId?:string|null;ordersRootFolderId?:string|null;folderTemplate?:Record<string,string>})=>apiFetch("/api/integrations/googleWorkspace/config",{method:"PUT",headers:json,body:JSON.stringify(input)}) as Promise<GoogleWorkspaceStatus>,
  beginOAuth:()=>apiFetch("/api/integrations/googleWorkspace/oauth/start",{method:"POST"}) as Promise<{authorizationUrl:string;state:string;expiresAt:string}>,
  disconnect:()=>apiFetch("/api/integrations/googleWorkspace/disconnect",{method:"POST"}) as Promise<GoogleWorkspaceStatus>,
};
