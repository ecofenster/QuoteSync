import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('approved Project Costing worksheet and quotation workflow mount', async () => {
  const workspace=await readFile('src/features/projectCalculatorLab/ProjectCalculatorLabWorkspace.tsx','utf8');
  const worksheet=await readFile('src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx','utf8');
  assert.match(workspace,/if\(isOpenScenario\(active\)\).*ScenarioCostingWorksheet/s);
  assert.match(workspace,/Project Costing/);
  for(const label of ['Supplier Quotations','Quotation','Extraction Review','Project Costing','Documents','History','Session Summary'])assert.match(worksheet,new RegExp(label));
  for(const column of ['Description','Supplier Cost','GBP','Markup %','Selling Price'])assert.match(worksheet,new RegExp(column));
  for(const heading of ['Products / Supply Only','Extras','Transport','Equipment Hire','Installation','Installation Materials','Import Fees & Duties','Commercial Summary'])assert.match(worksheet,new RegExp(heading));
});

test('worksheet sections preserve evidence, use icons and hide unused categories', async () => {
  const source=await readFile('src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx','utf8');
  assert.match(source,/row\.displayReference/);
  assert.match(source,/Original supplier transport/);
  assert.match(source,/packageItems\.filter\(row=>row\.included\)/);
  assert.match(source,/extras\.length\?<Section/);
  assert.match(source,/equipment\.length\?<Section/);
  assert.match(source,/fees\.length\?<Section/);
  assert.match(source,/function Icon/);
  assert.match(source,/Supplier costs remain immutable/i);
  assert.doesNotMatch(source,/sourceId|sourceRowId|raw JSON|JSON\.stringify/);
});

test('commercial summary reconciles category totals and saved rate evidence', async () => {
  const source=await readFile('src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx','utf8');
  for(const total of ['Project Cost \\(Ex VAT\\)','VAT','Project Cost \\(Inc VAT\\)','Selling Price','Gross Profit','Gross Margin','Overall Markup'])assert.match(source,new RegExp(total));
  assert.match(source,/sale=addDecimalAmounts\(\[discountedProductSale,extrasSale,transportSale,equipmentSale,installationSale,materialsSale,feeSale,siteVisitAllocatedToProducts\?null:siteVisitSale\]\)/);
  assert.match(source,/Site Visit \/ Travel/);
  assert.match(source,/customerDiscountAmount/);
  assert.match(source,/providerTimestamp/);
  assert.match(source,/revisionNumber/);
});

test('commercial sections expand without rendering the Admin catalogue', async () => {
  const source=await readFile('src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx','utf8');
  assert.match(source,/aria-expanded=\{open\}/);
  assert.match(source,/scenario\.products\.map\(\(row,index\)=><ProductRow/);
  assert.match(source,/setOpen\(current=>current===key\?null:key\)/);
  assert.doesNotMatch(source,/CalculatorAdminCatalogue|catalogueSnapshot\.catalogue/);
});
