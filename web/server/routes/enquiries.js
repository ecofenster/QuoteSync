import express from "express";
import { dbPromise } from "../db.js";
import { createCommercialIdentityService } from "../features/commercialIdentity/commercialIdentityService.js";
import { createCommercialDriveService } from "../features/documents/commercialDriveService.js";

const fail = (res, error) => res.status(Number(error?.status) || 500).json({ error: error instanceof Error ? error.message : "Enquiry request failed.", code: error?.code || "enquiry_error" });

export function createEnquiriesRouter({ databasePromise = dbPromise, driveServiceOptions } = {}) {
  const router = express.Router();
  const service = async () => { const db = await databasePromise; return createCommercialIdentityService(db, { driveTransitions: createCommercialDriveService(db, driveServiceOptions) }); };
  router.get("/", async (req, res) => { try { res.json(await (await service()).listEnquiries({ includeConverted: req.query.include_converted !== "0" })); } catch (error) { fail(res, error); } });
  router.post("/", async (req, res) => { try { res.status(201).json(await (await service()).createEnquiry(req.body)); } catch (error) { fail(res, error); } });
  router.post("/:id/qualify", async (req, res) => { try { res.json(await (await service()).qualifyEnquiry(req.params.id, req.body)); } catch (error) { fail(res, error); } });
  return router;
}

export default createEnquiriesRouter();
