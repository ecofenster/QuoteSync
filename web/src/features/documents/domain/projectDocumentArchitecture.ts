export type DocumentEntityLink = {
  kind: "client" | "estimate" | "order" | "supplier_quotation" | "project";
  id: string;
};

export type CanonicalExternalDocument = {
  provider: "google_drive" | "microsoft_onedrive";
  providerFolderId: string;
  providerFileId: string;
  versionId: string | null;
  links: DocumentEntityLink[];
};

export type ProjectFolderNode = {
  name: string;
  owner: "customer" | "quotesuite" | "supplier" | "accounting" | "site";
  children?: ProjectFolderNode[];
};

export const PROJECT_FOLDER_PROVISIONING_TRIGGER = "enquiry_qualified_to_estimate" as const;

export function buildEcofensterEstimateFolderTemplate(input: {
  year: number;
  clientProjectLabel: string;
  supplierNames: string[];
}): ProjectFolderNode {
  const suppliers = [...new Set(input.supplierNames.map((name) => name.trim()).filter(Boolean))];
  return {
    name: "Estimates",
    owner: "quotesuite",
    children: [{
      name: String(input.year),
      owner: "quotesuite",
      children: [{
        name: input.clientProjectLabel.trim(),
        owner: "quotesuite",
        children: [
          { name: "Drawings (Client)", owner: "customer", children: [{ name: "PDF Auto Take Offs", owner: "quotesuite" }] },
          { name: "Drawings (Ecofenster)", owner: "quotesuite" },
          { name: "Estimates", owner: "quotesuite", children: suppliers.map((name) => ({ name, owner: "supplier" as const })) },
          { name: "Invoices", owner: "accounting" },
          { name: "Pictures", owner: "site" },
          { name: "Videos", owner: "site" },
        ],
      }],
    }],
  };
}

export const ESTIMATE_TO_ORDER_DOCUMENT_STRATEGY = {
  mode: "promote_canonical_project_and_copy_immutable_issued_documents",
  orderRoot: "Orders/<Year>/<Client / Project>",
  rule: "Retain one canonical project folder relationship; link working evidence and copy only immutable issued/accepted documents when an Order record requires its own filing evidence.",
} as const;
