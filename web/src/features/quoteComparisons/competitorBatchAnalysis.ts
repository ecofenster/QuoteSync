import type { ManufacturerImportReview } from "../supplierQuotes/api/supplierQuotesApi";

export type CompetitorFileAnalysis<T> = {
  id:string;
  fileName:string;
  status:"waiting"|"analysing"|"complete"|"review_required"|"failed";
  result?:T;
  review?:ManufacturerImportReview;
  error?:string;
};

const normalized = (value:unknown) => String(value ?? "").trim().toLocaleLowerCase("en-GB").replace(/[^\p{L}\p{N}]+/gu, "");

export function proposalGroupingKey(review:ManufacturerImportReview) {
  const supplier = normalized(review.metadata.recognizedSupplierName || review.metadata.recognizedDealerName || review.metadata.recognizedCommercialSupplierName);
  const reference = normalized(review.metadata.quotationNumber);
  if (!supplier || !reference) return null;
  return `${supplier}:${reference}:${normalized(review.metadata.revision)}`;
}

export async function analyseCompetitorFiles<T extends {review:ManufacturerImportReview}>(
  files:readonly File[],
  analyse:(file:File)=>Promise<T>,
  onChange?:(entries:CompetitorFileAnalysis<T>[])=>void,
  concurrency=1,
) {
  const entries:CompetitorFileAnalysis<T>[] = files.map((file,index)=>({id:`${index}:${file.name}:${file.size}`,fileName:file.name,status:"waiting"}));
  const publish=()=>onChange?.(entries.map(entry=>({...entry})));
  publish();
  let cursor=0;
  async function worker(){
    while(cursor<files.length){
      const index=cursor++;
      entries[index]={...entries[index],status:"analysing"};publish();
      try{
        const result=await analyse(files[index]);
        const reviewRequired=!result.review.positionCount||!(result.review.metadata.recognizedSupplierName||result.review.metadata.recognizedCommercialSupplierName)||!result.review.metadata.quotationNumber;
        entries[index]={...entries[index],status:reviewRequired?"review_required":"complete",result,review:result.review};
      }catch(reason){
        entries[index]={...entries[index],status:"failed",error:reason instanceof Error?reason.message:"This source could not be analysed."};
      }
      publish();
    }
  }
  await Promise.all(Array.from({length:Math.max(1,Math.min(concurrency,files.length))},()=>worker()));
  return entries;
}

export function groupProposalAnalyses<T extends {review:ManufacturerImportReview}>(entries:readonly CompetitorFileAnalysis<T>[]) {
  const groups:Array<{key:string|null;entries:Array<CompetitorFileAnalysis<T>>;authority:"exact_supplier_reference_revision"|"independent_source"}> = [];
  for(const entry of entries.filter(item=>(item.status==="complete"||item.status==="review_required")&&item.review)){
    const key=proposalGroupingKey(entry.review!);
    const existing=key?groups.find(group=>group.key===key):null;
    if(existing) existing.entries.push(entry);
    else groups.push({key,entries:[entry],authority:key?"exact_supplier_reference_revision":"independent_source"});
  }
  return groups;
}
