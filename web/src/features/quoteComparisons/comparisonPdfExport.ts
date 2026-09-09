import type { QuoteComparisonReport, QuoteComparisonReportOffer } from "../../../shared/quoteComparisonReportModel.js";
import { resolveManufacturerVisualAssetUrl } from "../manufacturerVisuals/manufacturerVisualAssetUrl";

type PrintContext = { clientName:string; clientRef:string; projectName:string };
type PdfNode = string | Record<string, unknown>;

const money=(value:number|null,currency:string|null)=>value==null?"Not established":`${currency==="GBP"?"£":currency==="EUR"?"€":currency?`${currency} `:""}${value.toLocaleString("en-GB",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const statusLabel=(status:string)=>status==="approved"?"Approved":status==="draft_review_required"?"Draft · review required":status.replaceAll("_"," ");
const scopeLabel=(value:string)=>value==="supply_only"?"Supply Only":value==="supply_and_install"?"Supply + Install":value==="supply_install_support"?"Supply + Installation Support":"Scope not established";
const cleanFilePart=(value:string)=>value.replace(/[^A-Za-z0-9_-]+/g,"-").replace(/^-+|-+$/g,"")||"comparison";

function dataUrl(blob:Blob) {
  return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error||new Error("Drawing could not be read."));reader.readAsDataURL(blob)});
}

async function drawingAssets(report:QuoteComparisonReport,positionReferences?:Set<string>) {
  const positions=positionReferences?report.positions.filter(position=>positionReferences.has(position.reference)):report.positions;
  const urls=[...new Set(positions.flatMap(position=>position.offers.flatMap(offer=>offer.drawings.filter(drawing=>drawing.status==="available"&&drawing.url).map(drawing=>resolveManufacturerVisualAssetUrl(drawing.url!)))) )];
  const entries=await Promise.all(urls.map(async url=>{try{const response=await fetch(url,{credentials:"same-origin"});if(!response.ok)throw new Error(`HTTP ${response.status}`);const blob=await response.blob();if(!/^image\/(png|jpe?g)$/i.test(blob.type))throw new Error(`Unsupported image type ${blob.type||"unknown"}`);return [url,await dataUrl(blob)] as const}catch{return [url,null] as const}}));
  return new Map(entries);
}

function textBlock(value:string,style?:string):PdfNode { return {text:value,style,margin:[0,0,0,4]}; }
function bulletList(values:string[]):PdfNode { return values.length?{ul:values,fontSize:9,lineHeight:1.2,margin:[0,3,0,5]}:{text:"None recorded.",fontSize:9,color:"#53615a"}; }
const fieldColor:Record<string,string>={reference:"#3a4a2a",match:"#247a3c",difference:"#b42318",unknown:"#9a6700",not_applicable:"#64735f"};

function fieldMarker(status:string):PdfNode {
  const color=fieldColor[status]||fieldColor.unknown;
  if(status==="match")return {svg:`<svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4.2 3 6.2 7 1.4" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,width:8,margin:[0,2,2,0]};
  if(status==="difference")return {svg:`<svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.4 1.4 6.6 6.6M6.6 1.4 1.4 6.6" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/></svg>`,width:8,margin:[0,2,2,0]};
  if(status==="reference")return {svg:`<svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="2.5" fill="${color}"/></svg>`,width:8,margin:[0,2,2,0]};
  if(status==="not_applicable")return {svg:`<svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5 4 6.5 4" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/></svg>`,width:8,margin:[0,2,2,0]};
  return {text:"?",bold:true,color,width:8,margin:[0,0,2,0]};
}

function findingLine(status:"match"|"difference"|"unknown",label:string,value:string):PdfNode {
  return {columns:[fieldMarker(status),{text:[{text:`${label}: `,bold:true,color:fieldColor[status]},value]}],columnGap:2,margin:[0,0,0,3]};
}

function drawingCell(offer:QuoteComparisonReportOffer,assets:Map<string,string|null>):PdfNode {
  const cells=offer.drawings.map(drawing=>{
    const url=drawing.url?resolveManufacturerVisualAssetUrl(drawing.url):null, image=url?assets.get(url):null;
    return {stack:[image?{image,fit:[100,80],alignment:"center",margin:[0,3,0,3]}:{text:"Image unavailable",alignment:"center",color:"#64735f",fontSize:8,margin:[0,31,0,30]},{text:`${drawing.sourceReference}${drawing.sourcePage?` · p${drawing.sourcePage}`:""}`,fontSize:7.5,color:"#53615a",alignment:"center"}],margin:[1,1,1,3]};
  });
  return {stack:cells};
}

