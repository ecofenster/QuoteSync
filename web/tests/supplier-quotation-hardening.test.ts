import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { parseCommercialSummary, reconcileCommercialSummary } from "../server/features/supplierImportLab/commercialSummaryParser.js";
import { parseCommercialFields } from "../server/features/supplierImportLab/commercialFieldParser.js";
import { createSupplierImportLabExtractionService } from "../server/features/supplierImportLab/supplierImportLabExtractionService.js";
import { initializeSupplierCommercialSchema } from "../server/schema/supplierCommercialSchema.js";

function extracted(lines:string[],pages:Record<number,string[]>={1:lines}) { return { attachmentId:"fixture",sessionId:"fixture",mediaType:"application/pdf",extractorName:"fixture",extractorVersion:"1",createdAt:new Date().toISOString(),pages:Object.entries(pages).map(([pageNumber,pageLines])=>({pageNumber:Number(pageNumber),pageLabel:String(pageNumber),width:600,height:800,text:pageLines.join("\n"),blocks:pageLines.map((text,readingOrder)=>({id:`p${pageNumber}b${readingOrder}`,text,pageNumber:Number(pageNumber),boundingBox:null,readingOrder,sourceType:"positioned_text"})),tables:[]})),warnings:[],textAvailable:true,extractionStatus:"completed" }; }

test("reconciliation excludes supplier-declared alternatives without losing their evidence", () => {
  const rows = [
    { displayReference: "W0.04", totalPrice: "2661.39", includedInSupplierTotal: true },
    { displayReference: "W0.04ALT", totalPrice: "1188.38", includedInSupplierTotal: false },
    { displayReference: "W0.05", totalPrice: "400.00", includedInSupplierTotal: true },
  ];
  const result = reconcileCommercialSummary(rows, { productSubtotal: null, additionalItemsSubtotal: null, deliveryTotal: "100.00", vatTotal: null, finalSupplierTotal: "3161.39" }, [{ category: "delivery", totalPrice: "100.00" }]);
  assert.equal(result.positionSubtotal, "3061.39"); assert.equal(result.expectedFinal, "3161.39"); assert.equal(result.reconciled, true);
  assert.equal(rows[1].totalPrice, "1188.38");
});

test("reconciliation reports an unexplained discrepancy and never fabricates a correction", () => {
  const result = reconcileCommercialSummary([{ totalPrice: "100.00", includedInSupplierTotal: true }], { productSubtotal: null, additionalItemsSubtotal: null, deliveryTotal: null, vatTotal: null, finalSupplierTotal: "101.00" }, []);
  assert.equal(result.positionSubtotal, "100.00"); assert.equal(result.expectedFinal, "100.00"); assert.equal(result.reconciled, false); assert.match(result.warnings.join(" "), /does not reconcile/);
});

test("document metadata survives extraction persistence without leaking into W0.01", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "qs-hardening-")); const db = await open({ filename: path.join(root, "test.db"), driver: sqlite3.Database }); t.after(async () => { await db.close(); await rm(root, { recursive: true, force: true }); });
  await db.exec("PRAGMA foreign_keys=ON;CREATE TABLE estimates(id TEXT PRIMARY KEY);"); await initializeSupplierCommercialSchema(db); const createdAt = new Date().toISOString();
  await db.run("INSERT INTO supplier_import_lab_sessions(id,supplier_name,currency,status,created_at,updated_at) VALUES('lab','Zyle','EUR','uploaded',?,?)", createdAt, createdAt);
  await db.run("INSERT INTO supplier_import_lab_attachments(id,session_id,role,original_file_name,media_type,size_bytes,sha256,storage_key,parser_eligible,created_at) VALUES('lab-file','lab','original_quote','343718.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',100,?,'lab/lab-file',1,?)", "b".repeat(64), createdAt);
  const lines = ["Customer: Eco Fenster", "Reference: The Aviary", "Date: 2026-04-08", "PRICE OFFER No.: 343718", "W0.01", "W0.01: Utility (1pcs)", "Price, EUR", "Qty", "Total, EUR", "900x1200mm", "1.08m²", "500.00", "1", "500.00"];
  const document = { attachmentId: "lab-file", sessionId: "lab", mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extractorName: "synthetic", extractorVersion: "1", createdAt, pages: [{ pageNumber: null, pageLabel: "1", width: null, height: null, text: lines.join("\n"), blocks: lines.map((text, readingOrder) => ({ id: `b${readingOrder}`, text, pageNumber: null, boundingBox: null, readingOrder, sourceType: "paragraph" })), tables: [] }], warnings: [], textAvailable: true, extractionStatus: "completed" };
  const parsed = parseCommercialFields(document, { currency: "EUR" }); const service = createSupplierImportLabExtractionService(db); const run = await service.createRun("lab", "lab-file"); await service.completeRun(run!.id, document, parsed);
  const reloaded = await service.getRun("lab", run!.id); const rows = await service.listRows("lab", run!.id); assert.equal(reloaded!.supplierCustomer, "Eco Fenster"); assert.equal(reloaded!.projectReference, "The Aviary"); assert.equal(reloaded!.quotationDate, "2026-04-08"); assert.equal(reloaded!.quotationProposal.supplierQuotationNumber, "343718"); assert.equal(rows![0].displayReference, "W0.01"); assert.equal(JSON.stringify(rows![0]).includes("Eco Fenster"), false);
});

