const text = (value) => String(value ?? "").trim();
const numeric = (value) => {
  const normalized = String(value ?? "").replace(/[^0-9.-]+/g, "");
  if (!normalized || normalized === "." || normalized === "-") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};
const moneyText = (value, currency) => `${currency === "GBP" ? "£" : currency === "EUR" ? "€" : currency ? `${currency} ` : ""}${Number(value).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

function sourceFieldEvidence(sourceSpecification, sourceFieldId) {
  if (!sourceFieldId) return {};
  const sections = Array.isArray(sourceSpecification?.sections) ? sourceSpecification.sections : [];
  const field = sections.flatMap((section) => Array.isArray(section?.fields) ? section.fields : []).find((item) => item?.id === sourceFieldId);
  return field ? {
    sourceFieldId,
    sourcePage: Number.isInteger(Number(field.sourcePage)) ? Number(field.sourcePage) : null,
    evidenceClass: text(field.evidenceClass) || null,
    inheritedFromSystem: text(field.inheritedFromSystem) || null,
  } : { sourceFieldId, sourcePage: null, evidenceClass: null, inheritedFromSystem: null };
}

function canonicalEvidence(value, sourceSpecification) {
  const evidence = evidenceRecord(value);
  return { ...evidence, ...sourceFieldEvidence(sourceSpecification, evidence.sourceFieldId) };
}

function recursiveEvidenceText(value, values = []) {
  if (typeof value === "string" || typeof value === "number") values.push(String(value));
  else if (Array.isArray(value)) for (const item of value) recursiveEvidenceText(item, values);
  else if (value && typeof value === "object") for (const item of Object.values(value)) recursiveEvidenceText(item, values);
  return values.join(" · ");
}

function thermalMetric(rawValue, evidence = {}, { positive = false } = {}) {
  const raw = text(rawValue);
  const match = raw.match(/-?\d+(?:[.,]\d+)?/);
  const parsed = match ? Number(match[0].replace(",", ".")) : null;
  const valid = Number.isFinite(parsed) && (!positive || parsed > 0);
  const fraction = match?.[0].split(/[.,]/)[1] ?? "";
  return {
    raw: raw || null,
    value: valid ? parsed : null,
    precision: match ? fraction.length : null,
    basis: text(evidence.basis) || null,
    standard: text(evidence.standard) || null,
    standardSizeMm: evidence.standardSizeMm && Number(evidence.standardSizeMm.width) > 0 && Number(evidence.standardSizeMm.height) > 0
      ? { width: Number(evidence.standardSizeMm.width), height: Number(evidence.standardSizeMm.height) }
      : null,
    qualification: text(evidence.qualification) || null,
    sourceFieldId: text(evidence.sourceFieldId) || null,
    sourcePage: Number.isInteger(Number(evidence.sourcePage)) ? Number(evidence.sourcePage) : null,
    inheritedFromSystem: text(evidence.inheritedFromSystem) || null,
    valueKind: text(evidence.valueKind) || (text(evidence.basis) === "actual_position_size" ? "actual_position" : text(evidence.basis).startsWith("system_") ? "system_standard" : "quoted_value"),
    label: text(evidence.label) || null,
    meaning: text(evidence.meaning) || null,
    status: match ? valid ? text(evidence.evidenceStatus) || "value_stated" : "invalid_value" : "not_stated",
  };
}

function thermalDisplay(metric) {
  if (metric.value != null) {
    if (metric.meaning === "whole_door_ud") return `${metric.raw} (supplier label; whole-door Ud meaning)`;
    if (metric.valueKind === "system_standard") {
      const size = metric.standardSizeMm
        ? `${metric.standardSizeMm.width} × ${metric.standardSizeMm.height} mm`
        : "standard size";
      return `${metric.raw} (${size}; standard-size value, not an actual-Position calculation)`;
    }
    return metric.raw;
  }
  if (metric.status === "not_applicable") return "Not applicable";
  return metric.status === "invalid_value" ? `Invalid source value (${metric.raw})` : "Not supplied";
}

const DEFAULT_ANNUAL_THERMAL_ASSUMPTION = Object.freeze({
  source: "illustrative_assumption",
  degreeDaysKDaysPerYear: 2500,
  baseTemperatureC: null,
  location: null,
  label: "Illustrative assumption: 2,500 K·days/year; a location-specific heating-degree-day base was not available in the retained comparison.",
});

function annualThermalAssumption(comparison) {
  const retained = record(comparison?.baselineSnapshot?.thermalComparisonClimate);
  const degreeDays = numeric(retained.degreeDaysKDaysPerYear);
  if (!(degreeDays > 0) || !text(retained.source)) return { ...DEFAULT_ANNUAL_THERMAL_ASSUMPTION };
  return {
    source: text(retained.source),
    degreeDaysKDaysPerYear: degreeDays,
    baseTemperatureC: numeric(retained.baseTemperatureC),
    location: text(retained.location) || null,
    label: `${text(retained.location) || "Project location"}: ${degreeDays.toLocaleString("en-GB")} K·days/year${numeric(retained.baseTemperatureC) == null ? "" : ` at ${numeric(retained.baseTemperatureC)}°C base`} · ${text(retained.source)}.`,
  };
}

function roundedMetricBounds(metric) {
  if (metric?.value == null || !Number.isInteger(metric.precision) || metric.precision < 0) return null;
  const halfStep = 0.5 * (10 ** -metric.precision);
  return { minimum: Math.max(0, metric.value - halfStep), maximum: metric.value + halfStep };
}

function annualHeatLossComparison(offer, baseline, position, assumption) {
  if (offer.isBaselineReference) return { status: "reference", display: "Selected supplier thermal reference.", deltaKwh: 0, minimumKwh: 0, maximumKwh: 0 };
  const candidate = offer.attributes.thermalEvidence.uw;
  const reference = baseline.attributes.thermalEvidence.uw;
  const sameDimensions = offer.attributes.measurements === baseline.attributes.measurements && position.widthMm > 0 && position.heightMm > 0;
  const sameQuantity = numeric(offer.quantity) === numeric(position.quantity);
  const wholeElementEvidence = candidate.value != null && reference.value != null
    && candidate.valueKind === "actual_position" && reference.valueKind === "actual_position"
    && ["whole_product_uw", "whole_door_ud"].includes(candidate.meaning)
    && ["whole_product_uw", "whole_door_ud"].includes(reference.meaning);
  const materialThermalDifference = offer.referenceAssessment.differences.some((item) => /^(?:Dimensions|Quantity|Opening operation|Glazing(?: build-up| safety)?|Material\/timber):/i.test(item));
  if (!wholeElementEvidence || !sameDimensions || !sameQuantity || offer.completePositionPriceEligible === false) {
    return { status: "not_comparable", display: "Not calculated — whole-element value, geometry, quantity or product scope is not sufficiently comparable.", deltaKwh: null, minimumKwh: null, maximumKwh: null };
  }
  const area = (position.widthMm * position.heightMm / 1_000_000) * position.quantity;
  const elementArea = position.widthMm * position.heightMm / 1_000_000;
  const factor = area * assumption.degreeDaysKDaysPerYear * 24 / 1000;
  const delta = (candidate.value - reference.value) * factor;
  const candidateBounds = roundedMetricBounds(candidate), referenceBounds = roundedMetricBounds(reference);
  const minimum = candidateBounds && referenceBounds ? (candidateBounds.minimum - referenceBounds.maximum) * factor : delta;
  const maximum = candidateBounds && referenceBounds ? (candidateBounds.maximum - referenceBounds.minimum) * factor : delta;
  const rounded = (value) => Number(Math.abs(value).toFixed(1)).toLocaleString("en-GB", { maximumFractionDigits: 1 });
  const centralDirection = delta < 0 ? "less" : "more";
  let display = `Approximately ${rounded(delta)} kWh ${centralDirection} heat lost per year than ${baseline.supplierName}, using the quoted central Uw values, ${Number(elementArea.toFixed(2))} m² element area, quantity ${position.quantity} and ${assumption.source === "illustrative_assumption" ? "illustrative " : ""}${assumption.degreeDaysKDaysPerYear.toLocaleString("en-GB")} K·days/year.`;
  if (minimum <= 0 && maximum >= 0) display += ` The suppliers’ quoted precision gives an illustrative range from approximately ${rounded(minimum)} kWh less to ${rounded(maximum)} kWh more, so rounding alone does not prove the direction.`;
  else {
    const rangeDirection = maximum < 0 ? "less" : "more";
    const low = Math.min(Math.abs(minimum), Math.abs(maximum)), high = Math.max(Math.abs(minimum), Math.abs(maximum));
    display += ` Allowing for quoted rounding, the estimated range is ${rounded(low)}–${rounded(high)} kWh ${rangeDirection}.`;
  }
  if (materialThermalDifference) display += " This is an illustrative transmission comparison only because retained specification differences mean suitability is not yet confirmed.";
  return { status: materialThermalDifference ? "illustrative" : "estimated", display, deltaKwh: delta, minimumKwh: minimum, maximumKwh: maximum, equivalentAreaM2: area, degreeDaysKDaysPerYear: assumption.degreeDaysKDaysPerYear };
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

function glazingSpecificationValue(snapshot) {
  const entries = Array.isArray(snapshot.customerSafeSpecification) ? snapshot.customerSafeSpecification : [];
  const matching = entries.find((entry) => {
    const label = text(entry?.label).toLowerCase();
    return /glass|glazing/.test(label) && !/seal|gasket|spacer/.test(label);
  });
  return text(matching?.value);
}

function glazingEvidenceScore(value) {
  const source = text(value);
  if (!supplied(source)) return -1;
  let score = source.length;
  if (/\b(?:triple|double)\b|\d+(?:[.,]\d+)?\s*Ar\b/i.test(source)) score += 40;
  if (/\b(?:toughened|tempered|laminated|float)\b|\b(?:TGH|TUF|LAM|FL)\b/i.test(source)) score += 80;
  if (/[#/].*[#/]/.test(source)) score += 30;
  return score;
}

function embeddedGlazingValue(value) {
  const source = text(value);
  const match = source.match(/\b(?:triple|double)\s*:?[\s\S]*$/i);
  return match && glazingEvidenceScore(match[0]) >= 100 ? match[0] : source;
}

function richestGlazingEvidence(snapshot, canonical, glazing, panes) {
  const candidates = [
    text(snapshot.glassSpecification),
    evidenceValue(glazing),
    ...panes.map((pane) => text(pane?.glassBuildUp)),
    glazingSpecificationValue(snapshot),
    embeddedGlazingValue(evidenceValue(canonical.aluminiumCladding)),
  ].filter(supplied);
  return candidates.sort((left, right) => glazingEvidenceScore(right) - glazingEvidenceScore(left))[0] || "Not supplied";
}

function aluminiumCladdingValue(value) {
  const source = evidenceValue(value);
  if (/^aluminium\s+clad\s+(?:triple|double)\b/i.test(source)) return source.replace(/\s+(?:triple|double)\b[\s\S]*$/i, "");
  return source;
}

function offerAttributes(snapshot) {
  const sourceSpecification = record(snapshot.sourceSpecification);
  const canonical = canonicalSpecification(snapshot);
  const glazing = record(canonical.glazing);
  const panes = Array.isArray(canonical.glazingUnits) ? canonical.glazingUnits : [];
  const firstPane = record(panes[0]);
  const sashes = Array.isArray(canonical.sashes) ? canonical.sashes : [];
  const uwEvidence = canonicalEvidence(canonical.thermalUw, sourceSpecification);
  const systemUwEvidence = canonicalEvidence(canonical.systemThermalPerformance, sourceSpecification);
  const ugValue = snapshot.manufacturerQuotedUg ?? firstPane.ug;
  const positionUwValue = snapshot.manufacturerQuotedUw ?? uwEvidence.value;
  const gValue = firstPane.solarGainPercent ?? canonical.solarGainPercent;
  const ltValue = firstPane.lightTransmissionPercent ?? canonical.lightTransmissionPercent;
  const productSystem = [text(snapshot.product),text(snapshot.productSystem)].filter(Boolean).join(" · ") || specificationValue(snapshot,["product","system"]) || "Not supplied";
  const configuration = text(snapshot.configurationDescription) || sashes.map((item)=>text(item?.fitting)).filter(Boolean).join("; ") || text(snapshot.fittingsSpecification) || "Not supplied";
  const glassValue = richestGlazingEvidence(snapshot, canonical, glazing, panes);
  const solidUnglazedDoor = glazingKind(glassValue) === "solid" && /\bdoor\b/i.test(`${productSystem} ${configuration}`);
  const canonicalSystem = evidenceValue(canonical.system) || text(snapshot.productSystem);
  const inheritedSystem = text(sourceSpecification.inheritance?.system || systemUwEvidence.inheritedFromSystem);
  const systemScoped = Boolean(canonicalSystem && inheritedSystem && canonicalSystem.toLowerCase() === inheritedSystem.toLowerCase());
  const systemUwApplies = positionUwValue == null && systemUwEvidence.value != null && systemScoped && !/\bdoor\b|lift.?slide|sliding/i.test(`${productSystem} ${configuration}`);
  const selectedUwEvidence = positionUwValue != null
    ? { ...uwEvidence, valueKind: "actual_position", label: "Uw", meaning: solidUnglazedDoor ? "whole_door_ud" : "whole_product_uw" }
    : systemUwApplies
      ? { ...systemUwEvidence, valueKind: "system_standard", label: "Uw", meaning: "standard_window_uw" }
      : { ...uwEvidence, label: "Uw", meaning: solidUnglazedDoor ? "whole_door_ud" : "whole_product_uw" };
  const ugEvidence = thermalMetric(ugValue, canonicalEvidence(firstPane, sourceSpecification), { positive: true });
  if (solidUnglazedDoor) {
    ugEvidence.status = "not_applicable";
    ugEvidence.value = null;
    ugEvidence.label = "Ug";
    ugEvidence.meaning = "centre_pane_glass";
    ugEvidence.qualification = ugValue != null ? `The source value ${text(ugValue)} is not used because this is a solid unglazed door.` : "Ug applies to glazing and is not applicable to this solid unglazed door.";
  }
  const thermalEvidence = {
    ug: ugEvidence,
    uw: thermalMetric(positionUwValue ?? (systemUwApplies ? systemUwEvidence.value : null), selectedUwEvidence, { positive: true }),
    g: thermalMetric(gValue, evidenceRecord(firstPane)),
    lt: thermalMetric(ltValue, evidenceRecord(firstPane)),
  };
  return {
    measurements:
      numeric(snapshot.widthMm) && numeric(snapshot.heightMm)
        ? `${numeric(snapshot.widthMm)} × ${numeric(snapshot.heightMm)} mm`
        : "Not supplied",
    internalFinish: evidenceValue(canonical.internalFinish) || specificationValue(snapshot, ["internal", "inside", "surface finishing"]) || "Not supplied",
    externalFinish: evidenceValue(canonical.externalFinish) || specificationValue(snapshot, ["external", "outside", "alu cladded", "aluminium clad"]) || "Not supplied",
    productSystem,
    productFamily: evidenceValue(canonical.productFamily) || "Not supplied",
    material: evidenceValue(canonical.material) || specificationValue(snapshot,["timber","material","wood"]) || "Not supplied",
    aluminiumCladding: aluminiumCladdingValue(canonical.aluminiumCladding) || specificationValue(snapshot,["alu clad","aluminium clad"]) || "Not supplied",
    glass: glassValue,
    ug: thermalDisplay(thermalEvidence.ug),
    g: thermalDisplay(thermalEvidence.g),
    lt: thermalDisplay(thermalEvidence.lt),
    uw: thermalDisplay(thermalEvidence.uw),
    thermalEvidence,
    security: securityEvidence(snapshot, canonical),
    hardware: (() => {
      const stated = text(snapshot.fittingsSpecification)
        || sashes.map((item) => [item?.hardware, item?.fitting, item?.locking].map(text).filter(Boolean).join(" · ")).filter(Boolean).join("; ")
        || specificationValue(snapshot, ["fittings", "hardware", "locking"]);
      const configurationDetail = /handle|lock|finger plate|cylinder/i.test(configuration) ? configuration : "";
      return [stated, configurationDetail && !stated.toLowerCase().includes(configurationDetail.toLowerCase()) ? configurationDetail : ""].filter(Boolean).join(" · ") || "Not supplied";
    })(),
    configuration,
    operation: openingKind(`${productSystem} · ${configuration}`) || "Not confirmed",
    division: evidenceValue(canonical.division) || "Not supplied",
    interfaces: [evidenceValue(canonical.sill),specificationValue(snapshot,["sill","routing","rebate","threshold"])].filter(Boolean).join(" · ") || "Not supplied",
    sourceEvidence: {
      system: canonicalSystem || null,
      systemSourcePage: Number.isInteger(Number(sourceSpecification.inheritance?.sourcePage)) ? Number(sourceSpecification.inheritance.sourcePage) : null,
      positionSourcePages: Array.isArray(sourceSpecification.sourcePages) ? sourceSpecification.sourcePages.filter((value) => Number.isInteger(Number(value))).map(Number) : [],
      inheritanceRule: text(sourceSpecification.inheritance?.rule) || null,
      systemThermal: systemUwEvidence.value == null ? null : thermalMetric(systemUwEvidence.value, {
        ...systemUwEvidence,
        valueKind: "system_standard",
        label: "Uw",
        meaning: "standard_window_uw",
      }, { positive: true }),
    },
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

const reliableVisualStatuses = new Set(["mapped_automatic", "reviewed"]);
const manufacturerVisualPath = /(?:^|\/)(?:api\/)?manufacturer-position-visuals\/[a-f0-9-]+\/[^?#]+(?:[?#].*)?$/i;

function sourceVisualCandidates(snapshot) {
  const evidence = record(snapshot.manufacturerEvidence);
  const collections = [snapshot.sourceVisuals, evidence.sourceVisuals];
  const collection = collections.find((value) => Array.isArray(value) && value.length);
  if (collection) return collection.map(record);
  const single = record(snapshot.sourceVisual);
  const evidenceSingle = record(evidence.sourceVisual);
  return Object.keys(single).length ? [single] : Object.keys(evidenceSingle).length ? [evidenceSingle] : [];
}

function visualUrl(visual) {
  const url = text(visual.url ?? record(visual.renderedDerivative).url);
  if (!url) return null;
  try {
    const pathname = new URL(url, "http://quotesuite.local").pathname;
    return manufacturerVisualPath.test(pathname) ? url : null;
  } catch {
    return null;
  }
}

function reliableSourceVisual(visual) {
  const reviewStatus = text(visual.mappingReviewStatus);
  return visual.status === "available"
    && Boolean(visualUrl(visual))
    && (reliableVisualStatuses.has(reviewStatus) || visual.customerReviewStatus === "approved");
}

function supplierItemReference(mapping) {
  const snapshot = record(mapping?.supplierItemSnapshot);
  const source = text(snapshot.customerReference ?? snapshot.manufacturerItemNumber ?? mapping?.supplierItemReference);
  const pricedSuffix = source.match(/^(.*?)\s+(?:£|€|\$|GBP\s+|EUR\s+)([\d.,]+)$/i);
  if (!pricedSuffix) return source;
  const suffixAmount = numeric(pricedSuffix[2]);
  const evidenceAmounts = [numeric(snapshot.unitPrice), numeric(snapshot.totalPrice)].filter((value) => value != null);
  return suffixAmount != null && evidenceAmounts.some((value) => Math.abs(value - suffixAmount) < 0.005)
    ? text(pricedSuffix[1])
    : source;
}

function drawingEvidenceForMapping(mapping, proposal, offerKind) {
  const snapshot = record(mapping.supplierItemSnapshot);
  const sourceReference = supplierItemReference(mapping) || "Source item";
  const sourceAttachmentId = text(snapshot.sourceAttachmentId ?? mapping.provenance?.sourceAttachmentId) || null;
  const sourceRevisionId = text(snapshot.sourceRevisionId ?? mapping.provenance?.sourceRevisionId) || null;
  const sourceRowKey = text(snapshot.sourceRowKey ?? mapping.provenance?.rowKey) || null;
  const sourcePage = (visual) => visual.sourcePage != null && Number.isInteger(Number(visual.sourcePage)) ? Number(visual.sourcePage) : null;
  const visuals = sourceVisualCandidates(snapshot);
  const base = {
    supplierName: proposal.supplierName,
    proposalId: proposal.id,
    mappingId: mapping.id,
    sourceReference,
    sourceAttachmentId,
    sourceRevisionId,
    sourceRowKey,
    relationship: mapping.relationshipKind,
    isAlternative: offerKind === "alternative",
  };
  if (!visuals.length) return [{ ...base, status: "unavailable", url: null, role: null, sourcePage: null, mappingMethod: null, reason: "No reliable source image is available for this supplier item." }];
  return visuals.map((visual) => reliableSourceVisual(visual) ? {
    ...base,
    status: "available",
    url: visualUrl(visual),
    role: text(visual.role) || null,
    sourcePage: sourcePage(visual),
    mappingMethod: text(visual.mappingMethod) || null,
    reason: null,
  } : {
    ...base,
    status: "unavailable",
    url: null,
    role: text(visual.role) || null,
    sourcePage: sourcePage(visual),
    mappingMethod: text(visual.mappingMethod) || null,
    reason: text(visual.reason) || "The source image is retained, but deterministic Position ownership is not confirmed.",
  });
}

function drawingEvidenceForMappings(mappings, proposal, offerKind, fallbackReference = "Source item") {
  if (!mappings.length) return [{
    status: "unavailable", url: null, role: null, sourcePage: null, mappingMethod: null,
    reason: "No corresponding supplier source item is available.", supplierName: proposal.supplierName,
    proposalId: proposal.id, mappingId: `${proposal.id}:unavailable:${offerKind}`, sourceReference: fallbackReference,
    sourceAttachmentId: null, sourceRevisionId: null, sourceRowKey: null, relationship: "missing",
    isAlternative: offerKind === "alternative",
  }];
  return mappings.flatMap((mapping) => drawingEvidenceForMapping(mapping, proposal, offerKind));
}

function comparisonSourceReferences(comparison, positions) {
  const baseline = Array.isArray(comparison?.baselineSnapshot?.technicalSourceEvidence) ? comparison.baselineSnapshot.technicalSourceEvidence : [];
  const fallbackBaselineIds = [...new Set(positions.flatMap((position) => position.offers[0]?.drawings ?? []).map((drawing) => drawing.sourceAttachmentId).filter(Boolean))];
  const baselineSources = baseline.length ? baseline.map((source) => ({
    ownerKind: "baseline", supplierName: text(source.supplierName) || "Baseline source", manufacturerName: null,
    role: "technical_source", fileName: text(source.fileName) || "Retained baseline evidence",
    quotationNumber: text(source.quotationNumber) || null, quotationRevision: text(source.quotationRevision) || null,
    quotationDate: text(source.quotationDate) || null,
    sourceId: text(source.attachmentId) || null,
  })) : fallbackBaselineIds.map((sourceId) => ({
    ownerKind: "baseline", supplierName: positions[0]?.offers[0]?.supplierName || "Baseline source", manufacturerName: positions[0]?.offers[0]?.manufacturerName ?? null,
    role: "technical_source", fileName: "Retained baseline source evidence", quotationNumber: null,
    quotationRevision: null, quotationDate: null, sourceId,
  }));
  const competitorSources = (comparison?.proposals ?? []).flatMap((proposal) => (proposal.documents ?? []).map((source) => ({
    ownerKind: "competitor", supplierName: proposal.supplierName, manufacturerName: proposal.manufacturerName ?? null,
    role: text(source.documentRole) || "commercial", fileName: text(source.fileName) || "Retained proposal evidence",
    quotationNumber: text(proposal.quotationNumber) || null, quotationRevision: text(proposal.quotationRevision) || null,
    quotationDate: text(proposal.quotationDate) || null,
    sourceId: text(source.supplierAttachmentId ?? source.canonicalDocumentId) || null,
  })));
  return [...baselineSources, ...competitorSources];
}

function proposalCommercialNormalization(proposal) {
  return record(record(proposal.provenance).commercialNormalization);
}

function roundedMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function positionCommercialEvidence(proposal, meaningful, completeItems, quantity) {
  const normalization = proposalCommercialNormalization(proposal);
  const products = record(normalization.productsSupply);
  const supportingItems = meaningful.filter((mapping) => record(mapping.supplierItemSnapshot).componentRole);
  const sumPrices = (items) => items.reduce((sum, mapping) => sum + (numeric(record(mapping.supplierItemSnapshot).totalPrice) ?? 0), 0) || null;
  const grossCompleteCost = sumPrices(completeItems);
  const grossSupportingCost = sumPrices(supportingItems);
  const grossQuantityCost = grossCompleteCost == null ? null : roundedMoney(grossCompleteCost + (grossSupportingCost ?? 0));
  const grossUnitCosts = completeItems.map((mapping) => numeric(record(mapping.supplierItemSnapshot).unitPrice)).filter((value) => value != null && value > 0);
  const discountPercentage = numeric(products.discountPercentage);
  const explicitDiscount = discountPercentage != null && discountPercentage > 0 && text(products.priceBasis) === "explicit_supplier_discount_applied_for_comparison";
  const factor = explicitDiscount ? 1 - discountPercentage / 100 : 1;
  const netQuantityCost = grossQuantityCost == null ? null : roundedMoney(grossQuantityCost * factor);
  const netItemCost = grossUnitCosts.length ? roundedMoney(grossUnitCosts[0] * factor) : quantity && netQuantityCost != null ? roundedMoney(netQuantityCost / quantity) : null;
  const components = completeItems.map((mapping) => {
    const snapshot = record(mapping.supplierItemSnapshot);
    const componentQuantity = numeric(snapshot.quantity);
    const grossTotal = numeric(snapshot.totalPrice);
    const grossUnit = numeric(snapshot.unitPrice) ?? (componentQuantity && grossTotal != null ? grossTotal / componentQuantity : null);
    const attributes = offerAttributes(snapshot);
    return {
      reference: supplierItemReference(mapping) || "Supplier item",
      productSystem: attributes.productSystem,
      productFamily: attributes.productFamily,
      material: attributes.material,
      quantity: componentQuantity,
      grossUnitPrice: grossUnit == null ? null : roundedMoney(grossUnit),
      grossQuantityTotal: grossTotal == null ? null : roundedMoney(grossTotal),
      netUnitPrice: grossUnit == null ? null : roundedMoney(grossUnit * factor),
      netQuantityTotal: grossTotal == null ? null : roundedMoney(grossTotal * factor),
    };
  });
  return {
    basis: explicitDiscount ? "explicit_discount_net_supply" : "quoted_net_supply",
    grossItemCost: grossUnitCosts[0] ?? null,
    grossQuantityCost,
    discountPercentage: explicitDiscount ? discountPercentage : null,
    discountAmount: grossQuantityCost == null || !explicitDiscount ? null : roundedMoney(grossQuantityCost - netQuantityCost),
    netItemCost,
    netQuantityCost,
    supportingComponentCost: grossSupportingCost == null ? null : roundedMoney(grossSupportingCost * factor),
    completePositionPriceEligible: completeItems.length > 0,
    components,
    supportingComponents: supportingItems.map((mapping) => {
      const snapshot = record(mapping.supplierItemSnapshot);
      return {
        role: text(snapshot.componentRole) || "supporting_component",
        reference: supplierItemReference(mapping) || "Supporting component",
        description: text(snapshot.product ?? snapshot.productSystem) || "Supporting component",
        quantity: numeric(snapshot.quantity),
        amount: numeric(snapshot.totalPrice) == null ? null : roundedMoney(numeric(snapshot.totalPrice) * factor),
      };
    }),
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
  const completeAttributes = commercialItems.map((mapping) => offerAttributes(record(mapping.supplierItemSnapshot)));
  const distinctSystems = new Set(completeAttributes.map((item) => text(item.sourceEvidence?.system).toLowerCase()).filter(Boolean));
  const combinedValue = (key) => {
    const values = [...new Set(completeAttributes.map((item) => text(item[key])).filter((value) => supplied(value)))];
    return values.length ? values.join(" / ") : attrs[key];
  };
  const combinedAttributes = completeAttributes.length > 1 ? {
    ...attrs,
    productSystem: combinedValue("productSystem"),
    productFamily: combinedValue("productFamily"),
    material: combinedValue("material"),
    aluminiumCladding: combinedValue("aluminiumCladding"),
    internalFinish: combinedValue("internalFinish"),
    externalFinish: combinedValue("externalFinish"),
    glass: combinedValue("glass"),
    hardware: combinedValue("hardware"),
    configuration: combinedValue("configuration"),
    operation: combinedValue("operation"),
    thermalEvidence: distinctSystems.size > 1 && attrs.thermalEvidence.uw.valueKind === "system_standard"
      ? { ...attrs.thermalEvidence, uw: thermalMetric(null, { label: "Uw", meaning: "whole_product_uw" }, { positive: true }) }
      : attrs.thermalEvidence,
    uw: distinctSystems.size > 1 && attrs.thermalEvidence.uw.valueKind === "system_standard" ? "Not supplied" : attrs.uw,
    systemEvidence: completeAttributes.map((item) => item.sourceEvidence).filter((item) => item.system),
  } : { ...attrs, systemEvidence: completeAttributes.map((item) => item.sourceEvidence).filter((item) => item.system) };
  const sourceReferences = new Set(commercialItems.map((mapping) => supplierItemReference(mapping).replace(/[^A-Z0-9]+/gi, "").toUpperCase()).filter(Boolean));
  const componentAssembly = commercialItems.length > 1 && sourceReferences.size === 1 && commercialItems.every((mapping) => numeric(record(mapping.supplierItemSnapshot).quantity) === position.quantity);
  const supportingQuantity = meaningful.filter((mapping) => record(mapping.supplierItemSnapshot).componentRole).reduce((sum, mapping) => sum + (numeric(record(mapping.supplierItemSnapshot).quantity) ?? 0), 0) || null;
  const quantity = componentAssembly ? position.quantity : commercialItems.reduce((sum, mapping) => sum + (numeric(record(mapping.supplierItemSnapshot).quantity) ?? 0), 0) || supportingQuantity;
  const commercial = positionCommercialEvidence(proposal, meaningful, commercialItems, quantity);
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
    reference: meaningful.map(supplierItemReference).filter(Boolean).join(" + ") || "—",
    relationship: chosen?.relationshipKind ?? "missing",
    assessment: assessment[status] ?? assessment.review_required,
    assessmentCode: status,
    explanation,
    attributes: combinedAttributes,
    quantity,
    itemCost: commercial.netItemCost,
    quantityCost: commercial.netQuantityCost,
    commercial,
    completePositionPriceEligible: commercial.completePositionPriceEligible,
    currency: proposal.currency,
    scopeKind: proposal.scopeKind,
    isAlternative: offerKind === "alternative",
    evidenceCompleteness: completeness(combinedAttributes),
    mappingIds: mappings.map((mapping) => mapping.id),
    sourceSnapshots: meaningful.map((mapping) => record(mapping.supplierItemSnapshot)),
    mappingDifferences: meaningful.flatMap((mapping) => Array.isArray(mapping.differences) ? mapping.differences : []),
    drawings: drawingEvidenceForMappings(meaningful, proposal, offerKind, position.reference),
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

function timberMaterialKind(value) {
  const source = text(value).toLowerCase();
  if (!supplied(source)) return null;
  if (/softwood|pine|spruce|fir\b/.test(source)) return "softwood";
  if (/hardwood|oak|meranti|sapele|accoya/.test(source)) return "hardwood";
  if (/timber|wood/.test(source)) return "timber_unspecified";
  return null;
}

function materialRelationship(referenceValue, offeredValue) {
  const reference = text(referenceValue), offered = text(offeredValue);
  if (!supplied(reference)) return { status: "reference_unstated" };
  if (!supplied(offered)) return { status: "missing" };
  if (reference.toLowerCase() === offered.toLowerCase()) return { status: "match" };
  const referenceKind = timberMaterialKind(reference), offeredKind = timberMaterialKind(offered);
  if (referenceKind && offeredKind) {
    if (referenceKind === offeredKind || referenceKind === "timber_unspecified") return { status: "compatible", detail: `${offered} is compatible with the ${reference} reference; the supplier description is retained as the more specific evidence.` };
    if (offeredKind === "timber_unspecified") return { status: "insufficient", detail: `${offered} does not identify whether it satisfies the ${reference} reference.` };
    return { status: "difference", detail: `${offered} offered; ${reference} referenced` };
  }
  return { status: "difference", detail: `${offered} offered; ${reference} referenced` };
}

function glazingKind(value) {
  const source = text(value).toLowerCase();
  if (!supplied(source)) return null;
  if (/solid|panel door/.test(source) && !/glass|glaz/.test(source)) return "solid";
  const statedCavities = source.match(/\d+(?:[.,]\d+)?\s*ar\b/g)?.length ?? 0;
  if (statedCavities >= 2) return "triple";
  if (statedCavities === 1) return "double";
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
  if (/clear.*(?:lacquer|stain)|(?:lacquer|stain).*clear|\blacquer\s*3[.,]1\b/.test(source)) return "clear timber finish";
  if (/white.*opaque|opaque.*white/.test(source)) return "white opaque";
  const ral = ralCodes(source);
  return ral.length ? `RAL ${ral.join("/")}` : null;
}

function finishRelationship(referenceValue, offeredValue) {
  if (!supplied(referenceValue)) return { status: "reference_unstated" };
  if (!supplied(offeredValue)) return { status: "missing" };
  const reference = finishKind(referenceValue), offered = finishKind(offeredValue);
  if (reference && offered) return reference === offered
    ? { status: "match", detail: `${text(offeredValue)} is a confirmed ${offered}; original supplier code retained.` }
    : { status: "difference", detail: `${text(offeredValue)} (${offered}) offered; ${text(referenceValue)} (${reference}) referenced.` };
  if (reference === "clear timber finish" && !offered && /\b(?:spruce|pine|oak|timber|wood)\b/i.test(text(offeredValue)) && !/\bopaque\b|\bRAL\b/i.test(text(offeredValue))) return {
    status: "insufficient",
    detail: `${text(offeredValue)} is a supplier-coded timber finish, but the retained evidence does not confirm whether it is clear or opaque; ${text(referenceValue)} is the confirmed clear reference finish.`,
  };
  return text(referenceValue).toLowerCase() === text(offeredValue).toLowerCase()
    ? { status: "match", detail: text(offeredValue) }
    : { status: "difference", detail: `${text(offeredValue)} offered; ${text(referenceValue)} referenced.` };
}

function openingKind(value) {
  const source = text(value).toLowerCase();
  if (!supplied(source)) return null;
  if (/lift\s*(?:&|and|[-–—])?\s*slide|sliding/.test(source)) return "lift-and-slide";
  if (/fully reversible|reversible/.test(source)) return "fully reversible";
  if (/tilt.?and.?turn|tilt.?turn|turn\s*[/&-]\s*tilt/.test(source)) return "tilt and turn";
  if (/\bopening\s+(?:to\s+)?(?:the\s+)?outside\b|\bopens?\s+out(?:ward)?\b|\boutward[- ]opening\b/.test(source)) return "outward opening";
  if (/\bopening\s+(?:to\s+)?(?:the\s+)?inside\b|\bopens?\s+in(?:ward)?\b|\binward[- ]opening\b/.test(source)) return "inward opening";
  if (/fixed/.test(source)) return "fixed";
  if (/french door/.test(source)) return "French door";
  if (/entrance door|main door|panel.*door|\bdoor\b/.test(source)) return "door";
  return null;
}

function openingRelationship(reference, offered) {
  if (!reference) return { status: "reference_unstated" };
  if (!offered) return { status: "missing" };
  if (reference === offered) return { status: "match" };
  if (offered === "door" && ["inward opening", "outward opening"].includes(reference)) return { status: "missing_direction" };
  return { status: "difference" };
}

function evidenceFeatures(value, definitions) {
  const source = text(value).toLowerCase();
  if (!supplied(source)) return [];
  return definitions.filter(([,pattern])=>pattern.test(source)).map(([label])=>label);
}

const hardwareDefinitions = [
  ["concealed hinges", /concealed hinge/],
  ["exposed hinges", /exposed hinge/],
  ["lockable handle", /lockable handle|handle and lock (?:inside|internally)/],
  ["non-locking handle", /non[- ]?lock(?:ing)? handle/],
  ["cylinder", /cylinder/],
  ["day latch", /day latch/],
];
const interfaceDefinitions = [
  ["cill / sill", /\b(?:cill|sill)s?\b/],
  ["threshold", /threshold/],
  ["internal rebate", /internal rebate/],
  ["external rebate", /external rebate/],
  ["trickle vent", /trickle vent/],
];
const glassSafetyDefinitions = [
  ["toughened", /toughened|tempered|\btgh\b|\btuf\b|\d\s*(?:tgh|tuf)\b/],
  ["laminated", /laminated|\blam\b/],
  ["float", /\bfloat\b|\b\d+(?:[.,]\d+)?\s*fl\b/],
];

function glassTreatmentProfile(value) {
  return evidenceFeatures(value, glassSafetyDefinitions).sort();
}

function glassTreatmentsDiffer(referenceValue, offeredValue) {
  const reference = glassTreatmentProfile(referenceValue), offered = glassTreatmentProfile(offeredValue);
  return reference.length > 0 && offered.length > 0 && reference.join("|") !== offered.join("|");
}

function glazingBuildUpSignatures(value) {
  return text(value).split(/;\s*(?=#\d+\s*:)/).map((unit) => unit
    .replace(/\([^)]*\)/g, "")
    .replace(/^.*?(?=\d+(?:[.,]\d+)?\s*(?:tgh|tuf|b?toughened|fl|lam|ar|\/))/i, "")
    .toLowerCase()
    .replace(/,/g, ".")
    .replace(/tgh|tuf|b?toughened|tempered/g, "toughened")
    .replace(/laminated|\blam\b/g, "laminated")
    .replace(/\s+/g, "")
  ).filter((unit) => unit.includes("/"));
}

function glassBuildUpsDiffer(referenceValue, offeredValue) {
  const reference = glazingBuildUpSignatures(referenceValue), offered = glazingBuildUpSignatures(offeredValue);
  if (reference.length && offered.length) return reference.join("|") !== offered.join("|");
  return glassTreatmentsDiffer(referenceValue, offeredValue);
}

function slideDirectionDetail(value) {
  const source = text(value);
  const explicit = source.match(/(?:right|left)\s+(?:hand\s+)?pane\s+slides?\s+(?:to\s+the\s+)?(?:right|left)/i)?.[0]
    || source.match(/lift[- ]?slide\s+(?:right|left)/i)?.[0];
  return explicit ? explicit.replace(/\s+/g, " ") : null;
}

function externalHandleKind(value) {
  const source = text(value).toLowerCase();
  if (/recessed handle.*external|external.*recessed handle/.test(source)) return "recessed external handle";
  if (/finger plate.*outside|outside.*finger plate/.test(source)) return "external finger plate";
  return null;
}

function alternativeSystem(baseline, supplier) {
  const base = text(baseline.productSystem).toLowerCase(), candidate = text(supplier.productSystem).toLowerCase();
  if (!supplied(base) || !supplied(candidate) || base === candidate) return false;
  return true;
}

function qualifyOffer(offer, baseline) {
  if (offer.isBaselineReference) return { ...offer, compliance: { status: "reference_requirement", label: "Reference requirement", compromises: [], materialFailures: [], reviewItems: [] }, commercial: { ...offer.commercial, comparabilityStatus: "comparable_supply", comparabilityReason: "Canonical customer selling value." } };
  if (offer.assessmentCode === "missing") return {
    ...offer,
    compliance: {
      status: "review_required",
      label: "No included offer",
      compromises: [],
      materialFailures: [],
      reviewItems: ["No included/base supplier item is mapped to this Position. Any separate option remains an alternative."],
    },
    commercial: { ...offer.commercial, comparabilityStatus: "not_comparable", comparabilityReason: "No included complete Position offer or price is evidenced." },
  };
  if (offer.completePositionPriceEligible === false) return {
    ...offer,
    assessmentCode: "information_not_supplied",
    assessment: assessment.information_not_supplied,
    compliance: {
      status: "review_required",
      label: "Supporting component only",
      compromises: [],
      materialFailures: [],
      reviewItems: ["This source row prices supporting coupling hardware/profile only; it is not evidence of a complete window offer."],
    },
    commercial: { ...offer.commercial, comparabilityStatus: "not_comparable", comparabilityReason: "Supporting component cost only; no complete Position price is evidenced." },
  };
  const materialFailures = [], compromises = [], reviewItems = [];
  const mappingMaterial = ["material_mismatch","missing"].includes(offer.assessmentCode);
  if (mappingMaterial) materialFailures.push(offer.explanation);
  const snapshots = offer.sourceSnapshots.length ? offer.sourceSnapshots : [{}];
  const referenceQuantity = numeric(baseline.quantity), offeredQuantity = numeric(offer.quantity);
  const quantityDiffers = referenceQuantity != null && offeredQuantity != null && referenceQuantity !== offeredQuantity;
  if (quantityDiffers) reviewItems.push(`Quantity differs: the reference includes ${referenceQuantity}; this offer includes ${offeredQuantity}. Confirm whether the reference omits an item or the supplier offer includes an excess item before judging compliance or price.`);
  else if (referenceQuantity != null && offeredQuantity == null) reviewItems.push(`Quantity is not confirmed (${referenceQuantity} required by the reference).`);
  if (baseline.attributes.measurements !== "Not supplied" && offer.attributes.measurements !== "Not supplied" && baseline.attributes.measurements !== offer.attributes.measurements) materialFailures.push(`Dimensions differ: ${offer.attributes.measurements} offered; ${baseline.attributes.measurements} required by the reference.`);
  else if (baseline.attributes.measurements !== "Not supplied" && offer.attributes.measurements === "Not supplied") reviewItems.push(`Dimensions are not confirmed (${baseline.attributes.measurements} required by the reference).`);
  const families = [...new Set(snapshots.map((snapshot) => materialFamily(offerAttributes(snapshot))).filter(Boolean))];
  const baselineFamily = materialFamily(baseline.attributes);
  if (baselineFamily && families.some((family) => family !== baselineFamily)) materialFailures.push(`Material substitution: ${families.join(" / ")} offered; ${baselineFamily} required by the reference.`);
  const baselineMaterial = text(baseline.attributes.material);
  const offeredMaterials = [...new Set(snapshots.map((snapshot) => text(offerAttributes(snapshot).material)).filter((value) => supplied(value)))];
  if (supplied(baselineMaterial) && offeredMaterials.length) {
    const relationships = offeredMaterials.map((value) => materialRelationship(baselineMaterial, value));
    const differences = relationships.filter((item) => item.status === "difference");
    const insufficient = relationships.filter((item) => item.status === "insufficient");
    if (differences.length) compromises.push(`Material/timber differs: ${differences.map((item) => item.detail).join(" / ")}.`);
    else if (insufficient.length) reviewItems.push(`Material/timber needs confirmation: ${insufficient.map((item) => item.detail).join(" / ")}`);
  } else if (supplied(baselineMaterial)) reviewItems.push("Material/timber is not confirmed.");
  const glazingKinds = [...new Set(snapshots.map((snapshot) => glazingKind(offerAttributes(snapshot).glass)).filter(Boolean))];
  const baselineGlazing = glazingKind(baseline.attributes.glass);
  if (baselineGlazing && glazingKinds.some((kind) => kind !== baselineGlazing && !(baselineGlazing === "glazed" && ["double","triple"].includes(kind)))) materialFailures.push(`Glazing/configuration compromise: ${glazingKinds.join(" / ")} offered; ${baselineGlazing} required.`);
  else if (baselineGlazing && snapshots.some((snapshot) => glassBuildUpsDiffer(baseline.attributes.glass, offerAttributes(snapshot).glass))) compromises.push(`Glazing build-up differs: ${offer.attributes.glass} offered; ${baseline.attributes.glass} referenced.`);
  const baselineOpening = openingKind(`${baseline.attributes.productSystem} · ${baseline.attributes.configuration}`), offeredOpenings = [...new Set(snapshots.map((snapshot)=>offerAttributes(snapshot).operation).filter((value)=>value && value !== "Not confirmed"))];
  const openingRelationships = offeredOpenings.map((value) => openingRelationship(baselineOpening, value));
  if (openingRelationships.some((item) => item.status === "difference")) materialFailures.push(`Opening function differs: ${offeredOpenings.join(" / ")} offered; ${baselineOpening} required.`);
  else if (!offeredOpenings.length || openingRelationships.some((item) => item.status === "missing_direction")) reviewItems.push(`Opening direction is not confirmed${offeredOpenings.length ? ` by the generic ${offeredOpenings.join(" / ")} description` : ""}.`);
  const requiredSafety = evidenceFeatures(baseline.attributes.glass,glassSafetyDefinitions).filter((value)=>value!=="float"), offeredSafety = [...new Set(snapshots.flatMap((snapshot)=>evidenceFeatures(offerAttributes(snapshot).glass,glassSafetyDefinitions)))];
  if (requiredSafety.length && offeredSafety.length && requiredSafety.some((value)=>!offeredSafety.includes(value))) materialFailures.push(`Safety glazing differs: ${offeredSafety.join(" / ")} offered; ${requiredSafety.join(" / ")} required.`);
  else if (requiredSafety.length && !offeredSafety.length) reviewItems.push(`Safety glazing is not confirmed (${requiredSafety.join(" / ")} required).`);
  for (const role of ["internalFinish","externalFinish"]) {
    const relationships = snapshots.map((snapshot) => finishRelationship(baseline.attributes[role], offerAttributes(snapshot)[role]));
    const differences = relationships.filter((item) => item.status === "difference"), insufficient = relationships.filter((item) => ["missing","insufficient"].includes(item.status));
    if (differences.length) compromises.push(`${role === "internalFinish" ? "Internal" : "External"} finish differs: ${differences.map((item)=>item.detail).join(" / ")}`);
    else if (insufficient.length) reviewItems.push(`${role === "internalFinish" ? "Internal" : "External"} finish needs confirmation: ${insufficient.map((item)=>item.detail||"not supplied").join(" / ")}`);
  }
  const systemSubstitution = alternativeSystem(baseline.attributes, offer.attributes);
  if (systemSubstitution) compromises.push(`Alternative product/system: ${offer.attributes.productSystem}.`);
  if (supplied(baseline.attributes.aluminiumCladding) && !snapshots.some((snapshot)=>supplied(offerAttributes(snapshot).aluminiumCladding))) reviewItems.push("Aluminium cladding is not confirmed.");
  const requiredHardware=evidenceFeatures(baseline.attributes.hardware,hardwareDefinitions),offeredHardware=[...new Set(snapshots.flatMap((snapshot)=>evidenceFeatures(offerAttributes(snapshot).hardware,hardwareDefinitions)))];
  if (requiredHardware.length && !offeredHardware.length) reviewItems.push(`Applicable hardware is not confirmed (${requiredHardware.join(" / ")} required).`);
  else for(const required of requiredHardware){const conflicting=(required==="concealed hinges"&&offeredHardware.includes("exposed hinges"))||(required==="exposed hinges"&&offeredHardware.includes("concealed hinges"))||(required==="lockable handle"&&offeredHardware.includes("non-locking handle"))||(required==="non-locking handle"&&offeredHardware.includes("lockable handle"));if(conflicting)compromises.push(`Hardware differs: ${offeredHardware.join(" / ")} offered; ${required} required.`)}
  const baselineExternalHandle=externalHandleKind(baseline.attributes.hardware),offeredExternalHandles=[...new Set(snapshots.map((snapshot)=>externalHandleKind(offerAttributes(snapshot).hardware)).filter(Boolean))];
  if(baselineExternalHandle&&offeredExternalHandles.length&&offeredExternalHandles.some((value)=>value!==baselineExternalHandle))compromises.push(`External handle detail differs: ${offeredExternalHandles.join(" / ")} offered; ${baselineExternalHandle} referenced.`);
  else if(baselineExternalHandle&&!offeredExternalHandles.length)reviewItems.push(`External handle detail is not confirmed (${baselineExternalHandle} referenced).`);
  const requiredInterfaces=evidenceFeatures(baseline.attributes.interfaces,interfaceDefinitions),offeredInterfaces=[...new Set(snapshots.flatMap((snapshot)=>evidenceFeatures(offerAttributes(snapshot).interfaces,interfaceDefinitions)))];
  if(requiredInterfaces.length&&!offeredInterfaces.length)reviewItems.push(`Interface detail is not confirmed (${requiredInterfaces.join(" / ")} required).`);
  else if(requiredInterfaces.some((value)=>!offeredInterfaces.includes(value)))compromises.push(`Interface detail differs: ${offeredInterfaces.join(" / ")||"not confirmed"} offered; ${requiredInterfaces.join(" / ")} required.`);
  if (baseline.attributes.division !== "Not supplied" && offer.attributes.division === "Not supplied") reviewItems.push("Pane/leaf division is not confirmed.");
  if (baseline.attributes.security.standards.length && !offer.attributes.security.standards.length) reviewItems.push(`Security evidence does not confirm ${baseline.attributes.security.standards.join(" / ")}.`);
  const materialCompromise = compromises.some((item) => !item.startsWith("Alternative product/system:"));
  const status = materialFailures.length ? "materially_non_compliant" : reviewItems.length ? "review_required" : materialCompromise || offer.assessmentCode === "close_acceptable_alternative" ? "acceptable_with_compromise" : "compliant";
  const label = status === "materially_non_compliant" ? "Material mismatch" : status === "review_required" ? "Review required" : status === "acceptable_with_compromise" ? "Acceptable with qualification" : "Correct";
  const assessmentCode = materialFailures.length ? (offer.assessmentCode === "exact_match" || offer.assessmentCode === "close_acceptable_alternative" || offer.assessmentCode === "configuration_mismatch" || offer.assessmentCode === "dimension_mismatch" ? "material_mismatch" : offer.assessmentCode) : reviewItems.length ? "review_required" : offer.assessmentCode === "configuration_mismatch" || offer.assessmentCode === "dimension_mismatch" || offer.assessmentCode === "quantity_mismatch" ? "exact_match" : offer.assessmentCode;
  const commerciallyComparable = !offer.isAlternative && !materialFailures.length && !quantityDiffers && offer.commercial.netQuantityCost != null;
  return {
    ...offer,
    assessmentCode,
    assessment: materialFailures.length ? assessment.material_mismatch : status === "review_required" ? assessment.review_required : offer.assessment,
    compliance: { status, label, compromises, materialFailures, reviewItems },
    commercial: { ...offer.commercial, comparabilityStatus: commerciallyComparable ? "comparable_supply" : "not_comparable", comparabilityReason: commerciallyComparable ? "Net quoted Products / Supply value is isolated from package extras and services." : quantityDiffers ? `Not like-for-like: the reference quantity is ${referenceQuantity}, while this offer prices ${offeredQuantity}. Confirm the required quantity before comparing price.` : materialFailures.length ? "This price is not treated as like-for-like because the offer has a material Position difference." : "Comparable net Products / Supply evidence is unavailable." },
  };
}

function referenceAssessmentForOffer(offer, baseline) {
  if (offer.isBaselineReference) return { sourceReference: offer.reference, matches: [], differences: [], missingEvidence: [], notAssessable: [], verificationNotes: ["Selected reference only; completeness and project compliance have not been independently verified."] };
  const matches = [], differences = [], missingEvidence = [], notAssessable = [];
  if (offer.assessmentCode === "missing") return {
    sourceReference: offer.reference,
    matches,
    differences: [],
    missingEvidence: ["Complete Position offer and price: no included/base supplier item is mapped"],
    notAssessable,
    verificationNotes: [],
  };
  if (offer.completePositionPriceEligible === false) return {
    sourceReference: offer.reference,
    matches,
    differences: ["Offer scope: supporting coupling hardware/profile only; no complete window offer is evidenced"],
    missingEvidence: ["Complete Position specification and price: not supplied by this source row"],
    notAssessable,
    verificationNotes: [],
  };
  const compare = (label, referenceValue, offeredValue, normalize = (value) => text(value).toLowerCase()) => {
    const reference = supplied(referenceValue) ? normalize(referenceValue) : null;
    const candidate = supplied(offeredValue) ? normalize(offeredValue) : null;
    if (reference == null) notAssessable.push(`${label}: the reference does not state a requirement`);
    else if (candidate == null) missingEvidence.push(`${label}: not supplied`);
    else if (reference === candidate) matches.push(`${label}: ${text(offeredValue)}`);
    else differences.push(`${label}: ${text(offeredValue)} offered; ${text(referenceValue)} referenced`);
  };
  const referenceQuantity = numeric(baseline.quantity), offeredQuantity = numeric(offer.quantity);
  if (referenceQuantity != null && offeredQuantity != null && referenceQuantity === offeredQuantity) matches.push(`Quantity: ${offeredQuantity}`);
  else if (referenceQuantity != null && offeredQuantity != null) differences.push(`Quantity: ${offeredQuantity} offered; ${referenceQuantity} referenced`);
  else missingEvidence.push("Quantity: not supplied");
  compare("Dimensions", baseline.attributes.measurements, offer.attributes.measurements);
  const opening = openingRelationship(openingKind(`${baseline.attributes.productSystem} · ${baseline.attributes.configuration}`), openingKind(`${offer.attributes.productSystem} · ${offer.attributes.configuration}`));
  if (opening.status === "reference_unstated") notAssessable.push("Opening operation: the reference does not state a requirement");
  else if (["missing", "missing_direction"].includes(opening.status)) missingEvidence.push(`Opening direction: ${opening.status === "missing_direction" ? "generic door evidence does not confirm inward or outward opening" : "not supplied"}`);
  else if (opening.status === "match") matches.push(`Opening operation: ${offer.attributes.operation}`);
  else differences.push(`Opening operation: ${offer.attributes.operation} offered; ${baseline.attributes.operation} referenced`);
  if (opening.status === "match" && offer.attributes.operation === "lift-and-slide") {
    const referenceSlide = slideDirectionDetail(`${baseline.attributes.configuration} · ${baseline.attributes.hardware}`);
    const offeredSlide = slideDirectionDetail(`${offer.attributes.configuration} · ${offer.attributes.hardware}`);
    if (!referenceSlide && offeredSlide) missingEvidence.push(`Opening direction: the selected reference states its viewing side but not which leaf slides; ${offer.supplierName} states “${offeredSlide}”`);
    else if (referenceSlide && !offeredSlide) missingEvidence.push(`Opening direction: ${offer.supplierName} does not state the sliding leaf (${referenceSlide} referenced)`);
    else if (referenceSlide && offeredSlide && referenceSlide.toLowerCase() !== offeredSlide.toLowerCase()) differences.push(`Opening direction: ${offeredSlide} offered; ${referenceSlide} referenced`);
  }
  const material = materialRelationship(baseline.attributes.material, offer.attributes.material);
  if (material.status === "reference_unstated") notAssessable.push("Material/timber: the reference does not state a requirement");
  else if (material.status === "missing") missingEvidence.push("Material/timber: not supplied");
  else if (["match", "compatible"].includes(material.status)) matches.push(`Material/timber: ${material.detail || offer.attributes.material}`);
  else if (material.status === "insufficient") missingEvidence.push(`Material/timber: ${material.detail}`);
  else differences.push(`Material/timber: ${material.detail}`);
  for (const [label,key] of [["Internal finish","internalFinish"],["External finish","externalFinish"]]) {
    const relationship = finishRelationship(baseline.attributes[key], offer.attributes[key]);
    if (relationship.status === "reference_unstated") notAssessable.push(`${label}: the reference does not state a requirement`);
    else if (relationship.status === "missing") missingEvidence.push(`${label}: not supplied`);
    else if (relationship.status === "insufficient") missingEvidence.push(`${label}: ${relationship.detail}`);
    else if (relationship.status === "match") matches.push(`${label}: ${relationship.detail}`);
    else differences.push(`${label}: ${relationship.detail}`);
  }
  const referenceGlazing = glazingKind(baseline.attributes.glass), offeredGlazing = glazingKind(offer.attributes.glass);
  if (!referenceGlazing) notAssessable.push("Glazing: the reference does not state a requirement");
  else if (!offeredGlazing) missingEvidence.push("Glazing: not supplied");
  else if (referenceGlazing !== offeredGlazing) differences.push(`Glazing: ${offer.attributes.glass} offered; ${baseline.attributes.glass} referenced`);
  else {
    const referenceSafety = evidenceFeatures(baseline.attributes.glass, glassSafetyDefinitions);
    const offeredSafety = evidenceFeatures(offer.attributes.glass, glassSafetyDefinitions);
    if (glassBuildUpsDiffer(baseline.attributes.glass, offer.attributes.glass)) differences.push(`Glazing build-up: ${offer.attributes.glass} offered; ${baseline.attributes.glass} referenced`);
    else if (referenceSafety.includes("toughened") && offeredSafety.includes("float")) differences.push(`Glazing safety: ${offer.attributes.glass} states float panes; ${baseline.attributes.glass} states toughened panes`);
    else if (referenceSafety.includes("toughened") && !offeredSafety.includes("toughened")) missingEvidence.push(`Glazing safety: ${offer.attributes.glass} does not confirm the toughened-pane treatment stated by the reference`);
    else matches.push(`Glazing: ${offer.attributes.glass}`);
  }
  for (const [key, label] of [["uw", "Uw"], ["ug", "Ug"], ["g", "G"], ["lt", "LT"]]) {
    const reference = baseline.attributes.thermalEvidence[key], candidate = offer.attributes.thermalEvidence[key];
    if (reference.value == null) notAssessable.push(`${label}: the reference has no valid value`);
    else if (candidate.status === "not_applicable") notAssessable.push(`${label}: not applicable to this solid unglazed door`);
    else if (candidate.value == null) missingEvidence.push(`${label}: ${candidate.status === "invalid_value" ? `invalid source value ${candidate.raw}` : "not supplied"}`);
    else if (candidate.valueKind === "system_standard" && reference.valueKind !== "system_standard") missingEvidence.push(`${label}: ${candidate.raw} is a standard-size system value, not an actual-Position calculation`);
    else if (candidate.value === reference.value) matches.push(`${label}: ${candidate.raw}`);
    else differences.push(`${label}: ${candidate.raw} offered; ${reference.raw} referenced${candidate.valueKind === reference.valueKind ? "" : " on a different stated evidence basis"}`);
  }
  const referenceSecurity = baseline.attributes.security.standards;
  const offeredSecurity = offer.attributes.security.standards;
  if (!referenceSecurity.length) notAssessable.push("Security: the reference does not state a certified requirement");
  else if (!offeredSecurity.length) missingEvidence.push(`Security: ${referenceSecurity.join(" / ")} not confirmed`);
  else if (referenceSecurity.every((standard) => offeredSecurity.includes(standard))) matches.push(`Security: ${offeredSecurity.join(" / ")}`);
  else differences.push(`Security: ${offeredSecurity.join(" / ")} offered; ${referenceSecurity.join(" / ")} referenced`);
  const referenceHardware=evidenceFeatures(baseline.attributes.hardware,hardwareDefinitions),offeredHardware=evidenceFeatures(offer.attributes.hardware,hardwareDefinitions);
  const missingHardware=referenceHardware.filter((item)=>!offeredHardware.includes(item));
  if(referenceHardware.length&&!offeredHardware.length)missingEvidence.push(`Hardware: ${offer.supplierName} does not confirm ${referenceHardware.join(" / ")}`);
  else if(missingHardware.length)missingEvidence.push(`Hardware: ${offer.supplierName} does not confirm ${missingHardware.join(" / ")}`);
  else if(referenceHardware.length)matches.push(`Hardware: ${offeredHardware.join(" / ")}`);
  const referenceExternalHandle=externalHandleKind(baseline.attributes.hardware),offeredExternalHandle=externalHandleKind(offer.attributes.hardware);
  if(referenceExternalHandle&&offeredExternalHandle&&referenceExternalHandle!==offeredExternalHandle)differences.push(`Hardware: ${offeredExternalHandle} offered; ${referenceExternalHandle} referenced`);
  else if(referenceExternalHandle&&!offeredExternalHandle)missingEvidence.push(`Hardware: external handle detail not supplied (${referenceExternalHandle} referenced)`);
  return { sourceReference: offer.reference, matches, differences, missingEvidence, notAssessable, verificationNotes: [] };
}

function findingSignificance(evidence) {
  const source = evidence.differences.join(" ").toLowerCase();
  if (/quantity/.test(source)) return "Quantity changes the number of units and prevents a direct price comparison.";
  const geometry = /opening operation|configuration|division|dimensions/.test(source), glazing = /glazing|security/.test(source), material = /material|finish/.test(source), thermal = /uw|ug|\bg:|\blt:/.test(source);
  if (geometry && glazing) return "The opening/configuration and glazing evidence affect operation, fit or safety.";
  if (geometry) return "The geometry or operation affects how the item fits or works.";
  if (glazing) return "The glazing or security evidence may affect safety, security or stated performance.";
  if (material) return "The material or finish affects the specified construction or appearance.";
  if (thermal) return "Thermal or solar figures need a comparable evidence basis before one is treated as advantageous.";
  return evidence.differences.length ? "The offers are not identical on the retained evidence." : "";
}

function prioritizeDifferences(values) {
  const priority = (value) => /^Quantity:/i.test(value) ? 0 : /^Dimensions:|^Opening operation:|^Glazing safety:|^Glazing:/i.test(value) ? 1 : /^Material\/timber:|^Internal finish:|^External finish:/i.test(value) ? 2 : /^Uw:|^Ug:|^G:|^LT:/i.test(value) ? 3 : 4;
  return values.map((value,index)=>({value,index})).sort((left,right)=>priority(left.value)-priority(right.value)||left.index-right.index).map((item)=>item.value);
}

const evidenceLabel = (value) => text(value).split(":")[0].replace("Material/timber", "material").replace("Glazing safety", "safety glass").toLowerCase();
const readableList = (values) => {
  const items = [...new Set(values.filter(Boolean))];
  if (items.length < 2) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
};

function priceComparisonForOffer(offer, baseline) {
  if (offer.isBaselineReference) return { status: "reference", comparable: true, amountDifference: null, percentageDifference: null, basis: "Selected supplier customer selling price." };
  const baselineTotal = baseline.commercial.netQuantityCost, offeredTotal = offer.commercial.netQuantityCost;
  if (baselineTotal == null || offeredTotal == null || offer.completePositionPriceEligible === false || offer.currency !== baseline.currency) return {
    status: "not_established", comparable: false, amountDifference: null, percentageDifference: null,
    basis: "A complete Position price in the same currency is not established.",
  };
  const amountDifference = roundedMoney(offeredTotal - baselineTotal);
  const percentageDifference = baselineTotal > 0 ? Math.round((amountDifference / baselineTotal) * 1000) / 10 : null;
  const comparable = offer.commercial.comparabilityStatus === "comparable_supply";
  return {
    status: comparable ? "comparable" : "quoted_not_like_for_like",
    comparable,
    amountDifference,
    percentageDifference,
    basis: comparable
      ? `Like-for-like net Products / Supply for the required quantity versus ${baseline.supplierName}.`
      : `Not like-for-like with ${baseline.supplierName}: ${offer.commercial.comparabilityReason.replace(/^Not like-for-like:\s*/i, "").replace(/^This price is not treated as like-for-like because\s*/i, "").replace(/[.]+$/, "")}.`,
  };
}

function technicalDisclosureForOffer(offer, baseline) {
  if (offer.isBaselineReference) return null;
  const requiredSafety = evidenceFeatures(baseline.attributes.glass, glassSafetyDefinitions).filter((value) => value !== "float");
  const offeredSafety = evidenceFeatures(offer.attributes.glass, glassSafetyDefinitions);
  const disclosed = [
    supplied(offer.attributes.glass) ? "glazing build-up" : null,
    offeredSafety.some((item) => requiredSafety.includes(item)) ? "required safety-glass treatment" : null,
    offer.attributes.thermalEvidence.uw.value != null ? "whole-element thermal value" : null,
    offer.attributes.security.status !== "not_stated" ? "security claim" : null,
    supplied(offer.attributes.hardware) ? "hardware" : null,
  ].filter(Boolean);
  if (!disclosed.length) return null;
  return `Evidence supplied: ${readableList(disclosed)}.`;
}

function comparisonFieldsForOffer(offer, baseline) {
  const evidence = offer.referenceAssessment;
  const operationDescription = offer.attributes.operation === "door" && evidence.missingEvidence.some((item)=>/^Opening direction:/i.test(item))
    ? "Operation: generic door evidence does not confirm inward or outward opening"
    : offer.attributes.operation !== "Not confirmed" ? `Operation: ${offer.attributes.operation}` : null;
  const securitySummary = offer.attributes.security.standards.length
    ? `${offer.attributes.security.standards.join(" / ")} stated${offer.attributes.security.status === "confirmed_certified" ? " and certified" : "; position-level certification not evidenced"}`
    : offer.attributes.security.label;
  const hardwareSource = text(offer.attributes.hardware);
  const hardwareDetails = [
    /concealed hinge/i.test(hardwareSource) ? "concealed hinges" : null,
    /3D[- ]?hinge/i.test(hardwareSource) ? "3D hinges" : /exposed hinge/i.test(hardwareSource) ? "exposed hinges" : null,
    /multi[- ]?point lock/i.test(hardwareSource) ? "multi-point lock" : null,
    /lockable handle/i.test(hardwareSource) ? "lockable handle" : /non[- ]?locking handle/i.test(hardwareSource) ? "non-locking handle" : null,
    /cylinder/i.test(hardwareSource) ? "cylinder" : null,
    /day latch/i.test(hardwareSource) ? "day latch" : null,
    text(hardwareSource.match(/(?:Designer handle|Long handleplate|Roto Line|Mila SBD)[^,;·]*/i)?.[0]) || null,
  ].filter(Boolean);
  const hardwareSummary = hardwareDetails.length ? [...new Set(hardwareDetails)].join(" · ") : hardwareSource || "Not supplied";
  const componentMaterials = offer.commercial.components?.length > 1
    ? offer.commercial.components.map((component) => `${component.reference}: ${component.productSystem} · ${supplied(component.material) ? component.material : `${component.productFamily} (material not separately stated)`}`).join("; ")
    : null;
  const stateFor = (patterns, metric = null) => {
    if (offer.isBaselineReference) return "reference";
    const matches = evidence.matches.some((item) => patterns.some((pattern) => pattern.test(item)));
    const differs = evidence.differences.some((item) => patterns.some((pattern) => pattern.test(item)));
    const missing = evidence.missingEvidence.some((item) => patterns.some((pattern) => pattern.test(item)));
    const notApplicable = metric?.status === "not_applicable";
    return notApplicable ? "not_applicable" : differs ? "difference" : missing ? "unknown" : matches ? "match" : "unknown";
  };
  const fields = [
    { key: "product_material", label: "Product / material", value: [componentMaterials || offer.attributes.productSystem, operationDescription, componentMaterials ? null : offer.attributes.material, offer.attributes.aluminiumCladding].filter(supplied).join(" · ") || "Not supplied", status: stateFor([/^Opening operation:/i, /^Opening direction:/i, /^Material\/timber:/i, /^Product/i]) },
    { key: "dimensions", label: "Dimensions", value: offer.attributes.measurements, status: stateFor([/^Dimensions:/i]) },
    { key: "quantity", label: "Quantity", value: offer.quantity == null ? "Not supplied" : String(offer.quantity), status: stateFor([/^Quantity:/i]) },
    { key: "internal_finish", label: "Internal finish", value: offer.attributes.internalFinish, status: stateFor([/^Internal finish:/i]) },
    { key: "external_finish", label: "External finish", value: offer.attributes.externalFinish, status: stateFor([/^External finish:/i]) },
    { key: "glass", label: "Glass", value: offer.attributes.glass, status: stateFor([/^Glazing(?: build-up| safety)?:/i]) },
    { key: "security_hardware", label: "Security / hardware", value: `${securitySummary} · ${hardwareSummary}`, status: stateFor([/^Security:/i, /^Hardware:/i]) },
    { key: "uw", label: offer.attributes.thermalEvidence.uw.meaning === "whole_door_ud" ? "Whole-door value" : "Uw", value: thermalDisplay(offer.attributes.thermalEvidence.uw), status: stateFor([/^Uw:/i], offer.attributes.thermalEvidence.uw), thermal: offer.attributes.thermalEvidence.uw },
    { key: "ug", label: "Ug", value: thermalDisplay(offer.attributes.thermalEvidence.ug), status: stateFor([/^Ug:/i], offer.attributes.thermalEvidence.ug), thermal: offer.attributes.thermalEvidence.ug },
    { key: "g", label: "G", value: thermalDisplay(offer.attributes.thermalEvidence.g), status: stateFor([/^G:/i], offer.attributes.thermalEvidence.g), thermal: offer.attributes.thermalEvidence.g },
    { key: "lt", label: "LT", value: thermalDisplay(offer.attributes.thermalEvidence.lt), status: stateFor([/^LT:/i], offer.attributes.thermalEvidence.lt), thermal: offer.attributes.thermalEvidence.lt },
  ];
  if (supplied(offer.attributes.interfaces) || supplied(baseline.attributes.interfaces)) fields.splice(7, 0, { key: "cills_interfaces", label: "Cills / interfaces", value: offer.attributes.interfaces, status: stateFor([/^Interface/i]) });
  return fields.filter((field) => !["g", "lt"].includes(field.key) || field.thermal?.value != null || field.thermal?.status === "not_applicable");
}

function customerFindingForOffer(offer, baseline) {
  const evidence = offer.referenceAssessment;
  if (offer.isBaselineReference) return {
    summary: `Selected supplier: ${offer.supplierName}.`,
    matches: "Defines the reference; completeness and project compliance have not been independently verified.",
    differs: null,
    confirm: null,
    confirmation: null,
    recommendation: "Reference requirement only; selection gives no supplier preference.",
    disclosure: null,
  };
  const matchLabels = evidence.matches.map(evidenceLabel);
  const differenceLabels = prioritizeDifferences(evidence.differences).map(evidenceLabel);
  const unknownLabels = evidence.missingEvidence.map(evidenceLabel);
  const price = offer.priceComparison;
  const priceTradeOff = price?.amountDifference == null ? "Comparable price difference not established." : `${price.amountDifference < 0 ? `${moneyText(Math.abs(price.amountDifference), offer.currency)} (${Math.abs(price.percentageDifference ?? 0).toFixed(1)}%) below` : price.amountDifference > 0 ? `${moneyText(price.amountDifference, offer.currency)} (${Math.abs(price.percentageDifference ?? 0).toFixed(1)}%) above` : "Same price as"} ${baseline.supplierName}${price.comparable ? " on the stated comparable basis" : "; not sufficiently like-for-like for a value conclusion"}.`;
  const uwDifference = offer.attributes.thermalEvidence.uw.value != null && baseline.attributes.thermalEvidence.uw.value != null
    ? offer.attributes.thermalEvidence.uw.value - baseline.attributes.thermalEvidence.uw.value
    : null;
  const provisionalValueTradeOff = price.comparable && price.amountDifference < 0 && Math.abs(price.percentageDifference ?? 0) >= 5
    && uwDifference > 0 && uwDifference <= 0.02 && ["estimated","illustrative"].includes(offer.annualHeatLoss.status);
  const recommendation = provisionalValueTradeOff
    ? `${priceTradeOff} ${offer.supplierName} is provisionally better value if the remaining specification checks establish suitability. ${offer.annualHeatLoss.display.split(" The suppliers’")[0]} A slightly worse quoted Uw alone does not outweigh this saving; a meaningful glass, hardware or scope disadvantage could change the recommendation.`
    : offer.compliance.status === "materially_non_compliant"
    ? `${priceTradeOff} Resolve the confirmed differences before treating this as equivalent.`
    : offer.compliance.status === "review_required"
      ? `${priceTradeOff} Confirm the missing evidence before selection.`
      : `${priceTradeOff} Weigh specification, safety-glass and thermal evidence separately from price.`;
  return {
    summary: `${offer.supplierName} compared with ${baseline.supplierName}.`,
    matches: matchLabels.length ? `Matches ${baseline.supplierName}: ${readableList(matchLabels)}.` : null,
    differs: differenceLabels.length ? `Differs from ${baseline.supplierName}: ${readableList(differenceLabels)}.` : null,
    confirm: unknownLabels.length ? `Confirm with ${offer.supplierName}: ${readableList(unknownLabels)}.` : null,
    confirmation: [
      evidence.differences.some((item) => item.startsWith("Quantity:")) ? `Confirm whether the required quantity is ${baseline.quantity} or ${offer.quantity}; neither is assumed wrong.` : null,
      evidence.missingEvidence.some((item) => item.startsWith("Opening direction:")) ? `The selected reference states the viewing side but not which leaf must slide; confirm the required arrangement before treating ${offer.supplierName}'s stated direction as equivalent.` : null,
    ].filter(Boolean).join(" ") || null,
    recommendation,
    disclosure: technicalDisclosureForOffer(offer, baseline),
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
  if (offer.attributes.thermalEvidence.uw.value != null) reasons.push(`Uw ${offer.attributes.thermalEvidence.uw.raw}`);
  if (offer.commercial.comparabilityStatus === "comparable_supply" && offer.commercial.netQuantityCost != null) reasons.push(`${offer.currency || ""} ${offer.commercial.netQuantityCost.toFixed(2)} comparable net supply cost`.trim());
  else reasons.push(offer.commercial.comparabilityReason.toLowerCase());
  return `${offer.supplierName}: ${reasons.join("; ")}.`;
}

