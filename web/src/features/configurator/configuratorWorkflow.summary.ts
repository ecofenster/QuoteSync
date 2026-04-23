import type { ConfiguratorWorkflowDraft } from "../estimateWorkflow/workflow.types";
import { getLayoutLabel, normalizeLayoutDefinition } from "./configuratorWorkflow.helpers";

function readable(value: unknown, fallback = "Not set") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function buildWorkflowReviewSummary(draft: ConfiguratorWorkflowDraft) {
  const configuration = draft.configuration;
  const layout = normalizeLayoutDefinition(configuration.layout);
  const glass = configuration.glass ?? {};
  const bars = configuration.bars ?? {};
  const frame = configuration.frame ?? {};
  const hardware = configuration.hardware ?? {};

  return [
    { label: "Forecast", value: readable(draft.forecast.estimatedOrderForecast, "Not captured") },
    {
      label: "Project site",
      value: [
        draft.projectSiteAddress.addressLine1,
        draft.projectSiteAddress.addressLine2,
        draft.projectSiteAddress.city,
        draft.projectSiteAddress.county,
        draft.projectSiteAddress.postcode,
        draft.projectSiteAddress.what3words && `w3w ${draft.projectSiteAddress.what3words}`,
      ]
        .filter(Boolean)
        .join(", ") || "Not captured",
    },
    {
      label: "Estimate defaults",
      value: draft.estimateDefaults.defaultsSnapshot
        ? `${Object.keys(draft.estimateDefaults.defaultsSnapshot).length} defaults in snapshot`
        : "No defaults snapshot",
    },
    {
      label: "Invoice address",
      value: draft.invoiceAddress.useProjectSiteAddress
        ? "Uses project site address"
        : [
            draft.invoiceAddress.addressLine1,
            draft.invoiceAddress.addressLine2,
            draft.invoiceAddress.city,
            draft.invoiceAddress.postcode,
          ]
            .filter(Boolean)
            .join(", ") || "Not captured",
    },
    {
      label: "Position",
      value: [
        draft.addPosition.product,
        draft.addPosition.productType,
        draft.addPosition.positionReference,
        draft.addPosition.quantity ? `Qty ${draft.addPosition.quantity}` : "",
        draft.addPosition.roomName,
        draft.addPosition.positionType,
      ]
        .filter(Boolean)
        .join(" • ") || "Not captured",
    },
    {
      label: "Dimensions",
      value:
        draft.dimensions.widthMm && draft.dimensions.heightMm
          ? `${draft.dimensions.widthMm}mm × ${draft.dimensions.heightMm}mm`
          : "Not captured",
    },
    {
      label: "Sill",
      value:
        draft.skippedStepIds.includes("externalWindowSill")
          ? "Skipped from defaults"
          : [draft.externalWindowSill.mode, draft.externalWindowSill.depthMm ? `${draft.externalWindowSill.depthMm}mm` : ""]
              .filter(Boolean)
              .join(" • ") || "Not captured",
    },
    {
      label: "Configuration",
      value: [
        getLayoutLabel(layout),
        `${layout.capacity} fields`,
        configuration.divisionBasis ? `${configuration.divisionBasis} division` : "",
        configuration.orientationView ? `${configuration.orientationView} view` : "",
        configuration.junctions?.length ? `${configuration.junctions.length} junctions` : "",
      ]
        .filter(Boolean).join(" • ") || "Not captured",
    },
    {
      label: "Glass",
      value: [glass.presetLabel, glass.presetSpec].filter(Boolean).join(" • ") || "Not captured",
    },
    {
      label: "Frame / Rebate",
      value: [
        frame.leftMm ? `L ${frame.leftMm}` : "",
        frame.rightMm ? `R ${frame.rightMm}` : "",
        frame.topMm ? `T ${frame.topMm}` : "",
        frame.bottomMm ? `B ${frame.bottomMm}` : "",
        frame.bottomRebate ? `Rebate ${frame.bottomRebate}` : "",
      ]
        .filter(Boolean).join(" • ") || "Not captured",
    },
    {
      label: "Bars / Astragals / Duplex",
      value: [
        `Duplex ${bars.duplex ? "on" : "off"}`,
        bars.horizontalCount ? `${bars.horizontalCount} horizontal` : "",
        bars.verticalCount ? `${bars.verticalCount} vertical` : "",
        bars.astragals?.length ? `${bars.astragals.length} astragals` : "",
        bars.manualBars?.length ? `${bars.manualBars.length} manual bars` : "",
      ]
        .filter(Boolean).join(" • ") || "Not captured",
    },
    {
      label: "Hardware",
      value: [
        hardware.defaultHandleType,
        hardware.defaultHandleHeightMm ? `${hardware.defaultHandleHeightMm}mm handle height` : "",
        hardware.defaultHingeType,
      ]
        .filter(Boolean).join(" • ") || "Not captured",
    },
  ];
}
