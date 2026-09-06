const money = value => (Math.round((Number(value) + Number.EPSILON) * 100) / 100).toFixed(2);
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clampInt = (value, minimum = 0) => Math.max(minimum, Math.trunc(number(value, minimum)));

export const INSTALLATION_CAPABILITIES = Object.freeze([
  'standard_windows','entrance_doors','sliding_doors','lift_and_slide','bifolds','large_heavy_glazing',
  'retrofit','new_build','aluminium','timber','pvc_u','specialist_lifting','kit_assembly',
]);

export function classifyInstallationPosition(position, override = {}) {
  const source = `${position.productClass ?? ''} ${position.sourceSnapshot?.productType ?? ''} ${position.sourceSnapshot?.productSystem ?? ''} ${position.sourceSnapshot?.configurationDescription ?? ''}`.toLowerCase();
  const family = override.installationClass ?? (/lift[ -]?and[ -]?slide|lift[ -]?slide/.test(source) ? 'lift_and_slide' : /bi[ -]?fold/.test(source) ? 'bifold' : /sliding|gliding/.test(source) ? 'sliding_door' : 'standard');
  const reviewed = Boolean(override.installationClass) || family === 'standard';
  return { family, specialist: family !== 'standard', reviewed, source: override.installationClass ? 'estimate_override' : family === 'standard' ? 'canonical_product_class' : 'product_evidence' };
}

const explicitCillRequirement = position => {
  const source = position.sourceSnapshot ?? {};
  const canonical = source.canonicalPosition ?? {};
  const overrides = canonical.overrides ?? source.overrides ?? {};
  for (const value of [canonical.cillRequired, source.cillRequired, source.requiresCill, overrides.externalSillRequired]) {
    if (typeof value === 'boolean') return value;
  }
  const sillMode = source.configurationState?.externalWindowSill?.mode;
  if (sillMode === 'none') return false;
  if (sillMode === 'default' || sillMode === 'custom') return true;
  return null;
};

export function calculateApplicableCillQuantity(positions = []) {
  return positions
    .filter(position => position.includedInCurrentEstimate !== false && position.classification !== 'alternative')
    .reduce((total, position) => {
      const explicit = explicitCillRequirement(position);
      if (explicit === false) return total;
      const source = position.sourceSnapshot ?? {};
      const evidence = source.manufacturerEvidence ?? {};
      const identity = `${position.productClass ?? ''} ${source.canonicalPosition?.positionType ?? ''} ${source.configuredContract?.estimateContext?.positionType ?? ''} ${evidence.productType ?? ''} ${evidence.product ?? ''} ${evidence.productSystem ?? ''} ${evidence.configurationDescription ?? ''}`.toLowerCase();
      const doorOnly = /\b(?:entrance|single|patio|sliding|gliding|lift[ -]?(?:and[ -]?)?slide|bi[ -]?fold)\b.*\bdoor\b|\b(?:door|bifold)\b|lift[ -]?(?:and[ -]?)?slide|sliding|gliding/.test(identity);
      const window = /\bwindow\b|fixed glazing|tilt[ -]?(?:and[ -]?)?turn/.test(identity);
      if (doorOnly || (explicit !== true && !window)) return total;
      return total + clampInt(position.quantity, 0);
    }, 0);
}

