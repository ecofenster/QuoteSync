import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { ensureManagedParent, resolveManagedPath, resolveAttachmentRoot } from "../supplierQuotes/managedAttachmentStorage.js";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const safeId = (value, label) => {
  const id = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw Object.assign(new Error(`${label} is invalid.`), { status: 400 });
  return id;
};
const ascii = (value) => String(value ?? "").normalize("NFKD").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
const pdfEscape = (value) => ascii(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
const money = (value) => `GBP ${Number(value || 0).toFixed(2)}`;

function projectionLines(projection) {
  const lines = [
    "CUSTOMER QUOTATION",
    `Reference: ${ascii(projection.estimateReference)}`,
    `Customer: ${ascii(projection.clientName)}`,
    `Project: ${ascii(projection.projectName || projection.clientName)}`,
    `Address: ${ascii(projection.projectAddress)}`,
    `Quotation revision: ${Number(projection.commercialRevision)}`,
    "",
    "Quoted positions",
  ];
  for (const position of projection.positions || []) {
    lines.push("",`${ascii(position.customerReference || position.reference)} | ${Number(position.quantity)} x ${Number(position.widthMm)} x ${Number(position.heightMm)} mm | ${ascii(position.productSystem || position.description)} | ${money(position.totalSellingPriceGbp)}`);
    if (position.classification === "alternative") lines.push(`  Alternative to ${ascii(position.alternativeToReference || "included position")} - not included in quotation total`);
    if (position.roomName) lines.push(`  Location: ${ascii(position.roomName)}`);
    if (position.configurationDescription) lines.push(`  Configuration: ${ascii(position.configurationDescription)}`);
    for (const item of position.specification || []) lines.push(`  ${ascii(item.label)}: ${ascii(item.value)}`);
    const thermal=position.thermal || {};
    if (thermal.ug) lines.push(`  Ug: ${ascii(thermal.ug)} W/m2K`);
    if (thermal.manufacturerQuotedUw || thermal.calculatedUw) lines.push(`  Uw: ${ascii(thermal.manufacturerQuotedUw || thermal.calculatedUw)} W/m2K`);
    if (position.drawing?.source === "manufacturer" && position.drawing.imageUrl) lines.push(`  Drawing evidence: ${ascii(position.drawing.imageUrl)}`);
    else if (position.drawing?.available) lines.push("  Drawing evidence: canonical QuoteSuite configurator drawing linked in quotation projection");
    else if (position.drawing?.reason) lines.push(`  Drawing: ${ascii(position.drawing.reason)}`);
  }
  lines.push("", "Commercial summary");
  for (const charge of projection.charges || []) lines.push(`${ascii(charge.label)}: ${money(charge.amountGbp)}`);
  lines.push(`Subtotal excluding VAT: ${money(projection.subtotalExVatGbp)}`);
  lines.push(`VAT (${ascii(projection.vatRatePercent)}%): ${money(projection.vatGbp)}`);
  lines.push(`Total including VAT: ${money(projection.totalIncVatGbp)}`);
  lines.push("", "This PDF is the immutable document representation attached to the issued quotation record.");
  return lines;
}

function buildPdf(projection) {
  const allLines = projectionLines(projection).flatMap((line)=>{if(line.length<=92)return[line];const words=line.split(" "),wrapped=[];let current="";for(const word of words){if(current&&`${current} ${word}`.length>92){wrapped.push(current);current=`  ${word}`}else current=current?`${current} ${word}`:word}if(current)wrapped.push(current);return wrapped}), pages = [];
  for (let index = 0; index < allLines.length; index += 48) pages.push(allLines.slice(index, index + 48));
  const objects = [null], add = (body) => { objects.push(body); return objects.length - 1; };
  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pagesId = add("");
  const pageIds = [];
  for (const lines of pages) {
    const stream = ["BT", "/F1 10 Tf", "50 790 Td", "13 TL", ...lines.map((line, index) => `${index ? "T* " : ""}(${pdfEscape(line)}) Tj`), "ET"].join("\n");
    const contentId = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`));
  }
  objects[pagesId] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const chunks = [Buffer.from("%PDF-1.4\n%QuoteSuite\n", "ascii")], offsets = [0];
  let length = chunks[0].length;
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = length;
    const chunk = Buffer.from(`${id} 0 obj\n${objects[id]}\nendobj\n`, "ascii");
    chunks.push(chunk); length += chunk.length;
  }
  const xrefOffset = length;
  const xref = [`xref`, `0 ${objects.length}`, "0000000000 65535 f ", ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `), `trailer`, `<< /Size ${objects.length} /Root ${catalogId} 0 R >>`, `startxref`, String(xrefOffset), "%%EOF", ""].join("\n");
  chunks.push(Buffer.from(xref, "ascii"));
  return Buffer.concat(chunks);
}

