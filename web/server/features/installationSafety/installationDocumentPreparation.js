import {createHash} from 'node:crypto';
import {loadInstallationDocumentRevision} from './installationDocumentSource.js';
import {projectInstallationDocument} from './installationDocumentProjection.js';
import {createProjectCalculatorLabService} from '../projectCalculatorLab/projectCalculatorLabService.js';

const fail=message=>Object.assign(new Error(message),{status:409,code:'installation_document_calculation_review'});
const included=items=>items.filter(item=>item.includedInCurrentEstimate!==false&&item.classification!=='alternative');
const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>0;
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function reviewInstallationCalculationScope(revision,scenario,expectedRevision){
  // Identity and saved revision are prerequisites, not user-resolvable Position differences.
  if(!scenario||scenario.estimateId!==revision.estimateId||Number(scenario.revisionNumber)!==expectedRevision||!Number.isInteger(expectedRevision))throw fail('The selected installation calculation is missing or has changed. Reopen it for review.');
  const positions=revision.orderId?revision.positions:included(revision.positions),products=included(scenario.products||[]),ids=new Set(positions.map(item=>item.id));
  const fields=['quantity','widthMm','heightMm'];
  const rows=positions.map(position=>{
    const matches=products.filter(item=>item.estimatePositionId===position.id),product=matches.length===1?matches[0]:null;
    const differences=product?fields.filter(key=>!finite(position[key])||!finite(product[key])||Number(position[key])!==Number(product[key])).map(key=>({field:key,scheduled:finite(position[key])?Number(position[key]):null,calculated:finite(product[key])?Number(product[key]):null})):[];
    return {id:position.id,reference:position.reference||position.positionRef||'Position reference not confirmed',status:!matches.length?'missing':matches.length>1?'repeated':differences.length?'different':'matches',differences};
  });
  const extra=products.filter(item=>!ids.has(item.estimatePositionId)).map(item=>({reference:item.displayReference||'Position reference not confirmed',status:item.estimatePositionId?'not_in_schedule':'unlinked'}));
  let ready=true,message='The saved calculation covers this exact schedule. Review the operational details in the draft PDF.';
  try{validateInstallationDocumentCalculation(revision,scenario,expectedRevision);}catch(error){if(error.code!=='installation_document_calculation_review')throw error;ready=false;message=error.message;}
  return {ready,message,rows,extra,scenarioRevision:expectedRevision,sourceRevision:revision.revision,orderId:revision.orderId||null,nextAction:ready?'Prepare the draft PDF; nothing will be sent.':revision.orderId?'Select an installation calculation reviewed for these accepted Positions. Do not change the sold Estimate to remove these differences.':'Review and save the installation calculation for this schedule, then check again.'};
}

export async function loadInstallationCalculationReview(db,input){
  const source=await loadInstallationDocumentRevision(db,input);
  const scenario=input.scenarioId?await createProjectCalculatorLabService(db).getScenario(input.scenarioId):null;
  const review=reviewInstallationCalculationScope(source,scenario,input.scenarioRevision);
  const current=await loadInstallationDocumentRevision(db,input),saved=await db.get('SELECT revision_number FROM project_calculator_lab_scenarios WHERE id=?',input.scenarioId);
  if(fingerprint(current)!==fingerprint(source)||Number(saved?.revision_number)!==input.scenarioRevision)throw fail('The schedule or calculation changed during review. Check the current values again.');
  return review;
}

export function validateInstallationDocumentCalculation(revision,scenario,expectedRevision){
  if(!scenario||scenario.estimateId!==revision.estimateId)throw fail('Choose a saved installation calculation for this Estimate.');
  if(!Number.isInteger(expectedRevision)||Number(scenario.revisionNumber)!==expectedRevision)throw fail('The installation calculation changed. Review its current saved revision before preparing the document.');
  if(!Array.isArray(scenario.products))throw fail('The installation calculation has no retained Position coverage.');
  // The source loader already selected exact accepted Order Positions. Historical Estimate flags cannot undo acceptance.
  const positions=revision.orderId?revision.positions:included(revision.positions),products=included(scenario.products),byPosition=new Map();
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
  if(input.orderPlanId){
    if(!revision.orderId)throw fail('Select the exact Order for this reviewed installation plan.');
    const row=await db.get('SELECT * FROM order_installation_plans WHERE id=? AND order_id=? AND client_id=? AND estimate_id=?',input.orderPlanId,revision.orderId,revision.clientId,revision.estimateId);
    if(!row)throw fail('The reviewed installation plan is unavailable for this Order.');
    const plan=JSON.parse(row.plan_json);
    if(plan.binding.sourceReleaseId!==revision.sourceReleaseId||plan.binding.estimateRevision!==revision.revision)throw fail('The reviewed installation plan belongs to a different accepted revision.');
    validateInstallationDocumentCalculation(revision,plan.proposedScenario,plan.binding.scenarioRevision);
    if(plan.document.orderId!==revision.orderId||fingerprint(plan.document.positions.map(item=>item.id).sort())!==fingerprint(revision.positions.map(item=>item.id).sort()))throw fail('The retained plan document does not cover this accepted Order.');
    return {document:plan.document,source:revision,calculation:{...plan.binding,orderPlanId:row.id,orderPlanVersion:row.version,reviewedBy:row.reviewed_by,reviewedAt:row.reviewed_at,reviewReason:row.review_reason}};
  }
  if(!input.scenarioId)throw fail('Select the saved installation calculation to review for this pack.');
  const selected=await db.get('SELECT estimate_id,revision_number FROM project_calculator_lab_scenarios WHERE id=?',input.scenarioId);
  if(!selected||selected.estimate_id!==revision.estimateId||Number(selected.revision_number)!==input.scenarioRevision)throw fail('The selected installation calculation is missing or has changed. Reopen it for review.');
  const scenario=await createProjectCalculatorLabService(db).getScenario(input.scenarioId);
  const calculation=validateInstallationDocumentCalculation(revision,scenario,input.scenarioRevision);
  const current=await loadInstallationDocumentRevision(db,input),currentScenario=await db.get('SELECT revision_number FROM project_calculator_lab_scenarios WHERE id=?',input.scenarioId);
  if(fingerprint(current)!==fingerprint(revision)||Number(currentScenario?.revision_number)!==input.scenarioRevision)throw fail('The schedule or calculation changed during preparation. Review the current values and try again.');
  return {document:projectInstallationDocument({audience:'installer',revision,scenario}),source:revision,calculation};
}
