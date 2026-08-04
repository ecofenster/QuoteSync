import React from "react";
import type { EstimateOutcome } from "../../../models/types";
import { Button, qsOutcomeClassName } from "../tabs/shared";

type Props = {
  e: any;
  pickerClient: any;
  currentOutcome: EstimateOutcome;
  canUsePricingActions: boolean;
  canUseOutputActions: boolean;
  statusMenuForEstimateId: string | null;
  setStatusMenuForEstimateId: React.Dispatch<React.SetStateAction<string | null>>;
  setSendModalEstimateId: React.Dispatch<React.SetStateAction<string | null>>;
  setSendModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeUserName: string;
  apiFetchJson: (path: string, options?: RequestInit) => Promise<any>;
  copyEstimateForClient: (client: any, sourceEstimateId: string) => void;
  confirmDeleteEstimate: (estimateId: string) => void;
  openEstimateFromPicker: (estimateId: string) => void;
  persistEstimateOutcome: (clientId: string, estimateId: string, outcome: EstimateOutcome) => void;
  downloadEstimateWordDocService: (args: any) => void;
  printEstimatePdfService: (args: any) => void;
  addFollowUpForEstimateService: (args: any) => void;
  itemPriceByPositionId: Record<string, string>;
  formatMeasure: (n: number) => string;
  formatMoney: (n: number) => string;
  positionDescription: (p: any) => string;
  importSupplierEstimate: (estimateId: string) => void;
};

export default function EstimateActionsBar(props: Props) {
  const {
    e,
    pickerClient,
    currentOutcome,
    canUsePricingActions,
    canUseOutputActions,
    statusMenuForEstimateId,
    setStatusMenuForEstimateId,
    setSendModalEstimateId,
    setSendModalOpen,
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
    importSupplierEstimate,
  } = props;

  return (
    <div className="ep-estimate-actions-grid">
      <div className="ep-estimate-action-group">
        <div className="ep-estimate-action-label">Email</div>
        <Button variant="outline" disabled={!canUseOutputActions} onClick={() => { setSendModalEstimateId(e.id); setSendModalOpen(true); }}>
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
              pickerClient,
              estimateId: e.id,
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
            setStatusMenuForEstimateId((prev) => (prev === e.id ? null : e.id));
          }}
        >
          <span className="ep-outcome-control__label">{currentOutcome}</span>
          <span className="ep-outcome-control__chevron">▾</span>
        </div>

        {statusMenuForEstimateId === e.id && (
          <div className="ep-outcome-menu" onClick={(ev) => ev.stopPropagation()}>
            {(["Open", "Order", "Lost"] as EstimateOutcome[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  persistEstimateOutcome(pickerClient.id, e.id, opt);
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
        <Button variant="outline" onClick={() => copyEstimateForClient(pickerClient, e.id)}>Copy</Button>
      </div>
      <div className="ep-estimate-action-group">
        <div className="ep-estimate-action-label">Delete estimate</div>
        <Button variant="outline" onClick={() => confirmDeleteEstimate(e.id)}>Delete</Button>
      </div>
      <div className="ep-estimate-action-group">
        <div className="ep-estimate-action-label">Open estimate</div>
        <Button variant="primary" onClick={() => openEstimateFromPicker(e.id)}>Open</Button>
      </div>
      <div className="ep-estimate-action-group">
        <div className="ep-estimate-action-label">Print Word Doc</div>
        <Button
          variant="outline"
          disabled={!canUseOutputActions}
          onClick={() =>
            downloadEstimateWordDocService({ pickerClient, e, itemPriceByPositionId, formatMeasure, formatMoney, positionDescription })
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
          onClick={() =>
            printEstimatePdfService({ pickerClient, e, itemPriceByPositionId, formatMeasure, formatMoney, positionDescription, alertFn: alert })
          }
        >
          Print PDF
        </Button>
      </div>
      <div className="ep-estimate-action-group">
        <div className="ep-estimate-action-label">Import Supplier Estimate</div>
        <Button variant="outline" disabled={!canUsePricingActions} onClick={() => importSupplierEstimate(e.id)}>Import Supplier Estimate</Button>
      </div>
    </div>
  );
}
