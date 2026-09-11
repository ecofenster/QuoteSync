export async function assertEstimateRevisionEditable(db, estimateId) {
  let release;
  try {
    release = await db.get(`SELECT r.id,r.estimate_revision FROM estimate_revision_releases r JOIN estimates e ON e.id=r.estimate_id AND e.revision_no=r.estimate_revision WHERE r.estimate_id=? LIMIT 1`, estimateId);
  } catch (error) {
    if (/no such table: estimate_revision_releases/i.test(String(error?.message))) return;
    throw error;
  }
  if (release) throw Object.assign(new Error("Issued Estimate revision is immutable. Create the next editable revision for changes."), { status: 409, code: "estimate_revision_immutable", releaseId: release.id, estimateRevision: release.estimate_revision });
}

export async function inspectEstimateRemovalPolicy(db, estimateId) {
  const estimate = await db.get("SELECT id,estimate_ref,revision_no,deleted_at FROM estimates WHERE id=?", estimateId);
  if (!estimate) return null;
  let release = null, archive = null;
  try {
    release = await db.get(`SELECT r.id release_id,r.issued_quotation_id,r.document_id,r.released_at,iq.status issued_status
      FROM estimate_revision_releases r LEFT JOIN issued_quotations iq ON iq.id=r.issued_quotation_id
      WHERE r.estimate_id=? AND r.estimate_revision=? LIMIT 1`, estimateId, estimate.revision_no);
  } catch (cause) {
    if (!/no such table: estimate_revision_releases/i.test(String(cause?.message))) throw cause;
  }
  try { archive = await db.get("SELECT archived_at,archived_by,reason FROM estimate_archives WHERE estimate_id=?", estimateId); }
  catch (cause) { if (!/no such table: estimate_archives/i.test(String(cause?.message))) throw cause; }
  const restricted = Boolean(release);
  return {
    estimateId: estimate.id,
    estimateRef: estimate.estimate_ref,
    revisionNo: Number(estimate.revision_no || 0),
    deletedAt: estimate.deleted_at || null,
    archivedAt: archive?.archived_at || null,
    restricted,
    reason: restricted ? "Issued revision evidence is immutable and cannot be sent to the Recycle Bin. Archive it to remove it from active lists while preserving the issued PDF, communications, Portal releases and Orders." : null,
    recommendedAction: restricted ? "archive" : "delete",
    release: release || null,
  };
}

export async function deleteEstimateBatch(db, estimateIds, options = {}) {
  const deletedAt = (options.now || (() => new Date()))().toISOString(), results = [];
  for (const estimateId of [...new Set((estimateIds || []).map(String).filter(Boolean))].slice(0, 100)) {
    const policy = await inspectEstimateRemovalPolicy(db, estimateId);
    if (!policy) { results.push({ estimateId, success:false, code:"estimate_not_found", reason:"Estimate not found." }); continue; }
    if (policy.restricted) { results.push({ estimateId, estimateRef:policy.estimateRef, success:false, code:"estimate_revision_immutable", reason:policy.reason, recommendedAction:"archive", releaseId:policy.release?.release_id || null }); continue; }
    const result = await db.run("UPDATE estimates SET deleted_at=COALESCE(deleted_at,?) WHERE id=?", deletedAt, estimateId);
    results.push({ estimateId, estimateRef:policy.estimateRef, success:Boolean(result.changes), code:result.changes ? null : "estimate_not_found", reason:result.changes ? null : "Estimate not found.", deletedAt:result.changes ? deletedAt : null });
  }
  const succeeded = results.filter((item) => item.success).length, failed = results.length - succeeded;
  return { status: failed ? (succeeded ? "partial_success" : "failed") : "success", succeeded, failed, results };
}

export async function archiveIssuedEstimate(db, estimateId, options = {}) {
  const policy = await inspectEstimateRemovalPolicy(db, estimateId);
  if (!policy) throw Object.assign(new Error("Estimate not found."), { status:404, code:"estimate_not_found" });
  if (!policy.restricted) throw Object.assign(new Error("This Estimate is still editable. Use Delete to send it to the Recycle Bin."), { status:409, code:"estimate_archive_not_required" });
  const archivedAt = (options.now || (() => new Date()))().toISOString();
  await db.run(`INSERT INTO estimate_archives(estimate_id,reason,archived_by,archived_at)
    VALUES(?,?,?,?) ON CONFLICT(estimate_id) DO UPDATE SET reason=excluded.reason,archived_by=excluded.archived_by,archived_at=excluded.archived_at`, estimateId, String(options.reason || "Removed from active list after issue"), String(options.archivedBy || "current-user"), archivedAt);
  return { success:true, estimateId, estimateRef:policy.estimateRef, archivedAt, preservedReleaseId:policy.release?.release_id || null };
}

export function isEstimateRevisionImmutableError(error) {
  return error?.code === "estimate_revision_immutable" || /Issued Estimate revision (?:costing )?is immutable/i.test(String(error?.message));
}
