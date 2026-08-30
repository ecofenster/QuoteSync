import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { assertPdfJsRuntimeResources, pdfJsRuntimeOptions, PDFJS_RUNTIME_VERSION } from './pdfJsRuntime.js';

export const PDF_POSITION_PREVIEW_VERSION = 'pdf-position-region-v5';
const MAX_SOURCE_BYTES = 64 * 1024 * 1024;
const MAX_REGIONS = 200;
const MAX_OUTPUT_EDGE = 960;
const MAX_RENDER_SCALE = 2;
const MAX_PAGE_CANVAS_PIXELS = 2_100_000;
const MAX_PNG_BYTES = 4 * 1024 * 1024;

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const rounded = (value) => Math.round(value * 1000) / 1000;

function boundedRegion(region, page) {
  const x = finite(region?.x); const y = finite(region?.y); const width = finite(region?.width); const height = finite(region?.height);
  if (x == null || y == null || width == null || height == null || width <= 1 || height <= 1) return null;
  const left = Math.max(0, Math.min(x, page.width)); const bottom = Math.max(0, Math.min(y, page.height));
  const right = Math.max(left, Math.min(x + width, page.width)); const top = Math.max(bottom, Math.min(y + height, page.height));
  if (right - left <= 1 || top - bottom <= 1) return null;
  return { x: rounded(left), y: rounded(bottom), width: rounded(right - left), height: rounded(top - bottom) };
}

function outputScale(page, region) {
  const regionScale = Math.min(MAX_OUTPUT_EDGE / region.width, MAX_OUTPUT_EDGE / region.height, MAX_RENDER_SCALE);
  const pageScale = Math.sqrt(MAX_PAGE_CANVAS_PIXELS / (page.width * page.height));
  return Math.max(1, Math.min(regionScale, pageScale, MAX_RENDER_SCALE));
}

function previewToken(attachment, pageNumber, region, role) {
  return createHash('sha256').update(JSON.stringify({ version: PDF_POSITION_PREVIEW_VERSION, source: attachment.sha256, pageNumber, region, role })).digest('hex').slice(0, 40);
}

async function exists(filename) {
  try { const info = await stat(filename); return info.isFile() && info.size > 0 && info.size <= MAX_PNG_BYTES; } catch (error) { if (error?.code === 'ENOENT') return false; throw error; }
}

function applyPreview(row, attachment, pageNumber, region, token, widthPx, heightPx, cached, role) {
  const evidence = row.manufacturerEvidence || {};
  const current = (evidence.sourceVisuals || []).find((visual) => visual.role === role) || evidence.sourceVisual || row.sourceVisual;
  const renderedDerivative = { mediaType: 'image/png', url: `/api/manufacturer-position-visuals/${token}/quotation.png`, widthPx, heightPx, purpose: current?.primaryUse || (role === 'inside' ? 'products_supply' : 'manufacturer_evidence'), role, renderVersion: PDF_POSITION_PREVIEW_VERSION, cached };
  const sourceVisual = {
    ...current,
    kind: 'manufacturer_document_region',
    status: 'available',
    sourceFormat: 'pdf',
    role,
    sourcePage: pageNumber,
    boundingRegion: region,
    coordinateSpace: 'pdf_points',
    mediaType: 'image/png',
    url: renderedDerivative.url,
    originalAsset: { ...(current?.originalAsset || {}), mediaType: 'application/pdf', attachmentId: attachment.id, sha256: attachment.sha256, sourcePage: pageNumber, boundingRegion: region, coordinateSpace: 'pdf_points' },
    renderedDerivative,
    renderParameters: { targetFormat: 'image/png', status: 'rendered', renderVersion: PDF_POSITION_PREVIEW_VERSION, pdfRuntimeVersion: PDFJS_RUNTIME_VERSION, sourcePage: pageNumber, boundingRegion: region, sourceTextOverlay: 'not_required' },
    reason: null,
  };
  const sourceVisuals = Array.isArray(evidence.sourceVisuals)
    ? evidence.sourceVisuals.map((visual) => visual.role === role ? sourceVisual : visual)
    : [sourceVisual];
  const primaryVisual = sourceVisual.primary ? sourceVisual : sourceVisuals.find((visual) => visual.primary) || sourceVisuals[0];
  const sourceSpecification = evidence.sourceSpecification ? { ...evidence.sourceSpecification, sourceAttachmentHash: attachment.sha256 } : null;
  row.manufacturerEvidence = { ...evidence, ...(sourceSpecification ? { sourceSpecification } : {}), sourceVisuals, sourceVisual: primaryVisual };
  row.sourceVisual = primaryVisual;
  if (row.originalExtractedSnapshot) row.originalExtractedSnapshot.manufacturerEvidence = { ...(row.originalExtractedSnapshot.manufacturerEvidence || {}), ...(sourceSpecification ? { sourceSpecification } : {}), sourceVisuals, sourceVisual: primaryVisual };
}

