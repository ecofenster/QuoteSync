export type CustomerSafeSpecificationCategory = "finishes" | "glazing" | "performance" | "hardware" | "frame" | "accessories";

export type CustomerSafeSpecificationItem = {
  concept: string;
  category: CustomerSafeSpecificationCategory;
  label: string;
  value: string;
};

export type CustomerSafeManufacturerSpecification = {
  version: "customer-safe-manufacturer-specification-v1";
  productSystem: string;
  configurationDescription: string;
  items: CustomerSafeSpecificationItem[];
};

export const CUSTOMER_SAFE_MANUFACTURER_SPECIFICATION_POLICY = Object.freeze({
  version: "customer-safe-manufacturer-specification-policy-v1",
  customerDefaultConcepts: Object.freeze([
    "system", "configuration", "external_finish", "internal_finish", "glazing_build_up", "glass_thickness",
    "spacer", "acoustic", "solar_factor", "light_transmission", "hardware", "operation", "locking", "security",
    "customer_accessory",
  ]),
  internalDefaultConcepts: Object.freeze([
    "manufacturer_production_code", "profile_manufacturing_code", "weld", "drainage", "decompression", "weight",
    "perimeter", "pane_dimensions", "manufacturer_warning", "manufacturer_message", "raw_section_label",
  ]),
});

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string"
  ? value.replace(/[\s\u00a0]+/g, " ").trim()
  : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
const records = (value: unknown) => Array.isArray(value) ? value.map(record) : [];
const valueOf = (value: unknown) => text(record(value).value) || text(value);
const unique = (values: unknown[]) => [...new Set(values.map(text).filter(Boolean))];
const genericProducts = new Set(["window", "door", "single door", "product"]);

function internalItem(evidence: Record<string, unknown>, groupId: string, label: string) {
  const internal = record(evidence.internalSpecification);
  const group = records(internal.groups).find((candidate) => text(candidate.id) === groupId);
  const item = records(group?.items).find((candidate) => text(candidate.label).toLocaleLowerCase("en-GB") === label.toLocaleLowerCase("en-GB"));
  return text(item?.value);
}

function profileFamily(value: string) {
  const match = value.match(/^\s*[A-Z0-9_-]+\s+frame\s+(.+?)\s*$/i);
  return match ? match[1].trim() : "";
}

