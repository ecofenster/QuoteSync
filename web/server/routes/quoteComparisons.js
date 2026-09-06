import express from "express";
import { CURRENT_APP_USER } from "../currentUser.js";
import { createQuoteComparisonService } from "../features/quoteComparisons/quoteComparisonService.js";

const respondError = (res, error) => res.status(Number(error?.status) || 500).json({
  error: error instanceof Error ? error.message : "Quote comparison request failed.",
  code: error?.code || "quote_comparison_failed",
});

const resolveDatabase = async (databasePromise) => databasePromise ? await databasePromise : await (await import("../db.js")).dbPromise;

export function createQuoteComparisonsRouter({ databasePromise = null } = {}) {
  const router = express.Router();
  router.get("/", async (req, res) => {
    try {
      const clientId = String(req.query.client_id || "").trim();
      if (!clientId) return res.status(400).json({ error: "client_id is required", code: "client_required" });
      res.json(await createQuoteComparisonService(await resolveDatabase(databasePromise)).listForClient(clientId));
    } catch (error) { respondError(res, error); }
  });
  router.get("/:comparisonId", async (req, res) => {
    try {
      const comparison = await createQuoteComparisonService(await resolveDatabase(databasePromise)).get(req.params.comparisonId);
      return comparison ? res.json(comparison) : res.status(404).json({ error: "Comparison not found.", code: "comparison_not_found" });
    } catch (error) { respondError(res, error); }
  });
  router.post("/", async (req, res) => {
    try { res.status(201).json(await createQuoteComparisonService(await resolveDatabase(databasePromise)).create(req.body, CURRENT_APP_USER.id)); }
    catch (error) { respondError(res, error); }
  });
  router.patch("/:comparisonId/mappings/:mappingId", async (req, res) => {
    try {
      const comparison = await createQuoteComparisonService(await resolveDatabase(databasePromise)).correctMapping(req.params.comparisonId, req.params.mappingId, req.body || {}, CURRENT_APP_USER.id);
      return comparison ? res.json(comparison) : res.status(404).json({ error: "Comparison mapping not found.", code: "comparison_mapping_not_found" });
    } catch (error) { respondError(res, error); }
  });
  router.post("/:comparisonId/approve", async (req, res) => {
    try {
      const comparison = await createQuoteComparisonService(await resolveDatabase(databasePromise)).approve(req.params.comparisonId, CURRENT_APP_USER.id);
      return comparison ? res.json(comparison) : res.status(404).json({ error: "Comparison not found.", code: "comparison_not_found" });
    } catch (error) { respondError(res, error); }
  });
  return router;
}