function compactOfferDetails(offer:QuoteComparisonReportOffer):PdfNode[] {
  const fields=new Map(offer.presentationFields.map(field=>[field.key,field]));
  const line=(label:string,keys:string[])=>({
    text:[{text:`${label}: `,bold:true,color:"#53615a"},keys.map(key=>fields.get(key)?.value).filter(Boolean).join(" · ")||"Not supplied"],
    margin:[0,0,0,2],
  });
  const result:PdfNode[]=[
    line("Product / operation",["product_material"]),
    line("Dimensions / quantity",["dimensions","quantity"]),
    line("Finishes",["internal_finish","external_finish"]),
    line("Glass",["glass"]),
    line("Security / hardware",["security_hardware"]),
    line("Thermal",["uw","ug","g","lt"]),
  ];
  if(offer.annualHeatLoss.status!=="reference")result.push({text:[{text:"Annual heat loss: ",bold:true,color:"#53615a"},offer.annualHeatLoss.display],fontSize:8.5,margin:[0,1,0,0]});
  return result;
}

function compactFindingStack(offer:QuoteComparisonReportOffer):PdfNode[] {
  if(offer.isBaselineReference)return [{text:"Selected reference",bold:true,color:"#3a4a2a"},{text:"Defines the requested specification; not independently verified.",margin:[0,2,0,0]}];
  const result:PdfNode[]=[{text:offer.compliance.label,bold:true}];
  if(offer.customerFinding.matches)result.push(findingLine("match","Matches",offer.customerFinding.matches.replace(/^Matches [^:]+:\s*/i,"").replace(/\.$/,"")));
  if(offer.customerFinding.differs)result.push(findingLine("difference","Differs",offer.customerFinding.differs.replace(/^Differs from [^:]+:\s*/i,"").replace(/\.$/,"")));
  if(offer.customerFinding.confirm)result.push(findingLine("unknown","Confirm",offer.customerFinding.confirm.replace(/^Confirm with [^:]+:\s*/i,"").replace(/\.$/,"")));
  result.push({text:[{text:"Recommendation: ",bold:true},offer.customerFinding.recommendation],margin:[0,2,0,0]});
  return result;
}

function priceDetails(offer:QuoteComparisonReportOffer):PdfNode[] {
  return [
    {text:offer.completePositionPriceEligible===false?"No complete Position price":money(offer.commercial.netQuantityCost,offer.currency),bold:true,fontSize:9.5},
    offer.commercial.netItemCost!=null?{text:`Unit: ${money(offer.commercial.netItemCost,offer.currency)}`}:null,
    {text:`Quantity total: ${money(offer.commercial.netQuantityCost,offer.currency)}`},
    offer.commercial.discountPercentage!=null?{text:`List ${money(offer.commercial.grossQuantityCost,offer.currency)} · discount ${offer.commercial.discountPercentage}% (${money(offer.commercial.discountAmount,offer.currency)})`}:null,
    ...(offer.commercial.components.length>1?offer.commercial.components.map(component=>({text:`${component.reference}: ${component.quantity??"?"} × ${money(component.netUnitPrice,offer.currency)} = ${money(component.netQuantityTotal,offer.currency)}`})):[]),
    offer.commercial.supportingComponentCost!=null?{text:`Supporting component: ${money(offer.commercial.supportingComponentCost,offer.currency)}`}:null,
    offer.priceComparison.amountDifference!=null?{text:`${offer.priceComparison.amountDifference<0?"−":"+"}${money(Math.abs(offer.priceComparison.amountDifference),offer.currency)}${offer.priceComparison.percentageDifference==null?"":` (${offer.priceComparison.percentageDifference>0?"+":""}${offer.priceComparison.percentageDifference.toFixed(1)}%)`} vs selected supplier`,bold:true}:null,
    {text:offer.priceComparison.basis,color:"#53615a",fontSize:8.5,margin:[0,3,0,0]},
  ].filter(Boolean) as PdfNode[];
}

