import { apiFetch } from "../api/apiClient";

export type EnquiryStatus = "new" | "qualified" | "closed" | "converted";
export type EnquiryRecord = {
  id: string;
  enquiryRef: string;
  status: EnquiryStatus;
  source: string;
  leadSource: string;
  displayName: string;
  companyName: string;
  email: string;
  telephone: string;
  projectName: string;
  siteAddress: string;
  notes: string;
  qualificationMode: "existing_client" | "new_client" | null;
  convertedClientId: string | null;
  convertedProjectId: string | null;
  driveTransitionStatus: "pending" | "linked" | "failed" | "not_required";
  qualifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectRecord = {
  id: string;
  clientId: string;
  sourceEnquiryId: string | null;
  name: string;
  status: "active" | "inactive" | "completed" | "cancelled" | "review";
  contextYear: number | null;
  siteAddress: string;
  postcode: string;
  estimateCount: number;
  orderCount: number;
  createdAt: string;
  updatedAt: string;
};

const json = (path: string, body: unknown) => apiFetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const commercialIdentityApi = {
  listEnquiries: () => apiFetch("/api/enquiries") as Promise<EnquiryRecord[]>,
  createEnquiry: (input: Partial<EnquiryRecord>) => json("/api/enquiries", input) as Promise<EnquiryRecord>,
  qualifyEnquiry: (enquiryId: string, input: { mode: "existing_client" | "new_client"; clientId?: string; client?: { name: string; companyName?: string; email?: string; telephone?: string }; project: { name: string; contextYear: number; siteAddress?: string } }) => json(`/api/enquiries/${encodeURIComponent(enquiryId)}/qualify`, input) as Promise<{ enquiry: EnquiryRecord; client: { id: string; clientRef: string; name: string }; project: ProjectRecord }>,
  listProjects: (clientId: string) => apiFetch(`/api/projects?client_id=${encodeURIComponent(clientId)}`) as Promise<ProjectRecord[]>,
  createProject: (input: { clientId: string; name: string; contextYear: number; siteAddress?: string }) => json("/api/projects", input) as Promise<ProjectRecord>,
};
