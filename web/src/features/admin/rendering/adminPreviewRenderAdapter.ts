import { buildWindowDrawingModel } from "../../configurator/rendering/buildWindowDrawingModel";

type WindowDrawingModelInput = Parameters<typeof buildWindowDrawingModel>[0];

export type AdminPreviewWindowDrawingModelInput = Omit<WindowDrawingModelInput, "windowConfiguration"> & {
  adminPreviewConfiguration?: WindowDrawingModelInput["windowConfiguration"];
};

export function buildAdminPreviewWindowDrawingModel(input: AdminPreviewWindowDrawingModelInput) {
  const { adminPreviewConfiguration, ...drawingInput } = input;
  return buildWindowDrawingModel({
    ...drawingInput,
    windowConfiguration: adminPreviewConfiguration,
  });
}
