import type {
  B92ConfiguratorContextTarget,
  B92ConfiguratorFieldOperation,
  B92ConfiguratorFieldState,
} from "./b92Configurator.types";
import type { ReactNode } from "react";

type Props = {
  open: boolean;
  x: number;
  y: number;
  target: B92ConfiguratorContextTarget | null;
  selectedField: B92ConfiguratorFieldState | null;
  fieldActionsSupported: boolean;
  unsupportedReason: string;
  onClose: () => void;
  onSetFieldOperation: (operation: B92ConfiguratorFieldOperation) => void;
};

const FIELD_ACTIONS: Array<{ operation: B92ConfiguratorFieldOperation; label: string }> = [
  { operation: "fixed", label: "Fixed" },
  { operation: "fixed-sash", label: "Fixed Sash" },
  { operation: "tilt", label: "Tilt" },
  { operation: "turn-left", label: "Turn Left" },
  { operation: "turn-right", label: "Turn Right" },
  { operation: "tilt-turn-left", label: "Tilt & Turn Left" },
  { operation: "tilt-turn-right", label: "Tilt & Turn Right" },
];

function targetLabel(target: B92ConfiguratorContextTarget | null) {
  if (!target) return "No target";
  if (target.type === "field") return `Field ${target.fieldId}`;
  if (target.type === "junction") return `Junction ${target.junctionId}`;
  if (target.type === "frame-edge") return `Frame edge ${target.frameEdgeId}`;
  return `Hardware ${target.hardwareId}`;
}

function MenuButton(props: { label: string; disabled?: boolean; onClick?: () => void; title?: string }) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      title={props.title}
      onClick={props.onClick}
      className="b92-context-menu__option"
    >
      {props.label}
    </button>
  );
}

function MenuSection(props: { title: string; children: ReactNode }) {
  return (
    <div className="b92-context-menu__section">
      <div className="b92-context-menu__section-title">{props.title}</div>
      {props.children}
    </div>
  );
}

export default function B92ContextMenu(props: Props) {
  if (!props.open) return null;

  const isFieldTarget = props.target?.type === "field";
  const fieldDisabled = !isFieldTarget || !props.selectedField || !props.fieldActionsSupported;
  const disabledTitle = !isFieldTarget
    ? "Field actions require a field target."
    : !props.fieldActionsSupported
      ? props.unsupportedReason
      : undefined;

  return (
    <>
      <button
        type="button"
        aria-label="Close B92 context menu"
        onClick={props.onClose}
        className="b92-context-menu__backdrop"
      />
      <div
        className="b92-context-menu__panel"
        data-x={`${Math.round(props.x)}px`}
        data-y={`${Math.round(props.y)}px`}
      >
        <div className="b92-context-menu__header">
          <div className="b92-context-menu__title">Opening shortcut</div>
          <div className="b92-context-menu__target">{targetLabel(props.target)}</div>
        </div>

        <MenuSection title="Field operation">
          {FIELD_ACTIONS.map((action) => (
            <MenuButton
              key={action.operation}
              label={action.label}
              disabled={fieldDisabled}
              title={disabledTitle}
              onClick={() => props.onSetFieldOperation(action.operation)}
            />
          ))}
          <MenuButton label="Disabled / Cut" disabled title="Disabled/Cut operation is parked for a later pass." />
        </MenuSection>
      </div>
    </>
  );
}
