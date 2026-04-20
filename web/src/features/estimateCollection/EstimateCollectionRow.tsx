import { estimateCostTotal, estimateTotals } from "../../domain/estimates/estimateCalculations";
import ExpandToggle from "../../components/common/ExpandToggle";
import { Pill, Small } from "../estimatePicker/tabs/shared";
import type { EstimateCollectionItem } from "./EstimateCollectionItem";
import type { EstimateCollectionViewMode } from "./EstimateCollectionView";

type Props = {
  item: EstimateCollectionItem;
  isExpanded: boolean;
  onToggle: () => void;
  viewMode: EstimateCollectionViewMode;
  formatMeasure: (n: number) => string;
  formatMoney: (n: number) => string;
  itemPriceByPositionId: Record<string, string>;
};

export default function EstimateCollectionRow(props: Props) {
  const {
    item,
    isExpanded,
    onToggle,
    viewMode,
    formatMeasure,
    formatMoney,
    itemPriceByPositionId,
  } = props;

  const totals = estimateTotals(item);
  const estimateCost = estimateCostTotal(item, itemPriceByPositionId);
  const showClientIdentity = !!(item.clientName || item.clientReference);

  return (
    <div onClick={onToggle} className={`ep-estimate-summary ep-estimate-summary--${viewMode}`}>
      <div className="ep-estimate-summary-main">
        <div className="ep-estimate-summary-topline">
          <ExpandToggle expanded={isExpanded} />
          <Pill>{item.estimateRef}</Pill>
          {showClientIdentity && item.clientName && (
            <div className="ep-estimate-client-name">{item.clientName}</div>
          )}
          {showClientIdentity && item.clientReference && (
            <Small>Client Ref: {item.clientReference}</Small>
          )}
        </div>

        <div className="ep-estimate-summary-meta">
          <Small>{item.status}</Small>
          <Small>{item.positions.length} positions</Small>
          <Small>{formatMeasure(totals.totalSquareMetres)} m²</Small>
          <Small>{formatMeasure(totals.totalLinearMetres)} lm</Small>
          <Small>{formatMoney(estimateCost)}</Small>
        </div>
      </div>
      <div className="ep-estimate-summary-toggle">
        {isExpanded ? "Hide review" : "Review positions"}
      </div>
    </div>
  );
}
