import test from 'node:test';
import assert from 'node:assert/strict';
import {uniformGlassPaneThicknesses} from '../server/features/installationSafety/installationGlazingEvidence.js';
import {projectInstallationPositionWeight} from '../server/features/installationSafety/installationPositionWeight.js';
import {projectInstallationDocument} from '../server/features/installationSafety/installationDocumentProjection.js';
import {renderInstallationDocumentPdf} from '../server/features/installationSafety/installationDocumentRenderer.js';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
const fixture=()=>{const position={id:'p',quantity:2,widthMm:1000,heightMm:2000},value='4th/14Ar/4/14Ar/4th [Ug=0.6] Rw=32dB (40mm)',field={id:'glass-field',label:'Glazing',rawValue:value,sourcePage:3},canonical={glazing:{value,sourceFieldId:field.id},glazingUnits:[{glassBuildUp:value},{glassBuildUp:value}]},row={...position,estimatePositionId:'p',sourceRowId:'source',sourceSnapshot:{manufacturerEvidence:{canonicalSpecification:canonical,sourceSpecification:{sections:[{fields:[field]}]}}}};return {position,row,canonical,field,scenario:{products:[row]}};};
test('retained uniform source build-up uses glass panes only and the unit envelope once',()=>{
  const data=fixture(),before=JSON.stringify(data),result=projectInstallationPositionWeight(data.position,data.scenario);
  assert.deepEqual(uniformGlassPaneThicknesses(data.canonical.glazing.value),[4,4,4]);assert.equal(result.glassKg,60);assert.equal(result.unitKg,null);assert.equal(result.source.page,3);assert.equal(result.status,'estimated_glass_only');assert.match(result.reason,/Not complete unit weight/);assert.equal(JSON.stringify(data),before);
});
test('mixed fields, laminate shorthand and missing/conflicting source evidence stay unresolved',()=>{
  for(const value of ['Triple 48mm','44.2/16Ar/4','4/16/unknown','4/16/4/16','4/0/4','4/16/4 or 6/16/6','4/16/4 optional build'])assert.equal(uniformGlassPaneThicknesses(value),null);
  for(const mutate of [data=>data.canonical.glazingUnits[1].glassBuildUp='6/16/6',data=>data.field.rawValue='other',data=>data.field.sourcePage=null,data=>data.row.sourceSnapshot.shape='raked',data=>delete data.row.sourceRowId]){const data=fixture();mutate(data);assert.equal(projectInstallationPositionWeight(data.position,data.scenario).status,'not_confirmed');}
});
test('ambiguous manufacturer weight is not silently replaced by a glass estimate',()=>{
  const data=fixture();data.row.sourceSnapshot.manufacturerEvidence.weightKg='150';const result=projectInstallationPositionWeight(data.position,data.scenario);assert.equal(result.status,'manufacturer_basis_unconfirmed');assert.equal(result.glassKg,undefined);
});
test('installer PDF labels approximate glass-only weight with source and missing-component warning',async()=>{
  const data=fixture(),document=projectInstallationDocument({audience:'installer',revision:{estimateId:'estimate',estimateReference:'FALLBACK-TEST',revision:1,positions:[data.position]},scenario:{...data.scenario,estimateId:'estimate'}}),task=getDocument({data:new Uint8Array(await renderInstallationDocumentPdf(document)),useSystemFonts:true});
  try{const pdf=await task.promise;let text='';for(let i=1;i<=pdf.numPages;i++)text+=(await(await pdf.getPage(i)).getTextContent()).items.map(item=>item.str).join(' ');assert.match(text,/60 kg glass only/);assert.match(text,/Estimated glass weight using approximate dimensions/);assert.match(text,/Not complete unit weight/);assert.match(text,/page 3/);assert.doesNotMatch(text,/60 kg per unit|120 kg/);}finally{await task.destroy();}
});