function positionNarrative(position, offers) {
  const competitors = offers.filter((offer) => !offer.isBaselineReference);
  if (!competitors.length) return {
    report: `No competitor proposal contains a confirmed corresponding source item for reference Position ${position.reference}.`,
    conclusion: `No competitor offer can currently be assessed for Position ${position.reference}.`,
  };
  const descriptions = competitors.map((offer) => {
    const price = offer.commercial.netQuantityCost == null ? "price not supplied" : `${offer.currency || ""} ${offer.commercial.netQuantityCost.toFixed(2)} for quoted quantity ${offer.quantity ?? "not supplied"}`.trim();
    const comparabilityReason = offer.commercial.comparabilityReason.replace(/[.]+$/, "");
    return `${offer.customerFinding.summary} ${offer.customerFinding.matches || ""} ${offer.customerFinding.differs || ""} ${offer.customerFinding.confirm || ""} ${offer.customerFinding.confirmation || ""} Source ${offer.reference}; ${price}${offer.commercial.comparabilityStatus === "comparable_supply" ? " is comparable Products / Supply evidence" : ` is not like-for-like — ${comparabilityReason}`}`.replace(/\s+/g," ").trim();
  });
  const quantityDifferences = competitors.filter((offer) => numeric(offer.quantity) != null && numeric(offer.quantity) !== numeric(position.quantity));
  const conclusion = quantityDifferences.length
    ? `The reference includes ${position.quantity}, while ${quantityDifferences.map((offer) => `${offer.supplierName} (${offer.reference}) includes ${offer.quantity}`).join(" and ")}. This may indicate a reference omission or competitor excess; confirm the required quantity before judging compliance or price.`
    : competitors.map((offer) => {
      const evidence = offer.referenceAssessment;
      const differences = readableList(prioritizeDifferences(evidence.differences).map(evidenceLabel));
      const missing = readableList(evidence.missingEvidence.map(evidenceLabel));
      if (differences) return `${offer.supplierName} differs on ${differences}.${missing ? ` Confirm ${missing}.` : ""}`;
      if (missing) return `${offer.supplierName}: confirm ${missing}.`;
      return `${offer.supplierName} has no confirmed difference from the selected reference in the retained evidence.`;
    }).join(" ");
  return { report: `${descriptions.join(". ")}.`, conclusion };
}

