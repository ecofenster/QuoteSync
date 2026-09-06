import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { QUOTESUITE_V2_BRANDS, QUOTESUITE_VISUAL_THEMES, getQuoteSuiteVisualTheme, isQuoteSuiteVisualThemeId, quoteSuiteV2ThemeIdFor } from "../src/theme/visualDesignV2";

const read = (file: string) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("approved V2 models brand and appearance as independent dimensions", () => {
  assert.deepEqual(QUOTESUITE_V2_BRANDS.map(({ id }) => id), ["quotesuite", "ecofenster", "zyle-fenster", "glassworx"]);
  const approved = QUOTESUITE_VISUAL_THEMES.filter((theme) => theme.design === "v2");
  assert.equal(approved.length, 8);
  for (const brand of QUOTESUITE_V2_BRANDS) {
    assert.equal(getQuoteSuiteVisualTheme(quoteSuiteV2ThemeIdFor(brand.id, "light")).brand, brand.id);
    assert.equal(getQuoteSuiteVisualTheme(quoteSuiteV2ThemeIdFor(brand.id, "dark")).brand, brand.id);
  }
  assert.deepEqual(QUOTESUITE_VISUAL_THEMES.filter((theme) => theme.design === "legacy").map(({ id }) => id), ["current-light", "current-dark"]);
  assert.ok(isQuoteSuiteVisualThemeId("quotesuite-v2-dark"));
  assert.ok(isQuoteSuiteVisualThemeId("glassworx-v2-light"));
  assert.ok(!isQuoteSuiteVisualThemeId("nexora"));
});

test("approved selection is local, reversible, and independent of commercial or tenant persistence", async () => {
  const [module, main, shell, appearanceSelector, brandSelector] = await Promise.all([
    read("src/theme/visualDesignV2.ts"), read("src/main.tsx"), read("src/layout/AppShell.tsx"), read("src/components/ThemeSelector.tsx"), read("src/components/VisualThemeLabSelector.tsx"),
  ]);
  assert.match(module, /quotesync:visualDesignV2Lab/);
  assert.match(module, /design: "v2" \| "legacy"/);
  assert.match(module, /quoteSuiteV2ThemeIdFor/);
  assert.match(module, /delete root\.dataset\.qsDesign/);
  assert.doesNotMatch(module, /apiFetch|\/api\/settings|branding\.themeConfiguration/);
  assert.match(main, /initialiseQuoteSuiteVisualTheme/);
  assert.match(shell, /<VisualThemeLabSelector/);
  assert.match(appearanceSelector, /Appearance/);
  assert.match(appearanceSelector, /quoteSuiteV2ThemeIdFor\(current\.brand, nextAppearance\)/);
  assert.match(brandSelector, /QUOTESUITE_V2_BRANDS/);
  assert.match(brandSelector, /current\.appearance/);
});

