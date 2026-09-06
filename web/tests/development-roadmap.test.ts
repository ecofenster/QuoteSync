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
  assert.deepEqual(ROADMAP_CHRONOLOGY.map((entry) => entry.sequence), Array.from({ length: 95 }, (_, index) => index + 1));
  assert.equal(ROADMAP_CHRONOLOGY.find((entry) => entry.title === "Checkpoint stabilization")?.checkpointSha, ROADMAP_CHECKPOINT_SHA);
  assert.equal(ROADMAP_CHRONOLOGY.find((entry) => entry.title === "Browser automation process-lifecycle hardening")?.sequence, 75);
  assert.equal(ROADMAP_CHECKPOINT_SHA, "ed6537b99f0930357e19ea1f505958e088385ce0");
});

test("source-owned positions, captured FX and watched development are governed together", async () => {
  const agents = await read("AGENTS.md");
  const entry = ROADMAP_CHRONOLOGY.find((item) => item.title === "Manufacturer position persistence, explicit FX basis and self-reloading development");
  const fxEntry = ROADMAP_CHRONOLOGY.find((item) => item.title === "Protective fixed Estimate FX rate");
  assert.match(agents, /Supplier-imported canonical positions.*source-owned evidence/);
  assert.match(agents, /captured\/fixed Estimate Rate.*informational Live Rate/);
  assert.match(agents, /round upward to the next hundredth, then add `0\.01`/);
  assert.match(fxEntry?.validation ?? "", /raw 0\.85898 \/ fixed 0\.87/);
  const brandedV2Entry = ROADMAP_CHRONOLOGY.find((item) => item.title === "Shared V2 Dark brand translations");
  assert.match(brandedV2Entry?.objective ?? "", /shared semantic component tokens/);
  assert.match(brandedV2Entry?.limitations.join(" ") ?? "", /commercial behaviour/);
  const interactiveV2Entry = ROADMAP_CHRONOLOGY.find((item) => item.title === "V2 Dark interactive-state contrast");
  assert.match(interactiveV2Entry?.validation ?? "", /pointer-hover.*keyboard-focus-visible.*pressed.*selected.*disabled/);
  const v2HoverSemanticsEntry = ROADMAP_CHRONOLOGY.find((item) => item.title === "V2 Dark active and inactive hover semantics");
  assert.match(v2HoverSemanticsEntry?.objective ?? "", /active brand controls invert to charcoal.*inactive neutral controls promote to the brand surface/);
  assert.match(v2HoverSemanticsEntry?.validation ?? "", /Files \/ Documents.*Review Customer Quotation.*destructive-action exclusion/);
  const approvedV2Entry = ROADMAP_CHRONOLOGY.find((item) => item.title === "Approved V2 Brand × Appearance system");
  assert.match(approvedV2Entry?.objective ?? "", /approved shared application design system.*QuoteSuite.*Ecofenster.*Zyle Fenster.*GlassWorx/);
  assert.match(approvedV2Entry?.validation ?? "", /Eight-combination.*structural platform\/company logo lockup/);
  assert.match(agents, /Brand Profile and Appearance are independent dimensions/);
  assert.match(agents, /QuoteSuite \| Company.*QuoteSuite on the left/);
  assert.match(agents, /Future brand profiles must supply semantic brand assets and palette tokens/);
  assert.match(agents, /npm run dev:quotesuite/);
  assert.match(entry?.validation ?? "", /stale-write protection.*reload\/synchronization\/idempotency/);
});

test("commercial supplier governance prefers reliable automatic proposals and excludes legacy method holders", async () => {
  const agents = await read("AGENTS.md");
  const entry = ROADMAP_CHRONOLOGY.find((item) => item.title === "Commercial Supplier automatic proposal and legacy-option cleanup");
  assert.match(agents, /explicit quotation supplier\/dealer evidence; recognized quotation\/document family; a unique configured manufacturer\/supplier relationship/);
  assert.match(agents, /Never force a redundant manual selection/);
  assert.match(agents, /Legacy pricing-method holders.*must never appear in Manufacturer Import supplier choices/);
  assert.match(entry?.validation ?? "", /inactive EKO-OKNA plus active Any\/method records/);
});

test("quotation packages keep source prices and map reviewable canonical service meanings", async () => {
  const agents = await read("AGENTS.md");
  const entry = ROADMAP_CHRONOLOGY.find((item) => item.title === "Source-owned quotation package meanings");
  assert.match(agents, /Supply Only, Supply \+ Installation Support and Supply \+ Install/);
  assert.match(agents, /marketing labels.*remain verbatim, provenance-bearing evidence/);
  assert.match(agents, /prices must come from the quotation, never a fixed Administration package-price table/);
  assert.match(entry?.validation ?? "", /original label, quotation amount and source-region provenance retention/i);
  assert.match(entry?.validation ?? "", /manual meaning correction/i);
});

test("critical commercial acceptance distinguishes validation depth and exact-source completion", async () => {
  const agents = await read("AGENTS.md");
  const entry = ROADMAP_CHRONOLOGY.find((item) => item.title === "Exact-source Manufacturer Import completion gate");
  assert.match(agents, /unit\/service validation, production-style API validation, and exact real-source end-to-end validation/);
  assert.match(agents, /upload → analyse → review → final import → Project Costing → reload/);
  assert.match(agents, /parser-only, fixture-injected, mocked-response and review-only tests do not satisfy this gate/);
  assert.match(entry?.validation ?? "", /five-position\/five-preview final extract-and-load/);
  assert.match(entry?.validation ?? "", /idempotent replay.*transactional rollback/);
});

