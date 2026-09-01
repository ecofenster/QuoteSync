import { initializeSupplierCommercialSchema } from "../../server/schema/supplierCommercialSchema.js";
import { createCalculatorAdminService } from "../../server/features/projectCalculatorLab/calculatorAdminService.js";

export const CATALOGUE_REBIND_SCENARIO_ID = "installation-catalogue-rebind";

const historicalItem = (item) => {
  if (item.id === "me508_500540") return { ...item, label: "Illbruck ME508 500540 · EW-250 · 25 m · 1 roll/box", rateType: "box", priceAmount: "12", variant: { ...item.variant, productName: "Illbruck ME508", pricingUnit: "box" } };
  if (item.id === "fm330_750") return { ...item, label: "Illbruck FM330 Pro Foam Air Seal · 750 ml · 12/carton", priceAmount: null };
  if (item.id === "me902_500") return { ...item, label: "Illbruck ME902 spray primer · 500 ml · 12/carton", priceAmount: null, variant: { ...item.variant, unitsPerPack: 12 } };
  if (item.id === "aa270") return { ...item, label: "Illbruck AA270 Foam Gun Ultra", priceAmount: null };
  if (item.id === "ab005") return { ...item, label: "Illbruck AB005 tape accessory · 2 pc set", priceAmount: null, variant: { ...item.variant, unitsPerPack: 2 } };
  return item;
};

