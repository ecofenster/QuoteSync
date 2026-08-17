import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("normal user-facing branding uses QuoteSuite", async () => {
  const [html, app, shell, logo, admin, branding, costing, renderer] = await Promise.all([
    read("index.html"), read("src/App.tsx"), read("src/layout/AppShell.tsx"), read("src/components/QuoteSyncLogo.tsx"),
    read("src/features/admin/AdminPlaceholderPage.tsx"), read("src/features/admin/AdminThemeColoursPanel.tsx"),
    read("src/features/projectCalculatorLab/ProjectCalculatorLabWorkspace.tsx"), read("scripts/export-b92-exact-render-output.mjs"),
  ]);
  for (const source of [html, app, shell, logo, admin, branding, renderer]) assert.match(source, /QuoteSuite/);
  assert.match(html, /<title>QuoteSuite<\/title>/);
  assert.match(shell, /title = "QuoteSuite"/);
  assert.match(logo, /alt = "QuoteSuite"/);
  assert.match(app, /<AppShell title="QuoteSuite"/);
  for (const source of [html, app, shell, logo, admin, branding, costing, renderer]) {
    assert.doesNotMatch(source, />\s*QuoteSync\b|["'`]QuoteSync(?:\s+(?:Preview|commercial|Look|Theme)|["'`])/);
  }
});

test("R1 retains persisted QuoteSync compatibility identifiers", async () => {
  const [theme, settings, db, storage] = await Promise.all([
    read("src/theme/themes.ts"), read("src/system/settings.ts"), read("server/db.js"), read("server/features/supplierQuotes/managedAttachmentStorage.js"),
  ]);
  assert.match(theme, /quotesync:selectedTheme/);
  assert.match(settings, /quotesync_system_settings/);
  assert.match(db, /quotesync\.db/);
  assert.match(storage, /QUOTESYNC_ATTACHMENT_ROOT/);
});
