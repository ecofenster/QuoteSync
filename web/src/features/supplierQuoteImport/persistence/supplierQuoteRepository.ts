import type { JsonValue, ValidationIssue, ValidationResult } from "../../commercial/domain/commercial.types";
import type { EstimateId } from "../../../models/types";
import { isValidDecimalString } from "../../commercial/domain/commercial.validation";
import { parseJson, requireEstimate, requireValid, stringifyJson, withSqliteTransaction, type SqliteDatabase } from "../../commercial/persistence/sqlitePersistence";
import { canTransitionSupplierQuoteRevision, isTerminalImportRunStatus } from "../domain/supplierQuote.lifecycle";
import type {
  ProposedPositionMatch, SupplierQuote, SupplierQuoteAttachment, SupplierQuoteExtra,
  SupplierQuoteImportRun, SupplierQuotePosition, SupplierQuoteReviewDecision,
  SupplierQuoteRevision, SupplierSpecificationItem,
} from "../domain/supplierQuote.types";
import {
  validateProposedPositionMatch, validateSupplierQuote, validateSupplierQuoteAttachment,
  validateSupplierQuoteExtra, validateSupplierQuoteImportRun, validateSupplierQuotePosition,
  validateSupplierQuoteReviewDecision, validateSupplierQuoteRevision,
  validateSupplierSpecificationItem,
} from "../domain/supplierQuote.validation";

type Row = Record<string, unknown>;
type ApplicationAction = "include_as_new_position" | "map_to_existing_position" | "replace_existing_position" | "exclude" | "comparison_only" | "deferred";
export type SupplierPositionApplication = Readonly<{
  id: string; estimateId: string; supplierQuoteId: string; supplierQuoteRevisionId: string;
  supplierQuotePositionId: string; action: ApplicationAction; targetEstimatePositionId: string | null;
  appliedAt: string; appliedBy: string; active: boolean; supersededByApplicationId: string | null;
  note: string | null; createdAt: string;
}>;

function validation(issues: ValidationIssue[]): ValidationResult { return { valid: issues.length === 0, issues }; }
function required(value: unknown, path: string, issues: ValidationIssue[]) {
  if (typeof value !== "string" || !value.trim()) issues.push({ code: "required", path, message: `${path} is required.` });
}
export function validateSupplierPositionApplication(value: SupplierPositionApplication, enforceAppliedTarget = false): ValidationResult {
  const issues: ValidationIssue[] = [];
  required(value.id, "id", issues); required(value.estimateId, "estimateId", issues);
  required(value.supplierQuoteId, "supplierQuoteId", issues); required(value.supplierQuoteRevisionId, "supplierQuoteRevisionId", issues);
  required(value.supplierQuotePositionId, "supplierQuotePositionId", issues); required(value.appliedBy, "appliedBy", issues);
  if (["exclude", "comparison_only", "deferred"].includes(value.action) && value.targetEstimatePositionId) {
    issues.push({ code: "application.target_forbidden", path: "targetEstimatePositionId", message: "This action cannot target a canonical position." });
  }
  if (enforceAppliedTarget && ["map_to_existing_position", "replace_existing_position"].includes(value.action) && !value.targetEstimatePositionId) {
    issues.push({ code: "application.target_required", path: "targetEstimatePositionId", message: "Applied mapping/replacement requires a target position." });
  }
  return validation(issues);
}

function moneyAmount(value: { amount: string } | null): string | null { return value?.amount ?? null; }
function booleanValue(value: unknown): boolean { return Number(value) === 1; }

