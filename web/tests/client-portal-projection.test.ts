import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomerSafePortalProjection, CLIENT_PORTAL_FORBIDDEN_FIELDS } from "../src/features/clientPortal/customerSafePortalProjection";

const client:any={id:"test-client",clientRef:"TEST-CL-001",clientName:"Disposable Client",businessName:"",projectName:"Garden Room",estimates:[
  {id:"estimate-r2",estimateRef:"TEST-EST-001-R2",revisionNo:2,outcome:"Open",positions:[]},
  {id:"estimate-r1",estimateRef:"TEST-EST-001",revisionNo:1,outcome:"Lost",positions:[]},
  {id:"estimate-order",estimateRef:"TEST-EST-000",revisionNo:0,outcome:"Order",positions:[]},
]};
const documents:any[]=[
  {id:"issued",documentType:"customer_quotation",fileName:"Estimate-R2.pdf",revision:"2",modifiedAt:"2026-09-06",status:"filed",downloadUrl:"/issued",openUrl:null},
  {id:"supplier",documentType:"supplier_quotation",fileName:"supplier-cost.pdf",revision:"1",modifiedAt:"2026-09-06",status:"filed",downloadUrl:"/supplier",openUrl:null},
  {id:"diagnostic",documentType:"extraction_diagnostic",fileName:"confidence.json",revision:"1",modifiedAt:"2026-09-06",status:"filed",downloadUrl:"/debug",openUrl:null},
];

test("portal projection exposes only customer-safe records and explicit selling totals",()=>{
  const projection=buildCustomerSafePortalProjection({client,documents,releasedEstimateIds:["estimate-r2"],orderEstimateIds:["estimate-order"],rejectedEstimateIds:["estimate-r1"],releasedDocumentIds:["issued"],commercialByEstimateId:{"estimate-r2":{supplyOnly:10000,installation:2500,vat:2500,total:15000,currency:"GBP"}}});
  assert.equal(projection.latestEstimate?.estimateRef,"TEST-EST-001-R2");assert.equal(projection.latestEstimate?.commercial.total,15000);
  assert.deepEqual(projection.documents.map((document)=>document.id),["issued"]);assert.equal(projection.orders.length,1);assert.equal(projection.rejected.length,1);
  const json=JSON.stringify(projection);for(const forbidden of CLIENT_PORTAL_FORBIDDEN_FIELDS)assert.equal(json.includes(forbidden),false,`${forbidden} must not cross the portal boundary`);
  assert.equal(json.includes("supplier-cost.pdf"),false);assert.equal(json.includes("confidence.json"),false);
});

test("portal projection reports unavailable rather than deriving or inventing commercial values",()=>{
  const projection=buildCustomerSafePortalProjection({client,documents:[],releasedEstimateIds:["estimate-r2"]});
  assert.equal(projection.latestEstimate?.commercial.supplyOnly,null);assert.equal(projection.latestEstimate?.commercial.vat,null);assert.equal(projection.latestEstimate?.commercial.total,null);
});

test("internal Estimate outcomes alone do not authorize portal disclosure",()=>{
  const projection=buildCustomerSafePortalProjection({client,documents:[]});
  assert.equal(projection.estimates.length,0);assert.equal(projection.orders.length,0);assert.equal(projection.rejected.length,0);
});
