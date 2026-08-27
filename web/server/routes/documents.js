import express from "express";
import multer from "multer";
import { dbPromise } from "../db.js";
import { createDocumentRecordsService } from "../features/documents/documentRecordsService.js";
import { createDriveIntegrationService } from "../features/documents/driveIntegrationService.js";
import { createDocumentUploadService, MAX_DOCUMENT_UPLOAD_BYTES } from "../features/documents/documentUploadService.js";

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
  const upload = multer({ storage:multer.memoryStorage(), limits:{ files:1, fileSize:MAX_DOCUMENT_UPLOAD_BYTES } });
  router.post("/upload", (req, res) => upload.single("file")(req, res, async (uploadError) => {
    try {
      if (uploadError) throw Object.assign(new Error(uploadError.code === "LIMIT_FILE_SIZE" ? "The file exceeds QuoteSuite's 50 MB upload limit." : "The selected file could not be received."), { status:uploadError.code === "LIMIT_FILE_SIZE" ? 413 : 400 });
      const service = createDocumentUploadService(await databasePromise, driveServiceOptions);
      res.status(201).json(await service.upload({ file:req.file, provider:req.body?.provider, providerAccountId:req.body?.provider_account_id, providerFolderId:req.body?.provider_folder_id, enquiryId:req.body?.enquiry_id, clientId:req.body?.client_id, projectId:req.body?.project_id, estimateId:req.body?.estimate_id }));
    } catch (error) {
      res.status(Number(error?.status) || 500).json({ error:error instanceof Error ? error.message : "File upload failed." });
    }
  }));
  return router;
}
