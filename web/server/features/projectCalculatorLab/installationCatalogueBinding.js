const INSTALLATION_CATALOGUE_CATEGORIES = new Set([
  "illbruck_me508",
  "illbruck_me501",
  "illbruck_tp600",
  "illbruck_tp601",
  "illbruck_fm330",
  "illbruck_me902",
  "bracket",
  "frame_screw",
  "concrete_screw",
  "masonry_fixing",
  "timber_fixing",
  "icf_fixing",
  "packer",
  "tool",
]);

const MATERIAL_CODES = ["ME508", "ME501", "TP600", "FM330", "ME902", "AA270", "AB005"];

const productCode = item => String(item?.variant?.productCode ?? item?.variant?.productName ?? "").trim().toUpperCase();
const numberOrNull = value => Number.isFinite(Number(value)) ? Number(value) : null;

export function installationMaterialCode(item) {
  if (!item) return null;
  if (item.category === "illbruck_me508") return "ME508";
  if (item.category === "illbruck_me501") return "ME501";
  if (["illbruck_tp600", "illbruck_tp601"].includes(item.category)) return "TP600";
  if (item.category === "illbruck_fm330") return "FM330";
  if (item.category === "illbruck_me902") return "ME902";
  const code = productCode(item);
  if (item.category === "tool" && ["AA270", "AB005"].includes(code)) return code;
  return null;
}

function variantIdentity(code, item) {
  const variant = item?.variant ?? {};
  if (code === "ME508" || code === "ME501") {
    return JSON.stringify([code, numberOrNull(variant.rollWidthMm), numberOrNull(variant.rollLengthM)]);
  }
  if (code === "TP600") {
    return JSON.stringify([
      code,
      productCode(item),
      numberOrNull(variant.tapeWidthMm),
      numberOrNull(variant.jointGapMinMm),
      numberOrNull(variant.jointGapMaxMm),
      numberOrNull(variant.rollLengthM),
    ]);
  }
  return JSON.stringify([code, productCode(item)]);
}

function mapSelection(code, selection, savedCatalogue, currentCatalogue) {
  const source = selection && typeof selection === "object" ? selection : {};
  const oldId = source.productId ? String(source.productId) : null;
  let selected = oldId ? currentCatalogue.find(item => item.id === oldId && installationMaterialCode(item) === code) : null;
  if (!selected && oldId) {
    const oldItem = savedCatalogue.find(item => item.id === oldId);
    if (oldItem) {
      const identity = variantIdentity(code, oldItem);
      const matches = currentCatalogue.filter(item => installationMaterialCode(item) === code && variantIdentity(code, item) === identity);
      if (matches.length === 1) selected = matches[0];
    }
  }
  return {
    ...source,
    required: source.required === true,
    productId: selected?.id ?? null,
    quantity: code === "AA270" || code === "AB005" ? source.required === true ? 1 : 0 : null,
  };
}

export function currentInstallationCatalogueItems(catalogue) {
  return (Array.isArray(catalogue) ? catalogue : []).filter(item => item?.active !== false && item?.category !== "illbruck_tp601" && INSTALLATION_CATALOGUE_CATEGORIES.has(item?.category));
}

export function installationCatalogueFingerprint(catalogue, rule) {
  const items = currentInstallationCatalogueItems(catalogue)
    .map(item => ({ id: item.id, category: item.category, label: item.label, rateType: item.rateType, priceAmount: item.priceAmount, currency: item.currency, variant: item.variant, version: item.version }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return JSON.stringify({ items, rule: rule ?? null });
}

export function describeInstallationCatalogueState(snapshot, currentConfiguration) {
  const savedRule = snapshot?.rules?.installation_materials_v1 ?? null;
  const currentRule = currentConfiguration?.rules?.installation_materials_v1 ?? null;
  const snapshotFingerprint = installationCatalogueFingerprint(snapshot?.catalogue, savedRule);
  const currentFingerprint = installationCatalogueFingerprint(currentConfiguration?.catalogue, currentRule);
  return {
    isCurrent: snapshotFingerprint === currentFingerprint,
    snapshotRuleVersion: savedRule?.version ?? null,
    currentRuleVersion: currentRule?.version ?? null,
    snapshotCreatedAt: snapshot?.createdAt ?? null,
  };
}

export function bindInstallationMaterialsToCurrentCatalogue({
  savedCatalogue,
  savedRules,
  currentConfiguration,
  currentOptions,
  now,
  sourceScenarioRevision,
  targetScenarioRevision,
  useCurrentDefaults = true,
}) {
  const previousCatalogue = Array.isArray(savedCatalogue) ? savedCatalogue : [];
  const activeCurrent = currentInstallationCatalogueItems(currentConfiguration?.catalogue);
  const retained = previousCatalogue.filter(item => !INSTALLATION_CATALOGUE_CATEGORIES.has(item?.category));
  const currentRule = currentConfiguration?.rules?.installation_materials_v1;
  if (!currentRule) throw Object.assign(new Error("Current Installation Materials rules are unavailable."), { code: "invalid_options" });

  const previousSelections = currentOptions?.materialSelections && typeof currentOptions.materialSelections === "object" ? currentOptions.materialSelections : {};
  const materialSelections = Object.fromEntries(MATERIAL_CODES.map(code => [code, mapSelection(code, previousSelections[code], previousCatalogue, activeCurrent)]));
  const installationMaterials = {
    ...(currentOptions && typeof currentOptions === "object" ? currentOptions : {}),
    materialSelections,
    me508ProductId: materialSelections.ME508.productId,
    tp600ProductId: materialSelections.TP600.productId,
    frameScrewProductId: activeCurrent.filter(item => item.category === "frame_screw").length === 1 ? activeCurrent.find(item => item.category === "frame_screw").id : null,
    packerProductId: null,
    packerMix: [],
    packerCalculationMode: currentRule.value?.packerCalculationMode ?? "manual",
    capturedRuleVersion: currentRule.version ?? null,
    capturedAt: now,
    updatedAt: now,
    calculationSnapshot: null,
    catalogueBinding: {
      mode: "administration_current",
      appliedAt: now,
      sourceScenarioRevision,
      targetScenarioRevision,
      ruleVersion: currentRule.version ?? null,
    },
  };
  if (useCurrentDefaults) {
    installationMaterials.bracketLengthMm = currentRule.value?.defaultBracketLengthMm ?? installationMaterials.bracketLengthMm ?? null;
    installationMaterials.bracketProductId = null;
    installationMaterials.bracketSelectionSource = "current_admin_default";
    installationMaterials.contingencyPercent = currentRule.value?.defaultContingencyPercent ?? installationMaterials.contingencyPercent ?? 0;
  }

  return {
    catalogue: [...retained, ...activeCurrent],
    rules: { ...(savedRules && typeof savedRules === "object" ? savedRules : {}), installation_materials_v1: currentRule },
    installationMaterials,
  };
}
