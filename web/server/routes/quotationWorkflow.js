import express from "express";
import { dbPromise } from "../db.js";
import { createIssuedQuotationService } from "../features/customerQuotations/issuedQuotationService.js";

export function createQuotationWorkflowRouter({ databasePromise = dbPromise, serviceOptions } = {}) {
  const router = express.Router(), service = async () => createIssuedQuotationService(await databasePromise, serviceOptions);
  const fail = (res, error) => res.status(Number(error?.status) || 500).json({ error: error instanceof Error ? error.message : "Quotation workflow operation failed.", ...(error?.issuedQuotationId ? { issuedQuotationId: error.issuedQuotationId } : {}) });
  router.post("/prepare", async (req, res) => { try { res.status(201).json(await (await service()).prepare(req.body || {})); } catch (error) { fail(res, error); } });
  router.get("/issued/:id", async (req, res) => { try { const value = await (await service()).get(req.params.id); value ? res.json(value) : res.status(404).json({ error: "Issued quotation not found." }); } catch (error) { fail(res, error); } });
  router.post("/issued/:id/send", async (req, res) => { try { res.json(await (await service()).send(req.params.id, req.body || {})); } catch (error) { fail(res, error); } });
  router.get("/issued/:id/document", async (req, res) => { try { const issued = await (await service()).get(req.params.id); if (!issued?.document) return res.status(404).json({ error: "Quotation document not found." }); const file = await (await service()).documents.read(issued.document.id); res.setHeader("Content-Type", file.document.mediaType); res.setHeader("Content-Disposition", `attachment; filename=\"${file.document.fileName.replaceAll('"', '')}\"`); res.setHeader("Content-Length", String(file.bytes.length)); return res.send(file.bytes); } catch (error) { return fail(res, error); } });
  router.get("/estimates/:estimateId/state", async (req, res) => { try { res.json(await (await service()).estimateState(req.params.estimateId)); } catch (error) { fail(res, error); } });
  return router;
}
