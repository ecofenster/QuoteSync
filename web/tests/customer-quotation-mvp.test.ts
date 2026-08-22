import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildCustomerQuotationProjection } from "../src/features/customerQuotation/customerQuotationProjection";
import { deriveProjectCostingCommercialResult } from "../src/features/projectCalculatorLab/domain/projectCostingCommercialResult";
import { DEFAULT_CUSTOMER_QUOTATION_DISPLAY_OPTIONS, resolveCustomerQuotationTechnicalLayout } from "../src/features/customerQuotation/customerQuotationDisplay";
import { isWideQuotationPosition, paginateCustomerQuotationPositions } from "../src/features/customerQuotation/customerQuotationPagination";
import { resolveManufacturerVisualAssetUrl } from "../src/features/manufacturerVisuals/manufacturerVisualAssetUrl";

const configuredContract = { schemaVersion: 1, source: "b92_configurator", product: { systemCode: "B92" } };
const estimate = { id: "estimate-1", estimateRef: "EF-EST-MVP-001", projectAddress: "1 Test Street", positions: [
  { id: "position-1", positionRef: "W01", roomName: "Kitchen", configuredContract },
] } as any;
const client = { clientName: "Disposable MVP Customer", projectName: "Quotation Test", projectAddress: "1 Test Street" } as any;

