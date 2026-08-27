import express from "express";
import { dbPromise } from "../db.js";
import { createDocumentRecordsService } from "../features/documents/documentRecordsService.js";
import { createDriveIntegrationService } from "../features/documents/driveIntegrationService.js";

export function createDocumentsRouter({ databasePromise = dbPromise, driveServiceOptions } = {}) {
  const router = express.Router();
  router.get("/", async (req, res) => {
    try {
      const service = createDocumentRecordsService(await databasePromise);
      res.json(await service.list({
        enquiryId: String(req.query.enquiry_id || "").trim() || null,
        clientId: String(req.query.client_id || "").trim() || null,
        projectId: String(req.query.project_id || "").trim() || null,
        estimateId: String(req.query.estimate_id || "").trim() || null,
      }));
    } catch (error) {
      res.status(Number(error?.status) || 500).json({ error: Number(error?.status) ? error.message : "Documents could not be loaded." });
    }
  });
  router.post("/sync", async (req, res) => {
    try {
      const service = createDriveIntegrationService(await databasePromise, driveServiceOptions);
      res.json(await service.syncDocuments({
        enquiryId: String(req.body?.enquiry_id || "").trim() || null,
        clientId: String(req.body?.client_id || "").trim() || null,
        projectId: String(req.body?.project_id || "").trim() || null,
        estimateId: String(req.body?.estimate_id || "").trim() || null,
      }));
    } catch (error) {
      res.status(Number(error?.status) || 500).json({ error: error instanceof Error ? error.message : "Google Drive sync failed." });
    }
  });
  return router;
}