function positionPage(position:QuoteComparisonReport["positions"][number],assets:Map<string,string|null>):PdfNode {
  const rows=position.offers.map(offer=>[
    drawingCell(offer,assets),
    {stack:[{text:offer.supplierName,bold:true,fontSize:9.5},{text:offer.reference},{text:offer.isBaselineReference?"Selected supplier / reference":offer.isAlternative?"Alternative / option":offer.relationship==="grouped"?"Grouped supplier solution":"Supplier offer",fontSize:8.5,color:"#53615a"}]},
    {stack:compactOfferDetails(offer)},
    {stack:priceDetails(offer)},
    {stack:compactFindingStack(offer)},
  ]);
  const heading={columns:[{stack:[{text:"POSITION SCHEDULE",style:"eyebrow"},{text:`Position ${position.reference}`,style:"pageTitle"}]},{text:`${position.measurements} · Quantity ${position.quantity}${position.roomName?` · ${position.roomName}`:""}`,alignment:"right",margin:[0,12,0,0]}],margin:[0,0,0,7]};
  return {pageBreak:"before",stack:[
    heading,
    {table:{headerRows:1,dontBreakRows:true,keepWithHeaderRows:1,widths:[108,72,276,92,"*"],body:[[{text:`DRAWING · POSITION ${position.reference}`,style:"tableHeader"},{text:"SUPPLIER / ITEM",style:"tableHeader"},{text:"WHAT IS OFFERED",style:"tableHeader"},{text:"PRICE",style:"tableHeader"},{text:"FINDING",style:"tableHeader"}],...rows]},layout:{fillColor:(index:number)=>index===0?"#e9eeeb":position.offers[index-1]?.isBaselineReference?"#f2f6ed":position.offers[index-1]?.isAlternative?"#fff8eb":null,hLineColor:()=>"#cbd5cf",vLineColor:()=>"#d9e0db",paddingLeft:()=>4,paddingRight:()=>4,paddingTop:()=>4,paddingBottom:()=>4},fontSize:9,lineHeight:1.18},
    {unbreakable:true,margin:[0,7,0,0],stack:[{text:`POSITION ${position.reference} CONCLUSION`,bold:true,fontSize:9,color:"#3a4a2a",margin:[0,0,0,3]},{text:position.conclusion,fontSize:9,lineHeight:1.25}]},
  ]};
}

