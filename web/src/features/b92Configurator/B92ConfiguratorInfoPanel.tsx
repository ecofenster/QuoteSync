import { B92_PROFILE_SECTION_PROOF_FAMILIES } from "../admin/windowTypes/b92ProfileSectionProofRegistry";
import type {
  B92ConfiguratorContextTarget,
  B92ConfiguratorPromotedViewManifestEntry,
  B92ConfiguratorStructureState,
} from "./b92Configurator.types";
import { B92_PRODUCTION_CONFIGURATOR_VIEW_IDS, B92_PROMOTED_VIEW_MANIFEST } from "./b92PromotedViewManifest";
import { findB92ApprovedProofFamilyForStructure, getB92StructurePresetDefinition } from "./b92StructurePresets";

type Props = {
  selectedEntry: B92ConfiguratorPromotedViewManifestEntry | null;
  structure: B92ConfiguratorStructureState;
  activeTarget: B92ConfiguratorContextTarget | null;
  contextStatusMessage: string | null;
  actionSupported: boolean;
};

function familyLabel(familyId: string) {
  return B92_PROFILE_SECTION_PROOF_FAMILIES.find((family) => family.id === familyId)?.label ?? familyId;
}

function targetTypeLabel(target: B92ConfiguratorContextTarget | null) {
  if (!target) return "none";
  if (target.type === "frame-edge") return "frame edge";
  return target.type;
}

function targetId(target: B92ConfiguratorContextTarget | null) {
  if (!target) return "none";
  if (target.type === "field") return target.fieldId;
  if (target.type === "junction") return target.junctionId;
  if (target.type === "frame-edge") return target.frameEdgeId;
  return target.hardwareId;
}

