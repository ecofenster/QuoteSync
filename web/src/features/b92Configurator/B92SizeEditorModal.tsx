import { useState } from "react";
import type { FormEvent } from "react";
import type {
  B92ConfiguratorDimensionState,
  B92ConfiguratorStructureState,
} from "./b92Configurator.types";
import {
  B92_DIMENSION_MAX_MM,
  B92_DIMENSION_MIN_MM,
  buildB92EqualSplit,
  type B92DimensionValidationErrors,
  validateB92GeneratedSplits,
  validateB92OverallDimensions,
} from "./b92DimensionValidation";
import { getB92StructurePresetDefinition } from "./b92StructurePresets";

type Props = {
  dimensions: B92ConfiguratorDimensionState;
  structure: B92ConfiguratorStructureState;
  onApply: (widthMm: number, heightMm: number) => void;
  onCancel: () => void;
};

function splitSummary(values: number[]) {
  return values.map((value) => `${value}mm`).join(" / ");
}

function hasPreviewableDraft(widthInput: string, heightInput: string) {
  const result = validateB92OverallDimensions(widthInput, heightInput);
  return result.valid ? result : null;
}

export default function B92SizeEditorModal(props: Props) {
  const preset = getB92StructurePresetDefinition(props.structure.layoutPreset);
  const [widthInput, setWidthInput] = useState(String(props.dimensions.widthMm));
  const [heightInput, setHeightInput] = useState(String(props.dimensions.heightMm));
  const [errors, setErrors] = useState<B92DimensionValidationErrors>({});
  const draftDimensions = hasPreviewableDraft(widthInput, heightInput);
  const draftColumnWidths = draftDimensions ? buildB92EqualSplit(draftDimensions.widthMm, props.structure.columns) : [];
  const draftRowHeights = draftDimensions ? buildB92EqualSplit(draftDimensions.heightMm, props.structure.rows) : [];
  const columnGuardrail = draftDimensions
    ? validateB92GeneratedSplits(draftColumnWidths, props.structure.columns, draftDimensions.widthMm, "Column widths")
    : null;
  const rowGuardrail = draftDimensions
    ? validateB92GeneratedSplits(draftRowHeights, props.structure.rows, draftDimensions.heightMm, "Row heights")
    : null;
  const guardrailErrors = [...(columnGuardrail?.errors ?? []), ...(rowGuardrail?.errors ?? [])];
  const splitPreviewValid = Boolean(draftDimensions && columnGuardrail?.valid && rowGuardrail?.valid);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateB92OverallDimensions(widthInput, heightInput);
    setErrors(result.errors);

    if (!result.valid) return;

    const nextColumnWidths = buildB92EqualSplit(result.widthMm, props.structure.columns);
    const nextRowHeights = buildB92EqualSplit(result.heightMm, props.structure.rows);
    const nextColumnGuardrail = validateB92GeneratedSplits(nextColumnWidths, props.structure.columns, result.widthMm, "Column widths");
    const nextRowGuardrail = validateB92GeneratedSplits(nextRowHeights, props.structure.rows, result.heightMm, "Row heights");
    if (!nextColumnGuardrail.valid || !nextRowGuardrail.valid) {
      setErrors({
        width: nextColumnGuardrail.errors[0],
        height: nextRowGuardrail.errors[0],
      });
      return;
    }

    props.onApply(result.widthMm, result.heightMm);
  }

  return (
    <form className="b92-size-editor" onSubmit={apply} noValidate>
      <div className="b92-size-editor__intro">
        <div className="b92-section-title">Overall size</div>
        <div className="b92-body-copy">
          Set the overall frame width and height in whole millimetres. The approved proof preview remains static in this phase.
        </div>
      </div>

      <div className="b92-size-editor__current">
        Current applied size: {props.dimensions.widthMm}mm x {props.dimensions.heightMm}mm
      </div>

      <div className="b92-size-editor__grid">
        <label className="b92-size-editor__field">
          <span className="b92-setting-label">Width (mm)</span>
          <input
            className={`b92-input${errors.width ? " b92-input--invalid" : ""}`}
            inputMode="numeric"
            value={widthInput}
            onChange={(event) => setWidthInput(event.currentTarget.value)}
            aria-invalid={Boolean(errors.width)}
            aria-describedby={errors.width ? "b92-size-width-error" : undefined}
          />
          {errors.width ? <span id="b92-size-width-error" className="b92-size-editor__error">{errors.width}</span> : null}
        </label>

        <label className="b92-size-editor__field">
          <span className="b92-setting-label">Height (mm)</span>
          <input
            className={`b92-input${errors.height ? " b92-input--invalid" : ""}`}
            inputMode="numeric"
            value={heightInput}
            onChange={(event) => setHeightInput(event.currentTarget.value)}
            aria-invalid={Boolean(errors.height)}
            aria-describedby={errors.height ? "b92-size-height-error" : undefined}
          />
          {errors.height ? <span id="b92-size-height-error" className="b92-size-editor__error">{errors.height}</span> : null}
        </label>
      </div>

      <div className="b92-size-editor__note">
        Allowed range: {B92_DIMENSION_MIN_MM}mm to {B92_DIMENSION_MAX_MM}mm. Values such as 1000mm or decimal dimensions are rejected.
      </div>

      <section className="b92-size-editor__mode" aria-label="Split mode">
        <div className="b92-size-editor__split-header">
          <div className="b92-size-editor__split-title">Split mode</div>
          <span className="b92-status-badge b92-status-badge--active">Equal</span>
        </div>
        <div className="b92-size-editor__mode-options">
          <button type="button" className="b92-size-editor__mode-option b92-size-editor__mode-option--active">
            Equal split
          </button>
          <button type="button" className="b92-size-editor__mode-option" disabled>
            Manual split coming soon
          </button>
        </div>
      </section>

      <section className="b92-size-editor__splits" aria-label="Equal split preview">
        <div className="b92-size-editor__split-header">
          <div className="b92-size-editor__split-title">Draft equal split preview</div>
          <span className={`b92-status-badge b92-status-badge--${splitPreviewValid ? "active" : "unsupported"}`}>
            {splitPreviewValid ? "Valid" : "Waiting"}
          </span>
        </div>
        <div className="b92-body-copy">
          Active structure: {preset.label}. Preview updates from the draft inputs before Apply; committed dimensions remain unchanged until Apply.
        </div>
        <div className="b92-size-editor__split-grid">
          <div className="b92-size-editor__split-row">
            <span className="b92-summary__label">{props.structure.columns > 1 ? `Columns (${props.structure.columns})` : "Width"}</span>
            <span className="b92-summary__value">{draftDimensions ? splitSummary(draftColumnWidths) : "Enter a valid width"}</span>
          </div>
          <div className="b92-size-editor__split-row">
            <span className="b92-summary__label">{props.structure.rows > 1 ? `Rows (${props.structure.rows})` : "Height"}</span>
            <span className="b92-summary__value">{draftDimensions ? splitSummary(draftRowHeights) : "Enter a valid height"}</span>
          </div>
        </div>
        {guardrailErrors.length ? (
          <div className="b92-size-editor__guardrail" role="status">
            {guardrailErrors.join(" ")}
          </div>
        ) : (
          <div className="b92-size-editor__guardrail b92-size-editor__guardrail--ok" role="status">
            Generated splits match the active row/column count and sum to the draft overall size.
          </div>
        )}
      </section>

      <div className="b92-size-editor__actions">
        <button type="button" className="b92-secondary-button" onClick={props.onCancel}>
          Cancel
        </button>
        <button type="submit" className="b92-secondary-button b92-size-editor__apply">
          Apply size
        </button>
      </div>
    </form>
  );
}
