const DEFAULTS = Object.freeze({
  officePostcode: '',
  mileageRate: '0.55',
  travelLabourRate: '0',
  defaultPeople: 1,
  mealPerPerson: '0',
  siteVisitMarkup: '10',
  allocation: 'separate',
  allocationBasis: 'equal_per_position',
});

const decimal = (value) => {
  const text = String(value ?? '0').trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) throw Object.assign(new Error('Site Visit values must be valid non-negative numbers.'), { code: 'invalid_options' });
  const negative = text.startsWith('-');
  if (negative) throw Object.assign(new Error('Site Visit values cannot be negative.'), { code: 'invalid_options' });
  const [whole, fraction = ''] = text.split('.');
  return { value: BigInt(whole + fraction), scale: fraction.length };
};

const multiply = (...values) => {
  const parsed = values.map(decimal);
  const raw = parsed.reduce((total, item) => total * item.value, 1n);
  const scale = parsed.reduce((total, item) => total + item.scale, 0);
  const denominator = 10n ** BigInt(scale);
  const cents = (raw * 100n + denominator / 2n) / denominator;
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
};

const add = (values) => {
  const cents = values.reduce((total, value) => {
    const parsed = decimal(value);
    const denominator = 10n ** BigInt(parsed.scale);
    return total + (parsed.value * 100n + denominator / 2n) / denominator;
  }, 0n);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
};

export function normalizeSiteVisitDefaults(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    officePostcode: String(source.officePostcode ?? DEFAULTS.officePostcode).trim(),
    mileageRate: String(source.mileageRate ?? DEFAULTS.mileageRate),
    travelLabourRate: String(source.travelLabourRate ?? DEFAULTS.travelLabourRate),
    defaultPeople: Math.max(1, Number.parseInt(source.defaultPeople ?? DEFAULTS.defaultPeople, 10) || 1),
    mealPerPerson: String(source.mealPerPerson ?? DEFAULTS.mealPerPerson),
    siteVisitMarkup: String(source.siteVisitMarkup ?? DEFAULTS.siteVisitMarkup),
    allocation: ['separate', 'products'].includes(source.allocation) ? source.allocation : DEFAULTS.allocation,
    allocationBasis: ['equal_per_position', 'quantity', 'purchase_value'].includes(source.allocationBasis) ? source.allocationBasis : DEFAULTS.allocationBasis,
  };
}

export function normalizeSiteVisitCosting(value, defaults = DEFAULTS) {
  const source = value && typeof value === 'object' ? value : {};
  const normalizedDefaults = normalizeSiteVisitDefaults(defaults);
  return {
    officePostcode: String(source.officePostcode ?? normalizedDefaults.officePostcode).trim(),
    sitePostcode: String(source.sitePostcode ?? '').trim(),
    sitePostcodeSource: source.sitePostcodeSource == null ? null : String(source.sitePostcodeSource),
    calculatedOneWayMiles: source.calculatedOneWayMiles == null ? null : String(source.calculatedOneWayMiles),
    reviewedOneWayMiles: source.reviewedOneWayMiles == null ? null : String(source.reviewedOneWayMiles),
    calculatedDurationMinutes: source.calculatedDurationMinutes == null ? null : Number(source.calculatedDurationMinutes),
    reviewedTravelHours: source.reviewedTravelHours == null ? null : String(source.reviewedTravelHours),
    returnJourney: source.returnJourney !== false,
    visits: Math.max(1, Number.parseInt(source.visits ?? 1, 10) || 1),
    people: Math.max(1, Number.parseInt(source.people ?? normalizedDefaults.defaultPeople, 10) || 1),
    mileageRate: String(source.mileageRate ?? normalizedDefaults.mileageRate),
    travelLabourRate: String(source.travelLabourRate ?? normalizedDefaults.travelLabourRate),
    accommodationNights: Math.max(0, Number.parseInt(source.accommodationNights ?? 0, 10) || 0),
    accommodationRooms: Math.max(0, Number.parseInt(source.accommodationRooms ?? 0, 10) || 0),
    accommodationRate: String(source.accommodationRate ?? '0'),
    accommodationFixed: source.accommodationFixed == null ? null : String(source.accommodationFixed),
    mealsMode: source.mealsMode === 'fixed' ? 'fixed' : 'per_person',
    mealPerPerson: String(source.mealPerPerson ?? normalizedDefaults.mealPerPerson),
    mealsFixed: String(source.mealsFixed ?? '0'),
    parking: String(source.parking ?? '0'),
    tolls: String(source.tolls ?? '0'),
    ferries: String(source.ferries ?? '0'),
    otherCosts: Array.isArray(source.otherCosts) ? source.otherCosts.map((item) => ({ description: String(item?.description ?? '').trim(), amount: String(item?.amount ?? '0') })).filter((item) => item.description) : [],
    allocation: ['separate', 'products'].includes(source.allocation) ? source.allocation : normalizedDefaults.allocation,
    allocationBasis: ['equal_per_position', 'quantity', 'purchase_value'].includes(source.allocationBasis) ? source.allocationBasis : normalizedDefaults.allocationBasis,
    routeSnapshotId: source.routeSnapshotId == null ? null : String(source.routeSnapshotId),
    calculatedAt: source.calculatedAt == null ? null : String(source.calculatedAt),
    routeProvenance: source.routeProvenance == null ? null : String(source.routeProvenance),
    capturedDefaultsAt: source.capturedDefaultsAt == null ? null : String(source.capturedDefaultsAt),
  };
}

