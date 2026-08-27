export type DocumentEntityLink = {
  kind: "enquiry" | "client" | "project" | "estimate" | "order" | "supplier" | "supplier_quotation";
  id: string;
};

export type CanonicalExternalDocument = {
  provider: "quotesuite_managed" | "google_drive" | "microsoft_onedrive" | "microsoft_sharepoint";
  providerAccountId: string;
  providerFolderId: string | null;
  providerFileId: string | null;
  versionId: string | null;
  enquiryId: string | null;
  clientId: string | null;
  projectId: string | null;
  estimateId: string | null;
  orderId: string | null;
  supplierId: string | null;
  documentType: string;
  revision: string | null;
  links: DocumentEntityLink[];
};

export type ProjectFolderNode = {
  name: string;
  owner: "customer" | "quotesuite" | "supplier" | "accounting" | "site";
  children?: ProjectFolderNode[];
};

export const PROJECT_FOLDER_PROVISIONING_TRIGGER = "enquiry_qualified_to_project" as const;
export const CONFIGURED_ESTIMATES_ROOT_ROLE = "existing_estimates_root" as const;
export const DRIVE_DISCOVERY_SYNC_STRATEGY = {
  current: "full_enumeration",
  incrementalSuccessor: "google_drive_changes_api",
  persistedCursor: "provider account + change token",
  rule: "Render persisted canonical records first; provider discovery refreshes metadata idempotently by provider account and file ID. A later Changes API adapter may replace enumeration without changing Client or Estimate Files.",
} as const;

export function buildEcofensterEstimateFolderTemplate(input: {
  year: number;
  clientProjectLabel: string;
  supplierNames: string[];
}): ProjectFolderNode {
  const suppliers = [...new Set(input.supplierNames.map((name) => name.trim()).filter(Boolean))];
  return {
    name: String(input.year),
    owner: "quotesuite",
    children: [{
      name: input.clientProjectLabel.trim(),
      owner: "quotesuite",
      children: [{
        name: "Drawings (Client)", owner: "customer",
      },
      { name: "Drawings (Ecofenster)", owner: "quotesuite" },
      { name: "Estimates", owner: "quotesuite", children: suppliers.map((name) => ({ name, owner: "supplier" as const })) },
      { name: "Invoices", owner: "accounting" },
      { name: "Orders", owner: "quotesuite" }],
    }],
  };
}

export function buildCanonicalProjectFolderTemplate(input: {
  year: number;
  clientRef: string;
  clientName: string;
  projectName: string;
  estimates: Array<{ estimateRef: string; descriptor?: string }>;
}): ProjectFolderNode {
  const clientFolder = `${input.clientRef.trim()} - ${input.clientName.trim()}`;
  const estimateFolders = input.estimates.map(({ estimateRef, descriptor }) => ({
    name: `${estimateRef.trim()}${descriptor?.trim() ? ` - ${descriptor.trim()}` : ""}`,
    owner: "quotesuite" as const,
  }));
  return {
    name: String(input.year),
    owner: "quotesuite",
    children: [{
      name: clientFolder,
      owner: "quotesuite",
      children: [{
        name: input.projectName.trim(),
        owner: "quotesuite",
        children: [
          { name: "Drawings (Client)", owner: "customer" },
          { name: "Drawings (Ecofenster)", owner: "quotesuite" },
          { name: "Estimates", owner: "quotesuite", children: estimateFolders },
          { name: "Invoices", owner: "accounting" },
          { name: "Orders", owner: "quotesuite" },
        ],
      }],
    }],
  };
}

export const LEGACY_DRIVE_DISCOVERY_SHAPES = [
  "year_estimate",
  "year_client_historical",
  "year_client_project_estimates",
] as const;

export const ESTIMATE_TO_ORDER_DOCUMENT_STRATEGY = {
  mode: "promote_canonical_project_and_copy_immutable_issued_documents",
  projectOrdersFolder: "<Project>/Orders",
  globalOrdersRoot: "reserved_until_operational_purpose_is_confirmed",
  rule: "Retain one canonical project document relationship; the project Orders subfolder is current structure, while a separately configured global Orders root remains optional and must not drive provisioning until its purpose is confirmed.",
} as const;
