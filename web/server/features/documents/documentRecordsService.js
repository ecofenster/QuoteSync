const managedProvider = "quotesuite_managed";

function legacyEstimateScope({ clientId, projectId, estimateId }, alias = "e") {
  if (estimateId) return { sql: `${alias}.id=?`, value: estimateId };
  if (projectId) return { sql: `${alias}.project_id=?`, value: projectId };
  if (clientId) return { sql: `${alias}.client_id=?`, value: clientId };
  return null;
}

function canonicalDocumentScope({ clientId, projectId, estimateId, enquiryId }) {
  if (estimateId) return { sql: "d.estimate_id=?", value: estimateId };
  if (projectId) return { sql: "d.project_id=?", value: projectId };
  if (clientId) return { sql: "d.client_id=?", value: clientId };
  if (enquiryId) return { sql: "d.enquiry_id=?", value: enquiryId };
  throw Object.assign(new Error("enquiry_id, client_id, project_id or estimate_id is required."), { status: 400, code: "document_scope_required" });
}

function responseScope(input) {
  if (input.estimateId) return { estimateId: input.estimateId };
  if (input.projectId) return { projectId: input.projectId };
  if (input.clientId) return { clientId: input.clientId };
  return { enquiryId: input.enquiryId };
}

export function createDocumentRecordsService(db) {
  async function list(input = {}) {
    const canonicalScope = canonicalDocumentScope(input);
    const legacyScope = legacyEstimateScope(input);
    const account = await db.get("SELECT account_id FROM integration_oauth_connections WHERE provider='google_workspace' AND status='connected'");
    const supplierRows = legacyScope ? await db.all(`
      SELECT a.id,a.original_file_name,a.media_type,a.size_bytes,a.sha256,a.created_at,a.document_kind,
        r.id revision_id,r.revision_sequence,r.supplier_quotation_number,r.supplier_revision,
        q.id supplier_quote_id,q.supplier_code,q.supplier_name,
        e.id estimate_id,e.client_id,e.project_id,e.estimate_ref,COALESCE(p.name,c.project_name) project_name,
        l.provider_file_id,l.provider_folder_id,l.created_at provider_linked_at
      FROM supplier_quote_attachments a
      JOIN supplier_quote_revisions r ON r.id=a.revision_id AND r.estimate_id=a.estimate_id
      JOIN supplier_quotes q ON q.id=r.supplier_quote_id AND q.estimate_id=r.estimate_id
      JOIN estimates e ON e.id=a.estimate_id JOIN clients c ON c.id=e.client_id
      LEFT JOIN projects p ON p.id=e.project_id
      LEFT JOIN drive_document_links l ON l.provider='google_drive' AND l.source_attachment_id=a.id
      WHERE ${legacyScope.sql} AND e.deleted_at IS NULL AND c.deleted_at IS NULL
      ORDER BY a.created_at DESC`, legacyScope.value) : [];
    const quotationRows = legacyScope ? await db.all(`
      SELECT d.id,d.quotation_revision,d.file_name,d.media_type,d.size_bytes,d.sha256,d.created_at,
        e.id estimate_id,e.client_id,e.project_id,e.estimate_ref,COALESCE(p.name,c.project_name) project_name,
        iq.id issued_quotation_id,iq.status quotation_status,iq.issued_at,l.provider_file_id,l.provider_folder_id,l.created_at provider_linked_at
      FROM customer_quotation_documents d
      JOIN estimates e ON e.id=d.estimate_id JOIN clients c ON c.id=e.client_id
      LEFT JOIN projects p ON p.id=e.project_id
      LEFT JOIN issued_quotations iq ON iq.id=(SELECT candidate.id FROM issued_quotations candidate WHERE candidate.document_id=d.id ORDER BY candidate.created_at DESC LIMIT 1)
      LEFT JOIN drive_document_links l ON l.provider='google_drive' AND l.quotation_document_id=d.id
      WHERE ${legacyScope.sql} AND e.deleted_at IS NULL AND c.deleted_at IS NULL
      ORDER BY d.created_at DESC`, legacyScope.value) : [];
    const legacyFolderRows = legacyScope ? await db.all(`
      SELECT f.*,e.client_id,e.project_id,e.estimate_ref,COALESCE(p.name,c.project_name) project_name
      FROM drive_project_folders f JOIN estimates e ON e.id=f.estimate_id JOIN clients c ON c.id=e.client_id
      LEFT JOIN projects p ON p.id=e.project_id
      WHERE ${legacyScope.sql} AND e.deleted_at IS NULL AND c.deleted_at IS NULL
      ORDER BY e.created_at DESC,f.created_at`, legacyScope.value) : [];
    const discoveredRows = legacyScope ? await db.all(`
      SELECT d.*,e.client_id,e.project_id,e.estimate_ref,COALESCE(p.name,c.project_name) project_name
      FROM drive_discovered_documents d JOIN estimates e ON e.id=d.estimate_id JOIN clients c ON c.id=e.client_id
      LEFT JOIN projects p ON p.id=e.project_id
      LEFT JOIN drive_document_links l ON l.provider=d.provider AND l.provider_file_id=d.provider_file_id
      WHERE ${legacyScope.sql} AND e.deleted_at IS NULL AND c.deleted_at IS NULL AND l.id IS NULL
      ORDER BY COALESCE(d.provider_modified_at,d.updated_at) DESC`, legacyScope.value) : [];
    const syncRows = legacyScope ? await db.all(`SELECT s.* FROM drive_document_sync_states s JOIN estimates e ON e.id=s.estimate_id JOIN clients c ON c.id=e.client_id WHERE ${legacyScope.sql} AND e.deleted_at IS NULL AND c.deleted_at IS NULL ORDER BY s.updated_at DESC`, legacyScope.value) : [];
    const canonicalRows = await db.all(`SELECT d.*,e.estimate_ref,p.name project_name FROM canonical_documents d LEFT JOIN estimates e ON e.id=d.estimate_id LEFT JOIN projects p ON p.id=d.project_id WHERE ${canonicalScope.sql} ORDER BY COALESCE(d.provider_modified_at,d.updated_at) DESC`, canonicalScope.value);
    const canonicalFolderRows = input.enquiryId
      ? await db.all("SELECT f.*,NULL client_id,NULL project_id,NULL estimate_id,NULL estimate_ref,NULL project_name FROM canonical_drive_folders f WHERE f.entity_kind='enquiry' AND f.entity_id=? ORDER BY f.created_at", input.enquiryId)
      : input.estimateId
        ? await db.all(`SELECT f.*,e.client_id,e.project_id,e.id estimate_id,e.estimate_ref,p.name project_name FROM estimates e LEFT JOIN projects p ON p.id=e.project_id JOIN canonical_drive_folders f ON (f.entity_kind='estimate' AND f.entity_id=e.id) OR (f.entity_kind='project' AND f.entity_id=e.project_id) WHERE e.id=? ORDER BY f.created_at`, input.estimateId)
        : input.projectId
          ? await db.all(`SELECT f.*,p.client_id,p.id project_id,NULL estimate_id,NULL estimate_ref,p.name project_name FROM projects p JOIN canonical_drive_folders f ON f.entity_kind='project' AND f.entity_id=p.id WHERE p.id=? ORDER BY f.created_at`, input.projectId)
          : await db.all(`SELECT f.*,p.client_id,p.id project_id,NULL estimate_id,NULL estimate_ref,p.name project_name FROM projects p JOIN canonical_drive_folders f ON f.entity_kind='project' AND f.entity_id=p.id WHERE p.client_id=? UNION ALL SELECT f.*,f.entity_id client_id,NULL project_id,NULL estimate_id,NULL estimate_ref,NULL project_name FROM canonical_drive_folders f WHERE f.entity_kind='client' AND f.entity_id=? ORDER BY created_at`, input.clientId, input.clientId);

    const base = (row) => ({ provider: row.provider_file_id ? "google_drive" : managedProvider, providerAccountId: row.provider_file_id ? account?.account_id ?? null : "quotesuite", providerFileId: row.provider_file_id ?? null, providerFolderId: row.provider_folder_id ?? null, clientId: row.client_id, projectId: row.project_id || null, estimateId: row.estimate_id, orderId: null, estimateRef: row.estimate_ref, projectName: row.project_name || row.estimate_ref });
    const supplierDocuments = supplierRows.map((row) => ({ ...base(row), id: `supplier_attachment:${row.id}`, supplierId: row.supplier_code || row.supplier_quote_id, supplierName: row.supplier_name, documentType: row.document_kind || "supplier_quotation", revision: row.supplier_revision || `Revision ${row.revision_sequence}`, reference: row.supplier_quotation_number, fileName: row.original_file_name, mediaType: row.media_type, sizeBytes: row.size_bytes, sha256: row.sha256, folder: `Estimates/${row.supplier_name}`, status: row.provider_file_id ? "filed" : "managed", createdAt: row.created_at, modifiedAt: row.provider_linked_at || row.created_at, downloadUrl: `/api/estimates/${encodeURIComponent(row.estimate_id)}/supplier-quotes/${encodeURIComponent(row.supplier_quote_id)}/revisions/${encodeURIComponent(row.revision_id)}/attachments/${encodeURIComponent(row.id)}/download` }));
    const quotationDocuments = quotationRows.map((row) => ({ ...base(row), id: `customer_quotation:${row.id}`, supplierId: null, supplierName: null, documentType: "customer_quotation", revision: `Quotation revision ${row.quotation_revision}`, reference: row.estimate_ref, fileName: row.file_name, mediaType: row.media_type, sizeBytes: row.size_bytes, sha256: row.sha256, folder: "Customer Quotations", status: row.quotation_status || "document_ready", createdAt: row.created_at, modifiedAt: row.issued_at || row.provider_linked_at || row.created_at, downloadUrl: row.issued_quotation_id ? `/api/quotation-workflow/issued/${encodeURIComponent(row.issued_quotation_id)}/document` : null, openUrl: null }));
    const discoveredDocuments = discoveredRows.map((row) => ({ ...base(row), id: `provider_file:${row.provider}:${row.provider_account_id}:${row.provider_file_id}`, provider: row.provider, providerAccountId: row.provider_account_id, supplierId: row.supplier_id, supplierName: row.supplier_name, documentType: row.document_type, revision: row.provider_revision ? `Provider version ${row.provider_revision}` : "Drive current", reference: row.estimate_ref, fileName: row.file_name, mediaType: row.mime_type, sizeBytes: row.size_bytes, sha256: row.md5_checksum, folder: row.folder_path, status: row.trashed ? "trashed" : row.removed_at ? "removed_from_provider" : "discovered", createdAt: row.provider_created_at || row.discovered_at, modifiedAt: row.provider_modified_at || row.updated_at, providerVersion: row.provider_version, removedAt: row.removed_at, downloadUrl: null, openUrl: row.web_view_link }));
    const canonicalDocuments = canonicalRows.map((row) => ({ id: `canonical_provider_file:${row.provider}:${row.provider_account_id}:${row.provider_file_id}`, provider: row.provider, providerAccountId: row.provider_account_id, providerFileId: row.provider_file_id, providerFolderId: row.provider_folder_id, enquiryId: row.enquiry_id, clientId: row.client_id, projectId: row.project_id, estimateId: row.estimate_id, orderId: row.order_id, supplierId: row.supplier_id, supplierQuotationId: row.supplier_quotation_id, supplierName: null, documentType: row.document_type, revision: row.provider_revision ? `Provider revision ${row.provider_revision}` : "Drive current", reference: row.estimate_ref || "", fileName: row.file_name, mediaType: row.mime_type, sizeBytes: row.size_bytes, sha256: row.checksum, estimateRef: row.estimate_ref || "", projectName: row.project_name || "", folder: row.folder_path, status: row.trashed ? "trashed" : row.removed_at ? "removed_from_provider" : "discovered", createdAt: row.provider_created_at || row.discovered_at, modifiedAt: row.provider_modified_at || row.updated_at, providerVersion: row.provider_version, removedAt: row.removed_at, downloadUrl: null, openUrl: row.web_view_link }));
    const failedSync = syncRows.find((row) => row.status === "failed"), syncing = syncRows.some((row) => row.status === "syncing");
    const lastSuccessAt = syncRows.map((row) => row.last_success_at).filter(Boolean).sort().at(-1) || canonicalRows.map((row) => row.last_seen_at).filter(Boolean).sort().at(-1) || null;
    return {
      scope: responseScope(input),
      documents: [...supplierDocuments, ...quotationDocuments, ...discoveredDocuments, ...canonicalDocuments].sort((a, b) => String(b.modifiedAt).localeCompare(String(a.modifiedAt))),
      folders: [...legacyFolderRows, ...canonicalFolderRows].map((row) => ({ id: row.id, provider: row.provider, providerAccountId: row.provider_account_id ?? account?.account_id ?? null, providerFolderId: row.provider_folder_id, parentLogicalKey: row.parent_logical_key, logicalKey: row.logical_key, name: row.name, clientId: row.client_id, projectId: row.project_id || null, estimateId: row.estimate_id || null, estimateRef: row.estimate_ref || "", projectName: row.project_name || row.estimate_ref || "", modifiedAt: row.updated_at, folderPath: row.folder_path || row.name, removedAt: row.removed_at || null })),
      sync: { state: syncing ? "syncing" : failedSync ? "failed" : lastSuccessAt ? "synced" : "idle", strategy: syncRows[0]?.strategy || "full_enumeration", lastAttemptAt: syncRows[0]?.last_attempt_at || null, lastSuccessAt, error: failedSync?.error_message || null, cached: true },
    };
  }
  return { list };
}
