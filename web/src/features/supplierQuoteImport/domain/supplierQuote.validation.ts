import { isValidCurrencyCode, isValidDecimalString, validateMoney } from "../../commercial/domain/commercial.validation";
import type { ValidationIssue, ValidationResult } from "../../commercial/domain/commercial.types";
import { isTerminalImportRunStatus } from "./supplierQuote.lifecycle";
import type {
  ProposedPositionMatch,
  SourceTrace,
  SupplierQuote,
  SupplierQuoteAttachment,
  SupplierQuoteExtra,
  SupplierQuoteImportRun,
  SupplierQuotePosition,
  SupplierQuoteReviewDecision,
  SupplierQuoteRevision,
  SupplierSpecificationItem,
} from "./supplierQuote.types";

function result(issues: ValidationIssue[]): ValidationResult {
  return { valid: issues.length === 0, issues };
}

function requiredString(value: unknown, path: string, issues: ValidationIssue[]) {
  if (typeof value !== "string" || !value.trim()) issues.push({ code: "required", path, message: `${path} is required.` });
}

function requireEstimateId(value: unknown, issues: ValidationIssue[]) {
  requiredString(value, "estimateId", issues);
}

function addMoneyIssues(issues: ValidationIssue[], moneyResult: ValidationResult) {
  issues.push(...moneyResult.issues);
}

export function validateSourceTrace(trace: SourceTrace, path = "trace"): ValidationResult {
  const issues: ValidationIssue[] = [];
  requiredString(trace.attachmentId, `${path}.attachmentId`, issues);
  if (trace.pageNumber != null && (!Number.isInteger(trace.pageNumber) || trace.pageNumber < 0)) {
    issues.push({ code: "trace.page.invalid", path: `${path}.pageNumber`, message: "Page number must be a non-negative integer." });
  }
  if (trace.characterRange && (trace.characterRange.start < 0 || trace.characterRange.end < trace.characterRange.start)) {
    issues.push({ code: "trace.range.invalid", path: `${path}.characterRange`, message: "Character range must be non-negative and ordered." });
  }
  if (trace.boundingBox) {
    const box = trace.boundingBox;
    if (!(box.width > 0) || !(box.height > 0)) issues.push({ code: "trace.box.size", path: `${path}.boundingBox`, message: "Bounding-box dimensions must be positive." });
    if (box.coordinateSpace === "normalized" && (box.x < 0 || box.y < 0 || box.x + box.width > 1 || box.y + box.height > 1)) {
      issues.push({ code: "trace.box.normalized", path: `${path}.boundingBox`, message: "Normalized bounding boxes must remain within 0..1." });
    }
  }
  return result(issues);
}

export function validateSupplierQuote(quote: SupplierQuote): ValidationResult {
  const issues: ValidationIssue[] = [];
  requireEstimateId(quote.estimateId, issues);
  requiredString(quote.id, "id", issues);
  requiredString(quote.supplierCode, "supplierCode", issues);
  requiredString(quote.supplierName, "supplierName", issues);
  return result(issues);
}

export function validateSupplierQuoteRevision(revision: SupplierQuoteRevision): ValidationResult {
  const issues: ValidationIssue[] = [];
  requireEstimateId(revision.estimateId, issues);
  requiredString(revision.id, "id", issues);
  requiredString(revision.supplierQuoteId, "supplierQuoteId", issues);
  if (!Number.isInteger(revision.revisionSequence) || revision.revisionSequence < 0) issues.push({ code: "revision.sequence", path: "revisionSequence", message: "Revision sequence must be a non-negative integer." });
  if (!isValidCurrencyCode(revision.currency)) issues.push({ code: "revision.currency", path: "currency", message: "Revision currency must be normalized." });
  const moneyFields = ["productSubtotal", "extrasTotal", "deliveryTotal", "vatTotal", "finalSupplierTotal"] as const;
  for (const field of moneyFields) {
    const money = revision[field];
    addMoneyIssues(issues, validateMoney(money, { path: field }));
    if (money && money.currency !== revision.currency) issues.push({ code: "revision.currency_mismatch", path: `${field}.currency`, message: "Money currency must match revision currency." });
  }
  const hasSupersession = revision.supersededAt != null || revision.supersededByRevisionId != null;
  if (revision.lifecycleStatus === "superseded" && (!revision.supersededAt || !revision.supersededByRevisionId)) issues.push({ code: "revision.supersession.required", path: "supersededByRevisionId", message: "Superseded revisions require time and successor ID." });
  if (revision.lifecycleStatus !== "superseded" && hasSupersession) issues.push({ code: "revision.supersession.status", path: "lifecycleStatus", message: "Supersession fields require superseded lifecycle status." });
  return result(issues);
}

