import { assertEstimateRevisionEditable } from '../estimates/estimateRevisionPolicy.js';

export async function costingEditability(db, estimateId) {
  if (!estimateId) return { editable: true };
  try {
    await assertEstimateRevisionEditable(db, estimateId);
    return { editable: true };
  } catch (error) {
    if (error.code !== 'estimate_revision_immutable') throw error;
    const release = await db.get('SELECT released_at FROM estimate_revision_releases WHERE id=?', error.releaseId);
    return { editable: false, releaseId: error.releaseId, releasedAt: release?.released_at, reason: 'This Estimate has an issued release. Its saved figures are read-only. Create an editable Estimate revision to change costs, materials or routes; the issued evidence will be preserved.' };
  }
}
