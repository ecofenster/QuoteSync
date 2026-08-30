import { readdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

export const PDFJS_RUNTIME_VERSION = 'pdfjs_node_native_v2';

const require = createRequire(import.meta.url);
const pdfJsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
const packageDirectory = (name) => `${path.join(pdfJsRoot, name).replace(/\\/g, '/').replace(/\/+$/, '')}/`;
const standardFontDataUrl = packageDirectory('standard_fonts');
const cMapUrl = packageDirectory('cmaps');
const wasmUrl = packageDirectory('wasm');
const ekoStandardFontFiles = [
  'LiberationSans-Regular.ttf',
  'LiberationSans-Bold.ttf',
  'LiberationSans-Italic.ttf',
  'LiberationSans-BoldItalic.ttf',
];

/**
 * One production PDF.js contract is shared by extraction, diagnostic controls
 * and raster derivatives. NodeBinaryDataFactory requires filesystem directory
 * names here; file:// URLs are not valid Node fs paths on Windows.
 */
export function pdfJsRuntimeOptions(overrides = {}) {
  return {
    isEvalSupported: false,
    enableXfa: false,
    useSystemFonts: false,
    // Node canvas has no browser FontFaceSet. Force PDF.js glyph-path drawing;
    // false makes the EKO standard-font dimension runs disappear.
    disableFontFace: true,
    useWasm: true,
    disableAutoFetch: true,
    standardFontDataUrl,
    cMapUrl,
    cMapPacked: true,
    wasmUrl,
    ...overrides,
  };
}

async function directoryEvidence(directory, predicate) {
  const names = await readdir(directory);
  const matching = names.filter(predicate).sort();
  return { available: true, fileCount: matching.length, files: matching };
}

export async function auditPdfJsRuntimeResources() {
  const requiredFonts = [];
  for (const filename of ekoStandardFontFiles) {
    const information = await stat(`${standardFontDataUrl}${filename}`);
    requiredFonts.push({ filename, bytes: information.size, available: information.isFile() && information.size > 0 });
  }
  const [standardFonts, cMaps, wasm] = await Promise.all([
    directoryEvidence(standardFontDataUrl, (name) => /\.(?:ttf|pfb)$/i.test(name)),
    directoryEvidence(cMapUrl, (name) => /\.bcmap$/i.test(name)),
    directoryEvidence(wasmUrl, (name) => /\.(?:wasm|js)$/i.test(name)),
  ]);
  const ready = requiredFonts.every((item) => item.available) && standardFonts.fileCount > 0 && cMaps.fileCount > 0 && wasm.fileCount > 0;
  return {
    version: PDFJS_RUNTIME_VERSION,
    ready,
    configuration: { standardFontDataUrl, cMapUrl, cMapPacked: true, wasmUrl, useSystemFonts: false, disableFontFace: true, useWasm: true },
    standardFonts: { ...standardFonts, requiredForEkoControl: requiredFonts },
    cMaps: { ...cMaps, files: cMaps.files.slice(0, 8) },
    wasm: { ...wasm, files: wasm.files },
  };
}

let resourceCheck;
export async function assertPdfJsRuntimeResources() {
  resourceCheck ||= auditPdfJsRuntimeResources().then((audit) => {
    if (!audit.ready) throw Object.assign(new Error('PDF.js rendering resources are unavailable.'), { code: 'pdf_renderer_resources_unavailable', audit });
    return audit;
  });
  return resourceCheck;
}
