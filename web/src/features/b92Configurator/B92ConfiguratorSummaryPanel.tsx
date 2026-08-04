import type { B92ConfiguratorPromotedViewManifestEntry, B92ConfiguratorState } from "./b92Configurator.types";
import { b92UserStatusLabel, b92UserStatusMessage } from "./b92ConfiguratorStatus";
import { getB92StructurePresetDefinition } from "./b92StructurePresets";

type Props = {
  state: B92ConfiguratorState;
  selectedEntry: B92ConfiguratorPromotedViewManifestEntry | null;
  proofAvailable: boolean;
};

function operationLabel(value: string) {
  if (value === "fixed-sash") return "Fixed Sash";
  if (value === "tilt-turn-left") return "Tilt & Turn Left";
  if (value === "tilt-turn-right") return "Tilt & Turn Right";
  if (value === "turn-left") return "Turn Left";
  if (value === "turn-right") return "Turn Right";
  if (value === "tilt") return "Tilt";
  return "Fixed";
}

function Row(props: { label: string; value: string }) {
  return (
    <div className="b92-summary__row">
      <span className="b92-summary__label">{props.label}</span>
      <span className="b92-summary__value">{props.value}</span>
    </div>
  );
}

export default function B92ConfiguratorSummaryPanel(props: Props) {
  const preset = getB92StructurePresetDefinition(props.state.structure.layoutPreset);
  const operations = props.state.structure.fields.map((field) => operationLabel(field.operation)).join(" / ");
  const finish = [
    props.state.finishes.internalMode === "native" ? "Internal Native" : `Internal ${props.state.finishes.internalMode}`,
    props.state.finishes.externalRevealMode === "native" ? "Reveal Native" : `Reveal ${props.state.finishes.externalRevealMode}`,
    props.state.finishes.externalCladdingMode === "native" ? "Cladding Native" : `Cladding RAL ${props.state.finishes.externalCladdingRal}`,
  ].join(", ");
  const status = b92UserStatusLabel(props.selectedEntry, props.proofAvailable);

  return (
    <section className="b92-summary">
      <div className="b92-summary__header">
        <div className="b92-section-title">Summary</div>
        <span className={`b92-status-badge b92-status-badge--${props.proofAvailable ? "supported" : "unsupported"}`}>
          {status}
        </span>
      </div>
      <Row label="Product" value="Windows / Europa 92 Alu Clad" />
      <Row label="Dimensions" value={`${props.state.dimensions.widthMm} x ${props.state.dimensions.heightMm}mm`} />
      <Row label="Structure" value={preset.label} />
      <Row label="Opening" value={operations} />
      <Row label="Finish" value={finish} />
      <Row label="Glass" value="Default glazing" />
      <Row label="Hardware" value="Default hardware" />
      <div className="b92-body-copy">{b92UserStatusMessage(props.selectedEntry, props.proofAvailable)}</div>
      {props.state.contextStatusMessage ? <div className="b92-body-copy">{props.state.contextStatusMessage}</div> : null}
    </section>
  );
}
