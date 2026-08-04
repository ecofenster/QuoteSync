import type {
  B92ConfiguratorFinishMode,
  B92ConfiguratorFinishState,
} from "./b92Configurator.types";
import {
  B92_NATIVE_FRAME_FILL,
  getB92LacquerOption,
  getB92RalColour,
  getB92RalLabel,
} from "./b92FinishOptions";
import B92CladdingFinishModeSelect from "./B92CladdingFinishModeSelect";
import B92FinishModeSelect from "./B92FinishModeSelect";
import B92FinishSwatch from "./B92FinishSwatch";
import B92LacquerPicker from "./B92LacquerPicker";
import B92RalInput, { B92RalDatalist } from "./B92RalInput";

type Props = {
  finishes: B92ConfiguratorFinishState;
  onChange: (patch: Partial<B92ConfiguratorFinishState>) => void;
};

function FinishGroup(props: {
  title: string;
  mode: B92ConfiguratorFinishMode;
  ral: string;
  lacquerId: string | null;
  onModeChange: (mode: B92ConfiguratorFinishMode) => void;
  onRalChange: (ral: string) => void;
  onLacquerChange: (lacquerId: string) => void;
}) {
  const activeLacquer = props.mode === "lacquer" ? getB92LacquerOption(props.lacquerId) : null;
  const label = props.mode === "native" ? "Native Render" : props.mode === "ral" ? getB92RalLabel(props.ral) : activeLacquer?.label ?? "Lacquer";
  const fill = props.mode === "native" ? B92_NATIVE_FRAME_FILL : props.mode === "ral" ? getB92RalColour(props.ral) : "#b89b70";

  return (
    <div className="b92-finish-group">
      <span className="b92-setting-label">{props.title}</span>
      <div className="b92-finish-group__control-grid">
        <B92FinishModeSelect value={props.mode} onChange={props.onModeChange} />
        {props.mode === "native" ? (
          <B92FinishSwatch fill={B92_NATIVE_FRAME_FILL} label="Native Render" />
        ) : props.mode === "ral" ? (
          <B92RalInput value={props.ral} onChange={props.onRalChange} />
        ) : (
          <B92LacquerPicker value={props.lacquerId} onChange={props.onLacquerChange} />
        )}
      </div>
      <B92FinishSwatch fill={fill} lacquer={activeLacquer} label={label} />
    </div>
  );
}

export default function B92ConfiguratorFinishPanel(props: Props) {
  const claddingFill =
    props.finishes.externalCladdingMode === "native" ? B92_NATIVE_FRAME_FILL : getB92RalColour(props.finishes.externalCladdingRal);
  const claddingLabel =
    props.finishes.externalCladdingMode === "native" ? "Native Render" : getB92RalLabel(props.finishes.externalCladdingRal);

  return (
    <section className="b92-finish-panel">
      <B92RalDatalist />
      <div className="b92-finish-panel__intro">
        <div className="b92-section-title">Finish test controls</div>
        <div className="b92-body-copy">Native Render, Lacquer, and RAL controls drive the existing B92 proof preview masks.</div>
      </div>
      <div className="b92-finish-panel__groups">
        <FinishGroup
          title="Internal finish"
          mode={props.finishes.internalMode}
          ral={props.finishes.internalRal}
          lacquerId={props.finishes.internalLacquerId}
          onModeChange={(internalMode) => props.onChange({ internalMode })}
          onRalChange={(internalRal) => props.onChange({ internalRal })}
          onLacquerChange={(internalLacquerId) => props.onChange({ internalLacquerId })}
        />
        <FinishGroup
          title="External reveal finish"
          mode={props.finishes.externalRevealMode}
          ral={props.finishes.externalRevealRal}
          lacquerId={props.finishes.externalRevealLacquerId}
          onModeChange={(externalRevealMode) => props.onChange({ externalRevealMode })}
          onRalChange={(externalRevealRal) => props.onChange({ externalRevealRal })}
          onLacquerChange={(externalRevealLacquerId) => props.onChange({ externalRevealLacquerId })}
        />
        <div className="b92-finish-group">
          <span className="b92-setting-label">External cladding finish</span>
          <div className="b92-finish-group__control-grid">
            <B92CladdingFinishModeSelect
              value={props.finishes.externalCladdingMode}
              onChange={(externalCladdingMode) => props.onChange({ externalCladdingMode })}
            />
            {props.finishes.externalCladdingMode === "native" ? (
              <B92FinishSwatch fill={B92_NATIVE_FRAME_FILL} label="Native Render" />
            ) : (
              <B92RalInput value={props.finishes.externalCladdingRal} onChange={(externalCladdingRal) => props.onChange({ externalCladdingRal })} />
            )}
          </div>
          <B92FinishSwatch fill={claddingFill} label={claddingLabel} />
        </div>
      </div>
    </section>
  );
}
