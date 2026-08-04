import type {
  B92ConfiguratorPromotedViewManifestEntry,
  B92ConfiguratorState,
} from "./b92Configurator.types";
import { b92UserStatusLabel, b92UserStatusMessage } from "./b92ConfiguratorStatus";
import { getB92StructurePresetDefinition } from "./b92StructurePresets";
import type { B92ConfiguratorModalId } from "./B92ConfiguratorModalHost";

type Props = {
  state: B92ConfiguratorState;
  selectedEntry: B92ConfiguratorPromotedViewManifestEntry | null;
  proofAvailable: boolean;
  onOpenModal: (modal: B92ConfiguratorModalId) => void;
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

function finishModeLabel(value: string, detail: string | null) {
  if (value === "native") return "Native Render";
  if (value === "lacquer") return detail ? `Lacquer ${detail}` : "Lacquer";
  return `RAL ${detail ?? "7016"}`;
}

function Card(props: {
  title: string;
  summary: string;
  detail?: string;
  action?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <article className="b92-card">
      <div className="b92-card__header">
        <div className="b92-card__copy">
          <div className="b92-card__title">{props.title}</div>
          <div className="b92-card__summary">{props.summary}</div>
        </div>
        <button type="button" className="b92-secondary-button" disabled={props.disabled} onClick={props.onClick}>
          {props.action ?? "Change"}
        </button>
      </div>
      {props.detail ? <div className="b92-body-copy">{props.detail}</div> : null}
    </article>
  );
}

export default function B92ConfiguratorDetailsPanel(props: Props) {
  const preset = getB92StructurePresetDefinition(props.state.structure.layoutPreset);
  const operations = props.state.structure.fields
    .map((field) => `Field ${field.index + 1}: ${operationLabel(field.operation)}`)
    .join(", ");
  const finishSummary = [
    `Internal ${finishModeLabel(props.state.finishes.internalMode, props.state.finishes.internalRal)}`,
    `Reveal ${finishModeLabel(props.state.finishes.externalRevealMode, props.state.finishes.externalRevealRal)}`,
    `Cladding ${
      props.state.finishes.externalCladdingMode === "native" ? "Native Render" : `RAL ${props.state.finishes.externalCladdingRal}`
    }`,
  ].join(" / ");

  return (
    <aside className="b92-details-panel">
      <div className="b92-details-panel__intro">
        <div className="b92-section-title">Configure</div>
        <div className="b92-body-copy">Guided B92 window setup. Use Change to edit each section while the preview stays visible.</div>
      </div>

      <Card
        title="Size"
        summary={`${props.state.dimensions.widthMm}mm x ${props.state.dimensions.heightMm}mm`}
        detail="Default test size for this guided shell. The full size editor is parked for a later pass."
        onClick={() => props.onOpenModal("size")}
      />
      <Card
        title="Profile / Product"
        summary="Windows / Europa 92 Alu Clad"
        detail="B92 resolver active. Profile references are selected automatically and shown only in Diagnostics."
        onClick={() => props.onOpenModal("product")}
      />
      <Card
        title="Window Type / Basic Shape"
        summary={preset.label}
        detail={
          props.proofAvailable
            ? b92UserStatusMessage(props.selectedEntry, props.proofAvailable)
            : preset.unsupportedReason ?? b92UserStatusMessage(props.selectedEntry, props.proofAvailable)
        }
        onClick={() => props.onOpenModal("shape")}
      />
      <Card title="Opening Type" summary={operations} onClick={() => props.onOpenModal("opening")} />
      <Card title="Finish / Colour" summary={finishSummary} onClick={() => props.onOpenModal("finish")} />
      <Card title="Glass" summary="Default glazing" detail="Glass options are parked for donor-data migration." onClick={() => props.onOpenModal("glass")} />
      <Card
        title="Handle / Hardware"
        summary="Default hardware"
        detail="Handle and hardware choices are parked for donor-data migration."
        onClick={() => props.onOpenModal("hardware")}
      />
      <Card title="Bars / Sprossen" summary="None" detail="Bars are parked for a later pass." onClick={() => props.onOpenModal("extras")} />
      <Card
        title="Extras"
        summary="No extras selected"
        detail="Rebates, trickle vents, ventilators, and mounting options come later."
        onClick={() => props.onOpenModal("extras")}
      />
      <Card
        title="Coupling"
        summary="Not coupled"
        detail="Coupling and grid planning are parked for a later dedicated flow."
        onClick={() => props.onOpenModal("coupling")}
      />
      <Card title="Notes" summary="No notes" detail="Customer/internal notes placeholder." onClick={() => props.onOpenModal("notes")} />
      <Card
        title="Status / Diagnostics"
        summary={`${b92UserStatusLabel(props.selectedEntry, props.proofAvailable)} / ${props.selectedEntry?.view ?? props.state.selectedView}`}
        detail="Technical proof and profile details are kept out of the production-facing cards."
        action="Details"
        onClick={() => props.onOpenModal("diagnostics")}
      />
    </aside>
  );
}
