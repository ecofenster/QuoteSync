import { decimalDivide, decimalMultiply } from "./supplierCommercialPricing.js";

const money = (value) => {
  const text = String(value ?? "0").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw Object.assign(new Error("Transport values must be non-negative amounts with no more than two decimal places."), { code: "invalid_options" });
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
};
const display = (cents) => `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;

export function calculateTransportCosting(input = {}) {
  const evidenceSupplier = money(input.originalSupplierTransport);
  const supplier = evidenceSupplier;
  const allocated = input.allocateToProducts ? money(input.allocationAmount) : 0n;
  if (allocated > supplier) throw Object.assign(new Error("Amount to Allocate cannot exceed the included Original Supplier Transport."), { code: "invalid_options" });
  const ratio = supplier === 0n ? "0" : decimalDivide(display(allocated), display(supplier), 12);
  const supplierPurchaseGbp = String(input.supplierPurchaseGbp ?? "0");
  const allocatedPurchaseGbp = decimalMultiply(supplierPurchaseGbp, ratio, 2);
  const allocatedCommercialGbp = allocatedPurchaseGbp;
  const remainingPurchaseGbp = display(money(supplierPurchaseGbp) - money(allocatedPurchaseGbp));
  const remainingCommercialGbp = remainingPurchaseGbp;
  const storage = input.storageCostsEnabled ? display(money(input.storageCosts)) : "0.00";
  const hiab = input.hiabDeliveryOffloadFeeEnabled ? display(money(input.hiabDeliveryOffloadFee)) : "0.00";
  const storageAllocated = input.storageCostsEnabled && input.storageAllocateToProducts ? money(input.storageAllocationAmount) : 0n;
  const hiabAllocated = input.hiabDeliveryOffloadFeeEnabled && input.hiabAllocateToProducts ? money(input.hiabAllocationAmount) : 0n;
  if (storageAllocated > money(storage)) throw Object.assign(new Error("Storage allocation cannot exceed Storage Costs."), { code: "invalid_options" });
  if (hiabAllocated > money(hiab)) throw Object.assign(new Error("HIAB allocation cannot exceed the HIAB Delivery / Offload Fee."), { code: "invalid_options" });
  const remainingStorage = money(storage) - storageAllocated;
  const remainingHiab = money(hiab) - hiabAllocated;
  const allocatedProjectCosts = storageAllocated + hiabAllocated;
  return {
    currency: String(input.currency || "GBP"),
    supplierTransportIncluded: true,
    originalSupplierTransport: display(evidenceSupplier),
    allocatedOriginalAmount: display(allocated),
    remainingOriginalTransport: display(supplier - allocated),
    allocatedPurchaseGbp,
    allocatedCommercialGbp,
    remainingSupplierPurchaseGbp: remainingPurchaseGbp,
    remainingSupplierCommercialGbp: remainingCommercialGbp,
    storageCosts: storage,
    allocatedStorageCosts: display(storageAllocated),
    remainingStorageCosts: display(remainingStorage),
    hiabDeliveryOffloadFee: hiab,
    allocatedHiabDeliveryOffloadFee: display(hiabAllocated),
    remainingHiabDeliveryOffloadFee: display(remainingHiab),
    allocatedProductPurchaseGbp: display(money(allocatedPurchaseGbp) + allocatedProjectCosts),
    allocatedProductCommercialGbp: display(money(allocatedPurchaseGbp) + allocatedProjectCosts),
    transportPurchaseGbp: display(money(remainingPurchaseGbp) + remainingStorage + remainingHiab),
    transportCommercialGbp: display(money(remainingPurchaseGbp) + remainingStorage + remainingHiab),
  };
}

export function allocateTransportCost(total, products, basis = "equal_per_position") {
  const included = (products ?? []).filter((item) => item.includedInCurrentEstimate !== false && item.classification !== "alternative" && item.classification !== "excluded");
  const cents = money(total);
  if (!included.length || cents === 0n) return [];
  const weights = included.map((item) => basis === "quantity" ? BigInt(Math.max(1, Number(item.quantity) || 1)) : basis === "purchase_value" ? money(item.gbpAmount) : 1n);
  const denominator = weights.reduce((sum, value) => sum + value, 0n);
  if (denominator === 0n) return allocateTransportCost(total, included, "equal_per_position");
  let assigned = 0n;
  return included.map((item, index) => { const amount = index === included.length - 1 ? cents - assigned : cents * weights[index] / denominator; assigned += amount; return { productRowId: item.id, displayReference: item.displayReference, amount: display(amount) }; });
}
