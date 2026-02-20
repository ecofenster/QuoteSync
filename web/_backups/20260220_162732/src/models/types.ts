/**
 * QuoteSync — Centralised Types
 * Generated: 2026-02-20 14:28:25
 */

export type MenuKey =
  | "client_database"
  | "project_preferences"
  | "address_database"
  | "reports"
  | "cad_drawing"
  | "remote_support";
export type ClientType = "Business" | "Individual";
export type EstimateStatus = "Draft" | "Completed";
export type ProductType =
  | "uPVC"
  | "uPVC Alu Clad"
  | "Timber"
  | "Timber Aluminium Clad"
  | "Aluminium"
  | "Steel";
export type View = "customers" | "estimate_picker" | "estimate_defaults" | "estimate_workspace";
export type Client = {
  id: string;
  type: ClientType;
  clientRef: string; // EF-CL-001
  clientName: string;
  email: string;
  mobile: string;
  home: string;

  projectName: string;
  projectAddress: string;
  invoiceAddress: string;

  businessName?: string;
  contactPerson?: string;

  estimates: Estimate[];
};
export type EstimateDefaults = {
  supplier: string;
  productType: ProductType;
  product: string;

  woodType: string;

  externalFinish: string;
  internalFinish: string;

  hingeType: "Concealed" | "Exposed 130Kg" | "Exposed 180Kg";

  glassType: "Double" | "Triple";
  ugValue: string; // renamed from U to Ug
  gValue: string;

  windowHandleType: "Type 1" | "Type 2" | "Type 3" | "Type 4" | "Type 5";

  // door-only
  doorMultipointLocking: boolean;
  electricalOperation: boolean;
  dayLatch: boolean;

  // accessories
  internalCillRequired: boolean;
  externalSillRequired: boolean;
  cillDepthMm: number;
  cillEndCapType: "Cladding/Render End Cap" | "Brick Type End Cap";

  frameExtLeftMm: number;
  frameExtRightMm: number;
  frameExtTopMm: number;
  frameExtBottomMm: number;

  sunProtectionRequired: boolean;
  sunProtectionType: "Shutters" | "Roller blinds" | "Venetian blinds (external)" | "Venetian blinds (internal)";
};
export type Estimate = {
  id: string;
  estimateRef: string;
  baseEstimateRef: string;
  revisionNo: number;
  status: EstimateStatus;
  defaults: EstimateDefaults;
  positions: Position[];
};
export type Position = {
  id: string;
  positionRef: string;
  qty: number;
  roomName: string;

  widthMm: number;
  heightMm: number;
  fieldsX: number;
  fieldsY: number;

  insertion: string;
  cellInsertions: Record<string, string>; // key: "col,row"
  colWidthsMm?: number[];
  rowHeightsMm?: number[];

  positionType: "Window" | "Door";

  // per-position overrides (optional)
  useEstimateDefaults: boolean;
  overrides: Partial<EstimateDefaults>;
};
