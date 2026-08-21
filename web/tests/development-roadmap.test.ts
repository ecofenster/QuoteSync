import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { DEVELOPMENT_ORDER, PLATFORM_READINESS, ROADMAP_CHECKPOINT_SHA, ROADMAP_CHRONOLOGY, ROADMAP_ITEMS, ROADMAP_SECTIONS } from "../src/features/developmentRoadmap/roadmap.data";
import { flattenRoadmapItems, roadmapStatusCounts, validateRoadmapData } from "../src/features/developmentRoadmap/roadmap.selectors";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const all = flattenRoadmapItems(ROADMAP_ITEMS);

test("roadmap typed data is complete, unique and deterministically countable", () => {
  assert.deepEqual(validateRoadmapData(ROADMAP_ITEMS), []);
  assert.ok(all.length >= 100);
  const counts = roadmapStatusCounts(ROADMAP_ITEMS);
  assert.equal(Object.values(counts).reduce((sum, value) => sum + value, 0), all.length);
  assert.ok(counts.complete > 0 && counts.in_progress > 0 && counts.not_started > 0 && counts.legacy > 0);
});

test("Administration exposes Development and the QuoteSuite Roadmap workspace", async () => {
  const [admin, workspace] = await Promise.all([read("src/features/admin/AdminPlaceholderPage.tsx"), read("src/features/developmentRoadmap/DevelopmentRoadmapWorkspace.tsx")]);
  assert.match(admin, /key: "development", label: "Development"/);
  assert.match(admin, /<DevelopmentRoadmapWorkspace/);
  assert.match(workspace, /Administration → Development/);
  assert.match(workspace, /QuoteSuite Roadmap/);
  assert.equal(ROADMAP_SECTIONS[0].id, "overview");
  assert.equal(ROADMAP_SECTIONS.length, 25);
});

test("status rendering uses accessible text as well as colour", async () => {
  const status = await read("src/features/developmentRoadmap/RoadmapStatusBadge.tsx");
  for (const label of ["Complete", "In progress", "Not started", "Legacy / deferred"]) assert.match(status, new RegExp(label.replace("/", "\\/")));
  assert.match(status, /aria-label/);
  assert.match(status, /✓/);
  assert.match(status, /✕/);
});

test("chronology remains ordered and displays the current checkpoint", () => {
  assert.deepEqual(ROADMAP_CHRONOLOGY.map((entry) => entry.sequence), Array.from({ length: 29 }, (_, index) => index + 1));
  assert.equal(ROADMAP_CHRONOLOGY.find((entry) => entry.title === "Checkpoint stabilization")?.checkpointSha, ROADMAP_CHECKPOINT_SHA);
  assert.match(ROADMAP_CHRONOLOGY.at(-1)?.title ?? "", /Supplier confirmation lifecycle defect correction/);
  assert.equal(ROADMAP_CHECKPOINT_SHA, "ed6537b99f0930357e19ea1f505958e088385ce0");
});

test("Configurator foundation is distinct from an overall in-progress product programme", () => {
  const foundation = all.find((item) => item.id === "configurator-foundation");
  const product = all.find((item) => item.id === "configurator-product");
  assert.equal(foundation?.status, "complete");
  assert.equal(product?.status, "in_progress");
  assert.match(product?.summary ?? "", /complete QuoteSuite window and door configuration capability remains a major active development programme/);
  assert.ok((product?.children?.length ?? 0) >= 45);
  assert.ok(product?.technicalDebt.some((entry) => /Admin\/Window Types proof geometry/.test(entry)));
});

test("platform readiness matches the approved audit classification", () => {
  assert.deepEqual(PLATFORM_READINESS.map(({ platform, status }) => [platform, status]), [
    ["Web", "in_progress"], ["Windows Desktop", "not_started"], ["iOS", "not_started"],
    ["Android", "not_started"], ["Tablet", "not_started"], ["Offline Field Mode", "not_started"],
  ]);
  assert.match(DEVELOPMENT_ORDER[1], /Configurator development continues as a major parallel programme/);
});

test("CRM lifecycle and Add Client cleanup are recorded without changing Client UI", () => {
  const lifecycle = all.find((item) => item.id === "crm-lifecycle");
  const cleanup = all.find((item) => item.id === "crm-add-client-cleanup");
  assert.equal(lifecycle?.status, "not_started");
  assert.match(lifecycle?.summary ?? "", /Contact\/Person.*Company.*Enquiry.*Opportunity.*Client\/Customer.*Estimate\/Quotation.*Order\/Sold Project/s);
  assert.equal(cleanup?.status, "not_started");
  assert.match(cleanup?.deferredReason ?? "", /controls remain unchanged/);
});

test("roadmap is static and has no database or production Client mutation dependency", async () => {
  const sources = await Promise.all([
    "roadmap.data.ts", "roadmap.selectors.ts", "DevelopmentRoadmapWorkspace.tsx", "RoadmapOverview.tsx",
  ].map((file) => read(`src/features/developmentRoadmap/${file}`)));
  const combined = sources.join("\n");
  assert.doesNotMatch(combined, /apiFetch|fetch\(|sqlite|\/api\/clients|INSERT INTO|UPDATE clients|DELETE FROM/);
  assert.match(combined, /Protected EF-CL-001 through EF-CL-008/);
});
