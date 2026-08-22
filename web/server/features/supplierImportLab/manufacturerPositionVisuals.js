import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

export const emfRendererScriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'renderEmfToPng.ps1');
const mediaTypes = { emf: 'image/emf', wmf: 'image/wmf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
const decodeXml = (value) => String(value).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const normalizeReference = (value) => String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();

function runEmfRenderer(inputPath, outputPath) {
  return new Promise((resolve, reject) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', emfRendererScriptPath, '-InputPath', inputPath, '-OutputPath', outputPath], { windowsHide: true, timeout: 60_000 }, (error, stdout) => {
    if (error) return reject(error);
    try { resolve(JSON.parse(stdout.trim())); } catch (parseError) { reject(parseError); }
  }));
}

async function retainImmutableSource(filename, source) {
  try {
    const retained = await readFile(filename);
    if (!retained.equals(source)) throw new Error('Retained manufacturer visual does not match the embedded source asset.');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    await writeFile(filename, source, { flag: 'wx' });
  }
}

function relationshipMap(xml) {
  const result = new Map();
  for (const match of xml.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/?>(?:<\/Relationship>)?/g)) result.set(match[1], match[2]);
  return result;
}

export async function extractDocxManufacturerVisuals(buffer, attachment, { visualRoot } = {}) {
  if (!visualRoot) return { candidates: [], warnings: ['Manufacturer visual extraction skipped because managed visual storage is unavailable.'] };
  const zip = await JSZip.loadAsync(buffer); const documentEntry = zip.file('word/document.xml'); const relsEntry = zip.file('word/_rels/document.xml.rels');
  if (!documentEntry || !relsEntry) return { candidates: [], warnings: [] };
  const documentXml = await documentEntry.async('string'); const relationships = relationshipMap(await relsEntry.async('string')); const candidates = []; const warnings = [];
  for (const [cellOrdinal, cell] of [...documentXml.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].entries()) {
    const text = [...cell[0].matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((item) => decodeXml(item[1])).join(' ').replace(/\s+/g, ' ').trim();
    const relationshipIds = [...cell[0].matchAll(/<a:blip\b[^>]*\br:embed="([^"]+)"/g)].map((item) => item[1]);
    if (!relationshipIds.length) continue;
    for (const relationshipId of relationshipIds) {
      const target = relationships.get(relationshipId); const mediaPath = target ? path.posix.normalize(path.posix.join('word', target)) : null; const entry = mediaPath ? zip.file(mediaPath) : null; const extension = path.extname(mediaPath || '').slice(1).toLowerCase();
      const base = { customerReference: text || null, manufacturerItemNumber: null, sourceFormat: extension || null, sourceMediaObject: mediaPath, mappingMethod: 'docx_same_table_cell_exact_reference', mappingConfidence: text ? 'strong' : 'review', mappingReviewStatus: text ? 'mapped_automatic' : 'needs_review', cellOrdinal };
      if (!entry || !mediaTypes[extension]) { candidates.push({ ...base, status: 'unavailable', reason: 'The embedded media object is unavailable or unsupported.' }); continue; }
      const source = await entry.async('nodebuffer'); const sourceSha256 = createHash('sha256').update(source).digest('hex'); const token = createHash('sha256').update(`manufacturer-position-visual-v1:${attachment.id}:${sourceSha256}`).digest('hex').slice(0, 40); const directory = path.join(visualRoot, token); await mkdir(directory, { recursive: true });
      const originalName = `source.${extension}`; await retainImmutableSource(path.join(directory, originalName), source); let derivative = null;
      try {
        if (extension === 'emf') { const info = await runEmfRenderer(path.join(directory, originalName), path.join(directory, 'quotation.png')); derivative = { mediaType: 'image/png', url: `/api/manufacturer-position-visuals/${token}/quotation.png`, widthPx: info.widthPx, heightPx: info.heightPx, dpi: info.dpi, purpose: 'quotation_print' }; }
        else if (extension === 'png' || extension === 'jpg' || extension === 'jpeg') { await writeFile(path.join(directory, `quotation.${extension === 'jpeg' ? 'jpg' : extension}`), source); derivative = { mediaType: mediaTypes[extension], url: `/api/manufacturer-position-visuals/${token}/quotation.${extension === 'jpeg' ? 'jpg' : extension}`, widthPx: null, heightPx: null, dpi: null, purpose: 'quotation_print' }; }
      } catch (error) { warnings.push(`Could not render ${mediaPath}: ${error.message}`); }
      candidates.push({ ...base, status: derivative ? 'available' : 'unavailable', reason: derivative ? null : 'The source visual was retained, but no customer-safe derivative could be rendered.', originalAsset: { mediaType: mediaTypes[extension], sourceFormat: extension, storageKey: `manufacturer-position-visuals/${token}/${originalName}`, byteLength: source.length, sha256: sourceSha256 }, renderedDerivative: derivative });
    }
  }
  return { candidates, warnings };
}

export function mapManufacturerVisualsToRows(rows, candidates, quotation = {}) {
  const groups = new Map();
  for (const row of rows) { const key = normalizeReference(row.displayReference); if (key) groups.set(key, [...(groups.get(key) || []), row]); }
  for (const candidate of candidates || []) {
    const rawReference = normalizeReference(candidate.customerReference);
    const supplementaryMatch = rawReference.match(/^(.+?)\s+U[ -]?VALUE\s*(?:[–—:-]|$)/i);
    const candidateReference = groups.has(rawReference) ? rawReference : normalizeReference(supplementaryMatch?.[1]);
    const matches = groups.get(candidateReference) || [];
    if (matches.length !== 1 || candidate.mappingConfidence !== 'strong') {
      for (const row of matches) { const sourceVisual = { kind: 'manufacturer_document_image', status: 'unavailable', mappingMethod: candidate.mappingMethod, mappingConfidence: 'review', mappingReviewStatus: 'needs_review', reason: 'The document structure did not identify one unique position for this visual.' }; row.manufacturerEvidence.sourceVisual = sourceVisual; row.sourceVisual = sourceVisual; row.originalExtractedSnapshot.manufacturerEvidence.sourceVisual = sourceVisual; }
      continue;
    }
    const row = matches[0]; const sourceVisual = { kind: 'manufacturer_document_image', ...candidate, mediaType: candidate.renderedDerivative?.mediaType, url: candidate.renderedDerivative?.url, sourceQuotationNumber: quotation.supplierQuotationNumber || null, sourceRevision: quotation.supplierRevision || null };
    row.manufacturerEvidence.sourceVisual = sourceVisual; row.sourceVisual = sourceVisual; row.originalExtractedSnapshot.manufacturerEvidence.sourceVisual = sourceVisual;
  }
  return rows;
}
