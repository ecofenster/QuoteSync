import test from 'node:test';
import assert from 'node:assert/strict';
import {qualificationValidity,isQualificationDate} from '../shared/installationQualificationDates.js';
import {installationQualificationSummary} from '../shared/installationQualificationSummary.js';
test('qualification validity uses inclusive calendar dates and the exact 30-day warning boundary',()=>{
  for(const [onDate,expected] of [['2026-01-01','not_yet_valid'],['2026-01-02','in_date'],['2026-11-30','in_date'],['2026-12-01','expiring'],['2026-12-31','expiring'],['2027-01-01','expired']])assert.equal(qualificationValidity('2026-01-02','2026-12-31',onDate),expected,onDate);
  assert.equal(qualificationValidity('','2026-12-31','2026-12-01'),'dates_missing');assert.equal(qualificationValidity('2026-02-30','2026-12-31'),'dates_missing');assert.equal(isQualificationDate('2028-02-29'),true);assert.equal(isQualificationDate('2026-02-29'),false);
});
test('document qualification summaries separate validity and verification without leaking identifiers or notes',()=>{
  const summary=installationQualificationSummary({members:[{name:'Test Installer',qualifications:[{typeLabel:'CSCS card',attendanceValidity:'in_date',verificationStatus:'recorded_unverified',expiryDate:'2027-01-01',reference:'PRIVATE-CARD',verificationNotes:'PRIVATE-NOTE',evidenceDocumentId:'PRIVATE-FILE'}]}]});
  assert.match(summary[0].summary,/In date; Evidence unverified/);assert.doesNotMatch(JSON.stringify(summary),/PRIVATE/);
});
test('safe summary uses explicit renewal lineage while retaining earlier attendance evidence and independent cards',()=>{
  const old={id:'old',typeCode:'cscs',typeLabel:'CSCS card',attendanceValidity:'in_date',verificationStatus:'verified',expiryDate:'2027-01-01'};
  const renewal={...old,id:'new',supersedesQualificationId:'old',expiryDate:'2028-01-01'};
  const summary=items=>installationQualificationSummary({members:[{name:'Installer',qualifications:items}]})[0].summary;
  assert.doesNotMatch(summary([old,renewal]),/2027-01-01/);
  assert.match(summary([old,renewal]),/2028-01-01/);
  for(const change of [{attendanceValidity:'not_yet_valid'},{verificationStatus:'recorded_unverified'},{attendanceValidity:'dates_missing'}]){
    const result=summary([old,{...renewal,...change}]);assert.match(result,/2027-01-01/);assert.match(result,/2028-01-01/);
  }
  assert.match(summary([old,{...renewal,supersedesQualificationId:null}]),/2027-01-01/,'Independent cards must not be merged');
  assert.match(summary([{...old,supersedesQualificationId:'new'},renewal]),/2027-01-01/,'Cycles retain evidence');
  assert.equal(summary([]),'No qualifications supplied');
  assert.equal(old.expiryDate,'2027-01-01','Source evidence must remain unchanged');
});
