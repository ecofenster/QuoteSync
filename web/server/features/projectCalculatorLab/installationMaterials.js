const number = (value) => Number(value);
const round = (value, places = 3) => Number(number(value).toFixed(places));

export const FIXING_RULE_SOURCES = Object.freeze(["manufacturer", "product", "GGF/default", "estimate_override"]);
export const FIXING_METHODS = Object.freeze(["brackets", "direct_fix", "mixed_manual"]);
export const BUILDING_TYPES = Object.freeze(["timber_frame", "brick_block", "icf", "concrete"]);

function positionsAlong(lengthMm, endMinMm, endMaxMm, maximumCentresMm) {
  if (!Number.isFinite(number(lengthMm)) || number(lengthMm) <= endMinMm * 2) return null;
  const offset = Math.min(endMaxMm, Math.max(endMinMm, number(lengthMm) / 4));
  const span = number(lengthMm) - offset * 2;
  const intervals = Math.max(1, Math.ceil(span / maximumCentresMm));
  return Array.from({ length: intervals + 1 }, (_, index) => Math.round(offset + span * index / intervals));
}

export function calculateFrameFixingPositions({ widthMm, heightMm, frameMaterial, rule, quantity = 1 }) {
  const width = number(widthMm), height = number(heightMm), frames = number(quantity);
  if (![width, height, frames].every(Number.isFinite) || width <= 0 || height <= 0 || !Number.isInteger(frames) || frames < 1) return { status: "unavailable", reason: "Valid frame dimensions and quantity are required." };
  if (!rule) return { status: "unavailable", reason: `No fixing rule is configured for ${frameMaterial || "the frame material"}.` };
  const jamb = positionsAlong(height, rule.cornerOffsetMinMm, rule.cornerOffsetMaxMm, rule.maxIntermediateSpacingMm);
  if (!jamb) return { status: "review_required", reason: "Frame height cannot satisfy the configured corner fixing zones." };
  let head = [], sill = [];
  if (rule.allFourSides) {
    const horizontal = positionsAlong(width, rule.cornerOffsetMinMm, rule.cornerOffsetMaxMm, rule.maxIntermediateSpacingMm);
    if (!horizontal) return { status: "review_required", reason: "Frame width cannot satisfy the configured corner fixing zones." };
    head = horizontal;
    sill = horizontal;
  } else if (rule.centralHeadSillAboveWidthMm != null && width > rule.centralHeadSillAboveWidthMm) {
    head = [Math.round(width / 2)];
    sill = [Math.round(width / 2)];
  }
  const perFrame = jamb.length * 2 + head.length + sill.length;
  return { status: "available", ruleKey: rule.key, ruleSource: rule.source, source: rule.provenance, frameMaterial, leftJambFixingCount: jamb.length, rightJambFixingCount: jamb.length, headFixingCount: head.length, sillFixingCount: sill.length, totalFixingPositionsPerFrame: perFrame, quantityOfFrames: frames, totalFixingPositions: perFrame * frames, positionsMm: { leftJamb: jamb, rightJamb: jamb, head, sill } };
}

export function roundToPurchasablePack(requiredQuantity, packQuantity, packPrice = null) {
  const required = Math.max(0, Math.ceil(number(requiredQuantity) || 0));
  if (!packQuantity || number(packQuantity) <= 0) return { requiredQuantity: required, packsRequired: null, purchaseQuantity: null, unusedAllowance: null, purchaseCost: null, status: "Pending product specification" };
  const packs = Math.ceil(required / number(packQuantity)), purchaseQuantity = packs * number(packQuantity);
  const validPrice = packPrice != null && Number.isFinite(number(packPrice)) && number(packPrice) >= 0;
  return { requiredQuantity: required, packsRequired: packs, purchaseQuantity, unusedAllowance: purchaseQuantity - required, purchaseCost: validPrice ? (packs * number(packPrice)).toFixed(2) : null, status: validPrice ? "priced" : "Price required" };
}