export function validateSupplierQuoteAttachment(attachment: SupplierQuoteAttachment): ValidationResult {
  const issues: ValidationIssue[] = [];
  requireEstimateId(attachment.estimateId, issues);
  requiredString(attachment.revisionId, "revisionId", issues);
  requiredString(attachment.originalFileName, "originalFileName", issues);
  requiredString(attachment.mediaType, "mediaType", issues);
  requiredString(attachment.storageKey, "storageKey", issues);
  if (!Number.isInteger(attachment.sizeBytes) || attachment.sizeBytes < 0) issues.push({ code: "attachment.size", path: "sizeBytes", message: "Size must be a non-negative integer." });
  if (!/^[a-f0-9]{64}$/.test(attachment.sha256)) issues.push({ code: "attachment.sha256", path: "sha256", message: "SHA-256 must be 64 lowercase hexadecimal characters." });
  if (/^(?:[a-zA-Z]:[\\/]|[\\/]{1,2})/.test(attachment.storageKey)) issues.push({ code: "attachment.storage_key", path: "storageKey", message: "Storage key must not be an absolute path." });
  if (attachment.role === "derived_artifact" && !attachment.derivedFromAttachmentId) issues.push({ code: "attachment.derived_source", path: "derivedFromAttachmentId", message: "Derived artifacts require a source attachment." });
  if (attachment.role === "derived_artifact" && !attachment.artifactType) issues.push({ code: "attachment.artifact_type", path: "artifactType", message: "Derived artifacts require an artifact type." });
  if (attachment.role === "derived_artifact" && !attachment.extractorVersion?.trim()) issues.push({ code: "attachment.extractor_version", path: "extractorVersion", message: "Derived artifacts require an extractor version." });
  if (attachment.role !== "derived_artifact" && attachment.artifactType != null) issues.push({ code: "attachment.artifact_role", path: "artifactType", message: "Artifact type is reserved for derived artifacts." });
  return result(issues);
}

export function validateSupplierQuoteImportRun(run: SupplierQuoteImportRun): ValidationResult {
  const issues: ValidationIssue[] = [];
  requireEstimateId(run.estimateId, issues);
  requiredString(run.revisionId, "revisionId", issues);
  if (!run.attachmentIds.length) issues.push({ code: "import.attachments", path: "attachmentIds", message: "At least one attachment is required." });
  requiredString(run.extractorVersion, "extractorVersion", issues);
  requiredString(run.adapterVersion, "adapterVersion", issues);
  requiredString(run.recognitionVersion, "recognitionVersion", issues);
  if (isTerminalImportRunStatus(run.status) && !run.completedAt) issues.push({ code: "import.completed_at", path: "completedAt", message: "Terminal runs require completion time." });
  if (!isTerminalImportRunStatus(run.status) && run.completedAt) issues.push({ code: "import.nonterminal_completion", path: "completedAt", message: "Non-terminal runs cannot be completed." });
  if (run.status === "failed" && !run.errorCode && !run.errorMessage) issues.push({ code: "import.failure_error", path: "errorCode", message: "Failed runs require error information." });
  return result(issues);
}

export function validateSupplierSpecificationItem(item: SupplierSpecificationItem): ValidationResult {
  const issues: ValidationIssue[] = [];
  requiredString(item.supplierPositionId, "supplierPositionId", issues);
  if (!Number.isInteger(item.ordinal) || item.ordinal < 0) issues.push({ code: "spec.ordinal", path: "ordinal", message: "Ordinal must be a zero-based non-negative integer." });
  if (!item.originalText.length) issues.push({ code: "spec.original_text", path: "originalText", message: "Original text must be preserved and non-empty." });
  return result(issues);
}

