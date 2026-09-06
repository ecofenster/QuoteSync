import { createCanvas } from '@napi-rs/canvas';
import Tesseract from 'tesseract.js';
import englishLanguage from '@tesseract.js-data/eng';

export const BOUNDED_PDF_OCR_VERSION = 'tesseract-js-eng-v1';

const OCR_SCALE = 3;
const MAX_OCR_PAGES = 40;
const MAX_OCR_PAGE_PIXELS = 5_000_000;
const MAX_OCR_TOTAL_PIXELS = 140_000_000;
const MAX_OCR_BLOCKS = 50_000;

const clean = (value) => String(value ?? '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
const rounded = (value) => Math.round(value * 1000) / 1000;

function pdfBoundingBox(box, scale, pageHeight) {
  if (!box || ![box.x0, box.y0, box.x1, box.y1].every(Number.isFinite)) return null;
  const left = box.x0 / scale;
  const right = box.x1 / scale;
  const bottom = pageHeight - (box.y1 / scale);
  const top = pageHeight - (box.y0 / scale);
  return {
    x: rounded(left),
    y: rounded(bottom),
    width: rounded(Math.max(0.01, right - left)),
    height: rounded(Math.max(0.01, top - bottom)),
  };
}

function recognizedLines(result) {
  return (result.data.blocks || []).flatMap((block) => (block.paragraphs || []).flatMap((paragraph) => paragraph.lines || []));
}

function ocrLimit(message) {
  return Object.assign(new Error(message), { code: 'ocr_required' });
}

/**
 * Runs only after PDF.js proves that the source has no usable text layer.
 * The local English language model avoids network access and every resource is
 * bounded before recognition begins.
 */
export async function applyBoundedPdfOcr(pdf, pages) {
  if (pdf.numPages > MAX_OCR_PAGES) throw ocrLimit(`Bounded OCR supports at most ${MAX_OCR_PAGES} pages; this document requires reviewed OCR evidence.`);

  const pagePlans = pages.map((page) => {
    const widthPx = Math.ceil(page.width * OCR_SCALE);
    const heightPx = Math.ceil(page.height * OCR_SCALE);
    const pixels = widthPx * heightPx;
    if (pixels > MAX_OCR_PAGE_PIXELS) throw ocrLimit('A PDF page exceeds the bounded OCR raster limit and requires reviewed OCR evidence.');
    return { page, widthPx, heightPx, pixels };
  });
  if (pagePlans.reduce((sum, plan) => sum + plan.pixels, 0) > MAX_OCR_TOTAL_PIXELS) throw ocrLimit('The PDF exceeds the bounded OCR document raster limit and requires reviewed OCR evidence.');

  const worker = await Tesseract.createWorker(englishLanguage.code, Tesseract.OEM.LSTM_ONLY, {
    langPath: englishLanguage.langPath,
    gzip: englishLanguage.gzip,
    cacheMethod: 'readOnly',
  });
  let blockCount = 0;
  try {
    await worker.setParameters({ preserve_interword_spaces: '1', user_defined_dpi: String(72 * OCR_SCALE) });
    for (const plan of pagePlans) {
      const pdfPage = await pdf.getPage(plan.page.pageNumber);
      const viewport = pdfPage.getViewport({ scale: OCR_SCALE });
      const canvas = createCanvas(plan.widthPx, plan.heightPx);
      const context = canvas.getContext('2d');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await pdfPage.render({ canvasContext: context, canvas, viewport, annotationMode: 0 }).promise;
      const result = await worker.recognize(await canvas.encode('png'), { rotateAuto: false }, { text: true, blocks: true });
      const lines = recognizedLines(result).flatMap((line, index) => {
        const text = clean(line.text);
        if (!text) return [];
        return [{
          id: `pdf-${plan.page.pageNumber}-ocr-line-${index}`,
          text,
          pageNumber: plan.page.pageNumber,
          boundingBox: pdfBoundingBox(line.bbox, OCR_SCALE, plan.page.height),
          readingOrder: index,
          sourceType: 'bounded_ocr_line',
          confidence: Number.isFinite(Number(line.confidence)) ? Number(line.confidence) : null,
        }];
      });
      blockCount += lines.length;
      if (blockCount > MAX_OCR_BLOCKS) throw ocrLimit('The PDF exceeds the bounded OCR text-block limit and requires reviewed OCR evidence.');
      plan.page.text = lines.map((line) => line.text).join('\n');
      plan.page.blocks = lines;
      plan.page.runs = [];
      plan.page.lines = lines;
      plan.page.regions = [];
      plan.page.contentEvidence = {
        ...plan.page.contentEvidence,
        textRunCount: lines.length,
        lineCount: lines.length,
        regionCount: 0,
        hasText: lines.length > 0,
        ocrApplied: true,
        ocrConfidence: Number.isFinite(Number(result.data.confidence)) ? Number(result.data.confidence) : null,
      };
      pdfPage.cleanup();
    }
  } finally {
    await worker.terminate();
  }

  const textLength = pages.reduce((sum, page) => sum + page.text.replace(/\s/g, '').length, 0);
  return {
    version: BOUNDED_PDF_OCR_VERSION,
    language: englishLanguage.code,
    scale: OCR_SCALE,
    pageCount: pages.length,
    blockCount,
    textLength,
    textAvailable: textLength >= 20,
  };
}
