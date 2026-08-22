import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("dark mode separates row hover, selected controls and primary actions", async () => {
  const [theme, tokens] = await Promise.all([read("src/theme/themes.ts"), read("src/styles/tokens.css")]);
  assert.match(theme, /resolved === "dark"[\s\S]*color-mix\(in srgb, \$\{activeConfiguration\.primary\} 20%, \$\{palette\.surface\}\)/);
  assert.doesNotMatch(theme, /"--qs-theme-button-hover": activeConfiguration\.accent/);
  assert.match(tokens, /:root\[data-qs-theme="dark"\][\s\S]*--qs-theme-row-hover: #2e3638/);
  assert.match(tokens, /:root\[data-qs-theme="dark"\][\s\S]*--qs-theme-selected: #275c32/);
  assert.match(theme, /"--qs-theme-action-primary": actionPrimary/);
  assert.match(theme, /"--qs-theme-action-primary-text": "#ffffff"/);
});

test("shared controls retain distinct primary, destructive and focus treatments", async () => {
  const ui = await read("src/styles/ui.css");
  assert.match(ui, /\.ui-button--primary:hover[\s\S]*var\(--qs-theme-action-primary-hover/);
  assert.match(ui, /\.ui-button--danger:hover[\s\S]*var\(--qs-error-surface\)/);
  assert.match(ui, /\.ui-button:focus-visible[\s\S]*outline: 2px solid var\(--qs-focus-ring\)/);
  assert.match(ui, /\.ui-table tbody tr:hover[\s\S]*var\(--qs-bg-row-hover/);
});

test("non-application shell pages cannot retain Estimate workspaces", async () => {
  const app = await read("src/App.tsx");
  assert.match(app, /const leaveOperationalWorkspace = \(\) =>/);
  assert.match(app, /topShellPage === "app" && view === "estimate_picker"/);
  assert.match(app, /topShellPage === "app" && view === "estimate_workspace"/);
});

test("follow-up counts occupy the calendar cell top-right without obscuring the date", async () => {
  const [css, feature] = await Promise.all([
    read("src/features/followUps/FollowUpsFeature.css"),
    read("src/features/followUps/FollowUpsFeature.tsx"),
  ]);
  assert.match(css, /\.follow-ups__calendar-count\s*\{[\s\S]*position:\s*absolute;[\s\S]*top:\s*5px;[\s\S]*right:\s*5px;/);
  assert.match(feature, /const count = \(followUpsByDate\.get\(iso\) \?\? \[\]\)\.length/);
});

test("Estimate rows have compact separation and larger glyphs without enlarging controls", async () => {
  const css = await read("src/features/estimatePicker/tabs/shared.css");
  assert.match(css, /\.estimate-index-table \{[^}]*border-spacing:\s*0 4px/);
  assert.match(css, /\.estimate-index-actions \.ui-button:nth-child\(1\)[\s\S]*font-size:\s*20px/);
  assert.match(css, /\.estimate-index-actions \.ui-button \{[^}]*min-height:\s*40px/);
});

test("light mode exposes distinct page, panel, sidebar, row and control surfaces", async () => {
  const [theme, tokens] = await Promise.all([read("src/theme/themes.ts"), read("src/styles/tokens.css")]);
  for (const value of ["#eef1ed", "#ffffff", "#f5f7f4", "#e7ece6", "#f8f9f7", "#aeb8ae", "#dde4df"]) {
    assert.match(`${theme}\n${tokens}`, new RegExp(value));
  }
  assert.match(tokens, /--qs-bg-sidebar:\s*var\(--qs-theme-sidebar\)/);
  assert.match(tokens, /--qs-bg-row:\s*var\(--qs-theme-row\)/);
});

test("light mode derives interaction semantics from the branding source", async () => {
  const [theme, tokens, admin] = await Promise.all([
    read("src/theme/themes.ts"),
    read("src/styles/tokens.css"),
    read("src/features/admin/AdminPlaceholderPage.css"),
  ]);
  assert.match(tokens, /--qs-theme-primary:\s*#55b948/);
  assert.match(tokens, /--qs-theme-action-primary:\s*color-mix\([^;]+var\(--qs-theme-primary\)[^;]+#173c22\)/);
  assert.match(tokens, /--qs-theme-action-primary-text:\s*#ffffff/);
  assert.match(tokens, /--qs-theme-selected:\s*color-mix\([^;]+var\(--qs-theme-action-primary\)/);
  assert.match(tokens, /--qs-theme-accent-text:\s*color-mix\([^;]+var\(--qs-theme-primary\)[^;]+#173c22\)/);
  assert.match(theme, /"--qs-theme-accent-text": accentText/);
  assert.match(admin, /\.admin-page-title[\s\S]*color:\s*var\(--qs-theme-accent-text\)/);
  assert.match(admin, /button\[data-state="active"\][\s\S]*color:\s*var\(--qs-theme-selected-text\)/);
});
