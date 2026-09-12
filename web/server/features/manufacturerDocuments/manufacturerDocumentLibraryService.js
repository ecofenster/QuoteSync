import { randomUUID } from "node:crypto";

const parseJson = (value, fallback) => { try { return JSON.parse(value ?? ""); } catch { return fallback; } };
const text = (value) => String(value ?? "").trim();
const formats = new Set(["PDF", "DWG", "RVT", "IFC", "OTHER"]);
const legacyMethodCodes = ["FACTORY PRICE", "1 TO 1 PRICING", "STAGED DISCOUNT"];

function fail(message, status = 400, code = "invalid_manufacturer_document") { throw Object.assign(new Error(message), { status, code }); }

function mapRow(row) {
  return {
    id: row.id, ownerKind: row.owner_kind, ownerId: row.owner_id || null, ownerCode: row.owner_code || null,
    ownerName: row.owner_name, productSystemId: row.product_system_id || null, productSystemName: row.product_system_name,
    category: row.category, subcategory: row.subcategory, title: row.title, documentFormat: row.document_format,
    canonicalDocumentId: row.canonical_document_id, fileName: row.file_name || null, versionLabel: row.version_label || null,
    issueDate: row.issue_date || null, expiryDate: row.expiry_date || null, jurisdiction: row.jurisdiction || null,
    applicability: parseJson(row.applicability_json, {}), sourceProvenance: parseJson(row.source_provenance_json, {}),
    status: row.status, supersededById: row.superseded_by_id || null, createdBy: row.created_by,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function createManufacturerDocumentLibraryService(db) {
  const selectSql = `SELECT library.*,document.file_name FROM manufacturer_system_documents library JOIN canonical_documents document ON document.id=library.canonical_document_id`;
  async function list(filters = {}) {
    const conditions = ["1=1"], values = [];
    for (const [field, column] of [["ownerName","owner_name"],["productSystemName","product_system_name"],["category","category"],["status","status"]]) {
      if (text(filters[field])) { conditions.push(`library.${column}=?`); values.push(text(filters[field])); }
    }
    return (await db.all(`${selectSql} WHERE ${conditions.join(" AND ")} ORDER BY library.owner_name,library.product_system_name,library.category,library.subcategory,library.title,library.created_at DESC`, ...values)).map(mapRow);
  }
  async function listCanonicalSources(search = "") {
    const query = `%${text(search).toLowerCase()}%`;
    return db.all(`SELECT d.id canonicalDocumentId,d.file_name fileName,d.mime_type mimeType,d.document_type documentType,
      d.provider,d.folder_path folderPath,d.provider_modified_at modifiedAt
      FROM canonical_documents d WHERE d.removed_at IS NULL AND d.trashed=0
      AND (?='%%' OR lower(d.file_name) LIKE ? OR lower(d.folder_path) LIKE ?)
      ORDER BY COALESCE(d.provider_modified_at,d.updated_at) DESC LIMIT 100`, query, query, query);
  }
  async function identityOptions() {
    const [manufacturers, products, suppliers] = await Promise.all([
      db.all("SELECT id,name,code FROM configurator_manufacturers WHERE is_active=1 ORDER BY name,code"),
      db.all(`SELECT product.id,product.manufacturer_id manufacturerId,product.name,product.code,manufacturer.name manufacturerName
        FROM configurator_products product JOIN configurator_manufacturers manufacturer ON manufacturer.id=product.manufacturer_id
        WHERE product.is_active=1 AND manufacturer.is_active=1 ORDER BY manufacturer.name,product.name,product.code`),
      db.all(`SELECT supplier_code id,supplier_name name FROM supplier_commercial_defaults
        WHERE active=1 AND NOT (upper(trim(supplier_name))='ANY' AND upper(trim(supplier_code)) IN (${legacyMethodCodes.map(() => "?").join(",")}))
        ORDER BY supplier_name,supplier_code`, ...legacyMethodCodes),
    ]);
    return { manufacturers, products, suppliers };
  }
  async function resolveIdentity(input) {
    const ownerKind = input?.ownerKind === "supplier" ? "supplier" : "manufacturer";
    const ownerId = text(input?.ownerId), productSystemId = text(input?.productSystemId);
    if (!ownerId || !productSystemId) fail("Choose a current manufacturer or supplier and a current product / system.", 422, "canonical_document_identity_required");
    const product = await db.get(`SELECT product.id,product.name,product.code,product.manufacturer_id,manufacturer.name manufacturer_name
      FROM configurator_products product JOIN configurator_manufacturers manufacturer ON manufacturer.id=product.manufacturer_id
      WHERE product.id=? AND product.is_active=1 AND manufacturer.is_active=1`, productSystemId);
    if (!product) fail("The selected product / system is no longer available. Refresh and choose a current option.", 409, "product_system_unavailable");
    if (ownerKind === "manufacturer") {
      const owner = await db.get("SELECT id,name,code FROM configurator_manufacturers WHERE id=? AND is_active=1", ownerId);
      if (!owner) fail("The selected manufacturer is no longer available. Refresh and choose a current option.", 409, "document_owner_unavailable");
      if (product.manufacturer_id !== owner.id) fail("Choose a product / system owned by the selected manufacturer.", 422, "product_system_owner_mismatch");
      return { ownerKind, ownerId: owner.id, ownerCode: owner.code || null, ownerName: owner.name, productSystemId: product.id, productSystemName: product.name };
    }
    const owner = await db.get(`SELECT supplier_code id,supplier_name name FROM supplier_commercial_defaults
      WHERE supplier_code=? AND active=1 AND NOT (upper(trim(supplier_name))='ANY' AND upper(trim(supplier_code)) IN (${legacyMethodCodes.map(() => "?").join(",")}))`, ownerId, ...legacyMethodCodes);
    if (!owner) fail("The selected supplier is no longer available. Refresh and choose a current option.", 409, "document_owner_unavailable");
    return { ownerKind, ownerId: owner.id, ownerCode: owner.id, ownerName: owner.name, productSystemId: product.id, productSystemName: product.name };
  }
  async function listProjectOptions(search = "") {
    const query = `%${text(search).toLowerCase()}%`;
    return db.all(`SELECT project.id,project.name,client.id clientId,client.client_ref clientReference,client.name clientName
      FROM projects project JOIN clients client ON client.id=project.client_id
      WHERE project.deleted_at IS NULL AND client.deleted_at IS NULL
      AND (?='%%' OR lower(project.name) LIKE ? OR lower(client.name) LIKE ? OR lower(client.client_ref) LIKE ?)
      ORDER BY project.updated_at DESC,project.name LIMIT 50`, query, query, query, query);
  }
  async function projectApplicability(id, projectId) {
    const [document, project, estimate, existing] = await Promise.all([
      db.get(`${selectSql} WHERE library.id=? AND library.status='active'`, text(id)),
      db.get(`SELECT project.id,project.name,client.id clientId,client.client_ref clientReference,client.name clientName
        FROM projects project JOIN clients client ON client.id=project.client_id WHERE project.id=? AND project.deleted_at IS NULL AND client.deleted_at IS NULL`, text(projectId)),
      db.get(`SELECT id,estimate_ref,revision_no,positions_json FROM estimates WHERE project_id=? AND deleted_at IS NULL
        ORDER BY CASE WHEN status='Draft' THEN 0 ELSE 1 END,revision_no DESC,updated_at DESC LIMIT 1`, text(projectId)),
      db.get("SELECT * FROM project_manufacturer_document_links WHERE project_id=? AND manufacturer_system_document_id=?", text(projectId), text(id)),
    ]);
    if (!document || !project) fail("Choose an active library document and active Project.", 422, "document_project_link_invalid");
    const positions = parseJson(estimate?.positions_json, []).map((position) => ({ id: text(position?.id), reference: text(position?.positionRef || position?.reference || position?.customerReference) || "Position", description: text(position?.description || position?.productSystem || position?.positionType) || "Specification" })).filter((position) => position.id);
    return { document: mapRow(document), project, estimate: estimate ? { id: estimate.id, reference: estimate.estimate_ref, revision: Number(estimate.revision_no || 1) } : null, positions, currentLink: existing ? { portalVisibility: existing.portal_visibility, applicabilityEvidence: parseJson(existing.applicability_evidence_json, {}), linkedAt: existing.linked_at } : null };
  }
  async function create(input, actorId = "user-1") {
    const identity = await resolveIdentity(input), { ownerKind, ownerId, ownerCode, ownerName, productSystemId, productSystemName } = identity;
    const title = text(input?.title), subcategory = text(input?.subcategory), canonicalDocumentId = text(input?.canonicalDocumentId);
    const category = input?.category === "system_drawing" ? "system_drawing" : "certificate", format = text(input?.documentFormat).toUpperCase();
    if (!ownerName || !productSystemName || !title || !subcategory || !canonicalDocumentId) fail("Owner, product/system, category detail, title and canonical file are required.");
    if (!formats.has(format)) fail("Document format must be PDF, DWG, RVT, IFC or Other.");
    const canonical = await db.get("SELECT id,file_name,mime_type,removed_at,trashed FROM canonical_documents WHERE id=?", canonicalDocumentId);
    if (!canonical || canonical.removed_at || canonical.trashed) fail("Choose an active canonical document.", 422, "canonical_document_required");
    const now = new Date().toISOString(), id = randomUUID();
    await db.run(`INSERT INTO manufacturer_system_documents(id,owner_kind,owner_id,owner_code,owner_name,product_system_id,product_system_name,category,subcategory,title,document_format,canonical_document_id,version_label,issue_date,expiry_date,jurisdiction,applicability_json,source_provenance_json,status,created_by,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?,?)`, id, ownerKind, ownerId, ownerCode, ownerName, productSystemId, productSystemName, category, subcategory, title, format, canonicalDocumentId, text(input.versionLabel) || null, text(input.issueDate) || null, text(input.expiryDate) || null, text(input.jurisdiction) || null, JSON.stringify(input.applicability || {}), JSON.stringify({ source: "canonical_document", actorId, ...(input.sourceProvenance || {}) }), actorId, now, now);
    return mapRow(await db.get(`${selectSql} WHERE library.id=?`, id));
  }
  async function supersede(id, replacementInput, actorId = "user-1") {
    const current = await db.get("SELECT * FROM manufacturer_system_documents WHERE id=?", text(id));
    if (!current) return null;
    if (current.status === "superseded") fail("This document version is already superseded.", 409, "document_already_superseded");
    await db.exec("BEGIN IMMEDIATE");
    try {
      const replacement = await create({ ownerKind: current.owner_kind, ownerId: current.owner_id, ownerCode: current.owner_code, ownerName: current.owner_name, productSystemId: current.product_system_id, productSystemName: current.product_system_name, category: current.category, subcategory: replacementInput.subcategory ?? current.subcategory, title: replacementInput.title ?? current.title, documentFormat: replacementInput.documentFormat, canonicalDocumentId: replacementInput.canonicalDocumentId, versionLabel: replacementInput.versionLabel, issueDate: replacementInput.issueDate, expiryDate: replacementInput.expiryDate, jurisdiction: replacementInput.jurisdiction ?? current.jurisdiction, applicability: replacementInput.applicability ?? parseJson(current.applicability_json, {}), sourceProvenance: { supersedes: id } }, actorId);
      const now = new Date().toISOString();
      await db.run("UPDATE manufacturer_system_documents SET status='superseded',superseded_by_id=?,updated_at=? WHERE id=?", replacement.id, now, id);
      await db.exec("COMMIT");
      return { previous: mapRow({ ...current, status: "superseded", superseded_by_id: replacement.id, updated_at: now }), replacement };
    } catch (error) { await db.exec("ROLLBACK"); throw error; }
  }
  async function linkToProject(id, projectId, visibility = "internal_only", actorId = "user-1", evidence = {}) {
    const context = await projectApplicability(id, projectId), document = context.document, project = context.project;
    if (!document || !project) fail("Choose an active library document and active Project.", 422, "document_project_link_invalid");
    const selectedPositionIds = [...new Set(Array.isArray(evidence?.positionIds) ? evidence.positionIds.map(text).filter(Boolean) : [])];
    const positionIds = new Set(context.positions.map((position) => position.id));
    if (selectedPositionIds.some((positionId) => !positionIds.has(positionId))) fail("One or more selected Positions no longer belong to the current Project Estimate. Refresh and review again.", 409, "document_position_scope_mismatch");
    const projectWide = evidence?.projectWide === true;
    if (!projectWide && !selectedPositionIds.length) fail("Choose at least one applicable Position or confirm that the document applies to the whole Project.", 422, "document_applicability_required");
    const now = new Date().toISOString(), portalVisibility = visibility === "customer_approved" ? "customer_approved" : "internal_only";
    if (portalVisibility === "customer_approved" && evidence?.customerSharingReviewed !== true) fail("Confirm that this exact document is suitable for the customer before sharing it.", 422, "customer_document_review_required");
    const reviewedEvidence = { projectWide, positionIds: selectedPositionIds, estimateId: context.estimate?.id || null, estimateReference: context.estimate?.reference || null, reviewStatus: "reviewed", customerSharingReviewed: portalVisibility === "customer_approved", ...(text(evidence?.note) ? { note: text(evidence.note) } : {}) };
    await db.run(`INSERT INTO project_manufacturer_document_links(project_id,manufacturer_system_document_id,portal_visibility,applicability_evidence_json,linked_by,linked_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(project_id,manufacturer_system_document_id) DO UPDATE SET portal_visibility=excluded.portal_visibility,applicability_evidence_json=excluded.applicability_evidence_json,linked_by=excluded.linked_by,linked_at=excluded.linked_at`, projectId, id, portalVisibility, JSON.stringify(reviewedEvidence), actorId, now);
    return { projectId, projectName: project.name, clientName: project.clientName, manufacturerSystemDocumentId: id, documentTitle: document.title, fileName: document.fileName, portalVisibility, applicabilityEvidence: reviewedEvidence, linkedBy: actorId, linkedAt: now };
  }
  return { list, listCanonicalSources, identityOptions, listProjectOptions, projectApplicability, create, supersede, linkToProject };
}
