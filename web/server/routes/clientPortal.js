import express from "express";
import { createPortalSecurityService, PORTAL_SESSION_COOKIE } from "../features/clientPortal/portalSecurityService.js";
import { CURRENT_APP_USER } from "../currentUser.js";

function cookieValue(header, name) {
  const prefix = `${name}=`;
  return String(header || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length) || null;
}

function fail(res, error) {
  const status = Number(error?.status) || 500;
  return res.status(status).json({ error: error instanceof Error ? error.message : "Portal operation failed.", code: String(error?.code || "portal_operation_failed") });
}

export function createClientPortalRouter({ databasePromise, externalAccessEnabled = false, serviceOptions = {} } = {}) {
  if (!databasePromise) throw new Error("Client Portal router requires an explicit databasePromise.");
  const router = express.Router();
  const service = async () => createPortalSecurityService(await databasePromise, serviceOptions);

  router.use((_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    res.set("Referrer-Policy", "no-referrer");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("X-Frame-Options", "DENY");
    next();
  });

  router.get("/status", (_req, res) => res.json({ externalAccessEnabled: Boolean(externalAccessEnabled), authenticationMode: externalAccessEnabled ? "provider_required" : "blocked", sessionStorage: "secure_http_only_cookie", customerCommandsEnabled: Boolean(externalAccessEnabled) }));
  router.get("/internal/clients/:clientId/status", async (req, res) => { try { return res.json(await (await service()).internalClientSummary(req.params.clientId)); } catch (error) { return fail(res, error); } });
  router.get("/internal/features", async (_req, res) => { try { return res.json(await (await service()).listFeatureControls()); } catch (error) { return fail(res, error); } });
  router.put("/internal/features/:featureKey", async (req, res) => { try { return res.json(await (await service()).setFeatureControl(req.params.featureKey, req.body?.enabled === true, CURRENT_APP_USER.id)); } catch (error) { return fail(res, error); } });
  router.get("/internal/directory", async (req, res) => { try { return res.json(await (await service()).internalPortalDirectory(req.query.search)); } catch (error) { return fail(res, error); } });
  router.get("/internal/clients/:clientId/projects/:projectId/preview", async (req, res) => { try { return res.json(await (await service()).internalProjectPreview(req.params.clientId, req.params.projectId)); } catch (error) { return fail(res, error); } });

  router.use("/external", (req, res, next) => {
    if (!externalAccessEnabled) return res.status(503).json({ error: "External Client Portal access is not enabled. Production identity-provider and deployment security approval remain required.", code: "portal_external_access_disabled" });
    return next();
  });

  router.post("/external/invitations/accept", async (req, res) => {
    try {
      const result = await (await service()).acceptInvitation({ token: req.body?.token, identityAssertion: req.body?.identityAssertion });
      res.cookie(PORTAL_SESSION_COOKIE, result.sessionToken, { secure: true, httpOnly: true, sameSite: "strict", path: "/api/client-portal/external", maxAge: Math.max(0, new Date(result.session.absoluteExpiresAt).getTime() - Date.now()) });
      return res.json({ session: result.session, csrfToken: result.csrfToken });
    } catch (error) { return fail(res, error); }
  });

  router.use("/external", async (req, res, next) => {
    try {
      const rawToken = cookieValue(req.headers.cookie, PORTAL_SESSION_COOKIE);
      req.portalSession = await (await service()).authenticateSession(rawToken, { requireCsrf: ["POST", "PUT", "PATCH", "DELETE"].includes(req.method), csrfToken: req.get("X-Portal-CSRF") });
      return next();
    } catch (error) { return fail(res, error); }
  });

  router.post("/external/logout", async (req, res) => {
    try {
      const rawToken = cookieValue(req.headers.cookie, PORTAL_SESSION_COOKIE);
      await (await service()).revokeSession(rawToken, "logout");
      res.clearCookie(PORTAL_SESSION_COOKIE, { secure: true, httpOnly: true, sameSite: "strict", path: "/api/client-portal/external" });
      return res.json({ success: true });
    } catch (error) { return fail(res, error); }
  });
  router.get("/external/projects/:projectId", async (req, res) => { try { return res.json(await (await service()).getProjectPortal(req.portalSession, req.params.projectId)); } catch (error) { return fail(res, error); } });
  router.get("/external/projects/:projectId/estimates/:releaseId", async (req, res) => { try { return res.json(await (await service()).getReleasedEstimate(req.portalSession, req.params.projectId, req.params.releaseId)); } catch (error) { return fail(res, error); } });
  router.get("/external/projects/:projectId/documents/:documentId", async (req, res) => { try { return res.json(await (await service()).getReleasedDocument(req.portalSession, req.params.projectId, req.params.documentId)); } catch (error) { return fail(res, error); } });
  router.post("/external/projects/:projectId/estimates/:releaseId/review-started", async (req, res) => { try { return res.status(201).json(await (await service()).startReview(req.portalSession, { projectId: req.params.projectId, estimateReleaseId: req.params.releaseId })); } catch (error) { return fail(res, error); } });
  router.post("/external/projects/:projectId/estimates/:releaseId/review", async (req, res) => { try { return res.status(201).json(await (await service()).submitReview(req.portalSession, { ...req.body, projectId: req.params.projectId, estimateReleaseId: req.params.releaseId, idempotencyKey: req.get("Idempotency-Key") })); } catch (error) { return fail(res, error); } });
  router.post("/external/projects/:projectId/estimates/:releaseId/decline", async (req, res) => { try { return res.status(201).json(await (await service()).declineEstimate(req.portalSession, { ...req.body, projectId: req.params.projectId, estimateReleaseId: req.params.releaseId, idempotencyKey: req.get("Idempotency-Key") })); } catch (error) { return fail(res, error); } });
  router.post("/external/projects/:projectId/estimates/:releaseId/intent-to-proceed", async (req, res) => { try { return res.status(202).json(await (await service()).indicateIntentToProceed(req.portalSession, { ...req.body, projectId: req.params.projectId, estimateReleaseId: req.params.releaseId, idempotencyKey: req.get("Idempotency-Key") })); } catch (error) { return fail(res, error); } });

  return router;
}