function buildDocument(report:QuoteComparisonReport,context:PrintContext,assets:Map<string,string|null>) {
  const presentation=report.customerPresentation,status=statusLabel(report.context.status),projectName=report.context.projectName||context.projectName||"Project not named";
  const questionGroups=presentation.questions.reduce<Record<string,typeof presentation.questions>>((groups,item)=>{(groups[item.supplierName]??=[]).push(item);return groups},{});
  const overviewQuestionGroups=Object.fromEntries(Object.entries(questionGroups).map(([supplier,items])=>[supplier,items.slice(0,2)]));
  const content:PdfNode[]=[
    {stack:[{text:"QUOTESUITE",style:"eyebrow"},{text:"Supplier Comparison",style:"title"},{text:report.context.name,fontSize:11,bold:true,margin:[0,0,0,3]},report.context.description?textBlock(report.context.description):{text:""},{text:status,style:"status"}],margin:[0,0,0,10]},
    {table:{widths:["*","*","*","*"],body:[[{stack:[{text:"CLIENT",style:"eyebrow"},{text:context.clientName,bold:true},{text:context.clientRef,fontSize:9,color:"#53615a"}]},{stack:[{text:"PROJECT",style:"eyebrow"},{text:projectName,bold:true},{text:report.context.projectId||"No Project identity supplied",fontSize:9,color:"#53615a"}]},{stack:[{text:"REFERENCE ESTIMATE",style:"eyebrow"},{text:report.context.baselineEstimateRef,bold:true},{text:`Revision ${report.context.baselineRevision} · ${report.positions.length} Positions`,fontSize:9,color:"#53615a"}]},{stack:[{text:"COMPARISON",style:"eyebrow"},{text:status,bold:true},{text:`Record revision ${report.generatedFromRecordRevision}`,fontSize:9,color:"#53615a"}]}]]},layout:"lightHorizontalLines",margin:[0,0,0,12]},
    {columns:[{width:"*",stack:[{text:"Reference and scope",style:"sectionTitle"},textBlock(presentation.reference),textBlock(presentation.scope)]},{width:"*",stack:[{text:"How offers are assessed",style:"sectionTitle"},bulletList(presentation.assessmentPriorities)]},{width:"*",stack:[{text:"Conclusion",style:"sectionTitle"},textBlock(presentation.conclusion)]}],columnGap:10},
    {text:report.disclaimer,style:"qualification",margin:[0,12,0,0]},
    {text:"",pageBreak:"after"},
    {text:"PROJECT OVERVIEW",style:"eyebrow"},{text:"Main differences, thermal evidence and prices",style:"pageTitle"},{text:"Thermal performance and price are reported separately.",color:"#53615a",margin:[0,0,0,8]},
    {table:{widths:["*","*"],body:Array.from({length:Math.ceil(presentation.suppliers.length/2)},(_,row)=>[0,1].map(column=>{const supplier=presentation.suppliers[row*2+column];return supplier?{stack:[{text:supplier.supplierName,bold:true,fontSize:11},{text:supplier.manufacturerName||"Manufacturer not confirmed",fontSize:9,color:"#53615a",margin:[0,0,0,3]},textBlock(supplier.coverage),bulletList(supplier.mainPoints),{text:`Thermal evidence · Uw ${supplier.thermal.uw?.display||"not confirmed"} · Ug ${supplier.thermal.ug?.display||"not confirmed"} · G ${supplier.thermal.g?.display||"not confirmed"} · LT ${supplier.thermal.lt?.display||"not confirmed"}`,fontSize:9,margin:[0,3,0,2]},{text:`Headline price · ${money(supplier.commercial.headlineTotal,supplier.commercial.currency)} · ${scopeLabel(supplier.commercial.scopeKind)}`,fontSize:9,bold:true},{text:`List / discount / net supply · ${money(supplier.commercial.grossSupply,supplier.commercial.currency)} · ${supplier.commercial.discountPercentage==null?"discount not established":`${supplier.commercial.discountPercentage}% (${money(supplier.commercial.discountAmount,supplier.commercial.currency)})`} · ${money(supplier.commercial.netSupply,supplier.commercial.currency)}`,fontSize:9},{text:`Extras · ${supplier.commercial.extrasLabels.length?supplier.commercial.extrasLabels.join(", "):"breakdown not established"} · Delivery ${money(supplier.commercial.delivery,supplier.commercial.currency)} · Installation ${money(supplier.commercial.installation,supplier.commercial.currency)}`,fontSize:8.5},{text:`Comparable supply · ${supplier.commercial.established?money(supplier.commercial.netSupply,supplier.commercial.currency):supplier.commercial.explanation}`,fontSize:8.5,color:"#53615a",margin:[0,2,0,0]}],margin:[2,2,2,2]}:{text:""}}))},layout:{hLineColor:()=>"#d9e0db",vLineColor:()=>"#d9e0db",paddingLeft:()=>6,paddingRight:()=>6,paddingTop:()=>6,paddingBottom:()=>6}},
    {text:[{text:"Annual thermal comparison: ",bold:true},report.thermalMethodology.label," ",report.thermalMethodology.qualification],style:"qualification",margin:[0,8,0,0]},
    {text:"",pageBreak:"after"},
    {text:"EVIDENCE REVIEW",style:"eyebrow"},{text:"Outstanding questions and source notes",style:"pageTitle"},{text:"Questions to resolve before a final decision.",color:"#53615a",margin:[0,0,0,8]},
    {columns:Object.entries(overviewQuestionGroups).map(([supplier,items])=>({width:"*",stack:[{text:supplier,bold:true,fontSize:9},bulletList(items.map(item=>`${item.question}${item.positionReferences.length?` Positions ${item.positionReferences.join(", ")}.`:""}`)),questionGroups[supplier].length>items.length?{text:`${questionGroups[supplier].length-items.length} further Position-specific clarification${questionGroups[supplier].length-items.length===1?"":"s"} are retained in the report evidence.`,fontSize:8.5,color:"#53615a"}:{text:""}]})),columnGap:8},
    {columns:[{width:"*",stack:[{text:"Source register",style:"sectionTitle"},bulletList(report.sourceReferences.map(source=>`${source.supplierName}: ${source.fileName} · ${source.quotationNumber||"reference not supplied"}${source.quotationRevision?` · revision ${source.quotationRevision}`:""}`))]},{width:"*",stack:[{text:"Interpretation notes",style:"sectionTitle"},bulletList(presentation.interpretationNotes.slice(0,4))]}],columnGap:10,margin:[0,12,0,0]},
    ...report.positions.map(position=>positionPage(position,assets)),
  ];
  return {pageSize:"A4",pageOrientation:"landscape",pageMargins:[28,28,28,32],info:{title:"Supplier Comparison",subject:`${projectName} · ${report.context.baselineEstimateRef}`,author:"QuoteSuite"},defaultStyle:{font:"Roboto",fontSize:9.5,color:"#17211d",lineHeight:1.18},styles:{title:{fontSize:22,bold:true,color:"#17211d",margin:[0,3,0,4]},pageTitle:{fontSize:16,bold:true,color:"#17211d",margin:[0,2,0,4]},sectionTitle:{fontSize:11,bold:true,color:"#17211d",margin:[0,0,0,4]},eyebrow:{fontSize:8,bold:true,color:"#64735f",characterSpacing:1.1},status:{fontSize:9,bold:true,color:"#3a4a2a",background:"#eef4e5",margin:[0,3,0,0]},qualification:{fontSize:9,color:"#53615a",background:"#f2f5ee",margin:[0,8,0,0]},tableHeader:{fontSize:9,bold:true,color:"#304139"}},footer:(currentPage:number,pageCount:number)=>({columns:[{text:"Supplier Comparison"},{text:report.context.baselineEstimateRef,alignment:"center"},{text:`Page ${currentPage} of ${pageCount}`,alignment:"right"}],margin:[28,8,28,0],fontSize:8,color:"#53615a"}),content};
}

