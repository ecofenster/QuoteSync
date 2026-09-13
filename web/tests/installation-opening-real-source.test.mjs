import test from 'node:test';
import assert from 'node:assert/strict';
import {extractSupplierDocument} from '../server/features/supplierImportLab/documentExtraction.js';
import {parseCommercialFields} from '../server/features/supplierImportLab/commercialFieldParser.js';
import {projectInstallationDocument} from '../server/features/installationSafety/installationDocumentProjection.js';
import {installerOpeningDetails} from '../server/features/installationSafety/installationPositionSource.js';
import {renderInstallationDocumentPdf} from '../server/features/installationSafety/installationDocumentRenderer.js';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

test('genuine source opening fields retain exact references in installer PDF without changing client projection',async()=>{
  const extracted=await extractSupplierDocument('docs/Supplier_Quotes/Eko_Example/Kosztorys - OF_25_2263569.pdf',{id:'readonly-opening-source',mediaType:'application/pdf'});
  const source=parseCommercialFields(extracted,{currency:'GBP'}).rows.find(row=>row.displayReference==='001');
  const position={id:'p',reference:'001',quantity:source.quantity,widthMm:source.widthMm,heightMm:source.heightMm};
  const row={...position,estimatePositionId:'p',sourceRowId:source.id,sourceSnapshot:source.originalExtractedSnapshot},scenario={estimateId:'estimate',products:[row]},revision={estimateId:'estimate',revision:1,positions:[position]},before=JSON.stringify(row);
  const expected='1.01: Side Hung - Turn; 2.01: Fix in frame';
  assert.equal(installerOpeningDetails(position,scenario),expected);
  const document=projectInstallationDocument({audience:'installer',revision,scenario});assert.equal(document.positions[0].opening,expected);
  assert.equal(projectInstallationDocument({audience:'client',revision,scenario}).positions[0].opening,'');
  const task=getDocument({data:new Uint8Array(await renderInstallationDocumentPdf(document)),useSystemFonts:true});
  try{const pdf=await task.promise;let text='';for(let i=1;i<=pdf.numPages;i++)text+=(await(await pdf.getPage(i)).getTextContent()).items.map(item=>item.str).join(' ');assert.match(text,/1\.01: Side Hung - Turn; 2\.01: Fix in frame/);}finally{await task.destroy();}
  assert.equal(JSON.stringify(row),before);
  const missing=structuredClone(scenario),canonical=missing.products[0].sourceSnapshot.manufacturerEvidence.canonicalSpecification;
  canonical.sashes[0].sourceFieldIds=[];assert.equal(installerOpeningDetails(position,missing),'1.01: Not confirmed; 2.01: Fix in frame');
  canonical.sashes[1].sourceElementReference='1.01';assert.equal(installerOpeningDetails(position,missing),'');
  const stale=structuredClone(scenario);stale.products[0].heightMm++;assert.equal(installerOpeningDetails(position,stale),'');
  assert.equal(projectInstallationDocument({audience:'installer',revision:{...revision,positions:[{...position,openingType:'Reviewed opening'}]},scenario}).positions[0].opening,'Reviewed opening');
});
