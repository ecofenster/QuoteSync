import express from "express";
import { createPortalSecurityService, PORTAL_SESSION_COOKIE } from "../features/clientPortal/portalSecurityService.js";
import { CURRENT_APP_USER } from "../currentUser.js";
import { createCustomerQuotationDocumentService } from "../features/customerQuotations/customerQuotationDocumentService.js";
import { createCustomerLifecycleDocumentService } from "../features/lifecycle/customerLifecycleDocumentService.js";
import { createServiceCaseService } from "../features/service/serviceCaseService.js";

function cookieValue(header, name) {
  const prefix = `${name}=`;
  return String(header || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length) || null;
}

function fail(res, error) {
  const status = Number(error?.status) || 500;
  return res.status(status).json({ error: error instanceof Error ? error.message : "Portal operation failed.", code: String(error?.code || "portal_operation_failed") });
}

export function createClientPortalRouter({ databasePromise, externalAccessEnabled = false, serviceOptions = {}, cookieSecure = true, testAdapter = false } = {}) {
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

  router.get("/status", (_req, res) => res.json({ externalAccessEnabled: Boolean(externalAccessEnabled), authenticationMode: testAdapter ? "development_test_adapter" : externalAccessEnabled ? "provider_required" : "blocked", sessionStorage: "http_only_cookie", customerCommandsEnabled: Boolean(externalAccessEnabled), testAdapter: Boolean(testAdapter) }));
  router.get("/internal/clients/:clientId/status", async (req, res) => { try { return res.json(await (await service()).internalClientSummary(req.params.clientId)); } catch (error) { return fail(res, error); } });
  router.get("/internal/features", async (_req, res) => { try { return res.json(await (await service()).listFeatureControls()); } catch (error) { return fail(res, error); } });
  router.put("/internal/features/:featureKey", async (req, res) => { try { return res.json(await (await service()).setFeatureControl(req.params.featureKey, req.body?.enabled === true, CURRENT_APP_USER.id)); } catch (error) { return fail(res, error); } });
  router.get("/internal/commitment-policy",async(_req,res)=>{try{return res.json(await(await service()).getCommitmentPolicy());}catch(error){return fail(res,error);}});
  router.put("/internal/commitment-policy",async(req,res)=>{try{return res.json(await(await service()).setCommitmentPolicy({...req.body,updatedBy:CURRENT_APP_USER.id}));}catch(error){return fail(res,error);}});
  router.post("/internal/invitations", async (req,res)=>{try{return res.status(201).json(await(await service()).createInvitation({...req.body,createdBy:CURRENT_APP_USER.id}));}catch(error){return fail(res,error);}});
  router.post("/internal/invitations/:invitationId/revoke", async (req,res)=>{try{return res.json(await(await service()).revokeInvitation(req.params.invitationId,CURRENT_APP_USER.id));}catch(error){return fail(res,error);}});
  router.get("/internal/directory", async (req, res) => { try { return res.json(await (await service()).internalPortalDirectory(req.query.search)); } catch (error) { return fail(res, error); } });
  router.get("/internal/clients/:clientId/projects/:projectId/preview", async (req, res) => { try { return res.json(await (await service()).internalProjectPreview(req.params.clientId, req.params.projectId)); } catch (error) { return fail(res, error); } });

  router.use("/external", (req, res, next) => {
    if (!externalAccessEnabled) return res.status(503).json({ error: "External Client Portal access is not enabled. Production identity-provider and deployment security approval remain required.", code: "portal_external_access_disabled" });
    return next();
  });

  router.post("/external/invitations/accept", async (req, res) => {
    try {
      const result = await (await service()).acceptInvitation({ token: req.body?.token, identityAssertion: req.body?.identityAssertion });
      res.cookie(PORTAL_SESSION_COOKIE, result.sessionToken, { secure: cookieSecure, httpOnly: true, sameSite: "strict", path: "/api/client-portal/external", maxAge: Math.max(0, new Date(result.session.absoluteExpiresAt).getTime() - Date.now()) });
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
      res.clearCookie(PORTAL_SESSION_COOKIE, { secure: cookieSecure, httpOnly: true, sameSite: "strict", path: "/api/client-portal/external" });
      return res.json({ success: true });
    } catch (error) { return fail(res, error); }
  });
  router.get("/external/session", async (req, res) => { try { return res.json({ session: await (await service()).externalSessionContext(req.portalSession) }); } catch (error) { return fail(res, error); } });
  router.get("/external/projects/:projectId", async (req, res) => { try { return res.json(await (await service()).getProjectPortal(req.portalSession, req.params.projectId)); } catch (error) { return fail(res, error); } });
  const portalServiceCases = async (req) => {
    const portal = await service();
    const projection = await portal.getProjectPortal(req.portalSession, req.params.projectId);
    if (!projection.features.some((item) => item.featureKey === "service" && item.enabled)) throw Object.assign(new Error("Service reporting is not enabled for this Portal."), { status: 403, code: "portal_service_disabled" });
    return createServiceCaseService(await databasePromise, { tenantId: req.portalSession.tenantId });
  };
  router.get("/external/projects/:projectId/service-cases", async (req,res)=>{try{const cases=await portalServiceCases(req);return res.json(await cases.list({}, {tenantId:req.portalSession.tenantId,clientId:req.portalSession.clientId,projectId:req.params.projectId}));}catch(error){return fail(res,error);}});
  router.post("/external/projects/:projectId/service-cases", async (req,res)=>{try{const cases=await portalServiceCases(req);return res.status(201).json(await cases.create(req.body,{type:"customer",id:req.portalSession.portalContactId},{tenantId:req.portalSession.tenantId,clientId:req.portalSession.clientId,projectId:req.params.projectId}));}catch(error){return fail(res,error);}});
  router.get("/external/projects/:projectId/service-cases/:caseId", async (req,res)=>{try{const cases=await portalServiceCases(req);return res.json(await cases.get(req.params.caseId,{tenantId:req.portalSession.tenantId,clientId:req.portalSession.clientId,projectId:req.params.projectId},{includeInternal:false}));}catch(error){return fail(res,error);}});
  router.post("/external/projects/:projectId/service-cases/:caseId/comments", async (req,res)=>{try{const cases=await portalServiceCases(req);return res.status(201).json(await cases.addUpdate(req.params.caseId,req.body,{type:"customer",id:req.portalSession.portalContactId},{tenantId:req.portalSession.tenantId,clientId:req.portalSession.clientId,projectId:req.params.projectId}));}catch(error){return fail(res,error);}});
  router.post("/external/projects/:projectId/service-cases/:caseId/attachments", async (req,res)=>{try{const cases=await portalServiceCases(req);return res.status(201).json(await cases.addAttachment(req.params.caseId,req.body,{type:"customer",id:req.portalSession.portalContactId},{tenantId:req.portalSession.tenantId,clientId:req.portalSession.clientId,projectId:req.params.projectId}));}catch(error){return fail(res,error);}});
  router.get("/external/projects/:projectId/service-cases/:caseId/attachments/:attachmentId", async (req,res)=>{try{const cases=await portalServiceCases(req),file=await cases.attachment(req.params.caseId,req.params.attachmentId,{tenantId:req.portalSession.tenantId,clientId:req.portalSession.clientId,projectId:req.params.projectId},false);res.set("Content-Type",file.mediaType);res.set("Content-Disposition",`inline; filename="${file.fileName.replaceAll('"','')}"`);res.set("Content-Length",String(file.bytes.length));return res.send(file.bytes);}catch(error){return fail(res,error);}});
  router.get("/external/projects/:projectId/estimates/:releaseId", async (req, res) => { try { return res.json(await (await service()).getReleasedEstimate(req.portalSession, req.params.projectId, req.params.releaseId)); } catch (error) { return fail(res, error); } });
  router.get("/external/projects/:projectId/documents/:documentId", async (req, res) => { try { return res.json(await (await service()).getReleasedDocument(req.portalSession, req.params.projectId, req.params.documentId)); } catch (error) { return fail(res, error); } });
  router.get("/external/projects/:projectId/documents/:documentId/content", async (req, res) => {
    try {
      await (await service()).getReleasedDocument(req.portalSession, req.params.projectId, req.params.documentId);
      const db = await databasePromise;
      const lifecycle = await createCustomerLifecycleDocumentService(db, serviceOptions.documentOptions).read(req.params.documentId);
      const estimate = lifecycle ? null : await createCustomerQuotationDocumentService(db, serviceOptions.documentOptions).read(req.params.documentId);
      const file = lifecycle || estimate;
      if (!file) return res.status(409).json({ error: "This released provider document is retained as canonical evidence but has no application-managed download copy.", code: "portal_document_binary_provider_managed" });
      res.setHeader("Content-Type", file.document.mediaType);
      res.setHeader("Content-Disposition", `inline; filename=\"${file.document.fileName.replaceAll('"', '')}\"`);
      res.setHeader("Content-Length", String(file.bytes.length));
      return res.send(file.bytes);
    } catch (error) { return fail(res, error); }
  });
  router.post("/external/projects/:projectId/estimates/:releaseId/review-started", async (req, res) => { try { return res.status(201).json(await (await service()).startReview(req.portalSession, { projectId: req.params.projectId, estimateReleaseId: req.params.releaseId })); } catch (error) { return fail(res, error); } });
  router.post("/external/projects/:projectId/estimates/:releaseId/review", async (req, res) => { try { return res.status(201).json(await (await service()).submitReview(req.portalSession, { ...req.body, projectId: req.params.projectId, estimateReleaseId: req.params.releaseId, idempotencyKey: req.get("Idempotency-Key") })); } catch (error) { return fail(res, error); } });
  router.post("/external/projects/:projectId/estimates/:releaseId/decline", async (req, res) => { try { return res.status(201).json(await (await service()).declineEstimate(req.portalSession, { ...req.body, projectId: req.params.projectId, estimateReleaseId: req.params.releaseId, idempotencyKey: req.get("Idempotency-Key") })); } catch (error) { return fail(res, error); } });
  router.post("/external/projects/:projectId/estimates/:releaseId/intent-to-proceed", async (req, res) => { try { return res.status(202).json(await (await service()).indicateIntentToProceed(req.portalSession, { ...req.body, projectId: req.params.projectId, estimateReleaseId: req.params.releaseId, idempotencyKey: req.get("Idempotency-Key") })); } catch (error) { return fail(res, error); } });
  router.post("/external/projects/:projectId/estimates/:releaseId/accept", async (req, res) => { try { return res.status(201).json(await (await service()).acceptEstimate(req.portalSession, { ...req.body, projectId: req.params.projectId, estimateReleaseId: req.params.releaseId, idempotencyKey: req.get("Idempotency-Key") })); } catch (error) { return fail(res, error); } });
  router.post("/external/projects/:projectId/factory-confirmations/:releaseId/sign-off", async (req,res)=>{try{return res.status(201).json(await(await service()).signOffFactoryConfirmation(req.portalSession,{...req.body,projectId:req.params.projectId,factoryConfirmationReleaseId:req.params.releaseId,idempotencyKey:req.get("Idempotency-Key")}));}catch(error){return fail(res,error);}});

  return router;
}
