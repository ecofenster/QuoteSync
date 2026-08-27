import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("one semantic typography scale owns all four application presets", async () => {
  const [tokens, base] = await Promise.all([read("src/styles/tokens.css"), read("src/styles/base.css")]);
  for (const role of ["body", "secondary", "meta", "label", "list", "table", "button", "input", "navigation", "badge", "small-title", "section-title", "page-title"]) {
    assert.match(tokens, new RegExp(`--qs-type-${role}:`));
  }
  assert.match(tokens, /--qs-type-body: 1rem;/);
  assert.match(tokens, /--qs-root-font-size: 100%;/);
  assert.match(base, /html \{[\s\S]*font-size: var\(--qs-root-font-size\)/);
  assert.match(base, /body \{[\s\S]*font-size: var\(--qs-type-body\)/);
  assert.match(tokens, /data-qs-text-size="compact"[\s\S]*--qs-type-body: 0\.875rem/);
  assert.match(tokens, /data-qs-text-size="large"[\s\S]*--qs-type-body: 1\.125rem/);
  assert.match(tokens, /data-qs-text-size="extra-large"[\s\S]*--qs-type-body: 1\.25rem/);
  const darkThemeBlock = tokens.match(/:root\[data-qs-theme="dark"\]\s*\{[^}]*\}/)?.[0] ?? "";
  assert.doesNotMatch(darkThemeBlock, /--qs-type/);
});

test("Display owns one persistent device preference instead of feature-local scales", async () => {
  const [theme, selector, shell] = await Promise.all([
    read("src/theme/themes.ts"),
    read("src/components/TextSizeSelector.tsx"),
    read("src/layout/AppShell.tsx"),
  ]);
  assert.match(theme, /QUOTESYNC_TEXT_SIZE_STORAGE_KEY = "quotesync:textSize"/);
  for (const preset of ["compact", "standard", "large", "extra-large"]) assert.match(theme, new RegExp(`id:\\s*"${preset}"`));
  assert.match(theme, /localStorage\.setItem\(QUOTESYNC_TEXT_SIZE_STORAGE_KEY,normalized\)/);
  assert.match(theme, /document\.documentElement\.dataset\.qsTextSize=normalized/);
  assert.match(theme, /event\.key === QUOTESYNC_TEXT_SIZE_STORAGE_KEY/);
  assert.match(selector, /Application text size/);
  assert.match(selector, /role="radiogroup"/);
  assert.match(selector, /saveQuoteSyncTextSize/);
  assert.match(shell, /<TextSizeSelector \/>/);
});

test("shared controls and representative workspaces consume semantic roles", async () => {
  const sources = await Promise.all([
    "src/styles/ui.css",
    "src/layout/AppShell.css",
    "src/dashboard/main/MainDashboard.css",
    "src/features/clients/ClientsView.css",
    "src/features/communications/emailWorkspace.css",
    "src/features/documents/canonicalDocuments.css",
    "src/features/admin/AdminPlaceholderPage.css",
    "src/features/developmentRoadmap/developmentRoadmap.css",
    "src/features/followUps/FollowUpsFeature.css",
    "src/features/commercialIdentity/commercialIdentity.css",
  ].map(read));
  for (const source of sources) assert.match(source, /var\(--qs-type-/);
  assert.match(sources[0], /\.ui-button[\s\S]*font-size: var\(--qs-type-button\)/);
  assert.match(sources[0], /\.ui-input[\s\S]*font-size: var\(--qs-type-input\)/);
  assert.match(sources[4], /email-message-row__sender[\s\S]*var\(--qs-type-body\)/);
  assert.match(sources[5], /file-explorer__primary strong\{font-size:var\(--qs-type-body\)\}/);
});

test("type scaling preserves bounded controls, wrapping and the viewport shell", async () => {
  const [tokens, ui, shell, app, email, files] = await Promise.all([
    read("src/styles/tokens.css"), read("src/styles/ui.css"), read("src/layout/AppShell.css"),
    read("src/App.css"), read("src/features/communications/emailWorkspace.css"), read("src/features/documents/canonicalDocuments.css"),
  ]);
  assert.match(tokens, /--qs-control-height:/);
  assert.match(tokens, /--qs-list-row-min-height:/);
  assert.match(ui, /min-height: var\(--qs-control-height\)/);
  assert.match(shell, /height: 100dvh;[\s\S]*overflow: hidden;/);
  assert.match(app, /min-width: 0;[\s\S]*min-height: 0;/);
  assert.match(email, /flex-wrap:wrap/);
  assert.match(email, /min-height:var\(--qs-list-row-min-height\)/);
  assert.match(files, /min-height:var\(--qs-list-row-min-height\)/);
  assert.match(files, /@media\(max-width:760px\)/);
});

test("static enforcement documents only specialist output and runtime-geometry exceptions", async () => {
  const checker = await read("scripts/check-design-system-compliance.mjs");
  assert.match(checker, /typographySpecialistFiles/);
  assert.match(checker, /customerQuotation\/customerQuotation\.css/);
  assert.match(checker, /b92Configurator\/B92Configurator\.css/);
  assert.match(checker, /communications\/domain\/emailPresentation\.ts/);
  assert.match(checker, /approvedDynamicLayoutFiles/);
  assert.match(checker, /communications\/EmailWorkspace\.tsx/);
  assert.match(checker, /use a canonical --qs-type-\* or --qs-icon-size\* role/i);
  assert.doesNotMatch(checker, /canonicalDocuments\.css/);
});