function lowestKnown(offers, field, lowerIsBetter = true) {
  const values = offers.map((offer) => ({ offer, value: numeric(field(offer)) })).filter((entry) => entry.value != null);
  if (!values.length) return null;
  values.sort((left, right) => lowerIsBetter ? left.value - right.value : right.value - left.value);
  const winningValue = values[0].value;
  return { ...values[0], ties: values.filter((entry) => entry.value === winningValue).map((entry) => entry.offer) };
}

function thermalFinding(result, metric, baseline) {
  if (!result) return null;
  const evidence = result.offer.attributes.thermalEvidence[metric];
  const baselineEvidence = baseline.attributes.thermalEvidence[metric];
  const sameStandardSize = evidence.valueKind === "system_standard" && baselineEvidence.valueKind === "system_standard"
    && evidence.standardSizeMm?.width === baselineEvidence.standardSizeMm?.width
    && evidence.standardSizeMm?.height === baselineEvidence.standardSizeMm?.height
    && evidence.standard === baselineEvidence.standard;
  const sameActualBasis = evidence.valueKind === "actual_position" && baselineEvidence.valueKind === "actual_position";
  const likeForLike = result.offer.compliance.status !== "materially_non_compliant"
    && result.offer.compliance.reviewItems.length === 0
    && (sameStandardSize || sameActualBasis);
  const qualification = likeForLike
    ? "Comparable evidence basis is stated."
    : evidence.valueKind === "system_standard"
      ? "Standard-size system value; it is not an actual-Position calculation or a proven like-for-like advantage."
      : "Lower quoted value only; equivalent product/configuration and calculation basis are not fully demonstrated."
  return {
    supplierName: result.ties.map((offer) => offer.supplierName).join(" / "),
    value: evidence.raw ?? String(result.value),
    evidence,
    likeForLike,
    qualification,
  };
}

