import { randomUUID } from "node:crypto";
import { allocateCanonicalReference } from "./referenceAllocator.js";
import { CURRENT_APP_USER } from "../../currentUser.js";
import { createResponsibilityService } from "../service/responsibilityService.js";

const timestamp = (now) => now().toISOString();
const clean = (value) => String(value || "").trim();
const json = (value, fallback = {}) => { try { return JSON.stringify(value ?? fallback); } catch { return JSON.stringify(fallback); } };
const problem = (message, status, code) => Object.assign(new Error(message), { status, code });
const DRIVE_PROVISIONING_MESSAGES = Object.freeze({
  provisioned: "Client / Project folders are ready. Existing folders were reused where present.",
  pending_provider_connection: "Reconnect your connected storage before creating Client / Project folders.",
  pending_root_configuration: "Configure the Estimates folder in Administration → Integrations before creating Client / Project folders.",
  not_configured: "Connected storage is not configured for Client / Project folder creation.",
});

async function transaction(db, work) {
  await db.exec("BEGIN IMMEDIATE");
  try {
    const result = await work();
    await db.exec("COMMIT");
    return result;
  } catch (error) {
    await db.exec("ROLLBACK").catch(() => {});
    throw error;
  }
}

function mapEnquiry(row) {
  if (!row) return null;
  return {
    id: row.id, enquiryRef: row.enquiry_ref, status: row.status, source: row.source, leadSource: row.lead_source,
    displayName: row.display_name, companyName: row.company_name, email: row.email, telephone: row.telephone,
    projectName: row.project_name, siteAddress: row.site_address, siteAddressJson: JSON.parse(row.site_address_json || "{}"), notes: row.notes,
    qualificationMode: row.qualification_mode, convertedClientId: row.converted_client_id, convertedProjectId: row.converted_project_id,
    driveTransitionStatus: row.drive_transition_status, qualificationEvidence: JSON.parse(row.conversion_evidence_json || "{}"),
    qualifiedAt: row.qualified_at, createdAt: row.created_at, updatedAt: row.updated_at,
    ownerUserId: row.owner_user_id || CURRENT_APP_USER.id, ownerName: row.owner_name || CURRENT_APP_USER.name,
    workStage: row.work_stage || (row.status === "new" ? "new_enquiry" : row.status), waitingFor: row.waiting_for || "none",
    nextAction: row.next_action || (row.status === "new" ? "Review and qualify enquiry" : ""), nextActionDueAt: row.work_due_at || null,
    lastContactAt: row.last_contact_at || null,
    responsibleTeamId: row.responsible_team_id || null, responsibleTeamName: row.responsible_team_name || null,
    assignmentState: row.assignment_state || "unassigned",
  };
}

const enquirySelect = `SELECT e.*,w.owner_user_id,w.owner_name,w.stage work_stage,w.waiting_for,w.next_action,w.due_at work_due_at,w.last_contact_at,
  a.team_id responsible_team_id,a.team_name responsible_team_name,a.routing_state assignment_state
  FROM enquiries e LEFT JOIN crm_record_work_states w ON w.record_kind='enquiry' AND w.record_id=e.id
  LEFT JOIN record_assignments a ON a.record_kind='enquiry' AND a.record_id=e.id`;

function mapProject(row) {
  if (!row) return null;
  return {
    id: row.id, clientId: row.client_id, sourceEnquiryId: row.source_enquiry_id, name: row.name, status: row.status,
    contextYear: row.context_year, siteAddress: row.site_address, siteAddressJson: JSON.parse(row.site_address_json || "{}"),
    postcode: row.postcode, what3words: row.what3words, latitude: row.latitude, longitude: row.longitude,
    createdAt: row.created_at, updatedAt: row.updated_at,
    estimateCount: Number(row.estimate_count || 0), orderCount: Number(row.order_count || 0),
  };
}