export function mapSupplierQuoteRow(row: Row): SupplierQuote {
  return { id: String(row.id), estimateId: String(row.estimate_id) as EstimateId, supplierCode: String(row.supplier_code), supplierName: String(row.supplier_name), createdAt: String(row.created_at), updatedAt: String(row.updated_at), archivedAt: row.archived_at == null ? null : String(row.archived_at) };
}
export function mapSupplierQuoteRevisionRow(row: Row): SupplierQuoteRevision {
  const currency = String(row.currency);
  const money = (amount: unknown) => amount == null ? null : { amount: String(amount), currency };
  return { id: String(row.id), supplierQuoteId: String(row.supplier_quote_id), estimateId: String(row.estimate_id) as EstimateId, revisionSequence: Number(row.revision_sequence), supplierQuotationNumber: String(row.supplier_quotation_number), supplierRevision: row.supplier_revision == null ? null : String(row.supplier_revision), fullQuotationReference: String(row.full_quotation_reference), quotationDate: row.quotation_date == null ? null : String(row.quotation_date), supplierCustomer: row.supplier_customer == null ? null : String(row.supplier_customer), projectReference: row.project_reference == null ? null : String(row.project_reference), customerReference: row.customer_reference == null ? null : String(row.customer_reference), currency, vatStatus: String(row.vat_status) as SupplierQuoteRevision["vatStatus"], productSubtotal: money(row.product_subtotal_amount), extrasTotal: money(row.extras_total_amount), deliveryTotal: money(row.delivery_total_amount), vatTotal: money(row.vat_total_amount), finalSupplierTotal: money(row.final_supplier_total_amount), lifecycleStatus: String(row.lifecycle_status) as SupplierQuoteRevision["lifecycleStatus"], isLatest: row.superseded_by_revision_id == null && row.lifecycle_status !== "archived", createdAt: String(row.created_at), supersededAt: row.superseded_at == null ? null : String(row.superseded_at), supersededByRevisionId: row.superseded_by_revision_id == null ? null : String(row.superseded_by_revision_id) };
}
export function mapSupplierQuoteAttachmentRow(row: Row): SupplierQuoteAttachment {
  return { id: String(row.id), estimateId: String(row.estimate_id) as EstimateId, revisionId: String(row.revision_id), role: String(row.role) as SupplierQuoteAttachment["role"], documentKind: String(row.document_kind || "complete_quotation") as SupplierQuoteAttachment["documentKind"], originalFileName: String(row.original_file_name), mediaType: String(row.media_type), sizeBytes: Number(row.size_bytes), sha256: String(row.sha256), storageKey: String(row.storage_key), parserEligible: booleanValue(row.parser_eligible), uploadedBy: String(row.uploaded_by || "local-admin"), uploadOrder: Number(row.upload_order || 0), createdAt: String(row.created_at), derivedFromAttachmentId: row.derived_from_attachment_id == null ? null : String(row.derived_from_attachment_id), artifactType: row.artifact_type == null ? null : String(row.artifact_type) as SupplierQuoteAttachment["artifactType"], extractorVersion: row.extractor_version == null ? null : String(row.extractor_version) };
}

async function revisionCurrency(db: SqliteDatabase, estimateId: string, revisionId: string): Promise<string> {
  const row = await db.get<{ currency: string }>("SELECT currency FROM supplier_quote_revisions WHERE id = ? AND estimate_id = ?", revisionId, estimateId);
  if (!row) throw new Error("Supplier revision ownership check failed.");
  return row.currency;
}

