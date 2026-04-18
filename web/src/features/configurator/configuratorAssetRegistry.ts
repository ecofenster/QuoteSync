import fixedAsset from "../../assets/windowTypes/fixed.svg";
import tiltTurnAsset from "../../assets/windowTypes/tilt_turn.svg";
import asset1F from "../../assets/windowTypes/1-F.svg";
import asset2FTTL from "../../assets/windowTypes/2-F-TTL.svg";
import asset2FTTR from "../../assets/windowTypes/2-F-TTR.svg";
import asset2TTL_F from "../../assets/windowTypes/2-TTL-F.svg";
import asset2TTL_T from "../../assets/windowTypes/2-TTL-T.svg";
import asset2TTL_TTL from "../../assets/windowTypes/2-TTL-TTL.svg";
import asset2TTL_TTR from "../../assets/windowTypes/2-TTL-TTR.svg";
import asset2TTR_F from "../../assets/windowTypes/2-TTR-F.svg";
import asset2TTR_TTL from "../../assets/windowTypes/2-TTR-TTL.svg";
import asset2TTR_TTR from "../../assets/windowTypes/2-TTR-TTR.svg";
import asset2T_TTR from "../../assets/windowTypes/2-T-TTR.svg";
import asset2vF from "../../assets/windowTypes/2v-F.svg";

type ResolveArgs = {
  positionType: string;
  fieldsX: number;
  fieldsY: number;
  baseInsertion: string;
  cellInsertions: Record<string, string>;
};

type AssetMeta = {
  key: string;
  filename: string;
  alt: string;
  src: string;
};

const ASSET_MAP: Record<string, AssetMeta> = {
  fixed: { key: "fixed", filename: "fixed.svg", alt: "Fixed window", src: fixedAsset },
  tilt_turn: { key: "tilt_turn", filename: "tilt_turn.svg", alt: "Tilt and turn window", src: tiltTurnAsset },
  "1-F": { key: "1-F", filename: "1-F.svg", alt: "Single fixed window", src: asset1F },
  "2-F-TTL": { key: "2-F-TTL", filename: "2-F-TTL.svg", alt: "Two field fixed and tilt-turn-left window", src: asset2FTTL },
  "2-F-TTR": { key: "2-F-TTR", filename: "2-F-TTR.svg", alt: "Two field fixed and tilt-turn-right window", src: asset2FTTR },
  "2-TTL-F": { key: "2-TTL-F", filename: "2-TTL-F.svg", alt: "Two field tilt-turn-left and fixed window", src: asset2TTL_F },
  "2-TTL-T": { key: "2-TTL-T", filename: "2-TTL-T.svg", alt: "Two field tilt-turn-left and top-hung window", src: asset2TTL_T },
  "2-TTL-TTL": { key: "2-TTL-TTL", filename: "2-TTL-TTL.svg", alt: "Two field tilt-turn-left and tilt-turn-left window", src: asset2TTL_TTL },
  "2-TTL-TTR": { key: "2-TTL-TTR", filename: "2-TTL-TTR.svg", alt: "Two field tilt-turn-left and tilt-turn-right window", src: asset2TTL_TTR },
  "2-TTR-F": { key: "2-TTR-F", filename: "2-TTR-F.svg", alt: "Two field tilt-turn-right and fixed window", src: asset2TTR_F },
  "2-TTR-TTL": { key: "2-TTR-TTL", filename: "2-TTR-TTL.svg", alt: "Two field tilt-turn-right and tilt-turn-left window", src: asset2TTR_TTL },
  "2-TTR-TTR": { key: "2-TTR-TTR", filename: "2-TTR-TTR.svg", alt: "Two field tilt-turn-right and tilt-turn-right window", src: asset2TTR_TTR },
  "2-T-TTR": { key: "2-T-TTR", filename: "2-T-TTR.svg", alt: "Two field top-hung and tilt-turn-right window", src: asset2T_TTR },
  "2v-F": { key: "2v-F", filename: "2v-F.svg", alt: "Two vertical fixed window", src: asset2vF },
};

function keyForCell(col: number, row: number) {
  return `${col},${row}`;
}

function normalizeInsertionCode(raw: string, col: number, fieldsX: number) {
  const value = String(raw || "").trim().toLowerCase();

  if (value.includes("fixed")) return "F";
  if (value.includes("top hung")) return "T";

  if (value.includes("tilt") && value.includes("turn")) {
    if (fieldsX <= 1) return "TT";
    return col <= 0 ? "TTL" : "TTR";
  }

  if (value.includes("turn")) {
    if (fieldsX <= 1) return "TT";
    return col <= 0 ? "TTL" : "TTR";
  }

  return null;
}

export function resolveConfiguratorAssetKey(args: ResolveArgs) {
  const positionType = String(args.positionType || "").toLowerCase();
  if (positionType !== "window") {
    return "tilt_turn";
  }

  const fieldsX = Math.max(1, Number(args.fieldsX || 1));
  const fieldsY = Math.max(1, Number(args.fieldsY || 1));

  if (fieldsX === 1 && fieldsY === 1) {
    const code = normalizeInsertionCode(args.cellInsertions[keyForCell(0, 0)] ?? args.baseInsertion, 0, fieldsX);
    if (code === "F" && ASSET_MAP["1-F"]) return "1-F";
    return code === "F" ? "fixed" : "tilt_turn";
  }

  if (fieldsX === 1 && fieldsY === 2) {
    const topCode = normalizeInsertionCode(args.cellInsertions[keyForCell(0, 0)] ?? args.baseInsertion, 0, fieldsX);
    const bottomCode = normalizeInsertionCode(args.cellInsertions[keyForCell(0, 1)] ?? args.baseInsertion, 0, fieldsX);
    if (topCode === "F" && bottomCode === "F" && ASSET_MAP["2v-F"]) {
      return "2v-F";
    }
    return "tilt_turn";
  }

  if (fieldsX === 2 && fieldsY === 1) {
    const leftCode = normalizeInsertionCode(args.cellInsertions[keyForCell(0, 0)] ?? args.baseInsertion, 0, fieldsX);
    const rightCode = normalizeInsertionCode(args.cellInsertions[keyForCell(1, 0)] ?? args.baseInsertion, 1, fieldsX);
    const composed = leftCode && rightCode ? `2-${leftCode}-${rightCode}` : null;
    if (composed && ASSET_MAP[composed]) {
      return composed;
    }
    if (leftCode === "F" && rightCode === "F") {
      return "fixed";
    }
    return "tilt_turn";
  }

  return "tilt_turn";
}

export function getConfiguratorAssetMeta(assetKey: string): AssetMeta {
  return ASSET_MAP[assetKey] ?? ASSET_MAP.tilt_turn;
}