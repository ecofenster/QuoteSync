import path from "node:path";
import { extractSupplierDocument } from "../supplierImportLab/documentExtraction.js";
import { parseCommercialFields } from "../supplierImportLab/commercialFieldParser.js";
import { derivePdfPositionPreviews } from "../supplierImportLab/pdfPositionPreviews.js";
import { readFileIntegrity, resolveAttachmentRoot, resolveManagedPath } from "../supplierQuotes/managedAttachmentStorage.js";

const asText = (value) => String(value ?? "").trim();
const parseJson = (value, fallback = {}) => {
  try { return JSON.parse(value ?? ""); } catch { return fallback; }
};

const sourceVisuals = (snapshot = {}) => {
  const evidence = snapshot.manufacturerEvidence || {};
  if (Array.isArray(evidence.sourceVisuals) && evidence.sourceVisuals.length) return evidence.sourceVisuals;
  if (Array.isArray(snapshot.sourceVisuals) && snapshot.sourceVisuals.length) return snapshot.sourceVisuals;
  return [evidence.sourceVisual || snapshot.sourceVisual].filter(Boolean);
};

const hasFrozenVisualEvidence = (snapshot) => sourceVisuals(snapshot).length > 0;
const needsMoreSpecificDrawingEvidence = (snapshot = {}) => sourceVisuals(snapshot).some((visual) =>
  visual?.sourceFormat === "pdf"
  && visual?.role === "combined_source"
  && visual?.mappingMethod === "pdf_position_region_geometry"
  && visual?.originalAsset?.attachmentId,
);
const needsRecoveredPositionEvidence = (snapshot = {}) => {
  const evidence = snapshot.manufacturerEvidence || {};
  return !asText(snapshot.glassSpecification || evidence.glassSpecification);
};
const needsRecoveredSpecificationEvidence = (snapshot = {}) => {
  const source = snapshot.sourceSpecification || {};
  const canonical = snapshot.canonicalSpecification || source.canonical || {};
  const systemThermal = canonical.systemThermalPerformance || {};
  return Boolean(systemThermal.value && systemThermal.basis && (!systemThermal.standardSizeMm || !systemThermal.qualification));
};
const attachmentAnalysisCache = new Map();
const MAX_CACHE_ENTRIES = 32;

function cacheResult(key, value) {
  if (attachmentAnalysisCache.size >= MAX_CACHE_ENTRIES) attachmentAnalysisCache.delete(attachmentAnalysisCache.keys().next().value);
  attachmentAnalysisCache.set(key, value);
  return value;
}

async function analyseLinkedAttachment(db, comparison, proposal, source, attachmentRoot) {
  const attachment = await db.get(`SELECT attachment.*,revision.currency
    FROM supplier_quote_attachments attachment
    JOIN supplier_quote_revisions revision ON revision.id=attachment.revision_id
    WHERE attachment.id=? AND attachment.estimate_id=? AND attachment.revision_id=?
      AND revision.supplier_quote_id=? AND revision.estimate_id=attachment.estimate_id`,
    source.supplierAttachmentId, comparison.baselineEstimateId, source.supplierRevisionId, source.supplierQuoteId);
  if (!attachment || attachment.role === "derived_artifact" || !attachment.parser_eligible) return new Map();
  const frozenSha = asText(source.sourceSnapshot?.sha256);
  if (frozenSha && frozenSha !== attachment.sha256) return new Map();
  const cacheKey = `${attachment.id}:${attachment.sha256}`;
  if (attachmentAnalysisCache.has(cacheKey)) return attachmentAnalysisCache.get(cacheKey);
  const filename = resolveManagedPath(attachment.storage_key, attachmentRoot);
  const integrity = await readFileIntegrity(filename);
  if (integrity.sha256 !== attachment.sha256 || integrity.sizeBytes !== attachment.size_bytes) return new Map();
  const extracted = await extractSupplierDocument(filename, {
    id: attachment.id,
    sha256: attachment.sha256,
    sessionId: comparison.baselineEstimateId,
    mediaType: attachment.media_type,
  }, { visualRoot: path.join(attachmentRoot, "manufacturer-position-visuals") });
  if (!extracted.textAvailable) return new Map();
  const fields = parseCommercialFields(extracted, { currency: attachment.currency || proposal.currency });
  await derivePdfPositionPreviews({
    filename,
    attachment,
    document: extracted,
    rows: fields.rows,
    visualRoot: path.join(attachmentRoot, "manufacturer-position-visuals"),
  });
  return cacheResult(cacheKey, new Map(fields.rows.map((row) => [
    `${attachment.id}:${row.ordinal}`,
    {
      sourceVisuals: row.manufacturerEvidence?.sourceVisuals || [],
      sourceVisual: row.manufacturerEvidence?.sourceVisual || row.sourceVisual || null,
      sourceSpecification: row.sourceSpecification || null,
      canonicalSpecification: row.canonicalSpecification || row.sourceSpecification?.canonical || null,
      sourceAttachmentId: attachment.id,
      sourceRevisionId: attachment.revision_id,
      sourceRowKey: `${attachment.id}:${row.ordinal}`,
    },
  ])));
}

