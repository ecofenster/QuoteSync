import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { buildRevisionFileName, classifySupplierDocumentConflict } from "../server/features/documents/commercialDriveService.js";

const bytes = Buffer.from("actual retained Gmail attachment bytes");
const md5 = createHash("md5").update(bytes).digest("hex");
const source = { communicationAttachmentId: "message_attachment_part-1", fileName: "Supplier Estimate.docx", bytes };

test("file review distinguishes exact retained source, identical content, and filename conflicts", () => {
  const exact = classifySupplierDocumentConflict({ ...source, files: [{ id: "exact", name: "Filed.docx", size: String(bytes.length), md5Checksum: md5, appProperties: { quotesuiteCommunicationAttachmentId: source.communicationAttachmentId } }] });
  assert.equal(exact.kind, "already_filed");
  assert.deepEqual(exact.decisions, ["reuse_existing"]);

  const identical = classifySupplierDocumentConflict({ ...source, files: [{ id: "identical", name: "Earlier name.docx", size: String(bytes.length), md5Checksum: md5, appProperties: {} }] });
  assert.equal(identical.kind, "identical_content");
  assert.deepEqual(identical.decisions, ["reuse_identical", "save_new_revision"]);

  const changed = classifySupplierDocumentConflict({ ...source, files: [{ id: "changed", name: "supplier estimate.DOCX", size: String(bytes.length + 3), md5Checksum: createHash("md5").update("different").digest("hex"), appProperties: {} }] });
  assert.equal(changed.kind, "same_name_different_content");
  assert.deepEqual(changed.decisions, ["save_new_revision"]);

  const unverified = classifySupplierDocumentConflict({ ...source, files: [{ id: "unverified", name: "Supplier Estimate.docx", size: String(bytes.length), appProperties: {} }] });
  assert.equal(unverified.kind, "same_name_unverified");
  assert.match(unverified.evidence, /filename is not proof/i);

  const fresh = classifySupplierDocumentConflict({ ...source, files: [{ id: "other", name: "Other.pdf", size: "12", md5Checksum: "not-the-source", appProperties: {} }] });
  assert.equal(fresh.kind, "new_file");
  assert.deepEqual(fresh.decisions, ["save"]);
});

test("new revision names preserve extensions and never collide with existing Drive children", () => {
  const files = [{ name: "Supplier Estimate.docx" }, { name: "Supplier Estimate (revision 2).docx" }];
  assert.equal(buildRevisionFileName("Supplier Estimate.docx", files), "Supplier Estimate (revision 3).docx");
  assert.equal(buildRevisionFileName("Offer", [{ name: "Offer (revision 2)" }]), "Offer (revision 3)");
});