function validateProjection(projection) {
  if (!projection || typeof projection !== "object") throw Object.assign(new Error("Canonical Customer Quotation projection is required."), { status: 400 });
  for (const field of ["estimateReference", "clientName", "subtotalExVatGbp", "vatRatePercent", "vatGbp", "totalIncVatGbp"]) if (projection[field] == null || String(projection[field]).trim() === "") throw Object.assign(new Error(`Quotation projection ${field} is required.`), { status: 400 });
  if (!Array.isArray(projection.positions) || !Array.isArray(projection.charges)) throw Object.assign(new Error("Quotation projection positions and charges are required."), { status: 400 });
}

export function createCustomerQuotationDocumentService(db, { attachmentRoot = resolveAttachmentRoot() } = {}) {
  return {
    async createImmutablePdf({ estimateId, quotationRevision, projection }) {
      validateProjection(projection);
      const safeEstimateId = safeId(estimateId, "Estimate ID");
      const projectionJson = JSON.stringify(projection), projectionSha256 = sha256(projectionJson);
      const existing = await db.get("SELECT id FROM customer_quotation_documents WHERE estimate_id=? AND quotation_revision=? AND projection_sha256=? ORDER BY created_at LIMIT 1", safeEstimateId, Number(quotationRevision), projectionSha256);
      if (existing) return this.get(existing.id);
      const documentId = randomUUID();
      const bytes = buildPdf(projection), documentSha256 = sha256(bytes);
      const fileName = `${ascii(projection.estimateReference).replace(/[^A-Za-z0-9_-]+/g, "-") || "quotation"}-R${Number(quotationRevision)}.pdf`;
      const storageKey = `estimates/${safeEstimateId}/customer-quotations/${documentId}.pdf`;
      const target = await ensureManagedParent(storageKey, attachmentRoot);
      await writeFile(target, bytes, { flag: "wx" });
      await db.run(`INSERT INTO customer_quotation_documents(id,estimate_id,quotation_revision,file_name,media_type,storage_key,size_bytes,sha256,projection_sha256,projection_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`, documentId, safeEstimateId, Number(quotationRevision), fileName, "application/pdf", storageKey, bytes.length, documentSha256, projectionSha256, projectionJson, new Date().toISOString());
      return { id: documentId, estimateId: safeEstimateId, quotationRevision: Number(quotationRevision), fileName, mediaType: "application/pdf", storageKey, sizeBytes: bytes.length, sha256: documentSha256, projectionSha256 };
    },
    async get(documentId) {
      const row = await db.get("SELECT * FROM customer_quotation_documents WHERE id=?", documentId);
      return row ? { id: row.id, estimateId: row.estimate_id, quotationRevision: row.quotation_revision, fileName: row.file_name, mediaType: row.media_type, storageKey: row.storage_key, sizeBytes: row.size_bytes, sha256: row.sha256, projectionSha256: row.projection_sha256, projection: JSON.parse(row.projection_json), createdAt: row.created_at } : null;
    },
    async read(documentId) {
      const document = await this.get(documentId);
      if (!document) return null;
      return { document, bytes: await readFile(resolveManagedPath(document.storageKey, attachmentRoot)) };
    },
  };
}
