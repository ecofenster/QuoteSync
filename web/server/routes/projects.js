import express from "express";
import { dbPromise } from "../db.js";
import { createCommercialIdentityService } from "../features/commercialIdentity/commercialIdentityService.js";
import { createCommercialDriveService } from "../features/documents/commercialDriveService.js";

const fail = (res, error) => res.status(Number(error?.status) || 500).json({ error: error instanceof Error ? error.message : "Project request failed.", code: error?.code || "project_error" });

export function createProjectsRouter({ databasePromise = dbPromise, driveServiceOptions } = {}) {
  const router = express.Router();
  const service = async () => { const db = await databasePromise; return createCommercialIdentityService(db, { driveTransitions: createCommercialDriveService(db, driveServiceOptions) }); };
  router.get("/", async (req, res) => { try { res.json(await (await service()).listProjects({ clientId: String(req.query.client_id || "").trim() || null, projectId: String(req.query.project_id || "").trim() || null })); } catch (error) { fail(res, error); } });
  router.post("/", async (req, res) => { try { res.status(201).json(await (await service()).createProject(req.body)); } catch (error) { fail(res, error); } });
  return router;
}

export default createProjectsRouter();
