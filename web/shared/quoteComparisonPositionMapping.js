const text = (value) => String(value ?? "").trim();
const numeric = (value) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
};

const referenceCore = (value) => text(value)
  .toUpperCase()
  .replace(/^(?:OPTION\s+)?(?:TYPE|STYLE)\s+/, "")
  .replace(/\s+(?:ALT|OPTION)$/i, "")
  .replace(/\s+COUPLERS?$/i, "")
  .replace(/[^A-Z0-9]+/g, "");

const canonicalReferenceCore = (value) => referenceCore(String(value || "").replace(/\s*\(A\)\s*$/i, ""));
const positionReference = (position) => text(position?.customerReference || position?.positionRef || position?.reference || position?.displayReference || position?.id);
const isAlternativePosition = (position) => text(position?.classification).toLowerCase() === "alternative" || /\(A\)\s*$/i.test(positionReference(position));
const isAlternativeItem = (item) => {
  const snapshot = item?.supplierItemSnapshot || {};
  return text(snapshot.classification).toLowerCase() === "alternative" || item?.relationshipKind === "alternative";
};

function itemReference(item) {
  const snapshot = item?.supplierItemSnapshot || {};
  return snapshot.alternativeTo || snapshot.componentForReference || snapshot.customerReference || item?.supplierItemReference;
}

function configurationKind(value) {
  const source = text(value).toLowerCase();
  if (!source) return null;
  if (/lift\s*(?:&|and|[-–—])?\s*slide|sliding door|hsda|hs330|s319a|s315a/.test(source)) return "sliding_door";
  if (/entrance door|main door|panel door|inward opening door|\bdoor\b|multi[ -]?point|yia|s305a/.test(source)) return "entrance_door";
  if (/tilt|turn|reversible|friction hinge|opening outside|vuta/.test(source)) return "opening_window";
  if (/fixed|fka|fix\b/.test(source)) return "fixed_window";
  return null;
}

function chooseReferenceCandidate(item, positions) {
  const snapshot = item.supplierItemSnapshot || {};
  const core = referenceCore(itemReference(item));
  if (!core) return null;
  const sameBase = positions.filter((position) => canonicalReferenceCore(positionReference(position)) === core);
  if (!sameBase.length) return null;
  const alternative = isAlternativeItem(item) || Boolean(snapshot.componentRole);
  const preferred = sameBase.filter((position) => isAlternativePosition(position) === alternative);
  return preferred.length === 1 ? preferred[0] : sameBase.length === 1 ? sameBase[0] : null;
}

function chooseDimensionCandidate(item, positions) {
  const snapshot = item.supplierItemSnapshot || {};
  const width = numeric(snapshot.widthMm), height = numeric(snapshot.heightMm);
  if (!(width > 0 && height > 0)) return null;
  const expectedAlternative = isAlternativeItem(item);
  const matches = positions.filter((position) => numeric(position.widthMm) === width && numeric(position.heightMm) === height);
  const preferred = matches.filter((position) => isAlternativePosition(position) === expectedAlternative);
  return preferred.length === 1 ? preferred[0] : matches.length === 1 ? matches[0] : null;
}

function inferSequenceCandidate(index, resolved, positions) {
  let previous = null, next = null;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) if (resolved[cursor]?.position) { previous = resolved[cursor]; break; }
  for (let cursor = index + 1; cursor < resolved.length; cursor += 1) if (resolved[cursor]?.position) { next = resolved[cursor]; break; }
  if (!previous || !next) return null;
  const previousIndex = positions.indexOf(previous.position), nextIndex = positions.indexOf(next.position);
  return nextIndex - previousIndex === 2 ? positions[previousIndex + 1] : null;
}

