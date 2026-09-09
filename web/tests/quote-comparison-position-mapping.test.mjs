import test from "node:test";
import assert from "node:assert/strict";
import { inferQuoteComparisonMappings } from "../shared/quoteComparisonPositionMapping.js";
import { buildQuoteComparisonReport } from "../shared/quoteComparisonReportModel.js";

const definitions = [
  ["A",9,1000,660],["B",3,2000,660],["C",1,2000,1300],["D",2,2300,1000],["E",1,2600,1000],
  ["F",1,2600,2100],["G",1,2600,2500],["H",4,2900,1300],["J",1,2900,2500],["K",1,2900,2500],
  ["L",1,4400,1300],["M",1,6900,2500],["N",2,1000,4400],["N (A)",2,1000,4400],["P",1,1010,2440],
];
const positions = definitions.map(([reference,quantity,widthMm,heightMm],index)=>({id:`p${index}`,positionRef:reference,quantity,widthMm,heightMm}));
const item = (reference, quantity, widthMm, heightMm, extra={}) => ({supplierItemReference:reference,supplierItemSnapshot:{customerReference:reference,quantity,widthMm,heightMm,...extra}});
const mappedReferences = (items) => inferQuoteComparisonMappings(items,positions).mappings.map(mapping=>[mapping.supplierItemReference,positions.find(position=>position.id===mapping.canonicalEstimatePositionId)?.positionRef??null]);

test("Nick Corlett supplier references map independently to canonical Position identity",()=>{
  const nordvest=[...definitions.filter(([reference])=>reference!=="N (A)").flatMap(([reference,quantity,width,height])=>reference==="M"?[item("Style M",1,4600,2350),item("Style M",1,2300,2350)]:[item(`Style ${reference}`,reference==="P"?2:quantity,width,height)])];
  const norrsken=[item("Type A",9,1000,660),item("Type B",2,2000,660),item("Type B2",1,2000,660),...definitions.slice(2).filter(([reference])=>reference!=="N (A)").map(([reference,quantity,width,height])=>item(`Type ${reference}`,reference==="P"?2:quantity,width,height)),item("Option Type J",1,2900,2500,{classification:"alternative",alternativeTo:"Type J"}),item("Option Type L",1,4400,1300,{classification:"alternative",alternativeTo:"Type L"}),item("Option Type N",2,1000,4400,{classification:"alternative",alternativeTo:"Type N"})];
  const ecohaus=[item("A",6,1000,660),item("A 2",3,1000,660),item("B",2,2000,660),item("B 2",1,2000,660),...[["C",1,2000,1300],["D",2,2300,1000],["E",1,2600,1000],["F",1,2600,2100],["G",1,2600,2500],["H",4,2900,1300],["I",1,2900,1900],["K",1,2900,2500],["L",1,4400,1300],["M.",1,6900,2500],["N",4,1000,2200],["P",2,1010,2440]].map(args=>item(...args)),item("N couplers",2,null,null,{classification:"component",componentRole:"coupling_profile",componentForReference:"N"})];
  assert.deepEqual(mappedReferences(nordvest).map(([,target])=>target),["A","B","C","D","E","F","G","H","J","K","L","M","M","N","P"]);
  assert.deepEqual(mappedReferences(norrsken).filter(([source])=>/^Type [A-Z]/.test(source)).map(([,target])=>target),["A","B","B","C","D","E","F","G","H","J","K","L","M","N","P"]);
  assert.deepEqual(mappedReferences(norrsken).slice(-3),[["Option Type J","J"],["Option Type L","L"],["Option Type N","N (A)"]]);
  assert.deepEqual(mappedReferences(ecohaus).map(([,target])=>target),["A","A","B","B","C","D","E","F","G","H","J","K","L","M","N","P","N (A)"]);
});

test("position report keeps options separate and withholds ranking when a competitor is unresolved",()=>{
  const position=positions.find(candidate=>candidate.positionRef==="J");
  const proposal={id:"norrsken",supplierName:"Norrsken",manufacturerName:"Norrsken",scopeKind:"supply_and_install",currency:"GBP",positionMappings:[
    {...item("Type J",1,2900,1900),id:"m1",canonicalEstimatePositionId:position.id,relationshipKind:"exact",differenceStatus:"dimension_mismatch",differences:[]},
    {...item("Option Type J",1,2900,2500,{classification:"alternative"}),id:"m2",canonicalEstimatePositionId:position.id,relationshipKind:"alternative",differenceStatus:"alternative",differences:[]},
  ]};
  const unresolved={id:"ecohaus",supplierName:"EcoHaus",manufacturerName:"Internorm",scopeKind:"supply_and_install",currency:"GBP",positionMappings:[{...item("Unresolved source row",1,null,null),id:"m3",canonicalEstimatePositionId:position.id,relationshipKind:"unmapped",differenceStatus:"review_required",differences:[]}]};
  const report=buildQuoteComparisonReport({recordRevision:1,baselineSnapshot:{estimateRef:"EF-EST-2026-055",positions:[position],customerCommercial:{}},proposals:[proposal,unresolved]});
  assert.deepEqual(report.positions[0].offers.filter(offer=>offer.proposalId==="norrsken").map(offer=>[offer.reference,offer.isAlternative]),[["Type J",false],["Option Type J",true]]);
  assert.equal(report.positions[0].recommendationStatus,"review_required");
  assert.deepEqual(report.positions[0].recommendations,[]);
});

