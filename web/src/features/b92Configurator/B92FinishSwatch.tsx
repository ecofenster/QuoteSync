import type { TeknosLacquerOption } from "./b92FinishOptions";

type Props = {
  fill: string;
  label: string;
  lacquer?: TeknosLacquerOption | null;
};

export default function B92FinishSwatch(props: Props) {
  const background = props.lacquer ? `url(${props.lacquer.url}) center / cover` : props.fill;
  return (
    <span className="b92-finish-swatch">
      <span className="b92-finish-swatch__sample" style={{ background }} />
      {props.label}
    </span>
  );
}
