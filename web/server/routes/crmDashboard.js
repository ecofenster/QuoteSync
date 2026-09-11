import express from "express";
import { createCrmDashboardService } from "../features/crm/crmDashboardService.js";

const fail = (res, error) => res.status(Number(error?.status) || 500).json({ error: error instanceof Error ? error.message : "CRM request failed.", code: error?.code || "crm_request_failed" });

export function createCrmDashboardRouter({ databasePromise, serviceOptions } = {}) {
  const router = express.Router();
  const service = async () => {
    if (!databasePromise) throw Object.assign(new Error("CRM database is unavailable."), { status: 503, code: "crm_database_unavailable" });
    return createCrmDashboardService(await databasePromise, serviceOptions);
  };
  router.get("/dashboard", async (_req, res) => { try { res.json(await (await service()).dashboard()); } catch (error) { fail(res, error); } });
  router.get("/search", async (req, res) => { try { res.json(await (await service()).search(req.query.q, req.query.limit)); } catch (error) { fail(res, error); } });
  router.put("/work-state/:recordKind/:recordId", async (req, res) => { try { res.json(await (await service()).updateWorkState(req.params.recordKind, req.params.recordId, req.body)); } catch (error) { fail(res, error); } });
  return router;
}
