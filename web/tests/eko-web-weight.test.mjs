import test from 'node:test';
import assert from 'node:assert/strict';
import {extractSupplierDocument} from '../server/features/supplierImportLab/documentExtraction.js';
import {parsePdfSupplierFields} from '../server/features/supplierImportLab/pdfSupplierAdapters.js';

test('genuine WEB source retains five Position-local kilogram fields without changing prices or drawings',async()=>{
  const document=await extractSupplierDocument('docs/Supplier_Quotes/John_Wingfield/web-26-1133450.pdf',{id:'read-only-weight-source',mediaType:'application/pdf'});
  const parsed=parsePdfSupplierFields(document);
  assert.equal(parsed.rows.length,5);
  assert.equal(parsed.rows.reduce((total,row)=>total+Number(row.totalPrice),0).toFixed(2),'7885.45');
  const expected=[[96.8,1],[182.1,3],[182.1,4],[74.9,5],[50.9,6]];
  for(const [index,row] of parsed.rows.entries()){
    const evidence=row.manufacturerEvidence;
    const canonical=evidence.canonicalSpecification.weightKg;
    const fields=evidence.sourceSpecification.sections.flatMap(section=>section.fields);
    const field=fields.find(item=>item.id===canonical.sourceFieldId);
    assert.deepEqual([Number(canonical.value),field.sourcePage],expected[index]);
    assert.equal(field.label,'Unit weight');assert.match(field.rawValue,/Kg$/);
    assert.equal(evidence.sourceVisual.sourcePage,expected[index][1]);
    assert.equal(evidence.sourceVisual.mappingMethod,'eko-web-inside-position-region-v1');
    assert.ok(field.boundingRegion);assert.equal(field.coordinateSpace,'pdf_points');
    assert.equal(evidence.sourceSpecification.supplierInterpretation,'eko_web_itemised_colour_weight_v2');
  }
  const first=doc=>parsePdfSupplierFields(doc).rows.find(row=>row.displayReference==='001').manufacturerEvidence.canonicalSpecification.weightKg;
  const missing=structuredClone(document);
  missing.pages[0].blocks=missing.pages[0].blocks.filter(block=>block.text!=='Unit weight');
  assert.equal(first(missing),undefined,'Other Positions and the quotation total must not supply missing weight');
  const wrongUnit=structuredClone(document);
  const value=wrongUnit.pages[0].blocks.find(block=>block.text==='96,8 Kg');value.text='96,8 lb';
  assert.equal(first(wrongUnit),undefined);
  const duplicate=structuredClone(document);
  const pair=duplicate.pages[0].blocks.filter(block=>['Unit weight','96,8 Kg'].includes(block.text));
  duplicate.pages[0].blocks.push(...pair.map(block=>({...block,id:`duplicate-${block.id}`,boundingBox:{...block.boundingBox,y:block.boundingBox.y-4}})));
  assert.equal(first(duplicate),undefined,'Multiple Unit weight rows require review');
  const shared=structuredClone(document);
  shared.pages[0].blocks.push({...shared.pages[0].blocks.find(block=>block.text==='Window 001'),id:'shared-marker',text:'Window 099'});
  assert.equal(first(shared),undefined,'An unbounded multi-Position page cannot supply weight');
});
