import test from 'node:test';
import assert from 'node:assert/strict';
import {qualificationValidity,isQualificationDate} from '../shared/installationQualificationDates.js';
test('qualification validity uses inclusive calendar dates and the exact 30-day warning boundary',()=>{
  for(const [onDate,expected] of [['2026-01-01','not_yet_valid'],['2026-01-02','in_date'],['2026-11-30','in_date'],['2026-12-01','expiring'],['2026-12-31','expiring'],['2027-01-01','expired']])assert.equal(qualificationValidity('2026-01-02','2026-12-31',onDate),expected,onDate);
  assert.equal(qualificationValidity('','2026-12-31','2026-12-01'),'dates_missing');assert.equal(qualificationValidity('2026-02-30','2026-12-31'),'dates_missing');assert.equal(isQualificationDate('2028-02-29'),true);assert.equal(isQualificationDate('2026-02-29'),false);
});