test("metadata label cleanup removes delimiter punctuation but preserves meaningful punctuation", () => { const parsed=parseCommercialFields({...extracted([]),mediaType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",pages:extracted(["Customer: Smith, Jones & Co.","Reference: The Aviary,","PRICE OFFER No. 343718"]).pages},{currency:"EUR"});assert.equal(parsed.metadata.supplierCustomer,"Smith, Jones & Co.");assert.equal(parsed.metadata.projectReference,"The Aviary"); });

test("EKO-OKNA itemised PDF adapter preserves rows, dimensions, GBP prices and explicit total",()=>{const lines=["EKO-OKNA S.A.","ECOFENSTER LTD, COMP. NR- SC767598","Quotation OF/25/2263569","18/11/2025","Window 001","Qty : 1","Dimensions 1227 mm x 1265 mm","Window price","436,31 £","Window 002","Qty : 1","Dimensions 552 mm x 1265 mm","Window price","256,81 £","Totals","Total","693,12 £"];const document=extracted(lines);const parsed=parseCommercialFields(document,{currency:"EUR"});const summary=parseCommercialSummary(document,{currency:"EUR",positionRows:parsed.rows});assert.equal(parsed.adapter,"eko_okna_winpro_v1");assert.deepEqual(parsed.rows.map(row=>row.displayReference),["001","002"]);assert.deepEqual(parsed.rows.map(row=>row.totalPrice),["436.31","256.81"]);assert.equal(parsed.rows[0].widthMm,1227);assert.equal(parsed.quotation.fullQuotationReference,"OF/25/2263569");assert.equal(summary.summary?.finalSupplierTotal,"693.12");assert.equal(summary.summary?.reconciliation.reconciled,true);});

test("Gutmann itemised PDF adapter preserves page source order and does not create total rows",()=>{const p1=["3100","1600","GF-W-W1 (Fixed)","Price","Window","£925.17","Client:","Owain Parry","Price details WEB/25/1064272","07/08/2025","Your reference: Timber Alu, Triple","Window 001","Quantity: 1","System: [GUTMANN] Naturo 80 ALU (MIRA)"];const p2=["2500","1200","FF-E-W17","Price","Window","£1,604.15","Window 002","Quantity: 1","System: [GUTMANN] Naturo 80 ALU (MIRA)","TOTAL","Net price","£2,529.32","TOTAL price","£2,529.32"];const document=extracted([], {1:p1,2:p2});const parsed=parseCommercialFields(document,{currency:"EUR"});const summary=parseCommercialSummary(document,{currency:"EUR",positionRows:parsed.rows});assert.equal(parsed.adapter,"gutmann_web_v1");assert.deepEqual(parsed.rows.map(row=>row.displayReference),["001","002"]);assert.deepEqual(parsed.rows.map(row=>row.ordinal),[0,1]);assert.equal(parsed.rows.some(row=>/TOTAL/i.test(row.displayReference)),false);assert.equal(summary.summary?.finalSupplierTotal,"2529.32");assert.equal(summary.summary?.reconciliation.reconciled,true);});

test("Internorm Type C schedule owns unpriced order while covering quotation owns selected total",()=>{const schedule=extracted(["Glass Worx Limited","Offer number: 20250172","10.07.2025","25 - 116 - Owain Parry - Schedule","Pos.","Quantity","Description","100","1,00","Unit","GF-W-W1:","Width:","3000mm","Height:","420mm","110","1,00","Unit","GF-W-D1-A:","Width:","3000mm","Height:","1650mm"]);const fields=parseCommercialFields(schedule,{currency:"GBP"});const scheduleSummary=parseCommercialSummary(schedule,{currency:"GBP",positionRows:fields.rows});assert.equal(fields.adapter,"internorm_schedule_v1");assert.deepEqual(fields.rows.map(row=>row.displayReference),["GF-W-W1","GF-W-D1-A"]);assert.deepEqual(fields.rows.map(row=>row.totalPrice),[null,null]);assert.equal(scheduleSummary.summary,null);const cover=extracted(["Glass Worx Ltd","YOUR PROJECT COSTS","Our Reference","25 - 116 - Owain Parry","Prepared for","Craig Ferguson","Date","10.07.2025","Supply Only","Install Support","Full Installation","80,258.73","82,786.66","96,700.99"]);const coverFields=parseCommercialFields(cover,{currency:"GBP"});const coverSummary=parseCommercialSummary(cover,{currency:"GBP",positionRows:fields.rows});assert.equal(coverFields.rows.length,0);assert.equal(coverSummary.summary?.finalSupplierTotal,"82786.66");assert.equal(coverSummary.summary?.reconciliation.reconciled,false);assert.match(coverSummary.warnings.join(" "),/unpriced/i);assert.equal(fields.rows[0].sourceTrace[0].attachmentId,"fixture");assert.equal(coverSummary.summary?.sourceTrace.every(trace=>trace.attachmentId==="fixture"),true);});
