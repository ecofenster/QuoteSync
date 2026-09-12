import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
pdfMake.addVirtualFileSystem(pdfFonts);

const clean=value=>String(value??"").trim();
const date=value=>{const parsed=new Date(value||Date.now());return Number.isNaN(parsed.valueOf())?clean(value):new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"long",year:"numeric"}).format(parsed)};
export async function renderInstallationRamsPdf(projection){
  const hazards=projection.hazards.filter(item=>item.applies!==false),unknowns=projection.unknowns||[];
  const definition={pageSize:"A4",pageMargins:[38,38,38,44],info:{title:`RAMS ${projection.reference}`,subject:`Reviewed installation RAMS revision ${projection.version}`,author:"QuoteSuite"},defaultStyle:{font:"Roboto",fontSize:9,color:"#17211d",lineHeight:1.2},styles:{title:{fontSize:20,bold:true,color:"#17211d"},heading:{fontSize:13,bold:true,color:"#17211d",margin:[0,14,0,5]},label:{fontSize:8,bold:true,color:"#58645e"},warning:{color:"#8a5b00",bold:true}},footer:(current,pageCount)=>({columns:[{text:`${projection.reference} · RAMS R${projection.version}`},{text:`Page ${current} of ${pageCount}`,alignment:"right"}],margin:[38,10,38,0],fontSize:7,color:"#68736d"}),content:[
    {text:"RISK ASSESSMENT & METHOD STATEMENT",style:"label"},{text:projection.title,style:"title"},{text:`${projection.reference} · Revision ${projection.version} · ${date(projection.issuedAt)}`,margin:[0,3,0,14]},
    {table:{widths:[120,"*"],body:[["Client",projection.clientName],["Project / site",projection.projectName||projection.siteAddress],["Estimate / Order",projection.orderReference||projection.estimateReference],["Installation team",projection.teamName||"Not confirmed"],["Planned attendance",projection.attendance||"Not confirmed"],["Responsible reviewer",`${projection.reviewerName} · ${projection.reviewerRole}`]]},layout:"lightHorizontalLines"},
    {text:"Important",style:"heading"},{text:"This document records a competent person's reviewed project-specific assessment. QuoteSuite-generated prompts are drafts and are not automatic proof of compliance or approval."},
    {text:"Project and work",style:"heading"},{text:projection.workSummary},
    {text:"Site conditions",style:"heading"},{text:projection.siteConditions||"Not confirmed",style:projection.siteConditions?undefined:"warning"},
    {text:"Hazards and controls",style:"heading"},...hazards.flatMap(item=>[{text:item.hazard,bold:true,margin:[0,5,0,2]},{ul:item.controls.map(clean).filter(Boolean).length?item.controls.map(clean).filter(Boolean):["Control not confirmed"],style:item.controls.length?undefined:"warning"}]),
    {text:"Method",style:"heading"},{ol:projection.methodSteps.map(clean).filter(Boolean)},
    {text:"Public protection",style:"heading"},{text:projection.publicProtection||"Not confirmed",style:projection.publicProtection?undefined:"warning"},
    {text:"Waste",style:"heading"},{text:projection.wasteArrangements||"Not confirmed",style:projection.wasteArrangements?undefined:"warning"},
    {text:"Emergency arrangements",style:"heading"},{text:projection.emergencyArrangements||"Not confirmed",style:projection.emergencyArrangements?undefined:"warning"},
    ...(projection.specialistAssessment?[{text:"Specialist assessment / external documents",style:"heading"},{text:projection.specialistAssessment}]:[]),
    {text:"Workforce qualification summary",style:"heading"},...(projection.qualificationSummary.length?projection.qualificationSummary.map(item=>({text:`${item.name}: ${item.summary}`})):[{text:"Qualification check not confirmed",style:"warning"}]),
    ...(unknowns.length?[{text:"Outstanding information",style:"heading"},{ul:unknowns,style:"warning"}]:[]),
    {text:"Review",style:"heading"},{text:`Reviewed by ${projection.reviewerName} (${projection.reviewerRole}) on ${date(projection.reviewedAt)}. The reviewer confirmed they are competent to review this RAMS for the described work.`},
    {text:"Workforce briefing acknowledgements are recorded separately against this exact issued revision.",margin:[0,8,0,0]},
  ]};
  return new Promise((resolve,reject)=>{try{pdfMake.createPdf(definition).getBuffer(value=>resolve(Buffer.from(value)))}catch(error){reject(error)}});
}
