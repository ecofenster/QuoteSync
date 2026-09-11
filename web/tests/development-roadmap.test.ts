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
  assert.deepEqual(counts, { complete: 23, in_progress: 73, not_started: 142, blocked: 3, legacy: 10 });
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
  for (const label of ["Complete", "In progress", "Not started", "Blocked", "Superseded / legacy"]) assert.match(status, new RegExp(label.replace("/", "\\/")));
  assert.match(status, /aria-label/);
  assert.match(status, /✓/);
  assert.match(status, /✕/);
});

test("chronology remains ordered and displays the current checkpoint", () => {
  assert.deepEqual(ROADMAP_CHRONOLOGY.map((entry) => entry.sequence), Array.from({ length: 151 }, (_, index) => index + 1));
  assert.equal([...ROADMAP_CHRONOLOGY].reverse().find((entry) => entry.checkpointSha)?.checkpointSha, ROADMAP_CHECKPOINT_SHA);
  assert.equal(ROADMAP_CHRONOLOGY.find((entry) => entry.title === "Browser automation process-lifecycle hardening")?.sequence, 75);
  assert.equal(ROADMAP_CHRONOLOGY.at(-1)?.title, "Governed issued, superseded and withdrawn Estimate lifecycle");
  assert.equal(ROADMAP_CHECKPOINT_SHA, "d896615");
});

test("Email intake conflict review and permanent workflow feedback remain explicit unimplemented requirements", () => {
  const entry = ROADMAP_CHRONOLOGY.find((item)=>item.title === "Email intake identity, file-conflict and outcome-feedback requirement"), communications = all.find((item) => item.id === "communications"), workflow = all.find((item) => item.id === "workflow-orchestration");
  assert.equal(entry?.resultingStatus, "not_started");
  assert.match(entry?.objective ?? "", /existing-record matches.*explicit link-or-create decision/i);
  assert.match(entry?.objective ?? "", /prior filing identity.*verified content identity.*same-name unverified\/different content/i);
  assert.match(entry?.validation ?? "", /save-as-new-revision.*partial completion preservation.*idempotent retry/i);
  assert.match((communications?.notes ?? []).join(" "), /Filename equality alone|filename equality as proof/i);
  assert.match((communications?.notes ?? []).join(" "), /what was created, reused, linked or saved.*safe idempotent continuation/i);
  assert.match((workflow?.notes ?? []).join(" "), /Permanent workflow feedback rule.*complete\/partial\/failed.*safe next action/i);
});

