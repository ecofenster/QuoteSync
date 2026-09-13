import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateInstallationMaterials} from '../server/features/projectCalculatorLab/installationMaterials.js';
import {projectInstallationMaterials} from '../server/features/installationSafety/installationMaterialProjection.js';
import {projectInstallationDocument} from '../server/features/installationSafety/installationDocumentProjection.js';
import {renderInstallationDocumentPdf} from '../server/features/installationSafety/installationDocumentRenderer.js';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

test('actual saved material calculation projects units and quantities without commercial fields in installer PDF',async()=>{
  const catalogue=[{id:'membrane',category:'illbruck_me508',active:true,label:'ME508 100 mm',rateType:'roll',currency:'GBP',priceAmount:'8765.43',variant:{rollLengthM:25}},{id:'gun',category:'tool',active:true,label:'AA270',currency:'GBP',priceAmount:'9876.54',variant:{productCode:'AA270'}}];
  const result=calculateInstallationMaterials({positions:[{id:'p',displayReference:'W01',quantity:2,widthMm:1000,heightMm:1200,framePerimeterMetres:8.8,includedInCurrentEstimate:true}],rules:{},options:{materialSelections:{ME508:{required:true,productId:'membrane'},AA270:{required:true,productId:'gun'}}},catalogue});
  const before=JSON.stringify(result),materials=projectInstallationMaterials(result),membrane=materials.rows.find(item=>item.code==='ME508');
  assert.equal(membrane.linearMetres,10.12);assert.equal(membrane.quantity,1);assert.equal(membrane.unit,'roll');assert.equal(membrane.rollLengthMetres,25);assert.equal(materials.rows.find(item=>item.code==='AA270').quantity,1);assert.equal(membrane.areaSquareMetres,null,'No derived surface area without a reviewed basis');assert.equal(JSON.stringify(result),before);
  assert.doesNotMatch(JSON.stringify(materials),/8765|9876|purchaseCost|unitCost|priceAmount/);
  const revision={estimateId:'estimate',estimateReference:'TEST-MATERIALS',revision:1,positions:[{id:'p',reference:'W01',quantity:2,widthMm:1000,heightMm:1200}]},scenario={estimateId:'estimate',installationMaterials:result};
  for(const audience of ['installer','client']){
    const model=projectInstallationDocument({audience,revision,scenario}),bytes=await renderInstallationDocumentPdf(model),task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true});
    try{const pdf=await task.promise;let output='';for(let i=1;i<=pdf.numPages;i++)output+=(await(await pdf.getPage(i)).getTextContent()).items.map(item=>item.str).join(' ');assert.doesNotMatch(output,/8765|9876|8,765|9,876|purchaseCost|unitCost/);if(audience==='installer'){assert.match(output,/ME508/);assert.match(output,/10.12 m/);assert.match(output,/AA270/);}else assert.doesNotMatch(output,/ME508|AA270|Installation materials|Food allowance/);}finally{await task.destroy();}
  }
});
test('unknown material evidence remains unknown and excluded materials do not appear',()=>{
  assert.deepEqual(projectInstallationMaterials(null),{status:'Not confirmed',rows:[]});
  const model=projectInstallationMaterials({perimeterStatus:'review_required',simpleMaterials:[{code:'ME508',required:true,requiredLengthM:null,baseLinearMetres:0,purchaseUnits:null,purchaseUnit:'roll',status:'Perimeter review required'},{code:'AA270',required:false,purchaseUnits:0}],purchasing:{brackets:{requiredQuantity:null,status:'GGF fixing rule required'}}});
  assert.equal(model.rows.length,2);assert.equal(model.rows[0].quantity,null);assert.equal(model.rows[0].baseLinearMetres,null);assert.equal(model.rows[1].quantity,null);
});