export function validateSupplierQuotePosition(position: SupplierQuotePosition): ValidationResult {
  const issues: ValidationIssue[] = [];
  requireEstimateId(position.estimateId, issues);
  requiredString(position.revisionId, "revisionId", issues);
  requiredString(position.displayReference, "displayReference", issues);
  if (!Number.isInteger(position.quantity) || position.quantity <= 0) issues.push({ code: "position.quantity", path: "quantity", message: "Quantity must be a positive integer independent of token count." });
  if (position.recognitionConfidence != null && (position.recognitionConfidence < 0 || position.recognitionConfidence > 1)) issues.push({ code: "position.confidence", path: "recognitionConfidence", message: "Confidence must be between 0 and 1." });
  for (const [field, value] of [["supplierAreaSquareMetres", position.supplierAreaSquareMetres], ["calculatedAreaSquareMetres", position.calculatedAreaSquareMetres]] as const) {
    if (value != null && !isValidDecimalString(value)) issues.push({ code: "position.area", path: field, message: "Area must be a decimal string." });
  }
  addMoneyIssues(issues, validateMoney(position.unitPurchasePrice, { path: "unitPurchasePrice" }));
  addMoneyIssues(issues, validateMoney(position.totalPurchasePrice, { path: "totalPurchasePrice" }));
  if (position.unitPurchasePrice && position.totalPurchasePrice && position.unitPurchasePrice.currency !== position.totalPurchasePrice.currency) {
    issues.push({ code: "position.currency_mismatch", path: "totalPurchasePrice.currency", message: "Unit and total purchase prices must use the same supplier currency." });
  }
  position.specifications.forEach((item, index) =>
    issues.push(
      ...validateSupplierSpecificationItem(item).issues.map((issue) => ({
        ...issue,
        path: `specifications.${index}.${issue.path}`,
      }))
    )
  );
  position.trace.forEach((trace, index) => issues.push(...validateSourceTrace(trace, `trace.${index}`).issues));
  return result(issues);
}

export function validateSupplierQuoteExtra(extra: SupplierQuoteExtra): ValidationResult {
  const issues: ValidationIssue[] = [];
  requireEstimateId(extra.estimateId, issues);
  requiredString(extra.revisionId, "revisionId", issues);
  if (extra.quantity != null && !isValidDecimalString(extra.quantity)) issues.push({ code: "extra.quantity", path: "quantity", message: "Quantity must be a decimal string." });
  const allowNegative = extra.category === "discount";
  addMoneyIssues(issues, validateMoney(extra.unitPrice, { path: "unitPrice", allowNegative }));
  addMoneyIssues(issues, validateMoney(extra.totalPrice, { path: "totalPrice", allowNegative }));
  if (extra.unitPrice && extra.totalPrice && extra.unitPrice.currency !== extra.totalPrice.currency) {
    issues.push({ code: "extra.currency_mismatch", path: "totalPrice.currency", message: "Extra unit and total prices must use the same currency." });
  }
  return result(issues);
}

export function validateProposedPositionMatch(proposal: ProposedPositionMatch): ValidationResult {
  const issues: ValidationIssue[] = [];
  requireEstimateId(proposal.estimateId, issues);
  requiredString(proposal.supplierPositionId, "supplierPositionId", issues);
  requiredString(proposal.proposalKey, "proposalKey", issues);
  if (!Number.isFinite(proposal.score)) issues.push({ code: "proposal.score", path: "score", message: "Score must be finite." });
  if (proposal.confidence < 0 || proposal.confidence > 1) issues.push({ code: "proposal.confidence", path: "confidence", message: "Confidence must be between 0 and 1." });
  return result(issues);
}

export function validateSupplierQuoteReviewDecision(decision: SupplierQuoteReviewDecision): ValidationResult {
  const issues: ValidationIssue[] = [];
  requireEstimateId(decision.estimateId, issues);
  requiredString(decision.supplierPositionId, "supplierPositionId", issues);
  requiredString(decision.importRunId, "importRunId", issues);
  requiredString(decision.reviewVersion, "reviewVersion", issues);
  if ((decision.decision === "rejected" || decision.decision === "deferred") && (decision.resultingPositionId || decision.resultingContractSchemaVersion != null)) issues.push({ code: "review.result_forbidden", path: "resultingPositionId", message: "Rejected or deferred reviews cannot identify canonical results." });
  if (decision.decision === "accepted" && !decision.selectedProposalKey) issues.push({ code: "review.proposal_required", path: "selectedProposalKey", message: "Accepted reviews require a selected proposal." });
  return result(issues);
}
