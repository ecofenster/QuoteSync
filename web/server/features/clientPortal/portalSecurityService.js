import { createHash, randomBytes, randomUUID } from "node:crypto";
import { CLIENT_PORTAL_FEATURES, PORTAL_DECLINE_REASONS, PORTAL_REVIEW_POSITION_RESPONSES } from "../../../shared/clientPortalContracts.js";
import { allocateCanonicalReference } from "../commercialIdentity/referenceAllocator.js";
import { createCustomerLifecycleDocumentService } from "../lifecycle/customerLifecycleDocumentService.js";

export const DEFAULT_PORTAL_TENANT_ID = "quotesuite-default";
export const PORTAL_SESSION_COOKIE = "qs_portal_session";

const sha256 = (value) => createHash("sha256").update(String(value)).digest("hex");
const parseJson = (value, fallback = null) => { try { return JSON.parse(value || ""); } catch { return fallback; } };
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const asText = (value) => String(value || "").trim();
const required = (value, label) => { const text = String(value || "").trim(); if (!text) throw portalError(400, "portal_input_required", `${label} is required.`); return text; };
const nowIso = (clock) => new Date(clock()).toISOString();
const plusMilliseconds = (iso, amount) => new Date(new Date(iso).getTime() + amount).toISOString();
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  return value;
};
const jsonHash = (value) => sha256(JSON.stringify(stable(value)));

export function portalError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