export async function seedInstallationCatalogueRebindFixture(db, { scenarioId = CATALOGUE_REBIND_SCENARIO_ID } = {}) {
  await db.exec("CREATE TABLE IF NOT EXISTS estimates(id TEXT PRIMARY KEY,positions_json TEXT DEFAULT '[]',project_address_json TEXT DEFAULT '{}',client_id TEXT,postcode TEXT);CREATE TABLE IF NOT EXISTS clients(id TEXT PRIMARY KEY,project_address_json TEXT DEFAULT '{}',customer_address_json TEXT DEFAULT '{}');");
  await initializeSupplierCommercialSchema(db);
  const admin = await createCalculatorAdminService(db).getConfiguration();
  const historicalCatalogue = admin.catalogue.map(historicalItem).concat([
    { id: "tp600_unconfigured", category: "illbruck_tp600", label: "Illbruck TP600 — variant requires reference data", rateType: "roll", priceAmount: null, currency: "GBP", variant: {}, active: true, version: 1 },
    { id: "tp601_unconfigured", category: "illbruck_tp601", label: "Illbruck TP601 — variant requires reference data", rateType: "roll", priceAmount: null, currency: "GBP", variant: {}, active: true, version: 1 },
  ]);
  const historicalRule = { ...admin.rules.installation_materials_v1, version: 5, value: { ...admin.rules.installation_materials_v1.value, version: 1, defaultBracketLengthMm: 200, frameScrewsPerBracket: 3, substrateFixingsPerBracket: undefined } };
  const now = "2026-08-30T07:14:10.966Z";
  const materialSelections = {
    ME508: { required: true, productId: "me508_500540", quantity: null },
    ME501: { required: true, productId: null, quantity: null },
    TP600: { required: true, productId: "tp600_unconfigured", quantity: null },
    FM330: { required: true, productId: "fm330_750", quantity: null },
    ME902: { required: true, productId: "me902_500", quantity: null },
    AA270: { required: true, productId: "aa270", quantity: 1 },
    AB005: { required: true, productId: "ab005", quantity: 1 },
  };
  await db.run("INSERT INTO project_calculator_lab_scenarios(id,name,currency,package_code,origin,revision_number,installation_opening_count,created_at,updated_at,target_gross_margin_percent) VALUES(?,?,?,?,?,?,?,?,?,?)", scenarioId, "Historical Installation catalogue", "GBP", "full_installation", "manual", 1, 1, now, now, "35");
  await db.run("INSERT INTO project_calculator_lab_markup_rules(scenario_id,product_percent,extras_percent,transport_percent,site_visit_percent,equipment_percent,installation_percent,materials_percent,duties_percent,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)", scenarioId, "40", "40", "20", "12", "0", "0", "37", "0", now);
  await db.run("INSERT INTO project_calculator_lab_options(scenario_id,options_json,updated_at) VALUES(?,?,?)", scenarioId, JSON.stringify({ projectType: "new_build", installationRequired: false, defaultFrameMaterial: "Timber", installationMaterials: { enabled: true, fixingMethod: "brackets", buildingType: null, bracketLengthMm: 200, bracketSelectionSource: "explicit", contingencyPercent: 15, packerCalculationMode: "per_fixing_position", packerMix: [], me508ProductId: "me508_500540", tp600ProductId: "tp600_unconfigured", materialSelections } }), now);
  await db.run("INSERT INTO project_calculator_lab_catalogue_snapshots(id,scenario_id,scenario_revision,catalogue_json,rules_json,package_rules_json,created_at) VALUES(?,?,?,?,?,?,?)", "historical-installation-snapshot", scenarioId, 1, JSON.stringify(historicalCatalogue), JSON.stringify({ ...admin.rules, installation_materials_v1: historicalRule }), JSON.stringify(admin.packageRules), now);
  await db.run("INSERT INTO project_calculator_lab_manual_product_rows(id,scenario_id,reference,product_class,width_mm,height_mm,quantity,installation_opening_count,unit_supply_cost_amount,total_supply_cost_amount,currency,evidence_origin,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", "fixture-product", scenarioId, "W1", "Window", 53000, 55020, 1, 1, "1000.00", "1000.00", "GBP", "manual", now, now);
  await db.run("INSERT INTO project_calculator_lab_manual_cost_lines(id,scenario_id,category,label,amount,currency,evidence_origin,included_in_current_estimate,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)", "fixture-normal-installation", scenarioId, "labour", "Ecofenster calculated installation", "4450.00", "GBP", "manual", 1, now, now);
  await db.run("INSERT INTO estimates(id,positions_json,project_address_json) VALUES(?,?,?)", "installation-fixture-estimate", "[]", "{}");
  await db.run("INSERT INTO supplier_quotes(id,estimate_id,supplier_code,supplier_name,created_at,updated_at) VALUES(?,?,?,?,?,?)", "installation-fixture-quote", "installation-fixture-estimate", "ECOHAUS", "EcoHaus", now, now);
  await db.run("INSERT INTO supplier_quote_revisions(id,supplier_quote_id,estimate_id,revision_sequence,supplier_quotation_number,full_quotation_reference,currency,vat_status,lifecycle_status,created_at,comparison_totals_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)", "installation-fixture-revision", "installation-fixture-quote", "installation-fixture-estimate", 1, "20260057", "20260057", "GBP", "ex_vat", "parsed", now, "[]");
  await db.run("INSERT INTO supplier_quote_attachments(id,estimate_id,revision_id,role,original_file_name,media_type,size_bytes,sha256,storage_key,parser_eligible,created_at,document_kind) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", "installation-fixture-attachment", "installation-fixture-estimate", "installation-fixture-revision", "original_quote", "EcoHaus.pdf", "application/pdf", 1, "a".repeat(64), `installation-fixture-${scenarioId}.pdf`, 1, now, "complete_quotation");
  await db.run("INSERT INTO supplier_quote_extras(id,estimate_id,revision_id,category,label,original_text,total_price_amount,currency,trace_json,created_at,included_in_supplier_total) VALUES(?,?,?,?,?,?,?,?,?,?,?)", "installation-fixture-extra", "installation-fixture-estimate", "installation-fixture-revision", "other", "Installation by ecoHaus", "Installation by ecoHaus", "10939.15", "GBP", "[]", now, 1);
  await db.run("INSERT INTO project_calculator_estimate_supplier_costs(id,scenario_id,source_extra_id,source_attachment_id,source_revision_id,source_snapshot_json,category,label,amount,currency,included_in_current_estimate,inclusion_evidence,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)", "installation-fixture-cost", scenarioId, "installation-fixture-extra", "installation-fixture-attachment", "installation-fixture-revision", JSON.stringify({ category: "other", commercialRole: "installation", originalDescription: "Installation by ecoHaus", supplierName: "EcoHaus" }), "other", "Installation by ecoHaus", "10939.15", "GBP", 1, "Explicitly included in the selected supplier package total.", now);
  const classifiedEvidence = [
    { key: "survey", category: "other", label: "On site Survey or Virtual Survey", amount: "967.71", role: "survey", includedInSupplierTotal: 1, evidence: "Explicitly included in the selected supplier package total." },
    { key: "cills", category: "sill", label: "External Aluminium Cills", amount: "2245.47", role: "external_cills", includedInSupplierTotal: 1, evidence: "Explicitly included in the selected supplier package total." },
    { key: "coupler", category: "accessory", label: "Timber/wood coupling profile", amount: "37.14", role: "coupling_profile", includedInSupplierTotal: 0, evidence: "Embedded in the Products / Supply list price and retained once." },
    { key: "delivery", category: "delivery", label: "Delivery to Site", amount: "3145.71", role: "delivery", includedInSupplierTotal: 1, evidence: "Explicitly included in the selected supplier package total." },
  ];
  for (const evidence of classifiedEvidence) {
    const extraId = `installation-fixture-extra-${evidence.key}`;
    await db.run("INSERT INTO supplier_quote_extras(id,estimate_id,revision_id,category,label,original_text,total_price_amount,currency,trace_json,created_at,included_in_supplier_total) VALUES(?,?,?,?,?,?,?,?,?,?,?)", extraId, "installation-fixture-estimate", "installation-fixture-revision", evidence.category, evidence.label, evidence.label, evidence.amount, "GBP", "[]", now, evidence.includedInSupplierTotal);
    await db.run("INSERT INTO project_calculator_estimate_supplier_costs(id,scenario_id,source_extra_id,source_attachment_id,source_revision_id,source_snapshot_json,category,label,amount,currency,included_in_current_estimate,inclusion_evidence,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)", `installation-fixture-cost-${evidence.key}`, scenarioId, extraId, "installation-fixture-attachment", "installation-fixture-revision", JSON.stringify({ category: evidence.category, commercialRole: evidence.role, originalDescription: evidence.label, supplierName: "EcoHaus" }), evidence.category, evidence.label, evidence.amount, "GBP", 1, evidence.evidence, now);
  }
  await db.run("INSERT INTO supplier_quote_import_runs(id,estimate_id,revision_id,extractor_name,extractor_version,adapter_code,adapter_version,recognition_version,started_at,completed_at,status,warnings_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", "installation-fixture-run", "installation-fixture-estimate", "installation-fixture-revision", "fixture", "1", "fixture", "1", "1", now, now, "completed", "[]");
  await db.run("INSERT INTO project_calculator_supplier_fx_snapshots(id,scenario_id,supplier_quote_revision_id,import_run_id,scenario_revision,supplier_currency,target_currency,provider,provider_timestamp,supplier_to_gbp_live_rate,rounded_up_rate,uplift_amount,calculated_selling_rate,supplier_to_gbp_selling_rate,adjustment_enabled,manually_overridden,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", "installation-fixture-fx", scenarioId, "installation-fixture-revision", "installation-fixture-run", 1, "GBP", "GBP", "identity", now, "1", "1", "0", "1", "1", 0, 0, now);
  await db.run("INSERT INTO project_calculator_supplier_quote_revisions(scenario_id,supplier_quote_id,revision_id,import_run_id,fx_snapshot_id,currency,linked_at) VALUES(?,?,?,?,?,?,?)", scenarioId, "installation-fixture-quote", "installation-fixture-revision", "installation-fixture-run", "installation-fixture-fx", "GBP", now);
  return { scenarioId, admin, historicalCatalogue, historicalRule };
}
