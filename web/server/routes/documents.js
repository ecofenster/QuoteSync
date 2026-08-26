import express from "express";
import { dbPromise } from "../db.js";
import { createDocumentRecordsService } from "../features/documents/documentRecordsService.js";

export function createDocumentsRouter({ databasePromise = dbPromise } = {}) {
  const router = express.Router();
  router.get("/", async (req, res) => {
    try {
      const service = createDocumentRecordsService(await databasePromise);
      res.json(await service.list({ clientId: String(req.query.client_id || "").trim() || null, estimateId: String(req.query.estimate_id || "").trim() || null }));
    } catch (error) {
      res.status(Number(error?.status) || 500).json({ error: Number(error?.status) ? error.message : "Documents could not be loaded." });
    }
  });
  return router;
}
