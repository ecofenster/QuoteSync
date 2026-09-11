export type RoadmapWorkPackage = {
  id: string;
  sequence: number;
  title: string;
  entryIds: readonly string[];
  dependsOn: readonly string[];
  completionGate: string;
};

export const ROADMAP_IN_PROGRESS_BASELINE = Object.freeze({
  capturedAt: "2026-09-11",
  count: 73,
  purpose: "Original in-progress cohort for the bounded completion programme",
});

export const ROADMAP_WORK_PACKAGES: readonly RoadmapWorkPackage[] = [
  {
    id: "crm-workday-intake",
    sequence: 1,
    title: "CRM workday and Enquiry intake",
    entryIds: ["crm-lifecycle", "crm-pipeline", "workflow-orchestration", "guided-ux-staged-review", "guided-ux-staged-review-2"],
    dependsOn: [],
    completionGate: "Canonical dashboard data, exact-record actions and Enquiry-to-follow-up journey pass normal-route browser verification; user acceptance remains separate.",
  },
  {
    id: "email-files-supplier-intake",
    sequence: 2,
    title: "Email, Files and supplier-document intake",
    entryIds: [
      "communications", "communications-1", "communications-3", "communications-14", "communications-15",
      "document-storage", "document-storage-1", "document-storage-3", "document-storage-4", "document-storage-5", "document-storage-6", "document-storage-7", "document-storage-11", "document-storage-12",
      "manufacturer-rfq-lifecycle", "manufacturer-rfq-lifecycle-1", "manufacturer-rfq-lifecycle-4", "manufacturer-rfq-lifecycle-5", "manufacturer-rfq-lifecycle-6", "manufacturer-rfq-lifecycle-7", "manufacturer-rfq-lifecycle-8",
      "guided-ux-staged-review-1", "guided-ux-staged-review-3",
    ],
    dependsOn: ["crm-workday-intake"],
    completionGate: "Selected-message ownership, existing-record/file conflict review, filing feedback and reviewed Manufacturer Import handoff pass with actual metadata shapes and disposable provider writes.",
  },
  {
    id: "customer-estimate-release",
    sequence: 3,
    title: "Customer Estimate, quotation and release",
    entryIds: [
      "internal-ecofenster-mvp", "mvp-configured-drawing", "mvp-minimal-lifecycle", "mvp-live-hardening", "customer-estimate-presentation-output",
      "quotation", "quotation-1", "quotation-2", "quotation-3", "quotation-4", "quotation-5", "quotation-6", "quotation-7", "quotation-8", "quotation-10", "quotation-12", "quotation-13", "quotation-14", "quotation-15", "quotation-16", "quotation-17", "quotation-18",
      "guided-ux-staged-review-4",
    ],
    dependsOn: ["email-files-supplier-intake"],
    completionGate: "A source-backed working Estimate reaches independent preview/PDF verification and governed immutable release without internal wording or unapproved assets.",
  },
  {
    id: "portal-order-procurement",
    sequence: 4,
    title: "Portal, canonical Order and procurement",
    entryIds: ["canonical-order", "customer-portal", "procurement", "procurement-1", "procurement-8", "procurement-10", "end-to-end-commercial-lifecycle"],
    dependsOn: ["customer-estimate-release"],
    completionGate: "Controlled customer decision, staff approval and supplier/factory review journey passes without live delivery; production identity and legal dependencies stay explicit.",
  },
  {
    id: "comparison-technical-documents",
    sequence: 5,
    title: "Quote comparison and reusable technical documents",
    entryIds: ["compare-quotes", "compare-quotes-position-drawings-pdf", "compare-quotes-customer-overview-schedule", "manufacturer-system-document-library"],
    dependsOn: ["email-files-supplier-intake", "customer-estimate-release"],
    completionGate: "Source-preserving comparison and approved technical-document projection pass normal-route exception review and customer-safe output checks.",
  },
  {
    id: "installation-operations",
    sequence: 6,
    title: "Installation operations",
    entryIds: ["costing-operational-categories", "survey-delivery-installation", "workforce-domain"],
    dependsOn: ["customer-estimate-release"],
    completionGate: "Estimate-owned survey/delivery/installation journey passes snapshot, recovery and normal-route programme verification using disposable records.",
  },
  {
    id: "configurator-drawing-proof",
    sequence: 7,
    title: "Configurator and drawing proof",
    entryIds: ["cfg-b92-direction", "cfg-proof", "configurator-product"],
    dependsOn: ["customer-estimate-release"],
    completionGate: "Supported configured positions retain exact geometry/direction evidence through Estimate and customer-document routes; unsupported families fail closed.",
  },
  {
    id: "platform-provisioning-cleanup",
    sequence: 8,
    title: "Platform boundary, clean provisioning and bounded cleanup",
    entryIds: ["platform-programme", "platform-web", "product-architecture-strategy", "saas-clean-customer-provisioning", "cleanup-immediate"],
    dependsOn: ["crm-workday-intake", "email-files-supplier-intake", "customer-estimate-release"],
    completionGate: "Tenant-neutral package inventory and clean-install verification pass; tenant isolation remains blocked until its separately recorded Core ownership/RBAC prerequisites exist.",
  },
] as const;

export const ROADMAP_WORK_PACKAGE_ENTRY_IDS = ROADMAP_WORK_PACKAGES.flatMap((workPackage) => [...workPackage.entryIds]);