function quotedMetricValues(offers, metric) {
  return offers.flatMap((offer) => {
    const evidence = offer.attributes.thermalEvidence[metric];
    return evidence.value == null ? [] : [{ supplierName: offer.supplierName, value: evidence.raw ?? String(evidence.value), evidence }];
  });
}

function normalizePosition(position) {
  const width = numeric(position.widthMm);
  const height = numeric(position.heightMm);
  const sourceConfiguration = text(position.configurationDescription ?? position.insertion);
  const product = text(position.product ?? position.positionType);
  const configuration = /^view from\b/i.test(sourceConfiguration) && product ? `${product} · ${sourceConfiguration}` : sourceConfiguration || product || "Not stated";
  return {
    id: text(position.id),
    reference: text(position.positionRef ?? position.customerReference ?? position.reference ?? position.id),
    roomName: text(position.roomName),
    quantity: numeric(position.qty ?? position.quantity) ?? 1,
    measurements: width && height ? `${width} × ${height} mm` : "Not stated",
    configuration,
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
    commercial: { basis: "customer_selling", grossItemCost: itemCost, grossQuantityCost: itemCost == null ? null : itemCost * position.quantity, discountPercentage: null, discountAmount: null, netItemCost: itemCost, netQuantityCost: itemCost == null ? null : itemCost * position.quantity, supportingComponentCost: null, completePositionPriceEligible: true, components: [], supportingComponents: [], sourcePricesPreserved: true },
    currency: "GBP",
    scopeKind: text(comparison?.baselineSnapshot?.customerCommercial?.scopeKind) || "unresolved",
    isAlternative: false,
    completePositionPriceEligible: true,
    evidenceCompleteness: completeness(attributes),
    mappingIds: [],
    sourceSnapshots: [source],
    mappingDifferences: [],
    drawings: drawingEvidenceForMappings([{ id: "baseline-reference-estimate", supplierItemReference: position.reference, supplierItemSnapshot: source, relationshipKind: "reference", provenance: {} }], { id: "baseline-reference-estimate", supplierName: supplier }, "base"),
    isBaselineReference: true,
  };
}