export function createPortalSecurityService(db, options = {}) {
  const clock = options.clock || (() => Date.now());
  const tokenFactory = options.tokenFactory || (() => randomBytes(32).toString("base64url"));
  const identityVerifier = options.identityVerifier || (async () => { throw portalError(503, "portal_identity_provider_not_configured", "A production portal identity provider has not been configured."); });
  const tenantId = String(options.tenantId || DEFAULT_PORTAL_TENANT_ID);
  const idleLifetimeMs = Number(options.idleLifetimeMs || 30 * 60 * 1000);
  const absoluteLifetimeMs = Number(options.absoluteLifetimeMs || 8 * 60 * 60 * 1000);
  const lifecycleDocuments = options.lifecycleDocuments || createCustomerLifecycleDocumentService(db, options.documentOptions);

  async function listFeatureControls() {
    const rows = await db.all("SELECT feature_key,enabled,updated_by,updated_at FROM portal_feature_controls WHERE tenant_id=?", tenantId);
    const values = new Map(rows.map((row) => [row.feature_key, row]));
    return CLIENT_PORTAL_FEATURES.map((featureKey) => ({ featureKey, enabled: Boolean(values.get(featureKey)?.enabled), updatedBy: values.get(featureKey)?.updated_by || null, updatedAt: values.get(featureKey)?.updated_at || null }));
  }

  async function setFeatureControl(featureKey, enabled, updatedBy) {
    if (!CLIENT_PORTAL_FEATURES.includes(featureKey)) throw portalError(422, "portal_feature_unknown", "Client Portal feature is not recognised.");
    const timestamp = nowIso(clock), actor = required(updatedBy, "Staff identity");
    await db.run(`INSERT INTO portal_feature_controls(tenant_id,feature_key,enabled,updated_by,updated_at) VALUES(?,?,?,?,?)
      ON CONFLICT(tenant_id,feature_key) DO UPDATE SET enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=excluded.updated_at`, tenantId, featureKey, enabled ? 1 : 0, actor, timestamp);
    await audit({ eventType: "portal.feature.changed", actorType: "staff", actorId: actor, resourceType: "portal_feature", resourceId: featureKey, metadata: { enabled: Boolean(enabled) } });
    return { featureKey, enabled: Boolean(enabled), updatedBy: actor, updatedAt: timestamp };
  }

  async function featureEnabled(featureKey) {
    const row = await db.get("SELECT enabled FROM portal_feature_controls WHERE tenant_id=? AND feature_key=?", tenantId, featureKey);
    return Boolean(row?.enabled);
  }

  async function getCommitmentPolicy() {
    const row=await db.get('SELECT * FROM portal_commitment_policies WHERE tenant_id=?',tenantId);
    return row?{enabled:Boolean(row.enabled),promptAfterIssuedRevisions:Number(row.prompt_after_issued_revisions),suggestedPercentage:String(row.suggested_percentage),message:String(row.message||'') }:{enabled:false,promptAfterIssuedRevisions:3,suggestedPercentage:'10',message:''};
  }

  async function setCommitmentPolicy(input={}) {
    const actor=required(input.updatedBy,'Staff identity'),after=Math.max(3,Number(input.promptAfterIssuedRevisions)||3),percentage=String(input.suggestedPercentage||'10');
    if(!/^\d+(?:\.\d{1,2})?$/.test(percentage)||Number(percentage)<=0||Number(percentage)>100)throw portalError(422,'portal_commitment_percentage_invalid','Suggested commitment percentage must be greater than zero and no more than 100.');
    const at=nowIso(clock);await db.run(`INSERT INTO portal_commitment_policies(tenant_id,enabled,prompt_after_issued_revisions,suggested_percentage,message,updated_by,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(tenant_id) DO UPDATE SET enabled=excluded.enabled,prompt_after_issued_revisions=excluded.prompt_after_issued_revisions,suggested_percentage=excluded.suggested_percentage,message=excluded.message,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,tenantId,input.enabled===true?1:0,after,percentage,String(input.message||''),actor,at);
    await audit({eventType:'portal.commitment_policy.changed',actorType:'staff',actorId:actor,resourceType:'portal_policy',resourceId:'estimate_revision_commitment',metadata:{enabled:input.enabled===true,promptAfterIssuedRevisions:after,suggestedPercentage:percentage}});return getCommitmentPolicy();
  }

  async function requireFeature(session, projectId, featureKey) {
    if (await featureEnabled(featureKey)) return;
    await deny(session, projectId, "portal_feature", featureKey, "portal_feature_disabled");
  }

  async function audit({ eventType, actorType, actorId, clientId = null, projectId = null, resourceType = null, resourceId = null, commandId = null, metadata = {}, occurredAt = nowIso(clock) }) {
    const id = randomUUID();
    await db.run(`INSERT INTO portal_audit_events(id,event_type,actor_type,actor_id,tenant_id,client_id,project_id,resource_type,resource_id,portal_command_id,occurred_at,safe_metadata_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, id, eventType, actorType, actorId, tenantId, clientId, projectId, resourceType, resourceId, commandId, occurredAt, JSON.stringify(metadata));
    return id;
  }

  async function workflowEvent({ eventName, evidenceId, occurredAt = nowIso(clock), links = [] }) {
    await db.run(`INSERT INTO workflow_events(id,event_name,evidence_id,occurred_at,links_json,created_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(event_name,evidence_id) DO NOTHING`, randomUUID(), eventName, evidenceId, occurredAt, JSON.stringify(links), occurredAt);
  }

  async function validateClientProject(clientId, projectId) {
    const row = await db.get(`SELECT p.id project_id,p.client_id,c.email,c.contact_name,c.name client_name,p.name project_name
      FROM projects p JOIN clients c ON c.id=p.client_id
      WHERE p.id=? AND p.client_id=? AND p.deleted_at IS NULL AND c.deleted_at IS NULL`, projectId, clientId);
    if (!row) throw portalError(404, "portal_scope_not_found", "The active Client and Project relationship was not found.");
    return row;
  }

  async function createInvitation(input) {
    const clientId = required(input.clientId, "Client ID"), projectId = required(input.projectId, "Project ID");
    const email = normalizeEmail(required(input.email, "Contact email")), createdBy = required(input.createdBy, "Inviting staff identity");
    if (typeof options.validateInvitationEmail === "function") options.validateInvitationEmail(email);
    const scope = await validateClientProject(clientId, projectId), createdAt = nowIso(clock);
    const expiresAt = input.expiresAt ? new Date(input.expiresAt).toISOString() : plusMilliseconds(createdAt, Number(input.lifetimeMs || 24 * 60 * 60 * 1000));
    if (new Date(expiresAt).getTime() <= new Date(createdAt).getTime()) throw portalError(422, "portal_invitation_expiry_invalid", "Invitation expiry must be in the future.");
    let contact = await db.get("SELECT * FROM portal_contacts WHERE tenant_id=? AND client_id=? AND email_normalized=?", tenantId, clientId, email);
    await db.exec("BEGIN IMMEDIATE");
    try {
      if (!contact) {
        contact = { id: randomUUID() };
        await db.run(`INSERT INTO portal_contacts(id,tenant_id,client_id,email_normalized,display_name,status,created_at,updated_at) VALUES(?,?,?,?,?,'active',?,?)`, contact.id, tenantId, clientId, email, String(input.displayName || scope.contact_name || scope.client_name || email), createdAt, createdAt);
      } else if (contact.status !== "active") throw portalError(409, "portal_contact_unavailable", "The portal contact is not active.");
      const token = tokenFactory(), invitationId = randomUUID();
      await db.run(`INSERT INTO portal_invitations(id,tenant_id,client_id,portal_contact_id,project_id,token_hash,status,created_by,created_at,expires_at,access_role) VALUES(?,?,?,?,?,?,'pending',?,?,?,?)`, invitationId, tenantId, clientId, contact.id, projectId, sha256(token), createdBy, createdAt, expiresAt, input.accessRole || "reviewer");
      await audit({ eventType: "portal.invitation.created", actorType: "staff", actorId: createdBy, clientId, projectId, resourceType: "portal_invitation", resourceId: invitationId, metadata: { contactId: contact.id, expiresAt } });
      await db.exec("COMMIT");
      return { invitation: { id: invitationId, clientId, projectId, portalContactId: contact.id, email, status: "pending", createdAt, expiresAt }, token };
    } catch (error) { await db.exec("ROLLBACK").catch(() => {}); throw error; }
  }

  async function revokeInvitation(invitationId, revokedBy) {
    const row = await db.get("SELECT * FROM portal_invitations WHERE id=?", invitationId);
    if (!row) throw portalError(404, "portal_invitation_not_found", "Portal invitation was not found.");
    if (row.status === "accepted") throw portalError(409, "portal_invitation_used", "An accepted invitation cannot be revoked; revoke its sessions or Project grant instead.");
    if (row.status === "revoked") return { id: row.id, status: row.status };
    const revokedAt = nowIso(clock);
    await db.run("UPDATE portal_invitations SET status='revoked',revoked_by=?,revoked_at=? WHERE id=? AND status='pending'", required(revokedBy, "Revoking staff identity"), revokedAt, row.id);
    await audit({ eventType: "portal.invitation.revoked", actorType: "staff", actorId: revokedBy, clientId: row.client_id, projectId: row.project_id, resourceType: "portal_invitation", resourceId: row.id });
    return { id: row.id, status: "revoked", revokedAt };
  }

  async function acceptInvitation(input) {
    const rawToken = required(input.token, "Invitation token"), tokenHash = sha256(rawToken), acceptedAt = nowIso(clock);
    const invitation = await db.get(`SELECT i.*,c.email_normalized,c.status contact_status FROM portal_invitations i JOIN portal_contacts c ON c.id=i.portal_contact_id WHERE i.token_hash=?`, tokenHash);
    if (!invitation) throw portalError(401, "portal_invitation_invalid", "Portal invitation is invalid.");
    if (invitation.status === "accepted") throw portalError(409, "portal_invitation_used", "Portal invitation has already been used.");
    if (invitation.status === "revoked") throw portalError(401, "portal_invitation_revoked", "Portal invitation has been revoked.");
    if (new Date(invitation.expires_at).getTime() <= new Date(acceptedAt).getTime()) {
      await db.run("UPDATE portal_invitations SET status='expired' WHERE id=? AND status='pending'", invitation.id);
      throw portalError(401, "portal_invitation_expired", "Portal invitation has expired.");
    }
    if (invitation.contact_status !== "active") throw portalError(403, "portal_contact_unavailable", "Portal contact access is not active.");
    const assertion = await identityVerifier(input.identityAssertion, { invitationId: invitation.id, expectedEmail: invitation.email_normalized });
    const provider = required(assertion?.provider, "Verified identity provider"), subject = required(assertion?.subject, "Verified identity subject"), verifiedEmail = normalizeEmail(required(assertion?.email, "Verified identity email"));
    if (verifiedEmail !== invitation.email_normalized) throw portalError(403, "portal_identity_email_mismatch", "Verified identity does not match the invited contact.");
    const sessionToken = tokenFactory(), csrfToken = tokenFactory(), sessionHash = sha256(sessionToken), sessionId = randomUUID();
    await db.exec("BEGIN IMMEDIATE");
    try {
      let identity = await db.get("SELECT * FROM portal_identities WHERE provider=? AND provider_subject=?", provider, subject);
      if (identity && identity.portal_contact_id !== invitation.portal_contact_id) throw portalError(409, "portal_identity_already_linked", "The verified identity is already linked to another portal contact.");
      if (!identity) {
        identity = { id: randomUUID() };
        await db.run(`INSERT INTO portal_identities(id,portal_contact_id,provider,provider_subject,verified_email_normalized,linked_at,last_authenticated_at) VALUES(?,?,?,?,?,?,?)`, identity.id, invitation.portal_contact_id, provider, subject, verifiedEmail, acceptedAt, acceptedAt);
      } else await db.run("UPDATE portal_identities SET verified_email_normalized=?,last_authenticated_at=? WHERE id=?", verifiedEmail, acceptedAt, identity.id);
      const claimed = await db.run("UPDATE portal_invitations SET status='accepted',accepted_at=? WHERE id=? AND status='pending'", acceptedAt, invitation.id);
      if (claimed.changes !== 1) throw portalError(409, "portal_invitation_used", "Portal invitation has already been used.");
      const existingGrant = await db.get("SELECT id,status FROM portal_project_grants WHERE portal_contact_id=? AND project_id=?", invitation.portal_contact_id, invitation.project_id);
      if (!existingGrant) await db.run(`INSERT INTO portal_project_grants(id,tenant_id,client_id,portal_contact_id,project_id,access_role,status,created_by,created_at) VALUES(?,?,?,?,?,?,'active',?,?)`, randomUUID(), invitation.tenant_id, invitation.client_id, invitation.portal_contact_id, invitation.project_id, invitation.access_role || "reviewer", invitation.created_by, acceptedAt);
      else if (existingGrant.status !== "active") await db.run("UPDATE portal_project_grants SET status='active',access_role=?,created_by=?,created_at=?,revoked_by=NULL,revoked_at=NULL WHERE id=?", invitation.access_role || "reviewer", invitation.created_by, acceptedAt, existingGrant.id);
      await db.run(`INSERT INTO portal_sessions(id,portal_contact_id,portal_identity_id,session_token_hash,csrf_token_hash,status,created_at,last_seen_at,idle_expires_at,absolute_expires_at) VALUES(?,?,?,?,?,'active',?,?,?,?)`, sessionId, invitation.portal_contact_id, identity.id, sessionHash, sha256(csrfToken), acceptedAt, acceptedAt, plusMilliseconds(acceptedAt, idleLifetimeMs), plusMilliseconds(acceptedAt, absoluteLifetimeMs));
      await audit({ eventType: "portal.invitation.accepted", actorType: "external_contact", actorId: invitation.portal_contact_id, clientId: invitation.client_id, projectId: invitation.project_id, resourceType: "portal_invitation", resourceId: invitation.id, metadata: { provider } });
      await audit({ eventType: "portal.session.established", actorType: "external_contact", actorId: invitation.portal_contact_id, clientId: invitation.client_id, projectId: invitation.project_id, resourceType: "portal_session", resourceId: sessionId, metadata: { provider, idleExpiresAt: plusMilliseconds(acceptedAt, idleLifetimeMs), absoluteExpiresAt: plusMilliseconds(acceptedAt, absoluteLifetimeMs) } });
      await db.exec("COMMIT");
      return { sessionToken, csrfToken, session: { id: sessionId, portalContactId: invitation.portal_contact_id, clientId: invitation.client_id, projectId: invitation.project_id, idleExpiresAt: plusMilliseconds(acceptedAt, idleLifetimeMs), absoluteExpiresAt: plusMilliseconds(acceptedAt, absoluteLifetimeMs) } };
    } catch (error) { await db.exec("ROLLBACK").catch(() => {}); throw error; }
  }

  async function authenticateSession(rawToken, { touch = true, requireCsrf = false, csrfToken = null } = {}) {
    if (!rawToken) throw portalError(401, "portal_authentication_required", "Portal authentication is required.");
    const session = await db.get(`SELECT s.*,c.tenant_id,c.client_id,c.display_name,c.email_normalized,c.status contact_status,i.provider,i.provider_subject
      FROM portal_sessions s JOIN portal_contacts c ON c.id=s.portal_contact_id JOIN portal_identities i ON i.id=s.portal_identity_id
      WHERE s.session_token_hash=?`, sha256(rawToken));
    if (!session || session.status !== "active") throw portalError(401, "portal_session_invalid", "Portal session is invalid or revoked.");
    if (requireCsrf && (!csrfToken || sha256(csrfToken) !== session.csrf_token_hash)) throw portalError(403, "portal_csrf_invalid", "Portal command verification failed.");
    const now = nowIso(clock), expired = session.contact_status !== "active" || new Date(session.idle_expires_at).getTime() <= new Date(now).getTime() || new Date(session.absolute_expires_at).getTime() <= new Date(now).getTime();
    if (expired) {
      await db.run("UPDATE portal_sessions SET status='expired',revoked_at=?,revoked_reason='expired' WHERE id=? AND status='active'", now, session.id);
      throw portalError(401, "portal_session_expired", "Portal session has expired.");
    }
    if (touch) await db.run("UPDATE portal_sessions SET last_seen_at=?,idle_expires_at=? WHERE id=?", now, plusMilliseconds(now, idleLifetimeMs), session.id);
    return { id: session.id, portalContactId: session.portal_contact_id, tenantId: session.tenant_id, clientId: session.client_id, displayName: session.display_name, email: session.email_normalized, provider: session.provider, providerSubject: session.provider_subject, absoluteExpiresAt: session.absolute_expires_at };
  }

  async function revokeSession(rawToken, reason = "logout") {
    const session = await authenticateSession(rawToken, { touch: false });
    const timestamp = nowIso(clock);
    await db.run("UPDATE portal_sessions SET status='revoked',revoked_at=?,revoked_reason=? WHERE id=?", timestamp, reason, session.id);
    await audit({ eventType: "portal.session.revoked", actorType: "external_contact", actorId: session.portalContactId, clientId: session.clientId, resourceType: "portal_session", resourceId: session.id, metadata: { reason } });
    return { success: true };
  }

  async function deny(session, projectId, resourceType, resourceId, code = "portal_resource_forbidden") {
    await audit({ eventType: "portal.authorization.denied", actorType: "external_contact", actorId: session.portalContactId, clientId: session.clientId, projectId, resourceType, resourceId, metadata: { code } });
    throw portalError(403, code, "You are not authorised to access this portal resource.");
  }

  async function authorizeProject(session, projectId) {
    const grant = await db.get(`SELECT g.* FROM portal_project_grants g JOIN projects p ON p.id=g.project_id
      WHERE g.portal_contact_id=? AND g.tenant_id=? AND g.client_id=? AND g.project_id=? AND g.status='active' AND p.client_id=g.client_id AND p.deleted_at IS NULL`, session.portalContactId, session.tenantId, session.clientId, projectId);
    if (!grant) await deny(session, projectId, "project", projectId, "portal_project_forbidden");
    return grant;
  }

  async function authorizeProjectCommand(session, projectId) {
    const grant = await authorizeProject(session, projectId);
    if (!['reviewer', 'delegate'].includes(grant.access_role)) await deny(session, projectId, 'project', projectId, 'portal_command_forbidden');
    return grant;
  }

  async function authorizeReleasedResource(session, { projectId, resourceType, resourceId, resourceRevision = null }) {
    await authorizeProject(session, projectId);
    const featureByResource = { estimate: "estimates", order: "orders", document: "documents", comparison: "compare_options" };
    if (featureByResource[resourceType]) await requireFeature(session, projectId, featureByResource[resourceType]);
    const params = [session.tenantId, session.clientId, projectId, resourceType, resourceId];
    const revisionSql = resourceRevision == null ? "" : "AND resource_revision=?";
    if (resourceRevision != null) params.push(String(resourceRevision));
    const release = await db.get(`SELECT * FROM portal_resource_releases WHERE tenant_id=? AND client_id=? AND project_id=? AND resource_type=? AND resource_id=? ${revisionSql} AND status='released'`, ...params);
    if (!release) await deny(session, projectId, resourceType, resourceId, "portal_resource_unreleased");
    return release;
  }

  async function releaseIssuedEstimate(input) {
    const issuedQuotationId = required(input.issuedQuotationId, "Issued quotation ID"), releasedBy = required(input.releasedBy || "system", "Release actor");
    const issued = await db.get(`SELECT iq.*,d.projection_json,d.sha256 document_sha256,e.project_id,e.estimate_ref,e.base_estimate_ref,e.revision_no,e.status estimate_status,e.positions_json,e.project_address,e.project_address_json,e.postcode,e.what3words,e.latitude,e.longitude,e.created_at estimate_created_at
      FROM issued_quotations iq JOIN customer_quotation_documents d ON d.id=iq.document_id JOIN estimates e ON e.id=iq.estimate_id
      WHERE iq.id=? AND iq.status='issued'`, issuedQuotationId);
    if (!issued) throw portalError(409, "portal_estimate_not_issued", "Only an issued customer quotation can release an Estimate revision.");
    if (!issued.project_id) throw portalError(409, "portal_project_required", "Issued Estimate must belong to a canonical Project before portal release.");
    const existing = await db.get("SELECT * FROM estimate_revision_releases WHERE issued_quotation_id=?", issuedQuotationId);
    if (existing) return existing;
    const recipientContact = await db.get("SELECT id FROM portal_contacts WHERE tenant_id=? AND client_id=? AND email_normalized=? AND status='active'", tenantId, issued.client_id, normalizeEmail(issued.recipient));
    const releasedAt = issued.issued_at || nowIso(clock), releaseId = randomUUID();
    const estimateSnapshot = { id: issued.estimate_id, clientId: issued.client_id, projectId: issued.project_id, estimateRef: issued.estimate_ref, baseEstimateRef: issued.base_estimate_ref, revisionNo: Number(issued.revision_no), status: issued.estimate_status, positions: parseJson(issued.positions_json, []), projectAddress: issued.project_address, projectAddressStructured: parseJson(issued.project_address_json, {}), postcode: issued.postcode, what3words: issued.what3words, latitude: issued.latitude, longitude: issued.longitude, createdAt: issued.estimate_created_at };
    const customerProjection = parseJson(issued.projection_json, {}), commercialSnapshot = parseJson(issued.commercial_snapshot_json, {});
    const releaseHash = jsonHash({ estimateSnapshot, customerProjection, commercialSnapshot, documentSha256: issued.document_sha256, termsSnapshot: issued.terms_snapshot, recipient: issued.recipient, releasedAt });
    await db.run(`INSERT INTO estimate_revision_releases(id,issued_quotation_id,tenant_id,client_id,project_id,estimate_id,estimate_revision,recipient_portal_contact_id,document_id,estimate_snapshot_json,customer_projection_json,commercial_snapshot_json,terms_snapshot,release_sha256,released_by,released_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, releaseId, issued.id, tenantId, issued.client_id, issued.project_id, issued.estimate_id, issued.estimate_revision, recipientContact?.id || null, issued.document_id, JSON.stringify(estimateSnapshot), JSON.stringify(customerProjection), JSON.stringify(commercialSnapshot), issued.terms_snapshot, releaseHash, releasedBy, releasedAt);
    await db.run(`INSERT INTO portal_resource_releases(id,tenant_id,client_id,project_id,resource_type,resource_id,resource_revision,status,released_by,released_at,metadata_json) VALUES(?,?,?,?,?,?,?,'released',?,?,?)`, randomUUID(), tenantId, issued.client_id, issued.project_id, "estimate", releaseId, String(issued.estimate_revision), releasedBy, releasedAt, JSON.stringify({ estimateId: issued.estimate_id, estimateRef: issued.estimate_ref, issuedQuotationId: issued.id }));
    await db.run(`INSERT INTO portal_resource_releases(id,tenant_id,client_id,project_id,resource_type,resource_id,resource_revision,status,released_by,released_at,metadata_json) VALUES(?,?,?,?,?,?,?,'released',?,?,?)`, randomUUID(), tenantId, issued.client_id, issued.project_id, "document", issued.document_id, String(issued.quotation_revision), releasedBy, releasedAt, JSON.stringify({ documentType: "issued_estimate", fileName: customerProjection.fileName || `Quotation ${issued.estimate_ref}.pdf`, issuedQuotationId: issued.id }));
    await audit({ eventType: "estimate.released", actorType: releasedBy === "system" ? "system" : "staff", actorId: releasedBy, clientId: issued.client_id, projectId: issued.project_id, resourceType: "estimate", resourceId: releaseId, metadata: { estimateId: issued.estimate_id, estimateRevision: issued.estimate_revision, releaseHash } });
    return db.get("SELECT * FROM estimate_revision_releases WHERE id=?", releaseId);
  }

  async function releaseDocument(input) {
    const clientId = required(input.clientId, "Client ID"), projectId = required(input.projectId, "Project ID"), documentId = required(input.documentId, "Document ID"), releasedBy = required(input.releasedBy, "Release actor");
    await validateClientProject(clientId, projectId);
    const document = await db.get("SELECT id,client_id,project_id,document_type,file_name,provider_revision FROM canonical_documents WHERE id=? AND client_id=? AND project_id=? AND removed_at IS NULL AND trashed=0", documentId, clientId, projectId);
    if (!document) throw portalError(404, "portal_document_not_found", "Canonical Project document was not found.");
    const timestamp = nowIso(clock), revision = String(input.revision || document.provider_revision || "current");
    await db.run(`INSERT INTO portal_resource_releases(id,tenant_id,client_id,project_id,resource_type,resource_id,resource_revision,status,released_by,released_at,metadata_json) VALUES(?,?,?,?,?,?,?,'released',?,?,?)
      ON CONFLICT(tenant_id,project_id,resource_type,resource_id,resource_revision) DO NOTHING`, randomUUID(), tenantId, clientId, projectId, "document", documentId, revision, releasedBy, timestamp, JSON.stringify({ documentType: document.document_type, fileName: document.file_name }));
    await audit({ eventType: "document.released", actorType: "staff", actorId: releasedBy, clientId, projectId, resourceType: "document", resourceId: documentId, metadata: { revision } });
    return { documentId, revision, status: "released" };
  }

  async function releaseCustomerLifecycleDocument(input) {
    const document = await lifecycleDocuments.get(required(input.documentId, "Customer document ID"));
    if (!document || document.clientId !== required(input.clientId, "Client ID") || document.projectId !== required(input.projectId, "Project ID")) throw portalError(404, "portal_document_not_found", "Customer lifecycle document was not found for this Project.");
    const releasedBy = required(input.releasedBy, "Release actor"), releasedAt = nowIso(clock);
    await db.run(`INSERT INTO portal_resource_releases(id,tenant_id,client_id,project_id,resource_type,resource_id,resource_revision,status,released_by,released_at,metadata_json) VALUES(?,?,?,?,?,?,?,'released',?,?,?)
      ON CONFLICT(tenant_id,project_id,resource_type,resource_id,resource_revision) DO NOTHING`, randomUUID(), tenantId, document.clientId, document.projectId, "document", document.id, document.revision, releasedBy, releasedAt, JSON.stringify({ documentType: document.kind, fileName: document.fileName, managedCustomerDocument: true, orderId: document.orderId }));
    await audit({ eventType: "document.released", actorType: releasedBy === "system" ? "system" : "staff", actorId: releasedBy, clientId: document.clientId, projectId: document.projectId, resourceType: "document", resourceId: document.id, metadata: { revision: document.revision, documentType: document.kind } });
    return { documentId: document.id, revision: document.revision, status: "released" };
  }

  const safePosition = (position) => ({ id: String(position.id || ""), reference: String(position.customerReference || position.reference || position.positionRef || ""), quantity: Number(position.quantity ?? position.qty ?? 0), widthMm: position.widthMm == null ? null : Number(position.widthMm), heightMm: position.heightMm == null ? null : Number(position.heightMm), productSystem: position.productSystem ? String(position.productSystem) : null, description: position.description ? String(position.description) : null, specification: position.specification ? String(position.specification) : null, classification: position.classification ? String(position.classification) : "included" });
  const safeEstimateRelease = (row) => {
    const projection = parseJson(row.customer_projection_json, {}), commercial = parseJson(row.commercial_snapshot_json, {}), snapshot = parseJson(row.estimate_snapshot_json, {});
    const lifecycleStatus=row.lifecycle_state||"issued";
    return { releaseId: row.id, estimateId: row.estimate_id, estimateRef: snapshot.estimateRef || projection.estimateReference, revisionNo: Number(row.estimate_revision), issuedAt: row.released_at, immutable: true, status: lifecycleStatus, lifecycle: { status:lifecycleStatus,reason:row.lifecycle_reason||null,changedAt:row.lifecycle_occurred_at||row.released_at,replacementIssuedQuotationId:row.related_issued_quotation_id||null }, document: { id: row.document_id, fileName: `${snapshot.estimateRef || projection.estimateReference || "Estimate"}-Estimate.pdf` }, customer: { projectName: projection.projectName || null, projectAddress: projection.projectAddress || null }, commercial: { supplyOnly: projection.charges?.find?.((item) => /product|supply/i.test(String(item.label)))?.amountGbp ?? null, installation: projection.charges?.find?.((item) => /installation/i.test(String(item.label)))?.amountGbp ?? null, subtotalExVatGbp: commercial.subtotalExVatGbp ?? null, vatGbp: commercial.vatGbp ?? null, totalIncVatGbp: commercial.totalIncVatGbp ?? null, currency: "GBP" }, positions: Array.isArray(projection.positions) ? projection.positions.map(safePosition) : [] };
  };

  async function lifecycleForIssuedQuotation(issuedQuotationId){
    if(!issuedQuotationId)return null;
    return db.get("SELECT lifecycle_state,reason,related_issued_quotation_id,occurred_at FROM issued_quotation_lifecycle_events WHERE issued_quotation_id=? ORDER BY occurred_at DESC,rowid DESC LIMIT 1",issuedQuotationId);
  }
  async function assertActionableEstimateRelease(releaseId){
    const release=await db.get("SELECT issued_quotation_id FROM estimate_revision_releases WHERE id=?",releaseId),lifecycle=await lifecycleForIssuedQuotation(release?.issued_quotation_id);
    const state=lifecycle?.lifecycle_state||"issued";
    if(state==="superseded")throw portalError(409,"portal_estimate_superseded","A newer Estimate revision has replaced this one. Open the latest Estimate before responding.");
    if(state==="withdrawn")throw portalError(410,"portal_estimate_withdrawn","This Estimate has been withdrawn and is no longer available for customer action. Contact the project team for the current offer.");
    return state;
  }

  async function getReleasedEstimate(session, projectId, releaseId) {
    await authorizeReleasedResource(session, { projectId, resourceType: "estimate", resourceId: releaseId });
    const row = await db.get(`SELECT r.*,le.lifecycle_state,le.reason lifecycle_reason,le.related_issued_quotation_id,le.occurred_at lifecycle_occurred_at FROM estimate_revision_releases r LEFT JOIN issued_quotation_lifecycle_events le ON le.id=(SELECT id FROM issued_quotation_lifecycle_events WHERE issued_quotation_id=r.issued_quotation_id ORDER BY occurred_at DESC,rowid DESC LIMIT 1) WHERE r.id=? AND r.tenant_id=? AND r.client_id=? AND r.project_id=?`, releaseId, session.tenantId, session.clientId, projectId);
    if (!row) await deny(session, projectId, "estimate", releaseId);
    if(row.lifecycle_state==="withdrawn")throw portalError(410,"portal_estimate_withdrawn","This Estimate has been withdrawn and is no longer available. Contact the project team for the current offer.");
    await audit({ eventType: "estimate.viewed", actorType: "external_contact", actorId: session.portalContactId, clientId: session.clientId, projectId, resourceType: "estimate", resourceId: releaseId, metadata: { revision: row.estimate_revision } });
    return safeEstimateRelease(row);
  }

  async function getReleasedDocument(session, projectId, documentId) {
    const resource = await authorizeReleasedResource(session, { projectId, resourceType: "document", resourceId: documentId });
    const metadata = parseJson(resource.metadata_json, {});
    const lifecycle=await lifecycleForIssuedQuotation(metadata.issuedQuotationId);
    if(lifecycle?.lifecycle_state==="withdrawn")throw portalError(410,"portal_estimate_withdrawn","The withdrawn Estimate document is no longer available. Contact the project team for the current offer.");
    return { id: documentId, revision: resource.resource_revision, documentType: String(metadata.documentType || "approved_customer_document"), fileName: String(metadata.fileName || "Released document"), releasedAt: resource.released_at };
  }

  async function buildProjectPortalProjection({ session, clientId, projectId, internalPreview = false }) {
    const project = await db.get("SELECT p.id,p.name,p.status,c.id client_id,c.client_ref,c.name client_name,c.company_name FROM projects p JOIN clients c ON c.id=p.client_id WHERE p.id=? AND p.client_id=? AND p.deleted_at IS NULL AND c.deleted_at IS NULL", projectId, clientId);
    if (!project) {
      if (session) await deny(session, projectId, "project", projectId);
      throw portalError(404, "portal_scope_not_found", "The active Client and Project relationship was not found.");
    }
    const features = await listFeatureControls(), enabled = new Set(features.filter((item) => item.enabled).map((item) => item.featureKey));
    const releaseRows = enabled.has("estimates") ? await db.all(`SELECT r.*,le.lifecycle_state,le.reason lifecycle_reason,le.related_issued_quotation_id,le.occurred_at lifecycle_occurred_at FROM estimate_revision_releases r JOIN portal_resource_releases pr ON pr.resource_id=r.id AND pr.resource_type='estimate' AND pr.status='released' LEFT JOIN issued_quotation_lifecycle_events le ON le.id=(SELECT id FROM issued_quotation_lifecycle_events WHERE issued_quotation_id=r.issued_quotation_id ORDER BY occurred_at DESC,rowid DESC LIMIT 1) WHERE r.tenant_id=? AND r.client_id=? AND r.project_id=? ORDER BY r.released_at DESC`, tenantId, clientId, projectId) : [];
    const releases=internalPreview?releaseRows:releaseRows.filter(row=>row.lifecycle_state!=="withdrawn");
    const rawDocumentRows = enabled.has("documents") ? await db.all("SELECT * FROM portal_resource_releases WHERE tenant_id=? AND client_id=? AND project_id=? AND resource_type='document' AND status='released' ORDER BY released_at DESC", tenantId, clientId, projectId) : [];
    const documentRows=[];for(const row of rawDocumentRows){const metadata=parseJson(row.metadata_json,{}),lifecycle=await lifecycleForIssuedQuotation(metadata.issuedQuotationId);if(internalPreview||lifecycle?.lifecycle_state!=="withdrawn")documentRows.push(row)}
    const decisions = enabled.has("rejected") || enabled.has("orders") ? await db.all("SELECT estimate_release_id,decision_type,decline_reason,optional_supplier_name,detail,decided_at FROM portal_estimate_decisions WHERE tenant_id=? AND client_id=? AND project_id=? ORDER BY decided_at DESC", tenantId, clientId, projectId) : [];
    const reviews = enabled.has("review_estimate") ? await db.all("SELECT estimate_release_id,status,submitted_at FROM portal_review_submissions WHERE tenant_id=? AND client_id=? AND project_id=? ORDER BY submitted_at DESC", tenantId, clientId, projectId) : [];
    const orders = enabled.has("orders") ? await db.all(`SELECT o.id,o.order_ref,o.status,o.source_estimate_id,o.source_estimate_revision,o.created_at,o.updated_at
      FROM orders o JOIN portal_resource_releases r ON r.resource_type='order' AND r.resource_id=o.id AND r.status='released'
      WHERE r.tenant_id=? AND r.client_id=? AND r.project_id=? ORDER BY o.created_at DESC`, tenantId, clientId, projectId) : [];
    const confirmationRows = enabled.has("final_confirmation") ? await db.all(`SELECT r.id release_id,r.released_at,fc.id confirmation_id,fc.order_id,fc.revision,fc.canonical_document_id,o.order_ref,
      (SELECT json_group_array(json_object('estimatePositionId',pa.estimate_position_id,'positionReference',pa.position_reference)) FROM portal_position_acceptances pa JOIN portal_estimate_acceptances a ON a.id=pa.estimate_acceptance_id WHERE a.order_id=o.id AND pa.accepted=1) positions_json,
      (SELECT COUNT(*) FROM factory_confirmation_signoffs s WHERE s.factory_confirmation_release_id=r.id) signed_off
      FROM factory_confirmation_releases r JOIN factory_confirmations fc ON fc.id=r.factory_confirmation_id JOIN orders o ON o.id=fc.order_id
      WHERE r.project_id=? AND o.client_id=? ORDER BY r.released_at DESC`, projectId, clientId) : [];
    const commitmentPolicy=await getCommitmentPolicy(),commitmentPrompt=commitmentPolicy.enabled&&releases.length>=commitmentPolicy.promptAfterIssuedRevisions?{informational:true,issuedRevisionCount:releases.length,suggestedPercentage:commitmentPolicy.suggestedPercentage,message:commitmentPolicy.message||`After ${releases.length} issued revisions, you may be asked to discuss a ${commitmentPolicy.suggestedPercentage}% commitment before further estimating. No charge or acceptance gate has been applied.`}:null;
    return { access: { tenantId, clientId, projectId, portalContactId: session?.portalContactId || null, displayName: session?.displayName || "Authorised QuoteSuite staff", mode: internalPreview ? "internal_preview" : "external_contact" }, features, client: { id: project.client_id, reference: project.client_ref, displayName: project.company_name || project.client_name }, project: { id: project.id, name: project.name, status: project.status }, estimates: releases.map(safeEstimateRelease), orders: orders.map((row)=>({ id:row.id,orderRef:row.order_ref,status:row.status,sourceEstimateId:row.source_estimate_id,sourceEstimateRevision:Number(row.source_estimate_revision),createdAt:row.created_at,updatedAt:row.updated_at })), factoryConfirmations: confirmationRows.map((row)=>({ releaseId:row.release_id,confirmationId:row.confirmation_id,orderId:row.order_id,orderRef:row.order_ref,revision:row.revision,documentId:row.canonical_document_id,releasedAt:row.released_at,signedOff:Boolean(row.signed_off),positions:parseJson(row.positions_json,[]) })), commitmentPrompt, documents: documentRows.map((row) => { const metadata = parseJson(row.metadata_json, {}); return { id: row.resource_id, revision: row.resource_revision, documentType: String(metadata.documentType || "approved_customer_document"), fileName: String(metadata.fileName || "Released document"), releasedAt: row.released_at, downloadUrl: internalPreview ? null : `/api/client-portal/external/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(row.resource_id)}/content` }; }), reviews, decisions };
  }

  async function getProjectPortal(session, projectId) {
    await authorizeProject(session, projectId);
    await requireFeature(session, projectId, "dashboard");
    return buildProjectPortalProjection({ session, clientId: session.clientId, projectId });
  }

  async function internalPortalDirectory(search = "") {
    const query = `%${asText(search).toLowerCase()}%`;
    const rows = await db.all(`SELECT c.id client_id,c.client_ref,c.name client_name,c.company_name,p.id project_id,p.name project_name,p.status project_status,
      (SELECT COUNT(*) FROM portal_project_grants g WHERE g.client_id=c.id AND g.project_id=p.id AND g.status='active') active_contacts,
      (SELECT COUNT(*) FROM portal_resource_releases r WHERE r.tenant_id=? AND r.client_id=c.id AND r.project_id=p.id AND r.status='released') released_resources
      FROM clients c JOIN projects p ON p.client_id=c.id
      WHERE c.deleted_at IS NULL AND p.deleted_at IS NULL AND (?='%%' OR lower(COALESCE(c.client_ref,'')||' '||COALESCE(c.name,'')||' '||COALESCE(c.company_name,'')||' '||COALESCE(p.name,'')) LIKE ?)
      ORDER BY COALESCE(c.company_name,c.name),p.name`, tenantId, query, query);
    return rows.map((row) => ({ clientId: row.client_id, clientReference: row.client_ref, clientName: row.company_name || row.client_name, projectId: row.project_id, projectName: row.project_name, projectStatus: row.project_status, portalAccessStatus: Number(row.active_contacts) ? "invited_or_active" : "not_invited", activeContacts: Number(row.active_contacts), releasedResources: Number(row.released_resources) }));
  }

  async function internalProjectPreview(clientId, projectId) {
    return buildProjectPortalProjection({ clientId: required(clientId, "Client ID"), projectId: required(projectId, "Project ID"), internalPreview: true });
  }

  async function beginCommand(session, commandType, idempotencyKey, request, resource) {
    const key = required(idempotencyKey, "Idempotency key");
    if (key.length > 200) throw portalError(400, "portal_idempotency_key_invalid", "Idempotency key is too long.");
    const keyHash = sha256(key), requestHash = jsonHash(request);
    const existing = await db.get("SELECT * FROM portal_commands WHERE portal_contact_id=? AND command_type=? AND idempotency_key_hash=?", session.portalContactId, commandType, keyHash);
    if (existing) {
      if (existing.request_sha256 !== requestHash) throw portalError(409, "portal_idempotency_conflict", "Idempotency key was already used for a different command payload.");
      if (existing.status === "completed") return { replay: true, command: existing, result: parseJson(existing.result_json, {}) };
      throw portalError(409, "portal_command_in_progress", "The portal command is already being processed.");
    }
    const command = { id: randomUUID(), commandType, keyHash, requestHash, ...resource, createdAt: nowIso(clock) };
    await db.run(`INSERT INTO portal_commands(id,command_type,idempotency_key_hash,request_sha256,portal_session_id,portal_contact_id,tenant_id,client_id,project_id,resource_type,resource_id,resource_revision,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'processing',?)`, command.id, commandType, keyHash, requestHash, session.id, session.portalContactId, session.tenantId, session.clientId, resource.projectId, resource.resourceType, resource.resourceId, String(resource.resourceRevision), command.createdAt);
    return { replay: false, command };
  }

  async function completeCommand(command, result) {
    const completedAt = nowIso(clock);
    await db.run("UPDATE portal_commands SET status='completed',result_json=?,completed_at=? WHERE id=?", JSON.stringify(result), completedAt, command.id);
    return { ...result, commandId: command.id, idempotentReplay: false };
  }

  async function submitReview(session, input) {
    const projectId = required(input.projectId, "Project ID"), releaseId = required(input.estimateReleaseId, "Estimate release ID");
    await authorizeProjectCommand(session, projectId);
    await requireFeature(session, projectId, "review_estimate");
    const releaseResource = await authorizeReleasedResource(session, { projectId, resourceType: "estimate", resourceId: releaseId });
    const release = await db.get("SELECT * FROM estimate_revision_releases WHERE id=? AND project_id=? AND client_id=?", releaseId, projectId, session.clientId);
    if (!release) await deny(session, projectId, "estimate", releaseId);
    await assertActionableEstimateRelease(releaseId);
    const positions = Array.isArray(input.positions) ? input.positions : [];
    if (!positions.length) throw portalError(422, "portal_review_positions_required", "At least one Position review response is required.");
    if (positions.some((position) => position.response === "amendment_requested")) await requireFeature(session, projectId, "request_amendments");
    const issuedPositionIds = new Set(safeEstimateRelease(release).positions.map((position) => position.id));
    if (positions.some((position) => !issuedPositionIds.has(String(position.estimatePositionId || "")))) throw portalError(422, "portal_review_position_invalid", "Every review response must refer to a Position in the issued Estimate revision.");
    const request = { projectId, estimateReleaseId: releaseId, positions, generalComment: String(input.generalComment || "") };
    await db.exec("BEGIN IMMEDIATE");
    try {
      const started = await beginCommand(session, "review_submit", input.idempotencyKey, request, { projectId, resourceType: "estimate", resourceId: releaseId, resourceRevision: releaseResource.resource_revision });
      if (started.replay) { await db.exec("COMMIT"); return { ...started.result, commandId: started.command.id, idempotentReplay: true }; }
      const priorSubmission = await db.get("SELECT id FROM portal_review_submissions WHERE estimate_release_id=? AND portal_contact_id=?", releaseId, session.portalContactId);
      if (priorSubmission) throw portalError(409, "portal_review_already_submitted", "A final review has already been submitted for this issued Estimate revision.");
      const submissionId = randomUUID(), submittedAt = nowIso(clock);
      const generalResponse = input.generalResponse === 'amendment_requested' ? 'amendment_requested' : 'comment_only';
      if (generalResponse === 'amendment_requested' && !String(input.generalComment || '').trim()) throw portalError(422, 'portal_general_amendment_comment_required', 'Describe the general change you are requesting.');
      await db.run(`INSERT INTO portal_review_submissions(id,portal_command_id,estimate_release_id,tenant_id,client_id,project_id,portal_contact_id,status,general_comment,general_response,submitted_at) VALUES(?,?,?,?,?,?,?,'submitted',?,?,?)`, submissionId, started.command.id, releaseId, session.tenantId, session.clientId, projectId, session.portalContactId, String(input.generalComment || ""), generalResponse, submittedAt);
      for (const position of positions) {
        const response = String(position.response || "");
        if (!PORTAL_REVIEW_POSITION_RESPONSES.includes(response)) throw portalError(422, "portal_review_response_invalid", "Position review response is invalid.");
        await db.run(`INSERT INTO portal_review_position_entries(id,review_submission_id,estimate_position_id,position_reference,response,comment,created_at) VALUES(?,?,?,?,?,?,?)`, randomUUID(), submissionId, String(position.estimatePositionId), String(position.positionReference || ""), response, String(position.comment || ""), submittedAt);
      }
      const result = { reviewSubmissionId: submissionId, estimateReleaseId: releaseId, status: "submitted", submittedAt, amendmentRequested: positions.some((position) => position.response === "amendment_requested") };
      const completed = await completeCommand(started.command, result);
      await audit({ eventType: "estimate.review.submitted", actorType: "external_contact", actorId: session.portalContactId, clientId: session.clientId, projectId, resourceType: "estimate", resourceId: releaseId, commandId: started.command.id, metadata: { positionCount: positions.length, amendmentRequested: result.amendmentRequested } });
      await workflowEvent({ eventName: result.amendmentRequested ? "estimate.revision_requested" : "estimate.review_submitted", evidenceId: started.command.id, occurredAt: submittedAt, links: [{ kind: "client", id: session.clientId }, { kind: "project", id: projectId }, { kind: "estimate_release", id: releaseId }, { kind: "portal_contact", id: session.portalContactId }] });
      await db.exec("COMMIT"); return completed;
    } catch (error) { await db.exec("ROLLBACK").catch(() => {}); throw error; }
  }

  async function startReview(session, input) {
    const projectId = required(input.projectId, "Project ID"), releaseId = required(input.estimateReleaseId, "Estimate release ID");
    await authorizeProjectCommand(session, projectId);
    await requireFeature(session, projectId, "review_estimate");
    await authorizeReleasedResource(session, { projectId, resourceType: "estimate", resourceId: releaseId });
    await assertActionableEstimateRelease(releaseId);
    await db.exec("BEGIN IMMEDIATE");
    try {
      const existing = await db.get("SELECT id,occurred_at FROM portal_audit_events WHERE event_type='estimate.review.started' AND actor_id=? AND project_id=? AND resource_id=? ORDER BY occurred_at DESC LIMIT 1", session.portalContactId, projectId, releaseId);
      const startedAt = existing?.occurred_at || nowIso(clock);
      if (!existing) await audit({ eventType: "estimate.review.started", actorType: "external_contact", actorId: session.portalContactId, clientId: session.clientId, projectId, resourceType: "estimate", resourceId: releaseId, occurredAt: startedAt });
      await workflowEvent({ eventName: "estimate.customer_reviewing", evidenceId: `${releaseId}:${session.portalContactId}`, occurredAt: startedAt, links: [{ kind: "client", id: session.clientId }, { kind: "project", id: projectId }, { kind: "estimate_release", id: releaseId }, { kind: "portal_contact", id: session.portalContactId }] });
      await db.exec("COMMIT");
      return { estimateReleaseId: releaseId, startedAt, idempotentReplay: Boolean(existing) };
    } catch (error) { await db.exec("ROLLBACK").catch(() => {}); throw error; }
  }

  async function recordDecision(session, input, decisionType) {
    const projectId = required(input.projectId, "Project ID"), releaseId = required(input.estimateReleaseId, "Estimate release ID");
    await authorizeProjectCommand(session, projectId);
    await requireFeature(session, projectId, decisionType === "declined" ? "decline_estimate" : "intent_to_proceed");
    const releaseResource = await authorizeReleasedResource(session, { projectId, resourceType: "estimate", resourceId: releaseId });
    const release = await db.get("SELECT id FROM estimate_revision_releases WHERE id=? AND project_id=? AND client_id=?", releaseId, projectId, session.clientId);
    if (!release) await deny(session, projectId, "estimate", releaseId);
    await assertActionableEstimateRelease(releaseId);
    if (await db.get("SELECT id FROM portal_estimate_acceptances WHERE estimate_release_id=? AND portal_contact_id=?", releaseId, session.portalContactId)) throw portalError(409, "portal_estimate_already_accepted", "This issued Estimate has already been accepted.");
    const reason = decisionType === "declined" ? String(input.reason || "") : null;
    if (decisionType === "declined" && !PORTAL_DECLINE_REASONS.includes(reason)) throw portalError(422, "portal_decline_reason_invalid", "Choose a valid decline reason.");
    const commandType = decisionType === "declined" ? "decline_estimate" : "intent_to_proceed";
    const request = { projectId, estimateReleaseId: releaseId, reason, optionalSupplierName: String(input.optionalSupplierName || ""), detail: String(input.detail || "") };
    await db.exec("BEGIN IMMEDIATE");
    try {
      const started = await beginCommand(session, commandType, input.idempotencyKey, request, { projectId, resourceType: "estimate", resourceId: releaseId, resourceRevision: releaseResource.resource_revision });
      if (started.replay) { await db.exec("COMMIT"); return { ...started.result, commandId: started.command.id, idempotentReplay: true }; }
      const priorDecision = await db.get("SELECT decision_type FROM portal_estimate_decisions WHERE estimate_release_id=? AND portal_contact_id=? LIMIT 1", releaseId, session.portalContactId);
      if (priorDecision) throw portalError(409, "portal_estimate_decision_conflict", `This issued Estimate already has a recorded ${priorDecision.decision_type.replaceAll("_", " ")} decision.`);
      const decisionId = randomUUID(), decidedAt = nowIso(clock);
      await db.run(`INSERT INTO portal_estimate_decisions(id,portal_command_id,estimate_release_id,tenant_id,client_id,project_id,portal_contact_id,decision_type,decline_reason,optional_supplier_name,detail,decided_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, decisionId, started.command.id, releaseId, session.tenantId, session.clientId, projectId, session.portalContactId, decisionType, reason, decisionType === "declined" && reason === "chose_another_supplier" ? String(input.optionalSupplierName || "") || null : null, String(input.detail || ""), decidedAt);
      const result = { decisionId, estimateReleaseId: releaseId, status: decisionType, decidedAt, supplierOrderCreated: false };
      const completed = await completeCommand(started.command, result);
      await audit({ eventType: decisionType === "declined" ? "estimate.declined" : "estimate.intent_to_proceed", actorType: "external_contact", actorId: session.portalContactId, clientId: session.clientId, projectId, resourceType: "estimate", resourceId: releaseId, commandId: started.command.id, metadata: decisionType === "declined" ? { reason, hasDetail: Boolean(input.detail), hasSupplierName: Boolean(input.optionalSupplierName) } : { supplierOrderCreated: false } });
      await workflowEvent({ eventName: decisionType === "declined" ? "estimate.customer_declined" : "estimate.intent_to_proceed", evidenceId: started.command.id, occurredAt: decidedAt, links: [{ kind: "client", id: session.clientId }, { kind: "project", id: projectId }, { kind: "estimate_release", id: releaseId }, { kind: "portal_contact", id: session.portalContactId }] });
      await db.exec("COMMIT"); return completed;
    } catch (error) { await db.exec("ROLLBACK").catch(() => {}); throw error; }
  }

  const declineEstimate = (session, input) => recordDecision(session, input, "declined");
  const indicateIntentToProceed = (session, input) => recordDecision(session, input, "intent_to_proceed");

  async function ensureAcceptedOrderDocument(orderId, releasedBy) {
    const document = await lifecycleDocuments.createOrderDocument(orderId, { revision: "customer-accepted" });
    await releaseCustomerLifecycleDocument({ documentId: document.id, clientId: document.clientId, projectId: document.projectId, releasedBy });
    return { id: document.id, fileName: document.fileName, revision: document.revision };
  }

  async function acceptEstimate(session, input) {
    const projectId = required(input.projectId, "Project ID"), releaseId = required(input.estimateReleaseId, "Estimate release ID"), idempotencyKey = required(input.idempotencyKey, "Idempotency key");
    await authorizeProjectCommand(session, projectId);
    await requireFeature(session, projectId, "accept_estimate");
    await authorizeReleasedResource(session, { projectId, resourceType: "estimate", resourceId: releaseId });
    const release = await db.get("SELECT * FROM estimate_revision_releases WHERE id=? AND project_id=? AND client_id=?", releaseId, projectId, session.clientId);
    if (!release) await deny(session, projectId, "estimate", releaseId);
    await assertActionableEstimateRelease(releaseId);
    const conflictingDecision = await db.get("SELECT decision_type FROM portal_estimate_decisions WHERE estimate_release_id=? AND portal_contact_id=? AND decision_type='declined'", releaseId, session.portalContactId);
    if (conflictingDecision) throw portalError(409, "portal_estimate_decision_conflict", "A declined Estimate cannot be accepted without a new issued revision.");
    const amendmentReview = await db.get(`SELECT r.id FROM portal_review_submissions r WHERE r.estimate_release_id=? AND r.portal_contact_id=? AND EXISTS(SELECT 1 FROM portal_review_position_entries p WHERE p.review_submission_id=r.id AND p.response='amendment_requested')`, releaseId, session.portalContactId);
    if (amendmentReview) throw portalError(409, "portal_estimate_revision_required", "Requested changes must be reviewed and issued as a new revision before acceptance.");
    const positions = safeEstimateRelease(release).positions, responses = Array.isArray(input.positions) ? input.positions : [];
    const issuedIds = new Set(positions.map((position) => position.id)), responseIds = new Set(responses.map((position) => String(position.estimatePositionId || "")));
    if (!input.overallAccepted || !positions.length || responses.length !== positions.length || responses.some((position) => !position.accepted || !issuedIds.has(String(position.estimatePositionId || ""))) || responseIds.size !== issuedIds.size) {
      throw portalError(422, "portal_acceptance_incomplete", "Every issued Position and the overall Estimate must be explicitly accepted before an Order can be created.");
    }
    const requiredConfirmations = ["item_reference", "configuration", "dimensions", "specification"];
    if (responses.some((position) => !requiredConfirmations.every((key) => position.confirmations?.[key] === true))) throw portalError(422, "portal_position_confirmation_incomplete", "Every applicable Position confirmation must be accepted.");
    const keyHash = sha256(idempotencyKey), request = { projectId, releaseId, overallAccepted: true, positions: responses }, requestHash = jsonHash(request);
    const replay = await db.get("SELECT * FROM portal_estimate_acceptances WHERE portal_contact_id=? AND idempotency_key_hash=?", session.portalContactId, keyHash);
    if (replay) {
      if (replay.request_sha256 !== requestHash) throw portalError(409, "portal_idempotency_conflict", "Idempotency key was already used for different acceptance evidence.");
      return { acceptanceId: replay.id, orderId: replay.order_id, acceptedAt: replay.accepted_at, orderDocument: await ensureAcceptedOrderDocument(replay.order_id, session.portalContactId), idempotentReplay: true };
    }
    const prior = await db.get("SELECT id,order_id,accepted_at FROM portal_estimate_acceptances WHERE estimate_release_id=?", releaseId);
    if (prior) return { acceptanceId: prior.id, orderId: prior.order_id, acceptedAt: prior.accepted_at, orderDocument: await ensureAcceptedOrderDocument(prior.order_id, session.portalContactId), idempotentReplay: true };
    const source = await db.get("SELECT * FROM estimates WHERE id=?", release.estimate_id);
    if (!source) throw portalError(404, "estimate_not_found", "The released Estimate source is unavailable.");
    const acceptedAt = nowIso(clock), acceptanceId = randomUUID(), orderId = randomUUID(), year = new Date(acceptedAt).getUTCFullYear();
    await db.exec("BEGIN IMMEDIATE");
    try {
      const orderRef = await allocateCanonicalReference(db, { kind: "order", year, entityId: orderId, reason: `customer_acceptance:${releaseId}`, now: acceptedAt });
      await db.run(`INSERT INTO orders(id,order_ref,client_id,project_id,source_estimate_id,source_estimate_revision,accepted_commercial_snapshot_json,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'customer_accepted_pending_staff_approval',?,?)`, orderId, orderRef, session.clientId, projectId, source.id, Number(release.estimate_revision), release.commercial_snapshot_json, acceptedAt, acceptedAt);
      await db.run(`INSERT INTO portal_estimate_acceptances(id,estimate_release_id,tenant_id,client_id,project_id,portal_contact_id,idempotency_key_hash,request_sha256,overall_accepted,accepted_at,order_id) VALUES(?,?,?,?,?,?,?,?,1,?,?)`, acceptanceId, releaseId, session.tenantId, session.clientId, projectId, session.portalContactId, keyHash, requestHash, acceptedAt, orderId);
      for (const response of responses) await db.run(`INSERT INTO portal_position_acceptances(id,estimate_acceptance_id,estimate_position_id,position_reference,accepted,confirmations_json,created_at) VALUES(?,?,?,?,1,?,?)`, randomUUID(), acceptanceId, String(response.estimatePositionId), String(response.positionReference || positions.find((position) => position.id === String(response.estimatePositionId))?.reference || ""), JSON.stringify(response.confirmations), acceptedAt);
      await db.run(`INSERT INTO portal_resource_releases(id,tenant_id,client_id,project_id,resource_type,resource_id,resource_revision,status,released_by,released_at,metadata_json) VALUES(?,?,?,?,?,?,'1','released',?,?,?)`, randomUUID(), session.tenantId, session.clientId, projectId, "order", orderId, session.portalContactId, acceptedAt, JSON.stringify({ orderRef, sourceEstimateReleaseId: releaseId }));
      await audit({ eventType: "estimate.customer_accepted", actorType: "external_contact", actorId: session.portalContactId, clientId: session.clientId, projectId, resourceType: "order", resourceId: orderId, metadata: { estimateReleaseId: releaseId, positionCount: responses.length, orderRef } });
      await workflowEvent({ eventName: "order.customer_accepted", evidenceId: acceptanceId, occurredAt: acceptedAt, links: [{ kind: "client", id: session.clientId }, { kind: "project", id: projectId }, { kind: "estimate_release", id: releaseId }, { kind: "order", id: orderId }] });
      await db.exec("COMMIT");
      const orderDocument = await ensureAcceptedOrderDocument(orderId, session.portalContactId);
      return { acceptanceId, orderId, orderRef, acceptedAt, status: "customer_accepted_pending_staff_approval", orderDocument, idempotentReplay: false };
    } catch (error) { await db.exec("ROLLBACK").catch(() => {}); throw error; }
  }

  async function signOffFactoryConfirmation(session, input) {
    const projectId=required(input.projectId,"Project ID"),releaseId=required(input.factoryConfirmationReleaseId,"Factory confirmation release ID"),key=required(input.idempotencyKey,"Idempotency key");
    await authorizeProjectCommand(session,projectId);await requireFeature(session,projectId,"final_confirmation");
    const release=await db.get(`SELECT r.*,fc.order_id,fc.canonical_document_id,o.client_id FROM factory_confirmation_releases r JOIN factory_confirmations fc ON fc.id=r.factory_confirmation_id AND fc.status='released' JOIN orders o ON o.id=fc.order_id WHERE r.id=? AND r.project_id=?`,releaseId,projectId);
    if(!release||release.client_id!==session.clientId)await deny(session,projectId,"factory_confirmation",releaseId);
    await authorizeReleasedResource(session,{projectId,resourceType:"document",resourceId:release.canonical_document_id});
    const expected=await db.all(`SELECT pa.estimate_position_id FROM portal_position_acceptances pa JOIN portal_estimate_acceptances a ON a.id=pa.estimate_acceptance_id WHERE a.order_id=? AND pa.accepted=1`,release.order_id),submitted=new Set((input.positions||[]).filter(item=>item.approved===true).map(item=>String(item.estimatePositionId)));
    if(input.overallApproved!==true||!expected.length||expected.some(row=>!submitted.has(row.estimate_position_id)))throw portalError(422,"final_confirmation_incomplete","Approve every Position and the overall factory confirmation.");
    const existing=await db.get('SELECT * FROM factory_confirmation_signoffs WHERE factory_confirmation_release_id=?',releaseId);if(existing)return{signoffId:existing.id,orderId:release.order_id,approvedAt:existing.approved_at,idempotentReplay:true};
    const requestHash=jsonHash({releaseId,overallApproved:true,positions:[...submitted].sort()}),keyHash=sha256(key),at=nowIso(clock),id=randomUUID();
    const replay=await db.get("SELECT safe_metadata_json FROM portal_audit_events WHERE event_type='factory.confirmation.customer_approved' AND actor_id=? AND resource_id=?",session.portalContactId,releaseId);if(replay){const meta=parseJson(replay.safe_metadata_json,{});if(meta.requestHash!==requestHash||meta.keyHash!==keyHash)throw portalError(409,"portal_idempotency_conflict","Final confirmation was already submitted with different evidence.");return{signoffId:meta.signoffId,orderId:release.order_id,approvedAt:meta.approvedAt,idempotentReplay:true};}
    await db.exec('BEGIN IMMEDIATE');try{await db.run(`INSERT INTO factory_confirmation_signoffs(id,factory_confirmation_release_id,portal_contact_id,overall_approved,approved_at) VALUES(?,?,?,1,?)`,id,releaseId,session.portalContactId,at);for(const row of expected)await db.run('INSERT INTO factory_confirmation_position_approvals(id,signoff_id,estimate_position_id,approved,created_at) VALUES(?,?,?,1,?)',randomUUID(),id,row.estimate_position_id,at);await db.run("UPDATE orders SET status='customer_final_confirmation_approved',updated_at=? WHERE id=?",at,release.order_id);await audit({eventType:'factory.confirmation.customer_approved',actorType:'external_contact',actorId:session.portalContactId,clientId:session.clientId,projectId,resourceType:'factory_confirmation',resourceId:releaseId,metadata:{signoffId:id,orderId:release.order_id,requestHash,keyHash,approvedAt:at}});await workflowEvent({eventName:'factory.confirmation.customer_approved',evidenceId:id,occurredAt:at,links:[{kind:'order',id:release.order_id},{kind:'factory_confirmation_release',id:releaseId}]});await db.exec('COMMIT');return{signoffId:id,orderId:release.order_id,status:'customer_final_confirmation_approved',approvedAt:at,idempotentReplay:false};}catch(error){await db.exec('ROLLBACK').catch(()=>{});throw error;}
  }

  async function cloneProjectCostingScenario(sourceEstimateId, targetEstimateId, createdAt) {
    const sourceScenario = await db.get('SELECT * FROM project_calculator_lab_scenarios WHERE estimate_id=? ORDER BY updated_at DESC LIMIT 1', sourceEstimateId);
    if (!sourceScenario) return null;
    const targetScenarioId = randomUUID();
    const tableExists = async (table) => Boolean(await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", table));
    const insertRow = async (table, row) => {
      const available = new Set((await db.all(`PRAGMA table_info("${table}")`)).map((column) => column.name));
      if (!available.size) return;
      const columns = Object.keys(row).filter((column) => available.has(column)), placeholders = columns.map(() => '?').join(',');
      await db.run(`INSERT INTO "${table}"(${columns.map((column) => `"${column}"`).join(',')}) VALUES(${placeholders})`, ...columns.map((column) => row[column]));
    };
    await insertRow('project_calculator_lab_scenarios', { ...sourceScenario, id: targetScenarioId, estimate_id: targetEstimateId, ...(sourceScenario.name ? { name: `${sourceScenario.name} · working revision` } : {}), created_at: createdAt, updated_at: createdAt });
    const tables = [
      'project_calculator_lab_product_rows','project_calculator_lab_supplier_costs','project_calculator_estimate_product_rows','project_calculator_estimate_position_rows','project_calculator_estimate_supplier_costs',
      'project_calculator_lab_package_items','project_calculator_lab_route_snapshots','project_calculator_lab_manual_product_rows','project_calculator_lab_manual_cost_lines','project_calculator_lab_exchange_rate_snapshots',
      'project_calculator_lab_markup_rules','project_calculator_lab_revisions','project_calculator_lab_catalogue_snapshots','project_calculator_lab_options',
    ];
    for (const table of tables) {
      if (!(await tableExists(table))) continue;
      const rows = await db.all(`SELECT * FROM "${table}" WHERE scenario_id=?`, sourceScenario.id);
      for (const row of rows) await insertRow(table, { ...row, ...(Object.hasOwn(row, 'id') ? { id: randomUUID() } : {}), scenario_id: targetScenarioId, ...(Object.hasOwn(row, 'created_at') ? { created_at: createdAt } : {}), ...(Object.hasOwn(row, 'updated_at') ? { updated_at: createdAt } : {}) });
    }
    const fxMap = new Map();
    if (await tableExists('project_calculator_supplier_fx_snapshots')) for (const row of await db.all('SELECT * FROM project_calculator_supplier_fx_snapshots WHERE scenario_id=?', sourceScenario.id)) {
      const id = randomUUID(); fxMap.set(row.id, id);
      await insertRow('project_calculator_supplier_fx_snapshots', { ...row, id, scenario_id: targetScenarioId, created_at: createdAt });
    }
    if (await tableExists('project_calculator_supplier_quote_revisions')) for (const row of await db.all('SELECT * FROM project_calculator_supplier_quote_revisions WHERE scenario_id=?', sourceScenario.id)) await insertRow('project_calculator_supplier_quote_revisions', { ...row, scenario_id: targetScenarioId, fx_snapshot_id: row.fx_snapshot_id ? fxMap.get(row.fx_snapshot_id) || null : null, linked_at: createdAt });
    const settings = await tableExists('estimate_commercial_settings') ? await db.get('SELECT * FROM estimate_commercial_settings WHERE estimate_id=?', sourceEstimateId) : null;
    if (settings) await insertRow('estimate_commercial_settings', { ...settings, estimate_id: targetEstimateId, created_at: createdAt, updated_at: createdAt });
    return targetScenarioId;
  }

  async function createNextEstimateRevision(input) {
    const releaseId = required(input.estimateReleaseId, "Estimate release ID"), createdBy = required(input.createdBy, "Staff identity");
    const release = await db.get("SELECT * FROM estimate_revision_releases WHERE id=?", releaseId);
    if (!release) throw portalError(404, "estimate_release_not_found", "Issued Estimate release was not found.");
    const existing = await db.get("SELECT successor_estimate_id FROM estimate_revision_lineage WHERE source_release_id=?", releaseId);
    if (existing) return db.get("SELECT * FROM estimates WHERE id=?", existing.successor_estimate_id);
    const source = await db.get("SELECT * FROM estimates WHERE id=?", release.estimate_id);
    if (!source) throw portalError(404, "estimate_not_found", "Source Estimate was not found.");
    const maximum = await db.get("SELECT MAX(revision_no) value FROM estimates WHERE base_estimate_ref=? AND deleted_at IS NULL", source.base_estimate_ref || source.estimate_ref);
    const nextRevision = Math.max(Number(release.estimate_revision) + 1, Number(maximum?.value || 0) + 1), estimateId = randomUUID(), baseRef = source.base_estimate_ref || source.estimate_ref;
    const estimateRef = `${baseRef}-${String(nextRevision).padStart(2, "0")}`, timestamp = nowIso(clock);
    await db.exec("BEGIN IMMEDIATE");
    try {
      await db.run(`INSERT INTO estimates(id,client_id,project_id,estimate_ref,base_estimate_ref,revision_no,status,estimated_order_month,estimated_order_year,defaults_json,positions_json,order_meta_json,outcome,project_address,project_address_json,postcode,what3words,latitude,longitude,created_by_user_id,created_by_name,created_by_role,created_at,updated_at,deleted_at)
        VALUES(?,?,?,?,?,?,'Draft',?,?,?,?,?,'Open',?,?,?,?,?,?,?,?,?,?,?,NULL)`, estimateId, source.client_id, source.project_id, estimateRef, baseRef, nextRevision, source.estimated_order_month, source.estimated_order_year, source.defaults_json, source.positions_json, "{}", source.project_address, source.project_address_json, source.postcode, source.what3words, source.latitude, source.longitude, createdBy, String(input.createdByName || createdBy), String(input.createdByRole || "estimator"), timestamp, timestamp);
      const projectCostingScenarioId = await cloneProjectCostingScenario(source.id, estimateId, timestamp);
      await db.run("INSERT INTO estimate_revision_lineage(id,source_release_id,successor_estimate_id,reason,created_by,created_at) VALUES(?,?,?,?,?,?)", randomUUID(), releaseId, estimateId, String(input.reason || "customer_amendment"), createdBy, timestamp);
      await audit({ eventType: "estimate.revision.created", actorType: "staff", actorId: createdBy, clientId: source.client_id, projectId: source.project_id, resourceType: "estimate", resourceId: estimateId, metadata: { sourceReleaseId: releaseId, sourceEstimateId: source.id, sourceRevision: release.estimate_revision, revision: nextRevision, projectCostingScenarioId } });
      await db.exec("COMMIT"); return db.get("SELECT * FROM estimates WHERE id=?", estimateId);
    } catch (error) { await db.exec("ROLLBACK").catch(() => {}); throw error; }
  }

  async function internalClientSummary(clientId) {
    const contacts = await db.all(`SELECT c.id,c.display_name,c.email_normalized,c.status,
      (SELECT COUNT(*) FROM portal_project_grants g WHERE g.portal_contact_id=c.id AND g.status='active') active_project_grants,
      (SELECT MAX(s.last_seen_at) FROM portal_sessions s WHERE s.portal_contact_id=c.id) last_activity_at
      FROM portal_contacts c WHERE c.tenant_id=? AND c.client_id=? ORDER BY c.display_name`, tenantId, clientId);
    const invitations = await db.all("SELECT id,portal_contact_id,project_id,status,created_at,expires_at,accepted_at,revoked_at FROM portal_invitations WHERE tenant_id=? AND client_id=? ORDER BY created_at DESC", tenantId, clientId);
    const releases = await db.all("SELECT id,project_id,estimate_id,estimate_revision,released_at FROM estimate_revision_releases WHERE tenant_id=? AND client_id=? ORDER BY released_at DESC", tenantId, clientId);
    const reviews = await db.all("SELECT estimate_release_id,status,submitted_at FROM portal_review_submissions WHERE tenant_id=? AND client_id=? ORDER BY submitted_at DESC", tenantId, clientId);
    const decisions = await db.all("SELECT estimate_release_id,decision_type,decline_reason,decided_at FROM portal_estimate_decisions WHERE tenant_id=? AND client_id=? ORDER BY decided_at DESC", tenantId, clientId);
    return { tenantId, clientId, externalAccessEnabled: false, contacts: contacts.map((row) => ({ id: row.id, displayName: row.display_name, email: row.email_normalized, status: row.status, activeProjectGrants: Number(row.active_project_grants), lastActivityAt: row.last_activity_at || null })), invitations: invitations.map((row) => ({ id: row.id, contactId: row.portal_contact_id, projectId: row.project_id, status: row.status, createdAt: row.created_at, expiresAt: row.expires_at, acceptedAt: row.accepted_at, revokedAt: row.revoked_at })), releases: releases.map((row) => ({ releaseId: row.id, projectId: row.project_id, estimateId: row.estimate_id, revisionNo: Number(row.estimate_revision), releasedAt: row.released_at })), reviews, decisions };
  }

  async function externalSessionContext(session) {
    const projects = await db.all(`SELECT g.project_id,p.name project_name FROM portal_project_grants g JOIN projects p ON p.id=g.project_id AND p.client_id=g.client_id AND p.deleted_at IS NULL
      WHERE g.portal_contact_id=? AND g.tenant_id=? AND g.client_id=? AND g.status='active' ORDER BY g.created_at`, session.portalContactId, session.tenantId, session.clientId);
    return { portalContactId: session.portalContactId, clientId: session.clientId, displayName: session.displayName, projects: projects.map((row) => ({ id: row.project_id, name: row.project_name })) };
  }

  return { listFeatureControls, setFeatureControl, getCommitmentPolicy, setCommitmentPolicy, createInvitation, revokeInvitation, acceptInvitation, authenticateSession, revokeSession, authorizeProject, authorizeReleasedResource, releaseIssuedEstimate, releaseDocument, releaseCustomerLifecycleDocument, getReleasedEstimate, getReleasedDocument, getProjectPortal, internalPortalDirectory, internalProjectPreview, startReview, submitReview, declineEstimate, indicateIntentToProceed, acceptEstimate, signOffFactoryConfirmation, createNextEstimateRevision, internalClientSummary, externalSessionContext, audit };
}
