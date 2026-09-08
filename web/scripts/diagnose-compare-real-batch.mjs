import express from "express";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { initializeSupplierCommercialSchema } from "../server/schema/supplierCommercialSchema.js";
import { createSupplierQuotesRouter } from "../server/routes/supplierQuotes.js";

const sourceRoot = path.resolve("docs", "Supplier_Quotes", "Competitor_Quotes_-_ Nick_Corlett_Examples");
const sourceNames = [
  "21degrees.pdf",
  "Idealcombi.pdf",
  "Internorm-Aspect.pdf",
  "Internorm-Ecohaus.pdf",
  "Nordvest.pdf",
  "Norrsken.pdf",
  "Rationel-Aspect.pdf",
  "Velfac-Frame.pdf",
  "Westcoast1.pdf",
  "Westcoast2.pdf",
];
const requestedCount = Number(process.argv[2] || 10);
if (![1, 2, 5, 10].includes(requestedCount)) throw new Error("Use a batch size of 1, 2, 5 or 10.");

const root = await mkdtemp(path.join(os.tmpdir(), `qs-compare-real-${requestedCount}-`));
const db = await open({ filename: path.join(root, "acceptance.sqlite"), driver: sqlite3.Database });
const live = await open({ filename:path.resolve("quotesync.db"), driver:sqlite3.Database, mode:sqlite3.OPEN_READONLY });
let server;
const startedAt = Date.now();
try {
  const liveEstimate=await live.get("SELECT id,positions_json FROM estimates WHERE estimate_ref=? AND client_id=(SELECT id FROM clients WHERE client_ref=?) AND deleted_at IS NULL","EF-EST-2026-055","EF-CL-019");
  if(!liveEstimate)throw new Error("Exact EF-CL-019 / EF-EST-2026-055 baseline is unavailable.");
  await db.exec("PRAGMA foreign_keys=ON;CREATE TABLE clients(id TEXT PRIMARY KEY,client_ref TEXT,name TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE estimates(id TEXT PRIMARY KEY,client_id TEXT,project_id TEXT,estimate_ref TEXT,base_estimate_ref TEXT,revision_no INTEGER,status TEXT,outcome TEXT,positions_json TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);");
  await db.run("INSERT INTO clients VALUES('client','EF-CL-019','Disposable exact-source copy',datetime('now'),datetime('now'))");
  await db.run("INSERT INTO estimates VALUES('estimate','client',NULL,'EF-EST-2026-055','EF-EST-2026-055',0,'Draft','Open',?,datetime('now'),datetime('now'),NULL)",liveEstimate.positions_json);
  await initializeSupplierCommercialSchema(db);
  const app = express();
  app.use(express.json({ limit: "25mb" }));
  app.use("/api/estimates", await createSupplierQuotesRouter({ dbPromise: Promise.resolve(db), attachmentRoot: path.join(root, "attachments"), supplierServiceOptions: { fileSupplierAttachments: false } }));
  app.use((error, request, response, _next) => {
    console.error("diagnostic-api-error", { path: request.originalUrl, code: error?.code ?? null, message: error instanceof Error ? error.message : String(error), stack: error?.stack });
    response.status(Number(error?.status) || 500).json({ code: error?.code || "diagnostic_error", error: error instanceof Error ? error.message : String(error) });
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const port = server.address().port;
  const api = `http://127.0.0.1:${port}/api/estimates/estimate/supplier-quotes`;
  const json = async (url, options) => {
    const response = await fetch(url, options);
    const body = await response.text();
    if (!response.ok) throw new Error(`${response.status} ${body}`);
    return body ? JSON.parse(body) : null;
  };
  const memoryBefore = process.memoryUsage();
  const files=[];
  for(const [index,fileName] of sourceNames.slice(0,requestedCount).entries()){
    try{
      const quote=await json(api,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({supplierCode:`DIAG-${requestedCount}-${index}`,supplierName:"Automatic identification pending"})});
      const revision=await json(`${api}/${quote.id}/revisions`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({supplierQuotationNumber:"",fullQuotationReference:`Diagnostic ${fileName}`,currency:"XXX",vatStatus:"unknown"})});
      const form=new FormData();form.append("files",new Blob([await readFile(path.join(sourceRoot,fileName))],{type:"application/pdf"}),fileName);form.append("role","original_quote");form.append("documentKind","complete_quotation");
      const uploaded=await json(`${api}/${quote.id}/revisions/${revision.id}/attachments`,{method:"POST",body:form}),attachment=uploaded.attachments[0];
      const review=await json(`${api}/prepare-review`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({documents:[{quoteId:quote.id,revisionId:revision.id,attachmentId:attachment.id}]})});
      files.push({fileName,status:"analysed",positions:review.positionCount,adapter:review.documents[0]?.adapter,supplier:review.metadata.recognizedSupplierName||review.metadata.recognizedCommercialSupplierName||null,reference:review.metadata.quotationNumber||null});
    }catch(error){files.push({fileName,status:"failed",error:error instanceof Error?error.message:String(error)});}
  }
  const memoryAfter = process.memoryUsage();
  const health=await fetch(`${api.replace(/\/estimate\/supplier-quotes$/,"")}/estimate/supplier-quotes`).then(response=>response.status).catch(()=>0);
  console.log(JSON.stringify({requestedCount,architecture:"one retained quotation + one bounded prepare-review request per source",analysed:files.filter(file=>file.status==="analysed").length,failed:files.filter(file=>file.status==="failed").length,positionCount:files.reduce((sum,file)=>sum+Number(file.positions||0),0),apiHealthyAfterBatch:health===200,baseline:{estimateRef:"EF-EST-2026-055",revision:0,canonicalPositions:JSON.parse(liveEstimate.positions_json).length},elapsedMs:Date.now()-startedAt,memoryBefore,memoryAfter,files},null,2));
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await live.close();
  await db.close();
  await rm(root, { recursive: true, force: true });
}
