import { getB92LacquerOption, TEKNOS_LACQUER_OPTIONS } from "./b92FinishOptions";

type Props = {
  value: string | null;
  onChange: (value: string) => void;
};

export default function B92LacquerPicker(props: Props) {
  const selectedId = getB92LacquerOption(props.value)?.id ?? "";

  if (TEKNOS_LACQUER_OPTIONS.length === 0) {
    return <div className="b92-body-copy">No lacquer assets found in _project/Lacquers.</div>;
  }

  return (
    <div className="b92-lacquer-picker">
      <select className="b92-input" value={selectedId} onChange={(event) => props.onChange(event.currentTarget.value)}>
        {TEKNOS_LACQUER_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="b92-lacquer-picker__swatches">
        {TEKNOS_LACQUER_OPTIONS.map((option) => {
          const selected = option.id === selectedId;
          return (
            <button
              key={option.id}
              type="button"
              title={option.label}
              aria-label={option.label}
              onClick={() => props.onChange(option.id)}
              className={`b92-lacquer-picker__swatch${selected ? " b92-lacquer-picker__swatch--selected" : ""}`}
            ><img src={option.url} alt="" /></button>
          );
        })}
      </div>
    </div>
  );
}
