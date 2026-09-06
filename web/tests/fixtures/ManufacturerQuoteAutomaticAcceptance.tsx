import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import "../../src/features/estimateCommercial/estimateCommercialWorkspace.css";
import EstimateSupplierCostImportControl from "../../src/features/estimateCommercial/EstimateSupplierCostImportControl";

const counts = {
  sourcePositions: 1, rawBlocks: 20, candidatePositionBlocks: 1, parsedPositions: 1,
  selectedPositions: 0, validCanonicalPositions: 1, reviewRequiredPositions: 0,
  persistedPositions: 0, productsSupplyRows: 0, projectCostingRows: 0,
  includedRows: 1, alternativeRows: 0, excludedRows: 0, visualEvidence: 0,
  ambiguousVisualEvidence: 0,
};

const review = {
  estimateId: "fixture-estimate",
  positionCount: 1,
  metadata: {
    recognizedSupplierName: "EKO-OKNA",
    recognizedDealerName: "EKO-OKNA",
    recognizedManufacturerName: "EKO-OKNA",
    supplierIdentityRole: "quotation_issuer",
    manufacturerIdentityRole: "product_manufacturer",
    storedSupplierName: "Automatic identification pending",
    supplierResolutionStatus: "resolved",
    supplierResolutionMethod: "normalized_supplier_name",
    dealerResolutionStatus: "resolved",
    dealerResolutionMethod: "normalized_supplier_name",
    supplierName: "EKO-OKNA",
    supplierCode: "EKO",
    manufacturerResolutionStatus: "resolved",
    manufacturerResolutionMethod: "normalized_manufacturer_name",
    manufacturerId: "manufacturer-eko",
    manufacturerName: "EKO-OKNA",
    manufacturerCode: "EKO",
    supplierManufacturerRelationship: { relationship: "direct_manufacturer_supplier" },
    quotationNumber: "OF/25/2263569",
    quotationReferenceAuthority: "explicit_source_document",
    reviewedQuotationReference: null,
    sourceQuotationReference: "OF/25/2263569",
    sourceQuotationReferenceAuthority: "explicit_source_document",
    documentMetadataReference: null,
    revision: "",
    currency: "GBP",
    quotationDate: "2025-11-18",
    documentType: "complete_quotation",
    supplierQuotedSubtotal: "5989.85",
    supplierQuotedTotal: "5989.85",
  },
  canonicalManufacturers: [{ manufacturerId: "manufacturer-eko", manufacturerName: "EKO-OKNA", manufacturerCode: "EKO", updatedAt: "2026-09-03T00:00:00Z" }],
  commercialSuppliers: [{ supplierCode: "EKO", supplierName: "EKO-OKNA", pricingMethod: "factory_price", pricingPolicyAvailable: true, policyUpdatedAt: "2026-09-03T00:00:00Z" }],
  canonicalSuppliers: [{ supplierCode: "EKO", supplierName: "EKO-OKNA", pricingMethod: "factory_price", pricingPolicyAvailable: true, policyUpdatedAt: "2026-09-03T00:00:00Z" }],
  documents: [{
    quoteId: "auto-quote", revisionId: "auto-revision", attachmentId: "source",
    adapter: "eko_okna_pdf_v5", diagnostics: { status: "ready_to_confirm", message: "Ready", counts },
    commercialEvidence: {
      version: "fixture", currency: "GBP",
      categories: {
        productsSupply: { amount: "5989.85", automaticImport: true }, extras: { amount: "0.00", automaticImport: true },
        transport: { amount: "0.00", automaticImport: true }, installation: { amount: "0.00", automaticImport: false, decision: "evidence_only" },
        survey: { amount: "0.00", automaticImport: false, decision: "review_required" }, discount: null,
      },
      defaultImportedCost: "5989.85", supplierQuotedTotal: "5989.85", sourceReconciliation: null,
      productSupplyReconciliation: { version: "fixture", status: "reconciled_exact", blocking: false, expectedSubtotal: "5989.85", extractedSubtotal: "5989.85", variance: "0.00", tolerance: "0.01", contributors: [], excludedItems: [], reviewReasons: [] },
    },
    rows: [{
      rowKey: "source:0", include: true, technicallySelectable: true, commerciallyReady: true, commercialReadiness: "canonical_ready",
      manufacturerName: "EKO-OKNA", manufacturerItemNumber: "001", customerReference: "W1", roomLocation: "Kitchen",
      product: "Window", productSystem: "Eko system", configurationDescription: "Tilt and turn", widthMm: 1000, heightMm: 1200,
      areaSquareMetres: "1.2", weightKg: "45", glassSpecification: "Triple glazing", fittingsSpecification: "Standard fittings",
      quantity: 1, currency: "GBP", unitPrice: "5989.85", totalPrice: "5989.85", manufacturerQuotedUg: "0.5", manufacturerQuotedUw: "0.8",
      sourceSpecification: null, canonicalSpecification: null, sourceVisuals: [], sourceVisual: { status: "unavailable", reason: "Fixture has no visual." }, warnings: [],
    }],
  }],
};

