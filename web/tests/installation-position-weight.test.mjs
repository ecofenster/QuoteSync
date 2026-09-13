import test from 'node:test';
import assert from 'node:assert/strict';
import {projectInstallationPositionWeight as project} from '../server/features/installationSafety/installationPositionWeight.js';
import {projectInstallationDocument} from '../server/features/installationSafety/installationDocumentProjection.js';
import {renderInstallationDocumentPdf} from '../server/features/installationSafety/installationDocumentRenderer.js';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
const fixture=()=>{const position={id:'accepted',quantity:3,widthMm:1000,heightMm:1200},field={id:'weight-source',label:'Unit weight',normalizedValue:'84.5',rawValue:'84.5 kg',sourcePage:2},row={estimatePositionId:'accepted',sourceRowId:'source-row',sourceRevisionId:'source-revision',quantity:3,widthMm:1000,heightMm:1200,sourceSnapshot:{manufacturerEvidence:{canonicalSpecification:{weightKg:{value:'84.5',sourceFieldId:field.id}},sourceSpecification:{sections:[{name:'Performance',fields:[field]}]}}}};return {position,field,row,scenario:{estimateId:'estimate',products:[row]}};};
test('unit weight uses its exact Position and retained per-unit field without multiplying by quantity',()=>{
  const {position,scenario}=fixture(),before=JSON.stringify(scenario),result=project(position,scenario);assert.equal(result.unitKg,84.5);assert.equal(result.status,'manufacturer_stated_unit');assert.equal(result.source.page,2);assert.equal(result.source.sourceRowId,'source-row');assert.equal(result.handlingConfirmationRequired,true);assert.equal(JSON.stringify(scenario),before);
});
test('ambiguous basis, absent provenance and conflicting source ownership never become unit weights',()=>{
  for(const mutate of [data=>data.field.label='Total weight',data=>delete data.row.sourceRowId,data=>data.field.normalizedValue='90',data=>data.field.sourcePage=null,data=>data.row.sourceSnapshot.manufacturerEvidence.canonicalSpecification.weightKg.sourceFieldId='another']){const data=fixture();mutate(data);const result=project(data.position,data.scenario);assert.equal(result.unitKg,null);assert.equal(result.statedKg,84.5);}
  for(const mutate of [data=>data.row.estimatePositionId='another',data=>data.row.quantity=4,data=>data.scenario.products.push(data.row)]){const data=fixture();mutate(data);assert.equal(project(data.position,data.scenario).unitKg,null);}
});
test('installer projection retains sourced weight and client projection excludes internal handling evidence',()=>{
  const {position,scenario}=fixture(),revision={estimateId:'estimate',revision:1,positions:[position]};
  const installer=projectInstallationDocument({audience:'installer',revision,scenario}),client=projectInstallationDocument({audience:'client',revision,scenario});assert.equal(installer.positions[0].weight.unitKg,84.5);assert.equal(client.positions[0].weight,undefined);assert.doesNotMatch(JSON.stringify(client),/source-row|weight-source|Handling/);
});
test('downloadable PDF states unit basis and source page without implying lifting approval',async()=>{
  const {position,scenario}=fixture(),model=projectInstallationDocument({audience:'installer',revision:{estimateId:'estimate',estimateReference:'WEIGHT-TEST',revision:1,positions:[position]},scenario}),task=getDocument({data:new Uint8Array(await renderInstallationDocumentPdf(model)),useSystemFonts:true});
  try{const pdf=await task.promise;let text='';for(let i=1;i<=pdf.numPages;i++)text+=(await(await pdf.getPage(i)).getTextContent()).items.map(item=>item.str).join(' ');assert.match(text,/84.5 kg per unit/);assert.match(text,/page 2/);assert.match(text,/not a verified lifting plan/);assert.doesNotMatch(text,/253.5|source-row|weight-source/);}finally{await task.destroy();}
});
