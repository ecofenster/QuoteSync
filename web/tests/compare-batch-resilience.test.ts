import assert from "node:assert/strict";
import test from "node:test";
import { analyseCompetitorFiles, groupProposalAnalyses, proposalGroupingKey } from "../src/features/quoteComparisons/competitorBatchAnalysis.ts";

const review=(supplier:string,reference:string,revision="")=>({metadata:{recognizedSupplierName:supplier,recognizedDealerName:supplier,recognizedCommercialSupplierName:supplier,quotationNumber:reference,revision},documents:[],positionCount:1}) as any;

test("batch analysis isolates one failed source and retains every successful result",async()=>{
  const files=["one.pdf","bad.pdf","two.pdf"].map(name=>new File([name],name,{type:"application/pdf"}));
  const snapshots:any[]=[];
  const result=await analyseCompetitorFiles(files,async file=>{if(file.name==="bad.pdf")throw new Error("Malformed source");return {review:review(file.name,"Q-1")}},entries=>snapshots.push(entries),2);
  assert.deepEqual(result.map(item=>item.status),["complete","failed","complete"]);
  assert.match(result[1].error!,/Malformed/);
  assert.ok(snapshots.some(entries=>entries.some((item:any)=>item.status==="analysing")));
});

test("proposal grouping requires exact supplier, quotation and revision evidence",()=>{
  const entries=[
    {id:"1",fileName:"commercial.pdf",status:"complete" as const,review:review("Supplier A","Q-1","2")},
    {id:"2",fileName:"technical.pdf",status:"complete" as const,review:review("Supplier A","Q-1","2")},
    {id:"3",fileName:"other.pdf",status:"complete" as const,review:review("Supplier B","Q-1","2")},
    {id:"4",fileName:"unknown.pdf",status:"review_required" as const,review:review("","","")},
  ];
  assert.equal(proposalGroupingKey(entries[0].review),"suppliera:q1:2");
  const groups=groupProposalAnalyses(entries);
  assert.equal(groups.length,3);
  assert.equal(groups[0].entries.length,2);
  assert.equal(groups[1].entries.length,1);
  assert.equal(groups[2].authority,"independent_source");
});