export default function B92ConfiguratorInfoPanel(props: Props) {
  const productionEntries = B92_PROMOTED_VIEW_MANIFEST.filter((entry) => B92_PRODUCTION_CONFIGURATOR_VIEW_IDS.includes(entry.viewId));
  const productionFamilies = new Set(productionEntries.map((entry) => entry.familyId));
  const acceptedReferenceViews = productionEntries.filter((entry) => entry.status === "accepted-reference").length;
  const presetDefinition = getB92StructurePresetDefinition(props.structure.layoutPreset);
  const mappedProofFamilyId = findB92ApprovedProofFamilyForStructure(props.structure);
  const approvedProofExists = Boolean(mappedProofFamilyId && props.selectedEntry?.familyId === mappedProofFamilyId);
  const activeFieldTarget = props.activeTarget?.type === "field" ? props.activeTarget : null;
  const selectedField = activeFieldTarget
    ? props.structure.fields.find((field) => field.id === activeFieldTarget.fieldId) ?? null
    : props.structure.fields.find((field) => field.id === props.structure.selectedFieldId) ?? null;

  return (
    <aside className="b92-diagnostics">
      <div className="b92-diagnostics__intro">
        <div className="b92-section-title">Selection details</div>
        <div className="b92-body-copy">Standalone migration shell using the approved B92 proof preview pipeline.</div>
      </div>

      <div className="b92-diagnostics__section">
        <div className="b92-diagnostics__row">
          <strong className="b92-diagnostics__label">Production families:</strong> {productionFamilies.size}
        </div>
        <div className="b92-diagnostics__row">
          <strong className="b92-diagnostics__label">Production views:</strong> {productionEntries.length}
        </div>
        <div className="b92-diagnostics__row">
          <strong className="b92-diagnostics__label">Accepted-reference views:</strong> {acceptedReferenceViews}
        </div>
      </div>

      <div className="b92-diagnostics__section">
        <div className="b92-diagnostics__row">
          <strong className="b92-diagnostics__label">Selected layout preset:</strong> {presetDefinition.label}
        </div>
        <div className="b92-diagnostics__row">
          <strong className="b92-diagnostics__label">Structure mode:</strong> {props.structure.structureMode}
        </div>
        <div className="b92-diagnostics__row">
          <strong className="b92-diagnostics__label">Fields orientation:</strong> {props.structure.fieldOrientation}
        </div>
        <div className="b92-diagnostics__row">
          <strong className="b92-diagnostics__label">Approved proof exists:</strong> {approvedProofExists ? "yes" : "no"}
        </div>
        <div className="b92-diagnostics__row">
          <strong className="b92-diagnostics__label">Mapped proof family/view:</strong>{" "}
          {approvedProofExists && props.selectedEntry
            ? `${familyLabel(props.selectedEntry.familyId)} / ${props.selectedEntry.view}`
            : "none"}
        </div>
        {!approvedProofExists ? (
          <div className="b92-diagnostics__row">
            <strong className="b92-diagnostics__label">Unsupported reason:</strong>{" "}
            {presetDefinition.unsupportedReason ?? "No approved proof family is mapped to this preset yet."}
          </div>
        ) : null}
        <div className="b92-diagnostics__row">
          <strong className="b92-diagnostics__label">Fields:</strong> {props.structure.fields.length} fixed default field
          {props.structure.fields.length === 1 ? "" : "s"}
        </div>
        <div className="b92-diagnostics__row">
          <strong className="b92-diagnostics__label">Grid:</strong> {props.structure.gridRows}x{props.structure.gridColumns}
        </div>
        <div className="b92-diagnostics__row">
          <strong className="b92-diagnostics__label">Coupled items:</strong> {props.structure.coupledItems.length}
        </div>
      </div>

      <div className="b92-diagnostics__card">
        <div className="b92-diagnostics__card-title">Selected object</div>
        <div className="b92-diagnostics__row">
          <strong className="b92-diagnostics__label">Target type:</strong> {targetTypeLabel(props.activeTarget)}
        </div>
        <div className="b92-diagnostics__row">
          <strong className="b92-diagnostics__label">Target id:</strong> {targetId(props.activeTarget)}
        </div>
        <div className="b92-diagnostics__row">
          <strong className="b92-diagnostics__label">Current operation:</strong> {selectedField?.operation ?? "none"}
        </div>
        <div className="b92-diagnostics__row">
          <strong className="b92-diagnostics__label">Action supported:</strong> {props.actionSupported ? "yes" : "limited / scaffold"}
        </div>
        <div className="b92-diagnostics__row">
          <strong className="b92-diagnostics__label">Mapped approved proof:</strong> {mappedProofFamilyId ?? "none"}
        </div>
        {props.contextStatusMessage ? <div className="b92-diagnostics__callout">{props.contextStatusMessage}</div> : null}
      </div>

      {props.selectedEntry ? (
        <div className="b92-diagnostics__section">
          <div className="b92-diagnostics__row">
            <strong className="b92-diagnostics__label">Family:</strong> {familyLabel(props.selectedEntry.familyId)}
          </div>
          <div className="b92-diagnostics__row">
            <strong className="b92-diagnostics__label">View:</strong> {props.selectedEntry.view}
          </div>
          <div className="b92-diagnostics__row">
            <strong className="b92-diagnostics__label">Status:</strong> {props.selectedEntry.status}
          </div>
          <div className="b92-diagnostics__row">
            <strong className="b92-diagnostics__label">Geometry:</strong> {props.selectedEntry.generatedGeometrySourceId}
          </div>
          <div className="b92-diagnostics__row">
            <strong className="b92-diagnostics__label">Glass:</strong> {props.selectedEntry.semanticGlassStrategy}
          </div>
          <div className="b92-diagnostics__row">
            <strong className="b92-diagnostics__label">Finish masks:</strong> {props.selectedEntry.finishMaskStrategy.join(", ")}
          </div>
          <div className="b92-diagnostics__row">
            <strong className="b92-diagnostics__label">SVG:</strong> {props.selectedEntry.sourceProof.svgPath}
          </div>
          <div className="b92-diagnostics__row">
            <strong className="b92-diagnostics__label">DXF:</strong> {props.selectedEntry.sourceProof.dxfPath ?? "not referenced"}
          </div>
        </div>
      ) : (
        <div className="b92-placeholder-box b92-diagnostics__empty">
          No B92 production manifest view is selected.
        </div>
      )}
    </aside>
  );
}
