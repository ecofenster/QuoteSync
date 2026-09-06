import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { createBrowserRunController, countBrowserRunProfiles } from "./browser-run-lifecycle.mjs";

const APP_URL = process.env.E2E_APP_URL ?? "http://localhost:5173";
const DEBUG_PORT = 9278;
const assert = (value, message) => { if (!value) throw new Error(message); };
const waitFor = async (fn, message, timeout = 30000) => { const started = Date.now(); while (Date.now() - started < timeout) { const value = await fn().catch(() => false); if (value) return value; await delay(150); } throw new Error(message); };
const reachable = async (url) => { try { return (await fetch(url)).ok; } catch { return false; } };

const browserRunController = createBrowserRunController({ throwOnLeak: true, processOptions: { platformName: process.platform } });
browserRunController.installInterruptHandlers();

async function launchChrome() {
  const userDataDir = await browserRunController.createProfile({ label: "dark-theme-hover", debugPort: DEBUG_PORT });
  const child = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", ["--headless=new", `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${userDataDir}`, "--no-first-run", "--disable-gpu", "--disable-extensions", "about:blank"], { stdio: "ignore" });
  browserRunController.setRun({ child });
  await waitFor(() => reachable(`http://127.0.0.1:${DEBUG_PORT}/json/version`), "Chrome unavailable", 10000);
  return { child, userDataDir };
}

