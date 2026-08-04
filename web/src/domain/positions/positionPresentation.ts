import { describePositionForOutput } from "../../features/configurator/configuredPositionContract.utils";

export function legacyPositionDescription(position: {
  positionType?: string;
  insertion?: string;
  widthMm?: number;
  heightMm?: number;
}) {
  return `${position.positionType ?? "Position"} • ${position.insertion ?? ""} • ${position.widthMm ?? 0} × ${position.heightMm ?? 0} mm`;
}
export function positionDescriptionForDisplay(position: unknown) {
  const legacy = legacyPositionDescription(
    position && typeof position === "object"
      ? position as { positionType?: string; insertion?: string; widthMm?: number; heightMm?: number }
      : {}
  );
  return describePositionForOutput(position, legacy);
}