function scenario(fixed = true) {
  return {
    id: "scenario-1", name: "MVP", currency: "EUR", packageCode: "supply_only", origin: "supplier_import", importLabSessionId: null,
    extractionRunId: null, sourceAttachmentId: null, sourceRevision: null, revisionNumber: 7, installationOpeningCount: 0,
    createdAt: "2026-08-17T00:00:00.000Z", updatedAt: "2026-08-17T00:00:00.000Z",
    products: [
      { id: "row-1", scenarioId: "scenario-1", estimatePositionId: "position-1", sourceRowId: "supplier-secret-1", sourceSnapshot: { configuredContract, supplierPrice: "1234.56", manufacturerEvidence: { manufacturerItemNumber: null, customerReference: "W01", product: "92 Europa window", productSystem: null, configurationDescription: "View from inside Left opening", manufacturerQuotedUg: "0.51", manufacturerQuotedUw: "0.79", customerSafeSpecification: [{ ordinal: 2, label: "Glass unit", value: "Triple glazing (Ug=0.51 W/m²K)" }], sourceVisual: { status: "unavailable", reason: "No mapped image" } } }, evidenceOrigin: "supplier_import", displayReference: "W01", productClass: "Window", quantity: 2, widthMm: 1200, heightMm: 1400, installationOpeningCount: null, unitSupplyCost: "617.28", totalPrice: "1234.56", currency: "EUR", areaSquareMetres: "3.36", framePerimeterMetres: "10.4", originalAmount: "1234.56", originalCurrency: "EUR", fxSnapshot: { supplierCurrency: "EUR", supplierToGbpSellingRate: "0.81" }, gbpAmount: "980.00", commercialGbpAmount: "1000.00", markupPercent: "20", markupValue: "200.00", markedUpAmount: "1200.00", markupOverridePercent: null, includedInCurrentEstimate: true, classification: "standard" },
      { id: "row-2", scenarioId: "scenario-1", estimatePositionId: null, sourceRowId: "supplier-secret-2", sourceSnapshot: {}, evidenceOrigin: "supplier_import", displayReference: "D01", productClass: "Single door", quantity: 1, widthMm: 1000, heightMm: 2100, installationOpeningCount: null, unitSupplyCost: "650", totalPrice: "650", currency: "EUR", areaSquareMetres: "2.1", framePerimeterMetres: "6.2", originalAmount: "650", originalCurrency: "EUR", fxSnapshot: null, gbpAmount: "490", commercialGbpAmount: "500.00", markupPercent: "20", markupValue: "100", markedUpAmount: "600.00", markupOverridePercent: null, includedInCurrentEstimate: true, classification: "standard" },
      { id: "row-alt", scenarioId: "scenario-1", estimatePositionId: null, sourceRowId: "supplier-secret-alt", sourceSnapshot: {}, evidenceOrigin: "supplier_import", displayReference: "W01-ALT", productClass: "Window", quantity: 1, widthMm: 1200, heightMm: 1400, installationOpeningCount: null, unitSupplyCost: "700", totalPrice: "700", currency: "EUR", areaSquareMetres: "1.68", framePerimeterMetres: "5.2", originalAmount: "700", originalCurrency: "EUR", fxSnapshot: null, gbpAmount: "550", commercialGbpAmount: "560", markupPercent: "20", markupValue: "0", markedUpAmount: "0", markupOverridePercent: null, includedInCurrentEstimate: false, classification: "alternative", alternativeTo: "W01" },
    ],
    supplierCosts: [
      { id: "extra-1", scenarioId: "scenario-1", sourceAdditionalCostId: "evidence-extra", sourceSnapshot: {}, evidenceOrigin: "supplier_import", costKind: "supplier", category: "accessory", label: "Customer-facing cills", amount: "130", currency: "EUR", originalAmount: "130", originalCurrency: "EUR", fxSnapshot: null, gbpAmount: "98", commercialGbpAmount: "100.00", markupPercent: "25", markupValue: "25", markedUpAmount: "125.00", includedInCurrentEstimate: true },
      { id: "transport-1", scenarioId: "scenario-1", sourceAdditionalCostId: "evidence-delivery", sourceSnapshot: {}, evidenceOrigin: "supplier_import", costKind: "supplier", category: "delivery", label: "Supplier delivery", amount: "260", currency: "EUR", originalAmount: "260", originalCurrency: "EUR", fxSnapshot: null, gbpAmount: "196", commercialGbpAmount: "200.00", markupPercent: "10", markupValue: "20", markedUpAmount: "220.00", includedInCurrentEstimate: true },
    ],
    packageItems: [], routeSnapshots: [], supplierSummary: null, exchangeRate: null, exchangeRates: [],
    markups: { product: "20", extras: "25", transport: "10", siteVisit: "0", equipment: "0", installation: "0", materials: "0", duties: "0" },
    revisions: [], catalogueSnapshot: null,
    options: { projectType: "new_build", crewSize: 2, useIllbruck: false, bracketsRequired: false, stayAway: false, customerTransport: null, allocateTransportDifference: false, transportAllocationMethod: "proportional_value", transportCosting: { supplierTransportIncluded: true, storageCostsEnabled: false, storageCosts: "0", storageAllocateToProducts: false, storageAllocationAmount: "0", hiabDeliveryOffloadFeeEnabled: false, hiabDeliveryOffloadFee: "0", hiabAllocateToProducts: false, hiabAllocationAmount: "0", allocateToProducts: false, allocationAmount: "0", allocationMethod: "equal_per_position" } },
    transportCosting: { currency: "EUR", supplierTransportIncluded: true, originalSupplierTransport: "260", allocatedOriginalAmount: "0", remainingOriginalTransport: "260", allocatedPurchaseGbp: "0", allocatedCommercialGbp: "0", remainingSupplierPurchaseGbp: "196", remainingSupplierCommercialGbp: "200", storageCosts: "0", allocatedStorageCosts: "0", remainingStorageCosts: "0", hiabDeliveryOffloadFee: "0", allocatedHiabDeliveryOffloadFee: "0", remainingHiabDeliveryOffloadFee: "0", allocatedProductPurchaseGbp: "0", allocatedProductCommercialGbp: "0", transportPurchaseGbp: "196", transportCommercialGbp: "200" },
    transportAllocation: [], customerPricing: { discount: { mode: "percentage", percentage: "10", amount: "0" }, fixedSellingPrice: { enabled: fixed, amount: fixed ? "2000.00" : "0", currency: "GBP", basis: "ex_vat" } },
  } as any;
}

test("saved Project Costing is the single GBP customer pricing authority", () => {
  const commercial = deriveProjectCostingCommercialResult(scenario());
  assert.equal(commercial.calculatedSale, "1965.00");
  assert.equal(commercial.actualSale, "2000.00");
  assert.equal(commercial.commercialAdjustment, "35.00");
  const quote = buildCustomerQuotationProjection({ scenario: scenario(), client, estimate, previewDate: "2026-08-17T12:00:00.000Z" });
  assert.equal(quote.currency, "GBP");
  assert.equal(quote.subtotalExVatGbp, "2000.00");
});

