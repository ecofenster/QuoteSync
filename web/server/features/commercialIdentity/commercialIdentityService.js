import { randomUUID } from "node:crypto";
import { allocateCanonicalReference } from "./referenceAllocator.js";

const timestamp = (now) => now().toISOString();
const clean = (value) => String(value || "").trim();
const json = (value, fallback = {}) => { try { return JSON.stringify(value ?? fallback); } catch { return JSON.stringify(fallback); } };
const problem = (message, status, code) => Object.assign(new Error(message), { status, code });

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
  };
}

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
  async function createEnquiry(input = {}) {
    const displayName = clean(input.displayName || input.companyName);
    if (!displayName) throw problem("An Enquiry needs a person or company name.", 422, "enquiry_identity_required");
    const enquiryId = input.id || id(), createdAt = timestamp(now);
    const result = await transaction(db, async () => {
      const enquiryRef = await allocateCanonicalReference(db, { kind: "enquiry", entityId: enquiryId, now: createdAt });
      await db.run(`INSERT INTO enquiries(id,enquiry_ref,status,source,lead_source,display_name,company_name,email,telephone,project_name,site_address,site_address_json,notes,drive_transition_status,conversion_evidence_json,created_at,updated_at)
        VALUES(?,?,'new',?,?,?,?,?,?,?,?,?,?,'pending','{}',?,?)`, enquiryId, enquiryRef, clean(input.source), clean(input.leadSource), displayName, clean(input.companyName), clean(input.email), clean(input.telephone), clean(input.projectName), clean(input.siteAddress), json(input.siteAddressJson), clean(input.notes), createdAt, createdAt);
      return mapEnquiry(await db.get("SELECT * FROM enquiries WHERE id=?", enquiryId));
    });
    if (driveTransitions?.provisionEnquiry) driveTransitions.provisionEnquiry(enquiryId).then(async (drive) => {
      await db.run("UPDATE enquiries SET drive_transition_status=?,updated_at=? WHERE id=?", drive?.status === "provisioned" || drive?.status === "linked" ? "linked" : "pending", timestamp(now), enquiryId);
    }).catch(async () => { await db.run("UPDATE enquiries SET drive_transition_status='failed',updated_at=? WHERE id=?", timestamp(now), enquiryId).catch(() => {}); });
    return result;
  }

  async function listEnquiries({ includeConverted = true } = {}) {
    const rows = await db.all(`SELECT * FROM enquiries WHERE deleted_at IS NULL ${includeConverted ? "" : "AND status NOT IN ('qualified','converted')"} ORDER BY created_at DESC`);
    return rows.map(mapEnquiry);
  }

  async function createProject(input = {}) {
    const clientId = clean(input.clientId), name = clean(input.name);
    if (!clientId) throw problem("Project creation requires a Client.", 422, "project_client_required");
    if (!name || /^project\s+\d+$/i.test(name)) throw problem("Use a reviewed project or site name; generic Project numbering is not allowed.", 422, "project_name_required");
    const client = await db.get("SELECT id FROM clients WHERE id=? AND deleted_at IS NULL", clientId);
    if (!client) throw problem("The selected Client is unavailable.", 404, "client_not_found");
    const projectId = input.id || id(), createdAt = timestamp(now);
    await db.run(`INSERT INTO projects(id,client_id,source_enquiry_id,name,status,context_year,site_address,site_address_json,postcode,what3words,latitude,longitude,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, projectId, clientId, clean(input.sourceEnquiryId) || null, name, clean(input.status) || "active", Number(input.contextYear) || now().getUTCFullYear(), clean(input.siteAddress), json(input.siteAddressJson), clean(input.postcode), clean(input.what3words), Number.isFinite(Number(input.latitude)) ? Number(input.latitude) : null, Number.isFinite(Number(input.longitude)) ? Number(input.longitude) : null, createdAt, createdAt);
    const project = mapProject(await db.get("SELECT p.*,0 estimate_count,0 order_count FROM projects p WHERE p.id=?", projectId));
    if (driveTransitions?.provisionProject) driveTransitions.provisionProject(projectId).catch(() => {});
    return project;
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
      return { enquiry: mapEnquiry(await db.get("SELECT * FROM enquiries WHERE id=?", enquiry.id)), client: { id: client.id, clientRef: client.client_ref, name: client.name }, project: mapProject(await db.get("SELECT p.*,0 estimate_count,0 order_count FROM projects p WHERE id=?", projectId)) };
    });
    if (driveTransitions?.provisionProject) driveTransitions.provisionProject(result.project.id).catch(() => {});
    return result;
  }

  return { createEnquiry, listEnquiries, qualifyEnquiry, createProject, listProjects };
}

function parseJson(value) { try { return JSON.parse(value || "{}"); } catch { return {}; } }