test("one semantic V2 system owns four palettes, two appearances, spacing, typography, and controls", async () => {
  const css = await read("src/styles/visual-design-v2.css");
  for (const token of ["--qs-v2-space-inline", "--qs-v2-space-field", "--qs-v2-space-row", "--qs-v2-space-group", "--qs-v2-space-section", "--qs-v2-weight-page", "--qs-v2-weight-commercial"]) assert.match(css, new RegExp(token));
  for (const control of ["ui-button--primary", "ui-button--ghost", "ui-button--danger", "ui-input", "ui-select", "ui-tabs", "ui-status", "ui-table", "ui-modal", "app-shell__header", "project-costing__fx-rate", "admin-supplier-editor"]) assert.match(css, new RegExp(control));
  for (const brand of ["quotesuite", "ecofenster", "zyle-fenster", "glassworx"]) assert.match(css, new RegExp(`data-qs-v2-brand="${brand}"`));
  assert.match(css, /--qs-v2-primary: #84a956/i);
  assert.match(css, /--qs-v2-primary: #55b948/i);
  assert.match(css, /--qs-v2-primary: #ffaf3d/i);
  assert.match(css, /--qs-v2-primary: #f4f224/i);
  assert.match(css, /data-qs-v2-appearance="light"/);
  assert.match(css, /data-qs-v2-appearance="dark"/);
  assert.match(css, /V2 Day appearance: identical component ownership and geometry/);
});

test("platform and company branding use a structural, appearance-aware lockup", async () => {
  const [logo, css, assets] = await Promise.all([read("src/components/QuoteSyncLogo.tsx"), read("src/layout/AppShell.css"), read("src/assets/brands/README.md")]);
  assert.match(logo, /data-logo-role="platform"/);
  assert.match(logo, /data-logo-role="company"/);
  assert.match(logo, /quotesuite-titlecase-light-transparent\.png/);
  assert.match(logo, /quotesuite-titlecase-dark-transparent\.png/);
  assert.match(logo, /quotesuite-icon-circle-transparent\.png/);
  assert.match(logo, /zyle-fenster-logo\.svg/);
  assert.match(logo, /glassworx-logo\.png/);
  assert.match(css, /\.quotesync-logo \{[\s\S]*display: inline-flex/);
  assert.match(logo, /company && companySource/);
  assert.match(logo, /data-company-brand=\{theme\.brand\}/);
  assert.doesNotMatch(css, /grid-area: 1 \/ 1/);
  assert.match(assets, /7\.5\.5 Arc Wordmark/);
  assert.match(assets, /CONFIGURE \| QUOTE \| DELIVER/);
});

test("browser contract covers eight V2 combinations, legacy fallback, real and foundation components, and exact cleanup", async () => {
  const [script, fixture, foundationScript, foundationFixture] = await Promise.all([
    read("scripts/run-visual-design-v2-browser.mjs"),
    read("tests/fixtures/VisualDesignV2Acceptance.tsx"),
    read("scripts/run-compare-documents-portal-browser.mjs"),
    read("tests/fixtures/CompareDocumentsPortalAcceptance.tsx"),
  ]);
  for (const theme of QUOTESUITE_VISUAL_THEMES) assert.match(script, new RegExp(theme.id));
  for (const viewport of ["1920, 1080", "1440, 900", "390, 844"]) assert.match(script, new RegExp(viewport));
  for (const component of ["AppShell", "MainDashboard", "EstimateCommercialHeaderRows", "ScenarioCostingWorksheet", "AdminSupplierCommercialDefaults"]) assert.match(fixture, new RegExp(component));
  assert.match(script, /main-dashboard/);
  for (const proof of ["expanded-products", "expanded-installation", "commercial-summary", "advanced-installation"]) assert.match(script, new RegExp(proof));
  assert.match(script, /approvedV2Themes/);
  assert.match(script, /platformLogoCount === 1/);
  assert.match(script, /companyLogoCount/);
  assert.match(script, /logoOverlap/);
  assert.match(script, /controlOverlapCount === 0/);
  assert.match(script, /textContrast >= 4\.5/);
  assert.match(script, /pageOverflow <= 1/);
  assert.match(script, /primary-action-hover/);
  assert.match(script, /inactive-action-hover/);
  assert.match(script, /focusVisible/);
  assert.match(script, /destructiveHover/);
  assert.match(script, /ownedBrowserProcesses/);
  assert.match(script, /ownedTemporaryProfiles/);
  for (const theme of QUOTESUITE_VISUAL_THEMES.filter(({ design }) => design === "v2")) assert.match(foundationScript, new RegExp(theme.id));
  for (const screen of ["compare", "documents", "portal"]) assert.match(foundationScript, new RegExp(`"${screen}"`));
  for (const component of ["CompareQuotesWorkspace", "AdminManufacturerDocuments", "ClientPortalPreview"]) assert.match(foundationFixture, new RegExp(component));
  assert.match(foundationScript, /expectedCompanyBrand/);
  assert.match(foundationScript, /logoOverlap/);
  assert.match(foundationScript, /ownedBrowserProcessesRemaining/);
  assert.match(foundationScript, /ownedTemporaryProfilesRemaining/);
});

test("V2 preserves the approved Project Costing hierarchy and interaction contract", async () => {
  const [css, worksheet] = await Promise.all([read("src/styles/visual-design-v2.css"), read("src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx")]);
  assert.match(css, /body:has\(\.estimate-commercial\)/);
  assert.match(css, /\.app-shell:has\(\.estimate-commercial\)/);
  assert.match(css, /grid-template-areas:[\s\S]*"title actions"[\s\S]*"metrics metrics"/);
  for (const token of ["--qs-v2-interaction-neutral-action", "--qs-v2-interaction-brand-primary", "--qs-v2-interaction-active-hover", "--qs-v2-interaction-on-brand", "--qs-v2-interaction-on-dark"]) assert.match(css, new RegExp(token));
  assert.match(css, /Inactive actions promote to the brand-primary surface/);
  assert.match(css, /Active\/selected actions start on that brand surface and invert to charcoal/);
  for (const label of ["Project cost", "Selling price", "Gross profit", "Gross margin"]) assert.match(worksheet, new RegExp(label));
  assert.match(worksheet, /money\(projectCost\)/);
  assert.match(worksheet, /money\(sale\)/);
  assert.match(worksheet, /money\(profit\)/);
});