function commercialBreakdown(normalizationValue, { currency, headlineTotal, scopeKind } = {}) {
  const normalization = record(normalizationValue);
  const products = record(normalization.productsSupply), extras = record(normalization.extras), delivery = record(normalization.delivery), installation = record(normalization.installation), survey = record(normalization.survey), vat = record(record(normalization.vat).evidence ?? normalization.vat);
  const scopeExtras = record(record(normalization.scopeEvidence).extras);
  const netSupply = numeric(products.netAmount), grossSupply = numeric(products.grossListAmount), discountPercentage = numeric(products.discountPercentage), discountAmount = numeric(products.discountAmount);
  const normalisable = netSupply != null && netSupply > 0;
  return {
    currency: text(normalization.currency) || text(currency) || null,
    grossSupply,
    discountPercentage: discountPercentage && discountPercentage > 0 ? discountPercentage : null,
    discountAmount: discountAmount && discountAmount > 0 ? discountAmount : null,
    netSupply,
    extras: numeric(extras.amount),
    extrasLabels: (Array.isArray(extras.labels) ? extras.labels : Array.isArray(scopeExtras.labels) ? scopeExtras.labels : []).map(text).filter(Boolean),
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
  const quantity = positionReferences((offer) => offer.compliance.reviewItems.some((item) => item.startsWith("Quantity differs:")));
  if (quantity.length) result.push(clarification("quantity", "Which quantity is required? The reference and supplier quotation differ, which may indicate a reference omission or an additional supplier item; neither is assumed correct without confirmation.", quantity, "material"));
  const material = positionReferences((offer) => offer.compliance.status === "materially_non_compliant");
  if (material.length) result.push(clarification("specification_or_geometry", "Are the stated specification or geometry differences acceptable, or should the offer be revised to match the reference?", material, "material"));
  const review = positionReferences((offer) => offer.compliance.status === "review_required");
  if (review.length) result.push(clarification("position_evidence", "Can the missing configuration, division, material or finish information be confirmed for these Positions?", review));
  const securityMissing = positionReferences((offer) => offer.attributes.security.status === "not_stated");
  if (securityMissing.length) result.push(clarification("security", "What PAS24 or other security classification, security glazing and lock/hinge evidence applies? No certification is assumed where it is not stated.", securityMissing));
  const thermalMissing = positionReferences((offer) => offer.attributes.thermalEvidence.uw.value == null);
  if (thermalMissing.length) result.push(clarification("thermal", "What is the actual-size Uw value and its calculation or test basis for these Positions?", thermalMissing));
  const thermalStandardMissing = positionReferences((offer) => offer.attributes.thermalEvidence.uw.value != null && !offer.attributes.thermalEvidence.uw.standard);
  if (thermalStandardMissing.length) result.push(clarification("thermal_standard", "Which standard and calculation basis were used for the stated Uw values?", thermalStandardMissing));
  const deliveryEvidence = record(supplier.commercial.scopeEvidence.delivery);
  if (["", "not_stated"].includes(text(deliveryEvidence.status))) result.push(clarification("delivery_offload", "Does the price include delivery, site access and offloading, and is any HIAB, crane or special handling required?"));
  const installationEvidence = record(supplier.commercial.scopeEvidence.installation);
  if (supplier.scopeKind === "supply_and_install" && ["", "not_stated"].includes(text(installationEvidence.status))) result.push(clarification("installation_boundary", "What installation work and amount are included, including survey, lifting, perimeter sealing, making good and commissioning?"));
  result.push(clarification("quotation_validity", "What are the current quotation validity, lead time, payment terms and applicable warranty limitations?"));
  return result;
}

function metricRange(offers, key) {
  const values = offers.map((offer) => offer.attributes.thermalEvidence[key]).filter((evidence) => evidence?.value != null && Number.isFinite(evidence.value));
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left.value - right.value), minimum = sorted[0], maximum = sorted.at(-1);
  const suffix = values.every((item) => item.valueKind === "system_standard") ? " standard-size" : "";
  return { count: values.length, minimum: minimum.value, maximum: maximum.value, display: `${minimum.raw}${minimum.value === maximum.value ? "" : `–${maximum.raw}`}${suffix}` };
}

