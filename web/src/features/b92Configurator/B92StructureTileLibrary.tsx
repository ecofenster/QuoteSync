import type {
  B92ConfiguratorLayoutPreset,
  B92ConfiguratorPromotedViewManifestEntry,
  B92ConfiguratorStructureState,
} from "./b92Configurator.types";
import type { ReactNode } from "react";
import {
  B92_GRID_PRESET_OPTIONS,
  buildB92StructureFromPreset,
  findB92ApprovedProofFamilyForStructure,
  getB92StructurePresetDefinition,
} from "./b92StructurePresets";

type Props = {
  structure: B92ConfiguratorStructureState;
  selectedEntry: B92ConfiguratorPromotedViewManifestEntry | null;
  onSelectWindowPreset: (preset: B92ConfiguratorLayoutPreset) => void;
  onSelectGridPreset?: (preset: B92ConfiguratorLayoutPreset) => void;
  parkGridAndCoupling?: boolean;
};

const WINDOW_TILE_PRESETS: B92ConfiguratorLayoutPreset[] = [
  "1-field",
  "2-field-horizontal",
  "3-field-horizontal",
  "4-field-horizontal",
  "5-field-horizontal",
  "6-field-horizontal",
  "2-field-vertical",
  "3-field-vertical",
  "4-field-vertical",
  "5-field-vertical",
  "6-field-vertical",
];

function tileSupport(preset: B92ConfiguratorLayoutPreset) {
  const structure = buildB92StructureFromPreset(preset);
  return findB92ApprovedProofFamilyForStructure(structure);
}

function MiniLayout(props: { rows: number; columns: number }) {
  const cellCount = Math.max(1, props.rows * props.columns);
  return (
    <div
      aria-hidden
      className="b92-mini-layout"
      style={{
        gridTemplateRows: `repeat(${props.rows}, minmax(0, 1fr))`,
        gridTemplateColumns: `repeat(${props.columns}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: cellCount }, (_, index) => (
        <div key={index} className="b92-mini-layout__cell" />
      ))}
    </div>
  );
}

function Tile(props: {
  preset: B92ConfiguratorLayoutPreset;
  selected: boolean;
  safeStateOnly?: boolean;
  selectedEntry: B92ConfiguratorPromotedViewManifestEntry | null;
  onSelect: (preset: B92ConfiguratorLayoutPreset) => void;
  disabled?: boolean;
  statusOverride?: string;
}) {
  const definition = getB92StructurePresetDefinition(props.preset);
  const mappedFamilyId = props.safeStateOnly ? null : tileSupport(props.preset);
  const proofActive = Boolean(mappedFamilyId && props.selectedEntry?.familyId === mappedFamilyId);
  const supported = Boolean(mappedFamilyId);
  const status = props.statusOverride ?? (props.safeStateOnly ? "Safe state" : supported ? "Approved proof" : "Coming soon");

  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={() => props.onSelect(props.preset)}
      className={`b92-structure-tile${props.selected ? " b92-structure-tile--selected" : ""}`}
      title={
        props.safeStateOnly
          ? "Grid/shape/coupling tiles are modelled only; drawings and geometry are not generated yet."
          : definition.unsupportedReason ?? "Maps to an approved proof family."
      }
    >
      <MiniLayout rows={definition.rows} columns={definition.columns} />
      <div className="b92-structure-tile__copy">
        <div className="b92-structure-tile__title">{definition.label}</div>
        <div className={`b92-structure-tile__status${proofActive || supported ? " b92-structure-tile__status--supported" : props.safeStateOnly ? " b92-structure-tile__status--safe" : ""}`}>
          {status}
        </div>
      </div>
    </button>
  );
}

function TileGroup(props: { title: string; children: ReactNode }) {
  return (
    <section className="b92-tile-group">
      <div className="b92-tile-group__title">{props.title}</div>
      <div className="b92-tile-group__grid">{props.children}</div>
    </section>
  );
}

export default function B92StructureTileLibrary(props: Props) {
  return (
    <section className="b92-structure-library">
      <div className="b92-structure-library__intro">
        <div className="b92-section-title">Basic shape / layout</div>
        <div className="b92-body-copy">
          Choose the normal window structure from tiles. Field operations are configured separately through Opening Type or right-click.
        </div>
      </div>

      <TileGroup title="Windows">
        {WINDOW_TILE_PRESETS.map((preset) => (
          <Tile
            key={preset}
            preset={preset}
            selected={props.structure.structureMode === "fields" && props.structure.layoutPreset === preset}
            selectedEntry={props.selectedEntry}
            onSelect={props.onSelectWindowPreset}
          />
        ))}
      </TileGroup>

      <TileGroup title="Grid / Shapes / Coupled placeholders">
        {B92_GRID_PRESET_OPTIONS.map((preset) => (
          <Tile
            key={preset.id}
            preset={preset.id}
            selected={props.structure.structureMode === "coupled" && props.structure.layoutPreset === preset.id}
            selectedEntry={props.selectedEntry}
            safeStateOnly
            disabled={props.parkGridAndCoupling || !props.onSelectGridPreset}
            statusOverride={props.parkGridAndCoupling ? "Future" : undefined}
            onSelect={(nextPreset) => props.onSelectGridPreset?.(nextPreset)}
          />
        ))}
      </TileGroup>
    </section>
  );
}
