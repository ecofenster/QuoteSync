const pad3 = (value) => String(value).padStart(3, "0");

export function formatCanonicalReference(kind, value, year = null) {
  if (kind === "enquiry") return `EF-ENQ-${pad3(value)}`;
  if (kind === "client") return `EF-CL-${pad3(value)}`;
  if (kind === "estimate") return `EF-EST-${year}-${pad3(value)}`;
  if (kind === "order") return `EF-ORD-${year}-${pad3(value)}`;
  throw Object.assign(new Error("Unsupported canonical reference kind."), { status: 400, code: "reference_kind_invalid" });
}

const scopeFor = (kind, year) => kind === "estimate" || kind === "order" ? String(year || "") : "global";

export async function allocateCanonicalReference(db, { kind, year = null, entityId, reason = "canonical_allocation", reconciliationPlanId = null, now = new Date().toISOString() }) {
  const scope = scopeFor(kind, year);
  if ((kind === "estimate" || kind === "order") && !/^\d{4}$/.test(scope)) throw Object.assign(new Error("A four-digit year is required for this reference."), { status: 422, code: "reference_year_required" });
  if (!entityId) throw Object.assign(new Error("Reference allocation requires an entity identity."), { status: 422, code: "reference_entity_required" });
  await db.run(`INSERT INTO canonical_reference_sequences(reference_kind,scope_key,last_value,updated_at) VALUES(?,?,0,?) ON CONFLICT(reference_kind,scope_key) DO NOTHING`, kind, scope, now);
  for (let attempts = 0; attempts < 10000; attempts += 1) {
    const row = await db.get(`UPDATE canonical_reference_sequences SET last_value=last_value+1,updated_at=? WHERE reference_kind=? AND scope_key=? RETURNING last_value`, now, kind, scope);
    const reference = formatCanonicalReference(kind, row.last_value, year);
    const existing = await db.get("SELECT reference FROM canonical_reference_registry WHERE reference=?", reference);
    if (existing) continue;
    await db.run("INSERT INTO canonical_reference_registry(reference,reference_kind,entity_id,allocated_at,allocation_reason,reconciliation_plan_id) VALUES(?,?,?,?,?,?)", reference, kind, entityId, now, reason, reconciliationPlanId);
    return reference;
  }
  throw Object.assign(new Error("Canonical reference allocation exhausted its collision guard."), { status: 409, code: "reference_allocation_exhausted" });
}

export async function advanceReferenceHighWater(db, { kind, year = null, minimum, now = new Date().toISOString() }) {
  const scope = scopeFor(kind, year), value = Math.max(0, Number(minimum) || 0);
  await db.run(`INSERT INTO canonical_reference_sequences(reference_kind,scope_key,last_value,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(reference_kind,scope_key) DO UPDATE SET last_value=MAX(canonical_reference_sequences.last_value,excluded.last_value),updated_at=excluded.updated_at`, kind, scope, value, now);
}
