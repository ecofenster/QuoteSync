import type { B92ProjectionSerializedResult } from "./b92ProjectionDebug";
import type { B92ProjectionValidationReport } from "./b92ProjectionValidation";
import type { B92ProjectionUnresolvedItem } from "./b92DatumProjection.types";

type UnknownRecord = Record<string, unknown>;

export type B92DatumProjectionDiagnosticFieldSurface = {
  fieldId: string | null;
  fieldType: string | null;
  validationSummary: {
    id: string | null;
    valid: boolean | null;
    issueCount: number;
  };
  unresolvedReasons: B92ProjectionUnresolvedItem[];
  debugReport: string | null;
};

export type B92DatumProjectionDiagnosticSurface = {
  found: boolean;
  label: "B92 datum projection diagnostics";
  diagnosticOnly: true;
  integration: string | null;
  rendererIntegration: boolean | null;
  visualGeometryChanged: boolean | null;
  sectionAuthorityProjection: {
    diagnosticOnly: boolean | null;
    drawableGeometry: boolean | null;
    sectionCount: number;
    stackTotalsChecked: number | null;
    stackTotalMismatches: number | null;
    validationSummary: {
      id: string | null;
      valid: boolean | null;
      issueCount: number;
    };
    debugReport: string | null;
  } | null;
  fieldCount: number;
  fields: B92DatumProjectionDiagnosticFieldSurface[];
  note?: string;
};

type B92DatumProjectionDiagnosticsMetadata = {
  integration?: unknown;
  rendererIntegration?: unknown;
  visualGeometryChanged?: unknown;
  note?: unknown;
  sectionAuthorityProjection?: unknown;
  fields?: unknown;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function validationSummary(value: unknown): B92DatumProjectionDiagnosticFieldSurface["validationSummary"] {
  const validation = value as Partial<B92ProjectionValidationReport> | undefined;
  const issues = Array.isArray(validation?.issues) ? validation.issues : [];
  return {
    id: stringOrNull(validation?.id),
    valid: booleanOrNull(validation?.valid),
    issueCount: issues.length,
  };
}

function unresolvedReasons(value: unknown): B92ProjectionUnresolvedItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is B92ProjectionUnresolvedItem => isRecord(item) && typeof item.id === "string");
}

