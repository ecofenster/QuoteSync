import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { initializeSupplierCommercialSchema } from "../server/schema/supplierCommercialSchema.js";
import { createSupplierQuotesService } from "../server/features/supplierQuotes/supplierQuotesService.js";

const sources = ["Nordvest.pdf", "Norrsken.pdf", "Internorm-Ecohaus.pdf"];
const sourceRoot = path.resolve("docs/Supplier_Quotes/Competitor_Quotes_-_ Nick_Corlett_Examples");
const root = await fs.mkdtemp(path.join(os.tmpdir(), "qs-nick-commercial-audit-"));
const db = await open({ filename: path.join(root, "audit.sqlite"), driver: sqlite3.Database });

try {
  await db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE clients(id TEXT PRIMARY KEY,client_ref TEXT,name TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE estimates(id TEXT PRIMARY KEY,estimate_ref TEXT,client_id TEXT,status TEXT,positions_json TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);
    INSERT INTO clients VALUES('client','AUDIT','Audit',datetime('now'),datetime('now'));
    INSERT INTO estimates VALUES('estimate','AUDIT','client','draft','[]',datetime('now'),datetime('now'),NULL);
  `);
  await initializeSupplierCommercialSchema(db);
  const service = createSupplierQuotesService(db, { attachmentRoot: root });
  for (const [index, fileName] of sources.entries()) {
    const quote = await service.createQuote("estimate", { supplierCode: `AUDIT-${index}`, supplierName: "Audit" });
    const revision = await service.createRevision("estimate", quote.id, { supplierQuotationNumber: `AUDIT-${index}`, currency: "GBP" });
    const attachmentId = `attachment-${index}`;
    const storageKey = `source-${index}.pdf`;
    await fs.copyFile(path.join(sourceRoot, fileName), path.join(root, storageKey));
    await service.insertAttachments("estimate", quote.id, revision.id, [{
      id: attachmentId,
      role: "original_quote",
      documentKind: "complete_quotation",
      originalFileName: fileName,
      mediaType: "application/pdf",
      sizeBytes: 1,
      sha256: String(index + 1).repeat(64).slice(0, 64),
      storageKey,
      parserEligible: true,
      createdAt: new Date().toISOString(),
    }]);
    const review = await service.prepareImportReview("estimate", [{ quoteId: quote.id, revisionId: revision.id, attachmentId }]);
    const evidence = review.documents[0].commercialEvidence;
    console.log(JSON.stringify({
      fileName,
      metadata: {
        supplier: review.metadata.recognizedSupplierName,
        manufacturer: review.metadata.recognizedManufacturerName,
        quotationDate: review.metadata.quotationDate,
        commercialScope: review.metadata.commercialScope,
        supplierQuotedSubtotal: review.metadata.supplierQuotedSubtotal,
        supplierQuotedTotal: review.metadata.supplierQuotedTotal,
      },
      commercialEvidence: {
        currency: evidence?.currency,
        categories: evidence?.categories,
        sourceReconciliation: evidence?.sourceReconciliation,
      },
      rows: review.documents[0].rows.map((row) => ({ reference: row.customerReference, quantity: row.quantity, unitPrice: row.unitPrice, totalPrice: row.totalPrice, classification: row.classification })),
    }, null, 2));
  }
} finally {
  await db.close();
  await fs.rm(root, { recursive: true, force: true });
}
