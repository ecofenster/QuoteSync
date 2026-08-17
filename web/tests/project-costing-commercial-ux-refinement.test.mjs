import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calculateTransportCosting, allocateTransportCost } from "../server/features/projectCalculatorLab/transportCosting.js";
import { calculateSiteVisitCosting } from "../server/features/projectCalculatorLab/siteVisitCosting.js";

const markedUp = (amount, percentage) => (BigInt(Math.round(Number(amount) * 100)) * BigInt(100 + percentage) + 50n) / 100n;

test("transport is split once between Products and Transport", () => {
  const result = calculateTransportCosting({ originalSupplierTransport: "2200", currency: "EUR", supplierPurchaseGbp: "1880.78", supplierCommercialGbp: "1900", supplierTransportIncluded: false, storageCostsEnabled: true, storageCosts: "100", hiabDeliveryOffloadFeeEnabled: true, hiabDeliveryOffloadFee: "250", allocateToProducts: true, allocationAmount: "500" });
  assert.equal(result.currency, "EUR");
  assert.equal(result.originalSupplierTransport, "2200.00");
  assert.equal(result.allocatedOriginalAmount, "500.00");
  assert.equal(result.remainingOriginalTransport, "1700.00");
  assert.equal(Number(result.allocatedPurchaseGbp) + Number(result.remainingSupplierPurchaseGbp), 1880.78);
  assert.equal(Number(result.transportPurchaseGbp), Number(result.remainingSupplierPurchaseGbp) + 350);
  assert.equal(result.supplierTransportIncluded, true, "immutable supplier Transport is always included");
  const notAllocated = calculateTransportCosting({ originalSupplierTransport: "2200", supplierPurchaseGbp: "1880.78", allocateToProducts: false, allocationAmount: "500" });
  assert.equal(notAllocated.allocatedOriginalAmount, "0.00");
  assert.equal(notAllocated.remainingSupplierPurchaseGbp, "1880.78");
  const fullyAllocated = calculateTransportCosting({ originalSupplierTransport: "2200", supplierPurchaseGbp: "1880.78", allocateToProducts: true, allocationAmount: "2200" });
  assert.equal(fullyAllocated.remainingSupplierPurchaseGbp, "0.00");
  const optionalCostsOff = calculateTransportCosting({ originalSupplierTransport: "2200", supplierPurchaseGbp: "1880.78", storageCosts: "100", hiabDeliveryOffloadFee: "250" });
  assert.equal(optionalCostsOff.transportPurchaseGbp, "1880.78");
  const projectCostsAllocated = calculateTransportCosting({ originalSupplierTransport: "2200", supplierPurchaseGbp: "1880.78", allocateToProducts: true, allocationAmount: "500", storageCostsEnabled: true, storageCosts: "500", storageAllocateToProducts: true, storageAllocationAmount: "200", hiabDeliveryOffloadFeeEnabled: true, hiabDeliveryOffloadFee: "1000", hiabAllocateToProducts: true, hiabAllocationAmount: "400" });
  assert.equal(projectCostsAllocated.remainingStorageCosts, "300.00");
  assert.equal(projectCostsAllocated.remainingHiabDeliveryOffloadFee, "600.00");
  assert.equal(projectCostsAllocated.allocatedProductPurchaseGbp, "1027.45");
  assert.equal(projectCostsAllocated.transportPurchaseGbp, "2353.33");
  assert.throws(() => calculateTransportCosting({ storageCostsEnabled: true, storageCosts: "100", storageAllocateToProducts: true, storageAllocationAmount: "100.01" }), /Storage allocation/);
  assert.throws(() => calculateTransportCosting({ hiabDeliveryOffloadFeeEnabled: true, hiabDeliveryOffloadFee: "100", hiabAllocateToProducts: true, hiabAllocationAmount: "100.01" }), /HIAB allocation/);
  assert.throws(() => calculateTransportCosting({ originalSupplierTransport: "10", allocateToProducts: true, allocationAmount: "10.01" }), /cannot exceed/);
});

