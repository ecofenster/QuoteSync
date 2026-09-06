import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Admin Feature Controls contains capability switches and no per-Estimate Project Costing workspace", async () => {
  const [parent, featureControls] = await Promise.all([readFile("src/features/admin/AdminPlaceholderPage.tsx", "utf8"), readFile("src/features/admin/AdminFeatureControls.tsx", "utf8")]);
  assert.match(parent, /activeSection === "feature_controls"[\s\S]*<AdminFeatureControls/);
  for (const key of ["feature.configurator.enabled", "feature.clientPortal.enabled"]) assert.match(featureControls, new RegExp(key.replaceAll(".", "\\.")));
  assert.doesNotMatch(featureControls, /feature\.projectCalculator\.enabled|Project Costing enabled/);
  assert.match(featureControls, /Estimate Project Costing remains an operational workspace/);
  assert.doesNotMatch(featureControls, /EstimateCommercialWorkspace|ProjectCalculatorLabWorkspace|createDisposablePreviewEstimate/);
});

test("Admin information architecture uses meaningful subsection tabs", async () => {
  const [parent, integrations, installation] = await Promise.all([
    readFile("src/features/admin/AdminPlaceholderPage.tsx", "utf8"),
    readFile("src/features/admin/AdminIntegrationsPanel.tsx", "utf8"),
    readFile("src/features/projectCalculatorLab/CalculatorAdminCatalogue.tsx", "utf8"),
  ]);
  for (const label of ["Data & Demo", "Reference Numbering", "Commercial", "Import / Customs", "Customer View", "Survey / Site Visit"]) assert.match(parent, new RegExp(label.replace("/", "\\/")));
  for (const label of ["Workspace & Communications", "Location Services"]) assert.match(integrations, new RegExp(label.replace("&", "\\&")));
  for (const label of ["Equipment Hire", "Calculation Trail"]) assert.match(installation, new RegExp(label));
});

test("Project Costing uses the exact three-row Estimate hierarchy and governed FX", async () => {
  const [source, workspace, headerRows, app] = await Promise.all([
    readFile("src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx", "utf8"),
    readFile("src/features/estimateCommercial/EstimateCommercialWorkspace.tsx", "utf8"),
    readFile("src/features/estimateCommercial/EstimateCommercialHeaderRows.tsx", "utf8"),
    readFile("src/App.tsx", "utf8"),
  ]);
  for (const label of ["View Rate History", "Estimate Rate", "Live Rate", "Fixed costing rate used by this Estimate", "Refresh Rate", "Rate changed — refresh recommended"]) assert.match(source, new RegExp(label.replace("/", "\\/")));
  assert.match(source, /60_000/);
  assert.match(source, /AbortController/);
  assert.match(source, /window\.clearInterval\(timer\)/);
  assert.match(source, /\[\s*commercialView,\s*scenario\.id,\s*runtimePhase,\s*liveFxCapabilityAvailable,\s*\]/);
  assert.doesNotMatch(source, /\[scenario\.id, runtimeHealth\]/);
  assert.doesNotMatch(source, /project-costing__breadcrumbs|project-costing__sidebar|Manual costing|Position calculation trail|Programme calculation trail|internal diagnostic|Rate used when Estimate priced/);
  assert.match(source, /project-costing__worksheet-header[\s\S]*costing-sheet__columns/);
  assert.match(source, /data-costing-section=\{index\}/);
  for (const label of ["Estimate", "Create Revision", "Review Customer Quotation", "Files / Documents"]) assert.match(headerRows, new RegExp(label));
  assert.doesNotMatch(headerRows, /<details|More Estimate actions|⋮/);
  assert.match(headerRows, /<SupplierCommercialReview/);
  assert.match(headerRows, /data-project-costing-order="estimate"[\s\S]*data-project-costing-order="next-action"/);
  assert.match(workspace, /<EstimateCommercialHeaderRows[\s\S]*estimate-commercial__content/);
  assert.doesNotMatch(workspace, /estimate-commercial__breadcrumb/);
  assert.doesNotMatch(app, /dedicated-estimate-workspace[\s\S]*<H2>Estimate<\/H2>/);
  assert.doesNotMatch(source, /Saved · Revision/);
});

test("Supplier defaults omit fixed package prices while quotation package review remains governed", async () => {
  const [supplier, pricingEngine, quoteService, packageModel, review] = await Promise.all([
    readFile("src/features/admin/AdminSupplierCommercialDefaults.tsx", "utf8"),
    readFile("server/features/projectCalculatorLab/supplierCommercialPricing.js", "utf8"),
    readFile("server/features/supplierQuotes/supplierQuotesService.js", "utf8"),
    readFile("shared/quotationPackageModel.js", "utf8"),
    readFile("src/features/projectCalculatorLab/SupplierCommercialReview.tsx", "utf8"),
  ]);
  for (const label of ["Pricing Methods", "Suppliers", "Customer Presentation", "1 to 1 Pricing", "Factory Price", "Staged Discount"]) assert.match(supplier, new RegExp(label));
  assert.doesNotMatch(supplier, /Package Pricing|PackageEditor|packagePatch/);
  assert.match(supplier, /role="tablist"/);
  assert.match(supplier, />Delete</);
  assert.doesNotMatch(supplier, /Archive|Reactivate/);
  assert.match(supplier, /isMethodPlaceholder/);
  assert.doesNotMatch(supplier, /<details><summary>Package Pricing|<details><summary>Customer Presentation/);
  assert.doesNotMatch(supplier, /Import \/ Customs|importCustomsDefaults|Clearance Responsibility/);
  assert.match(pricingEngine, /packagePricingAvailable/);
  assert.match(pricingEngine, /selectedPackage/);
  assert.match(quoteService, /buildQuotationPackageEvidence/);
  assert.match(quoteService, /packages:evidencePackages,packagePricingAvailable:evidencePackages\.length>0/);
  for (const label of ["Supply Only", "Supply + Installation Support", "Supply + Install"]) assert.match(packageModel, new RegExp(label.replace("+", "\\+")));
  assert.match(packageModel, /amountProvenance: 'supplier_quotation'/);
  assert.match(review, /Canonical package meaning review/);
  assert.match(review, /correctQuotationPackageMeaning/);
});

test("Project Preferences owns the compact global Import Customs default", async () => {
  const [parent, defaults] = await Promise.all([readFile("src/features/admin/AdminPlaceholderPage.tsx", "utf8"), readFile("src/features/admin/AdminImportCustomsDefaults.tsx", "utf8")]);
  assert.match(parent, /activeSection === "project_preferences"[\s\S]*<AdminImportCustomsDefaults/);
  for (const value of ["Included by Default", "Base Import Cost GBP", "Cost Contingency %", "Default Number of Imports", "Default Duty %", "Import / Customs Markup %", "Import VAT is excluded"]) assert.match(defaults, new RegExp(value.replace("/", "\\/")));
  assert.match(defaults, /projectCalculator\.importCustomsDefaults/);
  assert.doesNotMatch(defaults, /Supplier-paid|Ecofenster-paid|supplierCode|supplierName/);
});
