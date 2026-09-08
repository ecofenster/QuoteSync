import assert from "node:assert/strict";
import test from "node:test";
import { normalizeQuotationDate, parseCommercialFields } from "../server/features/supplierImportLab/commercialFieldParser.js";

const document={attachmentId:"zyle-source",manufacturerVisualCandidates:[],pages:[{pageNumber:1,blocks:[
  {id:"b1",text:"PRICE OFFER No. 343829-5"},{id:"b2",text:"Customer : Ecofenster"},{id:"b3",text:"Reference: Nick Corlett"},{id:"b4",text:"Date: 2026 06 18"},{id:"b5",text:"Sales manager sales@zylefenster.com"},
  {id:"b6",text:"Position 001"},{id:"b7",text:"Price, EUR"},{id:"b8",text:"Qty"},{id:"b9",text:"Total, EUR"},{id:"b10",text:"1000 x 1200 mm"},{id:"b11",text:"100.00"},{id:"b12",text:"1"},{id:"b13",text:"100.00"},
]}]};

test("spaced ISO and UK quotation dates normalize without accepting impossible dates",()=>{
  assert.equal(normalizeQuotationDate("2026 06 18"),"2026-06-18");
  assert.equal(normalizeQuotationDate("18/06/2026"),"2026-06-18");
  assert.equal(normalizeQuotationDate("2026-02-31"),null);
});

test("Zyle price-offer content resolves issuer, manufacturer, document type and normalized date without filename inference",()=>{
  const result=parseCommercialFields(document,{currency:"EUR"});
  assert.equal(result.adapter,"zyle_fenster_price_offer_v1");
  assert.equal(result.supplier,"Zyle Fenster");
  assert.equal(result.manufacturer,"Zyle Fenster");
  assert.equal(result.documentType,"complete_quotation");
  assert.equal(result.metadata.quotationDate,"2026-06-18");
  assert.equal(result.quotation.supplierQuotationNumber,"343829");
  assert.equal(result.quotation.supplierRevision,"5");
});