test("supplier EUR purchase data and internal commercial fields cannot leak into the projection", () => {
  const input = scenario();
  input.supplierCommercialPolicies = [{ pricingMethod: "staged_discount", pricingProvenance: { matchedBandId: "private-band", parityPricingApplied: false }, standardDiscountStages: [{ label: "Discount 1", percentage: "30" }] }];
  const quote = buildCustomerQuotationProjection({ scenario: input, client, estimate });
  const serialized = JSON.stringify(quote);
  for (const internal of ["originalAmount", "originalCurrency", "fxSnapshot", "markupPercent", "grossMargin", "sourceRowId", "sourceAdditionalCostId", "supplier-secret", "1234.56", "pricingProvenance", "private-band", "Discount 1"]) assert.doesNotMatch(serialized, new RegExp(internal));
  assert.match(serialized, /GBP/);
});

test("fixed selling price, discount and VAT reconcile exactly", () => {
  const quote = buildCustomerQuotationProjection({ scenario: scenario(), client, estimate });
  assert.equal(quote.customerDiscountGbp, "180.00");
  assert.equal(quote.fixedPriceAdjustmentGbp, "35.00");
  assert.equal(quote.vatRatePercent, "20");
  assert.equal(quote.vatGbp, "400.00");
  assert.equal(quote.totalIncVatGbp, "2400.00");
});

test("saved Estimate VAT treatment drives customer totals and zero discounts collapse at the shared projection", () => {
  const input = scenario();
  input.options.vatTreatment = { code: "reduced_rate", percentage: "5", source: "manual_override", manuallyOverridden: true };
  input.customerPricing.discount = { mode: "percentage", percentage: "0", amount: "0" };
  const quote = buildCustomerQuotationProjection({ scenario: input, client, estimate });
  assert.equal(quote.vatRatePercent, "5");
  assert.equal(quote.vatGbp, "100.00");
  assert.equal(quote.totalIncVatGbp, "2100.00");
  assert.equal(quote.showCustomerDiscount, false);

  input.customerPricing.discount = { mode: "fixed", percentage: "0", amount: "50" };
  assert.equal(buildCustomerQuotationProjection({ scenario: input, client, estimate }).showCustomerDiscount, true);
});

test("save/reload JSON round-trip reproduces the same customer total without provider refresh", () => {
  const before = buildCustomerQuotationProjection({ scenario: scenario(), client, estimate });
  const reloaded = JSON.parse(JSON.stringify(scenario()));
  const after = buildCustomerQuotationProjection({ scenario: reloaded, client, estimate });
  assert.equal(after.subtotalExVatGbp, before.subtotalExVatGbp);
  assert.equal(after.totalIncVatGbp, before.totalIncVatGbp);
});

test("alternatives are visible separately and excluded from the primary total", () => {
  const quote = buildCustomerQuotationProjection({ scenario: scenario(false), client, estimate });
  assert.equal(quote.alternatives.length, 1);
  assert.equal(quote.alternatives[0].reference, "W01-ALT");
  assert.equal(quote.subtotalExVatGbp, "1965.00");
});

test("included Extras and customer Transport are presented once without allocation mechanics", () => {
  const quote = buildCustomerQuotationProjection({ scenario: scenario(), client, estimate });
  assert.deepEqual(quote.charges.filter((line) => line.id === "products").map((line) => line.amountGbp), ["1800.00"]);
  assert.equal(quote.productSupplySummary.length, 2);
  assert.deepEqual(quote.productSupplySummary[0], { reference: "W01", description: "92 Europa window", quantity: 2, dimensions: "1200 × 1400 mm", amountGbp: "1200.00" });
  assert.deepEqual(quote.charges.filter((line) => /cills/i.test(line.label)).map((line) => line.amountGbp), ["125.00"]);
  assert.deepEqual(quote.charges.filter((line) => /transport/i.test(line.label)).map((line) => line.amountGbp), ["220.00"]);
  assert.doesNotMatch(JSON.stringify(quote.charges), /supplier|allocation|storageAllocation|HIAB allocation/i);
});