function mergeCanonicalSpecification(frozen = {}, recovered = {}) {
  const result = { ...recovered, ...frozen };
  if (recovered.systemThermalPerformance || frozen.systemThermalPerformance) {
    result.systemThermalPerformance = { ...(recovered.systemThermalPerformance || {}), ...(frozen.systemThermalPerformance || {}) };
  }
  return result;
}

function withRecoveredEvidence(snapshot, recovered) {
  if (!recovered) return snapshot;
  const evidence = snapshot.manufacturerEvidence || {};
  const frozenSource = snapshot.sourceSpecification || {};
  const recoveredSource = recovered.sourceSpecification || {};
  const canonicalSpecification = mergeCanonicalSpecification(
    snapshot.canonicalSpecification || frozenSource.canonical || {},
    recovered.canonicalSpecification || recoveredSource.canonical || {},
  );
  const frozenVisuals = sourceVisuals(snapshot);
  const recoveredVisuals = sourceVisuals(recovered);
  const boundedInside = (inner, outer) => {
    const a = inner?.boundingRegion; const b = outer?.boundingRegion;
    return a && b && a.x >= b.x - 0.01 && a.y >= b.y - 0.01
      && a.x + a.width <= b.x + b.width + 0.01 && a.y + a.height <= b.y + b.height + 0.01;
  };
  const useRecoveredVisuals = !frozenVisuals.length || recoveredVisuals.some((visual) => {
    if (visual?.mappingReviewStatus !== "mapped_automatic" || visual?.role !== "position_drawing") return false;
    const recoveredAsset = visual.originalAsset || {};
    return frozenVisuals.some((frozen) => {
      const frozenAsset = frozen?.originalAsset || {};
      return frozenAsset.attachmentId === recoveredAsset.attachmentId
        && Number(frozenAsset.sourcePage) === Number(recoveredAsset.sourcePage)
        && boundedInside(recoveredAsset, frozenAsset);
    });
  });
  const preserveVisuals = !useRecoveredVisuals;
  const fittingsSpecification = [snapshot.fittingsSpecification, recovered.fittingsSpecification]
    .map(asText).filter((value, index, values) => value && values.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index).join(" · ") || null;
  return {
    ...snapshot,
    glassSpecification: asText(snapshot.glassSpecification) || recovered.glassSpecification || null,
    fittingsSpecification,
    sourceAttachmentId: recovered.sourceAttachmentId,
    sourceRevisionId: recovered.sourceRevisionId,
    sourceRowKey: recovered.sourceRowKey || snapshot.sourceRowKey || null,
    sourceSpecification: Object.keys(recoveredSource).length ? { ...recoveredSource, ...frozenSource, canonical: canonicalSpecification } : snapshot.sourceSpecification,
    canonicalSpecification,
    sourceVisuals: preserveVisuals ? snapshot.sourceVisuals : recovered.sourceVisuals,
    sourceVisual: preserveVisuals ? snapshot.sourceVisual : recovered.sourceVisual,
    manufacturerEvidence: {
      ...evidence,
      glassSpecification: asText(evidence.glassSpecification) || recovered.glassSpecification || null,
      fittingsSpecification: [evidence.fittingsSpecification, recovered.fittingsSpecification]
        .map(asText).filter((value, index, values) => value && values.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index).join(" · ") || null,
      sourceVisuals: preserveVisuals ? evidence.sourceVisuals : recovered.sourceVisuals,
      sourceVisual: preserveVisuals ? evidence.sourceVisual : recovered.sourceVisual,
    },
  };
}

