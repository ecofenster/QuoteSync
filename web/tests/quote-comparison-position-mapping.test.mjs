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
