export type DocumentEntityLink = {
  kind: "client" | "estimate" | "order" | "supplier_quotation" | "project";
  id: string;
};

export type CanonicalExternalDocument = {
  provider: "quotesuite_managed" | "google_drive" | "microsoft_onedrive" | "microsoft_sharepoint";
  providerAccountId: string;
  providerFolderId: string | null;
  providerFileId: string | null;
  versionId: string | null;
  clientId: string;
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

export const PROJECT_FOLDER_PROVISIONING_TRIGGER = "enquiry_qualified_to_estimate" as const;
export const CONFIGURED_ESTIMATES_ROOT_ROLE = "existing_estimates_root" as const;

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

export const ESTIMATE_TO_ORDER_DOCUMENT_STRATEGY = {
  mode: "promote_canonical_project_and_copy_immutable_issued_documents",
  projectOrdersFolder: "<Project>/Orders",
  globalOrdersRoot: "reserved_until_operational_purpose_is_confirmed",
  rule: "Retain one canonical project document relationship; the project Orders subfolder is current structure, while a separately configured global Orders root remains optional and must not drive provisioning until its purpose is confirmed.",
} as const;
