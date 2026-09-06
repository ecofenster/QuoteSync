import express from "express";
import { CURRENT_APP_USER } from "../currentUser.js";
import { createManufacturerDocumentLibraryService } from "../features/manufacturerDocuments/manufacturerDocumentLibraryService.js";

const respondError = (res, error) => res.status(Number(error?.status) || 500).json({
  error: error instanceof Error ? error.message : "Manufacturer document request failed.",
  code: error?.code || "manufacturer_document_failed",
});

const resolveDatabase = async (databasePromise) => databasePromise ? await databasePromise : await (await import("../db.js")).dbPromise;

export function createManufacturerDocumentsRouter({ databasePromise = null } = {}) {
  const router = express.Router();
  router.get("/canonical-sources", async (req, res) => {
    try { res.json(await createManufacturerDocumentLibraryService(await resolveDatabase(databasePromise)).listCanonicalSources(req.query.search)); }
    catch (error) { respondError(res, error); }
  });
  router.get("/", async (req, res) => {
    try { res.json(await createManufacturerDocumentLibraryService(await resolveDatabase(databasePromise)).list({ ownerName: req.query.owner_name, productSystemName: req.query.product_system_name, category: req.query.category, status: req.query.status })); }
    catch (error) { respondError(res, error); }
  });
  router.post("/", async (req, res) => {
    try { res.status(201).json(await createManufacturerDocumentLibraryService(await resolveDatabase(databasePromise)).create(req.body, CURRENT_APP_USER.id)); }
    catch (error) { respondError(res, error); }
  });
  router.post("/:documentId/supersede", async (req, res) => {
    try {
      const result = await createManufacturerDocumentLibraryService(await resolveDatabase(databasePromise)).supersede(req.params.documentId, req.body || {}, CURRENT_APP_USER.id);
      return result ? res.status(201).json(result) : res.status(404).json({ error: "Library document not found.", code: "manufacturer_document_not_found" });
    } catch (error) { respondError(res, error); }
  });
  router.put("/:documentId/projects/:projectId", async (req, res) => {
    try { res.json(await createManufacturerDocumentLibraryService(await resolveDatabase(databasePromise)).linkToProject(req.params.documentId, req.params.projectId, req.body?.portalVisibility, CURRENT_APP_USER.id, req.body?.applicabilityEvidence || {})); }
    catch (error) { respondError(res, error); }
  });
  return router;
}