function retainedTracePositionEvidence(row = {}) {
  const trace = parseJson(row.trace_json, []);
  if (!Array.isArray(trace) || !trace.length) return null;
  const glassHeading = trace.findIndex((item) => /^\s*5\.\s*Glass unit\s*:/i.test(asText(item?.extractedText)));
  const glassRows = glassHeading < 0 ? [] : trace.slice(glassHeading + 1).filter((item, index, items) => {
    const value = asText(item?.extractedText);
    const preceding = items.slice(0, index).some((candidate) => /^\s*\d+\.\s*/.test(asText(candidate?.extractedText)));
    return !preceding && /^\s*#\d+\s*:/i.test(value);
  });
  const handle = trace.find((item) => /(?:lockable|recessed|finger plate|handle).*(?:internal|external)|(?:internal|external).*(?:lockable|recessed|finger plate|handle)/i.test(asText(item?.extractedText)));
  if (!glassRows.length && !handle) return null;
  const glassSpecification = glassRows.map((item) => asText(item.extractedText)).join("; ") || null;
  const sourceFields = glassRows.map((item, ordinal) => ({
    id: `retained-trace:${asText(item.blockId) || `glass-${ordinal + 1}`}`,
    ordinal,
    section: "Position glass evidence",
    label: `Glass unit ${ordinal + 1}`,
    rawValue: asText(item.extractedText),
    sourcePage: Number.isInteger(Number(item.pageNumber)) ? Number(item.pageNumber) : null,
    evidenceClass: "explicit",
    confidence: "strong",
    reviewStatus: "mapped_automatic",
  }));
  const glazingUnits = glassRows.map((item, ordinal) => ({
    sourceElementReference: String(ordinal + 1),
    glassBuildUp: asText(item.extractedText).replace(/^\s*#\d+\s*:\s*/i, ""),
    sourceFieldIds: [sourceFields[ordinal].id],
  }));
  return {
    glassSpecification,
    fittingsSpecification: handle ? [asText(row.fittings_specification), asText(handle.extractedText).replace(/^\s*\d+\.\s*/, "")].filter(Boolean).join(" · ") : null,
    sourceSpecification: {
      version: "retained-supplier-position-trace-v1",
      sourceAttachmentId: trace.find((item) => item?.attachmentId)?.attachmentId || null,
      sourcePages: [...new Set(trace.map((item) => Number(item?.pageNumber)).filter(Number.isInteger))],
      sections: sourceFields.length ? [{ name: "Position glass evidence", fields: sourceFields }] : [],
      canonical: glassSpecification ? {
        glazing: { value: glassSpecification, manufacturerSourceValue: glassSpecification, sourceFieldId: sourceFields[0]?.id || null },
        glazingUnits,
      } : {},
    },
    canonicalSpecification: glassSpecification ? {
      glazing: { value: glassSpecification, manufacturerSourceValue: glassSpecification, sourceFieldId: sourceFields[0]?.id || null },
      glazingUnits,
    } : {},
  };
}

export async function hydrateLegacyComparisonDrawingEvidence(db, input, { attachmentRoot = resolveAttachmentRoot(), analyseAttachment = analyseLinkedAttachment } = {}) {
  if (!input?.id) return input;
  const comparison = structuredClone(input);
  const scenarioId = asText(comparison.baselineSnapshot?.customerCommercial?.scenarioId);
  if (scenarioId) {
    const rows = await db.all(`SELECT estimate_position_id,source_position_id,source_attachment_id,source_revision_id,source_snapshot_json
      FROM project_calculator_estimate_product_rows
      WHERE scenario_id=? AND estimate_position_id IS NOT NULL`, scenarioId).catch(() => []);
    const byPosition = new Map(rows.map((row) => [asText(row.estimate_position_id), row]));
    const sourceAttachmentIds = [...new Set(rows.map((row) => asText(row.source_attachment_id)).filter(Boolean))];
    if (!Array.isArray(comparison.baselineSnapshot.technicalSourceEvidence) && sourceAttachmentIds.length) {
      comparison.baselineSnapshot.technicalSourceEvidence = await db.all(`SELECT attachment.id attachmentId,attachment.original_file_name fileName,
        quote.supplier_name supplierName,revision.id revisionId,revision.supplier_quotation_number quotationNumber,
        revision.supplier_revision quotationRevision,revision.quotation_date quotationDate
        FROM supplier_quote_attachments attachment
        JOIN supplier_quote_revisions revision ON revision.id=attachment.revision_id
        JOIN supplier_quotes quote ON quote.id=revision.supplier_quote_id
        WHERE attachment.id IN (${sourceAttachmentIds.map(() => "?").join(",")}) AND attachment.role<>'derived_artifact'
        ORDER BY attachment.created_at`, ...sourceAttachmentIds).catch(() => []);
    }
    const sourcePositionIds = [...new Set(rows.map((row) => asText(row.source_position_id)).filter(Boolean))];
    const sourcePositions = sourcePositionIds.length
      ? await db.all(`SELECT id,revision_id,trace_json,original_specification_text FROM supplier_quote_positions
        WHERE id IN (${sourcePositionIds.map(() => "?").join(",")})`, ...sourcePositionIds).catch(() => [])
      : [];
    const bySourcePosition = new Map(sourcePositions.map((row) => [asText(row.id), row]));
    comparison.baselineSnapshot.positions = (comparison.baselineSnapshot.positions || []).map((position) => {
      const row = byPosition.get(asText(position.id));
      if (!row) return position;
      const source = parseJson(row.source_snapshot_json, {});
      const retained = needsRecoveredPositionEvidence(position) ? retainedTracePositionEvidence(bySourcePosition.get(asText(row.source_position_id))) : null;
      if (hasFrozenVisualEvidence(position) && !retained) return position;
      if (!sourceVisuals(source).length && !retained) return position;
      return withRecoveredEvidence(position, {
        sourceVisuals: source.manufacturerEvidence?.sourceVisuals || source.sourceVisuals || [],
        sourceVisual: source.manufacturerEvidence?.sourceVisual || source.sourceVisual || null,
        sourceAttachmentId: row.source_attachment_id,
        sourceRevisionId: row.source_revision_id,
        sourceRowKey: asText(row.source_position_id) || null,
        ...(retained || {}),
      });
    });
  }

  for (const proposal of comparison.proposals || []) {
    const requiresRecovery = proposal.positionMappings.filter((mapping) => !hasFrozenVisualEvidence(mapping.supplierItemSnapshot) || needsMoreSpecificDrawingEvidence(mapping.supplierItemSnapshot) || needsRecoveredSpecificationEvidence(mapping.supplierItemSnapshot));
    if (!requiresRecovery.length) continue;
    const recoveredByRowKey = new Map();
    for (const source of proposal.documents.filter((document) => document.supplierAttachmentId)) {
      try {
        const analysed = await analyseAttachment(db, comparison, proposal, source, attachmentRoot);
        for (const [key, value] of analysed) recoveredByRowKey.set(key, value);
      } catch {
        // A missing, corrupt or unsupported source remains explicitly unavailable;
        // one source must never erase the other frozen comparison evidence.
      }
    }
    proposal.positionMappings = proposal.positionMappings.map((mapping) => {
      if (hasFrozenVisualEvidence(mapping.supplierItemSnapshot) && !needsMoreSpecificDrawingEvidence(mapping.supplierItemSnapshot) && !needsRecoveredSpecificationEvidence(mapping.supplierItemSnapshot)) return mapping;
      const rowKey = asText(mapping.supplierItemSnapshot?.sourceRowKey || mapping.provenance?.rowKey);
      const recovered = recoveredByRowKey.get(rowKey);
      return recovered ? { ...mapping, supplierItemSnapshot: withRecoveredEvidence(mapping.supplierItemSnapshot, recovered) } : mapping;
    });
  }
  return comparison;
}

export const comparisonDrawingCompatibilityInternals = { sourceVisuals, hasFrozenVisualEvidence, needsMoreSpecificDrawingEvidence, needsRecoveredPositionEvidence, needsRecoveredSpecificationEvidence, retainedTracePositionEvidence, withRecoveredEvidence };
