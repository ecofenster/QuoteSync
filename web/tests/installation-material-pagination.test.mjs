import test from 'node:test';
import assert from 'node:assert/strict';
import {projectInstallationDocument} from '../server/features/installationSafety/installationDocumentProjection.js';
import {renderInstallationDocumentPdf} from '../server/features/installationSafety/installationDocumentRenderer.js';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
const model=()=>projectInstallationDocument({audience:'installer',revision:{estimateId:'test',estimateReference:'PAGINATION',revision:1,positions:[{id:'p',reference:'P1',quantity:1,widthMm:1000,heightMm:1200}]}});
async function pages(document){const task=getDocument({data:new Uint8Array(await renderInstallationDocumentPdf(document)),useSystemFonts:true});try{const pdf=await task.promise,rows=[];for(let i=1;i<=pdf.numPages;i++)rows.push((await(await pdf.getPage(i)).getTextContent()).items.map(item=>item.str).join(' '));return rows;}finally{await task.destroy();}}
test('small material heading, quantity and review remain on one PDF page',async()=>{
  const document=model();document.installation.materials={status:'Review required',rows:Array.from({length:18},(_,i)=>({code:`MAT-${i}-END`,name:`Selected specification ${i}`,quantity:i+1,unit:'roll',linearMetres:25,basis:'Saved perimeter plus 15% contingency; whole-unit rounding',status:`REVIEW-${i}-END`}))};
  const output=await pages(document);assert.ok(output.length>3);
  for(let i=0;i<18;i++){const found=output.filter(text=>text.includes(`MAT-${i}-END`));assert.equal(found.length,1);assert.ok(found[0].includes(`REVIEW-${i}-END`),`Material ${i} split from its review`);}
});
test('long retained material evidence flows without clipping or discarding its final review',async()=>{
  const document=model();document.installation.materials={status:'Review required',rows:[{code:'LONG-MATERIAL',name:'Retained specification',quantity:null,unit:'items',specification:'Source evidence retained. '.repeat(350)+'SOURCE-END',basis:'Basis not confirmed',status:'FINAL-REVIEW-END'}]};
  const output=await pages(document),text=output.join(' ');assert.match(text,/SOURCE-END/);assert.match(text,/FINAL-REVIEW-END/);assert.ok(output.filter(page=>page.includes('LONG-MATERIAL')).length>1,'Long material must retain repeated heading context');
});
test('installer headings use familiar fixing names rather than internal keys',async()=>{
  const document=model();document.installation.materials={status:'Review required',rows:[{code:'substrateFixings',name:'Substrate fixings',quantity:null,unit:'items',status:'Not confirmed'}]};
  const output=(await pages(document)).join(' ');assert.match(output,/Substrate fixings/);assert.doesNotMatch(output,/substrateFixings/);
});
