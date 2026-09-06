import { buildClientReferencePlan } from "./clientReferenceReconciliationService.js";

export const FRESH_DRIVE_INVENTORY_VERSION = "quotesuite-drive-ef-cl-2026-08-27T09:57:29.051Z";
export const FRESH_DRIVE_INVENTORY_HASH = "aa9ec66c264c87369b7e6836fbeb4ab992dd009e78384161facde8fe14ad6c33";

export const APPROVED_CLIENT_RECONCILIATION_ACTIONS = Object.freeze([
  { actionId: "keep-001", type: "keep", clientId: "a61dbbc5d30de819e926358ef", targetRef: "EF-CL-001" },
  { actionId: "keep-002", type: "keep", clientId: "46a2a78fcc2519e926539ee", targetRef: "EF-CL-002" },
  { actionId: "keep-003", type: "keep", clientId: "bc364fb3bba56819e9267ad77", targetRef: "EF-CL-003" },
  { actionId: "keep-004", type: "keep", clientId: "23ca13df541eb19e92647566", targetRef: "EF-CL-004" },
  { actionId: "move-luke-carroll", type: "renumber", clientId: "2bcf66b985295819e1e742fdc", sourceRef: "EF-CL-005", targetRef: "EF-CL-020" },
  { actionId: "move-nick", type: "renumber", clientId: "1b6b09cf25e7219e8c8da1b6", sourceRef: "EF-CL-006", targetRef: "EF-CL-019" },
  { actionId: "move-john-wingfield", type: "renumber", clientId: "fac23ef5196de819e8c8452ed", sourceRef: "EF-CL-007", targetRef: "EF-CL-025" },
  { actionId: "move-3d-construction", type: "renumber", clientId: "873bf7f4d633e819e8c863d2d", sourceRef: "EF-CL-008", targetRef: "EF-CL-026" },
  { actionId: "isolate-ecofenster-test", type: "demo_isolate", clientId: "a8e5a8346b9431a025acdaa1", sourceRef: "EF-CL-009", targetRef: "TEST-CL-ECOFENSTER-001", namespace: "test" },
  { actionId: "isolate-eleanor-demo", type: "demo_isolate", clientId: "d0cee3a0933fc81a02bf01fac", sourceRef: "EF-CL-010", targetRef: "DEMO-CL-ELEANOR-001", namespace: "demo" },
  ...[
    ["005","Owain Parry"],["006","Petra Disterer"],["007","Sebastian Lear"],["008","Ian Crofter"],
    ["010","Dominic Danner"],["013","James Cosgrave"],["015","Niall Gallagher"],["017","Richard Pollitt"],
    ["018","Gavin Simpson"],["021","Andrew Smith"],["023","Allan Nisbet"],["024","Gema & Alex"],["027","Ronnie & Katrina Devlin"],
  ].map(([suffix, name]) => ({ actionId: `create-${suffix}`, type: "create", targetRef: `EF-CL-${suffix}`, name, lifecycle: "unknown_review" })),
  { actionId: "create-009", type: "create", targetRef: "EF-CL-009", name: "Myzsa Group", clientType: "Business", contactName: "Jon & Joshua Day", companyName: "Myzsa Group", lifecycle: "unknown_review" },
  { actionId: "create-011", type: "create", targetRef: "EF-CL-011", name: "John Lamb", clientType: "Business", contactName: "John Lamb", companyName: "John Lamb Architects", lifecycle: "unknown_review" },
  { actionId: "create-014", type: "create", targetRef: "EF-CL-014", name: "Lau Blinds / Parcel Hero", clientType: "Business", companyName: "Lau Blinds / Parcel Hero", lifecycle: "unknown_review" },
  { actionId: "project-roedean-2025", type: "create_project", clientRef: "EF-CL-001", projectName: "Roedean Crescent", year: 2025, providerFolderId: "1WosqBtALlXNMD7rdq_tiEYZqPIi4HjWs", folderPath: "2025/EF-CL-001 - 1-3 Roedean Crescent" },
  { actionId: "project-roedean-2026", type: "create_project", clientRef: "EF-CL-001", projectName: "Walk on Glass", year: 2026, providerFolderId: "1bSbHYHu7_FWQlYO04_Xb3m59Iqbd5hNn", folderPath: "2026/EF-CL-001 - Roedean Crescent (Walk on Glass)" },
  { actionId: "project-wiveliscombe", type: "create_project", clientRef: "EF-CL-004", projectName: "Wiveliscombe Pool House", year: 2025, providerFolderId: "1W9mAYJg2wft2Q7I2FxHNSSxc-cxNqQMQ", folderPath: "2025/EF-CL-004 - Benjamin Henry - Wiveliscombe Pool House" },
  { actionId: "project-millbank", type: "create_project", clientRef: "EF-CL-004", projectName: "Millbank", year: 2025, providerFolderId: "17N5LvWw3PxE0DQrfVRFawX4dwN5J08tz", folderPath: "2025/EF-CL-004 - Millbank - Benjamin Henry (Dominic)" },
  { actionId: "project-bland-cottage", type: "create_project", clientRef: "EF-CL-017", projectName: "Bland Cottage", year: 2026, providerFolderId: "167lEJmiSVs7Hoz2HIV2KLACyZTGZVb0x", folderPath: "2026/EF-CL-017 - Richard Pollitt (Bland Cottage)" },
  { actionId: "project-treforest", type: "create_project", clientRef: "EF-CL-021", projectName: "Treforest", year: 2026, providerFolderId: "1fM9HEwjAW2L6YIwWydYRUNOQHBTMgOOH", folderPath: "2026/EF-CL-021 - Andrew Smith (Treforest)" },
]);

export function buildApprovedClientReconciliationPlan() {
  return buildClientReferencePlan({
    version: FRESH_DRIVE_INVENTORY_VERSION,
    driveInventoryHash: FRESH_DRIVE_INVENTORY_HASH,
    actions: APPROVED_CLIENT_RECONCILIATION_ACTIONS,
  });
}
