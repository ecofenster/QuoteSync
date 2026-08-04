import SupplierImportLabWorkspace from "../supplierImportLab/SupplierImportLabWorkspace";

export default function AdminSupplierQuoteImportBeta() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <div className="admin-page-title">Feature Controls</div>
        <div className="admin-body-copy" style={{ maxWidth: 900 }}>
          Development-only feature entry points. These tools do not define the final commercial workflow.
        </div>
      </div>

      <SupplierImportLabWorkspace />
    </div>
  );
}
