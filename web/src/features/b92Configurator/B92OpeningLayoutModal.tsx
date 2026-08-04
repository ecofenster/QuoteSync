import type {
  B92ConfiguratorFieldOperation,
  B92ConfiguratorPromotedViewManifestEntry,
  B92ConfiguratorStructureState,
} from "./b92Configurator.types";
import { findB92ApprovedProofFamilyForStructure } from "./b92StructurePresets";

type Props = {
  structure: B92ConfiguratorStructureState;
  selectedEntry: B92ConfiguratorPromotedViewManifestEntry | null;
  onSetFieldOperation: (fieldId: string, operation: B92ConfiguratorFieldOperation) => void;
};

const FIELD_OPERATIONS: Array<{ operation: B92ConfiguratorFieldOperation; label: string }> = [
  { operation: "fixed", label: "Fixed" },
  { operation: "fixed-sash", label: "Fixed Sash" },
  { operation: "tilt", label: "Tilt" },
  { operation: "turn-left", label: "Turn Left" },
  { operation: "turn-right", label: "Turn Right" },
  { operation: "tilt-turn-left", label: "Tilt & Turn Left" },
  { operation: "tilt-turn-right", label: "Tilt & Turn Right" },
];

function operationLabel(value: B92ConfiguratorFieldOperation) {
  return FIELD_OPERATIONS.find((candidate) => candidate.operation === value)?.label ?? "Fixed";
}

function nextStructureWithOperation(
  structure: B92ConfiguratorStructureState,
  fieldId: string,
  operation: B92ConfiguratorFieldOperation
): B92ConfiguratorStructureState {
  return {
    ...structure,
    selectedFieldId: fieldId,
    fields: structure.fields.map((field) => (field.id === fieldId ? { ...field, operation } : field)),
  };
}

export default function B92OpeningLayoutModal(props: Props) {
  return (
    <section className="b92-opening-layout">
      <div className="b92-opening-layout__intro">
        <div className="b92-section-title">Field operations</div>
        <div className="b92-body-copy">
          Choose one operation per field. Right-click uses this same operation set as a shortcut. Unsupported combinations are reported
          safely and do not generate geometry.
        </div>
      </div>

      <div className="b92-opening-layout__field-list">
        {props.structure.fields.map((field) => (
          <article key={field.id} className="b92-opening-field">
            <div className="b92-opening-field__header">
              <div className="b92-opening-field__copy">
                <div className="b92-opening-field__title">Field {field.index + 1}</div>
                <div className="b92-body-copy">
                  Row {field.row + 1}, column {field.column + 1}. Current operation: {operationLabel(field.operation)}.
                </div>
              </div>
              {props.structure.selectedFieldId === field.id ? (
                <span className="b92-opening-field__selected">
                  Selected
                </span>
              ) : null}
            </div>

            <div className="b92-opening-field__operations">
              {FIELD_OPERATIONS.map((option) => {
                const nextStructure = nextStructureWithOperation(props.structure, field.id, option.operation);
                const mappedFamilyId = findB92ApprovedProofFamilyForStructure(nextStructure);
                const selected = field.operation === option.operation;
                const supported = Boolean(mappedFamilyId);
                return (
                  <button
                    key={option.operation}
                    type="button"
                    onClick={() => props.onSetFieldOperation(field.id, option.operation)}
                    className={`b92-operation-option${selected ? " b92-operation-option--selected" : ""}`}
                    title={
                      supported
                        ? "Supported by an approved proof mapping."
                        : "No approved B92 proof mapping exists for this operation combination yet."
                    }
                  >
                    <span className="b92-operation-option__label">{option.label}</span>
                    <span className={`b92-operation-option__status${supported ? " b92-operation-option__status--supported" : ""}`}>
                      {supported ? "Supported" : "Unsupported"}
                    </span>
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      <div className="b92-opening-layout__status-note">
        Current preview status: {props.selectedEntry ? `${props.selectedEntry.status} ${props.selectedEntry.view}` : "no approved preview"}.
      </div>
    </section>
  );
}
