import {
  useEffect,
  Fragment,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import type { Client, Estimate, Position } from "../../models/types";
import { projectCalculatorLabApi } from "../projectCalculatorLab/api/projectCalculatorLabApi";
import {
  DEFAULT_CUSTOMER_QUOTATION_DISPLAY_OPTIONS,
  type CustomerQuotationDisplayOptions,
} from "./customerQuotationDisplay";
import { paginateCustomerQuotationPositions } from "./customerQuotationPagination";
import {
  buildCustomerQuotationProjection,
  type CustomerQuotationProjection,
} from "./customerQuotationProjection";
import CustomerQuotationPositionCard from "./CustomerQuotationPositionCard";
import { quotationWorkflowApi, type IssuedQuotationView } from "../../services/quotations/quotationWorkflowApi";
import type { CalculatorScenario } from "../projectCalculatorLab/domain/projectCalculatorLab.types";
import "./customerQuotation.css";
import "./customerQuotationBrand.css";
import { loadDocumentCoverPhoto } from "./documentCoverPhoto";

type DocumentTemplate = "technical_schedule" | "customer_quotation";
const money = (value: string | null | undefined) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
      }).format(Number(value));

function PageHeader({
  projection,
}: {
  projection: CustomerQuotationProjection;
}) {
  return (
    <header className="customer-quotation-page__header">
      {projection.brand.logoLightUrl ? (
        <img
          src={projection.brand.logoLightUrl}
          alt={projection.brand.tradingName}
        />
      ) : (
        <strong>{projection.brand.tradingName}</strong>
      )}
      <div>
        <b>Customer</b>
        <span>{projection.clientName}</span>
        <small>{projection.projectAddress}</small>
      </div>
      <div>
        <b>Reference</b>
        <span>{projection.estimateReference}</span>
      </div>
      <div>
        <b>Date</b>
        <span>
          {new Date(projection.previewDate).toLocaleDateString("en-GB")}
        </span>
      </div>
      <div className="customer-quotation-page__quote">
        <small>ESTIMATE</small>
        <strong>{projection.estimateReference}</strong>
        <span>Commercial revision {projection.commercialRevision}</span>
      </div>
    </header>
  );
}

