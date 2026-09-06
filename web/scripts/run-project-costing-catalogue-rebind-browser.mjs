import { build } from "esbuild";
import express from "express";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { createProjectCalculatorLabRouter } from "../server/routes/projectCalculatorLab.js";
import { createInstallationWorkforceService } from "../server/features/projectCalculatorLab/installationWorkforceService.js";
import { seedInstallationCatalogueRebindFixture } from "../tests/fixtures/installationCatalogueRebindFixture.mjs";
import { createBrowserRunController, countBrowserRunProfiles } from "./browser-run-lifecycle.mjs";

const root = path.resolve(".");
const outputDirectory = await mkdtemp(path.join(os.tmpdir(), "qs-catalogue-rebind-browser-"));
const databaseDirectory = await mkdtemp(path.join(os.tmpdir(), "qs-catalogue-rebind-db-"));
const debugPort = 9500 + process.pid % 300;
const controller = createBrowserRunController({ throwOnLeak: true, processOptions: { platformName: process.platform } });
controller.installInterruptHandlers();
const assert = (value, message) => { if (!value) throw new Error(message); };
const waitFor = async (fn, message, timeout = 30000) => { const started = Date.now(); while (Date.now() - started < timeout) { if (await fn().catch(() => false)) return; await new Promise(resolve => setTimeout(resolve, 150)); } throw new Error(message); };
const chromePath = () => ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", `${process.env.LOCALAPPDATA ?? ""}\\Google\\Chrome\\Application\\chrome.exe`].find(Boolean);

