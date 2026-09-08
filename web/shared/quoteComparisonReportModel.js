const text = (value) => String(value ?? "").trim();
const numeric = (value) => {
  const normalized = String(value ?? "").replace(/[^0-9.-]+/g, "");
  if (!normalized || normalized === "." || normalized === "-") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const QUOTE_COMPARISON_EVIDENCE_DISCLAIMER =
  "Assessment is based on the quotation and supporting evidence supplied to QuoteSuite. Missing or unstated information has not been assumed.";

const statusOrder = new Map([
  ["exact_match", 0],
  ["close_acceptable_alternative", 1],
  ["minor_difference", 2],
  ["alternative", 3],
  ["information_not_supplied", 4],
  ["review_required", 5],
  ["unmapped", 5],
  ["quantity_mismatch", 6],
  ["product_system_substitution", 6],
  ["material_mismatch", 7],
  ["dimension_mismatch", 8],
  ["configuration_mismatch", 8],
  ["missing", 9],
  ["additional", 9],
  ["not_applicable", 10],
]);

const assessment = {
  exact_match: { label: "Correct", tone: "positive" },
  close_acceptable_alternative: { label: "Acceptable alternative", tone: "warning" },
  minor_difference: { label: "Different specification", tone: "warning" },
  material_mismatch: { label: "Material mismatch", tone: "danger" },
  dimension_mismatch: { label: "Incorrect dimensions", tone: "danger" },
  quantity_mismatch: { label: "Incorrect quantity", tone: "danger" },
  configuration_mismatch: { label: "Wrong configuration", tone: "danger" },
  product_system_substitution: { label: "Product / system substitution", tone: "warning" },
  missing: { label: "Missing", tone: "danger" },
  additional: { label: "Additional", tone: "neutral" },
  alternative: { label: "Alternative", tone: "warning" },
  unmapped: { label: "Review required", tone: "warning" },
  information_not_supplied: { label: "Not supplied", tone: "neutral" },
  review_required: { label: "Not confirmed", tone: "warning" },
  not_applicable: { label: "Not applicable", tone: "neutral" },
};

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function canonicalSpecification(snapshot) {
  const source = record(snapshot.sourceSpecification);
  return record(snapshot.canonicalSpecification ?? source.canonical);
}

function evidenceValue(value) {
  if (value && typeof value === "object") return text(value.value ?? value.rawValue ?? value.label);
  return text(value);
}

function evidenceRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function recursiveEvidenceText(value, values = []) {
  if (typeof value === "string" || typeof value === "number") values.push(String(value));
  else if (Array.isArray(value)) for (const item of value) recursiveEvidenceText(item, values);
  else if (value && typeof value === "object") for (const item of Object.values(value)) recursiveEvidenceText(item, values);
  return values.join(" · ");
}

function thermalMetric(rawValue, evidence = {}) {
  const raw = text(rawValue);
  const match = raw.match(/-?\d+(?:[.,]\d+)?/);
  const value = match ? Number(match[0].replace(",", ".")) : null;
  const fraction = match?.[0].split(/[.,]/)[1] ?? "";
  return {
    raw: raw || null,
    value: Number.isFinite(value) ? value : null,
    precision: match ? fraction.length : null,
    basis: text(evidence.basis) || null,
    standard: text(evidence.standard) || null,
    status: match ? text(evidence.evidenceStatus) || "value_stated" : "not_stated",
  };
}

function securityEvidence(snapshot, canonical) {
  const explicit = evidenceRecord(canonical.securityEvidence);
  const corpus = recursiveEvidenceText([snapshot.sourceSpecification, snapshot.glassSpecification, snapshot.fittingsSpecification]);
  const standards = [...new Set([...(corpus.match(/\bRC[123]\b/gi) ?? []), ...(corpus.match(/\bPAS\s*24\b/gi) ?? []), ...(corpus.match(/Secured by Design/gi) ?? [])].map((value) => value.toUpperCase().replace(/\s+/g, "")))];
  if (explicit.status) return { status: text(explicit.status), label: text(explicit.claim) || standards.join(" / ") || "Security evidence stated", standards, certification: text(explicit.certification) || null };
  if (standards.length) return { status: /certif|tested/i.test(corpus) ? "specified_not_certified" : "specified_not_certified", label: standards.join(" / "), standards, certification: null };
  return { status: "not_stated", label: "Not stated", standards: [], certification: null };
}

function specificationValue(snapshot, labels) {
  const entries = Array.isArray(snapshot.customerSafeSpecification) ? snapshot.customerSafeSpecification : [];
  const matching = entries.find((entry) => labels.some((label) => text(entry?.label).toLowerCase().includes(label)));
  return text(matching?.value);
}

function offerAttributes(snapshot) {
  const canonical = canonicalSpecification(snapshot);
  const glazing = record(canonical.glazing);
  const panes = Array.isArray(canonical.glazingUnits) ? canonical.glazingUnits : [];
  const firstPane = record(panes[0]);
  const sashes = Array.isArray(canonical.sashes) ? canonical.sashes : [];
  const uwEvidence = evidenceRecord(canonical.thermalUw);
  const ugValue = snapshot.manufacturerQuotedUg ?? firstPane.ug;
  const uwValue = snapshot.manufacturerQuotedUw ?? uwEvidence.value;
  const gValue = firstPane.solarGainPercent ?? canonical.solarGainPercent;
  const ltValue = firstPane.lightTransmissionPercent ?? canonical.lightTransmissionPercent;
  return {
    measurements:
      numeric(snapshot.widthMm) && numeric(snapshot.heightMm)
        ? `${numeric(snapshot.widthMm)} × ${numeric(snapshot.heightMm)} mm`
        : "Not supplied",
    internalFinish: evidenceValue(canonical.internalFinish) || specificationValue(snapshot, ["internal", "inside"]) || "Not supplied",
    externalFinish: evidenceValue(canonical.externalFinish) || specificationValue(snapshot, ["external", "outside", "surface finishing"]) || "Not supplied",
    productSystem: [text(snapshot.product),text(snapshot.productSystem)].filter(Boolean).join(" · ") || specificationValue(snapshot,["product","system"]) || "Not supplied",
    productFamily: evidenceValue(canonical.productFamily) || "Not supplied",
    material: evidenceValue(canonical.material) || specificationValue(snapshot,["timber","material","wood"]) || "Not supplied",
    aluminiumCladding: evidenceValue(canonical.aluminiumCladding) || specificationValue(snapshot,["alu clad","aluminium clad"]) || "Not supplied",
    glass: text(snapshot.glassSpecification) || evidenceValue(glazing) || specificationValue(snapshot, ["glass"]) || "Not supplied",
    ug: text(ugValue) || "Not supplied",
    g: text(gValue) || "Not supplied",
    lt: text(ltValue) || "Not supplied",
    uw: text(uwValue) || "Not supplied",
    thermalEvidence: {
      ug: thermalMetric(ugValue, evidenceRecord(firstPane)),
      uw: thermalMetric(uwValue, uwEvidence),
      g: thermalMetric(gValue, evidenceRecord(firstPane)),
      lt: thermalMetric(ltValue, evidenceRecord(firstPane)),
    },
    security: securityEvidence(snapshot, canonical),
    hardware:
      text(snapshot.fittingsSpecification) ||
      sashes.map((item) => [item?.hardware, item?.fitting].map(text).filter(Boolean).join(" · ")).filter(Boolean).join("; ") ||
      specificationValue(snapshot, ["fittings", "hardware", "locking"]) ||
      "Not supplied",
    configuration: text(snapshot.configurationDescription) || sashes.map((item)=>text(item?.fitting)).filter(Boolean).join("; ") || text(snapshot.fittingsSpecification) || "Not supplied",
    division: evidenceValue(canonical.division) || "Not supplied",
    interfaces: [evidenceValue(canonical.sill),specificationValue(snapshot,["sill","routing","rebate","threshold"])].filter(Boolean).join(" · ") || "Not supplied",
  };
}

function completeness(attributes) {
  return ["measurements","internalFinish","externalFinish","productSystem","material","aluminiumCladding","glass","ug","g","lt","uw","hardware","configuration","division","interfaces"]
    .filter((key) => attributes[key] !== "Not supplied" && attributes[key] !== "Not confirmed").length;
}

function bestStatus(mappings) {
  return [...mappings].sort((left, right) => (statusOrder.get(left.differenceStatus) ?? 99) - (statusOrder.get(right.differenceStatus) ?? 99))[0];
}

function mostMaterialStatus(mappings) {
  return [...mappings].sort((left, right) => (statusOrder.get(right.differenceStatus) ?? 99) - (statusOrder.get(left.differenceStatus) ?? 99))[0];
}

function conciseDifference(mapping) {
  const first = Array.isArray(mapping.differences) ? mapping.differences[0] : null;
  if (!first) return assessment[mapping.differenceStatus]?.label ?? "Review required";
  if (first.note) return text(first.note);
  if (first.supplier == null) return `${text(first.field) || "Evidence"} not supplied`;
  return `${text(first.field) || "Evidence"}: ${text(first.supplier)} (reference ${text(first.baseline) || "not stated"})`;
}

function isAlternativeMapping(mapping) {
  const snapshot = record(mapping.supplierItemSnapshot);
  return mapping.relationshipKind === "alternative" || mapping.differenceStatus === "alternative" || text(snapshot.classification).toLowerCase() === "alternative";
}

function proposalCommercialNormalization(proposal) {
  return record(record(proposal.provenance).commercialNormalization);
}

function roundedMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function positionCommercialEvidence(proposal, meaningful, quantity) {
  const normalization = proposalCommercialNormalization(proposal);
  const products = record(normalization.productsSupply);
  const grossQuantityCost = meaningful.reduce((sum, mapping) => sum + (numeric(record(mapping.supplierItemSnapshot).totalPrice) ?? 0), 0) || null;
  const grossUnitCosts = meaningful.map((mapping) => numeric(record(mapping.supplierItemSnapshot).unitPrice)).filter((value) => value != null && value > 0);
  const discountPercentage = numeric(products.discountPercentage);
  const explicitDiscount = discountPercentage != null && discountPercentage > 0 && text(products.priceBasis) === "explicit_supplier_discount_applied_for_comparison";
  const factor = explicitDiscount ? 1 - discountPercentage / 100 : 1;
  const netQuantityCost = grossQuantityCost == null ? null : roundedMoney(grossQuantityCost * factor);
  const netItemCost = grossUnitCosts.length ? roundedMoney(grossUnitCosts[0] * factor) : quantity && netQuantityCost != null ? roundedMoney(netQuantityCost / quantity) : null;
  return {
    basis: explicitDiscount ? "explicit_discount_net_supply" : "quoted_net_supply",
    grossItemCost: grossUnitCosts[0] ?? null,
    grossQuantityCost,
    discountPercentage: explicitDiscount ? discountPercentage : null,
    discountAmount: grossQuantityCost == null || !explicitDiscount ? null : roundedMoney(grossQuantityCost - netQuantityCost),
    netItemCost,
    netQuantityCost,
    sourcePricesPreserved: true,
  };
}

function offerFromMappings(proposal, mappings, position, offerKind = "base") {
  const sourceMappings = mappings.filter((mapping) => !record(mapping.supplierItemSnapshot).generatedFromBaseline);
  const meaningful = sourceMappings.filter((mapping) => isAlternativeMapping(mapping) === (offerKind === "alternative"));
  if (offerKind === "alternative" && !meaningful.length) return null;
  const candidates = meaningful.length ? meaningful : mappings.filter((mapping) => !isAlternativeMapping(mapping));
  const chosen = candidates.length > 1 ? mostMaterialStatus(candidates) : bestStatus(candidates);
  const snapshot = record(chosen?.supplierItemSnapshot);
  const attrs = offerAttributes(snapshot);
  const commercialItems = meaningful.filter((mapping) => !record(mapping.supplierItemSnapshot).componentRole);
  const sourceReferences = new Set(commercialItems.map((mapping) => text(record(mapping.supplierItemSnapshot).customerReference ?? mapping.supplierItemReference).replace(/[^A-Z0-9]+/gi, "").toUpperCase()).filter(Boolean));
  const componentAssembly = commercialItems.length > 1 && sourceReferences.size === 1 && commercialItems.every((mapping) => numeric(record(mapping.supplierItemSnapshot).quantity) === position.quantity);
  const quantity = componentAssembly ? position.quantity : commercialItems.reduce((sum, mapping) => sum + (numeric(record(mapping.supplierItemSnapshot).quantity) ?? 0), 0) || null;
  const commercial = positionCommercialEvidence(proposal, meaningful, quantity);
  const groupedQuantityMatches = meaningful.length > 1 && quantity === position.quantity && meaningful.every((mapping) => {
    const item = record(mapping.supplierItemSnapshot);
    return item.componentRole || numeric(item.widthMm) === position.widthMm && numeric(item.heightMm) === position.heightMm && (mapping.differences || []).every((difference) => difference.field === "quantity");
  });
  const status = groupedQuantityMatches ? "exact_match" : chosen?.differenceStatus ?? "missing";
  const explanation = groupedQuantityMatches
    ? `Grouped supplier rows reconcile to the required quantity ${position.quantity} and dimensions.`
    : status === "quantity_mismatch" && quantity != null
      ? `Supplier rows total quantity ${quantity} (reference ${position.quantity}).`
      : chosen ? conciseDifference(chosen) : "No corresponding supplier item was mapped.";
  return {
    offerKey: `${proposal.id}:${offerKind}`,
    proposalId: proposal.id,
    supplierName: proposal.supplierName,
    manufacturerName: proposal.manufacturerName,
    reference: meaningful.map((mapping) => mapping.supplierItemReference).filter(Boolean).join(" + ") || "—",
    relationship: chosen?.relationshipKind ?? "missing",
    assessment: assessment[status] ?? assessment.review_required,
    assessmentCode: status,
    explanation,
    attributes: attrs,
    quantity,
    itemCost: commercial.netItemCost,
    quantityCost: commercial.netQuantityCost,
    commercial,
    currency: proposal.currency,
    scopeKind: proposal.scopeKind,
    isAlternative: offerKind === "alternative",
    evidenceCompleteness: completeness(attrs),
    mappingIds: mappings.map((mapping) => mapping.id),
    sourceSnapshots: meaningful.map((mapping) => record(mapping.supplierItemSnapshot)),
    mappingDifferences: meaningful.flatMap((mapping) => Array.isArray(mapping.differences) ? mapping.differences : []),
  };
}

const supplied = (value) => text(value) && !["not supplied","not confirmed","not applicable"].includes(text(value).toLowerCase());

function materialFamily(attributes) {
  const source = [attributes.productFamily, attributes.material, attributes.productSystem].map(text).join(" ").toLowerCase();
  if (/upvc|u-pvc|plastic/.test(source)) return "uPVC";
  if (/timber|wood|pine|spruce|oak/.test(source)) return "timber";
  if (/aluminium|aluminum/.test(source)) return "aluminium";
  return null;
}

function glazingKind(value) {
  const source = text(value).toLowerCase();
  if (!supplied(source)) return null;
  if (/solid|panel door/.test(source) && !/glass|glaz/.test(source)) return "solid";
  if (/triple|\b3l\b|(?:^|\D)3[- ]?pane/.test(source)) return "triple";
  if (/double|\b2l\b|(?:^|\D)2[- ]?pane/.test(source)) return "double";
  if (/glass|glaz/.test(source)) return "glazed";
  return null;
}

function ralCodes(value) {
  return [...new Set([...text(value).matchAll(/\bRAL\s*([0-9]{4})\b/gi)].map((match) => match[1]))];
}

function finishKind(value) {
  const source = text(value).toLowerCase();
  if (!supplied(source)) return null;
  if (/clear.*(?:lacquer|stain)|(?:lacquer|stain).*clear/.test(source)) return "clear timber finish";
  if (/white.*opaque|opaque.*white/.test(source)) return "white opaque";
  const ral = ralCodes(source);
  return ral.length ? `RAL ${ral.join("/")}` : null;
}

function openingKind(value) {
  const source = text(value).toLowerCase();
  if (!supplied(source)) return null;
  if (/fixed/.test(source)) return "fixed";
  if (/lift.?and.?slide|lift.?slide|sliding/.test(source)) return "sliding";
  if (/fully reversible|reversible/.test(source)) return "fully reversible";
  if (/tilt.?and.?turn|tilt.?turn/.test(source)) return "tilt and turn";
  if (/french door/.test(source)) return "French door";
  if (/entrance door|main door|panel.*door|\bdoor\b/.test(source)) return "door";
  return null;
}

function evidenceFeatures(value, definitions) {
  const source = text(value).toLowerCase();
  if (!supplied(source)) return [];
  return definitions.filter(([,pattern])=>pattern.test(source)).map(([label])=>label);
}

const hardwareDefinitions = [
  ["concealed hinges", /concealed hinge/],
  ["exposed hinges", /exposed hinge/],
  ["lockable handle", /lockable handle/],
  ["non-locking handle", /non[- ]?lock(?:ing)? handle/],
  ["cylinder", /cylinder/],
  ["day latch", /day latch/],
];
const interfaceDefinitions = [
  ["sill", /\bsill\b/],
  ["threshold", /threshold/],
  ["internal rebate", /internal rebate/],
  ["external rebate", /external rebate/],
  ["trickle vent", /trickle vent/],
];
const glassSafetyDefinitions = [
  ["toughened", /toughened|tempered/],
  ["laminated", /laminated/],
  ["float", /\bfloat\b/],
];

function alternativeSystem(baseline, supplier) {
  const base = text(baseline.productSystem).toLowerCase(), candidate = text(supplier.productSystem).toLowerCase();
  if (!supplied(base) || !supplied(candidate) || base === candidate) return false;
  return true;
}

function qualifyOffer(offer, baseline) {
  if (offer.isBaselineReference) return { ...offer, compliance: { status: "reference_requirement", label: "Reference requirement", compromises: [], materialFailures: [], reviewItems: [] }, commercial: { ...offer.commercial, comparabilityStatus: "comparable_supply", comparabilityReason: "Canonical customer selling value." } };
  const materialFailures = [], compromises = [], reviewItems = [];
  const mappingMaterial = ["dimension_mismatch","quantity_mismatch","configuration_mismatch","material_mismatch","missing"].includes(offer.assessmentCode);
  if (mappingMaterial) materialFailures.push(offer.explanation);
  const snapshots = offer.sourceSnapshots.length ? offer.sourceSnapshots : [{}];
  const families = [...new Set(snapshots.map((snapshot) => materialFamily(offerAttributes(snapshot))).filter(Boolean))];
  const baselineFamily = materialFamily(baseline.attributes);
  if (baselineFamily && families.some((family) => family !== baselineFamily)) materialFailures.push(`Material substitution: ${families.join(" / ")} offered; ${baselineFamily} required by the reference.`);
  const glazingKinds = [...new Set(snapshots.map((snapshot) => glazingKind(offerAttributes(snapshot).glass)).filter(Boolean))];
  const baselineGlazing = glazingKind(baseline.attributes.glass);
  if (baselineGlazing && glazingKinds.some((kind) => kind !== baselineGlazing && !(baselineGlazing === "glazed" && ["double","triple"].includes(kind)))) materialFailures.push(`Glazing/configuration compromise: ${glazingKinds.join(" / ")} offered; ${baselineGlazing} required.`);
  const baselineOpening = openingKind(baseline.attributes.configuration), offeredOpenings = [...new Set(snapshots.map((snapshot)=>openingKind(offerAttributes(snapshot).configuration)).filter(Boolean))];
  if (baselineOpening && offeredOpenings.length && offeredOpenings.some((value)=>value!==baselineOpening)) materialFailures.push(`Opening function differs: ${offeredOpenings.join(" / ")} offered; ${baselineOpening} required.`);
  else if (baselineOpening && !offeredOpenings.length) reviewItems.push("Opening function is not confirmed.");
  const requiredSafety = evidenceFeatures(baseline.attributes.glass,glassSafetyDefinitions).filter((value)=>value!=="float"), offeredSafety = [...new Set(snapshots.flatMap((snapshot)=>evidenceFeatures(offerAttributes(snapshot).glass,glassSafetyDefinitions)))];
  if (requiredSafety.length && offeredSafety.length && requiredSafety.some((value)=>!offeredSafety.includes(value))) materialFailures.push(`Safety glazing differs: ${offeredSafety.join(" / ")} offered; ${requiredSafety.join(" / ")} required.`);
  else if (requiredSafety.length && !offeredSafety.length) reviewItems.push(`Safety glazing is not confirmed (${requiredSafety.join(" / ")} required).`);
  for (const role of ["internalFinish","externalFinish"]) {
    const required = finishKind(baseline.attributes[role]);
    const offered = [...new Set(snapshots.map((snapshot) => finishKind(offerAttributes(snapshot)[role])).filter(Boolean))];
    if (required && offered.some((value) => value !== required)) compromises.push(`${role === "internalFinish" ? "Internal" : "External"} finish differs: ${offered.join(" / ")} offered; ${required} is the reference.`);
    else if (required && !offered.length) reviewItems.push(`${role === "internalFinish" ? "Internal" : "External"} finish not confirmed.`);
  }
  const systemSubstitution = alternativeSystem(baseline.attributes, offer.attributes);
  if (systemSubstitution) compromises.push(`Alternative product/system: ${offer.attributes.productSystem}.`);
  if (supplied(baseline.attributes.aluminiumCladding) && !snapshots.some((snapshot)=>supplied(offerAttributes(snapshot).aluminiumCladding))) reviewItems.push("Aluminium cladding is not confirmed.");
  const requiredHardware=evidenceFeatures(baseline.attributes.hardware,hardwareDefinitions),offeredHardware=[...new Set(snapshots.flatMap((snapshot)=>evidenceFeatures(offerAttributes(snapshot).hardware,hardwareDefinitions)))];
  if (requiredHardware.length && !offeredHardware.length) reviewItems.push(`Applicable hardware is not confirmed (${requiredHardware.join(" / ")} required).`);
  else for(const required of requiredHardware){const conflicting=(required==="concealed hinges"&&offeredHardware.includes("exposed hinges"))||(required==="exposed hinges"&&offeredHardware.includes("concealed hinges"))||(required==="lockable handle"&&offeredHardware.includes("non-locking handle"))||(required==="non-locking handle"&&offeredHardware.includes("lockable handle"));if(conflicting)compromises.push(`Hardware differs: ${offeredHardware.join(" / ")} offered; ${required} required.`)}
  const requiredInterfaces=evidenceFeatures(baseline.attributes.interfaces,interfaceDefinitions),offeredInterfaces=[...new Set(snapshots.flatMap((snapshot)=>evidenceFeatures(offerAttributes(snapshot).interfaces,interfaceDefinitions)))];
  if(requiredInterfaces.length&&!offeredInterfaces.length)reviewItems.push(`Interface detail is not confirmed (${requiredInterfaces.join(" / ")} required).`);
  else if(requiredInterfaces.some((value)=>!offeredInterfaces.includes(value)))compromises.push(`Interface detail differs: ${offeredInterfaces.join(" / ")||"not confirmed"} offered; ${requiredInterfaces.join(" / ")} required.`);
  if (baseline.attributes.division !== "Not supplied" && offer.attributes.division === "Not supplied") reviewItems.push("Pane/leaf division is not confirmed.");
  if (baseline.attributes.security.standards.length && !offer.attributes.security.standards.length) reviewItems.push(`Security evidence does not confirm ${baseline.attributes.security.standards.join(" / ")}.`);
  const materialCompromise = compromises.some((item) => !item.startsWith("Alternative product/system:"));
  const status = materialFailures.length ? "materially_non_compliant" : reviewItems.length ? "review_required" : materialCompromise || offer.assessmentCode === "close_acceptable_alternative" ? "acceptable_with_compromise" : "compliant";
  const label = status === "materially_non_compliant" ? "Material mismatch" : status === "review_required" ? "Review required" : status === "acceptable_with_compromise" ? "Acceptable with qualification" : "Correct";
  const assessmentCode = materialFailures.length ? (offer.assessmentCode === "exact_match" || offer.assessmentCode === "close_acceptable_alternative" ? "material_mismatch" : offer.assessmentCode) : offer.assessmentCode;
  const commerciallyComparable = !offer.isAlternative && !materialFailures.length && offer.commercial.netQuantityCost != null;
  return {
    ...offer,
    assessmentCode,
    assessment: materialFailures.length ? assessment.material_mismatch : status === "review_required" ? assessment.review_required : offer.assessment,
    compliance: { status, label, compromises, materialFailures, reviewItems },
    commercial: { ...offer.commercial, comparabilityStatus: commerciallyComparable ? "comparable_supply" : "not_comparable", comparabilityReason: commerciallyComparable ? "Net quoted Products / Supply value is isolated from package extras and services." : materialFailures.length ? "Material Position compliance failure prevents value ranking." : "Comparable net Products / Supply evidence is unavailable." },
  };
}

function rankingTuple(offer) {
  const complianceRank = { reference_requirement: 0, compliant: 0, acceptable_with_compromise: 1, review_required: 2, materially_non_compliant: 3 }[offer.compliance.status] ?? 4;
  const status = statusOrder.get(offer.assessmentCode) ?? 99;
  const securityRank = offer.attributes.security.status === "confirmed_certified" ? 0 : offer.attributes.security.status === "specified_not_certified" ? 1 : 2;
  const thermal = offer.attributes.thermalEvidence.uw.value ?? offer.attributes.thermalEvidence.ug.value ?? Number.POSITIVE_INFINITY;
  const price = offer.commercial.comparabilityStatus === "comparable_supply" ? offer.commercial.netQuantityCost ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
  return [complianceRank, status, securityRank, -offer.evidenceCompleteness, thermal, price, offer.supplierName.toLowerCase()];
}

function compareTuple(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  return 0;
}

function recommendationReason(offer) {
  const reasons = [offer.compliance.label.toLowerCase()];
  if (offer.compliance.materialFailures.length) reasons.push(offer.compliance.materialFailures[0]);
  else if (offer.compliance.compromises.length) reasons.push(offer.compliance.compromises[0]);
  if (offer.evidenceCompleteness >= 6) reasons.push("complete specification evidence");
  if (numeric(offer.attributes.uw) != null) reasons.push(`Uw ${offer.attributes.uw}`);
  if (offer.commercial.comparabilityStatus === "comparable_supply" && offer.commercial.netQuantityCost != null) reasons.push(`${offer.currency || ""} ${offer.commercial.netQuantityCost.toFixed(2)} comparable net supply cost`.trim());
  else reasons.push(offer.commercial.comparabilityReason.toLowerCase());
  return `${offer.supplierName}: ${reasons.join("; ")}.`;
}

function positionSummary(position, offers) {
  const material = offers.filter((offer) => offer.assessmentCode !== "missing");
  if (!material.length) return `No supplier proposal contains a confirmed corresponding item for ${position.reference}.`;
  const correct = material.filter((offer) => ["reference_requirement", "compliant"].includes(offer.compliance.status));
  const acceptable = material.filter((offer) => offer.compliance.status === "acceptable_with_compromise");
  const unresolved = material.filter((offer) => offer.compliance.status === "review_required");
  const parts = [];
  if (correct.length) parts.push(`${correct.map((offer) => offer.supplierName).join(", ")} ${correct.length === 1 ? "provides" : "provide"} the strongest evidenced match`);
  if (acceptable.length) parts.push(`${acceptable.map((offer) => `${offer.supplierName}: ${offer.compliance.compromises[0] || offer.explanation}`).join("; ")}`);
  const mismatches = material.filter((offer) => offer.compliance.status === "materially_non_compliant");
  if (mismatches.length) parts.push(`${mismatches.map((offer) => `${offer.supplierName}: ${offer.compliance.materialFailures[0] || offer.explanation}`).join("; ")}`);
  if (unresolved.length) parts.push(`${unresolved.map((offer) => offer.supplierName).join(", ")} require further evidence or review`);
  return `${parts.join(". ")}.`;
}

function lowestKnown(offers, field, lowerIsBetter = true) {
  const values = offers.map((offer) => ({ offer, value: numeric(field(offer)) })).filter((entry) => entry.value != null);
  if (!values.length) return null;
  values.sort((left, right) => lowerIsBetter ? left.value - right.value : right.value - left.value);
  const winningValue = values[0].value;
  return { ...values[0], ties: values.filter((entry) => entry.value === winningValue).map((entry) => entry.offer) };
}

function normalizePosition(position) {
  const width = numeric(position.widthMm);
  const height = numeric(position.heightMm);
  return {
    id: text(position.id),
    reference: text(position.positionRef ?? position.customerReference ?? position.reference ?? position.id),
    roomName: text(position.roomName),
    quantity: numeric(position.qty ?? position.quantity) ?? 1,
    measurements: width && height ? `${width} × ${height} mm` : "Not stated",
    configuration: text(position.configurationDescription ?? position.insertion ?? position.product ?? position.positionType) || "Not stated",
    widthMm: width,
    heightMm: height,
  };
}

function baselineOffer(source, position, comparison) {
  const supplier = text(source?.supplier?.name ?? source?.supplierName ?? source?.manufacturerName) || "QuoteSuite Estimate";
  const attributes = offerAttributes({
    ...source,
    quantity: position.quantity,
    configurationDescription: position.configuration,
    customerSafeSpecification: source?.customerSafeSpecification ?? source?.configuredContract?.customerSafeSpecification,
    canonicalSpecification: source?.canonicalSpecification ?? source?.configuredContract?.canonicalSpecification,
  });
  const candidateItemCost = numeric(source?.customerUnitPrice ?? source?.sellingUnitPrice ?? source?.itemPrice);
  const itemCost = candidateItemCost != null && candidateItemCost > 0 ? candidateItemCost : null;
  return {
    offerKey: "baseline-reference-estimate:base",
    proposalId: "baseline-reference-estimate",
    supplierName: supplier,
    manufacturerName: text(source?.manufacturerName ?? source?.sourceProvenance?.manufacturerName) || null,
    reference: position.reference,
    relationship: "reference",
    assessment: { label: "Reference specification", tone: "positive" },
    assessmentCode: "exact_match",
    explanation: "Canonical reference requirement; ranked without incumbent or brand preference.",
    attributes: { ...attributes, measurements: position.measurements, configuration: position.configuration },
    quantity: position.quantity,
    itemCost,
    quantityCost: itemCost == null ? null : itemCost * position.quantity,
    commercial: { basis: "customer_selling", grossItemCost: itemCost, grossQuantityCost: itemCost == null ? null : itemCost * position.quantity, discountPercentage: null, discountAmount: null, netItemCost: itemCost, netQuantityCost: itemCost == null ? null : itemCost * position.quantity, sourcePricesPreserved: true },
    currency: "GBP",
    scopeKind: text(comparison?.baselineSnapshot?.customerCommercial?.scopeKind) || "unresolved",
    isAlternative: false,
    evidenceCompleteness: completeness(attributes),
    mappingIds: [],
    sourceSnapshots: [source],
    mappingDifferences: [],
    isBaselineReference: true,
  };
}

function commercialBreakdown(normalizationValue, { currency, headlineTotal, scopeKind } = {}) {
  const normalization = record(normalizationValue);
  const products = record(normalization.productsSupply), extras = record(normalization.extras), delivery = record(normalization.delivery), installation = record(normalization.installation), survey = record(normalization.survey), vat = record(record(normalization.vat).evidence ?? normalization.vat);
  const netSupply = numeric(products.netAmount), grossSupply = numeric(products.grossListAmount), discountPercentage = numeric(products.discountPercentage), discountAmount = numeric(products.discountAmount);
  const normalisable = netSupply != null && netSupply > 0;
  return {
    currency: text(normalization.currency) || text(currency) || null,
    grossSupply,
    discountPercentage: discountPercentage && discountPercentage > 0 ? discountPercentage : null,
    discountAmount: discountAmount && discountAmount > 0 ? discountAmount : null,
    netSupply,
    extras: numeric(extras.amount),
    delivery: numeric(delivery.amount),
    installation: numeric(installation.amount),
    survey: numeric(survey.amount),
    vat: numeric(vat.amount),
    vatStatus: text(vat.status) || "not_stated",
    headlineTotal: numeric(normalization.headlineTotal ?? headlineTotal),
    scopeKind: text(scopeKind) || "unresolved",
    normalizationStatus: normalisable ? "net_supply_isolated" : "not_normalisable",
    normalizationReason: normalisable ? "Products / Supply net value is separated from evidenced extras, delivery and installation." : "Supply-only net value cannot be isolated from the available quotation evidence.",
    scopeEvidence: record(normalization.scopeEvidence),
    sourceReconciliation: record(normalization.sourceReconciliation),
  };
}

function clarification(category, message, positions = [], severity = "review") {
  return { category, message, positionReferences: [...new Set(positions.filter(Boolean))], severity };
}

function supplierClarifications(supplier, offers) {
  const result = [];
  const positionReferences = (predicate) => offers.filter(predicate).map((offer) => offer.positionReference);
  const material = positionReferences((offer) => offer.compliance.status === "materially_non_compliant");
  if (material.length) result.push(clarification("specification_or_geometry", "Confirm or revise the material specification, dimensions, quantity or configuration for the listed Positions.", material, "material"));
  const review = positionReferences((offer) => offer.compliance.status === "review_required");
  if (review.length) result.push(clarification("position_evidence", "Provide the missing Position evidence needed to confirm configuration, divisions or finishes.", review));
  const securityMissing = positionReferences((offer) => offer.attributes.security.status === "not_stated");
  if (securityMissing.length) result.push(clarification("security", "Confirm applicable PAS24 / security classification, security glazing and lock/hinge evidence; no certification is assumed from silence.", securityMissing));
  const thermalMissing = positionReferences((offer) => offer.attributes.thermalEvidence.uw.value == null);
  if (thermalMissing.length) result.push(clarification("thermal", "Provide actual-size Uw evidence and the calculation/test basis where available.", thermalMissing));
  const thermalStandardMissing = positionReferences((offer) => offer.attributes.thermalEvidence.uw.value != null && !offer.attributes.thermalEvidence.uw.standard);
  if (thermalStandardMissing.length) result.push(clarification("thermal_standard", "Confirm the standard and basis used for the stated Uw values.", thermalStandardMissing));
  const deliveryEvidence = record(supplier.commercial.scopeEvidence.delivery);
  if (["", "not_stated"].includes(text(deliveryEvidence.status))) result.push(clarification("delivery_offload", "Confirm delivery inclusion, site access, offload responsibility and any HIAB/crane or special-handling requirement."));
  const installationEvidence = record(supplier.commercial.scopeEvidence.installation);
  if (supplier.scopeKind === "supply_and_install" && ["", "not_stated"].includes(text(installationEvidence.status))) result.push(clarification("installation_boundary", "Confirm the installation amount and boundary, including survey, lifting, perimeter sealing, making good and commissioning."));
  result.push(clarification("quotation_validity", "Confirm quotation validity, lead time, payment terms and applicable warranty limitations."));
  return result;
}

export function buildQuoteComparisonReport(comparison) {
  const proposals = Array.isArray(comparison?.proposals) ? comparison.proposals.filter((proposal) => proposal.status !== "excluded") : [];
  const scopeCounts = new Map();
  for (const proposal of proposals) if (proposal.scopeKind && proposal.scopeKind !== "unresolved") scopeCounts.set(proposal.scopeKind, (scopeCounts.get(proposal.scopeKind) ?? 0) + 1);
  const commonScope = [...scopeCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
  const positions = (comparison?.baselineSnapshot?.positions ?? []).map((source) => {
    const position = normalizePosition(source);
    const referenceOffer = baselineOffer(source, position, comparison);
    const rawOffers = [referenceOffer, ...proposals.flatMap((proposal) => {
      const mappings = proposal.positionMappings.filter((mapping) => mapping.canonicalEstimatePositionId === position.id);
      return [offerFromMappings(proposal, mappings, position), offerFromMappings(proposal, mappings, position, "alternative")].filter(Boolean);
    })];
    const offers = rawOffers.map((offer) => ({ ...qualifyOffer(offer, referenceOffer), positionReference: position.reference }));
    const unresolved = offers.filter((offer) => !offer.isAlternative && ["review_required", "unmapped"].includes(offer.assessmentCode));
    const ranked = unresolved.length ? [] : offers.filter((offer) => offer.assessmentCode !== "missing").sort((left, right) => compareTuple(rankingTuple(left), rankingTuple(right)));
    const bestUw = lowestKnown(offers, (offer) => offer.attributes.thermalEvidence.uw.value);
    const bestUg = lowestKnown(offers, (offer) => offer.attributes.thermalEvidence.ug.value);
    const bestG = lowestKnown(offers, (offer) => offer.attributes.thermalEvidence.g.value, false);
    const bestLt = lowestKnown(offers, (offer) => offer.attributes.thermalEvidence.lt.value, false);
    const lowestComparable = lowestKnown(offers.filter((offer) => offer.commercial.comparabilityStatus === "comparable_supply"), (offer) => offer.commercial.netQuantityCost);
    const finding = (result, metric) => result ? { supplierName: result.ties.map((offer) => offer.supplierName).join(" / "), value: String(result.value), evidence: result.offer.attributes.thermalEvidence[metric] } : null;
    return {
      ...position,
      offers,
      report: positionSummary(position, offers),
      findings: {
        bestUw: finding(bestUw, "uw"),
        bestUg: finding(bestUg, "ug"),
        bestG: finding(bestG, "g"),
        bestLt: finding(bestLt, "lt"),
        lowestComparablePrice: lowestComparable ? { supplierName: lowestComparable.offer.supplierName, value: lowestComparable.value, currency: lowestComparable.offer.currency } : null,
      },
      recommendations: ranked.slice(0, 3).map((offer, index) => ({ rank: index + 1, supplierName: offer.supplierName, label: index === 0 ? "Best overall" : index === 1 ? "Second" : "Third", reason: recommendationReason(offer) })),
      recommendationStatus: unresolved.length ? "review_required" : "ready",
      recommendationMessage: unresolved.length ? `A reliable Top 3 is withheld until ${[...new Set(unresolved.map((offer) => offer.supplierName))].join(", ")} mapping/evidence is reviewed.` : null,
    };
  });

  const baselineCommercial = record(comparison?.baselineSnapshot?.customerCommercial);
  const baselineSupplier = positions[0]?.offers[0]?.supplierName || "QuoteSuite Estimate";
  const baselineCommercialBreakdown = commercialBreakdown(baselineCommercial.commercialNormalization, { currency: "GBP", headlineTotal: baselineCommercial.totalIncVatGbp ?? baselineCommercial.customerSellingExVatGbp ?? baselineCommercial.subtotalExVatGbp, scopeKind: baselineCommercial.scopeKind });
  const baselineSummary = {
    proposalId: "baseline-reference-estimate",
    supplierName: baselineSupplier,
    manufacturerName: positions[0]?.offers[0]?.manufacturerName ?? null,
    currency: "GBP",
    scopeKind: baselineCommercialBreakdown.scopeKind,
    total: baselineCommercialBreakdown.headlineTotal,
    commercial: baselineCommercialBreakdown,
    matched: positions.length,
    correct: positions.length,
    acceptable: 0,
    materialMismatch: 0,
    missing: 0,
    unresolved: 0,
    completeness: positions.reduce((sum, position) => sum + position.offers[0].evidenceCompleteness, 0),
    isBaselineReference: true,
  };
  const summaries = [baselineSummary, ...proposals.map((proposal) => {
    const offers = positions.map((position) => position.offers.find((offer) => offer.proposalId === proposal.id && !offer.isAlternative)).filter(Boolean);
    const count = (codes) => offers.filter((offer) => codes.includes(offer.assessmentCode)).length;
    const commercial = commercialBreakdown(proposalCommercialNormalization(proposal), { currency: proposal.currency, headlineTotal: proposal.originalTotalAmount, scopeKind: proposal.scopeKind });
    return {
      proposalId: proposal.id,
      supplierName: proposal.supplierName,
      manufacturerName: proposal.manufacturerName,
      currency: proposal.currency,
      scopeKind: proposal.scopeKind,
      total: commercial.headlineTotal,
      commercial,
      matched: offers.length - count(["missing"]),
      correct: offers.filter((offer) => offer.compliance.status === "compliant").length,
      acceptable: offers.filter((offer) => offer.compliance.status === "acceptable_with_compromise").length,
      materialMismatch: offers.filter((offer) => offer.compliance.status === "materially_non_compliant").length,
      missing: count(["missing"]),
      unresolved: offers.filter((offer) => offer.compliance.status === "review_required").length,
      completeness: offers.reduce((sum, offer) => sum + offer.evidenceCompleteness, 0),
    };
  })];
  const offerGroups = new Map(summaries.map((summary) => [summary.proposalId, positions.map((position) => position.offers.find((offer) => offer.proposalId === summary.proposalId && !offer.isAlternative)).filter(Boolean)]));
  for (const summary of summaries) summary.clarifications = supplierClarifications(summary, offerGroups.get(summary.proposalId) ?? []);
  const projectReviewRequired = proposals.some((proposal) => proposal.positionMappings.some((mapping) => !mapping.canonicalEstimatePositionId && ["review_required", "unmapped"].includes(mapping.differenceStatus)));
  const rankedSummaries = projectReviewRequired ? [] : [...summaries].sort((left, right) => compareTuple([
    left.materialMismatch + left.missing,
    left.unresolved,
    -left.correct,
    -left.acceptable,
    -left.completeness,
    left.commercial.normalizationStatus === "net_supply_isolated" ? 0 : 1,
    left.commercial.netSupply ?? Number.POSITIVE_INFINITY,
    left.supplierName.toLowerCase(),
  ], [
    right.materialMismatch + right.missing,
    right.unresolved,
    -right.correct,
    -right.acceptable,
    -right.completeness,
    right.commercial.normalizationStatus === "net_supply_isolated" ? 0 : 1,
    right.commercial.netSupply ?? Number.POSITIVE_INFINITY,
    right.supplierName.toLowerCase(),
  ]));
  return {
    version: "quote-comparison-position-report-v1",
    generatedFromRecordRevision: Number(comparison?.recordRevision ?? 0),
    disclaimer: QUOTE_COMPARISON_EVIDENCE_DISCLAIMER,
    commonScope,
    positions,
    suppliers: summaries,
    recommendations: rankedSummaries.slice(0, 3).map((supplier, index) => ({
      rank: index + 1,
      supplierName: supplier.supplierName,
      label: index === 0 ? "Best overall" : index === 1 ? "Second" : "Third",
      reason: `${supplier.correct} compliant, ${supplier.acceptable} acceptable with qualification, ${supplier.materialMismatch} material mismatch, ${supplier.missing} missing and ${supplier.unresolved} unresolved across ${positions.length} canonical Positions${supplier.commercial.netSupply == null ? "; comparable net supply price is not normalisable" : `; comparable net supply ${supplier.currency || ""} ${supplier.commercial.netSupply.toFixed(2)}`}.`,
    })),
    recommendationStatus: projectReviewRequired ? "review_required" : "ready",
    recommendationMessage: projectReviewRequired ? "A reliable project Top 3 is withheld until missing or unresolved Position evidence is reviewed." : null,
    clarifications: summaries.map((supplier) => ({ proposalId: supplier.proposalId, supplierName: supplier.supplierName, items: supplier.clarifications })),
  };
}
