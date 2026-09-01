const number = (value) => Number(value);
const round = (value, places = 3) => Number(number(value).toFixed(places));

export const FIXING_RULE_SOURCES = Object.freeze(["manufacturer", "product", "GGF/default", "estimate_override"]);
export const FIXING_METHODS = Object.freeze(["brackets", "direct_fix", "mixed_manual"]);
export const BUILDING_TYPES = Object.freeze(["timber_frame", "brick_block", "icf", "concrete"]);
export const INSTALLATION_MATERIAL_QUANTITY_STRATEGIES = Object.freeze({
  LINEAR_ROLL: "linear_roll",
  COVERAGE_CAN: "coverage_can",
  FOAM_VOLUME_BOX: "foam_volume_box",
  ORDER_FIXED: "order_fixed",
});
export const INSTALLATION_LINEAR_MATERIAL_CONTINGENCY_PERCENT = 15;
export const FM330_ASSUMPTIONS = Object.freeze({ jointDepthMm: 92, jointWidthMm: 20, foamYieldLitresPerCan: 45, cansPerBox: 12 });

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

const explicitInstallationPerimeter = position => {
  const source = position.sourceSnapshot && typeof position.sourceSnapshot === "object" ? position.sourceSnapshot : {};
  const canonical = source.canonicalPosition && typeof source.canonicalPosition === "object" ? source.canonicalPosition : {};
  const configured = source.configuredContract && typeof source.configuredContract === "object" ? source.configuredContract : {};
  const geometry = configured.geometry && typeof configured.geometry === "object" ? configured.geometry : {};
  return [position.installationPerimeterMetres, source.installationPerimeterMetres, canonical.installationPerimeterMetres, geometry.installationPerimeterMetres].map(number).find(value => Number.isFinite(value) && value > 0) ?? null;
};

const isNonRectangular = position => {
  const source = position.sourceSnapshot && typeof position.sourceSnapshot === "object" ? position.sourceSnapshot : {};
  const shape = String(source.shape ?? source.productShape ?? source.canonicalPosition?.shape ?? "").trim().toLowerCase();
  return Boolean(shape && !["rectangle", "rectangular", "standard"].includes(shape));
};

const normalizedFrameMaterial = value => {
  const text = String(value ?? "").trim().toLowerCase().replaceAll("_", " ");
  if (!text) return null;
  if (/\b(upvc|pvc[ -]?u)\b/.test(text)) return "PVC-U";
  if (/\btimber\b|\bwood\b/.test(text)) return "Timber";
  if (/\baluminium\b|\baluminum\b/.test(text)) return "Aluminium";
  if (/steel.*hot.*solid/.test(text)) return "Steel — hot rolled solid";
  if (/steel.*cold.*hollow/.test(text)) return "Steel — cold formed hollow";
  return null;
};

export function resolvePositionFrameMaterial(position, override = {}, options = {}) {
  const source = position?.sourceSnapshot && typeof position.sourceSnapshot === "object" ? position.sourceSnapshot : {};
  const specification = source.manufacturerEvidence?.canonicalSpecification ?? source.canonicalSpecification ?? {};
  const candidates = [
    [override.frameMaterial, "position_override"],
    [position?.frameMaterial, "canonical_position"],
    [source.frameMaterial, "source_snapshot"],
    [specification.productFamily?.value, "manufacturer_product_family"],
    [specification.frameProfile?.value, "manufacturer_frame_profile"],
    [options.defaultFrameMaterial, "estimate_default"],
  ];
  for (const [candidate, evidenceSource] of candidates) {
    const material = normalizedFrameMaterial(candidate);
    if (material) return { material, evidenceSource, sourceValue: String(candidate) };
  }
  return { material: null, evidenceSource: null, sourceValue: null };
}

export function resolveBracketAssemblyRules(rules) {
  const legacyTotalFixingsMapping = Number(rules?.version) === 1 && Number(rules?.frameScrewsPerBracket) === 3 && rules?.substrateFixingsPerBracket == null;
  return {
    frameScrewsPerBracket: legacyTotalFixingsMapping ? 2 : number(rules?.frameScrewsPerBracket ?? 2),
    substrateFixingsPerBracket: legacyTotalFixingsMapping ? 1 : rules?.substrateFixingsPerBracket == null ? null : number(rules.substrateFixingsPerBracket),
    totalFixingsPerBracket: 3,
    compatibility: legacyTotalFixingsMapping ? "legacy_three_total_fixings_to_two_frame_plus_one_substrate" : null,
  };
}