export function createCommercialIdentityService(db, { now = () => new Date(), id = randomUUID, driveTransitions = null } = {}) {
  async function provisionProjectOutcome(projectId) {
    if (!driveTransitions?.provisionProject) {
      return { status: "not_configured", code: "drive_provisioning_not_configured", message: DRIVE_PROVISIONING_MESSAGES.not_configured };
    }
    try {
      const result = await driveTransitions.provisionProject(projectId);
      const status = clean(result?.status);
      if (Object.hasOwn(DRIVE_PROVISIONING_MESSAGES, status)) {
        return { status, code: null, message: DRIVE_PROVISIONING_MESSAGES[status] };
      }
      return { status: "failed", code: "drive_provisioning_unexpected_status", message: "The Project was saved, but folder creation returned an unknown result." };
    } catch (cause) {
      const code = clean(cause?.code) || "drive_provisioning_failed";
      return {
        status: "failed",
        code,
        message: code === "reconnect_required"
          ? DRIVE_PROVISIONING_MESSAGES.pending_provider_connection
          : "The Project was saved, but Client / Project folders could not be created. Check Administration → Integrations, then try Create Client / Project Folders again.",
      };
    }
  }

  async function createEnquiry(input = {}) {
    const displayName = clean(input.displayName || input.companyName);
    if (!displayName) throw problem("An Enquiry needs a person or company name.", 422, "enquiry_identity_required");
    const enquiryId = input.id || id(), createdAt = timestamp(now);
    const result = await transaction(db, async () => {
      const enquiryRef = await allocateCanonicalReference(db, { kind: "enquiry", entityId: enquiryId, now: createdAt });
      await db.run(`INSERT INTO enquiries(id,enquiry_ref,status,source,lead_source,display_name,company_name,email,telephone,project_name,site_address,site_address_json,notes,drive_transition_status,conversion_evidence_json,created_at,updated_at)
        VALUES(?,?,'new',?,?,?,?,?,?,?,?,?,?,'pending','{}',?,?)`, enquiryId, enquiryRef, clean(input.source), clean(input.leadSource), displayName, clean(input.companyName), clean(input.email), clean(input.telephone), clean(input.projectName), clean(input.siteAddress), json(input.siteAddressJson), clean(input.notes), createdAt, createdAt);
      await db.run(`INSERT INTO crm_record_work_states(record_kind,record_id,owner_user_id,owner_name,stage,waiting_for,next_action,due_at,last_contact_at,created_at,updated_at)
        VALUES('enquiry',?,?,?,?,'none',?,?,NULL,?,?)`, enquiryId, clean(input.ownerUserId) || CURRENT_APP_USER.id, clean(input.ownerName) || CURRENT_APP_USER.name, "new_enquiry", clean(input.nextAction) || "Review and qualify enquiry", clean(input.nextActionDueAt) || createdAt, createdAt, createdAt);
      await createResponsibilityService(db, { id, clock: now }).route({ recordKind: "enquiry", recordId: enquiryId, responsibilityArea: "enquiries", transitionKey: "registered", actorId: CURRENT_APP_USER.id });
      return mapEnquiry(await db.get(`${enquirySelect} WHERE e.id=?`, enquiryId));
    });
    if (driveTransitions?.provisionEnquiry) driveTransitions.provisionEnquiry(enquiryId).then(async (drive) => {
      await db.run("UPDATE enquiries SET drive_transition_status=?,updated_at=? WHERE id=?", drive?.status === "provisioned" || drive?.status === "linked" ? "linked" : "pending", timestamp(now), enquiryId);
    }).catch(async () => { await db.run("UPDATE enquiries SET drive_transition_status='failed',updated_at=? WHERE id=?", timestamp(now), enquiryId).catch(() => {}); });
    return result;
  }

  async function listEnquiries({ includeConverted = true } = {}) {
    const rows = await db.all(`${enquirySelect} WHERE e.deleted_at IS NULL ${includeConverted ? "" : "AND e.status NOT IN ('qualified','converted')"} ORDER BY e.created_at DESC`);
    return rows.map(mapEnquiry);
  }

  async function getEnquirySource(enquiryId) {
    const enquiry = await db.get("SELECT id,enquiry_ref FROM enquiries WHERE id=? AND deleted_at IS NULL", clean(enquiryId));
    if (!enquiry) throw problem("Enquiry not found.", 404, "enquiry_not_found");
    const intake = await db.get(`SELECT i.id intake_id,i.provider_message_id intake_provider_message_id,i.reviewed_brief,i.created_at intake_created_at,
      m.id communication_message_id,m.provider,m.provider_message_id,m.from_json,m.to_json,m.subject,m.body_html,m.body_text,m.sent_at,m.provider_state_json
      FROM enquiry_email_intakes i LEFT JOIN communication_messages m ON m.id=i.communication_message_id
      WHERE i.enquiry_id=?`, enquiry.id).catch(() => null);
    if (!intake) {
      return {
        enquiryId: enquiry.id,
        enquiryRef: enquiry.enquiry_ref,
        state: "manual",
        message: "This Enquiry was created manually, so there is no originating email to show.",
        overview: null,
        original: null,
        attachments: [],
      };
    }
    if (!intake.communication_message_id) {
      return {
        enquiryId: enquiry.id,
        enquiryRef: enquiry.enquiry_ref,
        state: "missing",
        message: "The originating email relationship is retained, but its message content is currently unavailable. Reconnect Email and refresh the message before continuing with its attachments.",
        overview: intake.reviewed_brief ? { text: intake.reviewed_brief, kind: "reviewed_intake", label: "Reviewed enquiry overview" } : null,
        original: null,
        attachments: [],
      };
    }
    const providerState = parseJson(intake.provider_state_json);
    const providerMessageId = clean(intake.intake_provider_message_id || intake.provider_message_id) || null;
    const rows = await db.all(`SELECT ca.id,ca.file_name,ca.media_type,ca.size_bytes,ca.storage_key,ca.provider_attachment_id,ca.drive_file_id,ca.sha256,ca.content_id,ca.is_inline,
      ia.id intake_attachment_id,ia.storage_status,ia.canonical_document_id,ia.error_code,
      d.file_name filed_file_name,d.folder_path,d.web_view_link
      FROM communication_attachments ca
      LEFT JOIN enquiry_intake_attachments ia ON ia.communication_attachment_id=ca.id AND ia.enquiry_email_intake_id=?
      LEFT JOIN canonical_documents d ON d.id=ia.canonical_document_id
      WHERE ca.communication_message_id=? ORDER BY ca.created_at,ca.id`, intake.intake_id, intake.communication_message_id);
    return {
      enquiryId: enquiry.id,
      enquiryRef: enquiry.enquiry_ref,
      state: "available",
      message: providerState.providerRemoved
        ? "The retained email is available, but Gmail no longer reports the original message. Filed copies remain available where shown."
        : null,
      overview: intake.reviewed_brief ? { text: intake.reviewed_brief, kind: "reviewed_intake", label: "Reviewed enquiry overview" } : null,
      original: {
        communicationMessageId: intake.communication_message_id,
        providerMessageId,
        providerAvailable: Boolean(providerMessageId && !providerState.providerRemoved),
        sender: parseJson(intake.from_json, [])[0] || "Sender not recorded",
        recipients: parseJson(intake.to_json, []),
        subject: clean(intake.subject) || "No subject",
        receivedAt: intake.sent_at || intake.intake_created_at,
        bodyText: String(intake.body_text || ""),
        bodyHtmlRetained: Boolean(clean(intake.body_html)),
      },
      attachments: rows.map((row) => ({
        id: row.id,
        fileName: row.file_name,
        mediaType: row.media_type,
        sizeBytes: Number(row.size_bytes || 0),
        contentId: row.content_id || null,
        inline: Boolean(row.is_inline),
        classification: row.is_inline ? "inline_signature_resource" : String(row.media_type || "").startsWith("image/") ? "image_attachment" : "document_attachment",
        selectedForFiling: Boolean(row.intake_attachment_id),
        providerAttachmentId: row.provider_attachment_id || null,
        providerAvailable: Boolean(providerMessageId && row.provider_attachment_id && !providerState.providerRemoved),
        storageStatus: row.storage_status || "not_selected",
        storageErrorCode: row.error_code || null,
        canonicalDocumentId: row.canonical_document_id || null,
        filedFileName: row.filed_file_name || null,
        folderPath: row.folder_path || null,
        webViewLink: row.web_view_link || null,
      })),
    };
  }

  async function createProject(input = {}) {
    const clientId = clean(input.clientId), name = clean(input.name);
    if (!clientId) throw problem("Project creation requires a Client.", 422, "project_client_required");
    if (!name || /^project\s+\d+$/i.test(name)) throw problem("Use a reviewed project or site name; generic Project numbering is not allowed.", 422, "project_name_required");
    const client = await db.get("SELECT id FROM clients WHERE id=? AND deleted_at IS NULL", clientId);
    if (!client) throw problem("The selected Client is unavailable.", 404, "client_not_found");
    const projectId = input.id || id(), createdAt = timestamp(now);
    const existing = input.id ? await db.get("SELECT p.*,0 estimate_count,0 order_count FROM projects p WHERE p.id=? AND p.deleted_at IS NULL", projectId) : null;
    if (existing) {
      if (existing.client_id !== clientId || clean(existing.name) !== name) throw problem("This Project retry identity belongs to different reviewed details.", 409, "project_retry_conflict");
      return { ...mapProject(existing), driveProvisioning: await provisionProjectOutcome(projectId) };
    }
    await db.run(`INSERT INTO projects(id,client_id,source_enquiry_id,name,status,context_year,site_address,site_address_json,postcode,what3words,latitude,longitude,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, projectId, clientId, clean(input.sourceEnquiryId) || null, name, clean(input.status) || "active", Number(input.contextYear) || now().getUTCFullYear(), clean(input.siteAddress), json(input.siteAddressJson), clean(input.postcode), clean(input.what3words), Number.isFinite(Number(input.latitude)) ? Number(input.latitude) : null, Number.isFinite(Number(input.longitude)) ? Number(input.longitude) : null, createdAt, createdAt);
    const project = mapProject(await db.get("SELECT p.*,0 estimate_count,0 order_count FROM projects p WHERE p.id=?", projectId));
    const driveProvisioning = await provisionProjectOutcome(projectId);
    return { ...project, driveProvisioning };
  }

  async function listProjects({ clientId, projectId } = {}) {
    const clauses = ["p.deleted_at IS NULL"], params = [];
    if (clientId) { clauses.push("p.client_id=?"); params.push(clientId); }
    if (projectId) { clauses.push("p.id=?"); params.push(projectId); }
    const rows = await db.all(`SELECT p.*,
      (SELECT COUNT(*) FROM estimates e WHERE e.project_id=p.id AND e.deleted_at IS NULL) estimate_count,
      (SELECT COUNT(*) FROM orders o WHERE o.project_id=p.id) order_count
      FROM projects p WHERE ${clauses.join(" AND ")} ORDER BY p.context_year DESC,p.created_at DESC`, ...params);
    return rows.map(mapProject);
  }

  async function qualifyEnquiry(enquiryId, input = {}) {
    const mode = clean(input.mode);
    if (!['existing_client', 'new_client'].includes(mode)) throw problem("Qualification must choose Existing Client or New Client.", 422, "qualification_mode_required");
    const result = await transaction(db, async () => {
      const enquiry = await db.get("SELECT * FROM enquiries WHERE id=? AND deleted_at IS NULL", enquiryId);
      if (!enquiry) throw problem("Enquiry not found.", 404, "enquiry_not_found");
      if (enquiry.converted_client_id || enquiry.converted_project_id) throw problem("This Enquiry has already been qualified.", 409, "enquiry_already_qualified");
      let client;
      if (mode === "existing_client") {
        client = await db.get("SELECT * FROM clients WHERE id=? AND deleted_at IS NULL", clean(input.clientId));
        if (!client) throw problem("Choose an existing active Client.", 422, "existing_client_required");
      } else {
        const clientId = input.clientId || id(), clientRef = await allocateCanonicalReference(db, { kind: "client", entityId: clientId, reason: `enquiry_conversion:${enquiry.enquiry_ref}`, now: timestamp(now) });
        const clientName = clean(input.client?.name || enquiry.display_name || enquiry.company_name);
        if (!clientName) throw problem("New Client qualification requires a canonical name.", 422, "client_identity_required");
        await db.run(`INSERT INTO clients(id,name,email,phone,mobile,home,project_name,created_at,client_ref,client_type,contact_name,company_name,customer_address,project_address,invoice_address,invoice_same_as_customer,invoice_same_as_project,customer_address_json,project_address_json,invoice_address_json,what3words,latitude,longitude,deleted_at,commercial_lifecycle,reference_namespace,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,'prospect','live',?)`, clientId, clientName, clean(input.client?.email || enquiry.email), clean(input.client?.telephone || enquiry.telephone), clean(input.client?.telephone || enquiry.telephone), "", clean(input.project?.name || enquiry.project_name), timestamp(now), clientRef, clean(input.client?.type) || (enquiry.company_name ? "Business" : "Individual"), clean(input.client?.contactName), clean(input.client?.companyName || enquiry.company_name), clean(input.client?.customerAddress || enquiry.site_address), clean(input.project?.siteAddress || enquiry.site_address), clean(input.client?.invoiceAddress || enquiry.site_address), 0, 1, json(input.client?.customerAddressJson || enquiry.site_address_json), json(input.project?.siteAddressJson || enquiry.site_address_json), json(input.client?.invoiceAddressJson || enquiry.site_address_json), clean(input.project?.what3words), Number.isFinite(Number(input.project?.latitude)) ? Number(input.project.latitude) : null, Number.isFinite(Number(input.project?.longitude)) ? Number(input.project.longitude) : null, timestamp(now));
        client = await db.get("SELECT * FROM clients WHERE id=?", clientId);
      }
      const projectName = clean(input.project?.name || enquiry.project_name);
      if (!projectName || /^project\s+\d+$/i.test(projectName)) throw problem("Qualification requires a reviewed project or site name.", 422, "project_name_required");
      const projectId = input.project?.id || id(), qualifiedAt = timestamp(now);
      await db.run(`INSERT INTO projects(id,client_id,source_enquiry_id,name,status,context_year,site_address,site_address_json,postcode,what3words,latitude,longitude,created_at,updated_at)
        VALUES(?,?,?,?,'active',?,?,?,?,?,?,?, ?,?)`, projectId, client.id, enquiry.id, projectName, Number(input.project?.contextYear) || now().getUTCFullYear(), clean(input.project?.siteAddress || enquiry.site_address), json(input.project?.siteAddressJson || parseJson(enquiry.site_address_json)), clean(input.project?.postcode), clean(input.project?.what3words), Number.isFinite(Number(input.project?.latitude)) ? Number(input.project.latitude) : null, Number.isFinite(Number(input.project?.longitude)) ? Number(input.project.longitude) : null, qualifiedAt, qualifiedAt);
      const evidence = { enquiryRef: enquiry.enquiry_ref, qualificationMode: mode, clientId: client.id, clientRef: client.client_ref, projectId, qualifiedAt };
      await db.run(`UPDATE enquiries SET status='qualified',qualification_mode=?,converted_client_id=?,converted_project_id=?,conversion_evidence_json=?,qualified_at=?,updated_at=? WHERE id=?`, mode, client.id, projectId, JSON.stringify(evidence), qualifiedAt, qualifiedAt, enquiry.id);
      await db.run(`UPDATE crm_record_work_states SET stage='qualified',waiting_for='none',next_action='Prepare Estimate',due_at=NULL,updated_at=? WHERE record_kind='enquiry' AND record_id=?`, qualifiedAt, enquiry.id);
      await db.run(`INSERT INTO crm_record_work_states(record_kind,record_id,owner_user_id,owner_name,stage,waiting_for,next_action,due_at,last_contact_at,created_at,updated_at)
        SELECT 'project',?,owner_user_id,owner_name,'qualified','none','Prepare Estimate',NULL,last_contact_at,?,?
        FROM crm_record_work_states WHERE record_kind='enquiry' AND record_id=?
        ON CONFLICT(record_kind,record_id) DO NOTHING`, projectId, qualifiedAt, qualifiedAt, enquiry.id);
      return { enquiry: mapEnquiry(await db.get(`${enquirySelect} WHERE e.id=?`, enquiry.id)), client: { id: client.id, clientRef: client.client_ref, name: client.name }, project: mapProject(await db.get("SELECT p.*,0 estimate_count,0 order_count FROM projects p WHERE id=?", projectId)) };
    });
    const driveProvisioning = await provisionProjectOutcome(result.project.id);
    const attachmentStorage = driveProvisioning.status === "provisioned" && driveTransitions?.storeReviewedEnquiryAttachments
      ? await driveTransitions.storeReviewedEnquiryAttachments(result.enquiry.id, result.project.id).catch((cause) => ({ status: "failed", stored: 0, failed: 0, files: [], code: clean(cause?.code) || "attachment_storage_failed", message: "The Client and Project were saved, but reviewed email attachments could not be filed. Retry folder creation after checking the provider connection." }))
      : { status: driveProvisioning.status === "provisioned" ? "no_reviewed_attachments" : "pending_folder_provisioning", stored: 0, failed: 0, files: [] };
    const driveTransitionStatus = driveProvisioning.status === "provisioned"
      ? "linked"
      : driveProvisioning.status === "not_configured"
        ? "not_required"
        : driveProvisioning.status === "failed"
          ? "failed"
          : "pending";
    await db.run("UPDATE enquiries SET drive_transition_status=?,updated_at=? WHERE id=?", driveTransitionStatus, timestamp(now), result.enquiry.id);
    return {
      ...result,
      enquiry: mapEnquiry(await db.get(`${enquirySelect} WHERE e.id=?`, result.enquiry.id)),
      driveProvisioning,
      attachmentStorage,
    };
  }

  async function fileReviewedEnquiryAttachments(enquiryId) {
    const enquiry = await db.get(`${enquirySelect} WHERE e.id=? AND e.deleted_at IS NULL`, clean(enquiryId));
    if (!enquiry) throw problem("Enquiry not found.", 404, "enquiry_not_found");
    if (!enquiry.converted_project_id) throw problem("Connect this Enquiry to a Client and Project before filing its reviewed attachments.", 409, "enquiry_project_required");
    const driveProvisioning = await provisionProjectOutcome(enquiry.converted_project_id);
    const attachmentStorage = driveProvisioning.status === "provisioned" && driveTransitions?.storeReviewedEnquiryAttachments
      ? await driveTransitions.storeReviewedEnquiryAttachments(enquiry.id, enquiry.converted_project_id).catch((cause) => ({ status: "failed", stored: 0, failed: 0, pending: 0, files: [], code: clean(cause?.code) || "attachment_storage_failed", message: "The Client and Project are retained, but the selected email attachments could not be filed. Check the provider connection and retry safely." }))
      : { status: driveProvisioning.status === "provisioned" ? "no_reviewed_attachments" : "pending_folder_provisioning", stored: 0, failed: 0, pending: 0, files: [] };
    const driveTransitionStatus = driveProvisioning.status === "provisioned"
      ? attachmentStorage.status === "failed" || attachmentStorage.status === "partial_failure" ? "failed" : "linked"
      : driveProvisioning.status === "not_configured" ? "not_required" : driveProvisioning.status === "failed" ? "failed" : "pending";
    await db.run("UPDATE enquiries SET drive_transition_status=?,updated_at=? WHERE id=?", driveTransitionStatus, timestamp(now), enquiry.id);
    return { enquiry: mapEnquiry(await db.get(`${enquirySelect} WHERE e.id=?`, enquiry.id)), driveProvisioning, attachmentStorage };
  }

  return { createEnquiry, listEnquiries, getEnquirySource, qualifyEnquiry, fileReviewedEnquiryAttachments, createProject, listProjects, provisionProjectDrive: provisionProjectOutcome };
}

function parseJson(value, fallback = {}) { try { return JSON.parse(value || JSON.stringify(fallback)); } catch { return fallback; } }