function EstimateCover({ projection }: { projection: CustomerQuotationProjection }) {
  return <section className={`customer-quotation-page customer-quotation-cover${projection.coverPhotoUrl ? " customer-quotation-cover--photographic" : " customer-quotation-cover--awaiting-photo"}`}>
    {projection.coverPhotoUrl ? <img className="customer-quotation-cover__photo" src={projection.coverPhotoUrl} alt="" /> : <div className="customer-quotation-cover__photo-placeholder" aria-hidden="true" />}
    <div className="customer-quotation-cover__banner">
      {projection.brand.logoLightUrl ? <img className="customer-quotation-cover__logo" src={projection.brand.logoLightUrl} alt={projection.brand.tradingName} /> : <strong className="customer-quotation-cover__brand">{projection.brand.tradingName}</strong>}
      <div className="customer-quotation-cover__rule" />
      <div className="customer-quotation-cover__title"><h1>{projection.documentTitle}</h1><p>{projection.documentSubtitle}</p></div>
      <dl className="customer-quotation-cover__details"><div><dt>Prepared for</dt><dd>{projection.clientName}</dd></div><div><dt>Client reference</dt><dd>{projection.clientReference || "—"}</dd></div><div><dt>Project</dt><dd>{projection.projectName || projection.projectAddress}</dd></div><div><dt>Estimate reference</dt><dd>{projection.estimateReference}</dd></div><div><dt>Issue date</dt><dd>{new Date(projection.previewDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</dd></div></dl>
      <p className="customer-quotation-cover__basis">Prepared from the information currently available</p>
      {projection.architecturalDetailUrl ? <img className="customer-quotation-cover__detail" src={projection.architecturalDetailUrl} alt="Architectural window section detail" /> : null}
      <p className="customer-quotation-cover__strapline">PEOPLE<br />SPACES<br />A BRIGHTER TOMORROW</p>
    </div>
    {!projection.coverPhotoUrl ? <p className="customer-quotation-cover__asset-note no-print">Approved raw architectural cover photograph required. The document structure is ready; no substitute image has been invented.</p> : null}
  </section>;
}

function ProductsInEstimate({ projection, page, total }: { projection: CustomerQuotationProjection; page: number; total: number }) {
  return <section className="customer-quotation-page customer-quotation-page--showcase"><PageHeader projection={projection} /><main><header><span className="customer-quotation-page__kicker">Your selected systems</span><h2>Products in Your Estimate</h2><p>Only product systems included in this Estimate are shown.</p></header><div className="customer-quotation-showcases">{projection.productShowcases.map((showcase) => <article key={showcase.id}><img src={showcase.imageUrl} alt={`${showcase.name} product section`} /><div><h3>{showcase.name}</h3><p>Included for Position{showcase.positionReferences.length === 1 ? "" : "s"} {showcase.positionReferences.join(", ")}.</p></div></article>)}</div></main><PageFooter projection={projection} page={page} total={total} /></section>;
}

function SpecificationOverview({ projection, page, total }: { projection: CustomerQuotationProjection; page: number; total: number }) {
  return <section className="customer-quotation-page customer-quotation-page--specification-overview"><PageHeader projection={projection} /><main><header><span className="customer-quotation-page__kicker">Effective reviewed specification</span><h2>Your Specification at a Glance</h2><p>Shared system evidence is summarised here. Position pages remain authoritative for dimensions, quantities, prices and explicit Position overrides.</p></header><div className="customer-quotation-specification-overview">{projection.specificationOverview.map((group) => <article key={group.productSystem}><header><h3>{group.productSystem}</h3><small>Positions {group.positionReferences.join(", ")}</small></header><dl>{group.items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.values.join(" · ")}</dd></div>)}</dl></article>)}</div></main><PageFooter projection={projection} page={page} total={total} /></section>;
}
function PageFooter({
  projection,
  page,
  total,
}: {
  projection: CustomerQuotationProjection;
  page: number;
  total: number;
}) {
  return (
    <footer className="customer-quotation-page__footer">
      <span>
        {projection.brand.companyName}
        {projection.brand.address ? ` · ${projection.brand.address}` : ""}
      </span>
      <span>
        {[
          projection.brand.telephone,
          projection.brand.email,
          projection.brand.website,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
      <span>
        Page {page} of {total}
      </span>
    </footer>
  );
}

export default function CustomerQuotationPreview({
  client,
  estimate,
  PositionPreview,
  onClose,
  onWorkflowChanged,
}: {
  client: Client;
  estimate: Estimate;
  PositionPreview?: ComponentType<{ position: Position }>;
  onClose: () => void;
  onWorkflowChanged?: () => void;
}) {
  const [projection, setProjection] =
    useState<CustomerQuotationProjection | null>(null);
  const [error, setError] = useState("");
  const [issuePreparation, setIssuePreparation] = useState<IssuedQuotationView | null>(null);
  const [activeAction,setActiveAction]=useState<"download"|"prepare"|"send"|"withdraw"|null>(null);
  const [issueError,setIssueError]=useState("");
  const [downloadResult,setDownloadResult]=useState<{fileName:string;sizeBytes:number}|null>(null);
  const [issueRecipient,setIssueRecipient]=useState("");
  const [issueSubject,setIssueSubject]=useState("");
  const [issueBody,setIssueBody]=useState("");
  const [sourceScenario,setSourceScenario]=useState<CalculatorScenario|null>(null);
  const [coverPhotoUrl,setCoverPhotoUrl]=useState<string|null>(null);
  const [termsOpen,setTermsOpen]=useState(false);
  const [termsBusy,setTermsBusy]=useState(false);
  const [termsError,setTermsError]=useState("");
  const [validityDays,setValidityDays]=useState("30");
  const [termsText,setTermsText]=useState("");
  const [exclusionsText,setExclusionsText]=useState("");
  const [withdrawOpen,setWithdrawOpen]=useState(false);
  const [withdrawReason,setWithdrawReason]=useState("");
  const actionInFlight=useRef(false);
  const [options, setOptions] = useState<CustomerQuotationDisplayOptions>(
    DEFAULT_CUSTOMER_QUOTATION_DISPLAY_OPTIONS,
  );
  const [template, setTemplate] =
    useState<DocumentTemplate>("customer_quotation");
  useEffect(() => {
    let cancelled = false;
    projectCalculatorLabApi
      .listScenarios(String(estimate.id))
      .then(async (scenarios) => {
        const saved = scenarios[0];
        if (!saved)
          throw new Error(
            "Save Project Costing before previewing the customer quotation.",
          );
        const [scenario, coverPhoto,commercialTerms,workflowState] = await Promise.all([
          projectCalculatorLabApi.getScenario(saved.id, String(estimate.id)),
          loadDocumentCoverPhoto().catch(() => null),
          quotationWorkflowApi.getCustomerTerms(String(estimate.id)),
          quotationWorkflowApi.state(String(estimate.id)).catch(()=>null),
        ]);
        if (!cancelled){
          setSourceScenario(scenario);setCoverPhotoUrl(coverPhoto?.dataUrl??null);setValidityDays(String(commercialTerms.validityDays));setTermsText(commercialTerms.terms.join("\n"));setExclusionsText(commercialTerms.exclusions.join("\n"));
          setProjection(
            buildCustomerQuotationProjection({ scenario, client, estimate, coverPhotoUrl: coverPhoto?.dataUrl ?? null,commercialTerms:{validityDays:commercialTerms.validityDays,terms:commercialTerms.terms,exclusions:commercialTerms.exclusions,reviewed:commercialTerms.reviewed,reviewedAt:commercialTerms.reviewedAt} }),
          );
          if(workflowState?.issuedQuotationId){const current=await quotationWorkflowApi.get(workflowState.issuedQuotationId);if(!cancelled){setIssuePreparation(current);setIssueRecipient(current.recipient);setIssueSubject(current.subject);setIssueBody(current.communication?.bodyHtml||"")}}
        }
      })
      .catch((reason) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "Customer quotation could not be prepared.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [client, estimate]);
  const pages = useMemo(
    () =>
      projection
        ? paginateCustomerQuotationPositions(projection.positions)
        : [],
    [projection],
  );
  const frontMatterPages = projection ? 2 + (projection.productShowcases.length ? 1 : 0) : 0;
  const totalPages = pages.length + frontMatterPages + (projection ? 1 : 0);
  const includedPositions = projection?.positions.filter((position) => position.includedInQuotationTotal) ?? [];
  const style = projection
    ? ({
        "--document-primary": projection.brand.primaryColour,
        "--document-accent": projection.brand.accentColour,
      } as CSSProperties)
    : undefined;
  const prepareForSend=async()=>{
    if(!projection||actionInFlight.current)return;actionInFlight.current=true;
    if(!projection.commercialTerms.reviewed){actionInFlight.current=false;setIssueError("Review validity, terms and exclusions before preparing the customer Email.");setTermsOpen(true);return}
    setActiveAction("prepare");setIssueError("");setDownloadResult(null);
    try{
      const prepared=await quotationWorkflowApi.prepare({estimateId:String(estimate.id),clientId:String(client.id),estimateRevision:estimate.revisionNo,quotationRevision:projection.commercialRevision,projection,recipient:client.email});
      setIssuePreparation(prepared);setIssueRecipient(prepared.recipient);setIssueSubject(prepared.subject);setIssueBody(prepared.communication?.bodyHtml||"");onWorkflowChanged?.();
    }catch(reason){setIssueError(reason instanceof Error?reason.message:"Quotation email could not be prepared.")}
    finally{actionInFlight.current=false;setActiveAction(null)}
  };
  const sendPrepared=async()=>{
    if(!issuePreparation||actionInFlight.current)return;actionInFlight.current=true;
    setActiveAction("send");setIssueError("");
    try{const issued=await quotationWorkflowApi.send(issuePreparation.id,{recipient:issueRecipient,subject:issueSubject,bodyHtml:issueBody});setIssuePreparation(issued);onWorkflowChanged?.()}
    catch(reason){setIssueError(reason instanceof Error?reason.message:"The provider did not send the quotation.");try{setIssuePreparation(await quotationWorkflowApi.get(issuePreparation.id))}catch{/* retain current preparation */}onWorkflowChanged?.()}
    finally{actionInFlight.current=false;setActiveAction(null)}
  };
  const downloadProductionPdf=async()=>{if(!projection||actionInFlight.current)return;if(!projection.commercialTerms.reviewed){setIssueError("Review validity, terms and exclusions before downloading the customer PDF.");setTermsOpen(true);return}actionInFlight.current=true;setActiveAction("download");setIssueError("");setDownloadResult(null);try{setDownloadResult(await quotationWorkflowApi.downloadPreview(projection,String(estimate.id)))}catch(reason){setIssueError(reason instanceof Error?reason.message:"Estimate PDF could not be generated. Check the Estimate and try again.")}finally{actionInFlight.current=false;setActiveAction(null)}};
  const saveTerms=async()=>{if(!sourceScenario||termsBusy)return;setTermsBusy(true);setTermsError("");try{const saved=await quotationWorkflowApi.saveCustomerTerms(String(estimate.id),{validityDays:Number(validityDays),terms:termsText.split(/\r?\n/),exclusions:exclusionsText.split(/\r?\n/)});setProjection(buildCustomerQuotationProjection({scenario:sourceScenario,client,estimate,coverPhotoUrl,commercialTerms:{validityDays:saved.validityDays,terms:saved.terms,exclusions:saved.exclusions,reviewed:saved.reviewed,reviewedAt:saved.reviewedAt}}));setIssuePreparation(null);setDownloadResult(null);setTermsOpen(false)}catch(reason){setTermsError(reason instanceof Error?reason.message:"Estimate terms could not be saved. Your entries are still here.")}finally{setTermsBusy(false)}};
  const withdrawIssued=async()=>{if(!issuePreparation||!withdrawReason.trim()||actionInFlight.current)return;actionInFlight.current=true;setActiveAction("withdraw");setIssueError("");try{const withdrawn=await quotationWorkflowApi.withdraw(issuePreparation.id,withdrawReason);setIssuePreparation(withdrawn);setWithdrawOpen(false);onWorkflowChanged?.()}catch(reason){setIssueError(reason instanceof Error?reason.message:"The Estimate could not be withdrawn. Your reason is still here; review the message and retry safely.")}finally{actionInFlight.current=false;setActiveAction(null)}};
  const issueBusy=activeAction!==null;
  const issuedEvidence=issuePreparation?.status==="issued";
  const termsLocked=issuedEvidence;
  const summary = projection ? (
    <section className="customer-quotation-page customer-quotation-page--summary">
      <PageHeader projection={projection} />
      <main>
        <section className="customer-quotation-summary">
          <h2>Estimate Summary</h2>
          <p>
            {includedPositions.length} included position(s) and {projection.alternatives.length} alternative option(s) for{" "}
            {projection.projectName || projection.clientName}.
          </p>
          {projection.charges.length ? (
            <div className="customer-quotation__charges">
              {projection.charges.map((charge) => (
                <Fragment key={charge.id}>
                  <div>
                    <span>{charge.label}</span>
                    <strong>{money(charge.amountGbp)}</strong>
                  </div>
                  {charge.id === "products" ? <div className="customer-quotation__scope-note"><span>{includedPositions.length} included position(s) · physical quantity {includedPositions.reduce((sum, position) => sum + position.quantity, 0)} · detailed product schedule follows</span></div> : null}
                  {charge.id === "installation" && projection.installationInclusions.length ? <div className="customer-quotation__scope-note"><span>Includes: {projection.installationInclusions.join(" · ")}</span></div> : null}
                </Fragment>
              ))}
            </div>
          ) : null}
          <div className="customer-quotation__totals">
            {projection.showCustomerDiscount ? <div>
              <span>Customer discount</span>
              <strong>−{money(projection.customerDiscountGbp)}</strong>
            </div> : null}
            {projection.fixedSellingPriceEnabled &&
            Number(projection.fixedPriceAdjustmentGbp) !== 0 ? (
              <div>
                <span>Project fixed-price adjustment</span>
                <strong>{money(projection.fixedPriceAdjustmentGbp)}</strong>
              </div>
            ) : null}
            <div>
              <span>Subtotal excluding VAT</span>
              <strong>{money(projection.subtotalExVatGbp)}</strong>
            </div>
            <div>
              <span>VAT ({projection.vatRatePercent}%)</span>
              <strong>{money(projection.vatGbp)}</strong>
            </div>
            <div className="customer-quotation__grand-total">
              <span>Total including VAT</span>
              <strong>{money(projection.totalIncVatGbp)}</strong>
            </div>
          </div>
          <section className="customer-quotation__commercial-terms">
            <h3>Estimate validity, terms and exclusions</h3>
            <p>This Estimate is valid for {projection.commercialTerms.validityDays} days from its issue date.</p>
            {projection.commercialTerms.terms.length?<><h4>Terms</h4><ul>{projection.commercialTerms.terms.map((item,index)=><li key={`term-${index}`}>{item}</li>)}</ul></>:null}
            {projection.commercialTerms.exclusions.length?<><h4>Exclusions</h4><ul>{projection.commercialTerms.exclusions.map((item,index)=><li key={`exclusion-${index}`}>{item}</li>)}</ul></>:null}
          </section>
        </section>
      </main>
      <PageFooter
        projection={projection}
        page={totalPages}
        total={totalPages}
      />
    </section>
  ) : null;
  return createPortal(
    <div className="customer-quotation__scrim" role="presentation">
      <section
        className="customer-quotation__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-quotation-title"
      >
        <div className="customer-quotation__controls no-print">
          <div>
            <strong id="customer-quotation-title">Customer Estimate Preview</strong>
            <small>Saved Project Costing · customer-safe preview</small>
          </div>
          <label>
            Document style
            <select
              aria-label="Document style"
              className="ui-input"
              value={template}
              onChange={(event) =>
                setTemplate(event.currentTarget.value as DocumentTemplate)
              }
            >
              <option value="technical_schedule">Technical Schedule</option>
              <option value="customer_quotation">Customer Estimate</option>
            </select>
          </label>
          <label>
            Thermal
            <select
              aria-label="Thermal display"
              className="ui-input"
              value={options.thermalPerformance}
              onChange={(event) => { const thermalPerformance = event.currentTarget.value as CustomerQuotationDisplayOptions["thermalPerformance"]; setOptions((current) => ({ ...current, thermalPerformance })); }}
            >
              <option value="full">Full</option>
              <option value="compact">Compact</option>
              <option value="hide">Hide</option>
            </select>
          </label>
          <label>
            Section Details
            <select
              aria-label="Section details display"
              className="ui-input"
              value={options.sectionDetails}
              onChange={(event) => { const sectionDetails = event.currentTarget.value as CustomerQuotationDisplayOptions["sectionDetails"]; setOptions((current) => ({ ...current, sectionDetails })); }}
            >
              <option value="show">Show</option>
              <option value="hide">Hide</option>
            </select>
          </label>
          <div>
            <button className="ui-button" onClick={onClose}>
              Close
            </button>
            <button
              className="ui-button"
              disabled={!projection||issueBusy||issuedEvidence}
              onClick={() => void prepareForSend()}
            >
              {activeAction==="prepare"?"Preparing Email…":issuedEvidence?"Estimate issued":"Send to Client"}
            </button>
            <button
              className="ui-button ui-button--primary"
              disabled={!projection||issueBusy}
              onClick={() => void downloadProductionPdf()}
            >
              {activeAction==="download" ? "Preparing PDF…" : "Download PDF"}
            </button>
          </div>
        </div>
        {projection&&!projection.commercialTerms.reviewed?<section className="customer-quotation__terms-notice no-print" role="status"><div><strong>Review validity, terms and exclusions</strong><span>Confirm the customer-facing basis once for this Estimate before downloading or preparing an Email.</span></div><button type="button" className="ui-button ui-button--primary" onClick={()=>setTermsOpen(true)}>Review terms</button></section>:projection?<section className="customer-quotation__terms-notice no-print" role="status"><div><strong>Customer terms reviewed</strong><span>Valid for {projection.commercialTerms.validityDays} days · {projection.commercialTerms.terms.length} term(s) · {projection.commercialTerms.exclusions.length} exclusion(s){termsLocked?" · locked to issued evidence":""}</span></div><button type="button" className="ui-button" disabled={issueBusy} onClick={()=>setTermsOpen(true)}>{termsLocked?"View terms":"Review terms"}</button></section>:null}
        {termsOpen?<section className="customer-quotation__terms-editor no-print" aria-label="Estimate validity, terms and exclusions"><div><strong>Customer Estimate basis</strong><span>{termsLocked?"These terms are part of the immutable issued Estimate. Create a new Estimate revision to change them.":"Use one line for each term or exclusion. Blank lists are allowed when deliberately confirmed."}</span></div><label>Valid for (days)<input className="ui-input" type="number" min="1" max="365" value={validityDays} disabled={termsBusy||termsLocked} onChange={event=>setValidityDays(event.currentTarget.value)}/></label><label>Terms<textarea className="ui-input" rows={4} value={termsText} disabled={termsBusy||termsLocked} onChange={event=>setTermsText(event.currentTarget.value)}/></label><label>Exclusions<textarea className="ui-input" rows={4} value={exclusionsText} disabled={termsBusy||termsLocked} onChange={event=>setExclusionsText(event.currentTarget.value)}/></label>{termsError?<p role="alert" className="customer-quotation__error">{termsError}</p>:null}<div className="ui-action-row"><button type="button" className="ui-button" disabled={termsBusy} onClick={()=>setTermsOpen(false)}>{termsLocked?"Close":"Keep current"}</button>{!termsLocked?<button type="button" className="ui-button ui-button--primary" disabled={termsBusy} onClick={()=>void saveTerms()}>{termsBusy?"Saving terms…":"Confirm for this Estimate"}</button>:null}</div></section>:null}
        {downloadResult?<section className="customer-quotation__result no-print" role="status"><strong>PDF downloaded</strong><span>{downloadResult.fileName} · {Math.ceil(downloadResult.sizeBytes/1024)} KB</span><span>Next: review the saved PDF. This download did not issue or Email the Estimate.</span></section>:null}
        {issuePreparation ? <section className="customer-quotation__issue-preparation customer-quotation__email-composer no-print" role="status"><div className="customer-quotation__email-evidence"><strong>{issuePreparation.lifecycleStatus==="withdrawn"?"Estimate withdrawn":issuePreparation.lifecycleStatus==="superseded"?"Earlier Estimate superseded":issuePreparation.status==="issued"?"Estimate sent successfully":issuePreparation.status==="failed"?"Estimate was not sent":"Email ready to review"}</strong>{issuePreparation.lifecycleStatus==="withdrawn"?<span>This issued evidence is preserved, but the offer is no longer available for customer action. Next: create and review a new Estimate revision if a replacement is needed.</span>:issuePreparation.lifecycleStatus==="superseded"?<span>A newer issued Estimate revision replaced this offer. This PDF remains available as immutable history.</span>:issuePreparation.status==="issued"?<span>{issuePreparation.document?.fileName||"Estimate PDF"} was sent to {issuePreparation.recipient}.{issuePreparation.followUp?` Follow Up is due ${new Date(`${issuePreparation.followUp.dueDate}T00:00:00`).toLocaleDateString("en-GB")}.`:""}</span>:issuePreparation.status==="failed"?<span>The PDF and Email draft are still saved. Review the error, correct the details and retry safely.</span>:<span>Nothing has been sent. Check the recipient, subject, message and PDF, then use the primary Send action.</span>}{issuePreparation.document?<a href={issuePreparation.document.downloadUrl} target="_blank" rel="noreferrer">Open {issuePreparation.document.fileName}</a>:null}<details><summary>View details</summary><span>Estimate revision {issuePreparation.estimateRevision} · quotation revision {issuePreparation.quotationRevision}</span>{issuePreparation.issuedAt?<span>Provider confirmed {new Date(issuePreparation.issuedAt).toLocaleString()} · message {issuePreparation.providerMessageId}</span>:null}{issuePreparation.lifecycle?.reason?<span>{issuePreparation.lifecycle.reason}</span>:null}</details>{issuePreparation.status==="issued"&&issuePreparation.lifecycleStatus==="issued"?<button type="button" className="ui-button ui-button--ghost" disabled={issueBusy} onClick={()=>setWithdrawOpen(true)}>Withdraw Estimate</button>:null}</div>{issuePreparation.status!=="issued"?<div className="customer-quotation__email-fields"><label>To<input className="ui-input" type="email" value={issueRecipient} disabled={issueBusy} onChange={event=>setIssueRecipient(event.currentTarget.value)}/></label><label>Subject<input className="ui-input" value={issueSubject} disabled={issueBusy} onChange={event=>setIssueSubject(event.currentTarget.value)}/></label><label>Message<textarea className="ui-input" rows={8} value={issueBody} disabled={issueBusy} onChange={event=>setIssueBody(event.currentTarget.value)}/></label><div className="ui-action-row"><button type="button" className="ui-button" disabled={issueBusy} onClick={()=>setIssuePreparation(null)}>Close</button><button type="button" className="ui-button ui-button--primary" disabled={issueBusy||!issueRecipient.trim()||!issueSubject.trim()||!issueBody.trim()} onClick={()=>void sendPrepared()}>{activeAction==="send"?"Sending Estimate…":"Send Estimate"}</button></div></div>:null}</section> : null}
        {withdrawOpen&&issuePreparation?.lifecycleStatus==="issued"?<section className="customer-quotation__terms-editor no-print" aria-label="Withdraw issued Estimate"><div><strong>Withdraw this customer offer?</strong><span>The issued PDF and delivery evidence will be kept. The customer will no longer be able to view or act on this offer.</span></div><label>Reason<textarea className="ui-input" rows={3} maxLength={500} value={withdrawReason} disabled={issueBusy} onChange={event=>setWithdrawReason(event.currentTarget.value)} placeholder="Explain why this offer is no longer current"/></label><div className="ui-action-row"><button type="button" className="ui-button" disabled={issueBusy} onClick={()=>setWithdrawOpen(false)}>Keep issued</button><button type="button" className="ui-button ui-button--danger" disabled={issueBusy||!withdrawReason.trim()} onClick={()=>void withdrawIssued()}>{activeAction==="withdraw"?"Withdrawing Estimate…":"Confirm withdrawal"}</button></div></section>:null}
        {issueError?<p role="alert" className="customer-quotation__error no-print">{issueError}</p>:null}
        {error ? (
          <p role="alert" className="customer-quotation__error">
            {error}
          </p>
        ) : null}
        {!projection && !error ? (
          <p className="customer-quotation__loading">
            Loading saved commercial revision…
          </p>
        ) : null}
        {projection ? (
          <article
            className={`customer-quotation__print-root customer-quotation__print-root--${template.replace("_", "-")}`}
            data-document-template={template}
            data-thermal-mode={options.thermalPerformance}
            data-section-details={options.sectionDetails}
            style={style}
          >
            <EstimateCover projection={projection} />
            {projection.productShowcases.length ? <ProductsInEstimate projection={projection} page={2} total={totalPages} /> : null}
            <SpecificationOverview projection={projection} page={projection.productShowcases.length ? 3 : 2} total={totalPages} />
            {pages.map((page, index) => (
              <section
                className={`customer-quotation-page${page.wide ? " customer-quotation-page--wide" : ""}`}
                key={page.positions.map((item) => item.id).join("-")}
              >
                <PageHeader projection={projection} />
                <main>
                  {page.positions.map((position) => (
                    <CustomerQuotationPositionCard
                      key={position.id}
                      position={position}
                      options={options}
                      wide={page.wide}
                      PositionPreview={PositionPreview}
                    />
                  ))}
                </main>
                <PageFooter
                  projection={projection}
                  page={index + frontMatterPages + 1}
                  total={totalPages}
                />
              </section>
            ))}
            {summary}
          </article>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}
