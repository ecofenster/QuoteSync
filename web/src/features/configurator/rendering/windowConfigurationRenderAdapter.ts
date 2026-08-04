export type WindowDrawingModelLegacyConfiguration = {
  junctions?: Array<{ key: string; type?: string; ownerFieldId?: string | null }>;
  fields?: Array<{
    key: string;
    type?: string;
    handleHeightMm?: number | null;
    hingeType?: string | null;
    handleAxisOffsetMm?: number | null;
    hingePivotOffsetMm?: number | null;
  }>;
  hardware?: { defaultHandleHeightMm?: number | null; defaultHingeType?: string | null };
  frame?: { finishMode?: "single" | "dual"; internalColour?: string | null; externalColour?: string | null };
  dev?: {
    b92FixedInternalContractValidation?: boolean | null;
    b92ContractDrawing?: boolean | null;
    b92ContractDrawingReturn?: boolean | null;
    b92System?: string | null;
    useAdminSourceModel?: boolean | null;
    useAdminSourceModelReturn?: boolean | null;
  };
};

export function getWindowConfigurationRenderCompatibility(input: {
  windowConfiguration?: WindowDrawingModelLegacyConfiguration | null;
}) {
  const configuration = input.windowConfiguration ?? {};
  return {
    dev: configuration.dev ?? {},
    frame: configuration.frame ?? {},
    junctions: configuration.junctions ?? [],
    fields: configuration.fields ?? [],
    hardware: configuration.hardware ?? {},
  };
}