function titleCaseManufacturerPhrase(value: string) {
  if (!/[A-Z]{4,}/.test(value)) return value;
  return value.toLocaleLowerCase("en-GB")
    .replace(/(^|[\s-])([a-z])/g, (_match, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase("en-GB")}`)
    .replace(/\b(And|Or|Of|In)\b/g, (word) => word.toLocaleLowerCase("en-GB"));
}

function friendlyOpening(value: string) {
  const clean = value.replace(/^\s*\d+(?:\.\d+)+\s*:\s*/, "").trim();
  if (/^fix(?:ed)?(?:\s+in\s+frame)?$/i.test(clean)) return "Fixed";
  return titleCaseManufacturerPhrase(clean).replace(/\s+-\s+/g, " – ");
}

function projectConfiguration(evidence: Record<string, unknown>, canonical: Record<string, unknown>) {
  const sashes = records(canonical.sashes);
  const descriptions = sashes.map((sash) => {
    const fitting = text(sash.fitting);
    if (fitting) return friendlyOpening(fitting);
    const profile = text(sash.profile);
    return /\bfix(?:ed)?\b/i.test(profile) ? "Fixed" : friendlyOpening(profile);
  }).filter(Boolean);
  if (descriptions.length) return descriptions.join(" / ");
  const existing = text(evidence.configurationDescription) || internalItem(evidence, "opening", "Configuration");
  return existing.includes(";") || /^\s*\d+(?:\.\d+)+\s*:/.test(existing)
    ? existing.split(";").map(friendlyOpening).filter(Boolean).join(" / ")
    : existing;
}

function projectProductSystem(evidence: Record<string, unknown>, canonical: Record<string, unknown>, fallback: string) {
  const candidates = [
    text(evidence.productSystem),
    valueOf(canonical.system),
    internalItem(evidence, "product", "System"),
    profileFamily(valueOf(canonical.frameProfile)),
    text(evidence.product),
    fallback,
  ];
  return candidates.find((candidate) => candidate && !genericProducts.has(candidate.toLocaleLowerCase("en-GB")))
    || candidates.find(Boolean)
    || fallback;
}

function finishValue(value: unknown) {
  const finish = record(value);
  const base = text(finish.value) || text(finish.manufacturerSourceValue).replace(/^\s*1-side\s+(?:ext\.|int\.)\s*/i, "").replace(/^\s*[A-Z]{2}\d+\s*\/\s*/, "");
  const code = text(finish.manufacturerCode);
  return base && code && !base.includes(code) ? `${base} (${code})` : base;
}

function glazingBuildUp(evidence: Record<string, unknown>, canonical: Record<string, unknown>, panes: Record<string, unknown>[]) {
  const raw = valueOf(canonical.glazing) || text(evidence.glassSpecification);
  const buildUp = raw.replace(/\s*\[Ug\s*=.*?\]/gi, "").replace(/\s*Rw\s*=\s*[^\s(]+/gi, "").replace(/\s*\(\s*\d+(?:\.\d+)?\s*mm\s*\)/gi, "").replace(/\s+/g, " ").trim();
  const thicknesses = unique(panes.map((pane) => pane.thicknessMm)).map((value) => `${value} mm`);
  return [buildUp, thicknesses.length === 1 ? thicknesses[0] : ""].filter(Boolean).join(" · ");
}

function normalizedSpacer(value: string) {
  return value.replace(/^\s*(?:warm\s+edge|spacer)\s*:\s*/i, "").replace(/\s*\(\s*\d+\s*\)\s*$/, "").trim();
}

function dbValue(value: string) {
  const match = value.match(/([\d.]+)\s*dB/i);
  return match ? `Rw ${match[1]} dB` : value;
}

const legacyConcepts: Record<string, Omit<CustomerSafeSpecificationItem, "value">> = {
  "alu cladded": { concept: "external_finish", category: "finishes", label: "External" },
  "external finish": { concept: "external_finish", category: "finishes", label: "External" },
  timber: { concept: "internal_finish", category: "finishes", label: "Internal" },
  material: { concept: "finish_material", category: "finishes", label: "Material" },
  "surface finishing": { concept: "surface_finish", category: "finishes", label: "Surface" },
  "glass unit": { concept: "glazing_build_up", category: "glazing", label: "Glazing" },
  fittings: { concept: "hardware", category: "hardware", label: "Hardware" },
  locking: { concept: "locking", category: "hardware", label: "Locking" },
  "trickle ventilator": { concept: "customer_accessory", category: "accessories", label: "Ventilation" },
  "drip rail": { concept: "customer_accessory", category: "accessories", label: "Drip rail" },
  threshold: { concept: "customer_accessory", category: "accessories", label: "Threshold" },
  "sash sealing": { concept: "sealing", category: "finishes", label: "Sash sealing" },
  "glass sealing": { concept: "sealing", category: "finishes", label: "Glass sealing" },
};

function glassSealingFromSourceTrace(snapshotValue: unknown) {
  const snapshot = record(snapshotValue);
  const lines = (Array.isArray(snapshot.sourceTrace) ? snapshot.sourceTrace : []).map((value) => text(record(value).extractedText)).filter(Boolean);
  const headingIndex = lines.findIndex((line) => /^\s*(?:\d+\.\s*)?glass sealing\s*:?\s*$/i.test(line));
  if (headingIndex < 0) return "";
  const values: string[] = [];
  for (const line of lines.slice(headingIndex + 1)) {
    if (/^\s*\d+\.\s*/.test(line)) break;
    const match = line.match(/^\s*(internally|externally)\s*:\s*(.+?)\s*,?\s*$/i);
    if (match) values.push(`${match[1][0].toUpperCase()}${match[1].slice(1).toLocaleLowerCase("en-GB")}: ${match[2]}`);
  }
  return values.join("\n");
}

function legacyItems(evidence: Record<string, unknown>) {
  return (Array.isArray(evidence.customerSafeSpecification) ? evidence.customerSafeSpecification : []).flatMap((value) => {
    const source = record(value);
    const mapped = legacyConcepts[text(source.label).toLocaleLowerCase("en-GB")];
    const content = text(source.value);
    return mapped && content ? [{ ...mapped, value: content }] : [];
  });
}

function add(items: CustomerSafeSpecificationItem[], item: CustomerSafeSpecificationItem | null) {
  if (!item?.value || items.some((candidate) => candidate.concept === item.concept && candidate.value.toLocaleLowerCase("en-GB") === item.value.toLocaleLowerCase("en-GB"))) return;
  items.push(item);
}

/**
 * Deterministically projects canonical manufacturer concepts for a standard
 * customer quotation. It does not persist or mutate manufacturer evidence.
 */
export function projectCustomerSafeManufacturerSpecification(
  evidenceValue: unknown,
  fallbackProductSystem = "",
  sourceSnapshotValue: unknown = null,
): CustomerSafeManufacturerSpecification {
  const evidence = record(evidenceValue);
  const source = record(evidence.sourceSpecification);
  const canonical = record(evidence.canonicalSpecification ?? source.canonical);
  const panes = records(canonical.glazingUnits);
  const sashes = records(canonical.sashes);
  const items: CustomerSafeSpecificationItem[] = [];

  for (const item of legacyItems(evidence)) add(items, item);
  const glassSealing = glassSealingFromSourceTrace(sourceSnapshotValue);
  add(items, { concept: "sealing", category: "finishes", label: "Glass sealing", value: glassSealing });

  add(items, { concept: "external_finish", category: "finishes", label: "External", value: finishValue(canonical.externalFinish) });
  add(items, { concept: "internal_finish", category: "finishes", label: "Internal", value: finishValue(canonical.internalFinish) });

  add(items, { concept: "glazing_build_up", category: "glazing", label: "Glazing", value: glazingBuildUp(evidence, canonical, panes) });
  const spacers = unique(panes.map((pane) => normalizedSpacer(text(pane.warmEdge))));
  add(items, { concept: "spacer", category: "glazing", label: "Warm edge", value: spacers.join(" / ") });

  const acoustic = unique(panes.map((pane) => dbValue(text(pane.acousticRw))));
  const solar = unique(panes.map((pane) => pane.solarGainPercent)).map((value) => `${value}%`);
  const light = unique(panes.map((pane) => pane.lightTransmissionPercent)).map((value) => `${value}%`);
  add(items, { concept: "acoustic", category: "performance", label: "Acoustic", value: acoustic.join(" / ") });
  add(items, { concept: "solar_factor", category: "performance", label: "Solar factor", value: solar.join(" / ") });
  add(items, { concept: "light_transmission", category: "performance", label: "Light transmission", value: light.join(" / ") });

  const hardware = unique(sashes.map((sash) => sash.hardware));
  const operation = unique(sashes.map((sash) => sash.closing));
  const locking = unique(sashes.map((sash) => sash.locking));
  const security = unique(sashes.map((sash) => sash.security));
  add(items, { concept: "hardware", category: "hardware", label: "Hardware", value: hardware.join(" / ") });
  add(items, { concept: "operation", category: "hardware", label: "Operation", value: operation.join(" / ") });
  add(items, { concept: "locking", category: "hardware", label: "Locking", value: locking.join(" / ") });
  add(items, { concept: "security", category: "hardware", label: "Security", value: security.join(" / ") });

  const frame = profileFamily(valueOf(canonical.frameProfile));
  const productSystem = projectProductSystem(evidence, canonical, fallbackProductSystem);
  const product = text(evidence.product);
  if (product && !genericProducts.has(product.toLocaleLowerCase("en-GB")) && product.toLocaleLowerCase("en-GB") !== productSystem.toLocaleLowerCase("en-GB")) {
    add(items, { concept: "product", category: "frame", label: "Product", value: product });
  }
  if (frame && !productSystem.toLocaleLowerCase("en-GB").includes(frame.toLocaleLowerCase("en-GB"))) {
    add(items, { concept: "frame_family", category: "frame", label: "Frame", value: frame });
  }

  for (const accessory of records(canonical.accessories).filter((value) => value.customerFacing === true)) {
    add(items, { concept: `customer_accessory_${items.length}`, category: "accessories", label: "Accessory", value: text(accessory.description) });
  }

  return {
    version: "customer-safe-manufacturer-specification-v1",
    productSystem,
    configurationDescription: projectConfiguration(evidence, canonical),
    items,
  };
}
