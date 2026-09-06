import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('approved Project Costing worksheet and quotation workflow mount', async () => {
  const workspace=await readFile('src/features/projectCalculatorLab/ProjectCalculatorLabWorkspace.tsx','utf8');
  const worksheet=await readFile('src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx','utf8');
  const headerRows=await readFile('src/features/estimateCommercial/EstimateCommercialHeaderRows.tsx','utf8');
  assert.match(workspace,/if\s*\(\s*isOpenScenario\(active\)\s*\)[\s\S]*ScenarioCostingWorksheet/);
  assert.match(workspace,/Project Costing/);
  for(const label of ['Estimate','Next Action','Create Revision','Review Customer Quotation'])assert.match(headerRows,new RegExp(label));
  assert.doesNotMatch(worksheet,/project-costing__breadcrumbs|project-costing__sidebar|Extraction Review|Session Summary/);
  assert.match(worksheet,/data-project-costing-order="project-costing"/);
  for(const column of ['Description','Supplier Cost','GBP','Markup %','Selling Price'])assert.match(worksheet,new RegExp(column));
  for(const heading of ['Products / Supply Only','Extras','Transport','Import / Customs','Installation','Installation Materials','Commercial Summary'])assert.match(worksheet,new RegExp(heading));
  assert.match(worksheet,/equipment\.map/);
});

test('worksheet sections preserve evidence, use icons and hide unused categories', async () => {
  const source=await readFile('src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx','utf8');
  const commercial=await readFile('src/features/projectCalculatorLab/domain/projectCostingCommercialResult.ts','utf8');
  assert.match(source,/row\.displayReference/);
  assert.match(source,/Original Supplier Transport/);
  assert.match(commercial,/packageItems\.filter\(\(row\) => row\.included\)/);
  assert.match(source,/extras\.length\s*\?\s*\(\s*<Section/);
  assert.match(source,/equipment\.map\(\s*\(?(?:item)?/);
  assert.match(source,/title="Import \/ Customs"/);
  assert.match(source,/Legacy import fee evidence/);
  assert.match(source,/function Icon/);
  assert.match(source,/Fixed\/Captured rates remain the saved costing basis/i);
  assert.doesNotMatch(source,/sourceId|sourceRowId|raw JSON|JSON\.stringify/);
});

test('Products / Supply keeps previews clean and opens rich evidence from the Specification column', async () => {
  const [source,css]=await Promise.all([readFile('src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx','utf8'),readFile('src/features/projectCalculatorLab/projectCalculatorLab.css','utf8')]);
  const previewCells=[...source.matchAll(/<td className="costing-sheet__product-image">([\s\S]*?)<\/td>/g)];
  const internalPreview=previewCells.at(-1)?.[1]??'';
  assert.match(internalPreview,/Manufacturer preview/);
  assert.match(internalPreview,/manufacturerVisualOrientationLabel/);
  assert.doesNotMatch(internalPreview,/details|summary|ManufacturerPositionSourceDetail|Internal specification|technical fields|manufacturerQuotedUg|manufacturerQuotedUw/);
  assert.match(source,/<th>Preview \/ Product Image<\/th>[\s\S]*?<th>Ug<\/th>[\s\S]*?<th>Uw<\/th>[\s\S]*?<th>Specification<\/th>[\s\S]*?<th>Action<\/th>/);
  assert.match(source,/aria-label=\{`Open specification for \$\{row\.displayReference\}`\}>Specification<\/button>/);
  assert.match(source,/role="dialog" aria-modal="true"/);
  assert.match(source,/Internal product and manufacturer evidence/);
  for(const label of ['Product / system','Opening / configuration','Internal finish','External finish','Frame / profile','Glazing','Hardware / fittings','Thermal','Weight / perimeter','Accessories','Manufacturer messages / warnings','Complete manufacturer specification'])assert.match(source,new RegExp(label.replace('/','\\/')));
  assert.match(source,/sourceSpecification/);
  assert.match(source,/canonicalSpecification/);
  assert.match(source,/internalSpecification/);
  assert.match(source,/internalGroups/);
  assert.doesNotMatch(source,/technical fields/);
  assert.doesNotMatch(source,/EKO|Zyle|Gutmann|Internorm/i);
  assert.doesNotMatch(source,/customerSafeSpecification\.map/);
  assert.match(css,/\.costing-sheet__specification-modal/);
  assert.match(css,/@media \(max-width: 620px\)[\s\S]*\.costing-sheet__specification-modal/);
  assert.match(css,/var\(--qs-(?:bg|theme|border)-/);
});

test('commercial summary reconciles category totals and saved rate evidence', async () => {
  const source=await readFile('src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx','utf8');
  const commercial=await readFile('src/features/projectCalculatorLab/domain/projectCostingCommercialResult.ts','utf8');
  for(const total of ['Actual GBP Purchase Cost','VAT Treatment','Total Including VAT','Selling Price','Gross Profit','Gross Margin','Overall Markup'])assert.match(source,new RegExp(total));
  assert.match(source,/deriveProjectCostingCommercialResult/);
  assert.match(commercial,/calculatedSale\s*=\s*addDecimalAmounts\(\[discountedProductSale, extrasSale, transportSale, equipmentSale, installationSale, surveySale, materialsSale, feeSale, siteVisitAllocatedToProducts \? null : siteVisitSale\]\)/);
  assert.match(commercial,/actualSale\s*=\s*customerPricing\.fixedSellingPrice\.enabled\s*\?\s*customerPricing\.fixedSellingPrice\.amount\s*:\s*calculatedSale/);
  assert.match(source,/Survey \/ Site Visit/);
  assert.match(source,/customerDiscountAmount/);
  assert.match(source,/providerTimestamp/);
  assert.match(source,/costing-sheet__saved/);
  assert.doesNotMatch(source,/Saved · Revision/);
});

test('commercial sections expand without rendering the Admin catalogue', async () => {
  const source=await readFile('src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx','utf8');
  assert.match(source,/aria-expanded=\{open\}/);
  assert.match(source,/scenario\.products\.map\(\(row, index\)\s*=>\s*\(\s*<ProductRow/);
  assert.match(source,/setOpen\(\(current\)\s*=>\s*\(current === key \? null : key\)\)/);
  assert.doesNotMatch(source,/CalculatorAdminCatalogue|catalogueSnapshot\.catalogue/);
});
