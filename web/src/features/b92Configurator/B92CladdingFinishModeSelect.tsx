import type { B92ConfiguratorCladdingFinishMode } from "./b92Configurator.types";

type Props = {
  value: B92ConfiguratorCladdingFinishMode;
  onChange: (value: B92ConfiguratorCladdingFinishMode) => void;
};

export default function B92CladdingFinishModeSelect(props: Props) {
  return (
    <select
      className="b92-input b92-finish-mode-select"
      value={props.value}
      onChange={(event) => props.onChange(event.currentTarget.value as B92ConfiguratorCladdingFinishMode)}
    >
      <option value="native">Native Render</option>
      <option value="ral">RAL</option>
    </select>
  );
}