export function calculatePackerRequirement({ fixingPositions, mode, packersPerFixingPosition, packersPerFrame, frameQuantity, manualAdjustment = 0, mix = [] }) {
  let calculated = null;
  if (mode === "per_fixing_position" && packersPerFixingPosition != null) calculated = Math.ceil(number(fixingPositions) * number(packersPerFixingPosition));
  if (mode === "per_frame" && packersPerFrame != null) calculated = Math.ceil(number(frameQuantity) * number(packersPerFrame));
  if (mode === "manual") calculated = 0;
  if (calculated == null) return { status: "unavailable", reason: "Packer quantity rule is pending product specification.", calculatedQuantity: null, manualAdjustment: number(manualAdjustment) || 0, finalRequiredQuantity: null, allocatedQuantity: mix.reduce((sum, item) => sum + number(item.requiredQuantity || 0), 0), mix };
  const finalRequiredQuantity = Math.max(0, calculated + Math.trunc(number(manualAdjustment) || 0));
  const allocatedQuantity = mix.reduce((sum, item) => sum + number(item.requiredQuantity || 0), 0);
  const purchasingMix = mix.map(item => ({ ...item, purchasing: roundToPurchasablePack(item.requiredQuantity, item.packQuantity, item.packPrice) }));
  const purchaseCosts = purchasingMix.map(item => item.purchasing.purchaseCost).filter(value => value != null);
  return { status: "available", calculatedQuantity: calculated, manualAdjustment: Math.trunc(number(manualAdjustment) || 0), finalRequiredQuantity, allocatedQuantity, unallocatedQuantity: finalRequiredQuantity - allocatedQuantity, purchaseCost: purchaseCosts.length ? purchaseCosts.reduce((sum, value) => sum + number(value), 0).toFixed(2) : null, mix: purchasingMix };
}