export function calculateSiteVisitCosting(value) {
  const input = normalizeSiteVisitCosting(value);
  const oneWayMiles = input.reviewedOneWayMiles ?? input.calculatedOneWayMiles ?? '0';
  const journeyFactor = input.returnJourney ? 2 : 1;
  const chargeableMiles = multiply(oneWayMiles, journeyFactor, input.visits);
  const mileageCost = multiply(chargeableMiles, input.mileageRate);
  const routeHours = input.reviewedTravelHours ?? String((input.calculatedDurationMinutes ?? 0) / 60);
  const totalDrivingHours = multiply(routeHours, journeyFactor, input.visits);
  const travelHours = multiply(totalDrivingHours, input.people);
  const travelLabour = multiply(travelHours, input.travelLabourRate);
  const accommodation = input.accommodationFixed ?? multiply(input.accommodationNights, input.accommodationRooms, input.accommodationRate);
  // Each visit contributes its day away; every overnight adds the following
  // day. One same-day visit therefore remains one allowance day.
  const daysAway = input.visits + input.accommodationNights;
  const mealAllowanceUnits = input.people * daysAway;
  const meals = input.mealsMode === 'fixed' ? input.mealsFixed : multiply(input.mealPerPerson, mealAllowanceUnits);
  const other = add(input.otherCosts.map((item) => item.amount));
  const total = add([mileageCost, travelLabour, accommodation, meals, input.parking, input.tolls, input.ferries, other]);
  return { input, oneWayMiles, returnMilesPerVisit: multiply(oneWayMiles, journeyFactor), chargeableMiles, oneWayDrivingHours: routeHours, totalDrivingHours, travelHours, daysAway, mealAllowanceUnits, mileageCost, travelLabour, accommodation, meals, parking: input.parking, tolls: input.tolls, ferries: input.ferries, other, total };
}

export function allocateSiteVisitCost(total, products, basis = 'equal_per_position') {
  const included = (Array.isArray(products) ? products : []).filter((item) => item.includedInCurrentEstimate !== false);
  if (!included.length || total === '0.00') return [];
  const totalCents = BigInt(String(total).replace('.', ''));
  const weights = included.map((item) => basis === 'quantity' ? BigInt(Math.max(1, Number(item.quantity) || 1)) : basis === 'purchase_value' ? BigInt(String(item.gbpAmount ?? '0').replace('.', '')) : 1n);
  const denominator = weights.reduce((sum, item) => sum + item, 0n);
  if (denominator === 0n) return allocateSiteVisitCost(total, included, 'equal_per_position');
  let assigned = 0n;
  return included.map((item, index) => {
    const amount = index === included.length - 1 ? totalCents - assigned : totalCents * weights[index] / denominator;
    assigned += amount;
    return { productRowId: item.id, displayReference: item.displayReference, amount: `${amount / 100n}.${String(amount % 100n).padStart(2, '0')}` };
  });
}
