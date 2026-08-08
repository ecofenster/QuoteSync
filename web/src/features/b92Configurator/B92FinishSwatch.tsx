import type { TeknosLacquerOption } from "./b92FinishOptions";

type Props = {
  fill: string;
  label: string;
  lacquer?: TeknosLacquerOption | null;
};

export default function B92FinishSwatch(props: Props) {
  return (
    <span className="b92-finish-swatch">
      {props.lacquer ? <img className="b92-finish-swatch__sample" src={props.lacquer.url} alt="" /> : <svg className="b92-finish-swatch__sample" aria-hidden="true"><rect width="100%" height="100%" fill={props.fill} /></svg>}
      {props.label}
    </span>
  );
}
