import test from 'node:test';
import assert from 'node:assert/strict';
import {calculatePaneWeights} from '../shared/glassWeightArithmetic.js';
import {estimateInstallationGlassWeight as estimate} from '../server/features/installationSafety/installationGlassWeight.js';
const panes=[{kind:'float',thicknessMm:4},{kind:'toughened',thicknessMm:4}];
test('shared glass arithmetic retains existing tool results and strict fallback never becomes unit/lifting weight',()=>{
  assert.deepEqual(calculatePaneWeights(2,[4,4]),{paneWeights:[20,20],total:40,avg:20});assert.deepEqual(calculatePaneWeights(1,[]),{paneWeights:[],total:0,avg:0});
  const result=estimate({widthMm:1000,heightMm:2000,panes});assert.equal(result.glassKg,40);assert.equal(result.status,'estimated_glass_only');assert.equal(result.handlingConfirmationRequired,true);assert.match(result.label,/approximate dimensions/);assert.match(result.warning,/Not complete unit weight/);assert.equal(result.unitWeightKg,undefined);
});
test('field splits count each distinct area once and never add the outer envelope again',()=>{
  const input={widthMm:2000,heightMm:2000,panes,fields:[{xMm:0,yMm:0,widthMm:1000,heightMm:2000,panes},{xMm:1000,yMm:0,widthMm:1000,heightMm:2000,panes}]},before=JSON.stringify(input);assert.equal(estimate(input).glassKg,80);assert.equal(JSON.stringify(input),before);
  input.fields[1].xMm=500;assert.match(estimate(input).reason,/overlap/);input.fields[1].xMm=1500;assert.match(estimate(input).reason,/outside/);
});
test('unknown panes, missing geometry and non-rectangular shapes remain explicitly unresolved',()=>{
  for(const patch of [{panes:[]},{panes:[{kind:'float'}]},{panes:[{kind:'laminated',lamCode:'44.2'}]},{widthMm:null},{fields:[]},{shape:'raked'},{panes:[{kind:'float',thicknessMm:0}]}]){const result=estimate({widthMm:1000,heightMm:2000,panes,...patch});assert.equal(result.glassKg,null);assert.equal(result.status,'not_confirmed');}
  assert.ok(Math.abs(estimate({widthMm:1000,heightMm:1000,panes:[{kind:'laminated',effectiveMm:8.76}]}).glassKg-21.9)<1e-10);
});
