import type { CommunicationDraft, CommunicationEntityLink } from "../communications/domain/communications";

export type WorkflowEventName =
  | "quotation.imported"
  | "costing.ready"
  | "quotation.reviewed"
  | "quotation.issued"
  | "followup.completed"
  | "customer.accepted"
  | "order.created"
  | "supplier.order.sent"
  | "supplier.confirmation.received";

export type WorkflowEvent = {
  name: WorkflowEventName;
  occurredAt: string;
  links: CommunicationEntityLink[];
  evidenceId?: string | null;
};

export type NextActionId = "import_manufacturer_quote" | "review_costing" | "review_customer_quotation" | "send_to_client" | "complete_follow_up" | "schedule_next_follow_up" | "prepare_order";

export type NextAction = {
  id: NextActionId;
  label: string;
  reason: string;
  critical: boolean;
};

export function deriveNextAction(state: {
  manufacturerQuoteImported: boolean;
  costingReady: boolean;
  quotationReviewed: boolean;
  quotationIssued: boolean;
  followUpDue: boolean;
  followUpCompleted: boolean;
  customerAccepted: boolean;
  orderCreated: boolean;
}): NextAction | null {
  if (!state.manufacturerQuoteImported) return { id: "import_manufacturer_quote", label: "Import Manufacturer Quote", reason: "No reviewed manufacturer quotation is linked to this Estimate.", critical: false };
  if (!state.costingReady) return { id: "review_costing", label: "Review Project Costing", reason: "Manufacturer evidence is available and commercial costing requires review.", critical: true };
  if (!state.quotationReviewed) return { id: "review_customer_quotation", label: "Review Customer Quotation", reason: "Costing is ready for customer-safe document review.", critical: false };
  if (!state.quotationIssued) return { id: "send_to_client", label: "Send to Client", reason: "The reviewed quotation is ready to be prepared for issue.", critical: true };
  if (state.followUpDue && !state.followUpCompleted) return { id: "complete_follow_up", label: "Complete Follow Up", reason: "The issued quotation follow-up is due.", critical: false };
  if (state.followUpCompleted && !state.customerAccepted) return { id: "schedule_next_follow_up", label: "Schedule Next Follow Up", reason: "Keep the Client and Estimate relationship when planning the next contact.", critical: false };
  if (state.customerAccepted && !state.orderCreated) return { id: "prepare_order", label: "Prepare Order", reason: "Customer acceptance must be converted from the immutable accepted quotation snapshot.", critical: true };
  return null;
}

export type QuotationIssuePreparation = {
  status: "prepared_not_sent";
  estimateId: string;
  estimateRevision: number;
  quotationRevision: number;
  preparedAt: string;
  commercialSnapshot: {
    subtotalExVatGbp: string;
    vatRatePercent: string;
    vatGbp: string;
    totalIncVatGbp: string;
  };
  document: { status: "pdf_required"; providerFileId: null };
  communication: CommunicationDraft;
};

export function prepareQuotationIssue(input: {
  estimateId: string;
  estimateRevision: number;
  quotationRevision: number;
  estimateReference: string;
  clientId: string;
  clientName: string;
  recipient: string;
  subtotalExVatGbp: string;
  vatRatePercent: string;
  vatGbp: string;
  totalIncVatGbp: string;
  preparedAt?: string;
}): QuotationIssuePreparation {
  const links: CommunicationEntityLink[] = [{ kind: "client", id: input.clientId }, { kind: "estimate", id: input.estimateId }];
  return {
    status: "prepared_not_sent",
    estimateId: input.estimateId,
    estimateRevision: input.estimateRevision,
    quotationRevision: input.quotationRevision,
    preparedAt: input.preparedAt ?? new Date().toISOString(),
    commercialSnapshot: { subtotalExVatGbp: input.subtotalExVatGbp, vatRatePercent: input.vatRatePercent, vatGbp: input.vatGbp, totalIncVatGbp: input.totalIncVatGbp },
    document: { status: "pdf_required", providerFileId: null },
    communication: {
      provider: null,
      mailboxId: null,
      to: input.recipient ? [input.recipient] : [],
      cc: [],
      bcc: [],
      subject: `Quotation ${input.estimateReference} from Ecofenster`,
      bodyHtml: `<p>Dear ${input.clientName},</p><p>Please find our quotation ${input.estimateReference} for your review.</p><p>Total including VAT: £${input.totalIncVatGbp}</p>`,
      attachments: [],
      links,
      status: "draft",
    },
  };
}

export type IssuedQuotationRecord = Readonly<{
  estimateId: string;
  estimateRevision: number;
  quotationRevision: number;
  documentId: string;
  recipient: string;
  issuedAt: string;
  communicationMessageId: string;
  commercialSnapshot: QuotationIssuePreparation["commercialSnapshot"];
  termsSnapshot: string;
}>;

export function recordIssuedQuotation(input: QuotationIssuePreparation & {
  documentId: string;
  communicationMessageId: string;
  issuedAt: string;
  termsSnapshot: string;
}): IssuedQuotationRecord {
  if (!input.documentId || !input.communicationMessageId || !input.issuedAt || !input.communication.to[0]) throw new Error("Issued quotation requires document, recipient, timestamp and communication evidence.");
  return Object.freeze({
    estimateId: input.estimateId,
    estimateRevision: input.estimateRevision,
    quotationRevision: input.quotationRevision,
    documentId: input.documentId,
    recipient: input.communication.to[0],
    issuedAt: input.issuedAt,
    communicationMessageId: input.communicationMessageId,
    commercialSnapshot: Object.freeze({ ...input.commercialSnapshot }),
    termsSnapshot: input.termsSnapshot,
  });
}

export function workflowEffects(event: WorkflowEvent): Array<Record<string, unknown>> {
  if (event.name === "quotation.issued") return [{ kind: "create_follow_up", dueInDays: 3, purpose: "Call / email customer regarding issued quotation", links: event.links }];
  if (event.name === "followup.completed") return [{ kind: "recommend_follow_up", defaultDueInDays: 7, allowChange: true, allowNone: true, links: event.links }];
  return [];
}
