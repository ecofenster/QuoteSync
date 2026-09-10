import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import { ensureManagedParent, resolveAttachmentRoot, resolveManagedPath } from "../supplierQuotes/managedAttachmentStorage.js";

pdfMake.addVirtualFileSystem(pdfFonts);

const clean = (value) => String(value ?? "").trim();
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const safeName = (value) => clean(value).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "Estimate";

function definition(source) {
  const rows = source.positions.map((position) => [
    { text: clean(position.reference) || "Position", bold: true },
    clean(position.response).replaceAll("_", " "),
    clean(position.comment) || "No Position comment supplied.",
  ]);
  return {
    pageSize: "A4",
    pageMargins: [42, 42, 42, 48],
    info: { title: `Requested changes · ${source.estimateReference}`, subject: "Staff-reviewed customer changes for supplier revision" },
    defaultStyle: { font: "Roboto", fontSize: 10, color: "#17211D", lineHeight: 1.2 },
    content: [
      { text: "REQUESTED ESTIMATE CHANGES", fontSize: 9, bold: true, color: "#55B948", characterSpacing: 1.1 },
      { text: source.projectName, fontSize: 22, bold: true, margin: [0, 5, 0, 3] },
      { text: `${source.estimateReference} · issued revision ${source.estimateRevision}`, color: "#53615A", margin: [0, 0, 0, 18] },
      { columns: [[{ text: "CLIENT", style: "label" }, { text: source.clientName }], [{ text: "CUSTOMER SUBMITTED", style: "label" }, { text: new Date(source.submittedAt).toLocaleString("en-GB") }]], columnGap: 22, margin: [0, 0, 0, 18] },
      ...(source.generalComment ? [{ text: source.generalResponse === "amendment_requested" ? "GENERAL CHANGE REQUEST" : "GENERAL COMMENT", style: "label" }, { text: source.generalComment, margin: [0, 3, 0, 16] }] : []),
      { text: "POSITION REVIEW", fontSize: 14, bold: true, margin: [0, 0, 0, 7] },
      { table: { headerRows: 1, widths: [78, 104, "*"], body: [[{ text: "POSITION", style: "label" }, { text: "RESPONSE", style: "label" }, { text: "CUSTOMER REQUEST / COMMENT", style: "label" }], ...rows] }, layout: { fillColor: (row) => row === 0 ? "#EDF3EA" : null, hLineColor: () => "#D3DBD4", vLineColor: () => "#D3DBD4", paddingLeft: () => 7, paddingRight: () => 7, paddingTop: () => 7, paddingBottom: () => 7 } },
      { text: "Staff review required", fontSize: 13, bold: true, margin: [0, 20, 0, 6] },
      { text: "This document records the reviewed customer request against the exact issued Estimate revision. The supplier must return revised source evidence; QuoteSuite will verify each requested change and highlight other material changes before any successor Estimate can be issued.", color: "#44514A" },
    ],
    styles: { label: { fontSize: 8, bold: true, color: "#5C6861", characterSpacing: 0.35 } },
    footer: (page, pages) => ({ columns: [{ text: source.estimateReference }, { text: `Page ${page} of ${pages}`, alignment: "right" }], margin: [42, 14, 42, 0], fontSize: 8, color: "#68736D" }),
  };
}

export function createSupplierRevisionChangeDocumentService(db, { attachmentRoot = resolveAttachmentRoot() } = {}) {
  async function getByRequest(requestId) {
    const row = await db.get("SELECT * FROM supplier_revision_documents WHERE supplier_revision_request_id=?", requestId);
    return row ? { id: row.id, requestId: row.supplier_revision_request_id, fileName: row.file_name, mediaType: row.media_type, storageKey: row.storage_key, sizeBytes: Number(row.size_bytes), sha256: row.sha256, snapshotSha256: row.snapshot_sha256, createdAt: row.created_at } : null;
  }
  async function create(requestId, source) {
    const snapshotJson = JSON.stringify(source), snapshotSha256 = sha256(snapshotJson);
    const existing = await getByRequest(requestId);
    if (existing) {
      if (existing.snapshotSha256 !== snapshotSha256) throw Object.assign(new Error("The immutable supplier-change document already records a different reviewed request."), { status: 409, code: "supplier_revision_document_conflict" });
      return existing;
    }
    const bytes = await new Promise((resolve, reject) => { try { pdfMake.createPdf(definition(source)).getBuffer((value) => resolve(Buffer.from(value))); } catch (error) { reject(error); } });
    const id = randomUUID(), fileName = `${safeName(source.estimateReference)}-Requested-Changes.pdf`, storageKey = `supplier-revisions/${safeName(requestId)}/${id}.pdf`, target = await ensureManagedParent(storageKey, attachmentRoot), createdAt = new Date().toISOString();
    await writeFile(target, bytes, { flag: "wx" });
    await db.run("INSERT INTO supplier_revision_documents(id,supplier_revision_request_id,file_name,media_type,storage_key,size_bytes,sha256,snapshot_sha256,snapshot_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)", id, requestId, fileName, "application/pdf", storageKey, bytes.length, sha256(bytes), snapshotSha256, snapshotJson, createdAt);
    return getByRequest(requestId);
  }
  async function read(id) {
    const row = await db.get("SELECT * FROM supplier_revision_documents WHERE id=?", id);
    if (!row) return null;
    return { document: { id: row.id, fileName: row.file_name, mediaType: row.media_type, storageKey: row.storage_key, sizeBytes: Number(row.size_bytes), sha256: row.sha256 }, bytes: await readFile(resolveManagedPath(row.storage_key, attachmentRoot)) };
  }
  return { create, getByRequest, read };
}
