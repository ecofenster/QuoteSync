import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Enquiry and Project UX foundation exposes explicit qualification and Estimate Project selection", async () => {
  const [enquiries, projects, app, estimateRow, types] = await Promise.all([
    readFile("src/features/commercialIdentity/EnquiryWorkspace.tsx", "utf8"),
    readFile("src/features/commercialIdentity/ClientProjectsPanel.tsx", "utf8"),
    readFile("src/App.tsx", "utf8"),
    readFile("src/features/estimateCollection/EstimateCollectionRow.tsx", "utf8"),
    readFile("src/models/types.ts", "utf8"),
  ]);
  assert.match(enquiries, /New Enquiry/);
  assert.match(enquiries, /Qualify Enquiry/);
  assert.match(enquiries, /existing_client/);
  assert.match(enquiries, /new_client/);
  assert.match(enquiries, /reviewed Project name/i);
  assert.match(projects, /New Project/);
  assert.match(projects, /One permanent Client may own multiple named Projects/);
  assert.match(app, /createEstimateProjectId/);
  assert.match(app, /Every new EF-EST belongs to one immutable Project/);
  assert.match(estimateRow, /Project: \{item\.projectName\}/);
  assert.match(types, /ProjectId/);
  assert.doesNotMatch(`${enquiries}\n${projects}\n${types}`, /EF-PRJ/);
});

test("Administration, documents and Roadmap describe the canonical hierarchy without replacing legacy discovery", async () => {
  const [admin, documentArchitecture, drive, roadmap] = await Promise.all([
    readFile("src/features/admin/AdminIntegrationsPanel.tsx", "utf8"),
    readFile("src/features/documents/domain/projectDocumentArchitecture.ts", "utf8"),
    readFile("server/features/documents/driveIntegrationService.js", "utf8"),
    readFile("src/features/developmentRoadmap/roadmap.data.ts", "utf8"),
  ]);
  assert.match(admin, /Enquiries root folder ID/);
  assert.match(documentArchitecture, /buildCanonicalProjectFolderTemplate/);
  assert.match(documentArchitecture, /year_client_project_estimates/);
  assert.match(drive, /if \(canonicalContext\?\.project_id\)/);
  assert.match(drive, /matchesEstimateReferencePrefix/);
  assert.match(roadmap, /Enquiry → Client → Project → Estimate → Order/);
  assert.match(roadmap, /without public EF-PRJ/);
  assert.match(roadmap, /Year → EF-CL Client → human-named Project/);
  assert.match(roadmap, /legacy discovery compatibility/);
});

test("standing rules bind protection to internal identity and isolate demo references", async () => {
  const rules = await readFile("../AGENTS.md", "utf8");
  assert.match(rules, /protected live user identities by immutable internal Client ID/);
  assert.match(rules, /dedicated, explicitly approved reconciliation boundary/);
  assert.match(rules, /Demo and test Client identities must use a non-production reference namespace/);
});

test("normal Client and Estimate APIs cannot bypass canonical reference and Project ownership", async () => {
  const [clients, estimates, startup] = await Promise.all([
    readFile("server/routes/clients.js", "utf8"),
    readFile("server/routes/estimates.js", "utf8"),
    readFile("server/db.js", "utf8"),
  ]);
  assert.match(clients, /Client references are allocated automatically/);
  assert.match(clients, /controlled reconciliation migration/);
  assert.match(clients, /isProtectedClientIdentity/);
  assert.match(estimates, /project_id is required for a new canonical Estimate/);
  assert.match(estimates, /Choose an active Project belonging to the selected Client/);
  assert.match(estimates, /allocateCanonicalReference/);
  assert.ok(startup.lastIndexOf("initializeWorkflowSchema") < startup.lastIndexOf("initializeCommercialIdentitySchema"));
});
