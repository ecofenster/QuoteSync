export type ManufacturerVisualOrientation = "inside" | "outside" | "unknown";

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

export function manufacturerVisualOrientation(visual: Record<string, unknown>, configurationDescription?: unknown): ManufacturerVisualOrientation {
  const role = text(visual.role).toLowerCase();
  if (role === "inside" || role === "outside") return role;
  const legacyEvidence = `${text(configurationDescription)} ${text(visual.orientation)}`;
  if (/view from inside|\binside\b/i.test(legacyEvidence)) return "inside";
  if (/view from outside|\boutside\b/i.test(legacyEvidence)) return "outside";
  return "unknown";
}

export function manufacturerVisualOrientationLabel(orientation: ManufacturerVisualOrientation) {
  return orientation === "inside" ? "Inside view" : orientation === "outside" ? "Outside view" : "Orientation not supplied";
}