function plainLanguageSupplierSummary(summary, offers, positionCount) {
  const points = summary.isBaselineReference
    ? ["This is the selected reference, not an independent verification of completeness or project compliance."]
    : [...new Set(offers.filter((offer)=>!offer.isAlternative).map((offer) => {
      const evidence = offer.referenceAssessment;
      if (evidence.differences.length) return `Position ${offer.positionReference} — ${offer.supplierName} differs from the selected supplier on ${readableList(prioritizeDifferences(evidence.differences).slice(0, 2).map(evidenceLabel))}.`;
      if (evidence.missingEvidence.length) return `Position ${offer.positionReference} — confirm ${readableList(evidence.missingEvidence.slice(0, 2).map(evidenceLabel))} with ${offer.supplierName}.`;
      return null;
    }).filter(Boolean))];
  const thermal = {
    uw: metricRange(offers, "uw"),
    ug: metricRange(offers, "ug"),
    g: metricRange(offers, "g"),
    lt: metricRange(offers, "lt"),
  };
  const commercialEstablished = summary.commercial.normalizationStatus === "net_supply_isolated" && summary.commercial.netSupply != null;
  return {
    proposalId: summary.proposalId,
    supplierName: summary.supplierName,
    manufacturerName: summary.manufacturerName,
    coverage: summary.isBaselineReference
      ? `Selected reference for ${positionCount} Positions. It defines the comparison requirement and is not counted as an independently verified supplier match.`
      : `${summary.matched} of ${positionCount} Positions linked; ${summary.correct} ${summary.correct === 1 ? "match" : "matches"}, ${summary.acceptable} qualified difference${summary.acceptable === 1 ? "" : "s"}, ${summary.materialMismatch} material difference${summary.materialMismatch === 1 ? "" : "s"}, ${summary.missing} missing and ${summary.unresolved} need confirmation.`,
    mainPoints: points.slice(0, 2),
    additionalPointCount: Math.max(0, points.length - 2),
    thermal,
    commercial: {
      headlineTotal: summary.total,
      currency: summary.currency,
      scopeKind: summary.scopeKind,
      grossSupply: summary.commercial.grossSupply,
      discountPercentage: summary.commercial.discountPercentage,
      discountAmount: summary.commercial.discountAmount,
      netSupply: summary.commercial.netSupply,
      extras: summary.commercial.extras,
      extrasLabels: summary.commercial.extrasLabels,
      delivery: summary.commercial.delivery,
      installation: summary.commercial.installation,
      established: commercialEstablished,
      explanation: commercialEstablished
        ? "A comparable Products / Supply amount is identified separately from other evidenced scope."
        : "A comparable Products / Supply breakdown cannot currently be established from this comparison’s retained evidence. The headline price is retained without assuming that the supplier omitted a breakdown.",
    },
  };
}