test("guided UX is permanent governance with a bounded unaccepted workspace review", async () => {
  const agents=await read("AGENTS.md"), review=all.find((item)=>item.id==="guided-ux-staged-review"), entry=ROADMAP_CHRONOLOGY.find(item=>item.title==="Guided user experience governance and staged review");
  assert.match(agents,/## Guided user experience and outcome feedback/);
  assert.match(agents,/one clear primary action.*meaningful decision.*immediate progress/s);
  assert.match(agents,/ordinary user can complete the task without developer guidance/);
  assert.equal(review?.status,"in_progress");
  assert.deepEqual(review?.children?.map(item=>item.title),["Email intake and filing","Clients and Projects","Files","Estimates","Comparisons","Portal","Orders"]);
  assert.match((review?.notes??[]).join(" "),/one named workflow stage at a time.*not.*cross-application redesign/i);
  assert.equal(entry?.resultingStatus,"not_started");
  assert.equal(review?.children?.find(item=>item.id==="guided-ux-staged-review-2")?.status,"in_progress");
});

test("Drive provisioning ownership and the two separate PDF deliverables remain explicit", () => {
  const driveEntry = ROADMAP_CHRONOLOGY.find((entry) => entry.title === "Canonical Project Drive provisioning visibility");
  const comparisonPdf = all.find((item) => item.id === "compare-quotes-position-drawings-pdf");
  const estimateOutput = all.find((item) => item.id === "customer-estimate-presentation-output");
  assert.match(driveEntry?.objective ?? "", /standalone Client creation owns EF-CL identity.*Project creation or Enquiry qualification owns the provider workspace/);
  assert.equal(comparisonPdf?.parentId, "compare-quotes");
  assert.equal(comparisonPdf?.status, "in_progress");
  assert.match(comparisonPdf?.nextAction ?? "", /user's QuoteSuite session.*Position A\/G\/N \(A\)\/P findings/i);
  assert.match(comparisonPdf?.summary ?? "", /supplier-specific extracted item drawings.*comprehensive paginated print\/PDF output.*shared report model v2.*older comparisons/i);
  assert.match((comparisonPdf?.notes ?? []).join(" "), /Production Zyle DOCX\/EMF extraction and retained PNG serving are supported.*isolated environments/i);
  assert.equal(estimateOutput?.parentId, "internal-ecofenster-mvp");
  assert.equal(estimateOutput?.status, "in_progress");
  assert.match(estimateOutput?.summary ?? "", /approved Option C cover grammar.*product showcase and specification overview.*Position pages and Estimate Summary/i);
  assert.match(estimateOutput?.implementationStatus ?? "", /full-page cover photograph.*tenant branding data/i);
  assert.match(estimateOutput?.nextAction ?? "", /EF-EST-2026-055 visual checklist.*contaminated decorative section omitted/i);
  assert.notEqual(comparisonPdf?.id, estimateOutput?.id);
});

test("reference-led comparison correction and customer presentation remain separate governed phases", () => {
  const correction = ROADMAP_CHRONOLOGY.find((entry) => entry.title === "Reference-led Compare Quotes assessment correction");
  const delivery = ROADMAP_CHRONOLOGY.find((entry) => entry.title === "Simplified Compare Quotes customer presentation");
  const presentation = all.find((item) => item.id === "compare-quotes-customer-overview-schedule");
  assert.equal(correction?.resultingStatus, "in_progress");
  assert.match(correction?.objective ?? "", /supplier-neutral reference evidence.*invalid thermal values.*quantity conflicts.*withhold unsupported/i);
  assert.equal(delivery?.resultingStatus,"in_progress");
  assert.equal(presentation?.status, "in_progress");
  assert.match(presentation?.summary ?? "", /three-page customer-language overview.*Ty Clai.*equal-sized proportional drawing areas.*supplier rows grouped by canonical Position.*plain-language/i);
  assert.match((presentation?.notes ?? []).join(" "), /same deterministic customer-language presentation fields.*does not label an ordering as best value or force a Top 3.*commercial breakdown fields.*outstanding compatibility task/i);
});

test("comparison, manufacturer documents and portal foundations retain their authority boundaries", async () => {
  const agents = await read("AGENTS.md"), comparison = all.find((item) => item.id === "compare-quotes"), documents = all.find((item) => item.id === "manufacturer-system-document-library"), portal = all.find((item) => item.id === "customer-portal");
  assert.equal(comparison?.status,"in_progress");assert.match(comparison?.summary ?? "",/extraction-first.*automatically selected canonical Estimate revision.*Position identities/);
  assert.match((documents?.notes ?? []).join(" "),/customer-approved records relevant to products\/systems actually supplied/);
  assert.match((portal?.notes ?? []).join(" "),/internal Client-owned Portal Preview.*development-only external application.*without enabling production access/);
  assert.match(agents,/Client Database → Client → Compare Quotes/);assert.match(agents,/supplier item numbers.*never replace canonical Estimate Position identity/i);
  assert.match(agents,/upload\/select once → analyse → review exceptions → compare/);
  assert.match((comparison?.notes ?? []).join(" "), /qualifies specification and dimensional\/configuration compliance before value/);
  assert.match((comparison?.notes ?? []).join(" "), /architect\/customer requirements schedules should become the preferred project requirement source/);
});

test("portal security foundation keeps authentication, release and command boundaries fail-closed", async () => {
  const [rootAgents, webAgents, adr] = await Promise.all([read("../AGENTS.md"), read("AGENTS.md"), read("docs/ADR-0005-client-portal-security-and-issued-estimate-revisions.md")]);
  const portal = all.find((item) => item.id === "customer-portal");
  const entry = ROADMAP_CHRONOLOGY.find((item) => item.title === "Client Portal security and immutable issued Estimate foundation");
  assert.equal(portal?.status, "in_progress");
  assert.match((portal?.blockers ?? []).join(" "), /Production OIDC\/passwordless provider.*Tenant-aware persistence.*GDPR/);
  assert.match(entry?.objective ?? "", /hashed invitations and sessions.*exact Project\/resource authorization.*immutable issued Estimate releases/);
  for (const text of [rootAgents, webAgents]) {
    assert.match(text, /Portal authentication.*resource authorization.*separate/i);
    assert.match(text, /Unreleased Estimates and Documents|unreleased Estimate or Document/i);
    assert.match(text, /Intent to Proceed.*not an Order|Intent to Proceed never commits a supplier Order/i);
  }
  assert.match(adr, /production external access remains disabled/i);
  assert.match(adr, /Secure, HttpOnly, SameSite cookies/);
});

test("governed commercial lifecycle keeps automation and approval boundaries explicit", async () => {
  const agents = await read("AGENTS.md");
  const lifecycle = all.find((item) => item.id === "end-to-end-commercial-lifecycle");
  assert.equal(lifecycle?.status, "in_progress");
  assert.match(lifecycle?.summary ?? "", /Enquiry → RFQ → Supplier Quote → Estimate → Client Review → Revision → Acceptance → Supplier Order → Supplier Confirmation → Customer Final Confirmation → Payment → Delivery \/ Installation/);
  assert.match((lifecycle?.notes ?? []).join(" "), /immutable customer Estimate issue\/release.*Position acceptance creating one staff-gated Order.*secure production Portal deployment.*production e-signature evidence.*invoices\/payments/i);
  assert.match(agents, /Enquiry → RFQ → Supplier Quote → Estimate → Client Review → Revision → Acceptance → Supplier Order → Supplier Confirmation → Customer Final Confirmation → Payment → Delivery \/ Installation/);
  assert.match(agents, /commercial decisions, issued-document changes, customer acceptance and supplier-confirmation differences remain explicit governed approval points/);
});

test("Email intake, Enquiry qualification and Portal review form one phased Estimate-revision workflow", () => {
  const enquiry = all.find((item) => item.id === "crm-lifecycle");
  const communications = all.find((item) => item.id === "communications");
  const portal = all.find((item) => item.id === "customer-portal");
  const lifecycle = all.find((item) => item.id === "end-to-end-commercial-lifecycle");
  const comparisonPdf = all.find((item) => item.id === "compare-quotes-position-drawings-pdf");
  const estimateOutput = all.find((item) => item.id === "customer-estimate-presentation-output");
  assert.match((enquiry?.notes ?? []).join(" "), /Gmail intake.*Add Enquiry by default.*Add Client.*Link Existing Client \/ Project/);
  assert.match((enquiry?.notes ?? []).join(" "), /provider folder IDs remain authoritative across retries.*Drawings \(Client\)/);
  assert.match((communications?.notes ?? []).join(" "), /Supplier enquiry\/RFQ email is staff-reviewed.*Manufacturer replies.*working Estimate/);
  assert.match((communications?.notes ?? []).join(" "), /Changes Requested queue.*supplier change summary.*returned revisions repeat/);
  assert.match((portal?.notes ?? []).join(" "), /pending Portal invitation.*Google sign-in or Microsoft sign-in/);
  assert.match((portal?.notes ?? []).join(" "), /Project under review → Estimate in progress → Estimate ready to review → Changes sent → Estimate being updated → Updated Estimate ready to review/);
  assert.match((portal?.notes ?? []).join(" "), /Accept, Request Changes or Reject.*Position-level comments and general comments/);
  assert.match((portal?.notes ?? []).join(" "), /third distinct issued Estimate revision.*10%/);
  assert.match((lifecycle?.notes ?? []).join(" "), /Delivered foundations: Gmail intake\/review.*configurable informational commitment prompt/);
  assert.equal(comparisonPdf?.status, "in_progress");
  assert.equal(estimateOutput?.status, "in_progress");
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
  assert.match(combined, /All 29 Client rows already present in Ecofenster's workspace are protected by immutable canonical ID/);
  assert.doesNotMatch(combined, /Protected EF-CL-001 through EF-CL-008/);
});

test("Ecofenster clean provisioning and tenant isolation are separate release gates", async () => {
  const agents=await read("AGENTS.md"),clean=all.find(item=>item.id==="saas-clean-customer-provisioning"),isolation=all.find(item=>item.id==="saas-tenant-isolation-acceptance");
  assert.equal(clean?.status,"in_progress");assert.equal(isolation?.status,"blocked");
  assert.match(agents,/Every Client currently present in Ecofenster's workspace is protected by its immutable canonical Client ID/);
  assert.match(agents,/no Ecofenster business records.*OAuth tokens.*private branding\/assets/s);
  assert.match(clean?.technicalVerificationStatus??"",/Database\/storage inventory passed.*build\/package content audit found/i);
  assert.match(isolation?.blockers.join(" ")??"",/Core Client\/Project\/Estimate\/Order\/Communication\/Document tenant ownership/);
});

test("Operations Dashboard review and implementation pass retain honest acceptance status", () => {
  const review=ROADMAP_CHRONOLOGY.find(item=>item.title==="Operations Dashboard and core CRM usability review"),implementation=ROADMAP_CHRONOLOGY.find(item=>item.title==="CRM workday and guided Enquiry foundation"),lifecycle=all.find(item=>item.id==="crm-lifecycle"),pipeline=all.find(item=>item.id==="crm-pipeline"),guided=all.find(item=>item.id==="guided-ux-staged-review-2");
  assert.equal(review?.resultingStatus,"in_progress");
  assert.match(review?.objective??"",/Dashboard.*Enquiries.*Client\/Project context.*Email.*Follow Ups.*pipeline.*history.*search.*ownership.*handover/i);
  assert.match(implementation?.validation??"",/canonical Dashboard counts.*bounded search.*exact Enquiry\/follow-up navigation/i);
  assert.match(pipeline?.implementationStatus??"",/bounded canonical API projection.*truthful Estimate\/Order stage counts/i);
  assert.match(pipeline?.userAcceptanceStatus??"",/not user-accepted/i);
  assert.match(lifecycle?.nextAction??"",/User-accept.*authenticated user\/team authority/i);
  assert.equal(guided?.status,"in_progress");assert.match(guided?.userAcceptanceStatus??"",/not user-accepted/i);
});


test("end-to-end quotation programme is linked without duplicate canonical systems", () => {
  const serialized = JSON.stringify(all);
  for (const phrase of ["Alternative position customer offers", "Installation Materials Included", "Installation Included", "Enquiry → Client → Project → Estimate → Order", "Gmail / Google Workspace", "Microsoft 365 / Outlook", "Google Drive API", "Contextual Next Action", "Automatic 3-day issued Estimate Follow Up", "Customer Portal", "electronic acceptance", "Supplier Order Prepared/Sent", "milestone", "canonical project/site pins"]) assert.match(serialized, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
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
