import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("shared controls separate action, selection, danger, icon and interactive-row semantics", async () => {
  const [ui, tokens] = await Promise.all([read("src/styles/ui.css"), read("src/styles/tokens.css")]);
  for (const selector of [".ui-button--primary", ".ui-button--selected", ".ui-button--danger", ".ui-button--icon", ".ui-interactive-row"]) {
    assert.match(ui, new RegExp(selector.replaceAll(".", "\\.")));
  }
  assert.match(tokens, /--qs-theme-border-strong:\s*#56605a/);
  assert.match(tokens, /--qs-semantic-commercial-border/);
  assert.match(tokens, /--qs-semantic-scheduled-border/);
});

test("persistent Estimate controls use selected semantics while commands remain primary", async () => {
  const [picker, workspace] = await Promise.all([
    read("src/features/estimatePicker/EstimatePickerTabs.tsx"),
    read("src/features/estimateCommercial/EstimateCommercialWorkspace.tsx"),
  ]);
  assert.match(picker, /estimatePickerTab === "client_info" \? "selected" : "secondary"/);
  assert.match(picker, /estimateCreatorFilterByTab\[estimatePickerTab\] === "mine" \? "selected" : "secondary"/);
  assert.match(picker, /variant="primary"[\s\S]*createEstimateForClient\(pickerClient\)[\s\S]*\+ New Estimate/);
  assert.match(workspace, /commercialView === "internal" \? " ui-button--selected"/);
  assert.match(workspace, /ui-button ui-button--primary estimate-commercial__document-action/);
});

test("Project Map uses aligned summary groups and valid separate Open control", async () => {
  const [app, css] = await Promise.all([read("src/App.tsx"), read("src/App.css")]);
  assert.match(app, /project-map-summary-grid/);
  assert.equal((app.match(/project-map-summary-group/g) ?? []).length, 2);
  assert.match(app, /role="button"[\s\S]*tabIndex=\{0\}[\s\S]*className="ui-button ui-button--primary"/);
  assert.match(css, /\.project-map-summary-grid[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/);
});

test("Follow Ups use shared controls and scheduled semantic accents", async () => {
  const [component, css] = await Promise.all([
    read("src/features/followUps/FollowUpsFeature.tsx"),
    read("src/features/followUps/FollowUpsFeature.css"),
  ]);
  assert.match(component, /aria-label="Previous month"/);
  assert.match(component, /ui-button ui-button--icon/);
  assert.match(component, /ui-button ui-button--primary/);
  assert.match(css, /--qs-semantic-scheduled-border/);
  assert.match(css, /follow-ups__item--overdue[\s\S]*--qs-operational-orders/);
});
