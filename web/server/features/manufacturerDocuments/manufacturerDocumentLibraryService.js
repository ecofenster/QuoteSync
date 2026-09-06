import { randomUUID } from "node:crypto";

const parseJson = (value, fallback) => { try { return JSON.parse(value ?? ""); } catch { return fallback; } };
const text = (value) => String(value ?? "").trim();
const formats = new Set(["PDF", "DWG", "RVT", "IFC", "OTHER"]);

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
  async function create(input, actorId = "user-1") {
    const ownerKind = input?.ownerKind === "supplier" ? "supplier" : "manufacturer";
    const ownerName = text(input?.ownerName), productSystemName = text(input?.productSystemName), title = text(input?.title), subcategory = text(input?.subcategory), canonicalDocumentId = text(input?.canonicalDocumentId);
    const category = input?.category === "system_drawing" ? "system_drawing" : "certificate", format = text(input?.documentFormat).toUpperCase();
    if (!ownerName || !productSystemName || !title || !subcategory || !canonicalDocumentId) fail("Owner, product/system, category detail, title and canonical file are required.");
    if (!formats.has(format)) fail("Document format must be PDF, DWG, RVT, IFC or Other.");
    const canonical = await db.get("SELECT id,file_name,mime_type,removed_at,trashed FROM canonical_documents WHERE id=?", canonicalDocumentId);
    if (!canonical || canonical.removed_at || canonical.trashed) fail("Choose an active canonical document.", 422, "canonical_document_required");
    const now = new Date().toISOString(), id = randomUUID();
    await db.run(`INSERT INTO manufacturer_system_documents(id,owner_kind,owner_id,owner_code,owner_name,product_system_id,product_system_name,category,subcategory,title,document_format,canonical_document_id,version_label,issue_date,expiry_date,jurisdiction,applicability_json,source_provenance_json,status,created_by,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?,?)`, id, ownerKind, text(input.ownerId) || null, text(input.ownerCode) || null, ownerName, text(input.productSystemId) || null, productSystemName, category, subcategory, title, format, canonicalDocumentId, text(input.versionLabel) || null, text(input.issueDate) || null, text(input.expiryDate) || null, text(input.jurisdiction) || null, JSON.stringify(input.applicability || {}), JSON.stringify({ source: "canonical_document", actorId, ...(input.sourceProvenance || {}) }), actorId, now, now);
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
    const [document, project] = await Promise.all([db.get("SELECT id FROM manufacturer_system_documents WHERE id=? AND status='active'", id), db.get("SELECT id FROM projects WHERE id=? AND deleted_at IS NULL", projectId)]);
    if (!document || !project) fail("Choose an active library document and active Project.", 422, "document_project_link_invalid");
    const now = new Date().toISOString(), portalVisibility = visibility === "customer_approved" ? "customer_approved" : "internal_only";
    await db.run(`INSERT INTO project_manufacturer_document_links(project_id,manufacturer_system_document_id,portal_visibility,applicability_evidence_json,linked_by,linked_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(project_id,manufacturer_system_document_id) DO UPDATE SET portal_visibility=excluded.portal_visibility,applicability_evidence_json=excluded.applicability_evidence_json,linked_by=excluded.linked_by,linked_at=excluded.linked_at`, projectId, id, portalVisibility, JSON.stringify(evidence), actorId, now);
    return { projectId, manufacturerSystemDocumentId: id, portalVisibility, applicabilityEvidence: evidence, linkedBy: actorId, linkedAt: now };
  }
  return { list, listCanonicalSources, create, supersede, linkToProject };
}