test("ampersand lift-and-slide wording remains a sliding-door reference operation",()=>{
  const baseline={id:"g",positionRef:"G",quantity:1,widthMm:2600,heightMm:2500,product:"Lift & Slide Door ALUCLAD SKY 92 mm.",configurationDescription:"View from inside"};
  const result=inferQuoteComparisonMappings([item("Type G",1,2600,2500,{product:"S319A sliding door",configurationDescription:"Right pane slides to the left"})],[baseline]).mappings[0];
  assert.equal(result.differenceStatus,"exact_match");
  assert.equal(result.differences.some(difference=>difference.field==="configuration"),false);
});

test("split supplier frames map as one source-evidenced composite opening",()=>{
  const baseline={id:"d04",positionRef:"D04-1 D04-2 D04-3",quantity:1,widthMm:5384,heightMm:2100,product:"Lift & Slide Door",configurationDescription:"View from inside"};
  const supplierItems=[
    item("D04-1",1,1346,2100,{product:"Inline Patio 25mm LH",unitPrice:"1840.11",totalPrice:"1840.11"}),
    item("D04-2",1,2692,2100,{product:"Biparting Door 25mm",unitPrice:"4234.84",totalPrice:"4234.84"}),
    item("D04-3",1,1346,2100,{product:"Inline Patio 25mm RH",unitPrice:"1840.11",totalPrice:"1840.11"}),
  ];
  const inferred=inferQuoteComparisonMappings(supplierItems,[baseline]).mappings;
  assert.deepEqual(inferred.map(mapping=>mapping.canonicalEstimatePositionId),["d04","d04","d04"]);
  assert.equal(inferred.every(mapping=>mapping.relationshipKind==="grouped"),true);
  assert.equal(inferred.every(mapping=>mapping.provenance.mappingAuthority==="automatic_composite_reference_geometry"),true);
  const proposal={id:"adw",supplierName:"ADW",manufacturerName:"VELFAC",scopeKind:"supply_only",currency:"GBP",provenance:{commercialNormalization:{productsSupply:{netAmount:"7915.06"}}},positionMappings:inferred.map((mapping,index)=>({...mapping,id:`m${index}`}))};
  const report=buildQuoteComparisonReport({recordRevision:1,baselineSnapshot:{estimateRef:"EF-EST-2026-057",positions:[{...baseline,customerUnitPrice:"9088.05",supplierName:"Zyle Fenster"}],customerCommercial:{}},proposals:[proposal]});
  const offered=report.positions[0].offers.find(offer=>offer.proposalId==="adw");
  assert.equal(offered.relationship,"grouped");
  assert.equal(offered.quantity,1);
  assert.equal(offered.attributes.measurements,"5384 × 2100 mm");
  assert.equal(offered.commercial.netQuantityCost,7915.06);
  assert.deepEqual(offered.commercial.components.map(component=>component.reference),["D04-1","D04-2","D04-3"]);
});

test("selected-supplier alternatives stay with their required Position and do not create another opening",()=>{
  const required={id:"d02",positionRef:"D02",quantity:1,widthMm:1000,heightMm:2100,product:"Eco Therm+ Door INWARD",configurationDescription:"View from inside, opening inside",customerUnitPrice:"1778.86",supplierName:"Zyle Fenster",classification:"standard"};
  const alternative={id:"d02-alt",positionRef:"D02.",quantity:1,widthMm:1000,heightMm:2100,product:"92 Europa open IN door ALUCLAD",configurationDescription:"View from inside, opening inside",customerUnitPrice:"3701.07",supplierName:"Zyle Fenster",classification:"alternative",classificationEvidence:"Alternative position (not included in total sum of the offer)"};
  const proposal={id:"adw",supplierName:"ADW",manufacturerName:"VELFAC",scopeKind:"supply_only",currency:"GBP",positionMappings:[{...item("D02",1,1000,2100,{product:"VELFAC RIBO Flush Door Open In",unitPrice:"1728.16",totalPrice:"1728.16"}),id:"m1",canonicalEstimatePositionId:"d02",relationshipKind:"exact",differenceStatus:"close_acceptable_alternative",differences:[]}]};
  const report=buildQuoteComparisonReport({recordRevision:1,baselineSnapshot:{estimateRef:"EF-EST-2026-057",positions:[required,alternative],customerCommercial:{}},proposals:[proposal]});
  assert.equal(report.positions.length,1);
  assert.equal(report.positions[0].reference,"D02");
  const selectedAlternative=report.positions[0].offers.find(offer=>offer.reference==="D02.");
  assert.equal(selectedAlternative.isAlternative,true);
  assert.equal(selectedAlternative.quantityCost,3701.07);
  assert.equal(report.positions[0].offers.filter(offer=>offer.proposalId==="adw").length,1);
  assert.doesNotMatch(report.positions[0].offers.find(offer=>offer.proposalId==="adw").compliance.label,/Supporting component/i);
  assert.match(report.positions[0].conclusion,/no corresponding alternative recorded/i);
  assert.match(report.positions[0].conclusion,/not treated as a missing required opening/i);
});
