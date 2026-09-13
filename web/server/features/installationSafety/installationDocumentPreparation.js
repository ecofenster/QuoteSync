import {createHash} from 'node:crypto';
import {loadInstallationDocumentRevision} from './installationDocumentSource.js';
import {projectInstallationDocument} from './installationDocumentProjection.js';
import {createProjectCalculatorLabService} from '../projectCalculatorLab/projectCalculatorLabService.js';

const fail=message=>Object.assign(new Error(message),{status:409,code:'installation_document_calculation_review'});
const included=items=>items.filter(item=>item.includedInCurrentEstimate!==false&&item.classification!=='alternative');
const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>0;
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function validateInstallationDocumentCalculation(revision,scenario,expectedRevision){
  if(!scenario||scenario.estimateId!==revision.estimateId)throw fail('Choose a saved installation calculation for this Estimate.');
  if(!Number.isInteger(expectedRevision)||Number(scenario.revisionNumber)!==expectedRevision)throw fail('The installation calculation changed. Review its current saved revision before preparing the document.');
  if(!Array.isArray(scenario.products))throw fail('The installation calculation has no retained Position coverage.');
  const positions=included(revision.positions),products=included(scenario.products),byPosition=new Map();
  for(const item of products){
    // Costing-row IDs and supplier references must never substitute for canonical Position identity.
    if(!item.estimatePositionId||byPosition.has(item.estimatePositionId))throw fail('Installation costing has missing or repeated Position relationships. Review the schedule mapping before preparing this pack.');
    byPosition.set(item.estimatePositionId,item);
  }
  if(products.length!==positions.length)throw fail('The saved installation calculation covers a different set of Positions. Review the selected schedule and calculation.');
  for(const item of positions){const product=byPosition.get(item.id);
    if(!product||['quantity','widthMm','heightMm'].some(key=>!finite(item[key])||!finite(product[key])||Number(item[key])!==Number(product[key])))throw fail(`Position ${item.reference||item.positionRef||'not confirmed'} differs from the saved installation calculation or has missing dimensions. Review it before preparing the pack.`);
  }
  if(!scenario.catalogueSnapshot?.rules?.installation_programme_v1?.value)throw fail('The saved installation rule snapshot is missing. Review and save the installation calculation; current Administration defaults cannot replace its history.');
  return {scenarioId:scenario.id,scenarioRevision:Number(scenario.revisionNumber),positionIds:positions.map(item=>item.id),fingerprint:fingerprint({products,options:scenario.options,catalogueSnapshot:scenario.catalogueSnapshot,routeSnapshots:scenario.routeSnapshots,installationProgramme:scenario.installationProgramme})};
}

// Internal read-only preparation boundary. No browser-supplied costing or latest-scenario selection.
// Persistence and reviewed delivery must retain the returned source identities and fingerprint.
// source/calculation are staff-only binding evidence; only document is an audience-safe projection.
export async function loadInstallationDocumentPreparation(db,input){
  const revision=await loadInstallationDocumentRevision(db,input);
  if(input.audience==='client')return {document:projectInstallationDocument({audience:'client',revision}),source:revision,calculation:null};
  if(input.audience!=='installer')throw fail('Choose installer pack or client price-free schedule.');
  if(!input.scenarioId)throw fail('Select the saved installation calculation to review for this pack.');
  const selected=await db.get('SELECT estimate_id,revision_number FROM project_calculator_lab_scenarios WHERE id=?',input.scenarioId);
  if(!selected||selected.estimate_id!==revision.estimateId||Number(selected.revision_number)!==input.scenarioRevision)throw fail('The selected installation calculation is missing or has changed. Reopen it for review.');
  const scenario=await createProjectCalculatorLabService(db).getScenario(input.scenarioId);
  const calculation=validateInstallationDocumentCalculation(revision,scenario,input.scenarioRevision);
  const current=await loadInstallationDocumentRevision(db,input),currentScenario=await db.get('SELECT revision_number FROM project_calculator_lab_scenarios WHERE id=?',input.scenarioId);
  if(fingerprint(current)!==fingerprint(revision)||Number(currentScenario?.revision_number)!==input.scenarioRevision)throw fail('The schedule or calculation changed during preparation. Review the current values and try again.');
  return {document:projectInstallationDocument({audience:'installer',revision,scenario}),source:revision,calculation};
}
