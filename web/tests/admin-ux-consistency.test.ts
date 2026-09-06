import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("normal theme selector exposes only Light and Dark while base configuration stays immutable", async () => {
  const [selector, branding, theme] = await Promise.all([
    read("src/components/ThemeSelector.tsx"),
    read("src/features/admin/AdminThemeColoursPanel.tsx"),
    read("src/theme/themes.ts"),
  ]);
  assert.match(selector, /themeOrder: QuoteSyncThemeId\[\] = \["light", "dark"\]/);
  assert.match(branding, /mode\.id!=="system"/);
  assert.match(branding, /Reset to QuoteSuite Theme Defaults/);
  assert.match(branding, /Canonical Light and Dark defaults are immutable/);
  assert.match(theme, /configuration: structuredClone\(DEFAULT_QUOTESYNC_THEME_CONFIGURATION\)/);
});

test("Administration and Estimate use shared compact form and summary spacing", async () => {
  const [admin, costing, estimate] = await Promise.all([
    read("src/features/admin/AdminPlaceholderPage.css"),
    read("src/features/projectCalculatorLab/projectCalculatorLab.css"),
    read("src/features/estimateCommercial/estimateCommercialWorkspace.css"),
  ]);
  assert.match(admin, /\.admin-form-grid/);
  assert.match(admin, /\.admin-customer-view-controls[^}]*repeat\(5/);
  assert.match(costing, /\.costing-sheet__estimate-metrics[^}]*width:min\(100%,48rem\)/);
  assert.match(costing, /\.costing-sheet__margin-control[^}]*padding:[^;]*var\(--space-4\)/);
  assert.match(estimate, /\.estimate-commercial__estimate-row,\.estimate-commercial__next-action\{display:flex/);
});

test("current suppliers use visible row presence while historical snapshots retain legacy status compatibility", async () => {
  const [component, schema, service, supplierQuotes, drive, communications] = await Promise.all([
    read("src/features/admin/AdminSupplierCommercialDefaults.tsx"),
    read("server/schema/supplierCommercialSchema.js"),
    read("server/features/projectCalculatorLab/projectCalculatorLabService.js"),
    read("server/features/supplierQuotes/supplierQuotesService.js"),
    read("server/features/documents/driveIntegrationService.js"),
    read("server/features/communications/communicationsService.js"),
  ]);
  assert.match(component, />Edit<\/button>/);
  assert.match(component, />Delete<\/button>/);
  assert.doesNotMatch(component, /"Archive":"Reactivate"/);
  assert.match(component, /Historical quotation and Estimate snapshots are unchanged/);
  assert.match(schema, /active INTEGER NOT NULL DEFAULT 1/);
  assert.match(service, /active:true/);
  assert.match(service, /DELETE FROM supplier_commercial_defaults/);
  assert.match(supplierQuotes, /active: true/);
  assert.doesNotMatch(supplierQuotes, /supplier_commercial_defaults WHERE active<>0/);
  assert.doesNotMatch(drive, /supplier_commercial_defaults WHERE active<>0/);
  assert.doesNotMatch(communications, /supplier_commercial_defaults[^"`]*active<>0/);
});

test("Administration does not maintain fixed supplier package prices", async () => {
  const component = await read("src/features/admin/AdminSupplierCommercialDefaults.tsx");
  assert.doesNotMatch(component, /Package Pricing|PackageEditor|Package label|Save Package Pricing/);
  assert.match(component, /Pricing Methods/);
  assert.match(component, /Suppliers/);
  assert.match(component, /Customer Presentation/);
});
