export const PROJECT_COMMERCIAL_COST_CATEGORIES = [
  "products_supply",
  "extras",
  "transport",
  "import_customs",
  "survey_site_visit",
  "installation_materials",
  "installation",
  "service_remedial",
  "other",
] as const;

export type ProjectCommercialCostCategory = (typeof PROJECT_COMMERCIAL_COST_CATEGORIES)[number];

/** Future Order/Project evidence. It never mutates the sold costing snapshot. */
export type ProjectActualCostEvidence = {
  id: string;
  projectId: string;
  orderId: string | null;
  category: ProjectCommercialCostCategory;
  supplierId: string | null;
  sourceDocumentId: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  amountExVat: string;
  currency: string;
  status: "suggested" | "confirmed" | "corrected";
  classificationReason: string | null;
};

export type ProjectCommercialVariance = {
  category: ProjectCommercialCostCategory;
  estimatedCost: string;
  actualCost: string;
  variance: string;
  variancePercent: string | null;
  direction: "favourable" | "adverse" | "on_budget";
  reason: string | null;
};

export type ProjectCommercialReview = {
  soldEstimateSnapshotId: string;
  sellingValue: string;
  expectedProjectCost: string;
  expectedProfit: string;
  expectedMarginPercent: string;
  actualProjectCost: string;
  actualProfit: string;
  actualMarginPercent: string;
  totalVariance: string;
  lossMaking: boolean;
  categories: ProjectCommercialVariance[];
};