function buildPositionDocument(report:QuoteComparisonReport,context:PrintContext,position:QuoteComparisonReport["positions"][number],assets:Map<string,string|null>) {
  const status=statusLabel(report.context.status),projectName=report.context.projectName||context.projectName||"Project not named";
  const supplierNames=new Set(position.offers.map((offer)=>offer.supplierName));
  const sources=report.sourceReferences.filter((source)=>supplierNames.has(source.supplierName));
  const sourceBySupplier=new Map(sources.map((source)=>[source.supplierName,source]));
  const compactPrice=(offer:QuoteComparisonReportOffer):PdfNode[]=>[
    {text:offer.completePositionPriceEligible===false?"No complete Position price":money(offer.commercial.netQuantityCost,offer.currency),bold:true,fontSize:9.5},
    offer.commercial.netItemCost!=null?{text:`Unit ${money(offer.commercial.netItemCost,offer.currency)} · quantity total ${money(offer.commercial.netQuantityCost,offer.currency)}`}:{text:`Quantity total ${money(offer.commercial.netQuantityCost,offer.currency)}`},
    offer.priceComparison.amountDifference!=null?{text:`${offer.priceComparison.amountDifference<0?"−":"+"}${money(Math.abs(offer.priceComparison.amountDifference),offer.currency)}${offer.priceComparison.percentageDifference==null?"":` (${offer.priceComparison.percentageDifference>0?"+":""}${offer.priceComparison.percentageDifference.toFixed(1)}%)`} vs selected supplier`,bold:true,margin:[0,2,0,0]}:null,
    {text:offer.priceComparison.comparable?"Comparable net Products / Supply basis.":offer.priceComparison.basis,color:"#53615a",fontSize:7.5,margin:[0,2,0,0]},
  ].filter(Boolean) as PdfNode[];
  const compactFinding=(offer:QuoteComparisonReportOffer):PdfNode[]=>{
    if(offer.isBaselineReference)return [{text:"Selected reference",bold:true,color:"#3a4a2a"},{text:"Defines the requested specification; not independently verified.",margin:[0,2,0,0]}];
    const result:PdfNode[]=[{text:offer.compliance.label,bold:true}];
    if(offer.customerFinding.matches)result.push({text:offer.customerFinding.matches,margin:[0,2,0,0]});
    if(offer.customerFinding.differs)result.push({text:offer.customerFinding.differs,color:"#8f1d16",margin:[0,2,0,0]});
    if(offer.customerFinding.confirm)result.push({text:offer.customerFinding.confirm,color:"#7a5700",margin:[0,2,0,0]});
    result.push({text:[{text:"Recommendation: ",bold:true},offer.customerFinding.recommendation],margin:[0,3,0,0]});
    if(offer.annualHeatLoss.status==="illustrative")result.push({text:offer.annualHeatLoss.display.replace(/^.*?K·days\/year\.\s*/i,"Rounding / basis: "),fontSize:7.5,color:"#53615a",margin:[0,2,0,0]});
    return result;
  };
  const rows=position.offers.map((offer)=>[
    drawingCell(offer,assets),
    {stack:[{text:offer.supplierName,bold:true,fontSize:9.5},{text:offer.reference,fontSize:9},{text:offer.isBaselineReference?"Selected supplier / reference":offer.isAlternative?"Alternative / option":offer.relationship==="grouped"?"Grouped supplier solution":"Supplier offer",fontSize:8,color:"#53615a"},{text:sourceBySupplier.get(offer.supplierName)?.fileName||"Retained comparison source",fontSize:7,color:"#53615a",margin:[0,3,0,0]}]},
    {stack:compactOfferDetails(offer)},
    {stack:compactPrice(offer)},
    {stack:compactFinding(offer)},
  ]);
  return {
    pageSize:"A4",pageOrientation:"landscape",pageMargins:[20,18,20,24],
    info:{title:`Supplier Comparison · Position ${position.reference}`,subject:`${projectName} · ${report.context.baselineEstimateRef}`,author:"QuoteSuite"},
    defaultStyle:{font:"Roboto",fontSize:8.5,color:"#17211d",lineHeight:1.12},
    styles:{eyebrow:{fontSize:7.5,bold:true,color:"#64735f",characterSpacing:1},pageTitle:{fontSize:15,bold:true,color:"#17211d",margin:[0,1,0,2]},tableHeader:{fontSize:8,bold:true,color:"#304139"}},
    footer:(currentPage:number,pageCount:number)=>({columns:[{text:"Supplier Comparison"},{text:`${report.context.baselineEstimateRef} · Position ${position.reference}`,alignment:"center"},{text:`Page ${currentPage} of ${pageCount}`,alignment:"right"}],margin:[20,6,20,0],fontSize:7.5,color:"#53615a"}),
    content:[
      {columns:[{width:"*",stack:[{text:"SUPPLIER COMPARISON · POSITION ACCEPTANCE",style:"eyebrow"},{text:`Position ${position.reference}`,style:"pageTitle"},{text:`${context.clientName} · ${projectName} · ${report.context.baselineEstimateRef} Revision ${report.context.baselineRevision}`,fontSize:8.5,color:"#53615a"}]},{width:"auto",stack:[{text:status,bold:true,color:"#3a4a2a",alignment:"right"},{text:`${position.measurements} · Quantity ${position.quantity}`,fontSize:8.5,alignment:"right",margin:[0,3,0,0]}]}],margin:[0,0,0,6]},
      {table:{headerRows:1,dontBreakRows:true,widths:[72,60,258,82,"*"],body:[[{text:"DRAWING",style:"tableHeader"},{text:"SUPPLIER / ITEM",style:"tableHeader"},{text:"WHAT IS OFFERED",style:"tableHeader"},{text:"PRICE",style:"tableHeader"},{text:"FINDING",style:"tableHeader"}],...rows]},layout:{fillColor:(index:number)=>index===0?"#e9eeeb":position.offers[index-1]?.isBaselineReference?"#f2f6ed":position.offers[index-1]?.isAlternative?"#fff8eb":null,hLineColor:()=>"#cbd5cf",vLineColor:()=>"#d9e0db",paddingLeft:()=>3,paddingRight:()=>3,paddingTop:()=>2.5,paddingBottom:()=>2.5}},
    ],
  };
}