const state = { uploads: 0, analyses: 0, imports: 0, importedReference: "", loadedMessage: "" };
Object.assign(window, { __manufacturerQuoteAcceptance: state });

globalThis.fetch = async (input, init) => {
  const url = String(input), method = String(init?.method ?? "GET").toUpperCase();
  let body: unknown = {};
  if (typeof init?.body === "string") body = JSON.parse(init.body);
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
  if (method === "POST" && /\/supplier-quotes$/.test(url)) return json({ id: "auto-quote", estimateId: "fixture-estimate", supplierCode: "AUTO-fixture", supplierName: "Automatic identification pending", createdAt: "now", updatedAt: "now", archivedAt: null }, 201);
  if (method === "POST" && /\/auto-quote\/revisions$/.test(url)) return json({ id: "auto-revision", supplierQuoteId: "auto-quote", estimateId: "fixture-estimate", revisionSequence: 1, supplierQuotationNumber: "", supplierRevision: "", fullQuotationReference: "Analysis pending", quotationDate: null, customerReference: null, currency: "XXX", vatStatus: "unknown", lifecycleStatus: "draft", isLatest: true, createdAt: "now" }, 201);
  if (method === "POST" && /\/auto-revision\/attachments$/.test(url)) { state.uploads += 1; return json({ attachments: [{ id: "source", estimateId: "fixture-estimate", revisionId: "auto-revision", role: "original_quote", documentKind: "complete_quotation", originalFileName: "synthetic-eko.pdf", mediaType: "application/pdf", sizeBytes: 20, sha256: "a".repeat(64), parserEligible: true, uploadedBy: "fixture", uploadOrder: 1, createdAt: "now" }] }, 201); }
  if (method === "POST" && /\/prepare-review$/.test(url)) { state.analyses += 1; return json(review); }
  if (method === "POST" && /\/extract-and-load$/.test(url)) {
    state.imports += 1;
    state.importedReference = String((body as { metadata?: { quotationNumber?: string } }).metadata?.quotationNumber ?? "");
    const confirmed = { ...counts, selectedPositions: 1, persistedPositions: 1, productsSupplyRows: 1, projectCostingRows: 1 };
    return json({ scenarioId: "fixture-scenario", status: "confirmed", operationStatus: "confirmed", counts: confirmed, documents: [{ revisionId: "auto-revision", loadedProducts: 1, duplicateProducts: 0, diagnostics: { status: "confirmed", message: "Confirmed", counts: confirmed } }], costing: null, postConfirmationWarnings: [] });
  }
  return json({ error: `Unexpected request ${method} ${url}` }, 404);
};

function App() {
  const [loaded, setLoaded] = useState("");
  return <main className="app-main-workspace"><section className="estimate-commercial"><div className="estimate-commercial__modal ui-card"><header><div><h2>Import Manufacturer Quote</h2><p>Upload once, confirm the detected quotation identity, review extraction, then approve the Project Costing import.</p></div></header><EstimateSupplierCostImportControl estimateId="fixture-estimate" scenarioId="fixture-scenario" onLoaded={(message) => { state.loadedMessage = message ?? ""; setLoaded(message ?? "Loaded"); }}/>{loaded ? <output>{loaded}</output> : null}</div></section></main>;
}

document.documentElement.dataset.theme = "dark";
createRoot(document.getElementById("root")!).render(<App />);
