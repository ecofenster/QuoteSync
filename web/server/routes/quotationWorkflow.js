import express from "express";
import { createIssuedQuotationService } from "../features/customerQuotations/issuedQuotationService.js";
import { renderCustomerLifecyclePdf } from "../features/customerQuotations/customerLifecycleDocumentRenderer.js";

export function createQuotationWorkflowRouter({ databasePromise, serviceOptions } = {}) {
  if(!databasePromise)throw new Error("createQuotationWorkflowRouter requires databasePromise.");
  const router = express.Router(), service = async () => createIssuedQuotationService(await databasePromise, serviceOptions);
  const fail = (res, error) => res.status(Number(error?.status) || 500).json({ error: error instanceof Error ? error.message : "Quotation workflow operation failed.", ...(error?.code ? { code:error.code } : {}), ...(error?.issuedQuotationId ? { issuedQuotationId: error.issuedQuotationId } : {}), ...(error?.details ? { details:error.details } : {}) });
  router.post("/prepare", async (req, res) => { try { res.status(201).json(await (await service()).prepare(req.body || {})); } catch (error) { fail(res, error); } });
  router.post("/preview-document", async (req, res) => { try { const projection = req.body?.projection; const bytes = await renderCustomerLifecyclePdf({ kind: "estimate", projection, context: { reference: projection?.estimateReference, revision: projection?.commercialRevision, documentDate: projection?.previewDate } }); res.setHeader("Content-Type", "application/pdf"); res.setHeader("Content-Disposition", `attachment; filename=\"${String(projection?.estimateReference || 'Estimate').replace(/[^A-Za-z0-9_-]+/g, '-')}-Estimate.pdf\"`); res.setHeader("Content-Length", String(bytes.length)); return res.send(bytes); } catch (error) { fail(res, error); } });
  router.get("/issued/:id", async (req, res) => { try { const value = await (await service()).get(req.params.id); value ? res.json(value) : res.status(404).json({ error: "Issued quotation not found." }); } catch (error) { fail(res, error); } });
  router.post("/issued/:id/send", async (req, res) => { try { res.json(await (await service()).send(req.params.id, req.body || {})); } catch (error) { fail(res, error); } });
  router.get("/issued/:id/document", async (req, res) => { try { const issued = await (await service()).get(req.params.id); if (!issued?.document) return res.status(404).json({ error: "Quotation document not found." }); const file = await (await service()).documents.read(issued.document.id); res.setHeader("Content-Type", file.document.mediaType); res.setHeader("Content-Disposition", `attachment; filename=\"${file.document.fileName.replaceAll('"', '')}\"`); res.setHeader("Content-Length", String(file.bytes.length)); return res.send(file.bytes); } catch (error) { return fail(res, error); } });
  router.get("/estimates/:estimateId/state", async (req, res) => { try { res.json(await (await service()).estimateState(req.params.estimateId)); } catch (error) { fail(res, error); } });
  return router;
}
