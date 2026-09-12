import express from "express";
import { createServiceCaseService } from "../features/service/serviceCaseService.js";
import { CURRENT_APP_USER } from "../currentUser.js";

const respondError = (res, error) => res.status(Number(error?.status) || 500).json({ error: error instanceof Error ? error.message : "Service request failed.", code: error?.code || "service_request_failed" });

export function createServiceRouter({ databasePromise, serviceOptions } = {}) {
  const router = express.Router();
  const service = async () => createServiceCaseService(await databasePromise, serviceOptions);
  router.get("/cases", async (req, res) => { try { res.json(await (await service()).list(req.query)); } catch (error) { respondError(res, error); } });
  router.post("/cases", async (req, res) => { try { res.status(201).json(await (await service()).create(req.body)); } catch (error) { respondError(res, error); } });
  router.get("/cases/:caseId", async (req, res) => { try { res.json(await (await service()).get(req.params.caseId)); } catch (error) { respondError(res, error); } });
  router.put("/cases/:caseId", async (req, res) => { try { res.json(await (await service()).update(req.params.caseId, req.body)); } catch (error) { respondError(res, error); } });
  router.post("/cases/:caseId/reopen", async (req, res) => { try { res.json(await (await service()).reopen(req.params.caseId, req.body)); } catch (error) { respondError(res, error); } });
  router.post("/cases/:caseId/updates", async (req, res) => { try { res.status(201).json(await (await service()).addUpdate(req.params.caseId, req.body)); } catch (error) { respondError(res, error); } });
  router.post("/cases/:caseId/attachments", async (req, res) => { try { res.status(201).json(await (await service()).addAttachment(req.params.caseId, req.body, { type: "staff", id: CURRENT_APP_USER.id })); } catch (error) { respondError(res, error); } });
  router.get("/cases/:caseId/attachments/:attachmentId", async (req, res) => { try { const file = await (await service()).attachment(req.params.caseId, req.params.attachmentId); res.set("Content-Type", file.mediaType); res.set("Content-Disposition", `inline; filename="${file.fileName.replaceAll('"', '')}"`); res.set("Content-Length", String(file.bytes.length)); res.send(file.bytes); } catch (error) { respondError(res, error); } });
  router.get("/configuration", async (_req, res) => { try { const instance = await service(); res.json({ teams: await instance.responsibilities.listConfiguration(), policies: await instance.listPolicies() }); } catch (error) { respondError(res, error); } });
  router.post("/configuration/teams", async (req, res) => { try { res.json(await (await service()).responsibilities.saveTeam(req.body)); } catch (error) { respondError(res, error); } });
  router.post("/configuration/routing", async (req, res) => { try { res.json(await (await service()).responsibilities.saveRoutingRule(req.body)); } catch (error) { respondError(res, error); } });
  router.post("/configuration/policies", async (req, res) => { try { res.json(await (await service()).savePolicy(req.body)); } catch (error) { respondError(res, error); } });
  return router;
}