export function resolveInstallationPerimeter(position) {
  const explicit = explicitInstallationPerimeter(position);
  if (explicit != null) return { status: "available", perimeterM: round(explicit), source: "canonical_installation_perimeter" };
  if (isNonRectangular(position)) return { status: "review_required", perimeterM: null, source: null, reason: "Actual installation perimeter is required for this non-rectangular product." };
  const fallback = number(position.framePerimeterMetres);
  if (Number.isFinite(fallback) && fallback > 0) return { status: "available", perimeterM: round(fallback), source: "canonical_rectangular_frame_perimeter" };
  return { status: "review_required", perimeterM: null, source: null, reason: "Installation perimeter is unavailable." };
}

export function calculateFm330Requirement(linearMetres, assumptions = FM330_ASSUMPTIONS) {
  const lm = number(linearMetres), depth = number(assumptions.jointDepthMm), width = number(assumptions.jointWidthMm), yieldLitres = number(assumptions.foamYieldLitresPerCan), cansPerBox = number(assumptions.cansPerBox);
  if (![lm, depth, width, yieldLitres, cansPerBox].every(Number.isFinite) || lm < 0 || depth <= 0 || width <= 0 || yieldLitres <= 0 || cansPerBox <= 0) return { status: "review_required", requiredCansRaw: null, boxesRequired: null, purchasedCans: null };
  const requiredCansRaw = lm * depth * width / (1000 * yieldLitres);
  const boxesRequired = requiredCansRaw > 0 ? Math.ceil(requiredCansRaw / cansPerBox) : 0;
  return { status: "available", requiredCansRaw: round(requiredCansRaw, 6), boxesRequired, purchasedCans: boxesRequired * cansPerBox };
}

