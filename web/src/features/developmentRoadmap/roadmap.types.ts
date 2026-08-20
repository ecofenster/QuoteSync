export type RoadmapStatus = "complete" | "in_progress" | "not_started" | "legacy";

export type RoadmapPlatform =
  | "all"
  | "shared"
  | "web"
  | "windows"
  | "ios"
  | "android"
  | "tablet"
  | "offline";

export type RoadmapSectionId =
  | "overview"
  | "foundation"
  | "configurator"
  | "supplier-import"
  | "estimate-positions"
  | "project-costing"
  | "commercial-engine"
  | "project-map"
  | "quotations"
  | "crm"
  | "orders"
  | "documents"
  | "survey-installation"
  | "workforce"
  | "field-operations"
  | "service-warranty"
  | "reporting"
  | "automation"
  | "platform-clients"
  | "saas"
  | "cleanup"
  | "documentation"
  | "professional-review"
  | "external-pilot"
  | "commercialisation";

export type RoadmapItem = {
  id: string;
  phase: number;
  sequence: number;
  category: RoadmapSectionId;
  title: string;
  status: RoadmapStatus;
  platform: RoadmapPlatform[];
  summary: string;
  completedDate?: string;
  checkpointSha?: string;
  validationStatus?: string;
  dependencies: string[];
  blockers: string[];
  canonicalModules: string[];
  nextAction: string;
  technicalDebt: string[];
  notes: string[];
  parentId?: string;
  children?: RoadmapItem[];
  risk?: "low" | "medium" | "high" | "critical";
  milestone?: string;
  evidence?: string[];
  historicalPhase?: string;
  targetClient?: string;
  prerequisite?: string;
  deferredReason?: string;
};

export type RoadmapSection = {
  id: RoadmapSectionId;
  label: string;
  description: string;
};

export type RoadmapChronologyEntry = {
  sequence: number;
  title: string;
  checkpointSha?: string;
  date?: string;
  objective?: string;
  validation?: string;
  limitations?: string[];
  resultingStatus?: RoadmapStatus;
};

export type PlatformReadiness = {
  platform: "Web" | "Windows Desktop" | "iOS" | "Android" | "Tablet" | "Offline Field Mode";
  status: RoadmapStatus;
  summary: string;
  blockers: string[];
  nextPrerequisite: string;
};
