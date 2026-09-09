import assert from "node:assert/strict";
import test from "node:test";
import { buildQuoteComparisonReport, QUOTE_COMPARISON_EVIDENCE_DISCLAIMER } from "../shared/quoteComparisonReportModel.js";
import { hydrateLegacyComparisonDrawingEvidence } from "../server/features/quoteComparisons/comparisonDrawingCompatibility.js";

const mapping=(id,positionId,status,snapshot,relationship="exact")=>({id,canonicalEstimatePositionId:positionId,supplierItemReference:snapshot.customerReference||id,supplierItemSnapshot:snapshot,relationshipKind:relationship,differenceStatus:status,differences:[],provenance:{}});
const proposal=(id,name,total,mappings,extra={})=>({id,supplierName:name,manufacturerName:name,scopeKind:"supply_only",currency:"GBP",originalTotalAmount:String(total),comparableScopeAmount:null,normalizedProjectAmount:null,status:"reviewed",positionMappings:mappings,...extra});

test("position report ranks impartially without giving the baseline brand preference",()=>{
  const comparison={recordRevision:3,baselineSnapshot:{estimateRef:"TEST-EST",positions:[{id:"p1",positionRef:"L",qty:1,widthMm:4400,heightMm:1300,insertion:"Fixed"}]},proposals:[
    proposal("baseline","Zyle Fenster",1200,[mapping("m1","p1","minor_difference",{customerReference:"L",quantity:1,widthMm:4400,heightMm:1300,manufacturerQuotedUw:"0.90",fittingsSpecification:"Fixed",totalPrice:"1200",unitPrice:"1200"})]),
    proposal("competitor","Competitor Better",1100,[mapping("m2","p1","exact_match",{customerReference:"C-L",quantity:1,widthMm:4400,heightMm:1300,manufacturerQuotedUg:"0.50",manufacturerQuotedUw:"0.78",glassSpecification:"Triple glazing",fittingsSpecification:"Fixed",totalPrice:"1100",unitPrice:"1100"})]),
  ]};
  const report=buildQuoteComparisonReport(comparison);
  assert.equal(report.positions.length,1);
  assert.equal(report.positions[0].recommendations[0].supplierName,"Competitor Better");
  assert.deepEqual(report.recommendations,[]);
  assert.match(report.recommendationMessage,/like-for-like net Products \/ Supply totals/);
  assert.match(report.disclaimer,/Missing or unstated information has not been assumed/);
  assert.equal(report.disclaimer,QUOTE_COMPARISON_EVIDENCE_DISCLAIMER);
});