function differencesFor(item, position) {
  const snapshot = item.supplierItemSnapshot || {}, differences = [];
  const width = numeric(snapshot.widthMm), height = numeric(snapshot.heightMm);
  if (width != null && width !== numeric(position.widthMm)) differences.push({ field: "widthMm", baseline: position.widthMm, supplier: width });
  if (height != null && height !== numeric(position.heightMm)) differences.push({ field: "heightMm", baseline: position.heightMm, supplier: height });
  const baselineQuantity = numeric(position.quantity ?? position.qty) ?? 1, supplierQuantity = numeric(snapshot.quantity) ?? 1;
  if (!snapshot.componentRole && supplierQuantity !== baselineQuantity) differences.push({ field: "quantity", baseline: baselineQuantity, supplier: supplierQuantity });
  const baselineConfiguration = configurationKind([position.configurationDescription,position.insertion,position.product,position.positionType,position.fittingsSpecification].filter(Boolean).join(" · "));
  const supplierConfiguration = configurationKind([snapshot.configurationDescription,snapshot.product,snapshot.productSystem,snapshot.fittingsSpecification].filter(Boolean).join(" · "));
  if (baselineConfiguration && supplierConfiguration && baselineConfiguration !== supplierConfiguration) differences.push({ field: "configuration", baseline: baselineConfiguration, supplier: supplierConfiguration });
  if (snapshot.componentRole) differences.push({ field: "component", baseline: positionReference(position), supplier: snapshot.product || item.supplierItemReference, note: "Source-backed coupling component supports the supplier solution and is not treated as an additional window." });
  return differences;
}

function statusFor(item, position, authority, differences) {
  if (!position) return "review_required";
  if (differences.some((entry) => entry.field === "configuration")) return "configuration_mismatch";
  if (differences.some((entry) => entry.field === "widthMm" || entry.field === "heightMm")) return "dimension_mismatch";
  if (differences.some((entry) => entry.field === "quantity")) return "quantity_mismatch";
  if (differences.some((entry) => entry.field === "component")) return "minor_difference";
  if (isAlternativeItem(item)) return "alternative";
  return authority === "reference" ? "exact_match" : "close_acceptable_alternative";
}

export function inferQuoteComparisonMappings(items, positions) {
  const sourceItems = Array.isArray(items) ? items : [], canonicalPositions = Array.isArray(positions) ? positions : [];
  const resolved = sourceItems.map((item) => {
    if (item.canonicalEstimatePositionId) return { item, position: canonicalPositions.find((position) => text(position.id) === text(item.canonicalEstimatePositionId)) || null, authority: "explicit" };
    const reference = chooseReferenceCandidate(item, canonicalPositions);
    if (reference) return { item, position: reference, authority: "reference" };
    const dimensions = chooseDimensionCandidate(item, canonicalPositions);
    return { item, position: dimensions, authority: dimensions ? "unique_dimensions" : "unresolved" };
  });
  for (let index = 0; index < resolved.length; index += 1) if (!resolved[index].position && !resolved[index].item?.supplierItemSnapshot?.componentRole) {
    const candidate = inferSequenceCandidate(index, resolved, canonicalPositions);
    if (candidate) resolved[index] = { ...resolved[index], position: candidate, authority: "bounded_sequence_between_confirmed_neighbours" };
  }
  const counts = new Map();
  for (const entry of resolved) if (entry.position) counts.set(text(entry.position.id), (counts.get(text(entry.position.id)) || 0) + 1);
  const claimedPositionIds = new Set();
  const mappings = resolved.map(({ item, position, authority }) => {
    if (!position) return { ...item, relationshipKind: "unmapped", differenceStatus: "review_required", provenance: { ...(item.provenance || {}), mappingAuthority: "automatic_unresolved" } };
    const positionId = text(position.id), differences = differencesFor(item, position), alternative = isAlternativeItem(item);
    if (!alternative) claimedPositionIds.add(positionId);
    const explicit = authority === "explicit";
    return {
      ...item,
      canonicalEstimatePositionId: positionId,
      relationshipKind: explicit && item.relationshipKind && item.relationshipKind !== "unmapped" ? item.relationshipKind : alternative ? "alternative" : counts.get(positionId) > 1 || item.supplierItemSnapshot?.componentRole ? "grouped" : "exact",
      differenceStatus: explicit && item.differenceStatus ? item.differenceStatus : statusFor(item, position, authority, differences),
      differences: explicit && Array.isArray(item.differences) ? item.differences : differences,
      provenance: { ...(item.provenance || {}), mappingAuthority: `automatic_${authority}`, mappingEvidence: { sourceReference: itemReference(item), canonicalReference: positionReference(position) } },
    };
  });
  return { mappings, claimedPositionIds };
}
