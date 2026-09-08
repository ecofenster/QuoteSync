import assert from "node:assert/strict";
import test from "node:test";
import { buildQuoteComparisonReport, QUOTE_COMPARISON_EVIDENCE_DISCLAIMER } from "../shared/quoteComparisonReportModel.js";

const mapping=(id,positionId,status,snapshot,relationship="exact")=>({id,canonicalEstimatePositionId:positionId,supplierItemReference:snapshot.customerReference||id,supplierItemSnapshot:snapshot,relationshipKind:relationship,differenceStatus:status,differences:[],provenance:{}});
const proposal=(id,name,total,mappings,extra={})=>({id,supplierName:name,manufacturerName:name,scopeKind:"supply_only",currency:"GBP",originalTotalAmount:String(total),comparableScopeAmount:null,normalizedProjectAmount:null,status:"reviewed",positionMappings:mappings,...extra});

test("position report ranks impartially without giving the baseline brand preference",()=>{
  const comparison={recordRevision:3,baselineSnapshot:{estimateRef:"TEST-EST",positions:[{id:"p1",positionRef:"L",qty:1,widthMm:4400,heightMm:1300,insertion:"Fixed"}]},proposals:[
    proposal("baseline","Zyle Fenster",1200,[mapping("m1","p1","minor_difference",{customerReference:"L",quantity:1,widthMm:4400,heightMm:1300,manufacturerQuotedUw:"0.90",totalPrice:"1200",unitPrice:"1200"})]),
    proposal("competitor","Competitor Better",1100,[mapping("m2","p1","exact_match",{customerReference:"C-L",quantity:1,widthMm:4400,heightMm:1300,manufacturerQuotedUg:"0.50",manufacturerQuotedUw:"0.78",glassSpecification:"Triple glazing",fittingsSpecification:"Fixed",totalPrice:"1100",unitPrice:"1100"})]),
  ]};
  const report=buildQuoteComparisonReport(comparison);
  assert.equal(report.positions.length,1);
  assert.equal(report.positions[0].recommendations[0].supplierName,"Competitor Better");
  assert.equal(report.recommendations[0].supplierName,"Competitor Better");
  assert.match(report.disclaimer,/Missing or unstated information has not been assumed/);
  assert.equal(report.disclaimer,QUOTE_COMPARISON_EVIDENCE_DISCLAIMER);
});

test("position report groups repeated supplier rows into one canonical quantity comparison and retains alternatives",()=>{
  const comparison={recordRevision:1,baselineSnapshot:{positions:[{id:"pH",positionRef:"H",qty:4,widthMm:2900,heightMm:1300,insertion:"Fixed"}]},proposals:[
    proposal("n","Norrsken",4000,[
      mapping("n1","pH","exact_match",{customerReference:"H1",quantity:2,widthMm:2900,heightMm:1300,totalPrice:"1800",unitPrice:"900"},"grouped"),
      mapping("n2","pH","exact_match",{customerReference:"H2",quantity:2,widthMm:2900,heightMm:1300,totalPrice:"1800",unitPrice:"900"},"grouped"),
    ]),
    proposal("a","Alternative Co",3500,[mapping("a1","pH","alternative",{customerReference:"H option",quantity:4,widthMm:2900,heightMm:1300,totalPrice:"3500",unitPrice:"875"},"alternative")]),
  ]};
  const position=buildQuoteComparisonReport(comparison).positions[0];
  assert.equal(position.offers.length,4);
  assert.equal(position.offers[1].quantity,4);
  assert.equal(position.offers[1].quantityCost,3600);
  assert.equal(position.offers[1].assessmentCode,"exact_match");
  assert.match(position.offers[1].explanation,/Grouped supplier rows reconcile/);
  assert.equal(position.offers[2].assessmentCode,"missing");
  assert.equal(position.offers[3].isAlternative,true);
});

test("missing evidence remains not supplied and does not become a negative factual assertion",()=>{
  const comparison={recordRevision:1,baselineSnapshot:{positions:[{id:"p1",positionRef:"1",qty:1,widthMm:1000,heightMm:1000,insertion:"Tilt turn"}]},proposals:[proposal("s","Sparse Supplier",100,[mapping("m","p1","information_not_supplied",{customerReference:"1",quantity:1,widthMm:1000,heightMm:1000,totalPrice:"100"})])]};
  const position=buildQuoteComparisonReport(comparison).positions[0],offer=position.offers[1];
  assert.equal(offer.attributes.glass,"Not supplied");
  assert.equal(offer.attributes.hardware,"Not supplied");
  assert.equal(offer.assessment.label,"Not confirmed");
  assert.match(offer.compliance.reviewItems.join(" "),/Opening function is not confirmed/);
  assert.equal(position.findings.bestUw,null);
  assert.equal(position.findings.bestUg,null);
});