async function saveDefinition(definition:Record<string,unknown>,filename:string) {
  const [pdfMakeModule,fontModule]=await Promise.all([import("pdfmake/build/pdfmake"),import("pdfmake/build/vfs_fonts")]);
  const pdfMake=pdfMakeModule.default,fontFiles=fontModule.default;
  pdfMake.addVirtualFileSystem(fontFiles);
  const blob=await new Promise<Blob>((resolve)=>pdfMake.createPdf(definition).getBlob(resolve));
  const url=URL.createObjectURL(blob),anchor=document.createElement("a");
  anchor.href=url;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  return {filename,sizeBytes:blob.size};
}

export async function saveQuoteComparisonPdf(report:QuoteComparisonReport,context:PrintContext) {
  const filename=`${cleanFilePart(report.context.baselineEstimateRef)}-Supplier-Comparison.pdf`;
  return saveDefinition(buildDocument(report,context,await drawingAssets(report)),filename);
}

export async function saveQuoteComparisonPositionPdf(report:QuoteComparisonReport,context:PrintContext,positionReference:string) {
  const position=report.positions.find((item)=>item.reference===positionReference);
  if(!position)throw new Error(`Position ${positionReference} is not present in this comparison.`);
  const filename=`${cleanFilePart(report.context.baselineEstimateRef)}-Position-${cleanFilePart(position.reference)}-Supplier-Comparison.pdf`;
  const assets=await drawingAssets(report,new Set([position.reference]));
  return saveDefinition(buildPositionDocument(report,context,position,assets),filename);
}
