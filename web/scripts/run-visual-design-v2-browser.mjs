import { build } from "esbuild";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createBrowserRunController } from "./browser-run-lifecycle.mjs";
import { QUOTESUITE_RUNTIME_CONTRACT } from "../shared/runtimeHealthContract.js";

const root = path.resolve(".");
const outputDir = path.join(root, "_project", "Test", "Visual Design V2 Theme Laboratory", "screenshots");
const themes = ["quotesuite-v2-light", "quotesuite-v2-dark", "ecofenster-v2-light", "ecofenster-v2-dark", "zyle-v2-light", "zyle-v2-dark", "glassworx-v2-light", "glassworx-v2-dark", "current-light", "current-dark"];
const approvedV2Themes = themes.filter((theme) => theme.includes("-v2-"));
const viewports = [[1920, 1080], [1440, 900], [390, 844]];
const controller = createBrowserRunController({ throwOnLeak: true, processOptions: { platformName: process.platform } });
controller.installInterruptHandlers();

const allocatePort = async () => {
  const server = createNetServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (!port) throw new Error("Could not allocate a Visual Design V2 acceptance port.");
  return port;
};
const assert = (value, message) => { if (!value) throw new Error(message); };
const waitFor = async (fn, message, timeout = 30000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await fn().catch(() => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(message);
};
const chromePath = () => [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA ?? ""}\\Google\\Chrome\\Application\\chrome.exe`,
].find(Boolean);

const supplier = {
  supplierCode: "EKO-OKNA", supplierName: "EKO-OKNA", active: true,
  policy: { pricingBasis: "factory_price", pricingMethod: "factory_price", pricingPolicyVersion: 2, paidInQuotedCurrency: true, settlementCurrency: "GBP", discountPolicy: { type: "net", thresholdBasis: "manufacturer_list_gbp_before_discounts", stages: [], bands: [] }, packagePricingAvailable: false, packages: [], discountApplicationBasis: "selected_complete_package" },
  pricingDisplayPolicy: { positionPrices: "show", discountPresentation: "project_total", showOriginalTotal: true, showDiscountPercentage: true, showDiscountAmount: true, showNetTotal: true, showCategoryTotals: true, showOverallTotal: true },
};
const programme = (purchaseCost, distance) => ({
  programmeDays: 2, crewSize: 2,
  travel: { mode: distance > 100 ? "stay_away" : "daily_travel", recommendation: distance > 100 ? "Stay over" : "Daily travel", oneWayMiles: String(distance), oneWayDurationMinutes: distance > 100 ? 430 : 24, vehicleCount: 1, chargeableMiles: String(distance * 2), mileageRate: "0.55", cost: "0", finalReturnBy: "17:00", returnsBy2300: true },
  costs: { labour: "3000.00", mileage: "0.00", food: "200.00", accommodation: "0.00", support: "1000.00", survey: "0.00", cillInstallation: "250.00", liftingEquipment: "0.00", skipHire: "0.00", purchaseCost },
  allowances: { foodDays: 2, nights: 0, accommodationRooms: 0, supportDays: 1, surveyDays: 0, cillApplicableQuantity: 10, cillInstallationRate: "25.00" },
});

const tempDir = await mkdtemp(path.join(os.tmpdir(), "qs-visual-v2-"));
const port = await allocatePort();
const debugPort = await allocatePort();
let server;
let browser;
let socket;

try {
  await mkdir(outputDir, { recursive: true });
  await build({
    entryPoints: [path.join(root, "tests/fixtures/VisualDesignV2Acceptance.tsx")],
    bundle: true,
    format: "esm",
    platform: "browser",
    jsx: "automatic",
    outdir: tempDir,
    loader: { ".png": "dataurl", ".svg": "dataurl" },
    define: {
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify(`http://127.0.0.1:${port}`),
      "import.meta.env.DEV": "false",
      "import.meta.env.PROD": "true",
    },
  });

  server = createServer(async (request, response) => {
    const file = request.url === "/VisualDesignV2Acceptance.js" ? "VisualDesignV2Acceptance.js"
      : request.url === "/VisualDesignV2Acceptance.css" ? "VisualDesignV2Acceptance.css" : null;
    if (file) {
      response.writeHead(200, { "Content-Type": file.endsWith(".css") ? "text/css" : "text/javascript" });
      response.end(await readFile(path.join(tempDir, file)));
      return;
    }
    if (request.url === "/api/health") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ apiAvailable: true, databaseAvailable: true, runtimeFamily: QUOTESUITE_RUNTIME_CONTRACT.family, runtimeVersion: QUOTESUITE_RUNTIME_CONTRACT.version, runtimeIdentity: QUOTESUITE_RUNTIME_CONTRACT.identity, capabilities: [...QUOTESUITE_RUNTIME_CONTRACT.capabilities], startedAt: "2026-09-04T09:00:00Z" }));
      return;
    }
    if (request.url === "/api/admin/project-calculator-lab/supplier-commercial-defaults") {
      response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify([supplier])); return;
    }
    if (request.url === "/api/admin/project-calculator-lab/installation-workforce") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ companies: [{ id: "near-company", name: "Dynafit Ltd", address: {}, postcode: "EH1 1AA", dayRate: "350", active: true, version: 1 }], installers: [], teams: [{ id: "near-team", companyId: "near-company", companyName: "Dynafit Ltd", name: "Team North", normalCrewSize: 2, baseAddress: {}, basePostcode: "EH1 1AA", capabilities: ["standard_windows"], active: true, version: 1, installerIds: [] }], capabilities: ["standard_windows"] }));
      return;
    }
    if (request.url === "/api/admin/project-calculator-lab/scenarios/fixture/exchange-rate/live") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ rates: [{ currency: "EUR", targetCurrency: "GBP", rate: "0.86", provider: "fixture-live", quotedAt: "2026-09-04T09:00:00Z", checkedAt: "2026-09-04T09:00:00Z" }], refreshIntervalSeconds: 60 }));
      return;
    }
    if (request.url === "/api/integrations/googleMaps/geocode" && request.method === "POST") {
      let body = ""; for await (const chunk of request) body += chunk;
      const query = JSON.parse(body).query;
      response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify(query === "KY4 8ER" ? { lat: 56, lng: -3 } : { lat: 56.1, lng: -3.1 })); return;
    }
    if (request.url === "/api/integrations/googleMaps/route" && request.method === "POST") {
      response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ distanceKm: 19.96, durationMinutes: 24 })); return;
    }
    if (request.url === "/api/admin/project-calculator-lab/scenarios/fixture/installation-recommendations" && request.method === "POST") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ scenarioId: "fixture", selectedTeamId: null, recommendedTeamId: "near-team", recommendationReason: "Estimated lowest total installation cost", requiredCapabilities: ["standard_windows"], minimumCrew: 2, candidates: [{ id: "near-team", companyId: "near-company", companyName: "Dynafit Ltd", teamName: "Team North", crewSize: 2, status: "suitable", missingCapabilities: [], reason: "Suitable", route: { distanceMiles: 12.4, durationMinutes: 24, source: "google_maps", capturedAt: "2026-09-04" }, programme: programme("4450.00", 12.4) }] }));
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script>window.__QS_VISUAL_V2_ACCEPTANCE__=true</script><link rel="stylesheet" href="/VisualDesignV2Acceptance.css"></head><body><div id="root"></div><script type="module" src="/VisualDesignV2Acceptance.js"></script></body></html>');
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));

  const profile = await controller.createProfile({ label: "visual-design-v2", debugPort });
  browser = spawn(chromePath(), ["--headless=new", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", "--disable-extensions", "about:blank"], { stdio: "ignore" });
  controller.setRun({ child: browser });
  await waitFor(async () => { try { return (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok; } catch { return false; } }, "Owned Chrome did not expose CDP.");
  await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(`http://127.0.0.1:${port}`)}`, { method: "PUT" });
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const target = targets.find((item) => item.type === "page" && item.url.includes(String(port)));
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let sequence = 0;
  const pending = new Map();
  const diagnostics = [];
  const failedRequests = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method === "Runtime.exceptionThrown") diagnostics.push(message.params?.exceptionDetails?.exception?.description ?? message.params?.exceptionDetails?.text);
    if (message.method === "Network.responseReceived" && message.params.response.status >= 400) failedRequests.push(`${message.params.response.status} ${message.params.response.url}`);
    if (message.id && pending.has(message.id)) { const task = pending.get(message.id); pending.delete(message.id); message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.value;
  await send("Runtime.enable"); await send("Network.enable"); await send("Page.enable");
  await waitFor(() => evaluate("Boolean(document.querySelector('.project-costing') && document.querySelector('[data-testid=visual-theme-lab]'))"), "Real Project Costing and Theme Lab did not render.").catch(async (error) => {
    throw new Error(`${error.message} body=${await evaluate("document.body.innerText.slice(0,2000)")} diagnostics=${diagnostics.join(" | ")} failed=${failedRequests.join(" | ")}`);
  });
  await waitFor(() => evaluate("document.body.innerText.includes('Supplier / Product Defaults')"), "Real Administration supplier defaults did not load.");

  const clickTheme = async (theme) => {
    let clicked = await evaluate(`(()=>{const lab=document.querySelector('[data-testid="visual-theme-lab"]');lab.open=true;const button=lab.querySelector('[data-theme-id=${JSON.stringify(theme)}]');button?.click();return Boolean(button)})()`);
    if (!clicked && theme.includes("-v2-")) {
      const requestedAppearance = theme.endsWith("-dark") ? "dark" : "light";
      const currentAppearance = await evaluate("document.documentElement.dataset.qsV2Appearance ?? document.documentElement.dataset.qsTheme");
      if (currentAppearance !== requestedAppearance) {
        await evaluate("document.querySelector('.theme-selector')?.click()");
        await waitFor(() => evaluate(`(document.documentElement.dataset.qsV2Appearance ?? document.documentElement.dataset.qsTheme)===${JSON.stringify(requestedAppearance)}`), `Appearance did not switch to ${requestedAppearance}.`);
      }
      clicked = await evaluate(`(()=>{const lab=document.querySelector('[data-testid="visual-theme-lab"]');lab.open=true;const button=lab.querySelector('[data-theme-id=${JSON.stringify(theme)}]');button?.click();return Boolean(button)})()`);
    }
    assert(clicked, `Theme selector option unavailable: ${theme}`);
    await waitFor(() => evaluate(`document.documentElement.dataset.qsV2Theme===${JSON.stringify(theme)} || (${JSON.stringify(theme)}.startsWith('current-') && !document.documentElement.dataset.qsDesign)`), `Theme did not apply: ${theme}`);
  };
  const screenshot = async (name) => {
    const capture = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(path.join(outputDir, name), Buffer.from(capture.data, "base64"));
  };
  const openCostingSection = async (label) => {
    const opened = await evaluate(`(()=>{const node=[...document.querySelectorAll('.costing-sheet__section-label')].find(item=>item.textContent.includes(${JSON.stringify(label)})&&!item.textContent.includes('Materials'));const section=node?.closest('.costing-sheet__section');if(section&&!section.classList.contains('costing-sheet__section--open'))node.click();return Boolean(section)})()`);
    assert(opened, `Costing section unavailable: ${label}`);
    await waitFor(() => evaluate(`Boolean([...document.querySelectorAll('.costing-sheet__section-label')].find(item=>item.textContent.includes(${JSON.stringify(label)})&&!item.textContent.includes('Materials'))?.closest('.costing-sheet__section')?.classList.contains('costing-sheet__section--open'))`), `Costing section did not open: ${label}`);
  };
  const detailProbe = async (scopeSelector, label, width, height) => {
    const state = await evaluate(`(()=>{
      const root=document.documentElement,shell=document.querySelector('.app-shell'),main=document.querySelector('.app-shell__main'),scope=document.querySelector(${JSON.stringify(scopeSelector)});
      if(!scope)return {missing:true};
      const visible=node=>{const box=node.getBoundingClientRect(),style=getComputedStyle(node);return box.width>0&&box.height>0&&box.bottom>0&&box.top<innerHeight&&box.right>0&&box.left<innerWidth&&style.visibility!=='hidden'&&style.display!=='none'&&Number(style.opacity)!==0};
      const controls=[...scope.querySelectorAll('button,input:not([type=checkbox]):not([type=radio]),select,textarea')].filter(visible);
      let controlOverlapCount=0;const controlOverlaps=[];for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){const a=controls[i],b=controls[j];if(a.contains(b)||b.contains(a))continue;const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>1&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>1){controlOverlapCount++;if(controlOverlaps.length<5)controlOverlaps.push([(a.getAttribute('aria-label')||a.textContent||a.tagName).trim().slice(0,40),(b.getAttribute('aria-label')||b.textContent||b.tagName).trim().slice(0,40)])}}
      const supporting=[...scope.querySelectorAll('small,p,.ui-field__helper')].filter(visible);const supportingSizes=supporting.map(node=>Number.parseFloat(getComputedStyle(node).fontSize)).filter(Number.isFinite);
      return {missing:false,label:${JSON.stringify(label)},width:${width},height:${height},pageOverflow:root.scrollWidth-root.clientWidth,shellOverflow:shell.scrollWidth-shell.clientWidth,mainOverflow:main.scrollWidth-main.clientWidth,scopeOverflow:scope.scrollWidth-scope.clientWidth,controlOverlapCount,controlOverlaps,minSupportingTextPx:supportingSizes.length?Math.min(...supportingSizes):null,visibleControlCount:controls.length,visibleSupportingTextCount:supporting.length};
    })()`);
    assert(!state.missing, `${label} did not render.`);
    assert(state.pageOverflow <= 1 && state.shellOverflow <= 1 && state.mainOverflow <= 1, `${label} ${width}: shell overflow ${JSON.stringify(state)}`);
    assert(state.controlOverlapCount === 0, `${label} ${width}: visible controls collide ${JSON.stringify(state.controlOverlaps)}`);
    assert(state.minSupportingTextPx == null || state.minSupportingTextPx >= 12, `${label} ${width}: supporting text is ${state.minSupportingTextPx}px`);
    return state;
  };

  // Expose the real Products / Supply and Installation surfaces before comparison.
  await evaluate(`(()=>{for(const label of ['Products / Supply','Installation']){const node=[...document.querySelectorAll('.costing-sheet__section-label')].find(item=>item.textContent.includes(label)&&!item.textContent.includes('Materials'));if(node&&!node.closest('.costing-sheet__section')?.classList.contains('costing-sheet__section--open'))node.click()}return true})()`);

  const results = [];
  for (const theme of themes) {
    await clickTheme(theme);
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await evaluate("window.scrollTo(0,0);document.querySelector('.app-shell__main').scrollTo(0,0)");
    await screenshot(`${theme}--app-navigation--1440x900.png`);
    for (const [width, height] of viewports) {
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
      await evaluate(`(()=>{const main=document.querySelector('.app-shell__main');main.scrollTo(0,0);document.querySelector('[data-visual-lab-screen=project-costing]').scrollIntoView({block:'start',inline:'start'});for(const node of document.querySelectorAll('*'))if(node.scrollWidth>node.clientWidth)node.scrollLeft=0;return true})()`);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const state = await evaluate(`(()=>{
        const root=document.documentElement,shell=document.querySelector('.app-shell'),main=document.querySelector('.app-shell__main');
        const probe=document.createElement('span');probe.style.cssText='position:fixed;color:var(--qs-theme-text);background:var(--qs-theme-surface)';document.body.append(probe);const probeStyle=getComputedStyle(probe);
        const rgb=value=>{const m=value.match(/[\\d.]+/g)?.slice(0,3).map(Number);return m?.length===3?m:null};
        const luminance=value=>{const channels=rgb(value);if(!channels)return null;return channels.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,index)=>sum+v*[.2126,.7152,.0722][index],0)};
        const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return x==null||y==null?null:(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
        const text=probeStyle.color,panel=probeStyle.backgroundColor;probe.style.color='var(--qs-theme-text-muted)';const muted=getComputedStyle(probe).color;probe.remove();
        const controls=[...document.querySelectorAll('button,input:not([type=checkbox]):not([type=radio]),select,textarea')].filter(node=>{const box=node.getBoundingClientRect(),s=getComputedStyle(node);return !node.closest('details:not([open])')&&box.width>0&&box.height>0&&box.bottom>0&&box.top<innerHeight&&box.right>0&&box.left<innerWidth&&s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity)!==0});
        let controlOverlapCount=0;const controlOverlaps=[];for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){const a=controls[i],b=controls[j];if(a.contains(b)||b.contains(a))continue;const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>1&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>1){controlOverlapCount++;if(controlOverlaps.length<5)controlOverlaps.push([(a.className||a.tagName)+':'+a.textContent?.trim().slice(0,24),(b.className||b.tagName)+':'+b.textContent?.trim().slice(0,24)])}}
        const headlineMetrics=[...document.querySelectorAll('.project-costing__headline-metrics>span')].filter(node=>{const box=node.getBoundingClientRect();return box.width>0&&box.height>0});
        const worksheet=document.querySelector('.project-costing__worksheet-header'),section=document.querySelector('.costing-sheet__section'),shellBox=shell.getBoundingClientRect(),lockup=document.querySelector('[data-testid=brand-lockup]');
        const visibleLogoAssets=[...lockup.querySelectorAll('.quotesync-logo__asset')].filter(node=>{const box=node.getBoundingClientRect(),style=getComputedStyle(node);return box.width>0&&box.height>0&&style.display!=='none'&&style.visibility!=='hidden'});
        const platformAssets=visibleLogoAssets.filter(node=>node.closest('[data-logo-role=platform]')),companyAssets=visibleLogoAssets.filter(node=>node.closest('[data-logo-role=company]'));
        const platformBox=platformAssets[0]?.getBoundingClientRect(),companyBox=companyAssets[0]?.getBoundingClientRect();
        return {theme:${JSON.stringify(theme)},width:${width},height:${height},design:root.dataset.qsDesign??'current',brand:root.dataset.qsV2Brand??'current',appearance:root.dataset.qsV2Appearance??root.dataset.qsTheme,pageOverflow:root.scrollWidth-root.clientWidth,shellOverflow:shell.scrollWidth-shell.clientWidth,mainOverflow:main.scrollWidth-main.clientWidth,textContrast:contrast(text,panel),mutedContrast:contrast(muted,panel),fx:[...document.querySelectorAll('.project-costing__fx-rate')].map(node=>node.innerText),labVisible:Boolean(document.querySelector('[data-testid=visual-theme-lab]')),controlOverlapCount,controlOverlaps,headlineMetricCount:headlineMetrics.length,shellInset:innerWidth-shellBox.width,worksheetBackground:worksheet?getComputedStyle(worksheet).backgroundImage:'none',worksheetGrid:worksheet?getComputedStyle(worksheet).gridTemplateAreas:'none',sectionShadow:section?getComputedStyle(section).boxShadow:'none',sectionRadius:section?getComputedStyle(section).borderRadius:'none',platformLogoCount:platformAssets.length,companyLogoCount:companyAssets.length,companyLogoClasses:companyAssets.map(node=>node.className),logoOverlap:Boolean(platformBox&&companyBox&&Math.min(platformBox.right,companyBox.right)-Math.max(platformBox.left,companyBox.left)>0&&Math.min(platformBox.bottom,companyBox.bottom)-Math.max(platformBox.top,companyBox.top)>0),logoOrder:platformBox&&companyBox?platformBox.right<=companyBox.left:null};
      })()`);
      assert(state.pageOverflow <= 1 && state.shellOverflow <= 1 && state.mainOverflow <= 1, `${theme} ${width}: horizontal overflow ${JSON.stringify(state)}`);
      assert(state.textContrast >= 4.5, `${theme} ${width}: primary text contrast is ${state.textContrast}`);
      assert(state.mutedContrast >= 4.5, `${theme} ${width}: supporting text contrast is ${state.mutedContrast}`);
      assert(state.controlOverlapCount === 0, `${theme} ${width}: ${state.controlOverlapCount} visible control overlaps detected: ${JSON.stringify(state.controlOverlaps)}`);
      assert(state.fx.length === 2 && state.fx.some((value) => value.toLowerCase().includes("estimate rate")) && state.fx.some((value) => value.toLowerCase().includes("live rate")), `${theme} ${width}: FX controls are not independently visible. ${JSON.stringify(state.fx)}`);
      assert(state.labVisible, `${theme} ${width}: Theme Lab control is not available.`);
      if (approvedV2Themes.includes(theme)) {
        assert(state.headlineMetricCount === 4, `${theme} ${width}: headline commercial hierarchy is incomplete.`);
        assert(state.worksheetBackground !== "none", `${theme} ${width}: layered worksheet background is missing.`);
        assert(state.sectionShadow !== "none", `${theme} ${width}: nested costing-card elevation is missing.`);
        assert(Math.abs(state.shellInset) <= 1, `${theme} ${width}: QuoteSuite no longer occupies the full-width canvas.`);
        assert(state.platformLogoCount === 1, `${theme} ${width}: expected one visible QuoteSuite platform logo, got ${state.platformLogoCount}.`);
        const isQuoteSuiteBrand = theme.startsWith("quotesuite-");
        assert(state.companyLogoCount === (isQuoteSuiteBrand ? 0 : 1), `${theme} ${width}: company logo count is ${state.companyLogoCount}.`);
        assert(!state.logoOverlap && (isQuoteSuiteBrand || state.logoOrder), `${theme} ${width}: platform/company logo lockup overlaps or is reversed.`);
        if (theme.startsWith("zyle-")) assert(state.companyLogoClasses.every((value) => value.includes("--zyle")), `${theme}: a non-Zyle company logo is visible.`);
        if (theme.startsWith("glassworx-")) assert(state.companyLogoClasses.every((value) => value.includes("--glassworx")), `${theme}: a non-GlassWorx company logo is visible.`);
        if (theme.startsWith("ecofenster-")) assert(state.companyLogoClasses.every((value) => value.includes("--ecofenster")), `${theme}: a non-Ecofenster company logo is visible.`);
      } else {
        assert(state.headlineMetricCount === 0, `${theme} ${width}: V2 component system leaked into a legacy theme.`);
      }
      const size = `${width}x${height}`;
      await screenshot(`${theme}--project-costing--${size}.png`);
      await evaluate("document.querySelector('[data-visual-lab-screen=administration]').scrollIntoView({block:'start'})");
      await new Promise((resolve) => setTimeout(resolve, 80));
      await screenshot(`${theme}--administration--${size}.png`);
      results.push(state);
    }
  }

  for (const [width] of viewports) {
    const brandStates = results.filter((state) => state.width === width && approvedV2Themes.includes(state.theme));
    assert(brandStates.length === approvedV2Themes.length, `${width}: comparable V2 brand states are incomplete.`);
    const geometry = brandStates.map(({ headlineMetricCount, worksheetGrid, sectionRadius }) => JSON.stringify({ headlineMetricCount, worksheetGrid, sectionRadius }));
    assert(new Set(geometry).size === 1, `${width}: brand switching changed V2 component geometry: ${geometry.join(" | ")}`);
  }

  // Interaction colours are part of the component contract, not a static-theme
  // screenshot detail. Exercise the deliberately opposite active and inactive
  // hover directions through real pointer, keyboard, pressed, selected,
  // disabled and destructive states for every V2 brand.
  const interactionResults = [];
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  for (const theme of approvedV2Themes) {
    await clickTheme(theme);
    await openCostingSection("Products / Supply");
    await evaluate(`(()=>{[...document.querySelectorAll('[role=tab]')].find(node=>node.textContent.trim()==='Suppliers')?.click();return true})()`);
    await waitFor(() => evaluate("Boolean(document.querySelector('.admin-supplier-list .ui-button--danger'))"), `${theme}: real Admin destructive action did not render.`);
    const probesReady = await evaluate(`(()=>{window.scrollTo(0,0);document.querySelector('.app-shell__main').scrollTo(0,0);const primary=[...document.querySelectorAll('button')].find(node=>node.textContent.trim()==='Review Customer Quotation');const secondary=[...document.querySelectorAll('button')].find(node=>node.textContent.trim()==='Files / Documents');const destructive=document.querySelector('.ui-button--danger, .costing-sheet__position-actions .ui-button:last-child');if(!primary||!secondary||!destructive)return false;primary.dataset.v2InteractionProbe='primary';secondary.dataset.v2InteractionProbe='secondary';destructive.dataset.v2InteractionProbe='destructive';return true})()`);
    assert(probesReady, `${theme}: real active, inactive and destructive action probes were not all available.`);
    const snapshot = async (selector) => evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)}),style=getComputedStyle(node);return {color:style.color,backgroundColor:style.backgroundColor,backgroundImage:style.backgroundImage,borderColor:style.borderColor,outlineColor:style.outlineColor,outlineStyle:style.outlineStyle,outlineWidth:style.outlineWidth,boxShadow:style.boxShadow,opacity:Number(style.opacity),hover:node.matches(':hover'),focus:node.matches(':focus'),focusVisible:node.matches(':focus-visible'),active:node.matches(':active'),disabled:node.matches(':disabled')}})()`);
    const expected = await evaluate(`(()=>{const root=getComputedStyle(document.documentElement),probe=document.createElement('i');probe.style.cssText='position:fixed;pointer-events:none';document.body.append(probe);const resolve=value=>{probe.style.color=value;return getComputedStyle(probe).color};const parse=value=>{let match=value.match(/^rgba?\\(([^)]+)\\)$/i);if(match)return match[1].split(/[ ,/]+/).slice(0,3).map(Number);match=value.match(/^color\\(srgb\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)/i);return match?match.slice(1,4).map(part=>Number(part)*255):null};const lum=value=>{const channels=parse(value);if(!channels)return null;return channels.map(channel=>{const ratio=channel/255;return ratio<=.04045?ratio/12.92:((ratio+.055)/1.055)**2.4}).reduce((sum,channel,index)=>sum+channel*[.2126,.7152,.0722][index],0)};const contrast=(a,b)=>{const x=lum(a),y=lum(b);return x==null||y==null?null:(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};const color=name=>resolve('var('+name+')'),onBrand=color('--qs-v2-interaction-on-brand'),onDark=color('--qs-v2-interaction-on-dark'),onNeutral=color('--qs-v2-interaction-on-neutral'),brand=color('--qs-v2-proof-brand'),brandMid=color('--qs-v2-proof-brand-mid'),darkStart=color('--qs-v2-interaction-dark-hover-start'),darkEnd=color('--qs-v2-interaction-dark-hover-end'),panel=color('--qs-v2-proof-panel'),focusIndicator=color('--qs-v2-focus-indicator'),error=color('--qs-semantic-error');probe.remove();return {onBrand,onDark,onNeutral,brand,brandMid,darkStart,darkEnd,panel,focusIndicator,error,brandFillContrast:Math.min(contrast(onBrand,brand),contrast(onBrand,brandMid)),activeHoverContrast:Math.min(contrast(onDark,darkStart),contrast(onDark,darkEnd)),focusIndicatorContrast:contrast(focusIndicator,panel)} })()`);
    for (const [name, value] of Object.entries({ brandFillContrast: expected.brandFillContrast, activeHoverContrast: expected.activeHoverContrast })) assert(value >= 4.5, `${theme}: ${name} is ${value}`);
    assert(expected.focusIndicatorContrast >= 3, `${theme}: focusIndicatorContrast is ${expected.focusIndicatorContrast}`);
    if (theme === "zyle-v2-dark") assert(expected.brand === "rgb(255, 175, 61)", `Zyle primary is not #FFAF3D: ${expected.brand}`);

    await evaluate("document.activeElement instanceof HTMLElement && document.activeElement.blur()");
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1 });
    await new Promise((resolve) => setTimeout(resolve, 320));
    const normal = await snapshot('[data-v2-interaction-probe="primary"]');
    assert(normal.color === expected.onBrand, `${theme}: normal primary foreground ${normal.color} does not match ${expected.onBrand}`);
    await screenshot(`${theme}--primary-action-normal--1440x900.png`);
    const box = await evaluate(`(()=>{const box=document.querySelector('[data-v2-interaction-probe="primary"]').getBoundingClientRect();return {x:box.left+box.width/2,y:box.top+box.height/2}})()`);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
    await new Promise((resolve) => setTimeout(resolve, 320));
    const hover = await snapshot('[data-v2-interaction-probe="primary"]');
    assert(hover.hover && hover.color === expected.onDark, `${theme}: hovered primary is not paired with its light-on-dark foreground: ${JSON.stringify(hover)}`);
    await screenshot(`${theme}--primary-action-hover--1440x900.png`);

    await evaluate("document.activeElement instanceof HTMLElement && document.activeElement.blur()");
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1 });
    await evaluate("document.querySelector('[data-v2-interaction-probe=primary]').focus()");
    await new Promise((resolve) => setTimeout(resolve, 320));
    const focus = await snapshot('[data-v2-interaction-probe="primary"]');
    assert(focus.focus && focus.focusVisible && focus.outlineStyle !== "none" && focus.color === expected.onBrand, `${theme}: focus-visible pairing is incomplete: ${JSON.stringify(focus)}`);

    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
    await new Promise((resolve) => setTimeout(resolve, 320));
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1 });
    const active = await snapshot('[data-v2-interaction-probe="primary"]');
    assert(active.active && active.color === expected.onDark, `${theme}: pressed primary pairing is incomplete: ${JSON.stringify(active)}`);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 1, y: 1, button: "left", clickCount: 1 });
    await new Promise((resolve) => setTimeout(resolve, 320));

    const disabled = await evaluate(`(()=>{const read=name=>{const node=document.querySelector('[data-v2-interaction-probe='+name+']');node.disabled=true;const style=getComputedStyle(node),result={color:style.color,backgroundImage:style.backgroundImage,opacity:Number(style.opacity),disabled:node.matches(':disabled')};node.disabled=false;return result};return {primary:read('primary'),secondary:read('secondary')}})()`);
    assert(disabled.primary.disabled && disabled.primary.opacity < 1 && disabled.primary.color === expected.onBrand && disabled.secondary.disabled && disabled.secondary.opacity < 1 && disabled.secondary.color === expected.onNeutral, `${theme}: disabled action pairing is incomplete: ${JSON.stringify(disabled)}`);

    await evaluate("document.activeElement instanceof HTMLElement && document.activeElement.blur()");
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1 });
    await new Promise((resolve) => setTimeout(resolve, 320));
    const secondaryNormal = await snapshot('[data-v2-interaction-probe="secondary"]');
    assert(secondaryNormal.color === expected.onNeutral, `${theme}: inactive normal foreground is not neutral: ${JSON.stringify(secondaryNormal)}`);
    await screenshot(`${theme}--inactive-action-normal--1440x900.png`);
    const secondaryBox = await evaluate(`(()=>{const box=document.querySelector('[data-v2-interaction-probe="secondary"]').getBoundingClientRect();return {x:box.left+box.width/2,y:box.top+box.height/2}})()`);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: secondaryBox.x, y: secondaryBox.y });
    await new Promise((resolve) => setTimeout(resolve, 320));
    const secondaryHover = await snapshot('[data-v2-interaction-probe="secondary"]');
    assert(secondaryHover.hover && secondaryHover.color === expected.onBrand && secondaryHover.backgroundImage !== secondaryNormal.backgroundImage, `${theme}: inactive hover did not promote to the brand surface: ${JSON.stringify(secondaryHover)}`);
    await screenshot(`${theme}--inactive-action-hover--1440x900.png`);

    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: secondaryBox.x, y: secondaryBox.y, button: "left", clickCount: 1 });
    const secondaryPressed = await snapshot('[data-v2-interaction-probe="secondary"]');
    assert(secondaryPressed.active && secondaryPressed.color === expected.onBrand, `${theme}: inactive pressed state lost its brand pairing: ${JSON.stringify(secondaryPressed)}`);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 1, y: 1, button: "left", clickCount: 1 });
    await evaluate("[...document.querySelectorAll('button')].find(node=>node.textContent.trim()==='Create Revision').focus()");
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await new Promise((resolve) => setTimeout(resolve, 320));
    const secondaryFocus = await snapshot('[data-v2-interaction-probe="secondary"]');
    assert(secondaryFocus.focusVisible && secondaryFocus.outlineStyle !== "none" && secondaryFocus.color === expected.onNeutral, `${theme}: inactive focus-visible state is incomplete: ${JSON.stringify(secondaryFocus)}`);

    const selectedNavigation = await snapshot('.app-shell__nav-button[data-state="active"]');
    assert(selectedNavigation.color === expected.onBrand, `${theme}: selected navigation foreground ${selectedNavigation.color} does not match ${expected.onBrand}`);
    const selectedNavigationBox = await evaluate(`(()=>{const box=document.querySelector('.app-shell__nav-button[data-state="active"]').getBoundingClientRect();return {x:box.left+box.width/2,y:box.top+box.height/2}})()`);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: selectedNavigationBox.x, y: selectedNavigationBox.y });
    await new Promise((resolve) => setTimeout(resolve, 320));
    const selectedNavigationHover = await snapshot('.app-shell__nav-button[data-state="active"]');
    assert(selectedNavigationHover.hover && selectedNavigationHover.color === expected.onDark, `${theme}: active navigation did not invert on hover: ${JSON.stringify(selectedNavigationHover)}`);

    const inactiveNavigationSelector = '.app-shell__nav-button:not([data-state="active"])';
    const inactiveNavigationBox = await evaluate(`(()=>{const box=document.querySelector(${JSON.stringify(inactiveNavigationSelector)}).getBoundingClientRect();return {x:box.left+box.width/2,y:box.top+box.height/2}})()`);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: inactiveNavigationBox.x, y: inactiveNavigationBox.y });
    await new Promise((resolve) => setTimeout(resolve, 320));
    const inactiveNavigationHover = await snapshot(inactiveNavigationSelector);
    assert(inactiveNavigationHover.hover && inactiveNavigationHover.color === expected.onBrand, `${theme}: inactive navigation did not promote on hover: ${JSON.stringify(inactiveNavigationHover)}`);

    await evaluate("document.querySelector('[data-v2-interaction-probe=destructive]').scrollIntoView({block:'center'})");
    const destructiveNormal = await snapshot('[data-v2-interaction-probe="destructive"]');
    const destructiveBox = await evaluate(`(()=>{const box=document.querySelector('[data-v2-interaction-probe="destructive"]').getBoundingClientRect();return {x:box.left+box.width/2,y:box.top+box.height/2}})()`);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: destructiveBox.x, y: destructiveBox.y });
    await new Promise((resolve) => setTimeout(resolve, 320));
    const destructiveHover = await snapshot('[data-v2-interaction-probe="destructive"]');
    assert(destructiveHover.hover && destructiveHover.color === destructiveNormal.color && destructiveHover.color !== expected.onBrand && destructiveHover.boxShadow === "none", `${theme}: destructive action leaked into the brand hover treatment: ${JSON.stringify(destructiveHover)}`);

    interactionResults.push({ theme, expected, normal, hover, focus, active, disabled, secondaryNormal, secondaryHover, secondaryFocus, secondaryPressed, selectedNavigation, selectedNavigationHover, inactiveNavigationHover, destructiveNormal, destructiveHover });
  }
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1 });

  // Prove the selection is reversible rather than merely changing palette text.
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await clickTheme("ecofenster-v2-dark");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.querySelector('.project-costing__worksheet-header').scrollIntoView({block:'start'});");
  await new Promise((resolve) => setTimeout(resolve, 100));
  await screenshot("ecofenster-v2-dark--project-costing-detail--390x844.png");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.querySelector('.costing-sheet__summary').scrollIntoView({block:'start'});");
  await new Promise((resolve) => setTimeout(resolve, 100));
  await screenshot("ecofenster-v2-dark--commercial-summary--1440x900.png");
  await evaluate("document.querySelector('[data-visual-lab-screen=project-costing]').scrollIntoView({block:'start'});");
  await evaluate("window.scrollTo(0,0);document.querySelector('.app-shell__main').scrollTo(0,0);document.querySelector('[data-testid=visual-theme-lab]').open=true");
  await screenshot("ecofenster-v2-dark--theme-lab-selector--1440x900.png");
  await clickTheme("current-light");
  const restored = await evaluate(`({design:document.documentElement.dataset.qsDesign??null,theme:document.documentElement.dataset.qsTheme,storedLab:localStorage.getItem('quotesync:visualDesignV2Lab')})`);
  assert(restored.design === null && restored.theme === "light" && restored.storedLab === "current-light", `Legacy fallback restoration failed: ${JSON.stringify(restored)}`);

  // Exercise real Admin tabs/table/form and the real Advanced Installation modal.
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await clickTheme("ecofenster-v2-dark");
  await evaluate(`(()=>{document.querySelector('[data-visual-lab-screen=administration]').scrollIntoView({block:'start'});[...document.querySelectorAll('[role=tab]')].find(node=>node.textContent==='Suppliers')?.click();return true})()`);
  await waitFor(() => evaluate("Boolean(document.querySelector('.admin-supplier-list table'))"), "Supplier Admin table did not render.");
  await evaluate("document.querySelector('button[aria-label=\"Edit EKO-OKNA\"]')?.click()");
  await waitFor(() => evaluate("Boolean(document.querySelector('.admin-supplier-editor'))"), "Supplier Admin form did not render.");
  await screenshot("ecofenster-v2-dark--admin-table-form--1440x900.png");
  await evaluate(`(()=>{document.querySelector('[data-visual-lab-screen=project-costing]').scrollIntoView({block:'start'});const installation=document.querySelector('.costing-sheet__section--installation');if(!installation?.classList.contains('costing-sheet__section--open'))installation?.querySelector('.costing-sheet__section-label')?.click();return true})()`);
  await waitFor(() => evaluate("Boolean([...document.querySelectorAll('button')].find(node=>node.textContent.includes('Advanced Installation')))"), "Advanced Installation control did not render.");
  await evaluate("[...document.querySelectorAll('button')].find(node=>node.textContent.includes('Advanced Installation'))?.click()");
  await waitFor(() => evaluate("Boolean(document.querySelector('.calculator-lab__installation-modal'))"), "Advanced Installation modal did not render.");
  await screenshot("ecofenster-v2-dark--advanced-installation-modal--1440x900.png");
  await evaluate(`(()=>{const modal=document.querySelector('.calculator-lab__installation-modal');[...modal.querySelectorAll('button')].find(node=>node.textContent.trim()==='Close')?.click();return true})()`);
  await waitFor(() => evaluate("!document.querySelector('.calculator-lab__installation-modal')"), "Advanced Installation modal did not close.");

  // Detailed shared V2 proof: equivalent real dense components for every brand and appearance.
  const detailResults = [];
  for (const theme of approvedV2Themes) {
    await clickTheme(theme);
    for (const [width, height] of viewports) {
      const size = `${width}x${height}`;
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });

      await openCostingSection("Products / Supply");
      await evaluate("document.querySelector('.costing-sheet__section--products').scrollIntoView({block:'start'});");
      await new Promise((resolve) => setTimeout(resolve, 100));
      detailResults.push({ theme, ...await detailProbe(".costing-sheet__section--products", "Expanded Products / Supply", width, height) });
      await screenshot(`${theme}--expanded-products--${size}.png`);

      await openCostingSection("Installation");
      await waitFor(() => evaluate("Boolean(document.querySelector('.costing-sheet__installation-context'))"), "Expanded Installation content did not render.");
      await evaluate("document.querySelector('.costing-sheet__section--installation').scrollIntoView({block:'start'});");
      await new Promise((resolve) => setTimeout(resolve, 140));
      detailResults.push({ theme, ...await detailProbe(".costing-sheet__section--installation", "Expanded Installation", width, height) });
      await screenshot(`${theme}--expanded-installation--${size}.png`);

      await evaluate("document.querySelector('.costing-sheet__summary').scrollIntoView({block:'start'});");
      await new Promise((resolve) => setTimeout(resolve, 100));
      detailResults.push({ theme, ...await detailProbe(".costing-sheet__summary", "Commercial Summary", width, height) });
      await screenshot(`${theme}--commercial-summary--${size}.png`);

      await openCostingSection("Installation");
      await evaluate("[...document.querySelectorAll('button')].find(node=>node.textContent.includes('Advanced Installation'))?.click()");
      await waitFor(() => evaluate("Boolean(document.querySelector('.calculator-lab__installation-modal'))"), "Advanced Installation modal did not render for detailed proof.");
      detailResults.push({ theme, ...await detailProbe(".calculator-lab__installation-modal", "Advanced Installation", width, height) });
      await screenshot(`${theme}--advanced-installation--${size}.png`);
      await evaluate(`(()=>{const modal=document.querySelector('.calculator-lab__installation-modal');[...modal.querySelectorAll('button')].find(node=>node.textContent.trim()==='Close')?.click();return true})()`);
      await waitFor(() => evaluate("!document.querySelector('.calculator-lab__installation-modal')"), "Advanced Installation modal did not close after detailed proof.");
    }
  }

  assert(diagnostics.length === 0, `Browser diagnostics: ${diagnostics.join(" | ")}`);
  assert(failedRequests.length === 0, `Failed requests: ${failedRequests.join(" | ")}`);
  console.log(JSON.stringify({ themes: themes.length, approvedV2Themes: approvedV2Themes.length, viewports: viewports.length, screenshots: themes.length * viewports.length * 2 + themes.length + 5 + approvedV2Themes.length * viewports.length * 4 + approvedV2Themes.length * 2, results, interactionResults, detailResults, restored, outputDir }, null, 2));
} finally {
  try { socket?.close(); } catch { /* cleanup continues */ }
  const cleanup = await controller.stop("final");
  console.log(JSON.stringify({ browserCleanup: { ownedBrowserProcesses: cleanup.ownedProcessCountAfter ?? 0, ownedTemporaryProfiles: cleanup.ownedProfileCountAfter ?? 0, verified: cleanup.verified ?? cleanup.skipped === true } }, null, 2));
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(tempDir, { recursive: true, force: true });
}
