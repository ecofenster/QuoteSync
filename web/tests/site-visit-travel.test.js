import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateSiteVisitCost, calculateSiteVisitCosting, normalizeSiteVisitCosting, normalizeSiteVisitDefaults } from '../server/features/projectCalculatorLab/siteVisitCosting.js';

test('company defaults retain the configurable 55p mileage baseline', () => {
  assert.deepEqual(normalizeSiteVisitDefaults(null), { officePostcode: '', mileageRate: '0.55', travelLabourRate: '0', defaultPeople: 1, mealPerPerson: '0', siteVisitMarkup: '0', allocation: 'separate', allocationBasis: 'equal_per_position' });
  assert.equal(normalizeSiteVisitDefaults({ mileageRate: '0.62' }).mileageRate, '0.62');
});

test('Site Visit markup is a dedicated neutral company default', () => {
  assert.equal(normalizeSiteVisitDefaults(null).siteVisitMarkup, '0');
  assert.equal(normalizeSiteVisitDefaults({ siteVisitMarkup: '12.5' }).siteVisitMarkup, '12.5');
});

test('return mileage, visits, people and direct travel costs calculate exactly', () => {
  const result = calculateSiteVisitCosting({
    ...normalizeSiteVisitCosting(null), reviewedOneWayMiles: '120', reviewedTravelHours: '6', visits: 2, people: 2,
    mileageRate: '0.55', travelLabourRate: '20', accommodationNights: 2, accommodationRooms: 2,
    accommodationRate: '100', mealPerPerson: '25', parking: '10', tolls: '5', ferries: '0',
    otherCosts: [{ description: 'Special access', amount: '15' }],
  });
  assert.equal(result.returnMilesPerVisit, '240.00');
  assert.equal(result.chargeableMiles, '480.00');
  assert.equal(result.mileageCost, '264.00');
  assert.equal(result.travelLabour, '960.00');
  assert.equal(result.accommodation, '400.00');
  assert.equal(result.meals, '100.00');
  assert.equal(result.total, '1754.00');
});

test('allocation occurs once and excludes alternative positions', () => {
  const products = [
    { id: 'a', displayReference: 'W1', quantity: 1, gbpAmount: '100.00', includedInCurrentEstimate: true },
    { id: 'alt', displayReference: 'W1ALT', quantity: 1, gbpAmount: '80.00', includedInCurrentEstimate: false },
    { id: 'b', displayReference: 'W2', quantity: 3, gbpAmount: '300.00', includedInCurrentEstimate: true },
  ];
  const equal = allocateSiteVisitCost('10.00', products, 'equal_per_position');
  assert.deepEqual(equal.map((item) => item.displayReference), ['W1', 'W2']);
  assert.deepEqual(equal.map((item) => item.amount), ['5.00', '5.00']);
  assert.deepEqual(allocateSiteVisitCost('10.00', products, 'quantity').map((item) => item.amount), ['2.50', '7.50']);
  assert.deepEqual(allocateSiteVisitCost('10.00', products, 'purchase_value').map((item) => item.amount), ['2.50', '7.50']);
});

test('route and reviewed values remain separate snapshot evidence', () => {
  const value = normalizeSiteVisitCosting({ calculatedOneWayMiles: '101.25', reviewedOneWayMiles: '105', calculatedDurationMinutes: 130, reviewedTravelHours: '2.5', routeSnapshotId: 'route-1', routeProvenance: 'google_distance_matrix', calculatedAt: '2026-08-12T10:00:00.000Z' });
  assert.equal(value.calculatedOneWayMiles, '101.25');
  assert.equal(value.reviewedOneWayMiles, '105');
  assert.equal(value.routeSnapshotId, 'route-1');
  assert.equal(calculateSiteVisitCosting(value).oneWayMiles, '105');
});
