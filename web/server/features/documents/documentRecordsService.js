const managedProvider = "quotesuite_managed";

function scopeWhere({ clientId, estimateId }, alias = "e") {
  if (estimateId) return { sql: `${alias}.id=?`, value: estimateId };
  if (clientId) return { sql: `${alias}.client_id=?`, value: clientId };
  throw Object.assign(new Error("client_id or estimate_id is required."), { status: 400, code: "document_scope_required" });
}

export function createDocumentRecordsService(db) {
  async function list(input = {}) {
    const scope = scopeWhere(input);
    const account = await db.get("SELECT account_id FROM integration_oauth_connections WHERE provider='google_workspace' AND status='connected'");
    const supplierRows = await db.all(`
      SELECT a.id,a.original_file_name,a.media_type,a.size_bytes,a.sha256,a.created_at,a.document_kind,
        r.id revision_id,r.revision_sequence,r.supplier_quotation_number,r.supplier_revision,
        q.id supplier_quote_id,q.supplier_code,q.supplier_name,
        e.id estimate_id,e.client_id,e.estimate_ref,c.project_name,
        l.provider_file_id,l.provider_folder_id,l.created_at provider_linked_at
      FROM supplier_quote_attachments a
      JOIN supplier_quote_revisions r ON r.id=a.revision_id AND r.estimate_id=a.estimate_id
      JOIN supplier_quotes q ON q.id=r.supplier_quote_id AND q.estimate_id=r.estimate_id
      JOIN estimates e ON e.id=a.estimate_id
      JOIN clients c ON c.id=e.client_id
      LEFT JOIN drive_document_links l ON l.provider='google_drive' AND l.source_attachment_id=a.id
      WHERE ${scope.sql} AND e.deleted_at IS NULL AND c.deleted_at IS NULL
      ORDER BY a.created_at DESC`, scope.value);
    const quotationRows = await db.all(`
      SELECT d.id,d.quotation_revision,d.file_name,d.media_type,d.size_bytes,d.sha256,d.created_at,
        e.id estimate_id,e.client_id,e.estimate_ref,c.project_name,
        iq.id issued_quotation_id,iq.status quotation_status,iq.issued_at,
        l.provider_file_id,l.provider_folder_id,l.created_at provider_linked_at
      FROM customer_quotation_documents d
      JOIN estimates e ON e.id=d.estimate_id
      JOIN clients c ON c.id=e.client_id
      LEFT JOIN issued_quotations iq ON iq.id=(SELECT candidate.id FROM issued_quotations candidate WHERE candidate.document_id=d.id ORDER BY candidate.created_at DESC LIMIT 1)
      LEFT JOIN drive_document_links l ON l.provider='google_drive' AND l.quotation_document_id=d.id
      WHERE ${scope.sql} AND e.deleted_at IS NULL AND c.deleted_at IS NULL
      ORDER BY d.created_at DESC`, scope.value);
    const folderRows = await db.all(`
      SELECT f.*,e.client_id,e.estimate_ref,c.project_name
      FROM drive_project_folders f
      JOIN estimates e ON e.id=f.estimate_id
      JOIN clients c ON c.id=e.client_id
      WHERE ${scope.sql} AND e.deleted_at IS NULL AND c.deleted_at IS NULL
      ORDER BY e.created_at DESC,f.created_at`, scope.value);

    const supplierDocuments = supplierRows.map((row) => ({
      id: `supplier_attachment:${row.id}`,
      provider: row.provider_file_id ? "google_drive" : managedProvider,
      providerAccountId: row.provider_file_id ? account?.account_id ?? null : "quotesuite",
      providerFileId: row.provider_file_id ?? null,
      providerFolderId: row.provider_folder_id ?? null,
      clientId: row.client_id,
      projectId: row.estimate_id,
      estimateId: row.estimate_id,
      orderId: null,
      supplierId: row.supplier_code || row.supplier_quote_id,
      supplierName: row.supplier_name,
      documentType: row.document_kind || "supplier_quotation",
      revision: row.supplier_revision || `Revision ${row.revision_sequence}`,
      reference: row.supplier_quotation_number,
      fileName: row.original_file_name,
      mediaType: row.media_type,
      sizeBytes: row.size_bytes,
      sha256: row.sha256,
      estimateRef: row.estimate_ref,
      projectName: row.project_name || row.estimate_ref,
      folder: `Estimates/${row.supplier_name}`,
      status: row.provider_file_id ? "filed" : "managed",
      createdAt: row.created_at,
      modifiedAt: row.provider_linked_at || row.created_at,
      downloadUrl: `/api/estimates/${encodeURIComponent(row.estimate_id)}/supplier-quotes/${encodeURIComponent(row.supplier_quote_id)}/revisions/${encodeURIComponent(row.revision_id)}/attachments/${encodeURIComponent(row.id)}/download`,
    }));
    const quotationDocuments = quotationRows.map((row) => ({
      id: `customer_quotation:${row.id}`,
      provider: row.provider_file_id ? "google_drive" : managedProvider,
      providerAccountId: row.provider_file_id ? account?.account_id ?? null : "quotesuite",
      providerFileId: row.provider_file_id ?? null,
      providerFolderId: row.provider_folder_id ?? null,
      clientId: row.client_id,
      projectId: row.estimate_id,
      estimateId: row.estimate_id,
      orderId: null,
      supplierId: null,
      supplierName: null,
      documentType: "customer_quotation",
      revision: `Quotation revision ${row.quotation_revision}`,
      reference: row.estimate_ref,
      fileName: row.file_name,
      mediaType: row.media_type,
      sizeBytes: row.size_bytes,
      sha256: row.sha256,
      estimateRef: row.estimate_ref,
      projectName: row.project_name || row.estimate_ref,
      folder: "Customer Quotations",
      status: row.quotation_status || "document_ready",
      createdAt: row.created_at,
      modifiedAt: row.issued_at || row.provider_linked_at || row.created_at,
      downloadUrl: row.issued_quotation_id ? `/api/quotation-workflow/issued/${encodeURIComponent(row.issued_quotation_id)}/document` : null,
    }));
    return {
      scope: input.estimateId ? { estimateId: input.estimateId } : { clientId: input.clientId },
      documents: [...supplierDocuments, ...quotationDocuments].sort((a, b) => String(b.modifiedAt).localeCompare(String(a.modifiedAt))),
      folders: folderRows.map((row) => ({
        id: row.id,
        provider: row.provider,
        providerAccountId: account?.account_id ?? null,
        providerFolderId: row.provider_folder_id,
        parentLogicalKey: row.parent_logical_key,
        logicalKey: row.logical_key,
        name: row.name,
        clientId: row.client_id,
        projectId: row.estimate_id,
        estimateId: row.estimate_id,
        estimateRef: row.estimate_ref,
        projectName: row.project_name || row.estimate_ref,
        modifiedAt: row.updated_at,
      })),
    };
  }
  return { list };
}
