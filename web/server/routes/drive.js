import express from "express";
import { dbPromise } from "../db.js";
import { createDriveIntegrationService } from "../features/documents/driveIntegrationService.js";

export function createDriveRouter({ databasePromise = dbPromise, serviceOptions } = {}) {
  const router = express.Router(), service = async () => createDriveIntegrationService(await databasePromise, serviceOptions);
  const fail = (res, error) => res.status(Number(error?.status) || 500).json({ error: error instanceof Error ? error.message : "Drive operation failed." });
  router.get("/status", async (_req, res) => { try { res.json(await (await service()).status()); } catch (error) { fail(res, error); } });
  router.post("/estimates/:estimateId/provision", async (req, res) => { try { res.json(await (await service()).provisionEstimate(req.params.estimateId, req.body?.supplierNames || [])); } catch (error) { fail(res, error); } });
  return router;
}
