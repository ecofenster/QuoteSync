import type { B92ConfiguratorFinishMode } from "./b92Configurator.types";

type Props = {
  value: B92ConfiguratorFinishMode;
  onChange: (value: B92ConfiguratorFinishMode) => void;
};

export default function B92FinishModeSelect(props: Props) {
  return (
    <select
      className="b92-input b92-finish-mode-select"
      value={props.value}
      onChange={(event) => props.onChange(event.currentTarget.value as B92ConfiguratorFinishMode)}
    >
      <option value="native">Native Render</option>
      <option value="lacquer">Lacquer</option>
      <option value="ral">RAL</option>
    </select>
  );
}
