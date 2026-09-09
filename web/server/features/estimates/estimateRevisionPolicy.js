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

export function isEstimateRevisionImmutableError(error) {
  return error?.code === "estimate_revision_immutable" || /Issued Estimate revision (?:costing )?is immutable/i.test(String(error?.message));
}
