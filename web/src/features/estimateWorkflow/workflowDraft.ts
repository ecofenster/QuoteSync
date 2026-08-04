import {
  CONFIGURATION_SECTION_OPTIONS,
  WINDOW_GLASS_PRESETS,
  normalizeConfigurationState,
} from "../configurator/configuratorWorkflow.helpers";
import { getLegacyWindowConfiguration } from "../configurator/legacyWindowConfigurationAdapter";
import type {
  ConfiguratorEstimateDefaultsSectionId,
  ConfiguratorWorkflowDraft,
  ConfiguratorWorkflowStepId,
} from "./workflow.types";

type DraftSeed = {
  estimateId?: string | null;
  clientId?: string | null;
  positionId?: string | null;
  estimate?: any;
  client?: any;
  position?: any;
  activeStepId?: ConfiguratorWorkflowStepId;
};

const STORAGE_PREFIX = "quotesync:configuratorWorkflowDraft";

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function toAddressJson(value: unknown) {
  if (!value) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export function getWorkflowDraftStorageKey(estimateId?: string | null, positionId?: string | null) {
  if (!estimateId || !positionId) return null;
  return `${STORAGE_PREFIX}:${estimateId}:${positionId}`;
}

export function createDraft(seed: DraftSeed): ConfiguratorWorkflowDraft {
  const estimate = seed.estimate ?? {};
  const client = seed.client ?? {};
  const position = seed.position ?? {};
  const defaults = estimate?.defaults ?? {};
  const defaultsSectionOrder: ConfiguratorEstimateDefaultsSectionId[] = [
    "supplierProduct",
    "timberOptions",
    "hardwareHandles",
  ];
  const address =
    estimate?.projectAddressStructured ??
    client?.projectAddressStructured ??
    estimate?.location?.projectAddressStructured ??
    null;
  const now = new Date().toISOString();
  const legacyWindowConfiguration = getLegacyWindowConfiguration(position);
  const glassPreset =
    WINDOW_GLASS_PRESETS.find((preset) => preset.spec === defaults?.glassType || preset.label === defaults?.glassType) ??
    WINDOW_GLASS_PRESETS[0];

  return {
    version: 1,
    estimateId: seed.estimateId ?? undefined,
    clientId: seed.clientId ?? undefined,
    positionId: seed.positionId ?? undefined,
    activeStepId: seed.activeStepId ?? "forecast",
    completedStepIds: [],
    skippedStepIds: [],
    lastUpdatedAt: now,
    isDirty: false,
    forecast: {
      estimatedOrderForecast:
        [estimate?.estimatedOrderMonth, estimate?.estimatedOrderYear].filter(Boolean).join(" ").trim() || undefined,
    },
    projectSiteAddress: {
      addressLine1: address?.line1 ?? "",
      addressLine2: address?.line2 ?? "",
      city: address?.city ?? address?.town ?? "",
      county: address?.county ?? "",
      postcode: estimate?.postcode ?? client?.postcode ?? "",
      what3words: estimate?.what3words ?? client?.what3words ?? "",
      latitude: estimate?.latitude ?? client?.latitude ?? null,
      longitude: estimate?.longitude ?? client?.longitude ?? null,
      addressJson: toAddressJson(address),
    },
    invoiceAddress: {
      addressLine1: client?.invoiceAddressLine1 ?? client?.addressLine1 ?? "",
      addressLine2: client?.invoiceAddressLine2 ?? client?.addressLine2 ?? "",
      city: client?.invoiceCity ?? client?.city ?? "",
      county: client?.invoiceCounty ?? client?.county ?? "",
      postcode: client?.invoicePostcode ?? client?.postcode ?? "",
      what3words: client?.invoiceWhat3words ?? client?.what3words ?? "",
      latitude: client?.invoiceLatitude ?? client?.latitude ?? null,
      longitude: client?.invoiceLongitude ?? client?.longitude ?? null,
      addressJson: toAddressJson(client?.invoiceAddressStructured ?? null),
      useProjectSiteAddress: false,
    },
    estimateDefaults: {
      activeSectionId: defaultsSectionOrder[0],
      sectionOrder: defaultsSectionOrder,
      defaultsSnapshot: defaults,
      manufacturerId: defaults?.manufacturerId ?? null,
      productId: defaults?.productId ?? null,
      windowTypeId: defaults?.windowTypeId ?? null,
      suppressSillStep: position?.useEstimateDefaults !== false,
      hasUserOverrides: Boolean(position?.overrides && Object.keys(position.overrides).length),
    },
    addPosition: {
      product: position?.product ?? defaults?.supplier ?? "",
      productType: position?.productType ?? defaults?.productType ?? "",
      positionReference: position?.positionRef ?? "",
      quantity: Number(position?.qty || 1),
      roomName: position?.roomName ?? "",
      positionType: "Window",
      family: "window",
    },
    dimensions: {
      widthMm: Number(position?.widthMm || 1000),
      heightMm: Number(position?.heightMm || 1200),
    },
    externalWindowSill: {
      mode: defaults?.externalSillRequired ? "default" : "none",
      depthMm: Number(defaults?.cillDepthMm || 0) || null,
      leftEndCapType: defaults?.cillEndCapType ?? null,
      rightEndCapType: defaults?.cillEndCapType ?? null,
      userEdited: false,
    },
    configuration: normalizeConfigurationState(
      {
        ...legacyWindowConfiguration,
        activeSectionId:
          legacyWindowConfiguration.activeSectionId ?? CONFIGURATION_SECTION_OPTIONS[0]?.id ?? "layout",
        glass: {
          presetId: glassPreset.id,
          presetLabel: glassPreset.label,
          presetSpec: defaults?.glassType ?? glassPreset.spec,
        },
        hardware: {
          defaultHandleType: defaults?.windowHandleType ?? null,
          defaultHandleHeightMm: null,
          defaultHingeType: defaults?.hingeType ?? null,
        },
      },
      position
    ),
    review: {
      confirmed: false,
    },
  };
}

export function createEmptyDraft(activeStepId: ConfiguratorWorkflowStepId = "forecast"): ConfiguratorWorkflowDraft {
  return createDraft({ activeStepId });
}

export function loadDraft(storageKey: string | null, fallbackDraft: ConfiguratorWorkflowDraft) {
  if (!storageKey || typeof window === "undefined" || !window.localStorage) {
    return fallbackDraft;
  }

  const stored = safeParseJson<ConfiguratorWorkflowDraft>(window.localStorage.getItem(storageKey));
  if (!stored || stored.version !== 1) {
    return fallbackDraft;
  }

  return {
    ...fallbackDraft,
    ...stored,
    forecast: { ...fallbackDraft.forecast, ...stored.forecast },
    projectSiteAddress: { ...fallbackDraft.projectSiteAddress, ...stored.projectSiteAddress },
    invoiceAddress: { ...fallbackDraft.invoiceAddress, ...stored.invoiceAddress },
    estimateDefaults: { ...fallbackDraft.estimateDefaults, ...stored.estimateDefaults },
    addPosition: { ...fallbackDraft.addPosition, ...stored.addPosition },
    dimensions: { ...fallbackDraft.dimensions, ...stored.dimensions },
    externalWindowSill: { ...fallbackDraft.externalWindowSill, ...stored.externalWindowSill },
    configuration: normalizeConfigurationState(
      {
        ...fallbackDraft.configuration,
        ...stored.configuration,
      },
      null
    ),
    review: { ...fallbackDraft.review, ...stored.review },
  };
}

export function saveDraft(storageKey: string | null, draft: ConfiguratorWorkflowDraft | null) {
  if (!storageKey || !draft || typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // Ignore localStorage failures to keep workflow usable.
  }
}

export function clearDraft(storageKey: string | null) {
  if (!storageKey || typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore localStorage failures to keep workflow usable.
  }
}
