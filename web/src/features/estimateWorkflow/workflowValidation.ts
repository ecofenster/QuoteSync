import type { ConfiguratorWorkflowDraft } from "./workflow.types";
import { createEmptyDraft } from "./workflowDraft";

function hasMeaningfulAddressLocator(step: ConfiguratorWorkflowDraft["projectSiteAddress"] | null | undefined) {
  const safeStep = step ?? {};
  return Boolean(
    safeStep.addressLine1 ||
      safeStep.city ||
      safeStep.postcode ||
      safeStep.what3words ||
      safeStep.addressJson ||
      (typeof safeStep.latitude === "number" && typeof safeStep.longitude === "number")
  );
}

function safeDraft(draft: ConfiguratorWorkflowDraft | null | undefined): ConfiguratorWorkflowDraft {
  return draft ?? createEmptyDraft("forecast");
}

export function validateForecastStep(): string[] {
  return [];
}

export function validateProjectSiteAddressStep(draft: ConfiguratorWorkflowDraft | null | undefined): string[] {
  const nextDraft = safeDraft(draft);
  return hasMeaningfulAddressLocator(nextDraft.projectSiteAddress)
    ? []
    : ["Add at least one meaningful project site locator before continuing."];
}

export function validateEstimateDefaultsStep(draft: ConfiguratorWorkflowDraft | null | undefined): string[] {
  const nextDraft = safeDraft(draft);
  const snapshot = nextDraft.estimateDefaults.defaultsSnapshot ?? {};
  const manufacturerId = String(nextDraft.estimateDefaults.manufacturerId ?? snapshot.manufacturerId ?? "").trim();
  const productId = String(nextDraft.estimateDefaults.productId ?? snapshot.productId ?? "").trim();
  return manufacturerId && productId
    ? []
    : ["Choose a supplier/manufacturer and product before continuing."];
}

export function validateAddPositionStep(draft: ConfiguratorWorkflowDraft | null | undefined): string[] {
  const nextDraft = safeDraft(draft);
  const errors: string[] = [];
  if (!String(nextDraft.addPosition.product || "").trim()) {
    errors.push("Choose a product/system seed before continuing.");
  }
  if (!String(nextDraft.addPosition.productType || "").trim()) {
    errors.push("Choose a product type before continuing.");
  }
  return errors;
}

export function validateDimensionsStep(draft: ConfiguratorWorkflowDraft | null | undefined): string[] {
  const nextDraft = safeDraft(draft);
  const errors: string[] = [];
  if (!Number.isFinite(Number(nextDraft.dimensions.widthMm)) || Number(nextDraft.dimensions.widthMm || 0) <= 0) {
    errors.push("Width must be set.");
  }
  if (!Number.isFinite(Number(nextDraft.dimensions.heightMm)) || Number(nextDraft.dimensions.heightMm || 0) <= 0) {
    errors.push("Height must be set.");
  }
  return errors;
}

export function validateExternalWindowSillStep(draft: ConfiguratorWorkflowDraft | null | undefined): string[] {
  const nextDraft = safeDraft(draft);
  const errors: string[] = [];
  if (nextDraft.externalWindowSill.mode === "custom") {
    if (!Number.isFinite(Number(nextDraft.externalWindowSill.depthMm)) || Number(nextDraft.externalWindowSill.depthMm || 0) <= 0) {
      errors.push("Custom sill depth must be set.");
    }
  }
  return errors;
}

export function validateConfigurationStep(draft: ConfiguratorWorkflowDraft | null | undefined): string[] {
  const nextDraft = safeDraft(draft);
  const errors: string[] = [];
  if (!String(nextDraft.addPosition.positionReference || "").trim()) {
    errors.push("Position reference is required.");
  }
  if (!Number.isFinite(Number(nextDraft.addPosition.quantity || 0)) || Number(nextDraft.addPosition.quantity || 0) <= 0) {
    errors.push("Quantity must be greater than zero.");
  }
  if (!String(nextDraft.addPosition.positionType || "").trim()) {
    errors.push("Position type is required.");
  }
  if (!Number.isFinite(Number(nextDraft.dimensions.widthMm)) || Number(nextDraft.dimensions.widthMm || 0) <= 0) {
    errors.push("Width must be set.");
  }
  if (!Number.isFinite(Number(nextDraft.dimensions.heightMm)) || Number(nextDraft.dimensions.heightMm || 0) <= 0) {
    errors.push("Height must be set.");
  }
  return errors;
}

export function validateInvoiceAddressStep(): string[] {
  return [];
}

export function validateReviewStep(draft: ConfiguratorWorkflowDraft | null | undefined): string[] {
  const nextDraft = safeDraft(draft);
  return nextDraft.review.confirmed ? [] : ["Confirm the review step before finishing."];
}
