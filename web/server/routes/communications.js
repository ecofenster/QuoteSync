import express from "express";
import { dbPromise } from "../db.js";
import { createCommunicationsService } from "../features/communications/communicationsService.js";

export function createCommunicationsRouter({ databasePromise = dbPromise, serviceOptions } = {}) {
  const router = express.Router(), service = async () => createCommunicationsService(await databasePromise, serviceOptions);
  const fail = (res, error) => res.status(Number(error?.status) || 500).json({ error: error instanceof Error ? error.message : "Communications operation failed." });
  router.get("/status", async (_req, res) => { try { res.json(await (await service()).status()); } catch (error) { fail(res, error); } });
  router.get("/messages", async (req, res) => { try { res.json(await (await service()).listMailbox({ folder: String(req.query.folder || "inbox"), query: String(req.query.q || ""), pageToken: req.query.page_token ? String(req.query.page_token) : null })); } catch (error) { fail(res, error); } });
  router.get("/messages/:providerMessageId", async (req, res) => { try { res.json(await (await service()).readMessage(req.params.providerMessageId)); } catch (error) { fail(res, error); } });
  router.get("/messages/:providerMessageId/attachments/:attachmentId", async (req, res) => { try { const bytes = await (await service()).readAttachment(req.params.providerMessageId, req.params.attachmentId); res.type("application/octet-stream").send(bytes); } catch (error) { fail(res, error); } });
  router.post("/drafts", async (req, res) => { try { res.status(201).json(await (await service()).createDraft(req.body || {})); } catch (error) { fail(res, error); } });
  router.post("/send", async (req, res) => { try { res.json(await (await service()).sendMessage(req.body || {})); } catch (error) { fail(res, error); } });
  router.post("/reply", async (req, res) => { try { res.json(await (await service()).reply(req.body || {})); } catch (error) { fail(res, error); } });
  router.post("/forward", async (req, res) => { try { res.json(await (await service()).forward(req.body || {})); } catch (error) { fail(res, error); } });
  return router;
}