test("position report groups repeated supplier rows into one canonical quantity comparison and retains alternatives",()=>{
  const comparison={recordRevision:1,baselineSnapshot:{positions:[{id:"pH",positionRef:"H",qty:4,widthMm:2900,heightMm:1300,insertion:"Fixed"}]},proposals:[
    proposal("n","Norrsken",4000,[
      mapping("n1","pH","exact_match",{customerReference:"H1",quantity:2,widthMm:2900,heightMm:1300,fittingsSpecification:"Fixed",totalPrice:"1800",unitPrice:"900"},"grouped"),
      mapping("n2","pH","exact_match",{customerReference:"H2",quantity:2,widthMm:2900,heightMm:1300,fittingsSpecification:"Fixed",totalPrice:"1800",unitPrice:"900"},"grouped"),
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

test("position report exposes only supplier-owned reliable drawings, including grouped constituents and alternatives",()=>{
  const visual=(token,page,extra={})=>({status:"available",url:`/api/manufacturer-position-visuals/${token}/quotation.png`,role:"combined_source",sourcePage:page,mappingMethod:"deterministic_position_region",mappingReviewStatus:"mapped_automatic",...extra});
  const comparison={recordRevision:1,baselineSnapshot:{positions:[{id:"pM",positionRef:"M",qty:1,widthMm:2400,heightMm:2100,insertion:"Coupled window",supplierName:"Zyle Fenster",sourceAttachmentId:"zyle-source",sourceVisual:visual("aaaaaaaa",1)}]},proposals:[
    proposal("nord","Nordvest",2200,[
      mapping("nord-main","pM","exact_match",{customerReference:"Style M",sourceAttachmentId:"nordvest-source",quantity:1,widthMm:2400,heightMm:2100,totalPrice:"2100",sourceVisual:visual("bbbbbbbb",4)},"grouped"),
      mapping("nord-extra","pM","minor_difference",{customerReference:"Style M extra piece",sourceAttachmentId:"nordvest-source",componentRole:"coupling_profile",quantity:1,totalPrice:"100",sourceVisual:visual("cccccccc",5)},"grouped"),
    ]),
    proposal("norr","Norrsken",1900,[mapping("norr-option","pM","alternative",{customerReference:"Option Type M",sourceAttachmentId:"norrsken-source",classification:"alternative",alternativeTo:"Type M",quantity:1,widthMm:2400,heightMm:2100,totalPrice:"1900",sourceVisual:visual("dddddddd",8)},"alternative")]),
    proposal("eco","EcoHaus",2300,[mapping("eco-main","pM","exact_match",{customerReference:"M",sourceAttachmentId:"ecohaus-source",quantity:1,widthMm:2400,heightMm:2100,totalPrice:"2300",sourceVisual:visual("eeeeeeee",12,{mappingReviewStatus:"needs_review",reason:"Position ownership requires review."})})]),
  ]};
  const offers=buildQuoteComparisonReport(comparison).positions[0].offers;
  const baseline=offers.find(item=>item.supplierName==="Zyle Fenster");
  const nordvest=offers.find(item=>item.supplierName==="Nordvest");
  const alternative=offers.find(item=>item.supplierName==="Norrsken"&&item.isAlternative);
  const ecohaus=offers.find(item=>item.supplierName==="EcoHaus");
  assert.deepEqual(baseline.drawings.map(item=>[item.status,item.sourceAttachmentId,item.sourceReference]),[["available","zyle-source","M"]]);
  assert.deepEqual(nordvest.drawings.map(item=>[item.status,item.sourceAttachmentId,item.sourceReference]),[["available","nordvest-source","Style M"],["available","nordvest-source","Style M extra piece"]]);
  assert.deepEqual(alternative.drawings.map(item=>[item.status,item.sourceAttachmentId,item.isAlternative]),[["available","norrsken-source",true]]);
  assert.deepEqual(ecohaus.drawings.map(item=>[item.status,item.url,item.sourceAttachmentId]),[["unavailable",null,"ecohaus-source"]]);
  assert.equal(JSON.stringify(nordvest.drawings).includes("norrsken-source"),false,"a grouped supplier solution cannot borrow another supplier's drawing");
});

test("supplier drawing captions keep a duplicated quoted price separate from the Position reference",()=>{
  const visual={status:"available",url:"/api/manufacturer-position-visuals/abababababababababababababababababababab/quotation.png",role:"position_drawing",sourcePage:1,mappingMethod:"frame-schedule-position-drawing-v1",mappingReviewStatus:"mapped_automatic"};
  const comparison={recordRevision:1,baselineSnapshot:{positions:[{id:"pW01",positionRef:"W01",qty:1,widthMm:1109,heightMm:1600,insertion:"Guided casement"}]},proposals:[
    proposal("adw","ADW Quotation",1015.5,[mapping("adw-w01","pW01","exact_match",{customerReference:"W01 £1,015.50",quantity:1,widthMm:1109,heightMm:1600,unitPrice:"1015.50",totalPrice:"1015.50",sourceVisual:visual})]),
  ]};
  const offer=buildQuoteComparisonReport(comparison).positions[0].offers.find(item=>item.supplierName==="ADW Quotation");
  assert.equal(offer.reference,"W01");
  assert.equal(offer.drawings[0].sourceReference,"W01");
  assert.equal(offer.itemCost,1015.5);
  assert.equal(offer.quantityCost,1015.5);
});

test("unsafe or missing visual URLs remain Image unavailable evidence",()=>{
  const comparison={recordRevision:1,baselineSnapshot:{positions:[{id:"p1",positionRef:"A",qty:1,widthMm:1000,heightMm:1000,insertion:"Fixed"}]},proposals:[proposal("s","Supplier",100,[mapping("m","p1","exact_match",{customerReference:"A",quantity:1,widthMm:1000,heightMm:1000,totalPrice:"100",sourceVisual:{status:"available",url:"https://untrusted.invalid/invented.png",mappingReviewStatus:"mapped_automatic"}})])]};
  const drawings=buildQuoteComparisonReport(comparison).positions[0].offers.flatMap(offer=>offer.drawings);
  assert.ok(drawings.every(item=>item.status==="unavailable"));
  assert.ok(drawings.every(item=>item.url===null));
});

test("legacy comparison snapshots recover only exact source-owned drawing evidence without changing frozen evidence",async()=>{
  const visual=(token)=>({status:"available",url:`/api/manufacturer-position-visuals/${token}/quotation.png`,mappingReviewStatus:"mapped_automatic",mappingMethod:"deterministic_source_owner"});
  const frozen={id:"comparison-old",baselineEstimateId:"estimate-1",status:"approved",recordRevision:7,approvedAt:"2026-09-01T12:00:00.000Z",baselineSnapshot:{customerCommercial:{scenarioId:"scenario-1",customerSellingExVatGbp:"5000.00"},positions:[{id:"pD",positionRef:"D",qty:1,widthMm:1000,heightMm:1200,customerUnitPrice:"500.00"}]},proposals:[{id:"proposal-norr",supplierName:"Norrsken",currency:"GBP",documents:[{supplierAttachmentId:"attachment-norr",supplierRevisionId:"revision-norr",supplierQuoteId:"quote-norr",sourceSnapshot:{sha256:"source-hash"}}],positionMappings:[{id:"map-d",canonicalEstimatePositionId:"pD",supplierItemReference:"Type D",supplierItemSnapshot:{customerReference:"Type D",totalPrice:"450.00"},relationshipKind:"exact",differenceStatus:"exact_match",differences:[],provenance:{rowKey:"attachment-norr:4"}}]}]};
  const db={all:async(sql)=>sql.includes("project_calculator_estimate_product_rows")?[{estimate_position_id:"pD",source_position_id:"source-position-d",source_attachment_id:"attachment-zyle",source_revision_id:"revision-zyle",source_snapshot_json:JSON.stringify({manufacturerEvidence:{sourceVisual:visual("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")}})}]:[]};
  const recovered=await hydrateLegacyComparisonDrawingEvidence(db,frozen,{analyseAttachment:async()=>new Map([["attachment-norr:4",{sourceVisuals:[],sourceVisual:visual("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),sourceAttachmentId:"attachment-norr",sourceRevisionId:"revision-norr",sourceRowKey:"attachment-norr:4"}]])});
  assert.equal(frozen.baselineSnapshot.positions[0].sourceVisual,undefined,"compatibility must not mutate the frozen input record");
  assert.equal(frozen.proposals[0].positionMappings[0].supplierItemSnapshot.sourceVisual,undefined);
  assert.equal(recovered.status,"approved");assert.equal(recovered.recordRevision,7);assert.equal(recovered.approvedAt,frozen.approvedAt);
  assert.equal(recovered.baselineSnapshot.customerCommercial.customerSellingExVatGbp,"5000.00");
  assert.equal(recovered.proposals[0].positionMappings[0].supplierItemSnapshot.totalPrice,"450.00");
  const offers=buildQuoteComparisonReport(recovered).positions[0].offers;
  assert.deepEqual(offers.map(offer=>[offer.supplierName,offer.drawings[0].status,offer.drawings[0].sourceAttachmentId]),[["QuoteSuite Estimate","available","attachment-zyle"],["Norrsken","available","attachment-norr"]]);
});

test("legacy comparison presentation may refine a generic source row to a contained source-owned drawing crop",async()=>{
  const attachmentId="adw-source",page=1;
  const frozenVisual={status:"available",url:"/api/manufacturer-position-visuals/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/quotation.png",role:"combined_source",sourceFormat:"pdf",sourcePage:page,mappingMethod:"pdf_position_region_geometry",mappingReviewStatus:"mapped_automatic",boundingRegion:{x:28,y:348,width:536,height:139},originalAsset:{attachmentId,sourcePage:page,boundingRegion:{x:28,y:348,width:536,height:139}}};
  const recoveredVisual={status:"available",url:"/api/manufacturer-position-visuals/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/quotation.png",role:"position_drawing",sourceFormat:"pdf",sourcePage:page,mappingMethod:"frame-schedule-position-drawing-v1",mappingReviewStatus:"mapped_automatic",boundingRegion:{x:35,y:356,width:82,height:113},originalAsset:{attachmentId,sourcePage:page,boundingRegion:{x:35,y:356,width:82,height:113}}};
  const frozen={id:"comparison-adw",baselineEstimateId:"estimate-1",baselineSnapshot:{positions:[{id:"pW01",positionRef:"W01",qty:1,widthMm:1109,heightMm:1600}]},proposals:[{id:"proposal-adw",supplierName:"ADW Quotation",documents:[{supplierAttachmentId:attachmentId,supplierRevisionId:"revision-adw",supplierQuoteId:"quote-adw",sourceSnapshot:{}}],positionMappings:[{id:"mapping-w01",canonicalEstimatePositionId:"pW01",supplierItemReference:"W01 £1,015.50",supplierItemSnapshot:{customerReference:"W01 £1,015.50",unitPrice:"1015.50",totalPrice:"1015.50",sourceVisual:frozenVisual},relationshipKind:"exact",differenceStatus:"exact_match",differences:[],provenance:{rowKey:`${attachmentId}:1`}}]}]};
  const db={all:async()=>[]};
  const recovered=await hydrateLegacyComparisonDrawingEvidence(db,frozen,{analyseAttachment:async()=>new Map([[`${attachmentId}:1`,{sourceVisual:recoveredVisual,sourceVisuals:[recoveredVisual],sourceAttachmentId:attachmentId,sourceRevisionId:"revision-adw",sourceRowKey:`${attachmentId}:1`} ]])});
  assert.equal(frozen.proposals[0].positionMappings[0].supplierItemSnapshot.sourceVisual.mappingMethod,"pdf_position_region_geometry");
  const projected=recovered.proposals[0].positionMappings[0].supplierItemSnapshot.sourceVisual;
  assert.equal(projected.mappingMethod,"frame-schedule-position-drawing-v1");
  assert.equal(projected.originalAsset.attachmentId,attachmentId);
  assert.deepEqual(projected.boundingRegion,{x:35,y:356,width:82,height:113});
});

test("legacy drawing recovery cannot cross a retained proposal source row key",async()=>{
  const frozen={id:"comparison-old",baselineEstimateId:"estimate-1",baselineSnapshot:{positions:[{id:"pD",positionRef:"D"}]},proposals:[{id:"proposal",supplierName:"Supplier",documents:[{supplierAttachmentId:"source-a",supplierRevisionId:"revision-a",supplierQuoteId:"quote-a",sourceSnapshot:{}}],positionMappings:[{id:"mapping",canonicalEstimatePositionId:"pD",supplierItemReference:"D",supplierItemSnapshot:{customerReference:"D",totalPrice:"100"},relationshipKind:"exact",differenceStatus:"exact_match",differences:[],provenance:{rowKey:"source-b:4"}}]}]};
  const db={all:async()=>[]};
  const recovered=await hydrateLegacyComparisonDrawingEvidence(db,frozen,{analyseAttachment:async()=>new Map([["source-a:4",{sourceVisual:{status:"available",url:"/api/manufacturer-position-visuals/cccccccccccccccccccccccccccccccccccccccc/quotation.png",mappingReviewStatus:"mapped_automatic"},sourceAttachmentId:"source-a"}]])});
  assert.equal(recovered.proposals[0].positionMappings[0].supplierItemSnapshot.sourceVisual,undefined);
  assert.equal(buildQuoteComparisonReport(recovered).positions[0].offers[1].drawings[0].status,"unavailable");
});

test("legacy baseline recovery retains explicit glass-unit trace evidence without changing the frozen snapshot",async()=>{
  const frozen={id:"comparison-g",baselineEstimateId:"estimate-1",baselineSnapshot:{customerCommercial:{scenarioId:"scenario-1"},positions:[{id:"pG",positionRef:"G",glassSpecification:null,fittingsSpecification:"SIEGENIA HS SKY"}]},proposals:[]};
  const trace=[
    {attachmentId:"zyle-docx",blockId:"docx-block-149",extractedText:"5. Glass unit:"},
    {attachmentId:"zyle-docx",blockId:"docx-block-150",extractedText:"#1: 4TGH LowE/18Ar/4/18Ar/4TGH LowE (Ug=0.53)"},
    {attachmentId:"zyle-docx",blockId:"docx-block-151",extractedText:"#2: 4TGH LowE/18Ar/4/16Ar/4TGH LowE (Ug=0.55)"},
    {attachmentId:"zyle-docx",blockId:"docx-block-157",extractedText:"11. Lockable handle internally; recessed handle externally"},
  ];
  const db={all:async(sql)=>sql.includes("project_calculator_estimate_product_rows")
    ?[{estimate_position_id:"pG",source_position_id:"source-g",source_attachment_id:"zyle-docx",source_revision_id:"revision-5",source_snapshot_json:"{}"}]
    :sql.includes("supplier_quote_positions")?[{id:"source-g",revision_id:"revision-5",trace_json:JSON.stringify(trace),original_specification_text:""}]:[]};
  const recovered=await hydrateLegacyComparisonDrawingEvidence(db,frozen);
  const position=recovered.baselineSnapshot.positions[0];
  assert.equal(frozen.baselineSnapshot.positions[0].glassSpecification,null);
  assert.match(position.glassSpecification,/#1: 4TGH LowE\/18Ar\/4\/18Ar\/4TGH LowE/);
  assert.match(position.glassSpecification,/#2: 4TGH LowE\/18Ar\/4\/16Ar\/4TGH LowE/);
  assert.equal(position.sourceSpecification.version,"retained-supplier-position-trace-v1");
  assert.match(position.fittingsSpecification,/SIEGENIA HS SKY.*Lockable handle internally; recessed handle externally/);
});

test("shared report v2 carries printable comparison context and retained source references",()=>{
  const comparison={id:"comparison-1",clientId:"client-1",projectId:"project-1",baselineEstimateId:"estimate-1",name:"Tender comparison",status:"draft_review_required",recordRevision:3,baselineSnapshot:{estimateRef:"EF-EST-2026-055",revisionNo:0,technicalSourceEvidence:[{attachmentId:"zyle-source",fileName:"343829-5_Nick Corlett.docx",supplierName:"Zyle Fenster",revisionId:"zyle-r5",quotationNumber:"343829",quotationRevision:"5",quotationDate:"2026-06-18"}],positions:[{id:"p1",positionRef:"A",qty:1,widthMm:1000,heightMm:1000,sourceVisual:{status:"available",url:"/api/manufacturer-position-visuals/aaaaaaaa/quotation.png",mappingReviewStatus:"mapped_automatic"}}]},proposals:[{...proposal("nord","Nordvest",100,[mapping("m","p1","exact_match",{customerReference:"Style A",quantity:1,widthMm:1000,heightMm:1000,totalPrice:"100"})]),quotationNumber:"99896",quotationRevision:"1",quotationDate:"2026-02-24",documents:[{supplierAttachmentId:"nord-source",documentRole:"commercial",fileName:"Nordvest.pdf"}]}]};
  const report=buildQuoteComparisonReport(comparison);
  assert.equal(report.version,"quote-comparison-position-report-v2");
  assert.deepEqual(report.context,{comparisonId:"comparison-1",name:"Tender comparison",description:null,status:"draft_review_required",clientId:"client-1",projectId:"project-1",projectName:null,baselineEstimateId:"estimate-1",baselineEstimateRef:"EF-EST-2026-055",baselineRevision:0});
  assert.deepEqual(report.sourceReferences.map(item=>[item.ownerKind,item.supplierName,item.fileName,item.quotationNumber,item.quotationRevision,item.quotationDate]),[["baseline","Zyle Fenster","343829-5_Nick Corlett.docx","343829","5","2026-06-18"],["competitor","Nordvest","Nordvest.pdf","99896","1","2026-02-24"]]);
});

test("missing evidence remains not supplied and does not become a negative factual assertion",()=>{
  const comparison={recordRevision:1,baselineSnapshot:{positions:[{id:"p1",positionRef:"1",qty:1,widthMm:1000,heightMm:1000,insertion:"Tilt turn"}]},proposals:[proposal("s","Sparse Supplier",100,[mapping("m","p1","information_not_supplied",{customerReference:"1",quantity:1,widthMm:1000,heightMm:1000,totalPrice:"100"})])]};
  const position=buildQuoteComparisonReport(comparison).positions[0],offer=position.offers[1];
  assert.equal(offer.attributes.glass,"Not supplied");
  assert.equal(offer.attributes.hardware,"Not supplied");
  assert.equal(offer.assessment.label,"Not confirmed");
  assert.match(offer.compliance.reviewItems.join(" "),/Opening direction is not confirmed/);
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

test("thermal and solar metrics retain source precision without turning G into a ranked advantage",()=>{
  const baseline={id:"p1",positionRef:"A",qty:1,widthMm:1000,heightMm:1000,insertion:"Fixed"};
  const first=mapping("a","p1","exact_match",{customerReference:"A",quantity:1,widthMm:1000,heightMm:1000,totalPrice:"100",canonicalSpecification:{glazingUnits:[{solarGainPercent:"0.5"}]}});
  const second=mapping("b","p1","exact_match",{customerReference:"A",quantity:1,widthMm:1000,heightMm:1000,totalPrice:"110",canonicalSpecification:{glazingUnits:[{solarGainPercent:"0.50"}]}});
  const findings=buildQuoteComparisonReport({recordRevision:1,baselineSnapshot:{positions:[baseline]},proposals:[proposal("a","Supplier A",100,[first]),proposal("b","Supplier B",110,[second])]}).positions[0].findings;
  assert.equal(findings.bestG,null);
  assert.deepEqual(findings.gValues.map(item=>[item.supplierName,item.value,item.evidence.precision]),[["Supplier A","0.5",1],["Supplier B","0.50",2]]);
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

test("existing-style lift-and-slide evidence overrides a stale entrance-door mapping diagnosis",()=>{
  const baseline={id:"g",positionRef:"G",qty:1,widthMm:2600,heightMm:2500,product:"Lift & Slide Door ALUCLAD SKY 92 mm.",configurationDescription:"View from inside",manufacturerQuotedUg:"0.53",manufacturerQuotedUw:"0.80",customerUnitPrice:"4521.55",supplierName:"Zyle Fenster"};
  const stale=mapping("g-norr","g","configuration_mismatch",{customerReference:"Type G",quantity:1,widthMm:2600,heightMm:2500,product:"S319A sliding door",configurationDescription:"Right pane slides to the left",manufacturerQuotedUg:"0.521",manufacturerQuotedUw:"0.81",unitPrice:"4227.09",totalPrice:"4227.09"});
  stale.differences=[{field:"configuration",baseline:"entrance_door",supplier:"sliding_door"}];
  const position=buildQuoteComparisonReport({recordRevision:1,baselineSnapshot:{positions:[baseline],customerCommercial:{}},proposals:[proposal("norr","Norrsken",4227.09,[stale])]}).positions[0];
  const norrsken=position.offers[1];
  assert.equal(position.offers[0].attributes.operation,"lift-and-slide");
  assert.equal(norrsken.attributes.operation,"lift-and-slide");
  assert.equal(norrsken.compliance.materialFailures.some(item=>/opening function/i.test(item)),false);
  assert.match(position.report,/Norrsken compared with Zyle Fenster.*Matches Zyle Fenster:.*opening operation.*Source Type G/i);
});

test("outward-opening reference evidence is not confused with viewing direction and softwood accepts evidenced pine",()=>{
  const baseline={id:"a",positionRef:"A",qty:1,widthMm:1000,heightMm:660,product:"Casement window",configurationDescription:"View from outside, opening outside",canonicalSpecification:{material:{value:"Softwood"}}};
  const norr=mapping("a-norr","a","exact_match",{customerReference:"Type A",quantity:1,widthMm:1000,heightMm:660,product:"Fixed window",configurationDescription:"View from outside",canonicalSpecification:{material:{value:"Engineered Pine"}}});
  const position=buildQuoteComparisonReport({recordRevision:1,baselineSnapshot:{positions:[baseline]},proposals:[proposal("norr","Norrsken",100,[norr])]}).positions[0],reference=position.offers[0],offer=position.offers[1];
  assert.equal(reference.attributes.operation,"outward opening");
  assert.equal(offer.attributes.operation,"fixed");
  assert.match(offer.referenceAssessment.differences.join(" "),/Opening operation: fixed offered; outward opening referenced/);
  assert.doesNotMatch(offer.referenceAssessment.differences.join(" "),/Material\/timber/);
  assert.match(offer.referenceAssessment.matches.join(" "),/Engineered Pine is compatible with the Softwood reference/);
  assert.deepEqual(reference.referenceAssessment.matches,[]);
  assert.match(reference.referenceAssessment.verificationNotes.join(" "),/not been independently verified/);
});

test("quantity disagreement remains a clarification and invalid Ug zero cannot win",()=>{
  const baseline={id:"p",positionRef:"P",qty:1,widthMm:1010,heightMm:2440,product:"92 Europa open IN door ALUCLAD",configurationDescription:"View from inside, opening inside",glassSpecification:"6 tough / 18Ar / 4 / 18Ar / 4",manufacturerQuotedUg:"0.53",manufacturerQuotedUw:"0.81",customerUnitPrice:"1576.26",supplierName:"Zyle Fenster"};
  const norr=mapping("p-norr","p","quantity_mismatch",{customerReference:"Type P",quantity:2,widthMm:1010,heightMm:2440,product:"S305A panel inward opening door",configurationDescription:"Hinges on the left",glassSpecification:"Solid",manufacturerQuotedUg:"0",manufacturerQuotedUw:"0.76",unitPrice:"2460.55",totalPrice:"4921.10"});
  norr.differences=[{field:"quantity",baseline:1,supplier:2}];
  const eco=mapping("p-eco","p","quantity_mismatch",{customerReference:"P",quantity:2,widthMm:1010,heightMm:2440,product:"HF410 door",configurationDescription:"Turn door · Right",manufacturerQuotedUg:"0.5",unitPrice:"2694.05",totalPrice:"5388.10"});
  eco.differences=[{field:"quantity",baseline:1,supplier:2}];
  const report=buildQuoteComparisonReport({recordRevision:1,baselineSnapshot:{positions:[baseline],customerCommercial:{}},proposals:[proposal("norr","Norrsken",4921.10,[norr]),proposal("eco","EcoHaus",5388.10,[eco])]});
  const position=report.positions[0],norrOffer=position.offers.find(offer=>offer.supplierName==="Norrsken");
  assert.equal(norrOffer.attributes.thermalEvidence.ug.status,"not_applicable");
  assert.equal(norrOffer.attributes.thermalEvidence.ug.value,null);
  assert.equal(norrOffer.attributes.thermalEvidence.uw.meaning,"whole_door_ud");
  assert.match(norrOffer.compliance.materialFailures.join(" "),/Glazing\/configuration compromise: solid offered; triple required/);
  assert.equal(position.findings.bestUg.supplierName,"EcoHaus");
  assert.equal(position.findings.bestUg.value,"0.5");
  assert.equal(position.findings.lowestComparablePrice,null);
  assert.equal(position.recommendationStatus,"review_required");
  assert.deepEqual(position.recommendations,[]);
  assert.match(position.report,/reference includes 1.*Norrsken \(Type P\) includes 2.*EcoHaus \(P\) includes 2/i);
  assert.match(position.report,/reference omission or competitor excess/i);
  assert.match(norrOffer.commercial.comparabilityReason,/Not like-for-like.*reference quantity is 1.*offer prices 2/i);
  assert.equal(report.recommendationStatus,"review_required");
  assert.deepEqual(report.recommendations,[]);
  assert.match(position.conclusion,/reference includes 1.*Norrsken \(Type P\) includes 2.*EcoHaus \(P\) includes 2/i);
  assert.match(report.customerPresentation.conclusion,/No overall priority order is stated/i);
  assert.ok(report.customerPresentation.questions.some(item=>item.supplierName==="Norrsken"&&/Which quantity is required/i.test(item.question)));
  assert.ok(report.customerPresentation.interpretationNotes.some(item=>/Uw describes the whole window/i.test(item)));
  assert.doesNotMatch(JSON.stringify(report.customerPresentation),/best value|top 3/i);
});

test("HF410 system Uw remains a standard-size value with page provenance and cannot cross systems",()=>{
  const baseline={id:"a",positionRef:"A",qty:1,widthMm:1000,heightMm:660,product:"Casement window",configurationDescription:"Turn/tilt",glassSpecification:"Triple toughened"};
  const inherited={
    system:{value:"HF410",sourcePage:2},
    productFamily:{value:"timber_aluminium_window",sourcePage:2},
    systemThermalPerformance:{value:"0.71",basis:"system_standard_size",standard:"EN ISO 12567 / EN ISO 10077",standardSizeMm:{width:1230,height:1480},qualification:"Uw for the standard 1230 × 1480 mm test window.",sourcePage:2},
    glazing:{value:"Triple glazing 4b/18Ar/4/18Ar/b4",sourcePage:2},
  };
  const hf=mapping("hf","a","exact_match",{customerReference:"A",quantity:1,widthMm:1000,heightMm:660,product:"HF410",configurationDescription:"Turn/tilt Right",glassSpecification:"Triple glazing 4b/18Ar/4/18Ar/b4",sourceSpecification:{sections:[{role:"system_default",systemCode:"HF410",fields:[{id:"hf-system-uw",label:"Heat insulation",value:"0.71",sourcePage:2,inheritedFromSystem:true}]}],inheritance:{system:"HF410",sourcePage:2}},canonicalSpecification:inherited,totalPrice:"100"});
  const kf=mapping("kf","a","exact_match",{customerReference:"A2",quantity:1,widthMm:1000,heightMm:660,product:"KF410",configurationDescription:"Turn/tilt Right",sourceSpecification:{sections:[{role:"system_default",systemCode:"KF410",fields:[{id:"kf-system-uw",label:"Heat insulation",value:"0.69",sourcePage:3,inheritedFromSystem:true}]}],inheritance:{system:"KF410",sourcePage:3}},canonicalSpecification:{system:{value:"KF410",sourcePage:3},productFamily:{value:"upvc_aluminium_window",sourcePage:3},systemThermalPerformance:{value:"0.69",basis:"system_standard_size",standardSizeMm:{width:1230,height:1480},sourcePage:3}},totalPrice:"90"});
  const position=buildQuoteComparisonReport({recordRevision:1,baselineSnapshot:{positions:[baseline]},proposals:[proposal("eco","EcoHaus",190,[hf,kf])]}).positions[0];
  const offer=position.offers.find(item=>item.supplierName==="EcoHaus");
  assert.equal(offer.attributes.thermalEvidence.uw.value,null,"a grouped multi-system solution must not inherit one system's default as its Position value");
  assert.deepEqual(offer.attributes.systemEvidence.map(item=>item.system).sort(),["HF410","KF410"]);
  const hfEvidence=offer.attributes.systemEvidence.find(item=>item.system==="HF410").systemThermal;
  assert.equal(hfEvidence.value,0.71);
  assert.equal(hfEvidence.valueKind,"system_standard");
  assert.deepEqual(hfEvidence.standardSizeMm,{width:1230,height:1480});
  assert.equal(hfEvidence.sourcePage,2);
  assert.match(hfEvidence.qualification,/standard 1230 × 1480 mm/i);
});

test("position-specific Uw overrides a system default and all-float glazing does not match toughened safety glass",()=>{
  const baseline={id:"a",positionRef:"A",qty:1,widthMm:1000,heightMm:660,configurationDescription:"Turn/tilt",glassSpecification:"Triple toughened glazing",manufacturerQuotedUw:"0.82"};
  const supplier=mapping("norr","a","exact_match",{customerReference:"Type A",quantity:1,widthMm:1000,heightMm:660,configurationDescription:"Fixed",glassSpecification:"Triple: from inside 4 fl/4 fl/4 fl",manufacturerQuotedUw:"0.9",canonicalSpecification:{productSystem:{value:"Norrsken system"},systemThermalPerformance:{value:"0.70",basis:"system_standard_size",standardSizeMm:{width:1230,height:1480}}},totalPrice:"100"});
  const offer=buildQuoteComparisonReport({recordRevision:1,baselineSnapshot:{positions:[baseline]},proposals:[proposal("norr","Norrsken",100,[supplier])]}).positions[0].offers[1];
  assert.equal(offer.attributes.thermalEvidence.uw.value,0.9);
  assert.equal(offer.attributes.thermalEvidence.uw.raw,"0.9");
  assert.equal(offer.attributes.thermalEvidence.uw.precision,1);
  assert.equal(offer.attributes.thermalEvidence.uw.valueKind,"actual_position");
  assert.match(offer.referenceAssessment.differences.join(" "),/Glazing build-up:.*4 fl\/4 fl\/4 fl.*Triple toughened glazing/i);
});

test("coupling-only evidence remains in a grouped solution but is ineligible as a complete-position price",()=>{
  const baseline={id:"na",positionRef:"N (A)",qty:1,widthMm:100,heightMm:2200,product:"Coupling requirement"};
  const coupling=mapping("eco-coupler","na","exact_match",{customerReference:"N couplers",quantity:2,componentRole:"coupling_profile",product:"HF410 coupling profile",unitPrice:"18.57",totalPrice:"37.14"},"grouped");
  const offer=buildQuoteComparisonReport({recordRevision:1,baselineSnapshot:{positions:[baseline]},proposals:[proposal("eco","EcoHaus",37.14,[coupling])]}).positions[0].offers[1];
  assert.equal(offer.completePositionPriceEligible,false);
  assert.equal(offer.quantityCost,null);
  assert.equal(offer.commercial.supportingComponentCost,37.14);
  assert.equal(offer.commercial.supportingComponents[0].role,"coupling_profile");
  assert.match(offer.referenceAssessment.differences.join(" "),/supporting coupling hardware\/profile only/i);
});

test("annual heat-loss comparison applies quantity once and preserves rounded-value uncertainty",()=>{
  const baseline={id:"h",positionRef:"H",qty:2,widthMm:1000,heightMm:2000,product:"Timber aluminium fixed window",configurationDescription:"Fixed",manufacturerQuotedUw:"0.80",customerUnitPrice:"1000",supplierName:"Zyle Fenster",canonicalSpecification:{productFamily:{value:"timber_aluminium_window"},material:{value:"Softwood"}}};
  const candidate=mapping("norr-h","h","exact_match",{customerReference:"Type H",quantity:2,widthMm:1000,heightMm:2000,product:"Timber aluminium fixed window",configurationDescription:"Fixed",manufacturerQuotedUw:"0.90",unitPrice:"900",totalPrice:"1800",canonicalSpecification:{productFamily:{value:"timber_aluminium_window"},material:{value:"Engineered Pine"}}});
  const report=buildQuoteComparisonReport({recordRevision:1,baselineSnapshot:{positions:[baseline]},proposals:[proposal("norr","Norrsken",1800,[candidate])]});
  const offer=report.positions[0].offers[1];
  assert.equal(offer.annualHeatLoss.equivalentAreaM2,4,"2 m² per element × quantity 2 must be applied once");
  assert.equal(Math.round(offer.annualHeatLoss.deltaKwh),24,"0.10 × 4 m² × 2,500 K·days × 24 / 1000");
  assert.match(offer.annualHeatLoss.display,/Approximately 24 kWh more heat lost per year than Zyle Fenster, using the quoted central Uw values/);
  assert.match(offer.annualHeatLoss.display,/estimated range is 21\.6–26\.4 kWh more/i);
  assert.match(report.thermalMethodology.formula,/offer whole-element U.*equivalent total element area.*heating degree-days.*24 \/ 1000/i);
  assert.match(report.thermalMethodology.label,/Illustrative assumption: 2,500 K·days\/year/);
  assert.match(report.thermalMethodology.qualification,/not delivered energy consumption.*Solar gains and air leakage are excluded.*Ug is not added/i);
});

test("Position G uses full supplier glass evidence and explains the bounded price and thermal trade-off",()=>{
  const baseline={id:"g",positionRef:"G",qty:1,widthMm:2600,heightMm:2500,product:"Lift & Slide Door ALUCLAD SKY 92 mm.",configurationDescription:"View from inside",glassSpecification:"#1: 4TGH LowE/18Ar/4/18Ar/4TGH LowE; #2: 4TGH LowE/18Ar/4/16Ar/4TGH LowE",fittingsSpecification:"SIEGENIA HS SKY · Lockable handle internally; recessed handle externally",manufacturerQuotedUg:"0.53",manufacturerQuotedUw:"0.80",customerUnitPrice:"4521.55",supplierName:"Zyle Fenster",canonicalSpecification:{material:{value:"Softwood"},internalFinish:{value:"Lacquer 3.1"},externalFinish:{value:"RAL 7021"},aluminiumCladding:{value:"Aluminium clad"}}};
  const norr=mapping("g-norr","g","configuration_mismatch",{customerReference:"Type G",quantity:1,widthMm:2600,heightMm:2500,product:"S319A sliding door",configurationDescription:"Right pane slides to the left (viewed externally). Handle and lock inside, finger plate outside.",glassSpecification:"LowE",fittingsSpecification:"Roto Line – Satin",manufacturerQuotedUg:"0.521",manufacturerQuotedUw:"0.81",unitPrice:"4227.09",totalPrice:"4227.09",canonicalSpecification:{material:{value:"Engineered Pine"},aluminiumCladding:{value:"Aluminium clad triple: from inside 4 tuf/4 tuf/6.8 lam – 2 panes"},internalFinish:{value:"Clear stain"},externalFinish:{value:"RAL 7021 Black Grey Matt"}}});
  const eco=mapping("g-eco","g","configuration_mismatch",{customerReference:"G",quantity:1,widthMm:2600,heightMm:2500,product:"HS330 lift-sliding door",configurationDescription:"Lift-slide Right",glassSpecification:"Triple 54mm coated clear glass 6btoughened/18Ar/6/18Ar/b6toughened",manufacturerQuotedUg:"0.5",unitPrice:"9142.24",totalPrice:"9142.24",canonicalSpecification:{material:{value:"Spruce"},internalFinish:{value:"Spruce FI501 (FI501)"},externalFinish:{value:"RAL 7021"},aluminiumCladding:{value:"Aluminium clad"}}});
  const position=buildQuoteComparisonReport({recordRevision:1,baselineSnapshot:{positions:[baseline]},proposals:[proposal("norr","Norrsken",4227.09,[norr]),proposal("eco","EcoHaus",9142.24,[eco])]}).positions[0];
  const norrOffer=position.offers.find((offer)=>offer.supplierName==="Norrsken");
  assert.match(position.offers[0].attributes.glass,/4TGH LowE\/18Ar\/4\/18Ar\/4TGH LowE/);
  assert.equal(norrOffer.attributes.glass,"triple: from inside 4 tuf/4 tuf/6.8 lam – 2 panes");
  assert.match(norrOffer.referenceAssessment.differences.join(" "),/Glazing build-up:.*4 tuf\/4 tuf\/6\.8 lam.*4TGH LowE/i);
  assert.match(norrOffer.referenceAssessment.missingEvidence.join(" "),/selected reference states its viewing side but not which leaf slides/i);
  assert.equal(norrOffer.priceComparison.amountDifference,-294.46);
  assert.equal(norrOffer.priceComparison.percentageDifference,-6.5);
  assert.equal(norrOffer.annualHeatLoss.status,"illustrative");
  assert.equal(norrOffer.annualHeatLoss.equivalentAreaM2,6.5);
  assert.ok(Math.abs(norrOffer.annualHeatLoss.deltaKwh-3.9)<0.000001);
  assert.match(norrOffer.annualHeatLoss.display,/Approximately 3\.9 kWh more heat lost per year.*quoted central Uw values/i);
  assert.match(norrOffer.customerFinding.recommendation,/provisionally better value if the remaining specification checks establish suitability/i);
  assert.match(norrOffer.customerFinding.recommendation,/slightly worse quoted Uw alone does not outweigh this saving.*glass, hardware or scope disadvantage could change/i);
});

test("reviewed clear-finish meaning is preserved while an unexplained supplier timber code remains unknown",()=>{
  const baseline={id:"a",positionRef:"A",qty:1,widthMm:1000,heightMm:1000,product:"Timber window",configurationDescription:"Fixed",customerUnitPrice:"500",canonicalSpecification:{material:{value:"Softwood"},internalFinish:{value:"Lacquer 3.1"}}};
  const clear=mapping("clear","a","exact_match",{customerReference:"A",quantity:1,widthMm:1000,heightMm:1000,product:"Timber window",configurationDescription:"Fixed",totalPrice:"450",canonicalSpecification:{material:{value:"Pine"},internalFinish:{value:"Clear stain"}}});
  const coded=mapping("coded","a","exact_match",{customerReference:"A2",quantity:1,widthMm:1000,heightMm:1000,product:"HF410",configurationDescription:"Fixed",totalPrice:"475",canonicalSpecification:{material:{value:"Spruce"},internalFinish:{value:"Spruce FI501 (FI501)"}}});
  const report=buildQuoteComparisonReport({recordRevision:1,baselineSnapshot:{positions:[baseline]},proposals:[proposal("clear","Clear Supplier",450,[clear]),proposal("coded","EcoHaus",475,[coded])]});
  const clearOffer=report.positions[0].offers.find((offer)=>offer.supplierName==="Clear Supplier"),codedOffer=report.positions[0].offers.find((offer)=>offer.supplierName==="EcoHaus");
  assert.match(clearOffer.referenceAssessment.matches.join(" "),/Clear stain is a confirmed clear timber finish.*original supplier code retained/i);
  assert.match(codedOffer.referenceAssessment.missingEvidence.join(" "),/Spruce FI501 \(FI501\).*does not confirm whether it is clear or opaque.*Lacquer 3\.1.*confirmed clear/i);
  assert.equal(codedOffer.presentationFields.find((field)=>field.key==="internal_finish").status,"unknown");
});

test("grouped HF410 and KF410 constituents retain separate materials and reconciling component prices",()=>{
  const baseline={id:"a",positionRef:"A",qty:3,widthMm:1000,heightMm:660,product:"Timber aluminium window",configurationDescription:"Turn/tilt",customerUnitPrice:"600"};
  const hf=mapping("hf","a","exact_match",{customerReference:"A",quantity:2,widthMm:1000,heightMm:660,product:"HF410",productSystem:"HF410",configurationDescription:"Turn/tilt",unitPrice:"500",totalPrice:"1000",canonicalSpecification:{productFamily:{value:"timber_aluminium_window"},material:{value:"Spruce"}}},"grouped");
  const kf=mapping("kf","a","exact_match",{customerReference:"A2",quantity:1,widthMm:1000,heightMm:660,product:"KF410",productSystem:"KF410",configurationDescription:"Turn/tilt",unitPrice:"400",totalPrice:"400",canonicalSpecification:{productFamily:{value:"upvc_aluminium_window"}}},"grouped");
  const offer=buildQuoteComparisonReport({recordRevision:1,baselineSnapshot:{positions:[baseline]},proposals:[proposal("eco","EcoHaus",1400,[hf,kf])]}).positions[0].offers[1];
  assert.deepEqual(offer.commercial.components.map((component)=>[component.reference,component.productSystem,component.productFamily,component.material,component.quantity,component.netUnitPrice,component.netQuantityTotal]),[["A","HF410 · HF410","timber_aluminium_window","Spruce",2,500,1000],["A2","KF410 · KF410","upvc_aluminium_window","Not supplied",1,400,400]]);
  assert.equal(offer.commercial.netQuantityCost,1400);
  assert.match(offer.presentationFields.find((field)=>field.key==="product_material").value,/A: HF410.*Spruce.*A2: KF410.*upvc_aluminium_window.*material not separately stated/i);
});
