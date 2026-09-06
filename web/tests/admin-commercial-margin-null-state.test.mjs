import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT_COMMERCIAL_MARGIN_POLICY,normalizeCommercialMarginPolicy} from '../src/features/projectCalculatorLab/domain/commercialMargin.ts';

test('missing and null policies normalize to canonical defaults',()=>{for(const input of [undefined,null])assert.deepEqual(normalizeCommercialMarginPolicy(input),DEFAULT_COMMERCIAL_MARGIN_POLICY)});

test('partial and null fields normalize independently with complete status bands',()=>{const policy=normalizeCommercialMarginPolicy({targetGrossMarginPercent:null,minimumAcceptableGrossMarginPercent:'27',bands:[{status:'low',minimumPercent:null},{status:'healthy',minimumPercent:'32'},null]});assert.equal(policy.targetGrossMarginPercent,'35');assert.equal(policy.minimumAcceptableGrossMarginPercent,'27');assert.deepEqual(policy.bands,[{status:'low',minimumPercent:'0'},{status:'caution',minimumPercent:'25'},{status:'healthy',minimumPercent:'32'},{status:'strong',minimumPercent:'35'},{status:'high',minimumPercent:'40'}])});

test('valid customized policy survives normalization unchanged',()=>{const input={targetGrossMarginPercent:'38',minimumAcceptableGrossMarginPercent:'26',fxMaterialityThresholdPercent:'2.5',bands:[{status:'low',minimumPercent:'1'},{status:'caution',minimumPercent:'26'},{status:'healthy',minimumPercent:'31'},{status:'strong',minimumPercent:'38'},{status:'high',minimumPercent:'45'}],capturedAt:'2026-08-12'};assert.deepEqual(normalizeCommercialMarginPolicy(input),input)});

test('invalid individual values use defaults without discarding valid neighbours',()=>{const policy=normalizeCommercialMarginPolicy({targetGrossMarginPercent:'not-a-number',minimumAcceptableGrossMarginPercent:'100',bands:[{status:'high',minimumPercent:'101'}]});assert.deepEqual(policy,DEFAULT_COMMERCIAL_MARGIN_POLICY)});

test('Admin panel normalizes API settings and captures input values before state updaters',async()=>{const source=await readFile('src/features/admin/AdminCommercialMarginPanel.tsx','utf8');assert.match(source,/normalizeCommercialMarginPolicy\(row\?\.value\)/);assert.doesNotMatch(source,/setPolicy\(current=>\([^)]*event\.currentTarget\.value/);assert.match(source,/const value=event\.currentTarget\.value;setPolicy/)});
