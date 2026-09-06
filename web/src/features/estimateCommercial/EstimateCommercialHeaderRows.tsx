import React from "react";
import EstimateCommercialViewSwitch, {
  type EstimateCommercialView,
} from "./EstimateCommercialViewSwitch";
import SupplierCommercialReview, {
  type SupplierCommercialResult,
} from "../projectCalculatorLab/SupplierCommercialReview";

export default function EstimateCommercialHeaderRows({
  clientRef,
  estimateRef,
  clientName,
  commercialView,
  onViewChange,
  onBack,
  scenarioId,
  supplierPolicies,
  nextActionMessage,
  revisionStatus,
  creatingRevision,
  onCreateRevision,
  onOpenDocuments,
  canReviewCustomerQuotation,
  onReviewCustomerQuotation,
}: {
  clientRef: string;
  estimateRef: string;
  clientName: string;
  commercialView: EstimateCommercialView;
  onViewChange: (view: EstimateCommercialView) => void;
  onBack?: () => void;
  scenarioId: string;
  supplierPolicies: SupplierCommercialResult[];
  nextActionMessage: string;
  revisionStatus?: string;
  creatingRevision: boolean;
  onCreateRevision: () => void;
  onOpenDocuments: () => void;
  canReviewCustomerQuotation: boolean;
  onReviewCustomerQuotation: () => void;
}) {
  return <>
    <header className="estimate-commercial__estimate-row" data-project-costing-order="estimate" data-estimate-ref={estimateRef}>
      <div>
        <h2>Estimate</h2>
        <div className="estimate-commercial__identity"><strong>{clientRef}</strong><strong>{estimateRef}</strong><span>{clientName}</span></div>
        <small>Supplier/Product Defaults are set separately. Add Position starts at Position Configuration.</small>
      </div>
      <div className="estimate-commercial__estimate-actions">
        {commercialView === "internal" ? supplierPolicies.length ? <SupplierCommercialReview scenarioId={scenarioId} policies={supplierPolicies} /> : <button type="button" className="ui-button" disabled={!scenarioId}>Amend Commercial Choices</button> : null}
        <div className="estimate-commercial__view-switch"><EstimateCommercialViewSwitch view={commercialView} onChange={onViewChange} /></div>
        {onBack ? <button type="button" className="ui-button" onClick={onBack}>Back</button> : null}
      </div>
    </header>
    <aside className="estimate-commercial__next-action" data-project-costing-order="next-action">
      <div><strong>Next Action</strong><span>{nextActionMessage}</span>{revisionStatus ? <small role="status">{revisionStatus}</small> : null}</div>
      <div className="estimate-commercial__next-actions">
        <button type="button" className="ui-button" disabled={!scenarioId || creatingRevision} onClick={onCreateRevision}>{creatingRevision ? "Creating…" : "Create Revision"}</button>
        <button type="button" className="ui-button" onClick={onOpenDocuments}>Files / Documents</button>
        <button type="button" className="ui-button ui-button--primary" disabled={!canReviewCustomerQuotation} onClick={onReviewCustomerQuotation}>Review Customer Quotation</button>
      </div>
    </aside>
  </>;
}