test("customer Installation scope describes only commercially included snapshot components", () => {
  const input = scenario();
  input.options.installationRequired = true;
  input.options.installationProfile = { enabled: true };
  input.installationProgramme = {
    costs: { labour: "3500.00", mileage: "250.00", food: "0.00", accommodation: "0.00", support: "0.00", survey: "0.00", cillInstallation: "575.00", purchaseCost: "4325.00" },
    allowances: { nights: 0, foodDays: 0, supportDays: 0, surveyDays: 0, cillApplicableQuantity: 23, cillInstallationRate: "25.00" },
  };
  const quote = buildCustomerQuotationProjection({ scenario: input, client, estimate });
  assert.deepEqual(quote.installationInclusions, ["Installation labour", "Travel to site", "Cill installation for 23 applicable window(s)"]);
  assert.doesNotMatch(JSON.stringify(quote.installationInclusions), /day rate|markup|Accommodation|Food|Support|Survey/);
});

test("document-only penny residue does not create a fake Additional project items line", () => {
  const input = scenario();
  input.supplierCosts[0].markedUpAmount = "124.99";
  const quote = buildCustomerQuotationProjection({ scenario: input, client, estimate });
  assert.equal(quote.charges.some((line) => line.label === "Additional project items"), false);
});

test("imported evidence is customer-safe while native drawing remains unavailable until a document-safe provider exists", () => {
  const quote = buildCustomerQuotationProjection({ scenario: scenario(), client, estimate });
  assert.equal(quote.positions.length, 2);
  const configured = quote.positions.find((row) => row.reference === "W01");
  assert.equal(configured?.hasConfiguredDrawing, false);
  assert.equal(configured?.drawing.source, "unavailable");
  assert.equal(configured?.thermal?.ug, "0.51");
  assert.equal(configured?.thermal?.manufacturerQuotedUw, "0.79");
  assert.equal(configured?.specification[0]?.label, "Glass unit");
  const imported = quote.positions.find((row) => row.reference === "D01");
  assert.equal(imported?.hasConfiguredDrawing, false);
  assert.equal(imported?.description, "Single door");
  assert.equal(imported?.thermal, null);
  assert.deepEqual(imported?.sectionDetailIds, []);
});

test("customer-safe specification suppresses duplicate product, retains distinct product and projects retained glass sealing evidence", () => {
  const input = scenario();
  const row = input.products[0];
  row.sourceSnapshot.manufacturerEvidence.product = "Eco Therm+";
  row.sourceSnapshot.manufacturerEvidence.productSystem = "  eco therm+  ";
  row.sourceSnapshot.manufacturerEvidence.customerSafeSpecification = [
    { ordinal: 1, label: "Product", value: "Eco Therm+" },
    { ordinal: 2, label: "Glass unit", value: "Triple glazing" },
    { ordinal: 12, label: "Uw", value: "0.98" },
  ];
  row.sourceSnapshot.sourceTrace = [
    { extractedText: "9. Glass sealing:" },
    { extractedText: "internally: Glazing gasket Black," },
    { extractedText: "externally: Glazing gasket Black" },
    { extractedText: "10. Routing: for sill outside only" },
  ];
  let position = buildCustomerQuotationProjection({ scenario: input, client, estimate }).positions[0];
  assert.equal(position.specification.some((item) => item.label.toLowerCase() === "product"), false);
  assert.deepEqual(position.specification.find((item) => item.label === "Glass sealing"), { label: "Glass sealing", value: "Internally: Glazing gasket Black\nExternally: Glazing gasket Black" });
  assert.equal(position.specification.some((item) => /^(?:ug|uw|u-value)$/i.test(item.label)), false);
  assert.equal(position.configurationDescription, "View from inside Left opening");

  row.sourceSnapshot.manufacturerEvidence.productSystem = "Europa 92 Alu";
  row.sourceSnapshot.sourceTrace = [];
  position = buildCustomerQuotationProjection({ scenario: input, client, estimate }).positions[0];
  assert.deepEqual(position.specification.find((item) => item.label === "Product"), { label: "Product", value: "Eco Therm+" });
  assert.equal(position.specification.some((item) => item.label === "Glass sealing"), false);
});