function fieldSurface(value: unknown): B92DatumProjectionDiagnosticFieldSurface | null {
  if (!isRecord(value)) return null;
  return {
    fieldId: stringOrNull(value.fieldId),
    fieldType: stringOrNull(value.fieldType),
    validationSummary: validationSummary(value.validation),
    unresolvedReasons: unresolvedReasons(value.unresolvedReasons),
    debugReport: stringOrNull(value.debugReport),
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sectionAuthoritySurface(
  value: unknown
): B92DatumProjectionDiagnosticSurface["sectionAuthorityProjection"] {
  if (!isRecord(value)) return null;
  const summary = isRecord(value.summary) ? value.summary : {};
  const diagnostics = Array.isArray(value.diagnostics) ? value.diagnostics : [];
  return {
    diagnosticOnly: booleanOrNull(value.diagnosticOnly),
    drawableGeometry: booleanOrNull(value.drawableGeometry),
    sectionCount: diagnostics.length,
    stackTotalsChecked: numberOrNull(summary.stackTotalsChecked),
    stackTotalMismatches: numberOrNull(summary.stackTotalMismatches),
    validationSummary: validationSummary(value.validation),
    debugReport: stringOrNull(value.debugReport),
  };
}

function diagnosticsFromDevReports(devReports: unknown): B92DatumProjectionDiagnosticsMetadata | null {
  if (!isRecord(devReports)) return null;
  const diagnostics = devReports.b92DatumProjectionDiagnostics;
  return isRecord(diagnostics) ? diagnostics : null;
}

export function extractB92DatumProjectionDiagnostics(input: {
  devReports?: unknown;
  metadata?: unknown;
}): B92DatumProjectionDiagnosticSurface {
  const devReports = input.devReports ?? (isRecord(input.metadata) ? input.metadata.devReports : undefined);
  const diagnostics = diagnosticsFromDevReports(devReports);

  if (!diagnostics) {
    return {
      found: false,
      label: "B92 datum projection diagnostics",
      diagnosticOnly: true,
      integration: null,
      rendererIntegration: null,
      visualGeometryChanged: null,
      sectionAuthorityProjection: null,
      fieldCount: 0,
      fields: [],
    };
  }

  const fields = Array.isArray(diagnostics.fields)
    ? diagnostics.fields.map(fieldSurface).filter((item): item is B92DatumProjectionDiagnosticFieldSurface => !!item)
    : [];

  return {
    found: true,
    label: "B92 datum projection diagnostics",
    diagnosticOnly: true,
    integration: stringOrNull(diagnostics.integration),
    rendererIntegration: booleanOrNull(diagnostics.rendererIntegration),
    visualGeometryChanged: booleanOrNull(diagnostics.visualGeometryChanged),
    sectionAuthorityProjection: sectionAuthoritySurface(diagnostics.sectionAuthorityProjection),
    fieldCount: fields.length,
    fields,
    note: stringOrNull(diagnostics.note) ?? undefined,
  };
}

export function formatB92DatumProjectionDiagnosticsSummary(
  surface: B92DatumProjectionDiagnosticSurface
): string {
  if (!surface.found) return "B92 datum projection diagnostics: not found";

  const lines = [
    "B92 datum projection diagnostics",
    "diagnosticOnly: true",
    `integration: ${surface.integration ?? "unknown"}`,
    `rendererIntegration: ${String(surface.rendererIntegration)}`,
    `visualGeometryChanged: ${String(surface.visualGeometryChanged)}`,
    `sectionAuthorityProjection: ${surface.sectionAuthorityProjection ? "present" : "missing"}`,
    `fieldCount: ${surface.fieldCount}`,
  ];

  if (surface.sectionAuthorityProjection) {
    lines.push(
      `sectionAuthority.sections: ${surface.sectionAuthorityProjection.sectionCount}`,
      `sectionAuthority.stackTotalsChecked: ${String(surface.sectionAuthorityProjection.stackTotalsChecked)}`,
      `sectionAuthority.stackTotalMismatches: ${String(surface.sectionAuthorityProjection.stackTotalMismatches)}`,
      `sectionAuthority.valid: ${String(surface.sectionAuthorityProjection.validationSummary.valid)}`,
      `sectionAuthority.issues: ${surface.sectionAuthorityProjection.validationSummary.issueCount}`
    );
    if (surface.sectionAuthorityProjection.debugReport) lines.push(surface.sectionAuthorityProjection.debugReport);
  }

  for (const field of surface.fields) {
    lines.push(
      `field ${field.fieldId ?? "unknown"} (${field.fieldType ?? "unknown"}): valid=${String(
        field.validationSummary.valid
      )}, issues=${field.validationSummary.issueCount}, unresolved=${field.unresolvedReasons.length}`
    );
    if (field.debugReport) lines.push(field.debugReport);
  }

  return lines.join("\n");
}

export function listB92DatumProjectionDiagnosticSerializedResults(input: {
  devReports?: unknown;
  metadata?: unknown;
}): B92ProjectionSerializedResult[] {
  const devReports = input.devReports ?? (isRecord(input.metadata) ? input.metadata.devReports : undefined);
  const diagnostics = diagnosticsFromDevReports(devReports);
  if (!diagnostics || !Array.isArray(diagnostics.fields)) return [];

  return diagnostics.fields
    .filter(isRecord)
    .map((field) => field.serializedProjection)
    .filter((value): value is B92ProjectionSerializedResult => isRecord(value) && Array.isArray(value.regions));
}