export function buildQuoteComparisonReport(comparison) {
  const proposals = Array.isArray(comparison?.proposals) ? comparison.proposals.filter((proposal) => proposal.status !== "excluded") : [];
  const thermalAssumption = annualThermalAssumption(comparison);
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
    const qualifiedOffers = rawOffers.map((offer) => ({ ...qualifyOffer(offer, referenceOffer), positionReference: position.reference }));
    const assessedOffers = qualifiedOffers.map((offer) => ({ ...offer, referenceAssessment: referenceAssessmentForOffer(offer, qualifiedOffers[0]) }));
    const pricedOffers = assessedOffers.map((offer) => ({ ...offer, priceComparison: priceComparisonForOffer(offer, assessedOffers[0]) }));
    const thermalOffers = pricedOffers.map((offer) => ({ ...offer, annualHeatLoss: annualHeatLossComparison(offer, pricedOffers[0], position, thermalAssumption) }));
    const offers = thermalOffers.map((offer) => ({
      ...offer,
      presentationFields: comparisonFieldsForOffer(offer, thermalOffers[0]),
      customerFinding: customerFindingForOffer(offer, thermalOffers[0]),
    }));
    const unresolved = offers.filter((offer) => !offer.isAlternative && (offer.compliance.reviewItems.length > 0 || offer.compliance.status === "review_required" || ["review_required", "unmapped"].includes(offer.assessmentCode)));
    const ranked = unresolved.length ? [] : offers.filter((offer) => offer.assessmentCode !== "missing").sort((left, right) => compareTuple(rankingTuple(left), rankingTuple(right)));
    const bestUw = lowestKnown(offers, (offer) => offer.attributes.thermalEvidence.uw.value);
    const bestUg = lowestKnown(offers, (offer) => offer.attributes.thermalEvidence.ug.value);
    const gValues = quotedMetricValues(offers, "g");
    const ltValues = quotedMetricValues(offers, "lt");
    const comparableOffers = offers.filter((offer) => offer.commercial.comparabilityStatus === "comparable_supply" && offer.commercial.netQuantityCost != null);
    const lowestComparable = comparableOffers.length >= 2 ? lowestKnown(comparableOffers, (offer) => offer.commercial.netQuantityCost) : null;
    const narrative = positionNarrative(position, offers);
    return {
      ...position,
      offers,
      report: `${narrative.report} Conclusion: ${narrative.conclusion}`,
      conclusion: narrative.conclusion,
      findings: {
        bestUw: thermalFinding(bestUw, "uw", offers[0]),
        bestUg: thermalFinding(bestUg, "ug", offers[0]),
        bestG: null,
        bestLt: null,
        gValues,
        ltValues,
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
  const unmappedEvidence = proposals.some((proposal) => proposal.positionMappings.some((mapping) => !mapping.canonicalEstimatePositionId && ["review_required", "unmapped"].includes(mapping.differenceStatus)));
  const unresolvedPositionEvidence = summaries.slice(1).some((summary) => summary.unresolved > 0);
  const commercialCandidates = summaries.filter((summary) => summary.commercial.normalizationStatus === "net_supply_isolated" && summary.commercial.netSupply != null);
  const comparableCurrencyGroups = new Map();
  for (const summary of commercialCandidates) comparableCurrencyGroups.set(summary.currency, (comparableCurrencyGroups.get(summary.currency) ?? 0) + 1);
  const insufficientComparableCommercialEvidence = ![...comparableCurrencyGroups.values()].some((count) => count >= 2);
  const projectReviewReasons = [
    unmappedEvidence ? "unmapped supplier rows remain" : null,
    unresolvedPositionEvidence ? "Position-level evidence or quantity requires review" : null,
    insufficientComparableCommercialEvidence ? "fewer than two like-for-like net Products / Supply totals are available in one currency" : null,
  ].filter(Boolean);
  const projectReviewRequired = projectReviewReasons.length > 0;
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
  const commercialNarrative = summaries.map((summary) => `${summary.supplierName}: ${summary.total == null ? "headline price not supplied" : `${summary.currency || ""} ${summary.total.toFixed(2)} headline`}; ${summary.commercial.normalizationReason}`).join(" ");
  const customerPresentation = {
    reference: `${text(comparison?.baselineSnapshot?.estimateRef)} Revision ${Number(comparison?.baselineSnapshot?.revisionNo ?? 0)} supplies the reference specification for ${positions.length} canonical Position${positions.length === 1 ? "" : "s"}. It defines what is being compared but receives no preference.`,
    scope: `${summaries.length} offer${summaries.length === 1 ? " is" : "s are"} assessed against the same reference. Grouped components and alternatives remain attached to their supplier and source item.`,
    assessmentPriorities: [
      "Match the requested quantity, operation, dimensions and specification.",
      "Identify material differences, compromises and information that has not been confirmed.",
      "Consider thermal evidence separately from commercial price.",
      "Compare prices only where quantity and commercial scope are sufficiently like-for-like.",
    ],
    conclusion: projectReviewRequired
      ? `No overall priority order is stated because ${projectReviewReasons.join("; ")}. The Position conclusions and outstanding questions should be reviewed before a decision is made.`
      : "No automatic winner is imposed. The Position findings and like-for-like commercial evidence should be considered together before a decision is made.",
    suppliers: summaries.map((summary) => plainLanguageSupplierSummary(summary, offerGroups.get(summary.proposalId) ?? [], positions.length)),
    questions: summaries.flatMap((summary) => summary.clarifications.map((item) => ({
      supplierName: summary.supplierName,
      question: item.message,
      positionReferences: item.positionReferences,
      severity: item.severity,
    }))),
    interpretationNotes: [
      "Uw describes the whole window or door; Ug describes the centre-pane glass. They are not interchangeable.",
      "A lower thermal value is treated as an advantage only when the product, size and evidence basis are sufficiently comparable.",
      "One opening, one complete unit and a coupled set are different scopes and are kept distinct.",
      "Supply-only and installation-inclusive prices are not treated as directly comparable.",
      "Options and alternatives remain separate from the included offer unless they are explicitly selected.",
      "Documented safety-glass provision and useful technical disclosure support the assessment, but disclosure is not certification and glass suitability still requires the applicable project review.",
      "Not supplied means the retained evidence does not state the information; it does not mean the supplier cannot provide it.",
    ],
  };
  return {
    version: "quote-comparison-position-report-v2",
    generatedFromRecordRevision: Number(comparison?.recordRevision ?? 0),
    disclaimer: QUOTE_COMPARISON_EVIDENCE_DISCLAIMER,
    commonScope,
    context: {
      comparisonId: text(comparison?.id), name: text(comparison?.name) || `${text(comparison?.baselineSnapshot?.estimateRef)} supplier comparison`,
      description: text(comparison?.description) || null, status: text(comparison?.status) || "draft_review_required",
      clientId: text(comparison?.clientId), projectId: text(comparison?.projectId) || null, projectName: text(comparison?.projectName) || null,
      baselineEstimateId: text(comparison?.baselineEstimateId ?? comparison?.baselineSnapshot?.estimateId),
      baselineEstimateRef: text(comparison?.baselineSnapshot?.estimateRef), baselineRevision: Number(comparison?.baselineSnapshot?.revisionNo ?? 0),
    },
    sourceReferences: comparisonSourceReferences(comparison, positions),
    thermalMethodology: {
      ...thermalAssumption,
      formula: "ΔQ = (offer whole-element U − selected-supplier whole-element U) × equivalent total element area × heating degree-days × 24 / 1000.",
      qualification: "Estimated transmission heat loss only; it is not delivered energy consumption or a guaranteed bill saving. Solar gains and air leakage are excluded. Ug is not added to Uw or Ud.",
    },
    positions,
    suppliers: summaries,
    recommendations: rankedSummaries.slice(0, 3).map((supplier, index) => ({
      rank: index + 1,
      supplierName: supplier.supplierName,
      label: index === 0 ? "Best overall" : index === 1 ? "Second" : "Third",
      reason: `${supplier.correct} compliant, ${supplier.acceptable} acceptable with qualification, ${supplier.materialMismatch} material mismatch, ${supplier.missing} missing and ${supplier.unresolved} unresolved across ${positions.length} canonical Positions${supplier.commercial.netSupply == null ? "; comparable net supply price is not normalisable" : `; comparable net supply ${supplier.currency || ""} ${supplier.commercial.netSupply.toFixed(2)}`}.`,
    })),
    recommendationStatus: projectReviewRequired ? "review_required" : "ready",
    recommendationMessage: projectReviewRequired ? `A reliable project Top 3 is withheld because ${projectReviewReasons.join("; ")}.` : null,
    orderingRules: ["Material mismatch or missing Position", "Unresolved Position evidence", "Number of compliant Positions", "Acceptable qualified alternatives", "Evidence completeness", "Availability of comparable net Products / Supply", "Comparable net supply price", "Supplier name only as a deterministic final tie-break"],
    overallConclusion: `${commercialNarrative} ${projectReviewRequired ? `Conclusion: no overall ranking is supported until ${projectReviewReasons.join("; ")}.` : "Conclusion: the displayed ranking follows Position compliance first and comparable commercial evidence second; the baseline receives no preference."}`,
    clarifications: summaries.map((supplier) => ({ proposalId: supplier.proposalId, supplierName: supplier.supplierName, items: supplier.clarifications })),
    customerPresentation,
  };
}
