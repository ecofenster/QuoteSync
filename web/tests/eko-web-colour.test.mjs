import test from 'node:test';
import assert from 'node:assert/strict';
import {extractSupplierDocument} from '../server/features/supplierImportLab/documentExtraction.js';
import {parsePdfSupplierFields} from '../server/features/supplierImportLab/pdfSupplierAdapters.js';

test('genuine EKO WEB colour retains Position-local source evidence and rejects ambiguous or missing headings',async()=>{
  const document=await extractSupplierDocument('docs/Supplier_Quotes/John_Wingfield/web-26-1133450.pdf',{id:'read-only-colour-source',mediaType:'application/pdf'});
  const row=parsePdfSupplierFields(document).rows.find(item=>item.displayReference==='001');
  assert.equal(row.manufacturerEvidence.canonicalSpecification.finish.value,'RAL: 7016 (Anthracite grey) Matt');
  const field=row.manufacturerEvidence.sourceSpecification.sections[0].fields[0];
  assert.equal(field.sourcePage,1);assert.ok(field.boundingRegion);assert.equal(field.sourceBlockIds.length,1);
  assert.equal(field.sourceText,'Colour: RAL: 7016 (Anthracite grey) Matt');
  assert.equal(row.manufacturerEvidence.canonicalSpecification.externalFinish,undefined);
  const missing=structuredClone(document);missing.pages[0].blocks=missing.pages[0].blocks.filter(block=>!/^Colour\s*:/i.test(block.text));
  assert.equal(parsePdfSupplierFields(missing).rows.find(item=>item.displayReference==='001').manufacturerEvidence.sourceSpecification,null,'Vent colour or another Position must not supply a missing product Colour');
  const ambiguous=structuredClone(document);const colour=ambiguous.pages[0].blocks.find(block=>/^Colour\s*:/i.test(block.text));
  ambiguous.pages[0].blocks.push({...colour,id:'conflicting-colour',text:'Colour: RAL 9005'});
  assert.equal(parsePdfSupplierFields(ambiguous).rows.find(item=>item.displayReference==='001').manufacturerEvidence.sourceSpecification,null);
});