test("reviewed manufacturer image is the customer-safe fallback without source evidence leakage", () => {
  const input = scenario(); const row = input.products.find((item) => item.displayReference === "D01")!;
  const evidence: Record<string, unknown> = {}; row.sourceSnapshot!.manufacturerEvidence = evidence;
  evidence.sourceVisual = { kind: "manufacturer_document_image", status: "available", mediaType: "image/png", url: "/api/manufacturer-position-visuals/0123456789012345678901234567890123456789/quotation.png", sourceMediaObject: "word/media/image22.emf", relationshipId: "rId27", originalAsset: { storageKey: "internal/source.emf" } };
  const quote = buildCustomerQuotationProjection({ scenario: input, client, estimate }); const drawing = quote.positions.find((item) => item.reference === "D01")!.drawing;
  assert.deepEqual(drawing, { source: "manufacturer", available: true, imageUrl: "/api/manufacturer-position-visuals/0123456789012345678901234567890123456789/quotation.png", mediaType: "image/png", orientation: "unknown" });
  assert.doesNotMatch(JSON.stringify(quote), /word\/media|rId27|internal\/source|supplierPrice/);
});

test("quotation display contract supports adaptive section and thermal combinations without reserved empty panels", () => {
  assert.deepEqual(DEFAULT_CUSTOMER_QUOTATION_DISPLAY_OPTIONS, { sectionDetails: "show", thermalPerformance: "full" });
  const fullThermal = { ufLeft: "0.89", ufTop: "0.89", ufRight: "0.89", ufBottom: "0.94", ug: "0.53", spacerPsi: "0.032", calculatedUw: "0.89" };
  assert.equal(resolveCustomerQuotationTechnicalLayout({ sectionDetails: "show", thermalPerformance: "full" }, { thermal: fullThermal, sectionDetailIds: ["head"] }).layout, "split");
  assert.equal(resolveCustomerQuotationTechnicalLayout({ sectionDetails: "hide", thermalPerformance: "full" }, { thermal: fullThermal, sectionDetailIds: ["head"] }).layout, "thermal_only");
  assert.equal(resolveCustomerQuotationTechnicalLayout({ sectionDetails: "show", thermalPerformance: "compact" }, { thermal: { ug: "0.53", calculatedUw: "0.89" }, sectionDetailIds: ["head"] }).layout, "split");
  assert.equal(resolveCustomerQuotationTechnicalLayout({ sectionDetails: "show", thermalPerformance: "hide" }, { thermal: fullThermal, sectionDetailIds: ["head"] }).layout, "sections_only");
  assert.equal(resolveCustomerQuotationTechnicalLayout({ sectionDetails: "hide", thermalPerformance: "hide" }, { thermal: null, sectionDetailIds: [] }).layout, "hidden");
  assert.equal(resolveCustomerQuotationTechnicalLayout({ sectionDetails: "show", thermalPerformance: "full" }, { thermal: null, sectionDetailIds: [] }).layout, "hidden");
  assert.doesNotMatch(JSON.stringify(fullThermal), /averageProjectUw/i);
});

test("pagination preserves order and pairs wide positions when half-page readability remains acceptable", () => {
  const quote = buildCustomerQuotationProjection({ scenario: scenario(), client, estimate });
  const standard = quote.positions[0];
  const pages = paginateCustomerQuotationPositions([
    standard,
    { ...standard, id: "standard-2", sequence: 2 },
    { ...standard, id: "wide", sequence: 3, widthMm: 5000, heightMm: 2100 },
    { ...standard, id: "standard-4", sequence: 4 },
  ]);
  assert.deepEqual(pages.map(page => page.positions.map(position => position.id)), [["row-1", "standard-2"], ["wide", "standard-4"]]);
  assert.equal(isWideQuotationPosition({ widthMm: 5000, heightMm: 2100, specification: standard.specification }), false);
  assert.equal(isWideQuotationPosition({ widthMm: 5000, heightMm: 2100, specification: Array.from({length:16},(_,index)=>({label:`Detail ${index}`,value:"Dense"})) }), true);
});

test("manufacturer visual URLs use the API origin without altering external assets", () => {
  assert.equal(resolveManufacturerVisualAssetUrl("/api/manufacturer-position-visuals/token/quotation.png"), "http://localhost:3001/api/manufacturer-position-visuals/token/quotation.png");
  assert.equal(resolveManufacturerVisualAssetUrl("https://cdn.example.test/image.png"), "https://cdn.example.test/image.png");
});

