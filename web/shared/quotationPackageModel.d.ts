export type CanonicalQuotationPackageLevel = "supply_only" | "supply_installation_support" | "supply_install";

export type CanonicalQuotationPackageDefinition = {
  id: string;
  label: string;
  sourceLabel: string;
  description?: string;
  enabled: boolean;
  isBase: boolean;
  packageType: CanonicalQuotationPackageLevel | "review_required";
  canonicalPackageLevel: CanonicalQuotationPackageLevel | null;
  canonicalPackageLabel: string;
  canonicalMeaningProvenance: "quotation_wording" | "recognized_marketing_sequence" | "review_required" | "manual";
  upliftCategory: "installation_support" | "installation" | null;
  amount: string;
  amountProvenance: "supplier_quotation";
  sourceTrace: unknown[];
  displayOrder: number;
  selected: boolean;
};

export declare const CANONICAL_QUOTATION_PACKAGE_LEVELS: readonly Readonly<{
  id: CanonicalQuotationPackageLevel;
  label: string;
  upliftCategory: "installation_support" | "installation" | null;
}>[];

export declare function canonicalQuotationPackageLabel(level: unknown): string;
export declare function canonicalQuotationPackageUpliftCategory(level: unknown): "installation_support" | "installation" | null;
export declare function buildQuotationPackageEvidence(comparisonTotals?: unknown[]): CanonicalQuotationPackageDefinition[];
export declare function correctQuotationPackageMeaning<T extends Record<string, unknown>>(packages: T[], packageId: string, canonicalPackageLevel: CanonicalQuotationPackageLevel): T[];