export async function derivePdfPositionPreviews({ filename, attachment, document, rows, visualRoot }) {
  if (attachment.media_type !== 'application/pdf' && attachment.mediaType !== 'application/pdf') return { eligible: 0, rendered: 0, cached: 0, unavailable: 0, warnings: [] };
  if (!visualRoot) return { eligible: 0, rendered: 0, cached: 0, unavailable: rows.length, warnings: ['PDF preview derivation skipped because managed visual storage is unavailable.'] };
  const unavailableCount = () => (rows || []).filter((row) => (row.manufacturerEvidence?.sourceVisual || row.sourceVisual)?.status !== 'available').length;
  const pageByNumber = new Map((document.pages || []).map((page) => [page.pageNumber, page]));
  const candidates = []; const reviewWarnings = [];
  for (const row of rows || []) {
    const visuals = Array.isArray(row.manufacturerEvidence?.sourceVisuals) && row.manufacturerEvidence.sourceVisuals.length
      ? row.manufacturerEvidence.sourceVisuals
      : [row.manufacturerEvidence?.sourceVisual || row.sourceVisual];
    for (const visual of visuals) {
      if (visual?.status === 'available' || visual?.sourceFormat !== 'pdf') continue;
      if (visual.primary && (visual.role !== 'inside' || visual.mappingReviewStatus !== 'mapped_automatic')) {
        reviewWarnings.push(`PDF page ${visual.sourcePage ?? 'unknown'} primary preview remains review_required because a complete automatic Inside region was not proven.`);
        continue;
      }
      const page = pageByNumber.get(Number(visual.sourcePage));
      const region = page && boundedRegion(visual.boundingRegion, page);
      if (page && region) candidates.push({ row, page, region, role: visual.role || 'combined_source' });
    }
  }
  if (candidates.length > MAX_REGIONS) throw Object.assign(new Error('PDF contains too many position preview regions.'), { code: 'unsafe_pdf_document' });
  if (!candidates.length) return { eligible: 0, rendered: 0, cached: 0, unavailable: unavailableCount(), warnings: reviewWarnings };
  const sourceInfo = await stat(filename);
  if (sourceInfo.size > MAX_SOURCE_BYTES) throw Object.assign(new Error('PDF exceeds the safe preview-rendering size limit.'), { code: 'unsafe_pdf_document' });

  const prepared = [];
  let cached = 0;
  for (const candidate of candidates) {
    const token = previewToken(attachment, candidate.page.pageNumber, candidate.region, candidate.role);
    const directory = path.join(visualRoot, token); const output = path.join(directory, 'quotation.png');
    const scale = outputScale(candidate.page, candidate.region);
    const widthPx = Math.max(1, Math.round(candidate.region.width * scale)); const heightPx = Math.max(1, Math.round(candidate.region.height * scale));
    if (await exists(output)) { applyPreview(candidate.row, attachment, candidate.page.pageNumber, candidate.region, token, widthPx, heightPx, true, candidate.role); cached += 1; }
    else prepared.push({ ...candidate, token, directory, output, scale, widthPx, heightPx });
  }
  if (!prepared.length) return { eligible: candidates.length, rendered: 0, cached, unavailable: unavailableCount(), warnings: reviewWarnings };

  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  await assertPdfJsRuntimeResources();
  const source = new Uint8Array(await readFile(filename));
  const loadingTask = getDocument(pdfJsRuntimeOptions({
    data: source,
    maxImageSize: 16_000_000,
    canvasMaxAreaInBytes: MAX_PAGE_CANVAS_PIXELS * 4,
  }));
  let rendered = 0; const warnings = [...reviewWarnings];
  try {
    const pdf = await loadingTask.promise;
    for (const pageNumber of [...new Set(prepared.map((item) => item.page.pageNumber))].sort((left, right) => left - right)) {
      const items = prepared.filter((item) => item.page.pageNumber === pageNumber);
      const scale = Math.max(...items.map((item) => item.scale));
      const page = await pdf.getPage(pageNumber); const viewport = page.getViewport({ scale });
      const pageCanvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height)); const pageContext = pageCanvas.getContext('2d');
      pageContext.fillStyle = '#fff'; pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      await page.render({ canvasContext: pageContext, canvas: pageCanvas, viewport, annotationMode: 0 }).promise;
      for (const item of items) {
        const [left, top] = viewport.convertToViewportPoint(item.region.x, item.region.y + item.region.height);
        const [right, bottom] = viewport.convertToViewportPoint(item.region.x + item.region.width, item.region.y);
        const sx = Math.max(0, Math.floor(Math.min(left, right))); const sy = Math.max(0, Math.floor(Math.min(top, bottom)));
        const sw = Math.min(pageCanvas.width - sx, Math.max(1, Math.ceil(Math.abs(right - left)))); const sh = Math.min(pageCanvas.height - sy, Math.max(1, Math.ceil(Math.abs(bottom - top))));
        const crop = createCanvas(item.widthPx, item.heightPx); const context = crop.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, crop.width, crop.height); context.drawImage(pageCanvas, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
        const png = await crop.encode('png');
        if (png.length > MAX_PNG_BYTES) { warnings.push(`PDF preview for page ${pageNumber} exceeded the safe derivative size limit.`); continue; }
        await mkdir(item.directory, { recursive: true });
        try { await writeFile(item.output, png, { flag: 'wx' }); } catch (error) { if (error?.code !== 'EEXIST') throw error; }
        applyPreview(item.row, attachment, pageNumber, item.region, item.token, item.widthPx, item.heightPx, false, item.role); rendered += 1;
      }
      page.cleanup();
    }
  } finally { await loadingTask.destroy(); }
  return { eligible: candidates.length, rendered, cached, unavailable: unavailableCount(), warnings };
}
