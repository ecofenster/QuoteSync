import assert from 'node:assert/strict';
import test from 'node:test';
import { customerLifecycleDocumentRendererInternals } from '../server/features/customerQuotations/customerLifecycleDocumentRenderer.js';

test('factory schedule excludes customer prices and terms without changing customer Order rendering', () => {
  const projection = { clientName:'Disposable customer', projectName:'Test site', estimateReference:'TEST-001', totalIncVatGbp:98765.43, commercialTerms:{terms:['PRIVATE CUSTOMER TERMS']}, positions:[{id:'p1',reference:'W1',quantity:2,widthMm:1234,heightMm:1500,totalSellingPriceGbp:12345.67,productSystem:'Reviewed system',specification:[{label:'Colour',value:'RAL 7016'}]}] };
  const args = {kind:'order',projection,context:{reference:'TEST-ORDER',estimateRevision:2,audience:'factory-price-free-v1'},assets:{drawings:new Map(),showcases:new Map()}};
  const factory = JSON.stringify(customerLifecycleDocumentRendererInternals.documentDefinition(args));
  for (const value of ['Factory Order schedule','W1','1234','RAL 7016']) assert.ok(factory.includes(value));
  for (const value of ['12,345.67','98,765.43','PRIVATE CUSTOMER TERMS','TOTAL INCLUDING VAT','Estimate validity']) assert.ok(!factory.includes(value),value);
  const customer = JSON.stringify(customerLifecycleDocumentRendererInternals.documentDefinition({...args,context:{reference:'TEST-ORDER'}}));
  for (const value of ['12,345.67','98,765.43','PRIVATE CUSTOMER TERMS','TOTAL INCLUDING VAT']) assert.ok(customer.includes(value),value);
});
