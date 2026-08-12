import assert from "node:assert/strict";
import test from "node:test";
import { parseCommercialSummary } from "../server/features/supplierImportLab/commercialSummaryParser.js";

function document(lines: string[]) {
  return { attachmentId: "aviary", pages: [{ pageNumber: 1, blocks: lines.map((text, readingOrder) => ({ id: `b${readingOrder}`, text, pageNumber: 1, boundingBox: null, readingOrder })) }] } as any;
}

test("alternative scenario totals are evidence and never Extras", () => {
  const parsed = parseCommercialSummary(document(["Total quantity","1","m2","1.00","Total excl VAT","22315.45","Total excl VAT (with alternative ZF positions):","21843.98","Delivery","2500.00","RAL ALU touch up","30.00","Paint care set","41.32","Aluminium paint care set","41.32","Fixing bracket box 100 pcs","160.00","Total amount:","25088.09","Total amount (with alternative ZF positions):","24616.62","Extra cost for 180mm alu cills + end caps – 1054 eur"]), { currency: "EUR", positionRows: [{ totalPrice: "22315.45", includedInSupplierTotal: true }] });
  assert.deepEqual(parsed.summary.comparisonTotals.map((item: any) => [item.classification, item.amount]), [["alternative_supplier_subtotal","21843.98"],["alternative_final_total","24616.62"]]);
  assert.equal(parsed.additionalItems.some((item: any) => /^Total/.test(item.originalDescription)), false);
  const boxed = parsed.additionalItems.find((item: any) => item.totalPrice === "1054");
  assert.equal(boxed.includedInSupplierTotal, false); assert.match(boxed.inclusionEvidence, /does not state/i);
  assert.equal(parsed.summary.reconciliation.expectedFinal, "25088.09"); assert.equal(parsed.summary.reconciliation.reconciled, true);
});
