import { estimateCostTotal, estimateTotals } from "../../domain/estimates/estimateCalculations";
import ExpandToggle from "../../components/common/ExpandToggle";
import { Pill, Small } from "../estimatePicker/tabs/shared";
import type { EstimateCollectionItem } from "./EstimateCollectionItem";

type Props = {
  item: EstimateCollectionItem;
  isExpanded: boolean;
  onToggle: () => void;
  formatMeasure: (n: number) => string;
  formatMoney: (n: number) => string;
  itemPriceByPositionId: Record<string, string>;
};

export default function EstimateCollectionRow(props: Props) {
  const {
    item,
    isExpanded,
    onToggle,
    formatMeasure,
    formatMoney,
    itemPriceByPositionId,
  } = props;

  const totals = estimateTotals(item);
  const estimateCost = estimateCostTotal(item, itemPriceByPositionId);

  return (
    <div onClick={onToggle} className="ep-estimate-summary">
      <div className="ep-estimate-summary-meta">
        <ExpandToggle expanded={isExpanded} />
        <Pill>{item.estimateRef}</Pill>
        <Small>{item.status}</Small>
        <Small>{item.positions.length} positions</Small>
        <Small>{formatMeasure(totals.totalSquareMetres)} m²</Small>
        <Small>{formatMeasure(totals.totalLinearMetres)} lm</Small>
        <Small>{formatMoney(estimateCost)}</Small>
      </div>
      <div className="ep-estimate-summary-toggle">
        {isExpanded ? "Hide review" : "Review positions"}
      </div>
    </div>
  );
}