let db;
let server;
let child;
let ws;
try {
  db = await open({ filename: path.join(databaseDirectory, "fixture.db"), driver: sqlite3.Database });
  await seedInstallationCatalogueRebindFixture(db);
  await db.run("UPDATE estimates SET project_address_json=? WHERE id=?", JSON.stringify({ line1: "Disposable acceptance site", postcode: "KY4 8ER" }), "installation-fixture-estimate");
  await db.run("UPDATE project_calculator_lab_scenarios SET estimate_id=? WHERE id=?", "installation-fixture-estimate", "installation-catalogue-rebind");
  const workforce = createInstallationWorkforceService(db);
  let workforceState = await workforce.saveCompany({ id: "fixture-near-company", name: "Dynafit Ltd", postcode: "KY4 8AA", active: true });
  workforceState = await workforce.saveTeam({ id: "fixture-near-team", companyId: "fixture-near-company", name: "Crew 2", normalCrewSize: 2, basePostcode: "KY4 8AA", capabilities: ["standard_windows"], installerIds: [], active: true });
  workforceState = await workforce.saveCompany({ id: "fixture-far-company", name: "EcoGlaze Oxfordshire Ltd", postcode: "OX1 1AA", active: true });
  await workforce.saveTeam({ id: "fixture-far-team", companyId: "fixture-far-company", name: "Oxford Crew", normalCrewSize: 2, basePostcode: "OX1 1AA", capabilities: ["standard_windows"], installerIds: [], active: true });
  await build({ entryPoints: [path.join(root, "tests/fixtures/ProjectCostingCatalogueRebindAcceptance.tsx")], bundle: true, format: "esm", platform: "browser", outdir: outputDirectory, define: { "import.meta.env.VITE_API_BASE_URL": "globalThis.location.origin" } });
  const app = express();
  const requests = [];
  app.use(express.json());
  app.use((request, _response, next) => { requests.push({ method: request.method, path: request.path, body: request.body ?? null }); next(); });
  app.post("/api/integrations/googleMaps/geocode", (request, response) => {
    const query = String(request.body?.query ?? "").replace(/\s+/g, "").toUpperCase();
    const coordinates = query.startsWith("KY4") ? { lat: 56.1, lng: -3.4 } : query.startsWith("OX1") ? { lat: 51.75, lng: -1.25 } : null;
    response.json(coordinates);
  });
  app.post("/api/integrations/googleMaps/route", (request, response) => {
    const originLatitude = Number(request.body?.origin?.lat);
    response.json(originLatitude > 55 ? { distanceKm: 19.9558, durationMinutes: 24 } : { distanceKm: 565.969, durationMinutes: 390 });
  });
  app.use("/api/admin/project-calculator-lab", await createProjectCalculatorLabRouter({ dbPromise: Promise.resolve(db), exchangeRateProvider: async () => ({ rawRate: "1", provider: "fixture", quotedAt: "2026-09-01T00:00:00.000Z" }) }));
  app.get("/ProjectCostingCatalogueRebindAcceptance.js", async (_request, response) => response.type("text/javascript").send(await readFile(path.join(outputDirectory, "ProjectCostingCatalogueRebindAcceptance.js"))));
  app.get("/ProjectCostingCatalogueRebindAcceptance.css", async (_request, response) => response.type("text/css").send(await readFile(path.join(outputDirectory, "ProjectCostingCatalogueRebindAcceptance.css"))));
  app.get("*splat", (_request, response) => response.type("html").send('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ProjectCostingCatalogueRebindAcceptance.css"></head><body><div id="root"></div><script type="module" src="/ProjectCostingCatalogueRebindAcceptance.js"></script></body></html>'));
  server = createServer(app);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const profile = await controller.createProfile({ label: "project-costing-catalogue-rebind", debugPort });
  child = spawn(chromePath(), ["--headless=new", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", "--disable-extensions", "about:blank"], { stdio: "ignore" });
  controller.setRun({ child });
  await waitFor(async () => { try { return (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok; } catch { return false; } }, "Chrome unavailable");
  await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(`http://127.0.0.1:${port}`)}`, { method: "PUT" });
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const target = targets.find(item => item.type === "page" && item.url.includes(String(port)));
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
  let callId = 0;
  const pending = new Map();
  const diagnostics = [];
  const failedRequests = [];
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++callId; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  ws.addEventListener("message", event => {
    const message = JSON.parse(String(event.data));
    if (message.method === "Runtime.exceptionThrown") diagnostics.push(message.params?.exceptionDetails?.exception?.description ?? message.params?.exceptionDetails?.text);
    if (message.method === "Network.loadingFailed") failedRequests.push(message.params?.errorText ?? "request failed");
    if (message.method === "Page.javascriptDialogOpening") void send("Page.handleJavaScriptDialog", { accept: true });
    if (message.id && pending.has(message.id)) { const task = pending.get(message.id); pending.delete(message.id); message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result); }
  });
  const evaluate = async expression => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.value;
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Network.enable");
  try { await waitFor(() => evaluate("Boolean(document.querySelector('.project-costing'))"), "Project Costing did not render"); }
  catch (error) { console.error(JSON.stringify({ diagnostics, failedRequests, body: await evaluate("document.body.innerText") }, null, 2)); throw error; }
  await evaluate(`(()=>{const button=[...document.querySelectorAll('.costing-sheet__section-label')].find(node=>node.textContent.includes('Installation Materials'));button?.click();return Boolean(button)})()`);
  await waitFor(() => evaluate("Boolean(document.querySelector('.costing-sheet__materials-simple'))"), "Installation Materials did not open");
  const historicalText = await evaluate("document.body.innerText");
  assert(historicalText.includes("Saved historical catalogue snapshot"), "Historical snapshot state was not shown before adoption");
  assert(historicalText.includes("£120.00"), "Historical ME508 £120.00 total was not retained before adoption");
  const historicalSelects = await evaluate("document.querySelectorAll('.costing-sheet__materials-simple select').length");
  assert(historicalSelects === 0, "Historical catalogue values remained editable/selectable");
  const clicked = await evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(node=>node.textContent.includes('Use current Installation catalogue'));button?.click();return Boolean(button)})()`);
  assert(clicked, "Use current Installation catalogue action was unavailable");
  await waitFor(() => evaluate("document.body.innerText.includes('Current Administration catalogue snapshot')"), "Current catalogue response did not reach React");
  const state = await evaluate(`(()=>{const text=document.body.innerText;const selects=[...document.querySelectorAll('select')];const options=label=>{const node=selects.find(item=>item.getAttribute('aria-label')===label);return node?[...node.options].map(item=>item.textContent):[]};return{text,pageOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,me501:options('Illbruck ME501 External Membrane variant'),tp600:options('Illbruck TP600 Compriband variant'),materialStates:[...document.querySelectorAll('.costing-sheet__material-required')].map(node=>node.textContent.trim())}})()`);
  for (const expected of ["£1,713.30", "Illbruck FM330 PU Foam", "£101.64", "£16.16 / can configured · Applicability required", "Illbruck AA270 Foam Gun", "£67.02", "Illbruck AB005 Cutting Shears", "£20.22", "Current catalogue applied"]) assert(state.text.includes(expected), `Missing current-catalogue UI evidence: ${expected}`);
  for (const stale of ["Foam Gun Ultra", "tape accessory", "variant requires reference data", "Pro Foam Air Seal"]) assert(!state.text.includes(stale), `Legacy evidence remained active after adoption: ${stale}`);
  assert(state.me501.length === 5, `Expected ME501 placeholder plus four current variants, got ${state.me501.length}`);
  assert(state.tp600.length === 6, `Expected TP600 placeholder plus five current variants, got ${state.tp600.length}`);
  for (const option of ["100 mm × 25 m", "140 mm × 25 m", "200 mm × 25 m", "250 mm × 25 m"]) assert(state.me501.some(value => value.includes(option)), `Missing current ME501 option ${option}`);
  for (const option of ["3–7 mm joint · 8 m roll", "5–10 mm joint · 5.6 m roll", "7–15 mm joint · 3.3 m roll", "8–15 mm joint · 3.3 m roll", "9–18 mm joint · 6.5 m roll"]) assert(state.tp600.some(value => value.includes(option)), `Missing current TP600 option ${option}`);
  for (const price of ["£25.00", "£22.62", "£16.78", "£21.72", "£59.47"]) assert(state.tp600.some(value => value.includes(price)), `Missing current TP600 option price ${price}`);
  assert(!state.tp600.some(value => /TP601|variant requires reference data/i.test(value)), "Legacy TP600/TP601 option leaked into the current selector");
  assert(state.materialStates.length > 0 && state.materialStates.every(value => value === "Yes" || value === "No"), `Installation Materials duplicated its toggle state: ${state.materialStates.join(" | ")}`);
  assert(state.pageOverflow <= 1, `Project Costing overflowed by ${state.pageOverflow}px`);
  const classifiedSections = {};
  for (const [title, kind] of [["Extras", "extras"], ["Products / Supply Only", "products"], ["Survey / Site Visit", "siteVisit"]]) {
    await evaluate(`(()=>{const button=document.querySelector('.costing-sheet__section--${kind} .costing-sheet__section-label');button?.click();return Boolean(button)})()`);
    await new Promise(resolve => setTimeout(resolve, 100));
    classifiedSections[title] = await evaluate(`document.querySelector('.costing-sheet__section--${kind}')?.textContent??''`);
  }
  assert(classifiedSections.Extras.includes("External Aluminium Cills"), "Cills were not retained as the fixture Extra");
  for (const forbidden of ["Installation by ecoHaus", "On site Survey", "Timber/wood coupling profile"]) assert(!classifiedSections.Extras.includes(forbidden), `${forbidden} leaked into Extras`);
  assert(classifiedSections["Products / Supply Only"].includes("Timber/wood coupling profile"), "Coupling profile was not classified once with Products / Supply");
  if (!classifiedSections["Survey / Site Visit"]) console.error(JSON.stringify({ diagnostics, body: await evaluate("document.body.innerText") }, null, 2));
  assert(classifiedSections["Survey / Site Visit"].includes("Supplier survey") && classifiedSections["Survey / Site Visit"].includes("£967.71"), `Supplier survey was not isolated under Survey / Site Visit: ${classifiedSections["Survey / Site Visit"]}`);
  const openInstallation = async () => {
    await waitFor(() => evaluate("Boolean(document.querySelector('.project-costing'))"), "Project Costing did not render after navigation/reload");
    if (!await evaluate("Boolean(document.querySelector('input[aria-label^=\"Include supplier installation cost\"]'))")) {
      await evaluate(`(()=>{const button=[...document.querySelectorAll('.costing-sheet__section-label')].find(node=>node.textContent.includes('Installation')&&!node.textContent.includes('Materials'));button?.click();return Boolean(button)})()`);
    }
    await waitFor(() => evaluate("Boolean(document.querySelector('input[aria-label^=\"Include supplier installation cost\"]'))"), "Supplier installation choice did not render under Installation");
  };
  const purchaseTotal = () => evaluate("document.querySelector('.costing-sheet__purchase-total b')?.textContent??''");
  await openInstallation();
  await waitFor(() => evaluate("document.querySelector('select[aria-label=\"Installation Company\"]')?.value==='fixture-near-company'"), "Nearest Installation Company was not recommended by default");
  const installationUx = await evaluate(`(()=>{const section=document.querySelector('.costing-sheet__section--installation'),selector=section?.querySelector('select[aria-label="Installation Company"]'),materials=[...document.querySelectorAll('.costing-sheet__material-required')].map(node=>node.textContent.trim());return{sectionText:section?.innerText??'',selectedCompany:selector?.value??'',companyOptions:selector?[...selector.options].map(option=>option.textContent):[],tableTag:section?.querySelector('.costing-sheet__installation-table')?.tagName??'',headers:[...section?.querySelectorAll('.costing-sheet__installation-table thead th')??[]].map(node=>node.textContent),pageOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,materialStates:materials}})()`);
  assert(installationUx.sectionText.includes("Site postcode") && installationUx.sectionText.includes("KY4 8ER"), "Canonical project/site postcode is not visible in Section 6");
  assert(installationUx.selectedCompany === "fixture-near-company", "Nearest company was not the selected recommendation");
  assert(installationUx.companyOptions.some(value => value.includes("Dynafit Ltd") && value.includes("12.4 mi")), "Near-company route distance was not explained in the selector");
  assert(installationUx.companyOptions.some(value => value.includes("EcoGlaze Oxfordshire Ltd") && value.includes("351.7 mi")), "Far-company route distance was not explained in the selector");
  assert(installationUx.tableTag === "TABLE" && installationUx.headers.join("|") === "Description|Include|Basis / Quantity|Purchase Cost|Markup|Selling Price", "Section 6 did not use the canonical semantic commercial-table contract");
  await evaluate(`(()=>{const select=document.querySelector('select[aria-label="Installation Company"]');const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;setter.call(select,'fixture-far-company');select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  assert(await evaluate("document.querySelector('select[aria-label=\"Installation Company\"]')?.value==='fixture-far-company'"), "Manual Installation Company selection was unavailable");
  await evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(node=>node.textContent.trim()==='Advanced Installation');button.click();})()`);
  await waitFor(() => evaluate("Boolean(document.querySelector('.calculator-lab__installation-modal'))"), "Advanced Installation modal did not open");
  const advancedUx = await evaluate(`(()=>({groups:[...document.querySelectorAll('.calculator-lab__installation-modal legend')].map(node=>node.textContent),siteInput:Boolean(document.querySelector('.calculator-lab__installation-modal [name="sitePostcode"]')),companyInput:Boolean(document.querySelector('.calculator-lab__installation-modal [name="selectedCompanyId"]'))}))()`);
  assert(advancedUx.groups.join("|") === "Company / Team|Travel / Vehicles|Rates / Allowances|Survey / Support|Specialist Requirements", `Advanced Installation groups were inconsistent: ${advancedUx.groups.join(" | ")}`);
  assert(!advancedUx.siteInput && !advancedUx.companyInput, "Routine postcode/company controls remained inside Advanced Installation");
  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
  await waitFor(() => evaluate("!document.querySelector('.calculator-lab__installation-modal')"), "Escape did not close Advanced Installation");
  const supplierBefore = await evaluate(`(()=>{const extra=[...document.querySelectorAll('.costing-sheet__section')].find(node=>node.querySelector('.costing-sheet__section-label')?.textContent.includes('Extras'));const install=[...document.querySelectorAll('.costing-sheet__section')].find(node=>node.querySelector('.costing-sheet__section-label')?.textContent.includes('Installation')&&!node.querySelector('.costing-sheet__section-label')?.textContent.includes('Materials'));const input=document.querySelector('input[aria-label^="Include supplier installation cost"]');return{extra:extra?.innerText??'',installation:install?.innerText??'',checked:input?.checked??null}})()`);
  assert(!supplierBefore.extra.includes("Installation by ecoHaus"), "Supplier installation remained in Extras");
  assert(supplierBefore.installation.includes("Supplier quoted installation · available") && supplierBefore.installation.includes("ecoHaus") && supplierBefore.installation.includes("£10,939.15"), "Supplier installation evidence was not presented as a normal Section 6 commercial row");
  assert(supplierBefore.installation.includes("£4,450.00"), "Normal Ecofenster installation was not the initial active basis");
  assert(supplierBefore.checked === false, "A legacy package inclusion was mistaken for an explicit supplier-installation choice");
  const beforePurchaseTotal = await purchaseTotal();
  assert(beforePurchaseTotal === "£10,878.32", `Unexpected normal-basis purchase total ${beforePurchaseTotal}`);
  const optionsBeforeChoice = (await db.get("SELECT options_json FROM project_calculator_lab_options WHERE scenario_id=?", "installation-catalogue-rebind")).options_json;
  await evaluate(`document.querySelector('input[aria-label^="Include supplier installation cost"]')?.click()`);
  await waitFor(() => evaluate("document.querySelector('input[aria-label^=\"Include supplier installation cost\"]')?.checked===true"), "Supplier installation Yes did not persist");
  const selectedInstallationText = await evaluate(`([...document.querySelectorAll('.costing-sheet__section')].find(node=>node.querySelector('.costing-sheet__section-label')?.textContent.includes('Installation')&&!node.querySelector('.costing-sheet__section-label')?.textContent.includes('Materials'))?.innerText??'')`);
  assert(selectedInstallationText.includes("Supplier quoted installation · active substitute") && selectedInstallationText.includes("£10,939.15"), "Supplier installation did not become the active substitute");
  assert(!selectedInstallationText.includes("£15,314.81"), "The 40% Extras markup contaminated supplier installation");
  const yesPurchaseTotal = await purchaseTotal();
  assert(yesPurchaseTotal === "£17,367.47", `Unexpected supplier-basis purchase total ${yesPurchaseTotal}`);
  const persistedYes = await db.get("SELECT included_in_current_estimate,inclusion_evidence FROM project_calculator_estimate_supplier_costs WHERE id='installation-fixture-cost'");
  assert(persistedYes.included_in_current_estimate === 1 && persistedYes.inclusion_evidence === "supplier_installation:user_selected", "Yes was not saved as explicit supplier-installation evidence");
  await evaluate("window.__catalogueAcceptanceReloadMarker=true");
  await send("Page.reload", { ignoreCache: true });
  await waitFor(() => evaluate("window.__catalogueAcceptanceReloadMarker!==true"), "Yes-state reload did not complete");
  await openInstallation();
  assert(await evaluate("document.querySelector('input[aria-label^=\"Include supplier installation cost\"]')?.checked===true"), "Supplier installation Yes did not survive reload");
  assert(await purchaseTotal() === "£17,367.47", "Supplier installation total did not survive reload");
  await evaluate(`document.querySelector('input[aria-label^="Include supplier installation cost"]')?.click()`);
  await waitFor(() => evaluate("document.querySelector('input[aria-label^=\"Include supplier installation cost\"]')?.checked===false"), "Supplier installation No did not restore the normal path");
  const noPurchaseTotal = await purchaseTotal();
  assert(noPurchaseTotal === "£10,878.32", `Normal purchase total was not restored: ${noPurchaseTotal}`);
  assert((Number(yesPurchaseTotal.replace(/[^0-9.]/g, "")) - Number(noPurchaseTotal.replace(/[^0-9.]/g, ""))).toFixed(2) === "6489.15", "Supplier substitution delta was not £6,489.15");
  const persistedNo = await db.get("SELECT included_in_current_estimate,inclusion_evidence FROM project_calculator_estimate_supplier_costs WHERE id='installation-fixture-cost'");
  assert(persistedNo.included_in_current_estimate === 0 && persistedNo.inclusion_evidence === "supplier_installation:user_declined", "No was not saved as explicit supplier-installation evidence");
  assert((await db.get("SELECT options_json FROM project_calculator_lab_options WHERE scenario_id=?", "installation-catalogue-rebind")).options_json === optionsBeforeChoice, "Supplier choice overwrote the saved installation programme/options snapshot");
  await evaluate("window.__catalogueAcceptanceReloadMarker=true");
  await send("Page.reload", { ignoreCache: true });
  await waitFor(() => evaluate("window.__catalogueAcceptanceReloadMarker!==true"), "No-state reload did not complete");
  await openInstallation();
  assert(await evaluate("document.querySelector('input[aria-label^=\"Include supplier installation cost\"]')?.checked===false"), "Supplier installation No did not survive reload");
  assert(await purchaseTotal() === "£10,878.32", "Normal installation total did not survive reload");
  const requestCountBeforeGate = requests.filter(item => item.method === "PATCH" && item.path.includes("/supplier-costs/")).length;
  await evaluate("window.setFixtureMutationSafety(false,'runtime_mismatch')");
  await evaluate(`document.querySelector('input[aria-label^="Include supplier installation cost"]')?.click()`);
  await waitFor(() => evaluate("Boolean(document.querySelector('.costing-sheet__choice-error[role=\"alert\"]'))"), "Blocked supplier choice did not show local error feedback");
  const blockedError = await evaluate("document.querySelector('.costing-sheet__choice-error[role=\"alert\"]')?.textContent??''");
  assert(/temporarily paused/i.test(blockedError), `Unexpected mutation-gate message: ${blockedError}`);
  assert(requests.filter(item => item.method === "PATCH" && item.path.includes("/supplier-costs/")).length === requestCountBeforeGate, "Mutation gate issued a supplier-cost request");
  assert(await evaluate("document.querySelector('input[aria-label^=\"Include supplier installation cost\"]')?.checked===false"), "Blocked mutation changed the canonical toggle state");
  await evaluate("window.setFixtureMutationSafety(true,'connected')");
  const adoptionRequests = requests.filter(item => item.method === "POST" && item.path.endsWith("/installation-materials/use-current-catalogue"));
  assert(adoptionRequests.length === 1, `Expected one catalogue adoption request, got ${adoptionRequests.length}`);
  const [scenario, snapshots, revision, markups, optionsRow] = await Promise.all([
    db.get("SELECT revision_number FROM project_calculator_lab_scenarios WHERE id=?", "installation-catalogue-rebind"),
    db.all("SELECT scenario_revision,catalogue_json FROM project_calculator_lab_catalogue_snapshots WHERE scenario_id=? ORDER BY scenario_revision", "installation-catalogue-rebind"),
    db.get("SELECT reason FROM project_calculator_lab_revisions WHERE scenario_id=? AND version_number=2", "installation-catalogue-rebind"),
    db.get("SELECT materials_percent FROM project_calculator_lab_markup_rules WHERE scenario_id=?", "installation-catalogue-rebind"),
    db.get("SELECT options_json FROM project_calculator_lab_options WHERE scenario_id=?", "installation-catalogue-rebind"),
  ]);
  const currentOptions = JSON.parse(optionsRow.options_json).installationMaterials;
  const currentCalculation = currentOptions.calculationSnapshot.materials.find(item => item.code === "ME508");
  assert(scenario.revision_number === 4 && snapshots.length === 2, "Catalogue adoption plus supplier Installation Yes/No decisions did not create the expected bounded revision history");
  assert(JSON.parse(snapshots[0].catalogue_json).find(item => item.id === "me508_500540").priceAmount === "12", "Historical ME508 snapshot was rewritten");
  assert(JSON.parse(snapshots[1].catalogue_json).find(item => item.id === "me508_500540").priceAmount === "171.33", "Current ME508 price was not snapshotted");
  assert(currentCalculation.purchaseQuantity === 10 && currentCalculation.unitCost === "171.33" && currentCalculation.purchaseCost === "1713.30", "ME508 amended total did not recalculate to £1,713.30");
  assert(currentOptions.materialSelections.ME501.productId === null && currentOptions.materialSelections.TP600.productId === null, "Missing or ambiguous variants were guessed");
  assert(revision.reason === "installation_catalogue_current_values_applied", "Revision reason did not retain the explicit adoption boundary");
  assert(markups.materials_percent === "37", "Installation Materials markup was reset during catalogue adoption");
  assert(!diagnostics.length, `Browser diagnostics: ${diagnostics.join(" | ")}`);
  assert(!failedRequests.length, `Failed requests: ${failedRequests.join(" | ")}`);
  const supplierChoiceRequests = requests.filter(item => item.method === "PATCH" && item.path.includes("/supplier-costs/"));
  assert(supplierChoiceRequests.length === 2, `Expected supplier installation Yes/No requests, got ${supplierChoiceRequests.length}`);
  assert(JSON.stringify(supplierChoiceRequests.map(item => item.body)) === JSON.stringify([{ includedInCurrentEstimate: true }, { includedInCurrentEstimate: false }]), "Supplier choice request bodies were not the exact Yes/No decisions");
  console.log(JSON.stringify({ request: adoptionRequests[0], adoptionRevision: 2, finalFixtureRevision: scenario.revision_number, snapshots: snapshots.length, me508: currentCalculation, me501Options: state.me501.length - 1, tp600Options: state.tp600.length - 1, installationUx: { sitePostcode: "KY4 8ER", recommendedCompany: installationUx.selectedCompany, companyOptions: installationUx.companyOptions, semanticTable: installationUx.headers, manualSelection: true, advancedGroups: advancedUx.groups, routineControlsOutsideModal: true, materialToggleStates: state.materialStates }, supplierInstallation: { extrasLeak: false, defaultSelected: false, yesNoRequests: supplierChoiceRequests.length, beforePurchaseTotal, yesPurchaseTotal, noPurchaseTotal, delta: "6489.15", yesReloaded: true, noReloaded: true, explicitEvidence: [persistedYes.inclusion_evidence,persistedNo.inclusion_evidence], programmeOptionsPreserved: true, gateErrorVisible: blockedError, extrasMarkupContamination: false }, classifiedSections: { extras: ["External Aluminium Cills"], productsSupply: ["Timber/wood coupling profile"], survey: ["On site Survey or Virtual Survey"] }, markupPercent: markups.materials_percent, pageOverflow: state.pageOverflow, diagnostics }, null, 2));
} finally {
  try { ws?.close(); } catch {}
  await controller.stop("final");
  if (server) await new Promise(resolve => server.close(resolve));
  if (db) await db.close();
  await rm(outputDirectory, { recursive: true, force: true });
  await rm(databaseDirectory, { recursive: true, force: true });
}
