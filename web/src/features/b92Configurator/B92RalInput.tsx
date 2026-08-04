import { B92_RAL_CLASSIC_COLOURS } from "../admin/windowTypes/b92RalClassicColours";
import { B92_RAL_DATALIST_ID, normalizeB92Ral } from "./b92FinishOptions";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function B92RalDatalist() {
  return (
    <datalist id={B92_RAL_DATALIST_ID}>
      {B92_RAL_CLASSIC_COLOURS.map((colour) => (
        <option key={colour.code} value={colour.code}>
          {colour.name}
        </option>
      ))}
    </datalist>
  );
}

export default function B92RalInput(props: Props) {
  return (
    <input
      className="b92-input"
      value={props.value}
      inputMode="numeric"
      maxLength={4}
      list={B92_RAL_DATALIST_ID}
      onChange={(event) => props.onChange(normalizeB92Ral(event.currentTarget.value, ""))}
      placeholder="7016"
    />
  );
}