test("transport allocation excludes commercially excluded positions", () => {
  const result = allocateTransportCost("30", [{ id: "a", displayReference: "A", quantity: 1, gbpAmount: "10", includedInCurrentEstimate: true }, { id: "alt", displayReference: "ALT", classification: "alternative", quantity: 1, gbpAmount: "10", includedInCurrentEstimate: true }, { id: "extra", displayReference: "EXTRA", classification: "extra", quantity: 10, gbpAmount: "10", includedInCurrentEstimate: false }, { id: "b", displayReference: "B", quantity: 2, gbpAmount: "20", includedInCurrentEstimate: true }], "quantity");
  assert.deepEqual(result.map((item) => [item.displayReference, item.amount]), [["A", "10.00"], ["B", "20.00"]]);
});

test("supplier Transport selling uses remaining purchase-FX GBP before markup", () => {
  const partial = calculateTransportCosting({ originalSupplierTransport: "2200", currency: "EUR", supplierPurchaseGbp: "1880.78", supplierCommercialGbp: "1914.00", allocateToProducts: true, allocationAmount: "500" });
  assert.equal(partial.remainingOriginalTransport, "1700.00");
  assert.equal(partial.remainingSupplierPurchaseGbp, "1453.33");
  assert.equal(partial.remainingSupplierCommercialGbp, "1453.33", "selling FX must not replace purchase FX for Transport markup");
  assert.equal(markedUp(partial.remainingSupplierPurchaseGbp, 0), 145333n);
  assert.equal(markedUp(partial.remainingSupplierPurchaseGbp, 10), 159866n);
  assert.equal(markedUp(partial.remainingSupplierPurchaseGbp, 15), 167133n);
  const none = calculateTransportCosting({ originalSupplierTransport: "2200", supplierPurchaseGbp: "1880.78", allocateToProducts: false, allocationAmount: "500" });
  assert.equal(none.remainingSupplierPurchaseGbp, "1880.78");
  const full = calculateTransportCosting({ originalSupplierTransport: "2200", supplierPurchaseGbp: "1880.78", allocateToProducts: true, allocationAmount: "2200" });
  assert.equal(full.remainingSupplierPurchaseGbp, "0.00");
});

test("route totals distinguish driving time from person-hours", () => {
  const result = calculateSiteVisitCosting({ calculatedOneWayMiles: "120", calculatedDurationMinutes: 300, returnJourney: true, visits: 2, people: 3, mileageRate: "0.55", travelLabourRate: "10" });
  assert.equal(result.chargeableMiles, "480.00");
  assert.equal(result.oneWayDrivingHours, "5");
  assert.equal(result.totalDrivingHours, "20.00");
  assert.equal(result.travelHours, "60.00");
  assert.equal(result.mileageCost, "264.00");
  assert.equal(result.travelLabour, "600.00");
});

test("Products retains Alternative, Extras owns Include, and Selling Price hosts Fix Price", async () => {
  const source = await readFile(new URL("../src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx", import.meta.url), "utf8");
  assert.match(source, /<th>Reference<\/th><th>Alternative\?<\/th>/);
  assert.doesNotMatch(source, /<th>Reference<\/th><th>Include<\/th>/);
  assert.match(source, /costing-sheet__extras-head[^]*Description[^]*Include[^]*Supplier Cost/);
  assert.doesNotMatch(source, /\?Yes/);
  assert.match(source, /createPortal\([^]*Fix Price/);
  assert.match(source, /costing-sheet__summary-sale/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /Apply Fixed Price/);
  assert.match(source, /Original Supplier Transport/);
  assert.match(source, /Storage Costs/);
  assert.match(source, /HIAB Delivery \/ Offload Fee/);
  assert.doesNotMatch(source, /Include Original Supplier Transport/);
  assert.doesNotMatch(source, /Allocation basis/);
  assert.doesNotMatch(source, /End-client Transport Selling Price/);
  assert.match(source, /costing-sheet__transport-head[^]*Description[^]*Supplier \/ Cost[^]*Allocate to Products[^]*Markup[^]*Selling Price/);
  assert.doesNotMatch(source, /<strong>Transport Markup<\/strong>/);
  assert.match(source, /Storage Amount to Allocate GBP/);
  assert.match(source, /HIAB Amount to Allocate GBP/);
  assert.doesNotMatch(source, /Customer transport charge/);
});