export function calculateInstallationMaterials({ positions, rules, options, catalogue }) {
  const included = positions.filter(item => item.includedInCurrentEstimate !== false && item.classification !== "alternative");
  const fixingMethod = options.fixingMethod || "brackets", bracketLengthMm = options.bracketLengthMm ?? rules.defaultBracketLengthMm ?? 250;
  const buildingRule = rules.buildingTypes?.[options.buildingType];
  const frameRules = rules.frameFixingRules || {};
  const assemblyRules = resolveBracketAssemblyRules(rules);
  const positionCalculations = included.map(position => {
    const override=options.positionOverrides?.[position.estimatePositionId||position.id]||{};
    const resolvedMaterial=resolvePositionFrameMaterial(position,override,options),material=resolvedMaterial.material;
    const source=position.sourceSnapshot&&typeof position.sourceSnapshot==="object"?position.sourceSnapshot:{},family=String(source.manufacturerEvidence?.canonicalSpecification?.productFamily?.value??source.canonicalSpecification?.productFamily?.value??position.productClass??source.canonicalPosition?.positionType??source.configuredContract?.productType??"").toLowerCase(),specialist=/slid|lift|bifold|curtain/.test(family);
    let fixing;
    if(isNonRectangular(position))fixing={status:"review_required",reason:"Actual member geometry is required for a non-rectangular fixing layout."};
    else if(specialist)fixing={status:"review_required",reason:"An approved specialist product-family fixing rule is required."};
    else if(isGgfPvcuApplicable({projectType:options.projectType,frameMaterial:material,region:options.region||"England"})){
      const memberEvidence=source.mullionTransomPositions??source.canonicalPosition?.mullionTransomPositions??source.configuredContract?.geometry?.mullionTransomPositions;
      const ggf=calculateGgfPvcuFixings({widthMm:position.widthMm,heightMm:position.heightMm,physicalQuantity:position.quantity,projectType:options.projectType,frameMaterial:material,region:options.region||"England",mullionTransomPositions:Array.isArray(memberEvidence)?memberEvidence:null});
      fixing={status:"available",requiresReview:ggf.requiresReview,reason:ggf.reason??null,ruleKey:ggf.ruleKey,ruleSource:"GGF/default",source:frameRules[material]?.provenance??null,frameMaterial:material,leftJambFixingCount:ggf.fixingsPerJamb,rightJambFixingCount:ggf.fixingsPerJamb,headFixingCount:ggf.intermediateHeadFixings,sillFixingCount:ggf.intermediateSillFixings,totalFixingPositionsPerFrame:ggf.calculatedFixingsPerUnit,quantityOfFrames:ggf.physicalQuantity,totalFixingPositions:ggf.totalCalculatedFixings,positionsMm:{leftJamb:ggf.jambPositionsMm,rightJamb:ggf.jambPositionsMm,head:[],sill:[]},warnings:ggf.warnings??[]};
    }else{
      const rule = frameRules[material];
      fixing = calculateFrameFixingPositions({ ...position, frameMaterial: material, rule, quantity: position.quantity });
    }
    const positionMethod=override.fixingMethod||fixingMethod,positionBracketLength=override.bracketLengthMm??bracketLengthMm;
    const installationPerimeter = resolveInstallationPerimeter(position);
    if (fixing.status !== "available") return { reference: position.displayReference, widthMm: position.widthMm, heightMm: position.heightMm, quantity: position.quantity, perimeterM: installationPerimeter.perimeterM, perimeterSource: installationPerimeter.source, perimeterStatus: installationPerimeter.status, perimeterReason: installationPerimeter.reason ?? null, frameMaterial: material, frameMaterialSource:resolvedMaterial.evidenceSource, frameMaterialSourceValue:resolvedMaterial.sourceValue, fixingMethod:positionMethod, bracketLengthMm:positionBracketLength, fixing };
    const brackets = positionMethod === "brackets" ? fixing.totalFixingPositions : null;
    const frameScrews = brackets == null ? null : brackets * assemblyRules.frameScrewsPerBracket;
    const substrateRate = buildingRule?.fixingsPerBracket ?? (options.buildingType && options.buildingType !== "timber_frame" ? assemblyRules.substrateFixingsPerBracket : null);
    const substrateFixings = brackets == null || substrateRate == null ? null : brackets * number(substrateRate);
    return { reference: position.displayReference, widthMm: position.widthMm, heightMm: position.heightMm, quantity: position.quantity, perimeterM: installationPerimeter.perimeterM, perimeterSource: installationPerimeter.source, perimeterStatus: installationPerimeter.status, perimeterReason: installationPerimeter.reason ?? null, frameMaterial: material, frameMaterialSource:resolvedMaterial.evidenceSource, frameMaterialSourceValue:resolvedMaterial.sourceValue, buildingType: options.buildingType, fixingMethod:positionMethod, bracketLengthMm:positionBracketLength, fixing, bracketQuantity: brackets, bracketsPerUnit:brackets==null?null:brackets/number(position.quantity), frameScrewQuantity: frameScrews, substrateFixingQuantity: substrateFixings, substrateFixingStatus: substrateRate == null ? "Substrate fixing product/cost required" : "available" };
  });
  const totals = positionCalculations.reduce((sum, row) => ({ brackets: sum.brackets + (row.bracketQuantity || 0), frameScrews: sum.frameScrews + (row.frameScrewQuantity || 0), substrateFixings: sum.substrateFixings + (row.substrateFixingQuantity || 0), fixingPositions: sum.fixingPositions + (row.fixing?.totalFixingPositions || 0), frames: sum.frames + row.quantity }), { brackets: 0, frameScrews: 0, substrateFixings: 0, fixingPositions: 0, frames: 0 });
  const unresolvedPerimeter = positionCalculations.some(row => row.perimeterStatus !== "available");
  const perimeterM=round(positionCalculations.reduce((sum,row)=>sum+number(row.perimeterM||0),0));
  const product = (id, categories, predicate = () => true) => {
    if (id) return catalogue.find(item => item.id === id && item.active !== false);
    const matches=catalogue.filter(item=>item.active!==false&&categories.includes(item.category)&&predicate(item));
    return matches.length===1?matches[0]:null;
  };
  const unresolvedMethod = fixingMethod !== "brackets";
  const unresolvedFixing = positionCalculations.some(row => row.fixing.status !== "available"),fixingReviewRequired=positionCalculations.some(row=>row.fixing.requiresReview===true);
  const unresolvedSubstrate = positionCalculations.some(row => row.fixing.status === "available" && row.substrateFixingQuantity == null);
  const pending = reason => ({ requiredQuantity: null, packsRequired: null, purchaseQuantity: null, unusedAllowance: null, purchaseCost: null, status: reason });
  const unpricedQuantity = (requiredQuantity, reason) => ({ requiredQuantity, packsRequired: null, purchaseQuantity: null, unusedAllowance: null, purchaseCost: null, status: reason });
  const selectedBracket=product(options.bracketProductId,["bracket"],item=>Number(item.variant?.bracketLengthMm)===Number(bracketLengthMm));
  const selectedFrameScrew=product(options.frameScrewProductId,["frame_screw"]);
  const substrateCategory={concrete:"concrete_screw",brick_block:"masonry_fixing",timber_frame:"timber_fixing",icf:"icf_fixing"}[options.buildingType];
  const selectedSubstrate=product(options.substrateFixingProductId,["concrete_screw","masonry_fixing","timber_fixing","icf_fixing"],item=>item.category===substrateCategory);
  const purchasing = {
    brackets: unresolvedMethod || unresolvedFixing ? pending(unresolvedMethod ? "Manual calculation required for this fixing method" : "GGF fixing rule required") : selectedBracket ? roundToPurchasablePack(totals.brackets, selectedBracket.variant?.unitsPerPack??selectedBracket.variant?.packQuantity??1, selectedBracket.priceAmount) : unpricedQuantity(totals.brackets,"Bracket catalogue item required"),
    frameScrews: unresolvedMethod || unresolvedFixing ? pending(unresolvedMethod ? "Manual calculation required for this fixing method" : "GGF fixing rule required") : selectedFrameScrew ? roundToPurchasablePack(totals.frameScrews, selectedFrameScrew.variant?.packQuantity, selectedFrameScrew.priceAmount) : unpricedQuantity(totals.frameScrews,"Frame screw product/cost required"),
    substrateFixings: unresolvedMethod || unresolvedFixing || unresolvedSubstrate ? pending(unresolvedMethod ? "Manual calculation required for this fixing method" : unresolvedFixing ? "GGF fixing rule required" : "Substrate fixing product/cost required") : selectedSubstrate ? roundToPurchasablePack(totals.substrateFixings, selectedSubstrate.variant?.packQuantity, selectedSubstrate.priceAmount) : unpricedQuantity(totals.substrateFixings,"Substrate fixing product/cost required"),
  };
  const selectedPacker=product(options.packerProductId,["packer"]),configuredMix=(options.packerMix||[]).length?options.packerMix:(selectedPacker?[{productId:selectedPacker.id,requiredQuantity:0}]:[]),packerInScope=Boolean(selectedPacker||configuredMix.length||rules.packersPerFixingPosition!=null||rules.packersPerFrame!=null||number(options.packerManualAdjustment));
  const packerMix=configuredMix.map(item=>{const selected=product(item.productId,["packer"]);return{...item,packQuantity:selected?.variant?.packQuantity??null,packPrice:selected?.priceAmount??null,productLabel:selected?.label??"Pending product specification"}});
  const packers = packerInScope?{...calculatePackerRequirement({ fixingPositions: totals.fixingPositions, mode: options.packerCalculationMode || rules.packerCalculationMode, packersPerFixingPosition: rules.packersPerFixingPosition, packersPerFrame: rules.packersPerFrame, frameQuantity: totals.frames, manualAdjustment: options.packerManualAdjustment, mix: packerMix }),inScope:true}:{inScope:false,status:"not_required",reason:null,calculatedQuantity:0,manualAdjustment:0,finalRequiredQuantity:0,allocatedQuantity:0,unallocatedQuantity:0,purchaseCost:null,mix:[]};
  if(selectedPacker&&packerMix.length===1&&packers.finalRequiredQuantity!=null){packerMix[0].requiredQuantity=packers.finalRequiredQuantity;packerMix[0].purchasing=roundToPurchasablePack(packers.finalRequiredQuantity,selectedPacker.variant?.packQuantity,selectedPacker.priceAmount);packers.mix=packerMix;packers.allocatedQuantity=packers.finalRequiredQuantity;packers.unallocatedQuantity=0;packers.purchaseCost=packerMix[0].purchasing.purchaseCost;}
  const materialSelections=options.materialSelections&&typeof options.materialSelections==="object"?options.materialSelections:{};
  const materialSelection=(code,legacyProductId=null)=>{const value=materialSelections[code];return value&&typeof value==="object"?value:{required:Boolean(legacyProductId),productId:legacyProductId,quantity:null};};
  const linearContingencyMultiplier = 1 + INSTALLATION_LINEAR_MATERIAL_CONTINGENCY_PERCENT / 100;
  const rollRequirement=(code,legacyId,categories,label)=>{
    const choice=materialSelection(code,legacyId),required=choice.required===true,selected=product(choice.productId??legacyId,categories),requiredLengthM=required&&!unresolvedPerimeter?round(perimeterM*linearContingencyMultiplier):required?null:0;
    const base={code,label,required,productId:selected?.id??null,variantLabel:selected?.label??null,quantityStrategy:INSTALLATION_MATERIAL_QUANTITY_STRATEGIES.LINEAR_ROLL,baseLinearMetres:required?perimeterM:0,requiredLengthM,contingencyPercent:INSTALLATION_LINEAR_MATERIAL_CONTINGENCY_PERCENT,contingencyApplied:required};
    if(!required)return{...base,rollsRequired:0,packsRequired:0,purchaseUnits:0,purchaseUnit:"roll",quantity:0,purchaseCost:"0.00",status:"Not required",contingencyApplied:false};
    if(unresolvedPerimeter)return{...base,rollsRequired:null,packsRequired:null,purchaseUnits:null,purchaseUnit:"roll",quantity:null,purchaseCost:null,status:"Perimeter review required"};
    if(!selected)return{...base,productId:null,variantLabel:null,rollsRequired:null,packsRequired:null,purchaseUnits:null,purchaseUnit:"roll",quantity:null,purchaseCost:null,status:"Variant / joint specification required"};
    const rollLength=number(selected.variant?.rollLengthM),rollsPerPack=number(selected.variant?.rollsPerBox??selected.variant?.packQuantity??1);
    if(!rollLength)return{...base,label:selected.label,rollsRequired:null,packsRequired:null,purchaseUnits:null,purchaseUnit:"roll",quantity:null,purchaseCost:null,status:"Roll length specification required"};
    const rollsRequired=Math.ceil(requiredLengthM/rollLength),packsRequired=Math.ceil(rollsRequired/Math.max(1,rollsPerPack)),pricedQuantity=selected.rateType==="roll"?rollsRequired:packsRequired;
    const currency=String(selected.currency??"GBP").toUpperCase(),currencyReady=currency==="GBP";
    return{...base,label:selected.label,quantitySource:"calculated",rollLengthM:rollLength,rollsRequired,packsRequired,purchaseUnits:pricedQuantity,purchaseUnit:selected.rateType==="roll"?"roll":selected.rateType,quantity:rollsRequired,purchaseDescription:`${rollsRequired} × ${rollLength} m roll${rollsRequired===1?"":"s"}`,purchaseCost:selected.priceAmount==null||!currencyReady?null:(pricedQuantity*number(selected.priceAmount)).toFixed(2),unitCost:selected.priceAmount??null,currency,status:selected.priceAmount==null?"Cost required":!currencyReady?"GBP conversion required":"priced"};
  };
  const fm330Requirement=()=>{
    const code="FM330",choice=materialSelection(code),required=choice.required===true,selected=product(choice.productId,["illbruck_fm330"],item=>String(item.variant?.productCode??item.variant?.productName??"").toUpperCase().includes("FM330"));
    const base={code,label:"Illbruck FM330 PU Foam",required,productId:selected?.id??null,variantLabel:selected?.label??null,quantityStrategy:INSTALLATION_MATERIAL_QUANTITY_STRATEGIES.FOAM_VOLUME_BOX,baseLinearMetres:required?perimeterM:0,contingencyPercent:0,contingencyApplied:false,calculationAssumptions:{...FM330_ASSUMPTIONS}};
    if(!required)return{...base,quantity:0,requiredCansRaw:0,boxesRequired:0,purchasedCans:0,purchaseUnits:0,purchaseUnit:"box",purchaseCost:"0.00",status:"Not required"};
    if(unresolvedPerimeter)return{...base,quantity:null,requiredCansRaw:null,boxesRequired:null,purchasedCans:null,purchaseUnits:null,purchaseUnit:"box",purchaseCost:null,status:"Perimeter review required"};
    if(!selected)return{...base,quantity:null,requiredCansRaw:null,boxesRequired:null,purchasedCans:null,purchaseUnits:null,purchaseUnit:"box",purchaseCost:null,status:"Catalogue item required"};
    const calculation=calculateFm330Requirement(perimeterM);
    const currency=String(selected.currency??"GBP").toUpperCase(),currencyReady=currency==="GBP";
    return{...base,label:selected.label,quantity:calculation.boxesRequired,requiredCansRaw:calculation.requiredCansRaw,boxesRequired:calculation.boxesRequired,purchasedCans:calculation.purchasedCans,purchaseUnits:calculation.boxesRequired,purchaseUnit:"box",purchaseDescription:`${calculation.boxesRequired} box${calculation.boxesRequired===1?"":"es"} / ${calculation.purchasedCans} cans`,purchaseCost:selected.priceAmount==null||!currencyReady?null:(calculation.boxesRequired*number(selected.priceAmount)).toFixed(2),unitCost:selected.priceAmount??null,currency,status:selected.priceAmount==null?"Cost required":!currencyReady?"GBP conversion required":"priced"};
  };
  const me902Requirement=()=>{
    const code="ME902",choice=materialSelection(code),required=choice.required===true,selected=product(choice.productId,["illbruck_me902"],item=>String(item.variant?.productCode??item.variant?.productName??"").toUpperCase().includes("ME902"));
    const base={code,label:"Illbruck ME902 Primer (Spray Can)",required,productId:selected?.id??null,variantLabel:selected?.label??null,quantityStrategy:INSTALLATION_MATERIAL_QUANTITY_STRATEGIES.COVERAGE_CAN,baseLinearMetres:required?perimeterM:0,requiredLengthM:required&&!unresolvedPerimeter?round(perimeterM*linearContingencyMultiplier):required?null:0,contingencyPercent:INSTALLATION_LINEAR_MATERIAL_CONTINGENCY_PERCENT,contingencyApplied:required};
    if(!required)return{...base,quantity:0,purchaseUnits:0,purchaseUnit:"can",purchaseCost:"0.00",status:"Not required",contingencyApplied:false};
    if(!selected)return{...base,quantity:null,purchaseUnits:null,purchaseUnit:"can",purchaseCost:null,status:"Catalogue item required"};
    const currency=String(selected.currency??"GBP").toUpperCase(),selectedBase={...base,label:selected.label,unitCost:selected.priceAmount??null,currency,purchaseUnit:"can"};
    if(unresolvedPerimeter)return{...selectedBase,quantity:null,purchaseUnits:null,purchaseCost:null,status:"Perimeter review required"};
    const appliesTo=String(selected.variant?.appliesTo??"").toUpperCase(),coverage=number(selected.variant?.coverageMetresPerUnit??selected.variant?.coverageYield);
    if(!["ME508","ME501","BOTH"].includes(appliesTo))return{...selectedBase,quantity:null,purchaseUnits:null,purchaseCost:null,status:"Applicability required"};
    const dependencySatisfied=appliesTo==="BOTH"?materialSelection("ME508").required===true||materialSelection("ME501").required===true:materialSelection(appliesTo).required===true;
    if(!dependencySatisfied)return{...selectedBase,quantity:null,purchaseUnits:null,purchaseCost:null,status:"Configured membrane dependency is not required"};
    if(!Number.isFinite(coverage)||coverage<=0)return{...selectedBase,quantity:null,purchaseUnits:null,purchaseCost:null,status:"Coverage required"};
    const cansRequired=Math.ceil(base.requiredLengthM/coverage);
    const currencyReady=currency==="GBP";
    return{...selectedBase,coverageMetresPerUnit:coverage,quantity:cansRequired,purchaseUnits:cansRequired,purchaseDescription:`${cansRequired} spray can${cansRequired===1?"":"s"}`,purchaseCost:selected.priceAmount==null||!currencyReady?null:(cansRequired*number(selected.priceAmount)).toFixed(2),status:selected.priceAmount==null?"Cost required":!currencyReady?"GBP conversion required":"priced"};
  };
  const fixedOrderRequirement=(code,label)=>{
    const choice=materialSelection(code),required=choice.required===true,selected=product(choice.productId,["tool"],item=>String(item.variant?.productCode??item.variant?.productName??"").toUpperCase()===code);
    if(!required)return{code,label,required:false,productId:selected?.id??null,variantLabel:selected?.label??null,quantityStrategy:INSTALLATION_MATERIAL_QUANTITY_STRATEGIES.ORDER_FIXED,quantity:0,purchaseUnits:0,purchaseUnit:"item",purchaseCost:"0.00",status:"Not required",contingencyPercent:0,contingencyApplied:false};
    if(!selected)return{code,label,required:true,productId:null,variantLabel:null,quantityStrategy:INSTALLATION_MATERIAL_QUANTITY_STRATEGIES.ORDER_FIXED,quantity:1,purchaseUnits:1,purchaseUnit:"item",purchaseCost:null,status:"Catalogue item required",contingencyPercent:0,contingencyApplied:false};
    const currency=String(selected.currency??"GBP").toUpperCase(),currencyReady=currency==="GBP";
    return{code,label:selected.label,required:true,productId:selected.id,variantLabel:selected.label,quantityStrategy:INSTALLATION_MATERIAL_QUANTITY_STRATEGIES.ORDER_FIXED,quantity:1,purchaseUnits:1,purchaseUnit:"item",purchaseDescription:"1 per order",purchaseCost:selected.priceAmount==null||!currencyReady?null:number(selected.priceAmount).toFixed(2),unitCost:selected.priceAmount??null,currency,status:selected.priceAmount==null?"Cost required":!currencyReady?"GBP conversion required":"priced",contingencyPercent:0,contingencyApplied:false};
  };
  const sealingPurchasing={ME508:rollRequirement("ME508",options.me508ProductId,["illbruck_me508"],"Illbruck ME508 Airtightness Membrane Internal"),ME501:rollRequirement("ME501",null,["illbruck_me501"],"Illbruck ME501 External Membrane"),TP600:rollRequirement("TP600",options.tp600ProductId,["illbruck_tp600","illbruck_tp601"],"Illbruck TP600 Compriband")};
  const simpleMaterials=[sealingPurchasing.ME508,sealingPurchasing.ME501,sealingPurchasing.TP600,fm330Requirement(),me902Requirement(),fixedOrderRequirement("AA270","Illbruck AA270 Foam Gun"),fixedOrderRequirement("AB005","Illbruck AB005 Cutting Shears")];
  const priced = [...Object.values(purchasing), ...(packers.mix || []).map(item => item.purchasing),...simpleMaterials.filter(item=>item.required)].map(item => item?.purchaseCost).filter(value => value != null);
  const unresolvedRequiredMaterials=simpleMaterials.filter(item=>item.required&&item.purchaseCost==null);
  const sealing={ME508:{requiredLengthM:sealingPurchasing.ME508.requiredLengthM,status:sealingPurchasing.ME508.status},ME501:{requiredLengthM:sealingPurchasing.ME501.requiredLengthM,status:sealingPurchasing.ME501.status},TP600:{requiredLengthM:sealingPurchasing.TP600.requiredLengthM,status:sealingPurchasing.TP600.status},FM330:{requiredLengthM:perimeterM,status:simpleMaterials.find(item=>item.code==="FM330").status},ME902:{requiredLengthM:simpleMaterials.find(item=>item.code==="ME902").requiredLengthM,status:simpleMaterials.find(item=>item.code==="ME902").status}};
  return { status: unresolvedMethod || unresolvedFixing || fixingReviewRequired || unresolvedSubstrate || unresolvedPerimeter || unresolvedRequiredMaterials.length ? "review_required" : "available", fixingMethod, bracketLengthMm, buildingType: options.buildingType || null, contingencyPercent: number(options.contingencyPercent ?? rules.defaultContingencyPercent ?? 0), linearMaterialContingencyPercent:INSTALLATION_LINEAR_MATERIAL_CONTINGENCY_PERCENT,totalPerimeterM:perimeterM,perimeterStatus:unresolvedPerimeter?"review_required":"available", frameScrewsPerBracket: assemblyRules.frameScrewsPerBracket, substrateFixingsPerBracket:assemblyRules.substrateFixingsPerBracket,totalFixingsPerBracket:assemblyRules.totalFixingsPerBracket,fixingAssemblyCompatibility:assemblyRules.compatibility, positionCalculations, totals, sealing, sealingPurchasing, simpleMaterials, purchasing, packers, purchaseCost: priced.length ? priced.reduce((sum, value) => sum + number(value), 0).toFixed(2) : null, priceStatus: unresolvedRequiredMaterials.length?"review_required":priced.length?"priced":"not_required",reviewRequiredMaterials:unresolvedRequiredMaterials.map(item=>({code:item.code,status:item.status})) };
}
import { calculateGgfPvcuFixings, isGgfPvcuApplicable } from './fixingRules.js';
