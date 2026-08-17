export type PreviewEstimate = { id: string; client_id: string; estimate_ref: string; status?: string };
export function chooseInitialPreviewEstimate(estimates: PreviewEstimate[],currentId=""){return estimates.some(estimate=>estimate.id===currentId)?currentId:estimates[0]?.id??"";}