test("product strategy separates QuoteSuite Core from optional vertical capability", () => {
  const strategy = ROADMAP_ITEMS.find((item) => item.id === "product-architecture-strategy");
  const text = [strategy?.summary, ...(strategy?.canonicalModules ?? []), ...(strategy?.notes ?? [])].join(" ");
  assert.match(text, /industry-neutral Core/);
  assert.match(text, /Window & Door vertical owns the configurator/);
  assert.match(text, /multiple European manufacturers or suppliers, currencies and pricing methods/);
  assert.match(text, /Do not prematurely generalise/);
  assert.match(text, /genuine second vertical/);
  assert.match(text, /core subscription, users\/seats, optional paid modules\/add-ins/);
  assert.match(text, /no valuation target is promised/);
});

test("development runtime governance retains explicit API ownership restoration", () => {
  const platformWeb = ROADMAP_ITEMS.find((item) => item.id === "platform-web");
  const runtimeEntry = ROADMAP_CHRONOLOGY.find((entry) => entry.title === "Global development runtime and database health");
  assert.match(platformWeb?.notes?.join(" ") ?? "", /port-3001 ownership baseline/);
  assert.match(platformWeb?.notes?.join(" ") ?? "", /exact owned process trees/);
  assert.match(runtimeEntry?.validation ?? "", /isolated-port ownership\/reuse\/cleanup/);
});

test("browser acceptance requires verified process-tree and profile absence", () => {
  const platformWeb = ROADMAP_ITEMS.find((item) => item.id === "platform-web");
  const lifecycleEntry = ROADMAP_CHRONOLOGY.find((entry) => entry.title === "Browser automation process-lifecycle hardening");
  assert.match(platformWeb?.notes?.join(" ") ?? "", /unique temporary profile.*recorded Chrome root identity/);
  assert.match(platformWeb?.notes?.join(" ") ?? "", /process and profile counts are both zero/);
  assert.match(lifecycleEntry?.validation ?? "", /deliberate assertion-failure Chrome regression/);
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

test("CRM lifecycle foundation and deferred Add Client cleanup are recorded", () => {
  const lifecycle = all.find((item) => item.id === "crm-lifecycle");
  const cleanup = all.find((item) => item.id === "crm-add-client-cleanup");
  assert.equal(lifecycle?.status, "in_progress");
  assert.match(lifecycle?.summary ?? "", /Enquiry → Client → Project → Estimate → Order/);
  assert.match(lifecycle?.summary ?? "", /EF-ENQ.*EF-CL.*immutable internal ID.*without public EF-PRJ/s);
  assert.match((lifecycle?.notes||[]).join(" "),/Direct Web Enquiry intake.*public integration contract.*WordPress/s);
  assert.match((lifecycle?.notes||[]).join(" "),/rate limiting.*bot.*replay.*untrusted-upload/s);
  assert.equal(cleanup?.status, "not_started");
  assert.match(cleanup?.deferredReason ?? "", /controls remain unchanged/);
});

test("communications roadmap keeps Email dedicated and scopes omnichannel business history",()=>{
  const item=all.find(entry=>entry.id==="communications"),text=[item?.summary,...(item?.notes||[])].join(" "),children=(item?.children||[]).map(child=>child.title).join(" ");
  assert.match(text,/Email remains a dedicated provider-mailbox workspace/);assert.match(text,/Pub\/Sub notifications are signals/);assert.match(text,/WhatsApp Business is the first planned/);assert.match(text,/assigned, handling and responding user attribution/);assert.match(text,/unified activity timeline/);
  for(const channel of ["WhatsApp","Facebook","Instagram","TikTok","LinkedIn","SMS","Calls"])assert.match(children,new RegExp(channel));
});

test("roadmap is static and has no database or production Client mutation dependency", async () => {
  const sources = await Promise.all([
    "roadmap.data.ts", "roadmap.selectors.ts", "DevelopmentRoadmapWorkspace.tsx", "RoadmapOverview.tsx",
  ].map((file) => read(`src/features/developmentRoadmap/${file}`)));
  const combined = sources.join("\n");
  assert.doesNotMatch(combined, /apiFetch|fetch\(|sqlite|\/api\/clients|INSERT INTO|UPDATE clients|DELETE FROM/);
  assert.match(combined, /Protected EF-CL-001 through EF-CL-008/);
});


test("end-to-end quotation programme is linked without duplicate canonical systems", () => {
  const serialized = JSON.stringify(all);
  for (const phrase of ["Alternative position customer offers", "Installation Materials Included", "Installation Included", "Enquiry → Client → Project → Estimate → Order", "Gmail / Google Workspace", "Microsoft 365 / Outlook", "Google Drive API", "Contextual Next Action", "Automatic 3-day issued quotation Follow Up", "Customer Portal", "electronic acceptance", "Supplier Order Sent", "milestone", "canonical project/site pins"]) assert.match(serialized, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  assert.equal(all.filter((item) => item.id === "workflow-orchestration").length, 1);
  assert.equal(all.filter((item) => item.id === "customer-portal").length, 1);
  assert.match(serialized, /leadSource/);
  assert.match(serialized, /never infer Project Name from Lead Source/i);
  assert.match(serialized, /existing Estimates root/i);
  assert.match(serialized, /Provider configuration is entered once through Administration → Integrations and persists securely/i);
  assert.match(serialized, /infrastructure-managed master encryption/i);
});

test("quotation roadmap governs the three specification layers and defers detailed technical mode", () => {
  const quotation = all.find((item) => item.id === "quotation");
  assert.match((quotation?.notes ?? []).join(" "), /complete source evidence → rich supplier-neutral internal canonical evidence → curated customer-safe document projection/);
  assert.match((quotation?.children ?? []).map((item) => item.title).join(" "), /Detailed Technical Specification document mode/);
});
