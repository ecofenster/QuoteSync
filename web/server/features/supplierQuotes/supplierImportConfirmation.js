const countKeys = [
  'sourcePositions',
  'parsedPositions',
  'selectedPositions',
  'validCanonicalPositions',
  'reviewRequiredPositions',
  'persistedPositions',
  'productsSupplyRows',
  'projectCostingRows',
  'includedRows',
  'alternativeRows',
  'excludedRows',
];

export function createSupplierImportConfirmationResponse(result, costing) {
  if (!result || !Array.isArray(result.documents)) {
    throw Object.assign(new Error('Supplier confirmation did not return document results.'), { code: 'supplier_confirmation_contract_error' });
  }
  const counts = Object.fromEntries(countKeys.map((key) => [key, 0]));
  for (const document of result.documents) {
    if (!document?.diagnostics?.counts) {
      throw Object.assign(new Error('Supplier confirmation diagnostics are incomplete.'), { code: 'supplier_confirmation_contract_error' });
    }
    for (const key of countKeys) counts[key] += Number(document.diagnostics.counts[key] || 0);
  }
  const completion = evaluateSupplierImportCompletion(counts);
  const operationStatus = result.operationStatus || completion.status;
  if (operationStatus === 'confirmed' && !completion.confirmed) {
    throw Object.assign(new Error(`Supplier confirmation failed its persisted completion gate. ${completion.failures.join(' ')}`), { code: 'supplier_confirmation_contract_error', diagnostics: { counts, completion } });
  }
  return { ...result, status: operationStatus, operationStatus, counts, completion, costing };
}

export const supplierImportConfirmationCountKeys = Object.freeze([...countKeys]);
import { evaluateSupplierImportCompletion } from './supplierImportReliability.js';