export function createSupplierQuoteRepository(db: SqliteDatabase) {
  async function createQuote(quote: SupplierQuote): Promise<SupplierQuote> {
    requireValid(validateSupplierQuote(quote)); await requireEstimate(db, quote.estimateId);
    await db.run("INSERT INTO supplier_quotes (id, estimate_id, supplier_code, supplier_name, created_at, updated_at, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?)", quote.id, quote.estimateId, quote.supplierCode, quote.supplierName, quote.createdAt, quote.updatedAt, quote.archivedAt);
    return quote;
  }
  async function getQuote(estimateId: string, quoteId: string): Promise<SupplierQuote | null> {
    const row = await db.get<Row>("SELECT * FROM supplier_quotes WHERE id = ? AND estimate_id = ?", quoteId, estimateId);
    return row ? mapSupplierQuoteRow(row) : null;
  }
  async function listQuotes(estimateId: string): Promise<SupplierQuote[]> {
    const rows = await db.all<Row[]>("SELECT * FROM supplier_quotes WHERE estimate_id = ? ORDER BY created_at, rowid", estimateId);
    return rows.map(mapSupplierQuoteRow);
  }
  async function setQuoteArchived(estimateId: string, quoteId: string, archivedAt: string | null): Promise<void> {
    const result = await db.run("UPDATE supplier_quotes SET archived_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND estimate_id = ?", archivedAt, quoteId, estimateId);
    if (!result.changes) throw new Error("Supplier quote ownership check failed.");
  }
  async function createRevision(revision: SupplierQuoteRevision): Promise<SupplierQuoteRevision> {
    requireValid(validateSupplierQuoteRevision(revision));
    if (!(await getQuote(revision.estimateId, revision.supplierQuoteId))) throw new Error("Supplier quote ownership check failed.");
    await db.run(`INSERT INTO supplier_quote_revisions (id,supplier_quote_id,estimate_id,revision_sequence,supplier_quotation_number,supplier_revision,full_quotation_reference,quotation_date,supplier_customer,project_reference,customer_reference,currency,vat_status,product_subtotal_amount,extras_total_amount,delivery_total_amount,vat_total_amount,final_supplier_total_amount,lifecycle_status,created_at,superseded_at,superseded_by_revision_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, revision.id, revision.supplierQuoteId, revision.estimateId, revision.revisionSequence, revision.supplierQuotationNumber, revision.supplierRevision, revision.fullQuotationReference, revision.quotationDate, revision.supplierCustomer, revision.projectReference, revision.customerReference, revision.currency, revision.vatStatus, moneyAmount(revision.productSubtotal), moneyAmount(revision.extrasTotal), moneyAmount(revision.deliveryTotal), moneyAmount(revision.vatTotal), moneyAmount(revision.finalSupplierTotal), revision.lifecycleStatus, revision.createdAt, revision.supersededAt, revision.supersededByRevisionId);
    return revision;
  }
  async function createQuoteWithFirstRevision(quote: SupplierQuote, revision: SupplierQuoteRevision): Promise<void> {
    if (revision.supplierQuoteId !== quote.id || revision.estimateId !== quote.estimateId) throw new Error("Quote/revision ownership mismatch.");
    await withSqliteTransaction(db, async () => { await createQuote(quote); await createRevision(revision); });
  }
  async function getRevision(estimateId: string, quoteId: string, revisionId: string): Promise<SupplierQuoteRevision | null> {
    const row = await db.get<Row>("SELECT * FROM supplier_quote_revisions WHERE id = ? AND supplier_quote_id = ? AND estimate_id = ?", revisionId, quoteId, estimateId);
    return row ? mapSupplierQuoteRevisionRow(row) : null;
  }
  async function listRevisions(estimateId: string, quoteId: string): Promise<SupplierQuoteRevision[]> {
    const rows = await db.all<Row[]>("SELECT * FROM supplier_quote_revisions WHERE supplier_quote_id = ? AND estimate_id = ? ORDER BY revision_sequence", quoteId, estimateId);
    return rows.map(mapSupplierQuoteRevisionRow);
  }
  async function transitionRevision(estimateId: string, revisionId: string, lifecycleStatus: SupplierQuoteRevision["lifecycleStatus"]): Promise<void> {
    const row = await db.get<{ lifecycle_status: SupplierQuoteRevision["lifecycleStatus"] }>("SELECT lifecycle_status FROM supplier_quote_revisions WHERE id = ? AND estimate_id = ?", revisionId, estimateId);
    if (!row || !canTransitionSupplierQuoteRevision(row.lifecycle_status, lifecycleStatus) || lifecycleStatus === "superseded") throw new Error("Invalid explicit revision lifecycle transition.");
    await db.run("UPDATE supplier_quote_revisions SET lifecycle_status = ? WHERE id = ? AND estimate_id = ?", lifecycleStatus, revisionId, estimateId);
  }
  async function supersedeRevision(estimateId: string, previousId: string, nextId: string, supersededAt: string): Promise<void> {
    await withSqliteTransaction(db, async () => {
      const rows = await db.all<Array<{ id: string; supplier_quote_id: string; lifecycle_status: SupplierQuoteRevision["lifecycleStatus"] }>>("SELECT id,supplier_quote_id,lifecycle_status FROM supplier_quote_revisions WHERE estimate_id = ? AND id IN (?,?)", estimateId, previousId, nextId);
      if (rows.length !== 2 || rows[0].supplier_quote_id !== rows[1].supplier_quote_id) throw new Error("Supersession requires two revisions owned by one estimate and quote.");
      const previous = rows.find((row) => row.id === previousId);
      if (!previous || !canTransitionSupplierQuoteRevision(previous.lifecycle_status, "superseded")) throw new Error("Revision cannot be superseded from its current lifecycle.");
      await db.run("UPDATE supplier_quote_revisions SET lifecycle_status='superseded', superseded_at=?, superseded_by_revision_id=? WHERE id=? AND estimate_id=?", supersededAt, nextId, previousId, estimateId);
    });
  }
  async function createAttachment(attachment: SupplierQuoteAttachment): Promise<SupplierQuoteAttachment> {
    requireValid(validateSupplierQuoteAttachment(attachment));
    if (attachment.storageKey.replaceAll("\\", "/").split("/").includes("..")) throw new Error("Attachment storage key traversal is forbidden.");
    await revisionCurrency(db, attachment.estimateId, attachment.revisionId);
    await db.run(`INSERT INTO supplier_quote_attachments (id,estimate_id,revision_id,role,document_kind,original_file_name,media_type,size_bytes,sha256,storage_key,parser_eligible,uploaded_by,upload_order,created_at,derived_from_attachment_id,artifact_type,extractor_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, attachment.id, attachment.estimateId, attachment.revisionId, attachment.role, attachment.documentKind ?? "complete_quotation", attachment.originalFileName, attachment.mediaType, attachment.sizeBytes, attachment.sha256, attachment.storageKey, attachment.parserEligible ? 1 : 0, attachment.uploadedBy ?? "local-admin", attachment.uploadOrder ?? 0, attachment.createdAt, attachment.derivedFromAttachmentId, attachment.artifactType, attachment.extractorVersion);
    return attachment;
  }
  async function createRevisionWithAttachments(revision: SupplierQuoteRevision, attachments: SupplierQuoteAttachment[]): Promise<void> {
    if (attachments.some((item) => item.estimateId !== revision.estimateId || item.revisionId !== revision.id)) throw new Error("Revision/attachment ownership mismatch.");
    await withSqliteTransaction(db, async () => { await createRevision(revision); for (const item of attachments) await createAttachment(item); });
  }
  async function listAttachments(estimateId: string, revisionId: string): Promise<SupplierQuoteAttachment[]> {
    const rows = await db.all<Row[]>("SELECT * FROM supplier_quote_attachments WHERE estimate_id=? AND revision_id=? ORDER BY upload_order,rowid", estimateId, revisionId);
    return rows.map(mapSupplierQuoteAttachmentRow);
  }
  async function createImportRun(run: SupplierQuoteImportRun, roles: readonly string[] = []): Promise<void> {
    requireValid(validateSupplierQuoteImportRun(run)); await revisionCurrency(db, run.estimateId, run.revisionId);
    await withSqliteTransaction(db, async () => {
      const placeholders = run.attachmentIds.map(() => "?").join(",");
      const owned = await db.all<Array<{ id: string }>>(`SELECT id FROM supplier_quote_attachments WHERE estimate_id=? AND revision_id=? AND id IN (${placeholders})`, run.estimateId, run.revisionId, ...run.attachmentIds);
      if (owned.length !== new Set(run.attachmentIds).size) throw new Error("Import attachments must belong to the estimate and revision.");
      await db.run(`INSERT INTO supplier_quote_import_runs (id,estimate_id,revision_id,extractor_name,extractor_version,adapter_code,adapter_version,recognition_version,started_at,completed_at,status,warnings_json,error_code,error_message,raw_result_attachment_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, run.id, run.estimateId, run.revisionId, run.extractorName, run.extractorVersion, run.adapterCode, run.adapterVersion, run.recognitionVersion, run.startedAt, run.completedAt, run.status, stringifyJson(run.warnings), run.errorCode, run.errorMessage, run.rawResultAttachmentId);
      for (const [ordinal, attachmentId] of run.attachmentIds.entries()) await db.run("INSERT INTO supplier_quote_import_run_attachments (import_run_id,attachment_id,ordinal,role) VALUES (?,?,?,?)", run.id, attachmentId, ordinal, roles[ordinal] ?? "source");
    });
  }
  async function completeImportRun(estimateId: string, runId: string, status: SupplierQuoteImportRun["status"], completedAt: string, warnings: string[], errorCode: string | null, errorMessage: string | null): Promise<void> {
    if (!isTerminalImportRunStatus(status) || (status === "failed" && !errorCode && !errorMessage)) throw new Error("Invalid terminal import-run state.");
    const result = await db.run("UPDATE supplier_quote_import_runs SET status=?,completed_at=?,warnings_json=?,error_code=?,error_message=? WHERE id=? AND estimate_id=?", status, completedAt, stringifyJson(warnings), errorCode, errorMessage, runId, estimateId);
    if (!result.changes) throw new Error("Import-run ownership check failed.");
  }
  async function createPosition(position: SupplierQuotePosition): Promise<void> {
    requireValid(validateSupplierQuotePosition(position));
    const currency = await revisionCurrency(db, position.estimateId, position.revisionId);
    for (const money of [position.unitPurchasePrice, position.totalPurchasePrice]) if (money && money.currency !== currency) throw new Error("Supplier position currency must match its revision.");
    await db.run(`INSERT INTO supplier_quote_positions (id,estimate_id,revision_id,source_sequence,classification,included_in_supplier_total,alternative_to_reference,classification_evidence,display_reference,supplier_reference_tokens_json,quantity,product,product_system,original_specification_text,width_mm,height_mm,supplier_area_square_metres,calculated_area_square_metres,unit_purchase_price_amount,total_purchase_price_amount,currency,supplier_drawing_attachment_id,opening_direction,view_direction,proposed_window_type_id,proposed_proof_family_id,recognition_confidence,recognition_reasons_json,source_pages_json,trace_json,review_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, position.id, position.estimateId, position.revisionId, position.sourceSequence??0, position.classification??"standard", position.includedInSupplierTotal===false?0:1, position.alternativeToReference??null, position.classificationEvidence??null, position.displayReference, stringifyJson(position.supplierReferenceTokens), position.quantity, position.product, position.productSystem, position.originalSpecificationText, position.widthMm, position.heightMm, position.supplierAreaSquareMetres, position.calculatedAreaSquareMetres, moneyAmount(position.unitPurchasePrice), moneyAmount(position.totalPurchasePrice), position.unitPurchasePrice?.currency ?? position.totalPurchasePrice?.currency ?? null, position.supplierDrawingAttachmentId, position.openingDirection, position.viewDirection, position.proposedWindowTypeId, position.proposedProofFamilyId, position.recognitionConfidence, stringifyJson(position.recognitionReasons), stringifyJson(position.sourcePages), stringifyJson(position.trace), position.reviewStatus);
  }
  async function createSpecification(item: SupplierSpecificationItem): Promise<void> {
    requireValid(validateSupplierSpecificationItem(item));
    await db.run("INSERT INTO supplier_specification_items (id,supplier_position_id,ordinal,supplied_number,original_text,normalized_label,normalized_value,trace_json) VALUES (?,?,?,?,?,?,?,?)", item.id, item.supplierPositionId, item.ordinal, item.suppliedNumber, item.originalText, item.normalizedLabel, item.normalizedValue, stringifyJson(item.trace));
  }
  async function replaceDraftSpecifications(estimateId: string, positionId: string, items: SupplierSpecificationItem[]): Promise<void> {
    const position = await db.get<{ review_status: SupplierQuotePosition["reviewStatus"] }>("SELECT review_status FROM supplier_quote_positions WHERE id=? AND estimate_id=?", positionId, estimateId);
    if (!position || !["unreviewed", "deferred"].includes(position.review_status)) throw new Error("Only an unapproved extraction draft may replace specifications.");
    if (items.some((item) => item.supplierPositionId !== positionId)) throw new Error("Specification ownership mismatch.");
    await withSqliteTransaction(db, async () => { await db.run("DELETE FROM supplier_specification_items WHERE supplier_position_id=?", positionId); for (const item of items) await createSpecification(item); });
  }
  async function createExtra(extra: SupplierQuoteExtra, extractionComplete = false): Promise<void> {
    requireValid(validateSupplierQuoteExtra(extra));
    const currency = await revisionCurrency(db, extra.estimateId, extra.revisionId);
    if (extractionComplete && !extra.totalPrice) throw new Error("Completed extraction extras require total price.");
    for (const money of [extra.unitPrice, extra.totalPrice]) if (money && money.currency !== currency) throw new Error("Supplier extra currency must match its revision.");
    await db.run("INSERT INTO supplier_quote_extras (id,estimate_id,revision_id,category,label,original_text,quantity,unit_price_amount,total_price_amount,currency,trace_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)", extra.id, extra.estimateId, extra.revisionId, extra.category, extra.label, extra.originalText, extra.quantity, moneyAmount(extra.unitPrice), moneyAmount(extra.totalPrice), currency, stringifyJson(extra.trace));
  }
  async function persistParsedRevision(estimateId: string, revisionId: string, positions: SupplierQuotePosition[], extras: SupplierQuoteExtra[]): Promise<void> {
    await withSqliteTransaction(db, async () => {
      for (const position of positions) { if (position.estimateId !== estimateId || position.revisionId !== revisionId) throw new Error("Parsed position ownership mismatch."); await createPosition({ ...position, specifications: [] }); for (const item of position.specifications) await createSpecification(item); }
      for (const extra of extras) { if (extra.estimateId !== estimateId || extra.revisionId !== revisionId) throw new Error("Parsed extra ownership mismatch."); await createExtra(extra, true); }
    });
  }
  async function listPositions(estimateId: string, revisionId: string): Promise<Array<Row & { supplierReferenceTokens: string[] }>> {
    const rows = await db.all<Row[]>("SELECT * FROM supplier_quote_positions WHERE estimate_id=? AND revision_id=? ORDER BY source_sequence,rowid", estimateId, revisionId);
    return rows.map((row) => ({ ...row, sourceSequence: Number(row.source_sequence), classification: String(row.classification), includedInSupplierTotal: booleanValue(row.included_in_supplier_total), alternativeToReference: row.alternative_to_reference == null ? null : String(row.alternative_to_reference), classificationEvidence: row.classification_evidence == null ? null : String(row.classification_evidence), supplierReferenceTokens: parseJson<string[]>(row.supplier_reference_tokens_json, []) }));
  }
  async function createProposal(proposal: ProposedPositionMatch, rank: number): Promise<void> {
    requireValid(validateProposedPositionMatch(proposal));
    await db.run(`INSERT INTO supplier_position_match_proposals (proposal_key,estimate_id,supplier_position_id,proposed_window_type_id,proposed_proof_family_id,score,confidence,reasons_json,normalized_evidence_json,recognition_version,created_at,supported_by_production_manifest,blocking_issues_json,rank) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, proposal.proposalKey, proposal.estimateId, proposal.supplierPositionId, proposal.proposedWindowTypeId, proposal.proposedProofFamilyId, proposal.score, proposal.confidence, stringifyJson(proposal.reasons), stringifyJson(proposal.normalizedEvidence), proposal.recognitionVersion, proposal.createdAt, proposal.supportedByProductionManifest ? 1 : 0, stringifyJson(proposal.blockingIssues), rank);
  }
  async function persistProposals(proposals: ReadonlyArray<{ proposal: ProposedPositionMatch; rank: number }>): Promise<void> {
    await withSqliteTransaction(db, async () => { for (const item of proposals) await createProposal(item.proposal, item.rank); });
  }
  async function appendReviewDecision(decision: SupplierQuoteReviewDecision): Promise<void> {
    requireValid(validateSupplierQuoteReviewDecision(decision));
    await db.run(`INSERT INTO supplier_quote_review_decisions (id,estimate_id,supplier_position_id,import_run_id,review_version,decision,selected_proposal_key,proposed_configuration_snapshot_json,approved_configuration_snapshot_json,resulting_position_id,resulting_contract_schema_version,reviewer_id,reviewed_at,note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, decision.id, decision.estimateId, decision.supplierPositionId, decision.importRunId, decision.reviewVersion, decision.decision, decision.selectedProposalKey, stringifyJson(decision.proposedConfigurationSnapshot), decision.approvedConfigurationSnapshot == null ? null : stringifyJson(decision.approvedConfigurationSnapshot), decision.resultingPositionId, decision.resultingContractSchemaVersion, decision.reviewerId, decision.reviewedAt, decision.note);
  }
  async function appendApplication(application: SupplierPositionApplication, enforceAppliedTarget = false): Promise<void> {
    requireValid(validateSupplierPositionApplication(application, enforceAppliedTarget));
    await withSqliteTransaction(db, async () => {
      const owned = await db.get<Row>(`SELECT p.id FROM supplier_quote_positions p JOIN supplier_quote_revisions r ON r.id=p.revision_id AND r.estimate_id=p.estimate_id WHERE p.id=? AND p.estimate_id=? AND r.id=? AND r.supplier_quote_id=?`, application.supplierQuotePositionId, application.estimateId, application.supplierQuoteRevisionId, application.supplierQuoteId);
      if (!owned) throw new Error("Application ownership chain is invalid.");
      const previous = await db.get<{ id: string }>("SELECT id FROM supplier_position_applications WHERE estimate_id=? AND supplier_quote_position_id=? AND active=1", application.estimateId, application.supplierQuotePositionId);
      await db.run(`INSERT INTO supplier_position_applications (id,estimate_id,supplier_quote_id,supplier_quote_revision_id,supplier_quote_position_id,action,target_estimate_position_id,applied_at,applied_by,active,superseded_by_application_id,note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, application.id, application.estimateId, application.supplierQuoteId, application.supplierQuoteRevisionId, application.supplierQuotePositionId, application.action, application.targetEstimatePositionId, application.appliedAt, application.appliedBy, previous ? 0 : application.active ? 1 : 0, application.supersededByApplicationId, application.note, application.createdAt);
      if (previous) {
        await db.run("UPDATE supplier_position_applications SET active=0,superseded_by_application_id=? WHERE id=? AND estimate_id=?", application.id, previous.id, application.estimateId);
        if (application.active) await db.run("UPDATE supplier_position_applications SET active=1 WHERE id=? AND estimate_id=?", application.id, application.estimateId);
      }
    });
  }
  return { createQuote, createQuoteWithFirstRevision, getQuote, listQuotes, archiveQuote: (e: string, q: string, at: string) => setQuoteArchived(e, q, at), restoreQuote: (e: string, q: string) => setQuoteArchived(e, q, null), createRevision, createRevisionWithAttachments, getRevision, listRevisions, transitionRevision, supersedeRevision, createAttachment, listAttachments, createImportRun, completeImportRun, createPosition, createSpecification, replaceDraftSpecifications, createExtra, persistParsedRevision, listPositions, createProposal, persistProposals, appendReviewDecision, appendApplication };
}

export function validateExactDecimalFields(values: Record<string, string | null>): ValidationResult {
  return validation(Object.entries(values).flatMap(([path, value]) => value != null && !isValidDecimalString(value) ? [{ code: "decimal.invalid", path, message: "Value must be exact decimal text." }] : []));
}