function taskList(positions, profile, rules, crewSize) {
  const overrides = profile.positionRequirements ?? {};
  const capacity = number(rules.standardUnitsPerDayByCrew?.[String(crewSize)], crewSize >= 4 ? rules.standardUnitsPerDayByCrew?.['4'] : rules.standardUnitsPerDayByCrew?.['2']);
  const tasks = [], reviewRequired = [];
  let standardUnits = 0;
  for (const position of positions.filter(item => item.includedInCurrentEstimate !== false && item.classification !== 'alternative')) {
    const override = overrides[position.estimatePositionId ?? position.id] ?? overrides[position.id] ?? {};
    const classification = classifyInstallationPosition(position, override);
    const quantity = clampInt(position.quantity, 1);
    if (!classification.specialist) {
      standardUnits += quantity;
      const duration = capacity > 0 ? (crewSize * number(rules.productiveHoursPerDay, 8) / capacity) / 2 : null;
      if (!duration) reviewRequired.push(`${position.displayReference}: standard productivity is not configured for a ${crewSize}-person crew.`);
      else for (let index = 0; index < quantity; index += 1) tasks.push({ positionId: position.estimatePositionId ?? position.id, reference: position.displayReference, family: 'standard', durationHours: duration, minimumCrew: 2, source: 'administration_productivity_rule' });
      continue;
    }
    const kitFormat = override.kitFormat === true;
    let durationHours = null;
    if (kitFormat) durationHours = number(override.durationHours, 0) || null;
    else durationHours = number(position.widthMm) < number(rules.specialistWidthThresholdMm, 2500) ? number(rules.specialistUnderThresholdHours, 3) : number(rules.specialistAtOrAboveThresholdHours, 4);
    const minimumCrew = kitFormat ? clampInt(override.minimumConcurrentCrew, 3) : number(position.widthMm) < number(rules.specialistWidthThresholdMm, 2500) ? clampInt(rules.specialistUnderThresholdCrew, 3) : clampInt(rules.specialistAtOrAboveThresholdCrew, 4);
    if (kitFormat && !durationHours) reviewRequired.push(`${position.displayReference}: kit-format duration must be selected.`);
    if (minimumCrew > crewSize) reviewRequired.push(`${position.displayReference}: requires at least ${minimumCrew} concurrent installers.`);
    if (durationHours) for (let index = 0; index < quantity; index += 1) {
      let remaining = durationHours;
      while (remaining > 0) { const slice = Math.min(number(rules.productiveHoursPerDay, 8), remaining); tasks.push({ positionId: position.estimatePositionId ?? position.id, reference: position.displayReference, family: classification.family, durationHours: slice, minimumCrew, kitFormat, source: kitFormat ? 'estimate_position_duration' : 'administration_specialist_rule' }); remaining -= slice; }
    }
  }
  return { tasks, reviewRequired, standardUnits, capacity };
}

function scheduleTasks(tasks, crewSize, firstDayHours, hoursPerDay) {
  const days = [];
  const addDay = capacityHours => { const day = { capacityHours, usedCrewHours: 0, tasks: [] }; days.push(day); return day; };
  addDay(firstDayHours);
  for (const task of [...tasks].sort((left, right) => right.minimumCrew - left.minimumCrew || right.durationHours - left.durationHours)) {
    const requiredCrewHours = task.durationHours * task.minimumCrew;
    let placed = false;
    for (let dayIndex = 0; !placed; dayIndex += 1) {
      const day = days[dayIndex] ?? addDay(hoursPerDay);
      if (task.minimumCrew <= crewSize && task.durationHours <= day.capacityHours && day.usedCrewHours + requiredCrewHours <= day.capacityHours * crewSize + 1e-9) {
        const startHour = day.usedCrewHours / crewSize;
        day.usedCrewHours += requiredCrewHours;
        day.tasks.push({ ...task, startHour: Number(startHour.toFixed(2)), endHour: Number(Math.min(day.capacityHours,startHour+task.durationHours).toFixed(2)) });
        placed = true;
      }
      if (dayIndex > 365) throw new Error('Installation programme exceeds the supported planning horizon.');
    }
  }
  return days.filter((day, index) => day.tasks.length || index === 0);
}