export function calculateInstallationMaterials({ positions, rules, options, catalogue }) {
  const included = positions.filter(item => item.includedInCurrentEstimate !== false && item.classification !== "alternative");
  const fixingMethod = options.fixingMethod || "brackets", bracketLengthMm = options.bracketLengthMm ?? rules.defaultBracketLengthMm ?? null;
  const buildingRule = rules.buildingTypes?.[options.buildingType];
  const frameRules = rules.frameFixingRules || {};
  const positionCalculations = included.map(position => {
    const override=options.positionOverrides?.[position.estimatePositionId||position.id]||{};
    const material = override.frameMaterial || position.frameMaterial || position.sourceSnapshot?.frameMaterial || options.defaultFrameMaterial || null;
    const rule = frameRules[material];
    const fixing = calculateFrameFixingPositions({ ...position, frameMaterial: material, rule, quantity: position.quantity });
    const positionMethod=override.fixingMethod||fixingMethod,positionBracketLength=override.bracketLengthMm??bracketLengthMm;
    if (fixing.status !== "available") return { reference: position.displayReference, widthMm: position.widthMm, heightMm: position.heightMm, quantity: position.quantity, perimeterM: number(position.framePerimeterMetres), frameMaterial: material, fixingMethod:positionMethod, bracketLengthMm:positionBracketLength, fixing };
    const brackets = positionMethod === "brackets" ? fixing.totalFixingPositions : null;
    const frameScrews = brackets == null ? null : brackets * number(rules.frameScrewsPerBracket);
    const substrateFixings = brackets == null || buildingRule?.fixingsPerBracket == null ? null : brackets * number(buildingRule.fixingsPerBracket);
    return { reference: position.displayReference, widthMm: position.widthMm, heightMm: position.heightMm, quantity: position.quantity, perimeterM: number(position.framePerimeterMetres), frameMaterial: material, buildingType: options.buildingType, fixingMethod:positionMethod, bracketLengthMm:positionBracketLength, fixing, bracketQuantity: brackets, frameScrewQuantity: frameScrews, substrateFixingQuantity: substrateFixings, substrateFixingStatus: buildingRule?.fixingsPerBracket == null ? "Pending product specification" : "available" };
  });
  const totals = positionCalculations.reduce((sum, row) => ({ brackets: sum.brackets + (row.bracketQuantity || 0), frameScrews: sum.frameScrews + (row.frameScrewQuantity || 0), substrateFixings: sum.substrateFixings + (row.substrateFixingQuantity || 0), fixingPositions: sum.fixingPositions + (row.fixing?.totalFixingPositions || 0), frames: sum.frames + row.quantity }), { brackets: 0, frameScrews: 0, substrateFixings: 0, fixingPositions: 0, frames: 0 });
  const perimeterM=round(positionCalculations.reduce((sum,row)=>sum+number(row.perimeterM||0),0));
  const contingencyMultiplier = 1 + number(options.contingencyPercent ?? rules.defaultContingencyPercent ?? 0) / 100;
  const product = (id, categories, predicate = () => true) => {
    if (id) return catalogue.find(item => item.id === id && item.active !== false);
    const matches=catalogue.filter(item=>item.active!==false&&categories.includes(item.category)&&predicate(item));
    return matches.length===1?matches[0]:null;
  };
  const unresolvedMethod = fixingMethod !== "brackets";
  const unresolvedFixing = positionCalculations.some(row => row.fixing.status !== "available");
  const unresolvedSubstrate = positionCalculations.some(row => row.fixing.status === "available" && row.substrateFixingQuantity == null);
  const pending = reason => ({ requiredQuantity: null, packsRequired: null, purchaseQuantity: null, unusedAllowance: null, purchaseCost: null, status: reason });
  const purchasing = {
    brackets: unresolvedMethod || unresolvedFixing ? pending(unresolvedMethod ? "Manual calculation required for this fixing method" : "Fixing calculation review required") : roundToPurchasablePack(Math.ceil(totals.brackets * contingencyMultiplier), product(options.bracketProductId,["bracket"],item=>Number(item.variant?.bracketLengthMm)===Number(bracketLengthMm))?.variant?.packQuantity, product(options.bracketProductId,["bracket"],item=>Number(item.variant?.bracketLengthMm)===Number(bracketLengthMm))?.priceAmount),
    frameScrews: unresolvedMethod || unresolvedFixing ? pending(unresolvedMethod ? "Manual calculation required for this fixing method" : "Fixing calculation review required") : roundToPurchasablePack(Math.ceil(totals.frameScrews * contingencyMultiplier), product(options.frameScrewProductId,["frame_screw"])?.variant?.packQuantity, product(options.frameScrewProductId,["frame_screw"])?.priceAmount),
    substrateFixings: unresolvedMethod || unresolvedFixing || unresolvedSubstrate ? pending(unresolvedMethod ? "Manual calculation required for this fixing method" : unresolvedFixing ? "Fixing calculation review required" : "Pending product specification") : roundToPurchasablePack(Math.ceil(totals.substrateFixings * contingencyMultiplier), product(options.substrateFixingProductId,["concrete_screw","masonry_fixing","timber_fixing","icf_fixing"],item=>item.category===({concrete:"concrete_screw",brick_block:"masonry_fixing",timber_frame:"timber_fixing",icf:"icf_fixing"}[options.buildingType]))?.variant?.packQuantity, product(options.substrateFixingProductId,["concrete_screw","masonry_fixing","timber_fixing","icf_fixing"],item=>item.category===({concrete:"concrete_screw",brick_block:"masonry_fixing",timber_frame:"timber_fixing",icf:"icf_fixing"}[options.buildingType]))?.priceAmount),
  };
  const selectedPacker=product(options.packerProductId,["packer"]),configuredMix=(options.packerMix||[]).length?options.packerMix:(selectedPacker?[{productId:selectedPacker.id,requiredQuantity:0}]:[]);
  const packerMix=configuredMix.map(item=>{const selected=product(item.productId,["packer"]);return{...item,packQuantity:selected?.variant?.packQuantity??null,packPrice:selected?.priceAmount??null,productLabel:selected?.label??"Pending product specification"}});
  const packers = calculatePackerRequirement({ fixingPositions: totals.fixingPositions, mode: options.packerCalculationMode || rules.packerCalculationMode, packersPerFixingPosition: rules.packersPerFixingPosition, packersPerFrame: rules.packersPerFrame, frameQuantity: totals.frames, manualAdjustment: options.packerManualAdjustment, mix: packerMix });
  if(selectedPacker&&packerMix.length===1&&packers.finalRequiredQuantity!=null){packerMix[0].requiredQuantity=packers.finalRequiredQuantity;packerMix[0].purchasing=roundToPurchasablePack(packers.finalRequiredQuantity,selectedPacker.variant?.packQuantity,selectedPacker.priceAmount);packers.mix=packerMix;packers.allocatedQuantity=packers.finalRequiredQuantity;packers.unallocatedQuantity=0;packers.purchaseCost=packerMix[0].purchasing.purchaseCost;}
  const rollRequirement=(id,categories,label)=>{const selected=product(id,categories);if(!selected)return{label,requiredLengthM:round(perimeterM*contingencyMultiplier),rollsRequired:null,packsRequired:null,purchaseCost:null,status:"Variant / joint specification required"};const rollLength=number(selected.variant?.rollLengthM),rollsPerPack=number(selected.variant?.rollsPerBox??selected.variant?.packQuantity??1);if(!rollLength)return{label:selected.label,requiredLengthM:round(perimeterM*contingencyMultiplier),rollsRequired:null,packsRequired:null,purchaseCost:null,status:"Roll length specification required"};const requiredLengthM=round(perimeterM*contingencyMultiplier),rollsRequired=Math.ceil(requiredLengthM/rollLength),packsRequired=Math.ceil(rollsRequired/Math.max(1,rollsPerPack)),pricedQuantity=selected.rateType==="roll"?rollsRequired:packsRequired;return{label:selected.label,requiredLengthM,rollsRequired,packsRequired,purchaseCost:selected.priceAmount==null?null:(pricedQuantity*number(selected.priceAmount)).toFixed(2),status:selected.priceAmount==null?"Price required":"priced"};};
  const sealingPurchasing={ME508:rollRequirement(options.me508ProductId,["illbruck_me508"],"ME508"),TP600:rollRequirement(options.tp600ProductId,["illbruck_tp600","illbruck_tp601"],"TP600")};
  const priced = [...Object.values(purchasing), ...(packers.mix || []).map(item => item.purchasing),...Object.values(sealingPurchasing)].map(item => item?.purchaseCost).filter(value => value != null);
  const sealing={ME508:{requiredLengthM:perimeterM,status:"Calculated by existing selected ME508 variant"},ME020:{requiredLengthM:options.me020Enabled?perimeterM:null,status:options.me020Enabled?"Pending technical variant specification":"Not enabled"},TP600:{requiredLengthM:perimeterM,status:"Joint-width variant selection required"},FM330:{requiredLengthM:perimeterM,status:"Yield unavailable — joint geometry/product specification required"},ME902:{requiredLengthM:null,status:"Primer selection is building/substrate driven; coverage unavailable"}};
  return { status: unresolvedMethod || unresolvedFixing || unresolvedSubstrate ? "review_required" : "available", fixingMethod, bracketLengthMm, buildingType: options.buildingType || null, contingencyPercent: number(options.contingencyPercent ?? rules.defaultContingencyPercent ?? 0), totalPerimeterM:perimeterM, frameScrewsPerBracket: number(rules.frameScrewsPerBracket), positionCalculations, totals, sealing, sealingPurchasing, purchasing, packers, purchaseCost: priced.length ? priced.reduce((sum, value) => sum + number(value), 0).toFixed(2) : null, priceStatus: priced.length ? "partially_priced" : "Pending product specification" };
}
