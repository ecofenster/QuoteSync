import test from 'node:test';
import assert from 'node:assert/strict';
import {extractSupplierDocument} from '../server/features/supplierImportLab/documentExtraction.js';
import {parseCommercialFields} from '../server/features/supplierImportLab/commercialFieldParser.js';
import {sourceBackedGlassFallback} from '../server/features/installationSafety/installationGlazingEvidence.js';
import {projectInstallationPositionWeight} from '../server/features/installationSafety/installationPositionWeight.js';

test('actual WinPro Glazing required evidence maps once while manufacturer unit weight retains precedence',async()=>{
  const document=await extractSupplierDocument('docs/Supplier_Quotes/Eko_Example/Kosztorys - OF_25_2263569.pdf',{id:'readonly-glazing-source',mediaType:'application/pdf'});
  const parsed=parseCommercialFields(document,{currency:'GBP'}),source=parsed.rows.find(row=>row.displayReference==='001');
  assert.equal(parsed.adapter,'eko_okna_winpro_v1');
  const position={id:'disposable-position',quantity:source.quantity,widthMm:source.widthMm,heightMm:source.heightMm};
  const row={...position,estimatePositionId:position.id,sourceRowId:source.id,sourceSnapshot:source.originalExtractedSnapshot};
  const before=JSON.stringify(row),result=sourceBackedGlassFallback(position,row);
  assert.equal(result.status,'estimated_glass_only');
  assert.equal(result.source.label,'Glazing required');assert.equal(result.source.page,2);
  assert.ok(Math.abs(result.glassKg-46.56465)<1e-8,'1227 × 1265 envelope with three 4mm panes is counted once');
  assert.equal(row.sourceSnapshot.manufacturerEvidence.canonicalSpecification.glazingUnits.length,2);
  const preferred=projectInstallationPositionWeight(position,{products:[row]});
  assert.equal(preferred.status,'manufacturer_stated_unit');assert.equal(preferred.unitKg,68);
  assert.equal(JSON.stringify(row),before,'Read-only extraction/projection must not rewrite manufacturer evidence');
  // Controlled missing-weight variant is service-level fault coverage, not an unchanged-source end-to-end claim.
  const missing=structuredClone(row);missing.sourceSnapshot.manufacturerEvidence.weightKg=null;
  missing.sourceSnapshot.manufacturerEvidence.canonicalSpecification.weightKg=null;
  assert.equal(projectInstallationPositionWeight(position,{products:[missing]}).status,'estimated_glass_only');
  const field=missing.sourceSnapshot.manufacturerEvidence.sourceSpecification.sections.flatMap(section=>section.fields).find(item=>item.label==='Glazing required');
  field.section='Messages';assert.equal(sourceBackedGlassFallback(position,missing),null,'A similarly labelled message cannot supply glazing');
});