export function calculateInstallationProgramme({ positions = [], rules = {}, profile = {}, selectedTeam = null }) {
  const productiveHoursPerDay = number(rules.productiveHoursPerDay, 8);
  const crewSize = clampInt(profile.crewSize ?? selectedTeam?.normalCrewSize, 2);
  const routeMinutes = Math.max(0, number(profile.route?.oneWayDurationMinutes));
  const routeHours = routeMinutes / 60;
  const setOutHours = profile.mobilisationSetOutHours == null ? 0 : Math.max(0, number(profile.mobilisationSetOutHours));
  const firstDayHours = Math.max(0, productiveHoursPerDay - routeHours - setOutHours);
  const derived = taskList(positions, profile, rules, crewSize);
  const reviewRequired = [...derived.reviewRequired];
  if (profile.mobilisationSetOutHours == null) reviewRequired.push('Mobilisation/offload/set-out duration requires review. No duration has been deducted.');
  if (!profile.selectedTeamId) reviewRequired.push('Installation Team must be selected by the estimator.');
  const schedulableTasks = derived.tasks.filter(task => task.minimumCrew <= crewSize);
  const days = schedulableTasks.length ? scheduleTasks(schedulableTasks, crewSize, firstDayHours, productiveHoursPerDay) : [];
  const programmeDays = days.length;
  const travelMode = profile.travelMode === 'daily_travel' || profile.travelMode === 'stay_away' || profile.travelMode === 'manual' ? profile.travelMode : routeMinutes > number(rules.stayAwayThresholdMinutes, 90) ? 'stay_away' : 'daily_travel';
  const vehicleCount = clampInt(profile.vehicleCount, 1);
  const oneWayMiles = Math.max(0, number(profile.route?.oneWayMiles));
  const chargeableMiles = travelMode === 'daily_travel' ? oneWayMiles * 2 * programmeDays : oneWayMiles * 2;
  const mileageCost = chargeableMiles * vehicleCount * number(profile.mileageRate ?? rules.mileageRate, 0.55);
  const nights = travelMode === 'stay_away' ? Math.max(0, programmeDays - 1) : 0;
  const labourCost = programmeDays * crewSize * number(profile.installerDayRate ?? selectedTeam?.installerDayRate ?? rules.installerDayRate, 350);
  const foodCost = programmeDays * crewSize * number(profile.foodPerPersonDay ?? rules.foodPerPersonDay, 30);
  const accommodationCost = nights * crewSize * number(profile.accommodationPerPersonNight ?? rules.accommodationPerPersonNight, 125);
  const supportDays = Math.max(0, number(profile.supportDays));
  const supportCost = supportDays * number(profile.supportDayRate ?? rules.supportDayRate, 350);
  const surveyDays = Math.max(0, number(profile.surveyDays));
  const surveyCost = surveyDays * number(profile.surveyDayRate ?? rules.surveyDayRate, 400);
  const cillQuantity = calculateApplicableCillQuantity(positions);
  const cillInstallationRate = number(profile.cillInstallationRate ?? rules.cillInstallationRate, 25);
  const cillCost = cillQuantity * cillInstallationRate;
  const lifting=profile.liftingEquipment&&typeof profile.liftingEquipment==='object'?profile.liftingEquipment:{required:profile.liftingDecision==='required'};
  const liftingRequired=lifting.required===true;
  const liftingHire=liftingRequired?number(lifting.hireCost):0,liftingDelivery=liftingRequired?number(lifting.deliveryCost):0,liftingCollection=liftingRequired?number(lifting.collectionCost):0;
  const liftingCost=liftingHire+liftingDelivery+liftingCollection;
  const skip=profile.skipHire&&typeof profile.skipHire==='object'?profile.skipHire:{required:false},skipRequired=skip.required===true,skipQuantity=skipRequired?clampInt(skip.quantity,1):0;
  const skipUnitHire=skipRequired?number(skip.hireCost):0,skipDelivery=skipRequired?number(skip.deliveryCost):0,skipCollection=skipRequired?number(skip.collectionCost):0,skipCost=skipUnitHire*skipQuantity+skipDelivery+skipCollection;
  const savedInclusions = profile.componentInclusions && typeof profile.componentInclusions === 'object' ? profile.componentInclusions : {};
  const componentInclusions = {
    mileage: savedInclusions.mileage !== false,
    food: savedInclusions.food !== false,
    accommodation: savedInclusions.accommodation !== false,
    support: savedInclusions.support !== false,
    cillInstallation: savedInclusions.cillInstallation !== false,
  };
  const calculatedCosts = { labour: money(labourCost), mileage: money(mileageCost), food: money(foodCost), accommodation: money(accommodationCost), support: money(supportCost), survey: money(surveyCost), cillInstallation: money(cillCost), liftingEquipment: money(liftingCost), skipHire:money(skipCost) };
  const activeCosts = {
    labour: calculatedCosts.labour,
    mileage: componentInclusions.mileage ? calculatedCosts.mileage : '0.00',
    food: componentInclusions.food ? calculatedCosts.food : '0.00',
    accommodation: componentInclusions.accommodation ? calculatedCosts.accommodation : '0.00',
    support: componentInclusions.support ? calculatedCosts.support : '0.00',
    survey: calculatedCosts.survey,
    cillInstallation: componentInclusions.cillInstallation ? calculatedCosts.cillInstallation : '0.00',
    liftingEquipment: liftingRequired ? calculatedCosts.liftingEquipment : '0.00',
    skipHire: skipRequired ? calculatedCosts.skipHire : '0.00',
  };
  const purchaseCost = Object.values(activeCosts).reduce((total, value) => total + number(value), 0);
  const returnByMinutes = 17 * 60 + routeMinutes;
  if (returnByMinutes > number(rules.latestReturnHomeMinutes, 23 * 60)) reviewRequired.push('Final return is forecast after 23:00 and requires programme review.');
  if (profile.projectType === 'refurbishment' && !profile.skipDecision) reviewRequired.push('Skip Hire is recommended for retrofit and requires selection/pricing review.');
  if (liftingRequired && (!lifting.productId || !lifting.productName)) reviewRequired.push('Lifting equipment product selection is required.');
  if (liftingRequired && (lifting.hireCost == null || lifting.hireCost === '' || !Number.isFinite(Number(lifting.hireCost)))) reviewRequired.push('Lifting equipment hire cost is required.');
  if(skipRequired&&(!skip.productId||!skip.productName))reviewRequired.push('Skip Hire size selection is required.');
  const requiredCapabilities = [...new Set(derived.tasks.flatMap(task => task.family === 'standard' ? ['standard_windows'] : [task.family === 'sliding_door' ? 'sliding_doors' : task.family === 'bifold' ? 'bifolds' : task.family, ...(task.kitFormat ? ['kit_assembly'] : [])]))];
  return {
    status: reviewRequired.length ? 'review_required' : 'available', crewSize, productiveHoursPerDay, programmeDays,
    workingPattern: { days: ['monday','tuesday','wednesday','thursday','friday'], start: '08:00', finish: '17:00' },
    standardUnits: derived.standardUnits, standardUnitsPerDay: derived.capacity, recommendFourPersonTeam: derived.standardUnits > number(rules.fourPersonRecommendationThresholdUnits, 28),
    tasks: derived.tasks, days: days.map((day, index) => ({ day: index + 1, capacityHours: day.capacityHours, tasks: day.tasks })), requiredCapabilities,
    travel: { mode: travelMode, recommendation: routeMinutes > number(rules.stayAwayThresholdMinutes, 90) ? 'stay_away' : 'daily_travel', oneWayMiles: money(oneWayMiles), oneWayDurationMinutes: routeMinutes, vehicleCount, chargeableMiles: money(chargeableMiles), mileageRate: money(profile.mileageRate ?? rules.mileageRate ?? 0.55), cost: money(mileageCost), finalReturnBy: `${String(Math.floor(returnByMinutes / 60)).padStart(2,'0')}:${String(returnByMinutes % 60).padStart(2,'0')}`, returnsBy2300: returnByMinutes <= number(rules.latestReturnHomeMinutes, 23 * 60) },
    componentInclusions, calculatedCosts, costs: { ...activeCosts, purchaseCost: money(purchaseCost) },
    allowances: { nights, accommodationRooms: travelMode === 'stay_away' ? crewSize : 0, accommodationRate: money(profile.accommodationPerPersonNight ?? rules.accommodationPerPersonNight ?? 125), foodDays: programmeDays, supportDays, surveyDays, cillApplicableQuantity: cillQuantity, cillInstallationRate: money(cillInstallationRate), liftingEquipment: liftingRequired?{...lifting,hireCost:money(liftingHire),deliveryCost:money(liftingDelivery),collectionCost:money(liftingCollection),totalCost:money(liftingCost)}:{required:false},skipHire:skipRequired?{...skip,quantity:skipQuantity,hireCost:money(skipUnitHire),deliveryCost:money(skipDelivery),collectionCost:money(skipCollection),totalCost:money(skipCost)}:{required:false,quantity:Number(skip.quantity??1)||1} },
    selectedTeamId: profile.selectedTeamId ?? null, ruleVersion: profile.capturedRuleVersion ?? null, reviewRequired,
    provenance: { productivity: 'administration_snapshot', positionOverrides: 'estimate_snapshot', route: profile.route?.snapshotId ? 'google_route_snapshot' : profile.route?.manuallyOverridden ? 'estimate_override' : 'missing' },
  };
}

export function rankInstallationTeams({ teams = [], requiredCapabilities = [], minimumCrew = 1, routesByTeamId = {} }) {
  return teams.filter(team => team.active !== false && number(team.normalCrewSize) >= minimumCrew && requiredCapabilities.every(capability => (team.capabilities ?? []).includes(capability))).map(team => ({ ...team, route: routesByTeamId[team.id] ?? null })).sort((left, right) => number(left.route?.durationMinutes, Number.MAX_SAFE_INTEGER) - number(right.route?.durationMinutes, Number.MAX_SAFE_INTEGER) || number(left.route?.distanceMiles, Number.MAX_SAFE_INTEGER) - number(right.route?.distanceMiles, Number.MAX_SAFE_INTEGER));
}