async function connect() {
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(APP_URL)}`, { method: "PUT" });
  const targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
  const target = targets.find((item) => item.type === "page" && item.url.startsWith(APP_URL));
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  const diagnostics = [];
  socket.addEventListener("message", (event) => { const message = JSON.parse(String(event.data)); if (message.method === "Runtime.exceptionThrown") diagnostics.push(message.params?.exceptionDetails?.text); if (message.id && pending.has(message.id)) { const task = pending.get(message.id); pending.delete(message.id); message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const call = ++id; pending.set(call, { resolve, reject }); socket.send(JSON.stringify({ id: call, method, params })); });
  const evaluate = async (expression) => { const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result?.value; };
  await send("Runtime.enable"); await send("Page.enable"); await send("Page.navigate", { url: APP_URL });
  return { send, evaluate, diagnostics, close: () => socket.close() };
}

const clickText = (tab, text, selector = "button") => waitFor(() => tab.evaluate(`(() => { const node = [...document.querySelectorAll(${JSON.stringify(selector)})].find((item) => item.textContent.trim() === ${JSON.stringify(text)}); if (!node) return false; node.click(); return true; })()`), `Control unavailable: ${text}`);
async function hover(tab, selector) {
  await tab.send("DOM.enable"); await tab.send("CSS.enable");
  const root = await tab.send("DOM.getDocument");
  const node = await tab.send("DOM.querySelector", { nodeId: root.root.nodeId, selector });
  assert(node.nodeId, `Hover target unavailable: ${selector}`);
  await tab.send("CSS.forcePseudoState", { nodeId: node.nodeId, forcedPseudoClasses: ["hover"] });
  await delay(250);
}
async function forceFocusVisible(tab, selector) {
  await tab.send("DOM.enable"); await tab.send("CSS.enable");
  const root = await tab.send("DOM.getDocument");
  const node = await tab.send("DOM.querySelector", { nodeId: root.root.nodeId, selector });
  assert(node.nodeId, `Focus target unavailable: ${selector}`);
  await tab.send("CSS.forcePseudoState", { nodeId: node.nodeId, forcedPseudoClasses: ["focus", "focus-visible"] });
}
const style = (tab, selector) => tab.evaluate(`(() => { const node = document.querySelector(${JSON.stringify(selector)}); if (!node) return null; const value = getComputedStyle(node); return { background: value.backgroundColor, color: value.color, border: value.borderColor, outline: value.outlineStyle, outlineWidth: value.outlineWidth }; })()`);
const rgb = (value) => { const channels = (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number); return value.startsWith("color(srgb") ? channels.map((channel) => channel * 255) : channels; };
const luminance = (value) => rgb(value).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);

async function run() {
  assert(await reachable(APP_URL), `Application unavailable at ${APP_URL}`);
  const browser = await launchChrome();
  let tab;
  browserRunController.setRun({
    label: "dark-theme-hover",
    userDataDir: browser.userDataDir,
    child: browser.child,
    debugPort: DEBUG_PORT,
    startedAt: new Date().toISOString(),
    profileProcessCountBefore: await countBrowserRunProfiles(browser.userDataDir, { platformName: process.platform }),
  });
  try {
    tab = await connect();
    browserRunController.setRun({
      profileProcessCountDuring: await countBrowserRunProfiles(browser.userDataDir, { platformName: process.platform }),
    });
    await tab.send("Emulation.setDeviceMetricsOverride", { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.theme-selector'))`), "Application shell unavailable");
    if (await tab.evaluate(`document.documentElement.dataset.qsTheme !== 'dark'`)) await tab.evaluate(`document.querySelector('.theme-selector')?.click()`);
    await waitFor(() => tab.evaluate(`document.documentElement.dataset.qsTheme === 'dark'`), "Dark theme did not activate");

    await clickText(tab, "Main Dashboard", ".app-sidebar-item");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.qs-dashboard-primary-action'))`), "Dashboard unavailable");
    const dashboardPrimary = await style(tab, ".qs-dashboard-primary-action");
    assert(dashboardPrimary.background === "rgb(39, 92, 50)" && dashboardPrimary.color === "rgb(255, 255, 255)", `Dashboard primary styling incorrect: ${JSON.stringify(dashboardPrimary)}`);

    await clickText(tab, "Recycle Bin", ".app-sidebar-item");
    await waitFor(() => tab.evaluate(`Boolean([...document.querySelectorAll('h2')].find(node=>node.textContent.trim()==='Recycle Bin'))`), "Recycle Bin unavailable");
    const recycleDanger = await style(tab, ".ui-button--danger");
    assert(recycleDanger && recycleDanger.color !== "rgb(244, 247, 244)", `Recycle destructive styling unavailable: ${JSON.stringify(recycleDanger)}`);
    await clickText(tab, "Clients");
    assert(await tab.evaluate(`Boolean([...document.querySelectorAll('.ui-button--selected')].find(node=>node.textContent.trim()==='Clients'))`), "Recycle filter did not use selected semantics");

    await clickText(tab, "Project Map", ".app-sidebar-item");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.project-map-summary-grid'))`), "Project Map unavailable");
    const projectMapLayout = await tab.evaluate(`(() => { const summary=document.querySelector('.project-map-summary-grid').getBoundingClientRect(); const groups=[...document.querySelectorAll('.project-map-summary-group')].map(node=>node.getBoundingClientRect()); const content=document.querySelector('.qs-migrated-45').getBoundingClientRect(); const row=document.querySelector('[id^="estimate-map-row-"]'); const open=row?.querySelector('button'); return {groups:groups.map(box=>({left:Math.round(box.left),right:Math.round(box.right)})),content:{left:Math.round(content.left),mid:Math.round(content.left+content.width/2),right:Math.round(content.right)},rowRole:row?.getAttribute('role'),rowTabIndex:row?.tabIndex,openTag:open?.tagName}; })()`);
    assert(projectMapLayout.groups.length===2 && Math.abs(projectMapLayout.groups[0].right-projectMapLayout.content.mid)<10 && projectMapLayout.rowRole==='button' && projectMapLayout.rowTabIndex===0 && projectMapLayout.openTag==='BUTTON', `Project Map alignment/accessibility incorrect: ${JSON.stringify(projectMapLayout)}`);

    for (const page of ["Orders", "Lost"]) {
      await clickText(tab, page, ".app-sidebar-item");
      await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.ui-button--selected'))`), `${page} selected controls unavailable`);
    }

    await clickText(tab, "Estimates", ".app-sidebar-item");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.estimate-index-table tbody tr'))`), "Estimate index unavailable");
    const normalRow = await style(tab, ".estimate-index-table tbody tr td");
    const normalIcon = await style(tab, ".estimate-index-actions .ui-button");
    const normalPrimary = await style(tab, ".estimate-index-actions .ui-button--primary");
    await hover(tab, ".estimate-index-table tbody tr");
    const hoverRow = await style(tab, ".estimate-index-table tbody tr td");
    const hoverToken = await tab.evaluate(`getComputedStyle(document.documentElement).getPropertyValue('--qs-bg-hover').trim()`);
    const iconOnRow = await style(tab, ".estimate-index-actions .ui-button");
    assert(rgb(hoverRow.background).every((channel, index) => Math.abs(channel - [46, 54, 56][index]) < 2) && hoverRow.color === normalRow.color, `Estimate row hover incorrect: ${JSON.stringify({ normalRow, hoverRow, hoverToken })}`);
    assert(iconOnRow.background === normalIcon.background && iconOnRow.background !== hoverRow.background, "Icon controls lost distinction on row hover");
    await hover(tab, ".estimate-index-actions .ui-button");
    const hoverIcon = await style(tab, ".estimate-index-actions .ui-button");
    assert(hoverIcon.background !== hoverRow.background, `Secondary icon hover is indistinguishable from row hover: ${JSON.stringify({ hoverIcon, hoverRow })}`);
    await hover(tab, ".estimate-index-actions .ui-button--primary");
    const hoverPrimary = await style(tab, ".estimate-index-actions .ui-button--primary");
    assert(luminance(hoverPrimary.background) < luminance(normalPrimary.background), "Primary button did not darken on hover");
    await forceFocusVisible(tab, ".estimate-index-actions .ui-button");
    const focus = await style(tab, ".estimate-index-actions .ui-button:focus-visible");
    assert(focus?.outline !== "none" && focus?.outlineWidth === "2px", "Keyboard focus is not visible");
    const selectedNavigation = await style(tab, ".app-sidebar-item[data-state='active']");
    const estimateRowGeometry = await tab.evaluate(`(() => { const rows=[...document.querySelectorAll('.estimate-index-table tbody tr')].slice(0,2).map(row=>row.getBoundingClientRect()); const icon=getComputedStyle(document.querySelector('.estimate-index-actions .ui-button')); return {gap:rows.length===2 ? rows[1].top-rows[0].bottom : null, iconSize:icon.fontSize, buttonHeight:icon.height}; })()`);
    assert(estimateRowGeometry.gap >= 3 && estimateRowGeometry.iconSize === '20px', `Estimate row separation/icon sizing incorrect: ${JSON.stringify(estimateRowGeometry)}`);
    assert(selectedNavigation && selectedNavigation.background !== hoverRow.background, "Selected navigation is indistinguishable from hover");
    const estimateShot = await tab.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const estimateScreenshot = join(tmpdir(), "quotesuite-dark-estimate-hover.png");
    await writeFile(estimateScreenshot, Buffer.from(estimateShot.data, "base64"));

    await clickText(tab, "Client Database", ".app-sidebar-item");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('[data-testid="client-database-row"]'))`), "Client table unavailable");
    await hover(tab, "[data-testid='client-database-row']");
    const clientRow = await style(tab, "[data-testid='client-database-row']");

    await clickText(tab, "Follow Ups", ".app-sidebar-item");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.follow-ups__calendar-day'))`), "Follow Ups unavailable");
    const calendarBadge = await tab.evaluate(`(() => { const badge=document.querySelector('.follow-ups__calendar-count'); if(!badge) return null; const day=badge.closest('.follow-ups__calendar-day').getBoundingClientRect(); const box=badge.getBoundingClientRect(); return {top:box.top-day.top,right:day.right-box.right}; })()`);
    if (calendarBadge) assert(calendarBadge.top < 12 && calendarBadge.right < 12, `Follow-up badge is not top-right: ${JSON.stringify(calendarBadge)}`);
    const markDone = await style(tab, ".follow-ups__primary-button");
    if (markDone) assert(markDone.background === "rgb(39, 92, 50)" && markDone.color === "rgb(255, 255, 255)", `Mark done styling incorrect: ${JSON.stringify(markDone)}`);
    await clickText(tab, "Client Database", ".app-sidebar-item");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('[data-testid="client-database-row"]'))`), "Client table did not return");

    await tab.evaluate(`document.querySelector('[data-testid="client-database-row"] .ui-button--primary')?.click()`);
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.ep-tab-list .ui-button--selected'))`), "Client Estimate Selection selected controls unavailable");
    await clickText(tab, "Tools", ".app-shell__nav-button");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.tools-hub'))`), "Tools unavailable");
    assert(await tab.evaluate(`!document.querySelector('.estimate-picker, .dedicated-estimate-workspace')`), "Client/Estimate workspace remained mounted under Tools");
    await clickText(tab, "PHPP Calculator", ".tools-hub__tab");
    await clickText(tab, "Glass weight calculator", ".tools-hub__tab");
    await clickText(tab, "EN BS Numbers", ".tools-hub__tab");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.bsen-chip--active'))`), "Standards Library unavailable");
    const standardsSelected = await style(tab, ".bsen-chip--active");
    assert(standardsSelected.background === "rgb(39, 92, 50)" && standardsSelected.color === "rgb(255, 255, 255)", `Standards selected styling incorrect: ${JSON.stringify(standardsSelected)}`);
    assert(await tab.evaluate(`!document.querySelector('.estimate-picker, .dedicated-estimate-workspace')`), "Client/Estimate workspace reappeared under a Tools tab");

    await clickText(tab, "Estimates", ".app-sidebar-item");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.estimate-index-table tbody tr'))`), "Estimate index did not return");
    await clickText(tab, "Open", ".estimate-index-actions .ui-button--primary");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.project-costing'))`), "Dedicated Estimate unavailable");
    const metricsLayout = await tab.evaluate(`(() => { const metrics=document.querySelector('.costing-sheet__estimate-metrics'); const summary=document.querySelector('.costing-sheet__summary'); if(!metrics||!summary) return null; const boxes=[...metrics.children].map(node=>node.getBoundingClientRect()); const summaryBox=summary.getBoundingClientRect(); return {display:getComputedStyle(metrics).display, used:boxes.at(-1).right-boxes[0].left, available:summaryBox.width}; })()`);
    assert(metricsLayout?.display === "flex" && metricsLayout.used < metricsLayout.available * .9, `Commercial metrics are not compact: ${JSON.stringify(metricsLayout)}`);
    await hover(tab, ".costing-sheet__section-row");
    const costingRow = await style(tab, ".costing-sheet__section-row");

    await clickText(tab, "Admin", ".app-shell__nav-button");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.admin-nav-button'))`), "Administration unavailable");
    await clickText(tab, "Installation", ".admin-nav-button-label");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.workforce-admin, .installation-workforce-admin'))`), "Administration Installation unavailable");
    const adminTarget = await tab.evaluate(`document.querySelector('.ui-table tbody tr') ? '.ui-table tbody tr' : '.ui-button'`);
    await hover(tab, adminTarget);
    const adminInteraction = await style(tab, adminTarget);

    for (let attempt = 0; attempt < 3 && !await tab.evaluate(`document.documentElement.dataset.qsTheme === 'light'`); attempt += 1) {
      await tab.evaluate(`document.querySelector('.theme-selector')?.click()`);
      await delay(250);
    }
    assert(await tab.evaluate(`document.documentElement.dataset.qsTheme === 'light'`), "Light theme did not activate");
    const lightSurfaces = await tab.evaluate(`(() => { const root=getComputedStyle(document.documentElement); return {page:root.getPropertyValue('--qs-bg-page').trim(), surface:root.getPropertyValue('--qs-bg-surface').trim(), card:root.getPropertyValue('--qs-bg-card').trim(), sidebar:root.getPropertyValue('--qs-bg-sidebar').trim(), row:root.getPropertyValue('--qs-bg-row').trim(), control:root.getPropertyValue('--qs-bg-control').trim(), border:root.getPropertyValue('--qs-border-standard').trim(), rowHover:root.getPropertyValue('--qs-bg-row-hover').trim()}; })()`);
    assert(new Set([lightSurfaces.page,lightSurfaces.surface,lightSurfaces.card,lightSurfaces.sidebar,lightSurfaces.row,lightSurfaces.rowHover]).size >= 5 && lightSurfaces.page !== '#ffffff', `Light surfaces are flat: ${JSON.stringify(lightSurfaces)}`);
    await clickText(tab, "Home", ".app-shell__nav-button");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.app-sidebar-item'))`), "Application workspace did not return");
    await clickText(tab, "Recycle Bin", ".app-sidebar-item");
    await waitFor(() => tab.evaluate(`Boolean([...document.querySelectorAll('h2')].find(node=>node.textContent.trim()==='Recycle Bin'))`), "Light Recycle Bin unavailable");
    assert((await style(tab, ".ui-button--danger"))?.color !== "rgb(35, 31, 32)", "Light destructive action lost danger semantics");
    await clickText(tab, "Project Map", ".app-sidebar-item");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.project-map-summary-grid'))`), "Light Project Map unavailable");
    assert(await tab.evaluate(`getComputedStyle(document.querySelector('.project-map-summary-grid')).gridTemplateColumns.split(' ').length >= 2`), "Light Project Map summary grid collapsed unexpectedly");
    for (const page of ["Orders", "Lost"]) { await clickText(tab, page, ".app-sidebar-item"); await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.ui-button--selected'))`), `Light ${page} unavailable`); }
    await clickText(tab, "Estimates", ".app-sidebar-item");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.estimate-index-table tbody td'))`), "Light Estimates unavailable");
    const lightEstimate = await tab.evaluate(`(() => { const value=(selector)=>getComputedStyle(document.querySelector(selector)).backgroundColor; return {page:value('.app-shell__main'),sidebar:value('.app-workspace-sidebar'),panel:value('.estimate-index-table-wrap'),row:value('.estimate-index-table tbody td'),control:value('.estimate-index-actions .ui-button')}; })()`);
    const lightPrimary = await style(tab, ".estimate-index-actions .ui-button--primary");
    const lightSelected = await style(tab, ".app-sidebar-item[data-state='active']");
    assert(lightPrimary?.background !== "rgb(85, 185, 72)" && lightPrimary?.color === "rgb(255, 255, 255)", `Light primary still consumes raw branding: ${JSON.stringify(lightPrimary)}`);
    assert(lightSelected?.background !== "rgb(85, 185, 72)" && lightSelected?.color === "rgb(255, 255, 255)", `Light selected state is inconsistent: ${JSON.stringify(lightSelected)}`);
    assert(luminance(lightPrimary.background) > luminance(lightSelected.background), "Light primary is not stronger than selected state");
    assert(new Set(Object.values(lightEstimate)).size >= 4, `Light Estimate hierarchy is visually flat: ${JSON.stringify(lightEstimate)}`);
    await hover(tab, ".estimate-index-table tbody tr");
    const lightRowHover = await style(tab, ".estimate-index-table tbody td");
    assert(lightRowHover.background !== lightEstimate.row, "Light Estimate row hover is not visible");
    await clickText(tab, "Client Database", ".app-sidebar-item");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('[data-testid="client-database-row"]'))`), "Light Client Database unavailable");
    await tab.evaluate(`document.querySelector('[data-testid="client-database-row"] .ui-button--primary')?.click()`);
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.ep-tab-list .ui-button--selected'))`), "Light Client Estimate Selection unavailable");
    await clickText(tab, "Tools", ".app-shell__nav-button");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.tools-hub'))`), "Light Tools unavailable");
    await clickText(tab, "EN BS Numbers", ".tools-hub__tab");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.bsen-chip--active'))`), "Light Standards unavailable");
    await clickText(tab, "Home", ".app-shell__nav-button");
    await clickText(tab, "Follow Ups", ".app-sidebar-item");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.follow-ups__calendar-day'))`), "Light Follow Ups unavailable");
    const lightFollowUps = await tab.evaluate(`(() => ({page:getComputedStyle(document.querySelector('.app-shell__main')).backgroundColor, panel:getComputedStyle(document.querySelector('.follow-ups__panel')).backgroundColor, control:getComputedStyle(document.querySelector('.follow-ups__calendar-day')).backgroundColor}))()`);
    assert(new Set(Object.values(lightFollowUps)).size >= 2, `Light Follow Ups hierarchy is flat: ${JSON.stringify(lightFollowUps)}`);
    await clickText(tab, "Estimates", ".app-sidebar-item");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.estimate-index-actions .ui-button--primary'))`), "Light Estimates did not return");
    await clickText(tab, "Open", ".estimate-index-actions .ui-button--primary");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.project-costing'))`), "Light Project Costing unavailable");
    const lightCosting = await tab.evaluate(`(() => ({page:getComputedStyle(document.querySelector('.app-shell__main')).backgroundColor, workspace:getComputedStyle(document.querySelector('.project-costing')).backgroundColor, card:getComputedStyle(document.querySelector('.costing-sheet__summary')).backgroundColor, control:getComputedStyle(document.querySelector('.project-costing .ui-button')).backgroundColor}))()`);
    assert(new Set(Object.values(lightCosting)).size >= 3, `Light Project Costing hierarchy is flat: ${JSON.stringify(lightCosting)}`);
    const commercialSpacing = await tab.evaluate(`(() => { const metrics=document.querySelector('.costing-sheet__estimate-metrics'); const cards=[...metrics.children].map(node=>node.getBoundingClientRect()); const margin=document.querySelector('.costing-sheet__margin-control'); const actionButtons=[...document.querySelectorAll('.estimate-commercial__estimate-actions .ui-button')].map(node=>node.getBoundingClientRect()); const style=getComputedStyle(margin); return {metricWidth:metrics.getBoundingClientRect().width,summaryWidth:metrics.closest('.costing-sheet__summary').getBoundingClientRect().width,metricGap:cards.length>1?cards[1].left-cards[0].right:null,metricHeights:[...new Set(cards.map(box=>Math.round(box.height)))],marginPadding:[style.paddingTop,style.paddingRight,style.paddingBottom,style.paddingLeft],actionGaps:actionButtons.slice(1).map((box,index)=>Math.round(box.left-actionButtons[index].right)).filter(value=>value>=0)}; })()`);
    assert(commercialSpacing.metricWidth < commercialSpacing.summaryWidth && commercialSpacing.metricGap >= 8 && commercialSpacing.metricHeights.length === 1, `Commercial metric spacing incorrect: ${JSON.stringify(commercialSpacing)}`);
    assert(commercialSpacing.marginPadding.every(value=>parseFloat(value)>=12), `Target margin spacing incorrect: ${JSON.stringify(commercialSpacing)}`);
    assert(commercialSpacing.actionGaps.every(value=>value>=8), `Estimate action spacing incorrect: ${JSON.stringify(commercialSpacing)}`);
    await clickText(tab, "Admin", ".app-shell__nav-button");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.admin-nav-button'))`), "Light Administration unavailable");
    const lightAdmin = await tab.evaluate(`(() => ({page:getComputedStyle(document.querySelector('.app-shell__main')).backgroundColor, panel:getComputedStyle(document.querySelector('.admin-shell, .admin-layout, .admin-page')).backgroundColor}))()`);
    const lightAdminTitle = await style(tab, ".admin-page-title");
    assert(lightAdminTitle?.color !== "rgb(85, 185, 72)", `Admin heading still consumes raw branding: ${JSON.stringify(lightAdminTitle)}`);
    await clickText(tab, "Project Preferences", ".admin-nav-button-label");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.admin-customer-view-controls'))`), "Customer View controls unavailable");
    const customerViewGrid = await tab.evaluate(`(() => { const cells=[...document.querySelectorAll('.admin-customer-view-controls > label')].map(node=>node.getBoundingClientRect()); return {count:cells.length,rows:new Set(cells.map(box=>Math.round(box.top))).size,gap:cells[1].left-cells[0].right}; })()`);
    assert(customerViewGrid.count === 10 && customerViewGrid.rows === 2 && customerViewGrid.gap >= 8, `Customer View grid is not balanced: ${JSON.stringify(customerViewGrid)}`);
    await clickText(tab, "Supplier / Product Defaults", ".admin-nav-button-label");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.admin-supplier-list tbody tr'))`), "Configured suppliers unavailable");
    const supplierUx = await tab.evaluate(`(() => { const row=document.querySelector('.admin-supplier-list tbody tr'); const buttons=[...row.querySelectorAll('button')].map(node=>node.textContent.trim()); return {cursor:getComputedStyle(row).cursor,buttons}; })()`);
    assert(supplierUx.cursor === "pointer" && supplierUx.buttons.includes("Edit") && supplierUx.buttons.includes("Delete") && !supplierUx.buttons.some(value=>value==="Archive"||value==="Reactivate"), `Supplier management actions unavailable: ${JSON.stringify(supplierUx)}`);
    await clickText(tab, "Branding", ".admin-nav-button-label");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.admin-theme-panel'))`), "Branding unavailable");
    const brandingUx = await tab.evaluate(`(() => ({reset:[...document.querySelectorAll('button')].some(node=>node.textContent.trim()==='Reset to QuoteSuite Theme Defaults'),modes:[...document.querySelectorAll('.admin-theme-modes button')].map(node=>node.textContent.trim())}))()`);
    assert(brandingUx.reset && brandingUx.modes.join(',') === 'Light,Dark', `Branding/theme choices incorrect: ${JSON.stringify(brandingUx)}`);
    await clickText(tab, "Configurator Controls", ".admin-nav-button-label");
    await waitFor(() => tab.evaluate(`Boolean(document.querySelector('.admin-catalog-workspace, .admin-nav-button'))`), "Admin Configurator unavailable");

    for (const [label, result] of [["Client", clientRow], ["Project Costing", costingRow], ["Admin Installation", adminInteraction]]) assert(result && result.background !== "rgb(181, 218, 156)", `${label} retained pale hover`);
    assert(tab.diagnostics.length === 0, `Browser diagnostics: ${tab.diagnostics.join("; ")}`);
    console.log(JSON.stringify({ dashboardPrimary, recycleDanger, projectMapLayout, estimate: { normalRow, hoverRow, normalIcon, iconOnRow, hoverIcon, normalPrimary, hoverPrimary, focus, selectedNavigation, estimateRowGeometry, metricsLayout, screenshot: estimateScreenshot }, clientRow, calendarBadge, markDone, standardsSelected, costingRow, adminInteraction, lightSurfaces, lightEstimate, lightPrimary, lightSelected, lightRowHover, lightFollowUps, lightCosting, commercialSpacing, lightAdmin, lightAdminTitle, customerViewGrid, supplierUx, brandingUx }, null, 2));
  } finally {
    tab?.close();
    const summary = await browserRunController.stop("final");
    console.log(`Dark theme browser cleanup summary: ${JSON.stringify(summary)}`);
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { const cleanup = await browserRunController.stop("top-level"); if (!cleanup.skipped) console.log("Browser top-level cleanup: " + JSON.stringify(cleanup)); });