test("Position H compares isolated net supply and applies explicit EcoHaus discount without excluding the baseline by package scope",()=>{
  const baselinePosition={id:"pH",positionRef:"H",qty:4,widthMm:2900,heightMm:1300,insertion:"Fixed",supplierName:"Zyle Fenster",customerUnitPrice:"1069.41",canonicalSpecification:{productFamily:{value:"timber_aluminium_window"},glazing:{value:"Triple glazing"}}};
  const commercialNormalization=(gross,net,discountPercentage=null)=>({commercialNormalization:{version:"comparison-commercial-normalization-v1",currency:"GBP",productsSupply:{grossListAmount:String(gross),netAmount:String(net),discountPercentage:discountPercentage==null?null:String(discountPercentage),discountAmount:discountPercentage==null?null:String(Number(gross)-Number(net)),priceBasis:discountPercentage==null?"quoted_supply_price":"explicit_supplier_discount_applied_for_comparison"}}});
  const comparison={recordRevision:1,baselineSnapshot:{positions:[baselinePosition],customerCommercial:{scopeKind:"supply_only",commercialNormalization:{currency:"GBP",headlineTotal:"4277.64",productsSupply:{grossListAmount:"4277.64",netAmount:"4277.64"}}}},proposals:[
    proposal("norr","Norrsken",83569.73,[mapping("norr-h","pH","exact_match",{customerReference:"Type H",quantity:4,widthMm:2900,heightMm:1300,totalPrice:"4830.68",unitPrice:"1207.67",canonicalSpecification:{productFamily:{value:"timber_aluminium_window"},glazing:{value:"Triple glazing"}}})],{scopeKind:"supply_and_install",provenance:commercialNormalization(58354.73,58354.73)}),
    proposal("eco","EcoHaus",84821.69,[mapping("eco-h","pH","exact_match",{customerReference:"H",quantity:4,widthMm:2900,heightMm:1300,totalPrice:"5819.64",unitPrice:"1454.91",canonicalSpecification:{productFamily:{value:"timber_aluminium_window"},glazing:{value:"Triple glazing"}}})],{scopeKind:"supply_and_install",provenance:commercialNormalization(84404.55,67523.64,20)}),
  ]};
  const report=buildQuoteComparisonReport(comparison),position=report.positions[0],eco=position.offers.find(offer=>offer.supplierName==="EcoHaus");
  assert.equal(position.findings.lowestComparablePrice.supplierName,"Zyle Fenster");
  assert.equal(position.findings.lowestComparablePrice.value,4277.64);
  assert.equal(eco.commercial.grossQuantityCost,5819.64);
  assert.equal(eco.commercial.discountPercentage,20);
  assert.equal(eco.commercial.netQuantityCost,4655.71);
  assert.equal(report.suppliers.find(item=>item.supplierName==="EcoHaus").commercial.netSupply,67523.64);
});

test("material compliance failure cannot be rescued by cheap price or strong thermal value",()=>{
  const baseline={id:"p",positionRef:"P",qty:1,widthMm:1010,heightMm:2440,insertion:"Glazed entrance door",supplierName:"Zyle",customerUnitPrice:"2000",glassSpecification:"Triple glazed entrance door",canonicalSpecification:{productFamily:{value:"timber_aluminium_door"},glazing:{value:"Triple glazed"}}};
  const cheap=mapping("cheap","p","exact_match",{customerReference:"P",quantity:1,widthMm:1010,heightMm:2440,totalPrice:"500",unitPrice:"500",manufacturerQuotedUw:"0.50",product:"Solid panel door",glassSpecification:"Solid",canonicalSpecification:{productFamily:{value:"timber_aluminium_door"},glazing:{value:"Solid panel"}}});
  const report=buildQuoteComparisonReport({recordRevision:1,baselineSnapshot:{positions:[baseline]},proposals:[proposal("cheap","Cheap Solid Door",500,[cheap])]});
  const offer=report.positions[0].offers.find(item=>item.supplierName==="Cheap Solid Door");
  assert.equal(offer.compliance.status,"materially_non_compliant");
  assert.equal(offer.commercial.comparabilityStatus,"not_comparable");
  assert.equal(report.positions[0].recommendations[0].supplierName,"Zyle");
});

test("thermal and solar metrics retain source precision without treating extra decimal places as better performance",()=>{
  const baseline={id:"p1",positionRef:"A",qty:1,widthMm:1000,heightMm:1000,insertion:"Fixed"};
  const first=mapping("a","p1","exact_match",{customerReference:"A",quantity:1,widthMm:1000,heightMm:1000,totalPrice:"100",canonicalSpecification:{glazingUnits:[{solarGainPercent:"0.5"}]}});
  const second=mapping("b","p1","exact_match",{customerReference:"A",quantity:1,widthMm:1000,heightMm:1000,totalPrice:"110",canonicalSpecification:{glazingUnits:[{solarGainPercent:"0.50"}]}});
  const finding=buildQuoteComparisonReport({recordRevision:1,baselineSnapshot:{positions:[baseline]},proposals:[proposal("a","Supplier A",100,[first]),proposal("b","Supplier B",110,[second])]}).positions[0].findings.bestG;
  assert.equal(finding.value,"0.5");
  assert.equal(finding.supplierName,"Supplier A / Supplier B");
  assert.equal(finding.evidence.precision,1);
});

test("opening, safety glazing and applicable hardware are compliance evidence rather than price-only detail",()=>{
  const baseline={id:"p1",positionRef:"D",qty:1,widthMm:1000,heightMm:2100,insertion:"Tilt and turn",customerUnitPrice:"1200",glassSpecification:"Triple toughened glazing",fittingsSpecification:"Concealed hinges · lockable handle"};
  const supplier=mapping("m1","p1","exact_match",{customerReference:"D",quantity:1,widthMm:1000,heightMm:2100,totalPrice:"500",unitPrice:"500",configurationDescription:"Fixed window",glassSpecification:"Triple float glazing",fittingsSpecification:"Exposed hinges · non-locking handle"});
  const position=buildQuoteComparisonReport({recordRevision:1,baselineSnapshot:{positions:[baseline]},proposals:[proposal("p","Low Headline Supplier",500,[supplier])]}).positions[0],offer=position.offers[1];
  assert.equal(offer.compliance.status,"materially_non_compliant");
  assert.match(offer.compliance.materialFailures.join(" "),/Opening function differs/);
  assert.match(offer.compliance.materialFailures.join(" "),/Safety glazing differs/);
  assert.equal(offer.commercial.comparabilityStatus,"not_comparable");
  assert.equal(position.recommendations[0].supplierName,"QuoteSuite Estimate");
});
