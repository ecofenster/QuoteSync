import type { Dispatch, SetStateAction } from "react";
import type { Client, ClientId, EstimateId, EstimateOutcome } from "../../models/types";
import { Button, qsOutcomeClassName } from "../estimatePicker/tabs/shared";
import type { EstimateCollectionItem } from "./EstimateCollectionItem";

type Props = {
  item: EstimateCollectionItem;
  itemClient: Client;
  currentOutcome: EstimateOutcome;
  statusMenuForEstimateId: string | null;
  setStatusMenuForEstimateId: Dispatch<SetStateAction<string | null>>;
  canUsePricingActions: boolean;
  canUseOutputActions: boolean;
  activeUserName: string;
  apiFetchJson: (path: string, options?: RequestInit) => Promise<any>;
  copyEstimateForClient: (client: Client, sourceEstimateId: EstimateId) => void;
  confirmDeleteEstimate: (estimateId: EstimateId) => void;
  openEstimateFromPicker: (estimateId: EstimateId) => void;
  persistEstimateOutcome: (clientId: ClientId, estimateId: EstimateId, outcome: EstimateOutcome) => void;
  downloadEstimateWordDocService: (args: any) => void;
  printEstimatePdfService: (args: any) => void;
  addFollowUpForEstimateService: (args: any) => void;
  itemPriceByPositionId: Record<string, string>;
  formatMeasure: (n: number) => string;
  formatMoney: (n: number) => string;
  positionDescription: (p: any) => string;
  setSendModalEstimateId: Dispatch<SetStateAction<string | null>>;
  setSendModalOpen: Dispatch<SetStateAction<boolean>>;
  importSupplierEstimate: (estimateId: EstimateId) => void;
};

export default function EstimateCollectionActions(props: Props) {
  const {
    item,
    itemClient,
    currentOutcome,
    statusMenuForEstimateId,
    setStatusMenuForEstimateId,
    canUsePricingActions,
    canUseOutputActions,
    activeUserName,
    apiFetchJson,
    copyEstimateForClient,
    confirmDeleteEstimate,
    openEstimateFromPicker,
    persistEstimateOutcome,
    downloadEstimateWordDocService,
    printEstimatePdfService,
    addFollowUpForEstimateService,
    itemPriceByPositionId,
    formatMeasure,
    formatMoney,
    positionDescription,
    setSendModalEstimateId,
    setSendModalOpen,
    importSupplierEstimate,
  } = props;

  return (
    <div className="ep-estimate-actions-grid">
      <div className="ep-estimate-action-group">
        <div className="ep-estimate-action-label">Email</div>
        <Button
          variant="outline"
          disabled={!canUseOutputActions}
          onClick={() => {
            setSendModalEstimateId(item.id);
            setSendModalOpen(true);
          }}
        >
          Send
        </Button>
      </div>

      <div className="ep-estimate-action-group">
        <div className="ep-estimate-action-label">Follow up</div>
        <Button
          variant="outline"
          disabled={!canUseOutputActions}
          onClick={() =>
            addFollowUpForEstimateService({
              pickerClient: itemClient,
              estimateId: item.id,
              opts: { days: 3, sendEmail: true, needsCall: true },
              apiFetchJson,
              activeUserName,
              alertFn: alert,
              logError: console.error,
            })
          }
        >
          Add Follow Up
        </Button>
      </div>

      <div className="ep-estimate-action-group ep-estimate-action-group--status">
        <div className="ep-estimate-action-label">Estimate status</div>
        <div
          role="button"
          className={`ep-outcome-control ${qsOutcomeClassName(currentOutcome)}`}
          onClick={(ev) => {
            ev.stopPropagation();
            setStatusMenuForEstimateId((prev) => (prev === item.id ? null : item.id));
          }}
        >
          <span className="ep-outcome-control__label">{currentOutcome}</span>
          <span className="ep-outcome-control__chevron">▾</span>
        </div>

        {statusMenuForEstimateId === item.id && (
          <div
            className="ep-outcome-menu"
            onClick={(ev) => ev.stopPropagation()}
          >
            {(["Open", "Order", "Lost"] as EstimateOutcome[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  persistEstimateOutcome(itemClient.id, item.id, opt);
                  setStatusMenuForEstimateId(null);
                }}
                className="ep-outcome-menu__item"
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ep-estimate-action-group">
        <div className="ep-estimate-action-label">Copy estimate</div>
        <Button variant="outline" onClick={() => copyEstimateForClient(itemClient, item.id)}>
          Copy
        </Button>
      </div>

      <div className="ep-estimate-action-group">
        <div className="ep-estimate-action-label">Delete estimate</div>
        <Button variant="outline" onClick={() => confirmDeleteEstimate(item.id)}>
          Delete
        </Button>
      </div>

      <div className="ep-estimate-action-group">
        <div className="ep-estimate-action-label">Open estimate</div>
        <Button variant="primary" onClick={() => openEstimateFromPicker(item.id)}>
          Open
        </Button>
      </div>

      <div className="ep-estimate-action-group">
        <div className="ep-estimate-action-label">Print Word Doc</div>
        <Button
          variant="outline"
          disabled={!canUseOutputActions}
          onClick={() =>
            downloadEstimateWordDocService({
              pickerClient: itemClient,
              e: item,
              itemPriceByPositionId,
              formatMeasure,
              formatMoney,
              positionDescription,
            })
          }
        >
          Print Word Doc
        </Button>
      </div>

      <div className="ep-estimate-action-group">
        <div className="ep-estimate-action-label">Print PDF</div>
        <Button
          variant="outline"
          disabled={!canUseOutputActions}
          data-testid="estimate-print-pdf"
          onClick={() =>
            printEstimatePdfService({
              pickerClient: itemClient,
              e: item,
              itemPriceByPositionId,
              formatMeasure,
              formatMoney,
              positionDescription,
              alertFn: alert,
            })
          }
        >
          Print PDF
        </Button>
      </div>

      <div className="ep-estimate-action-group">
        <div className="ep-estimate-action-label">Import Supplier Estimate</div>
        <Button variant="outline" disabled={!canUsePricingActions} onClick={() => importSupplierEstimate(item.id)}>
          Import Supplier Estimate
        </Button>
      </div>
    </div>
  );
}