test("the canonical entry point and A4 print path are present and misleading legacy outputs are not exposed", async () => {
  const [workspace, preview, css, pickerActions, collectionActions, collectionView, costing, adminPreview] = await Promise.all([
    readFile("src/features/estimateCommercial/EstimateCommercialWorkspace.tsx", "utf8"),
    readFile("src/features/customerQuotation/CustomerQuotationPreview.tsx", "utf8"),
    readFile("src/features/customerQuotation/customerQuotation.css", "utf8"),
    readFile("src/features/estimatePicker/components/EstimateActionsBar.tsx", "utf8"),
    readFile("src/features/estimateCollection/EstimateCollectionActions.tsx", "utf8"),
    readFile("src/features/estimateCollection/EstimateCollectionView.tsx", "utf8"),
    readFile("src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx", "utf8"),
    readFile("src/features/admin/AdminSupplierQuoteImportBeta.tsx", "utf8"),
  ]);
  assert.match(workspace, /Customer Quotation\s*<\/button>/);
  assert.doesNotMatch(workspace, /aria-label="Estimate actions"/);
  for (const action of ["Email", "Follow up", "Estimate Status", "Copy", "Delete"]) assert.match(collectionView, new RegExp(action));
  assert.match(collectionView, /estimate-index-action-headings/);
  assert.match(collectionView, /<span>Email<\/span><span>Follow Up<\/span><span>Status<\/span><span>Copy<\/span><span>Delete<\/span><span>Open<\/span>/);
  assert.doesNotMatch(collectionView, /<th>Actions<\/th>/);
  assert.match(collectionView, /aria-label={`Open \$\{item\.estimateRef\}`}/);
  assert.match(preview, /window\.print\(\)/);
  assert.match(preview, /Print \/ Save PDF/);
  assert.match(preview, /Technical Schedule/);
  assert.match(preview, /Customer Quotation/);
  assert.match(preview, /data-document-template/);
  assert.match(preview, /data-thermal-mode/);
  assert.match(preview, /data-section-details/);
  assert.match(preview, /projection\.showCustomerDiscount/);
  assert.match(workspace, /aria-label="Commercial view"/);
  assert.match(workspace, /Internal View<\/button>/);
  assert.match(workspace, /Customer View<\/button>/);
  assert.match(costing, /Reference[\s\S]*Room[\s\S]*Item Type \/ Picture/);
  assert.match(costing, /data-commercial-view/);
  assert.match(adminPreview, /initialCommercialView="internal"/);
  assert.doesNotMatch(preview, /DOCX|Print Word Doc|supplier purchase price|purchase FX|gross margin|Supplier Import Lab/);
  assert.doesNotMatch(`${pickerActions}\n${collectionActions}`, />Print Word Doc<|>Print PDF</);
  assert.match(css, /@page\{size:A4 portrait/);
  assert.match(css, /height:297mm/);
  assert.match(css, /grid-template-rows:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /no-print/);
  assert.match(css, /estimate-commercial>:not\(\.customer-quotation__scrim\)/);
  assert.match(css, /customer-quotation-position__bar[\s\S]*-webkit-print-color-adjust:exact;print-color-adjust:exact/);
});

test("dedicated Estimate containment and simplified thermal-aware Products columns use shared canonical evidence", async () => {
  const [appCss, worksheet] = await Promise.all([
    readFile("src/App.css", "utf8"),
    readFile("src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx", "utf8"),
  ]);
  assert.match(appCss, /\.app-main-workspace > \.dedicated-estimate-workspace[\s\S]*height:\s*auto[\s\S]*overflow:\s*visible/);
  const header = worksheet.match(/<th>Reference<\/th>[\s\S]*?<th>Action<\/th>/)?.[0] ?? "";
  assert.match(header, /Preview \/ Product Image[\s\S]*<th>Ug<\/th>[\s\S]*<th>Uw<\/th>/);
  for (const removed of ["Supplier total", "Rate", "Markup"]) assert.doesNotMatch(header, new RegExp(`<th>${removed}<\\/th>`));
  assert.match(worksheet, /manufacturerQuotedUg[\s\S]*contractThermal\.ug[\s\S]*pricingInputs\.ug/);
});
